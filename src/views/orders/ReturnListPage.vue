<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { Eye, Printer } from '@vicons/tabler'

import { customerApi, orderApi, returnApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import type { ReturnOrder, ReturnStatus, ReturnTerms } from '@/types'
import { returnDispositionLabels, returnFreightLabels, returnRefundLabels, returnSettlementLabels, returnStatusLabels } from '@/utils/dict'
import ReturnTermsFields from './ReturnTermsFields.vue'
import { printReturnOrder, returnTermsPayload, validReturnFreight } from './returnOrderActions'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const message = useMessage()
function allowed(permission: string) {
  return auth.user?.role === 'admin' || Boolean(auth.user?.permissions?.some(p => p === '*' || p === permission))
}
const status = ref<ReturnStatus | 'all'>(route.query.status === 'confirmed' ? 'confirmed' : 'pending')
const emptyFilters = () => ({ keyword: '', customer_id: null as number | null, refund_method: null as string | null, date_from: '', date_to: '' })
const filters = ref(emptyFilters())
const applied = ref(emptyFilters())
const dateRange = ref<[string, string] | null>(null)
const customers = ref<{ value: number; label: string }[]>([])
const rows = ref<ReturnOrder[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const failed = ref(false)
let listRequest = 0
let customerRequest = 0

const show = ref(false)
const action = ref<'view' | 'confirm' | 'reject'>('view')
const detail = ref<ReturnOrder | null>(null)
const detailLoading = ref(false)
const working = ref(false)
const printing = ref<number | null>(null)
const walkIn = ref(false)
const rejectReason = ref('')
const terms = ref<ReturnTerms>({ return_freight_mode: 'none', refund_method: 'credit', freight_cost: null })
let detailRequest = 0
let confirmation: { body: string; key: string } | undefined

async function searchCustomers(keyword = '') {
  const request = ++customerRequest
  try {
    const result = await customerApi.list({ keyword, page_size: 30 })
    if (request === customerRequest) customers.value = result.items.map(c => ({ value: c.id, label: c.name }))
  } catch {
    // 请求错误由统一拦截器提示。
  }
}

async function load(nextPage = 1) {
  const request = ++listRequest
  loading.value = true
  failed.value = false
  page.value = nextPage
  const f = applied.value
  try {
    const result = await returnApi.list({
      page: nextPage, page_size: 10, status: status.value === 'all' ? undefined : status.value,
      keyword: f.keyword.trim() || undefined, customer_id: f.customer_id ?? undefined,
      refund_method: f.refund_method ?? undefined, date_from: f.date_from || undefined, date_to: f.date_to || undefined,
    })
    if (request !== listRequest) return
    rows.value = result.items
    total.value = result.total
    if (!result.items.length && nextPage > 1) void load(Math.max(1, Math.ceil(result.total / 10)))
  } catch {
    if (request !== listRequest) return
    rows.value = []
    total.value = 0
    failed.value = true
  } finally {
    if (request === listRequest) loading.value = false
  }
}

function search() {
  const [dateFrom = '', dateTo = ''] = dateRange.value ?? []
  if (dateFrom && dateTo && dateFrom > dateTo) {
    message.warning('开始日期不能晚于结束日期')
    return
  }
  filters.value.date_from = dateFrom
  filters.value.date_to = dateTo
  applied.value = { ...filters.value }
  void load()
}

function reset() {
  filters.value = emptyFilters()
  dateRange.value = null
  status.value = 'pending'
  search()
}

async function open(row: ReturnOrder, mode: typeof action.value) {
  const request = ++detailRequest
  action.value = mode
  detail.value = null
  detailLoading.value = true
  rejectReason.value = ''
  show.value = true
  try {
    const data = await returnApi.get(row.id)
    const order = mode === 'confirm' && data.status === 'pending' ? await orderApi.counterGet(data.order_id) : null
    if (request !== detailRequest) return
    if (data.status !== 'pending') action.value = 'view'
    walkIn.value = Boolean(order?.is_walk_in)
    terms.value = { return_freight_mode: data.return_freight_mode, refund_method: data.refund_method, freight_cost: data.freight_cost }
    detail.value = data
  } catch {
    if (request === detailRequest) show.value = false
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}

async function commit() {
  const current = detail.value
  if (!current || working.value) return
  const reason = rejectReason.value.trim()
  const freight = returnTermsPayload(terms.value)
  if (action.value === 'reject' && !reason) {
    message.warning('请填写驳回原因')
    return
  }
  if (action.value === 'confirm' && !validReturnFreight(freight)) {
    message.warning('请填写非负运费，最多两位小数')
    return
  }
  working.value = true
  try {
    const body = { ...freight, items: current.items.map(({ order_item_id, disposition }) => ({ order_item_id, disposition })) }
    const serialized = JSON.stringify({ id: current.id, body })
    if (action.value === 'confirm' && confirmation?.body !== serialized) {
      confirmation = { body: serialized, key: crypto.randomUUID() }
    }
    const result = action.value === 'reject'
      ? await returnApi.reject(current.id, reason)
      : await returnApi.confirm(current.id, body, confirmation!.key)
    confirmation = undefined
    message.success(action.value === 'reject' ? '退货单已驳回' : '退货单已确认')
    for (const warning of result.warnings) message.warning(warning.message)
    detail.value = result.return_order
    action.value = 'view'
    void load(page.value)
  } catch {
    // 保留修改内容，便于修正后重试。
  } finally {
    working.value = false
  }
}

async function print(row: ReturnOrder) {
  if (printing.value !== null) return
  const printPage = window.open('', '_blank')
  if (!printPage) {
    message.warning('打印窗口被拦截，请允许打开窗口后重试')
    return
  }
  printing.value = row.id
  try {
    await printReturnOrder(row, printPage)
  } catch {
    message.warning('打单未完成，请重试')
  } finally {
    printing.value = null
  }
}

function dateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
}

onMounted(() => {
  void load()
  void searchCustomers()
})
</script>

<template>
  <n-space class="return-page" vertical :size="10">
    <n-card title="筛选退货单" class="return-filter-card">
      <template #header-extra>
        <n-button v-if="allowed('return.create')" type="primary" @click="router.push({ name: 'order-center-refund-new' })">＋ 新建退货单</n-button>
      </template>
      <n-form :show-feedback="false" @submit.prevent="search">
        <n-grid :cols="5" :x-gap="16">
          <n-form-item-gi label="退货单号 / 原订单号 / 客户">
            <n-input v-model:value="filters.keyword" clearable placeholder="输入关键词" @keyup.enter="search" />
          </n-form-item-gi>
          <n-form-item-gi label="客户">
            <n-select v-model:value="filters.customer_id" remote filterable clearable :options="customers" @search="searchCustomers" />
          </n-form-item-gi>
          <n-form-item-gi label="款项处理">
            <n-select v-model:value="filters.refund_method" clearable :options="Object.entries(returnRefundLabels).map(([value, label]) => ({ value, label }))" />
          </n-form-item-gi>
          <n-form-item-gi label="创建日期">
            <n-date-picker v-model:formatted-value="dateRange" type="daterange" value-format="yyyy-MM-dd"
              clearable start-placeholder="开始日期" end-placeholder="结束日期" />
          </n-form-item-gi>
          <n-form-item-gi label=" " class="filter-actions">
            <n-space :wrap="false">
              <n-button @click="reset">重置</n-button>
              <n-button type="primary" @click="search">查询</n-button>
            </n-space>
          </n-form-item-gi>
        </n-grid>
      </n-form>
    </n-card>

    <n-card>
      <n-tabs v-model:value="status" type="line" @update:value="() => load()">
        <n-tab v-for="(label, value) in returnStatusLabels" :key="value" :name="value">{{ label }}</n-tab>
        <n-tab name="all">全部</n-tab>
      </n-tabs>
      <n-spin :show="loading">
        <div class="return-table">
          <n-table :single-line="false">
            <thead><tr><th>创建时间</th><th>退货单号 / 原订单号</th><th>客户</th><th>退货商品金额</th><th>款项处理</th><th>实退 / 可抵余额</th><th>确认状态</th><th>平单状态</th><th>创建人</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td>{{ dateTime(row.created_at) }}</td>
                <td><n-button text type="primary" @click="open(row, 'view')">{{ row.return_no }}</n-button><div>原单 {{ row.order_no }}</div></td>
                <td>{{ row.customer_name }}</td><td>¥{{ row.goods_amount }}</td>
                <td>{{ returnRefundLabels[row.refund_method] }}</td>
                <td>{{ row.status !== 'confirmed' ? '—' : row.refund_method === 'credit' ? `可抵 ¥${row.available_credit_amount}` : `实退 ¥${row.refund_amount}` }}</td>
                <td><n-tag size="small" :type="row.status === 'confirmed' ? 'success' : row.status === 'pending' ? 'warning' : 'default'">{{ returnStatusLabels[row.status] }}</n-tag></td>
                <td>{{ row.status === 'confirmed' ? returnSettlementLabels[row.settlement_status] : '—' }}</td>
                <td>{{ row.created_by_name || '—' }}</td>
                <td>
                  <n-space :wrap="false" align="center" :size="10">
                    <n-tooltip placement="top" :delay="150">
                      <template #trigger>
                        <n-button text type="primary" aria-label="查看" @click="open(row, 'view')">
                          <template #icon><n-icon :component="Eye" :size="17" /></template>
                        </n-button>
                      </template>
                      查看
                    </n-tooltip>
                    <template v-if="row.status === 'pending' && allowed('return.confirm')">
                      <n-button text type="primary" @click="open(row, 'confirm')">确认</n-button>
                      <n-button text type="error" @click="open(row, 'reject')">驳回</n-button>
                    </template>
                    <n-tooltip v-if="row.status === 'confirmed' && allowed('print.documents')" placement="top" :delay="150">
                      <template #trigger>
                        <n-button text type="primary" aria-label="打单" :disabled="printing !== null" @click="print(row)">
                          <template #icon><n-icon :component="Printer" :size="17" /></template>
                        </n-button>
                      </template>
                      打单
                    </n-tooltip>
                    <n-tooltip v-if="row.status === 'confirmed' && Number(row.available_credit_amount) > 0 && allowed('return.settle')">
                      <template #trigger><span><n-button text disabled>平单</n-button></span></template>
                      退货平单页尚未开放
                    </n-tooltip>
                  </n-space>
                </td>
              </tr>
            </tbody>
          </n-table>
        </div>
        <n-empty v-if="!rows.length && !loading" class="return-empty" :description="failed ? '加载失败，请重新查询' : '暂无符合条件的退货单'" />
      </n-spin>
    </n-card>

    <div class="return-pagination">
      <span>共 {{ total }} 条</span>
      <n-pagination :page="page" :page-size="10" :item-count="total" show-quick-jumper @update:page="load" />
    </div>

    <n-modal v-model:show="show" preset="card" style="width: min(900px, 95vw)"
      :title="action === 'confirm' ? '确认退货单' : action === 'reject' ? '驳回退货单' : '退货单详情'"
      :closable="!working" :mask-closable="!working" :close-on-esc="!working">
      <n-spin :show="detailLoading">
        <n-space v-if="detail" vertical :size="16">
          <n-descriptions :column="3" bordered size="small">
            <n-descriptions-item label="退货单号">{{ detail.return_no }}</n-descriptions-item>
            <n-descriptions-item label="原订单">{{ detail.order_no }}</n-descriptions-item>
            <n-descriptions-item label="客户">{{ detail.customer_name }}</n-descriptions-item>
            <n-descriptions-item label="状态">{{ returnStatusLabels[detail.status] }}</n-descriptions-item>
            <n-descriptions-item label="退货原因">{{ detail.reason }}</n-descriptions-item>
            <n-descriptions-item label="退货商品金额">¥{{ detail.goods_amount }}</n-descriptions-item>
            <n-descriptions-item v-if="detail.reject_reason" label="驳回原因">{{ detail.reject_reason }}</n-descriptions-item>
            <template v-if="action === 'view'">
              <n-descriptions-item label="退货运费">{{ returnFreightLabels[detail.return_freight_mode] }} {{ detail.freight_cost === null ? '' : `¥${detail.freight_cost}` }}</n-descriptions-item>
              <n-descriptions-item label="款项处理">{{ returnRefundLabels[detail.refund_method] }}</n-descriptions-item>
              <template v-if="detail.status === 'confirmed'">
                <n-descriptions-item label="确认信息">{{ detail.confirmed_by_name || '—' }} · {{ detail.confirmed_at ? dateTime(detail.confirmed_at) : '—' }}</n-descriptions-item>
                <n-descriptions-item label="冲原订单未付金额">¥{{ detail.original_offset_amount }}</n-descriptions-item>
                <n-descriptions-item label="实际退款">¥{{ detail.refund_amount }}</n-descriptions-item>
                <n-descriptions-item label="挂账 / 已平 / 可抵">¥{{ detail.credit_amount }} / ¥{{ detail.settled_amount }} / ¥{{ detail.available_credit_amount }}</n-descriptions-item>
              </template>
            </template>
          </n-descriptions>
          <n-table>
            <thead><tr><th>商品 / 规格</th><th>数量</th><th>原单售价</th><th>金额</th><th>去向</th></tr></thead>
            <tbody>
              <tr v-for="item in detail.items" :key="item.order_item_id">
                <td>{{ item.spu_name }} / {{ item.sku_spec }}</td><td>{{ item.quantity }} {{ item.unit }}</td>
                <td>¥{{ item.unit_price }}</td><td>¥{{ item.amount }}</td>
                <td>
                  <n-select v-if="action === 'confirm'" v-model:value="item.disposition" :disabled="working"
                    :options="Object.entries(returnDispositionLabels).map(([value, label]) => ({ value, label }))" />
                  <template v-else>{{ returnDispositionLabels[item.disposition] }}</template>
                </td>
              </tr>
            </tbody>
          </n-table>
          <n-table v-if="detail.settlements.length">
            <thead><tr><th>平入订单</th><th>抵扣金额</th><th>平单时间</th></tr></thead>
            <tbody><tr v-for="line in detail.settlements" :key="line.settlement_id"><td>{{ line.order_no }}</td><td>¥{{ line.amount }}</td><td>{{ dateTime(line.created_at) }}</td></tr></tbody>
          </n-table>
          <n-form v-if="action === 'confirm'" :disabled="working">
            <ReturnTermsFields v-model="terms" :walk-in="walkIn" />
            <n-alert type="info">确认后立即生效，款项由服务端按最新账款计算。</n-alert>
          </n-form>
          <n-form-item v-if="action === 'reject'" label="驳回原因" required>
            <n-input v-model:value="rejectReason" type="textarea" :maxlength="500" :disabled="working" />
          </n-form-item>
        </n-space>
      </n-spin>
      <template #footer>
        <n-space justify="end">
          <n-button :disabled="working" @click="show = false">关闭</n-button>
          <n-button v-if="detail && action !== 'view'" :type="action === 'reject' ? 'error' : 'primary'" :loading="working" @click="commit">
            {{ action === 'reject' ? '确认驳回' : '确认退货' }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </n-space>
</template>

<style scoped>
.return-page { min-height: 100%; }
.return-filter-card :deep(.n-card__content) { padding-bottom: 0; }
.return-filter-card :deep(.n-form-item) { margin-bottom: 0; }
.filter-actions :deep(.n-form-item-blank) { justify-content: flex-end; }
.return-table { overflow-x: auto; }
.return-table :deep(table) { min-width: 1040px; }
.return-pagination {
  position: fixed;
  right: 0;
  bottom: 0;
  left: var(--wdm-sider-width);
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  padding: 10px 16px;
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  box-shadow: 0 -6px 18px rgba(15, 23, 42, 0.08);
  color: var(--text-2);
  font-size: 13px;
}
.return-empty { margin-top: 16px; }
@media (max-width: 700px) {
  .return-pagination { padding: 8px 12px; }
}
</style>
