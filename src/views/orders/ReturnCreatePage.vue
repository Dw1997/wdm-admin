<script setup lang="ts">
import { useRouter } from 'vue-router'

import { customerApi, orderApi, returnApi } from '@/api'
import type { CounterOrder, CounterOrderItem, OrderListItem, ReturnCreateInput, ReturnDisposition, ReturnPreview, ReturnTerms } from '@/types'
import { returnDispositionLabels, returnRefundLabels } from '@/utils/dict'
import ReturnTermsFields from './ReturnTermsFields.vue'
import { printReturnOrder, returnTermsPayload, validReturnFreight } from './returnOrderActions'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const customer = ref<number | 'walk-in' | null>(null)
const customers = ref<{ label: string; value: number }[]>([])
const orders = ref<OrderListItem[]>([])
const orderPage = ref(1)
const orderTotal = ref(0)
const orderId = ref<number | null>(null)
const order = ref<CounterOrder | null>(null)
const reason = ref('')
const terms = ref<ReturnTerms>({ return_freight_mode: 'none', freight_cost: null, refund_method: 'credit' })
const rows = ref<{ item: CounterOrderItem; available: number; selected: boolean; quantity: number | null; disposition: ReturnDisposition }[]>([])
const preview = ref<ReturnPreview | null>(null)
const loadingOrders = ref(false)
const loadingDetail = ref(false)
const loadingCustomers = ref(false)
const previewing = ref(false)
const saving = ref(false)
let customerRequest = 0
let orderRequest = 0
let detailRequest = 0
let revision = 0
let submission: { body: string; key: string } | undefined

async function searchCustomers(keyword = '') {
  const request = ++customerRequest
  loadingCustomers.value = true
  try {
    const result = await customerApi.list({ keyword, page_size: 30 })
    if (request === customerRequest) customers.value = result.items.map(c => ({ label: c.name, value: c.id }))
  } catch {
    // 请求错误由统一拦截器提示。
  } finally {
    if (request === customerRequest) loadingCustomers.value = false
  }
}

async function loadOrders(page = 1) {
  const request = ++orderRequest
  ++detailRequest
  loadingDetail.value = false
  orderId.value = null
  order.value = null
  rows.value = []
  orders.value = []
  orderTotal.value = 0
  orderPage.value = page
  loadingOrders.value = Boolean(customer.value)
  if (!customer.value) return
  try {
    const result = await orderApi.list({
      status: 'delivered', page, page_size: 20,
      ...(customer.value === 'walk-in' ? { is_walk_in: true } : { customer_id: customer.value }),
    })
    if (request !== orderRequest) return
    orders.value = result.items
    orderTotal.value = result.total
  } catch {
    // 请求错误由统一拦截器提示。
  } finally {
    if (request === orderRequest) loadingOrders.value = false
  }
}

async function loadDetail(id: number | null) {
  const request = ++detailRequest
  order.value = null
  rows.value = []
  loadingDetail.value = Boolean(id)
  if (!id) return
  try {
    const detail = await orderApi.counterGet(id)
    if (request !== detailRequest) return
    order.value = detail
    rows.value = detail.items.map(item => ({
      item,
      available: Number((Number(item.delivered_quantity ?? item.quantity) - Number(item.returned_quantity)).toFixed(1)),
      selected: false, quantity: null, disposition: 'restock',
    }))
  } catch {
    // 请求错误由统一拦截器提示。
  } finally {
    if (request === detailRequest) loadingDetail.value = false
  }
}

watch(customer, value => {
  terms.value.refund_method = value === 'walk-in' ? 'cash' : 'credit'
  void loadOrders()
})
watch([order, rows, terms], () => {
  revision++
  preview.value = null
}, { deep: true, flush: 'sync' })
onMounted(() => void searchCustomers())

function payload(): ReturnCreateInput | undefined {
  const selected = rows.value.filter(row => row.selected)
  if (!order.value || !selected.length) {
    message.warning('请选择原订单和退货商品')
    return
  }
  if (selected.some(row => !row.quantity || row.quantity <= 0 || row.quantity > row.available)) {
    message.warning('本次退货数量须大于 0 且不超过可退数量')
    return
  }
  const freight = returnTermsPayload(terms.value)
  if (!validReturnFreight(freight)) {
    message.warning('请填写非负运费，最多两位小数')
    return
  }
  return {
    ...freight,
    order_id: order.value.id,
    items: selected.map(row => ({
      order_item_id: row.item.id, quantity: String(row.quantity), disposition: row.disposition,
    })),
  }
}

async function updatePreview() {
  const body = payload()
  if (!body) return
  const current = revision
  previewing.value = true
  try {
    const result = await returnApi.preview(body)
    if (current === revision) preview.value = result
  } catch {
    if (current === revision) preview.value = null
  } finally {
    previewing.value = false
  }
}

function askSave(withPrint: boolean) {
  if (!preview.value || saving.value) return
  const body = payload()
  if (!body) return
  body.reason = reason.value.trim()
  if (!body.reason) {
    message.warning('请填写退货原因')
    return
  }
  const current = revision
  dialog.warning({
    title: '确认保存退货单',
    content: `管理员保存后立即生效。预计冲原单 ¥${preview.value.original_offset_amount}，${returnRefundLabels[body.refund_method]} ¥${preview.value.refundable_amount}。`,
    positiveText: withPrint ? '保存并打单' : '确认保存',
    negativeText: '返回修改',
    onPositiveClick: () => {
      if (current !== revision || saving.value) return
      void save(body, withPrint)
    },
  })
}

async function save(body: ReturnCreateInput, withPrint: boolean) {
  saving.value = true
  const printPage = withPrint ? window.open('', '_blank') : null
  try {
    const serialized = JSON.stringify(body)
    if (submission?.body !== serialized) submission = { body: serialized, key: crypto.randomUUID() }
    const result = await returnApi.create(body, submission.key)
    const saved = result.return_order
    message.success(`已保存 ${saved.return_no}，冲原单 ¥${saved.original_offset_amount}，${returnRefundLabels[saved.refund_method]} ¥${saved.refund_method === 'credit' ? saved.credit_amount : saved.refund_amount}`)
    for (const warning of result.warnings) message.warning(warning.message)
    if (printPage) {
      try {
        await printReturnOrder(saved, printPage)
      } catch {
        message.warning('退货单已保存，可在列表重新打单')
      }
    } else if (withPrint) {
      message.warning('打印窗口被拦截，可在列表重新打单')
    }
    await router.replace({ name: 'order-center-refund', query: { status: saved.status } })
  } catch {
    printPage?.close()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <n-space class="page-flow" vertical :size="10">
    <n-card title="选择客户和原订单">
      <n-form :disabled="saving">
        <n-grid :cols="2" :x-gap="16">
          <n-form-item-gi label="客户">
            <n-select v-model:value="customer" remote filterable clearable :loading="loadingCustomers"
              :options="[{ label: '门店散客', value: 'walk-in' }, ...customers]" @search="searchCustomers" />
          </n-form-item-gi>
          <n-form-item-gi label="已送达原订单">
            <n-select v-model:value="orderId" clearable :disabled="!customer" :loading="loadingOrders || loadingDetail"
              :options="orders.map(item => ({ value: item.id, label: item.order_no }))" @update:value="loadDetail" />
          </n-form-item-gi>
        </n-grid>
        <n-pagination v-if="orderTotal > 20" :page="orderPage" :page-size="20" :item-count="orderTotal" @update:page="loadOrders" />
        <n-alert v-if="order" type="info">
          原订单 {{ order.order_no }} · 送达 {{ order.delivered_at ? new Date(order.delivered_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—' }}
          · 订单金额 ¥{{ order.delivered_amount ?? order.total_amount }} · 已收 ¥{{ order.paid_amount }} · 待核销 ¥{{ order.unpaid_amount }}
        </n-alert>
      </n-form>
    </n-card>

    <n-card title="选择退货商品">
      <n-table v-if="rows.length" :single-line="false">
        <thead><tr><th>选择</th><th>商品 / 规格</th><th>单位</th><th>实送</th><th>已退</th><th>可退</th><th>原单售价</th><th>本次退货数量</th><th>去向</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.item.id">
            <td><n-checkbox v-model:checked="row.selected" :disabled="saving || row.available <= 0" /></td>
            <td>{{ row.item.spu_name }} / {{ row.item.sku_spec }}</td>
            <td>{{ row.item.unit }}</td><td>{{ row.item.delivered_quantity ?? row.item.quantity }}</td>
            <td>{{ row.item.returned_quantity }}</td><td>{{ row.available }}</td><td>¥{{ row.item.unit_price }}</td>
            <td><n-input-number v-model:value="row.quantity" :min="0" :max="row.available" :precision="1" :step="0.1" :disabled="saving || !row.selected" :show-button="false" /></td>
            <td><n-select v-model:value="row.disposition" :disabled="saving || !row.selected"
              :options="Object.entries(returnDispositionLabels).map(([value, label]) => ({ value, label }))" /></td>
          </tr>
        </tbody>
      </n-table>
      <n-empty v-else :description="loadingDetail ? '正在加载原订单' : '请先选择原订单'" />
    </n-card>

    <n-grid :cols="2" :x-gap="16">
      <n-gi>
        <n-card title="退货原因与款项处理">
          <n-form :disabled="saving">
            <n-form-item label="退货原因" required>
              <n-input v-model:value="reason" type="textarea" :maxlength="500" show-count />
            </n-form-item>
            <ReturnTermsFields v-model="terms" :walk-in="customer === 'walk-in'" />
          </n-form>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card title="金额预览">
          <template #header-extra>
            <n-button :loading="previewing" :disabled="saving || !order" @click="updatePreview">更新金额预览</n-button>
          </template>
          <n-descriptions v-if="preview" :column="1" label-placement="left">
            <n-descriptions-item label="退货商品金额">¥{{ preview.goods_amount }}</n-descriptions-item>
            <n-descriptions-item label="退货运费补偿">¥{{ preview.freight_compensation_amount }}</n-descriptions-item>
            <n-descriptions-item label="可处理总额">¥{{ preview.total_credit_amount }}</n-descriptions-item>
            <n-descriptions-item label="先冲原订单未付金额">¥{{ preview.original_offset_amount }}</n-descriptions-item>
            <n-descriptions-item :label="terms.refund_method === 'credit' ? '挂账待抵余额' : '实际退款金额'">¥{{ preview.refundable_amount }}</n-descriptions-item>
          </n-descriptions>
          <n-empty v-else description="选择退货商品并更新金额预览" />
        </n-card>
      </n-gi>
    </n-grid>
    <n-space justify="end">
      <n-button :disabled="saving" @click="router.push({ name: 'order-center-refund' })">返回列表</n-button>
      <n-button :disabled="!preview || saving || previewing" @click="askSave(false)">保存</n-button>
      <n-button type="primary" :loading="saving" :disabled="!preview || previewing" @click="askSave(true)">保存并打单</n-button>
    </n-space>
  </n-space>
</template>
