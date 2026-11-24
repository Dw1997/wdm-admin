<template>
  <div class="page-container">
    <n-card title="采购入库与进货记录">
      <n-space align="center" wrap style="margin-bottom: 16px">
        <n-select v-model:value="sourceFilter" :options="sourceOptions" clearable placeholder="全部类型" style="width: 150px" @update:value="resetPage" />
        <n-select v-model:value="vendorFilter" :options="vendorFilterOptions" filterable clearable placeholder="筛选供应商" style="width: 190px" @update:value="resetPage" />
        <n-select v-model:value="spuFilter" :options="spuOptions" filterable clearable placeholder="筛选商品 (SPU)" style="width: 220px" @update:value="resetPage" />
        <n-date-picker v-model:value="dateRange" type="daterange" clearable @update:value="resetPage" />
        <n-button @click="load">刷新</n-button>
        <n-button type="primary" @click="openCreate">采购入库</n-button>
        <n-button type="warning" @click="openReturn">手动退回供应商</n-button>
      </n-space>

      <n-data-table :columns="columns" :data="receipts" :loading="loading" :bordered="false" />
      <n-pagination v-if="total > 20" v-model:page="page" :page-size="20" :item-count="total" @update:page="load" />
    </n-card>

    <!-- 采购入库弹窗（产地采购 / 本地市场进货，支持按 SPU 或 SKU，支持勾选当场付款） -->
    <n-modal v-model:show="createVisible" preset="card" title="采购入库（产地 / 本地市场进货）" style="width: 820px; max-width: 96vw">
      <n-form label-placement="left" label-width="92">
        <n-form-item label="供应商">
          <n-select v-model:value="createVendorId" :options="vendorFilterOptions" filterable style="width: 320px" />
          <span style="margin-left: 12px; color: #888; font-size: 12px">选具体供应商将记应付；选“自己进货”不记应付</span>
        </n-form-item>
        <n-form-item label="备注">
          <n-input v-model:value="createRemark" placeholder="如：产地直采、市场补货（可选）" />
        </n-form-item>
      </n-form>

      <div v-for="(row, index) in formItems" :key="index" class="purchase-row">
        <n-select
          v-model:value="row.mode"
          :options="[{ label: '按SPU', value: 'spu' }, { label: '按SKU', value: 'sku' }]"
          style="width: 92px"
          @update:value="() => { row.spu_id = null; row.sku_id = null; row.update_cost = false }"
        />
        <n-select
          v-if="row.mode === 'spu'"
          v-model:value="row.spu_id"
          :options="spuOptions"
          filterable
          placeholder="选择商品 (SPU，按基础单位)"
        />
        <n-select
          v-else
          v-model:value="row.sku_id"
          :options="skuOptions"
          filterable
          placeholder="选择具体规格 (SKU)"
        />
        <n-input v-model:value="row.quantity" placeholder="数量" />
        <n-input v-model:value="row.unit_cost" placeholder="实际进价" />
        <n-checkbox v-model:checked="row.update_cost" :disabled="row.mode === 'spu'">更新成本</n-checkbox>
        <n-button text type="error" :disabled="formItems.length === 1" @click="formItems.splice(index, 1)">删除</n-button>
      </div>

      <div v-if="createVendorId > 0" style="margin: 12px 0; padding: 12px; background: var(--n-color-embedded); border-radius: 6px">
        <n-space align="center" wrap>
          <n-checkbox v-model:checked="paidNow">当场已付款</n-checkbox>
          <template v-if="paidNow">
            <n-select v-model:value="payMethod" :options="payMethods" style="width: 120px" />
            <n-input v-model:value="payAmount" placeholder="实付金额（留空默认全额）" style="width: 200px" />
          </template>
        </n-space>
      </div>

      <n-space justify="space-between" align="center" style="margin-top: 12px">
        <div>本单合计：<strong>¥{{ createTotal.toFixed(2) }}</strong></div>
        <n-space>
          <n-button @click="formItems.push(blank())">添加商品</n-button>
          <n-button type="primary" :loading="saving" @click="save">确认入库</n-button>
        </n-space>
      </n-space>
    </n-modal>

    <!-- 手动退回供应商弹窗 -->
    <n-modal v-model:show="returnVisible" preset="card" title="手动退回供应商（不联动客户退货）" style="width: 780px; max-width: 96vw">
      <n-form label-placement="left" label-width="92">
        <n-form-item label="目标供应商" required>
          <n-select v-model:value="returnVendorId" :options="realVendorOptions" filterable placeholder="选择退回的供应商" style="width: 320px" />
        </n-form-item>
        <n-form-item label="退货原因">
          <n-input v-model:value="returnRemark" placeholder="如：次日收检车内退货后退回市场卖家" />
        </n-form-item>
      </n-form>

      <div v-for="(row, index) in returnItems" :key="index" class="return-row">
        <n-select
          v-model:value="row.mode"
          :options="[{ label: '按SPU', value: 'spu' }, { label: '按SKU', value: 'sku' }]"
          style="width: 92px"
          @update:value="() => { row.spu_id = null; row.sku_id = null }"
        />
        <n-select
          v-if="row.mode === 'spu'"
          v-model:value="row.spu_id"
          :options="spuOptions"
          filterable
          placeholder="选择商品 (SPU)"
        />
        <n-select
          v-else
          v-model:value="row.sku_id"
          :options="skuOptions"
          filterable
          placeholder="选择规格 (SKU)"
        />
        <n-input v-model:value="row.quantity" placeholder="退货数量" />
        <n-input v-model:value="row.unit_cost" placeholder="退货单价" />
        <n-button text type="error" :disabled="returnItems.length === 1" @click="returnItems.splice(index, 1)">删除</n-button>
      </div>

      <n-space justify="end" style="margin-top: 12px">
        <n-button @click="returnItems.push(blank())">添加商品</n-button>
        <n-button type="warning" :loading="saving" @click="saveReturn">确认退回供应商</n-button>
      </n-space>
    </n-modal>

    <!-- 更正进价 / 供应商弹窗 -->
    <n-modal v-model:show="correctVisible" preset="card" title="更正实际进价 / 供应商" style="width: 480px; max-width: 95vw">
      <n-space vertical v-if="correctItem && correctReceipt">
        <div>商品：{{ correctItem.sku_name || `${correctItem.spu_name}（${correctItem.base_unit}）` }}，原进价 ¥{{ correctItem.unit_cost }}</div>
        <n-select
          v-model:value="correctVendorId"
          :options="correctReceipt.source_type === 'order' ? realVendorOptions : vendorFilterOptions"
          filterable
          placeholder="供应商"
        />
        <n-input v-model:value="correctCost" placeholder="更正后的实际进价" />
        <n-input v-model:value="correctReason" placeholder="更正原因（必填，将自动冲正重记应付并重算利润）" />
        <n-space justify="end">
          <n-button @click="correctVisible = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="saveCorrection">保存更正</n-button>
        </n-space>
      </n-space>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { NButton, NTag, type DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import { fetchAllPages, productApi, purchaseApi, vendorApi } from '@/api'
import type { ProductSKU, ProductSPU, PurchaseReceipt, Vendor } from '@/types'

type Row = { mode: 'spu' | 'sku'; spu_id: number | null; sku_id: number | null; quantity: string; unit_cost: string; update_cost: boolean }
const blank = (): Row => ({ mode: 'spu', spu_id: null, sku_id: null, quantity: '1', unit_cost: '', update_cost: false })

const message = useMessage()
const receipts = ref<PurchaseReceipt[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const saving = ref(false)

const createVisible = ref(false)
const createVendorId = ref<number>(0)
const createRemark = ref('')
const paidNow = ref(false)
const payMethod = ref<'cash' | 'wechat' | 'alipay' | 'other'>('wechat')
const payAmount = ref('')
const formItems = ref<Row[]>([blank()])

const returnVisible = ref(false)
const returnVendorId = ref<number | null>(null)
const returnRemark = ref('')
const returnItems = ref<Row[]>([blank()])

const correctVisible = ref(false)
const correctReceipt = ref<PurchaseReceipt | null>(null)
const correctItem = ref<PurchaseReceipt['items'][number] | null>(null)
const correctVendorId = ref<number>(0)
const correctCost = ref('')
const correctReason = ref('')

const sourceFilter = ref<string | null>(null)
const vendorFilter = ref<number | null>(null)
const spuFilter = ref<number | null>(null)
const dateRange = ref<[number, number] | null>(null)

const sourceOptions = [
  { label: '采购入库', value: 'stock' },
  { label: '临时拿货', value: 'order' },
  { label: '退回供应商', value: 'return' },
]
const payMethods = [
  { label: '微信', value: 'wechat' },
  { label: '现金', value: 'cash' },
  { label: '支付宝', value: 'alipay' },
  { label: '其他', value: 'other' },
]

const spuOptions = ref<{ label: string; value: number }[]>([])
const skuOptions = ref<{ label: string; value: number }[]>([])
const realVendorOptions = ref<{ label: string; value: number }[]>([])
const vendorFilterOptions = computed(() => [
  { label: '自己进货（不记应付）', value: 0 },
  ...realVendorOptions.value,
])

const createTotal = computed(() =>
  formItems.value.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unit_cost) || 0), 0),
)

const sourceMeta: Record<string, { label: string; type: 'info' | 'success' | 'warning' }> = {
  stock: { label: '采购入库', type: 'success' },
  order: { label: '临时拿货', type: 'info' },
  return: { label: '退回供应商', type: 'warning' },
}

const columns: DataTableColumns<PurchaseReceipt> = [
  {
    title: '时间',
    key: 'purchased_at',
    width: 160,
    render: (row) => (row.purchased_at ? new Date(row.purchased_at).toLocaleString('zh-CN') : '待确认'),
  },
  {
    title: '类型',
    key: 'source_type',
    width: 105,
    render: (row) => {
      const m = sourceMeta[row.source_type] || { label: row.source_type, type: 'info' as const }
      return h(NTag, { size: 'small', type: m.type }, { default: () => m.label })
    },
  },
  { title: '关联订单', key: 'order_no', width: 150, render: (row) => row.order_no || '—' },
  { title: '供应商', key: 'vendor_name', width: 140 },
  {
    title: '商品 / 数量 / 单价',
    key: 'items',
    minWidth: 240,
    render: (row) =>
      row.items
        .map((i) => `${i.sku_name || `${i.spu_name}(${i.base_unit})`} × ${i.quantity} @ ¥${i.unit_cost}`)
        .join('；'),
  },
  {
    title: '金额',
    key: 'total_amount',
    width: 110,
    render: (row) => (row.source_type === 'return' ? `-¥${row.total_amount}` : `¥${row.total_amount}`),
  },
  {
    title: '当场已付',
    key: 'paid_amount',
    width: 100,
    render: (row) => (Number(row.paid_amount) > 0 ? `¥${row.paid_amount}` : '—'),
  },
  {
    title: '状态',
    key: 'status',
    width: 85,
    render: (row) => ({ draft: '草稿', confirmed: '已确认', cancelled: '已取消' })[row.status],
  },
  {
    title: '操作',
    key: 'action',
    width: 140,
    render: (row) => {
      if (row.status === 'draft') {
        return h(NButton, { text: true, type: 'primary', onClick: () => confirmDraft(row) }, { default: () => '确认入库' })
      }
      if (row.status === 'confirmed' && row.source_type !== 'return') {
        return h(
          'div',
          row.items.map((item) =>
            h(
              NButton,
              { text: true, type: 'primary', style: 'margin-right: 6px', onClick: () => openCorrection(row, item) },
              { default: () => '更正进价/供应商' },
            ),
          ),
        )
      }
      return '—'
    },
  },
]

function openCreate() {
  createVendorId.value = 0
  createRemark.value = ''
  paidNow.value = false
  payAmount.value = ''
  formItems.value = [blank()]
  createVisible.value = true
}

function openReturn() {
  returnVendorId.value = null
  returnRemark.value = ''
  returnItems.value = [blank()]
  returnVisible.value = true
}

function openCorrection(receipt: PurchaseReceipt, item: PurchaseReceipt['items'][number]) {
  correctReceipt.value = receipt
  correctItem.value = item
  correctVendorId.value = receipt.vendor_id
  correctCost.value = item.unit_cost
  correctReason.value = ''
  correctVisible.value = true
}

async function saveCorrection() {
  if (!correctReceipt.value || !correctItem.value) return
  if (!/^\d+(?:\.\d{1,4})?$/.test(correctCost.value) || !correctReason.value.trim()) {
    message.warning('请填写有效进价和更正原因')
    return
  }
  saving.value = true
  try {
    await purchaseApi.update(correctReceipt.value.id, {
      version: correctReceipt.value.version,
      item_id: correctItem.value.id,
      vendor_id: correctVendorId.value,
      unit_cost: correctCost.value,
      reason: correctReason.value.trim(),
    })
    correctVisible.value = false
    message.success('已更正并重算应付/利润')
    await load()
  } finally {
    saving.value = false
  }
}

async function load() {
  loading.value = true
  try {
    const result = await purchaseApi.list({
      page: page.value,
      page_size: 20,
      source_type: sourceFilter.value || undefined,
      vendor_id: vendorFilter.value ?? undefined,
      spu_id: spuFilter.value || undefined,
      date_from: dateRange.value ? dayjs(dateRange.value[0]).format('YYYY-MM-DD') : undefined,
      date_to: dateRange.value ? dayjs(dateRange.value[1]).format('YYYY-MM-DD') : undefined,
    })
    receipts.value = result.items
    total.value = result.total
  } finally {
    loading.value = false
  }
}

function resetPage() {
  page.value = 1
  void load()
}

async function confirmDraft(row: PurchaseReceipt) {
  await purchaseApi.confirm(row.id, row.version)
  message.success('进货已确认')
  await load()
}

async function save() {
  if (
    formItems.value.some(
      (row) =>
        (row.mode === 'spu' ? !row.spu_id : !row.sku_id) ||
        Number(row.quantity) <= 0 ||
        !/^\d+(?:\.\d{1,4})?$/.test(row.unit_cost),
    )
  ) {
    message.warning('请填好商品、数量和实际进价')
    return
  }
  saving.value = true
  try {
    const receipt = await purchaseApi.create({
      source_type: 'stock',
      vendor_id: createVendorId.value,
      remark: createRemark.value.trim() || undefined,
      items: formItems.value.map((row) => ({
        spu_id: row.mode === 'spu' ? row.spu_id! : undefined,
        sku_id: row.mode === 'sku' ? row.sku_id! : null,
        quantity: row.quantity,
        unit_cost: row.unit_cost,
        update_cost: row.mode === 'sku' ? row.update_cost : false,
      })),
    })
    const payment =
      createVendorId.value > 0 && paidNow.value
        ? { method: payMethod.value, amount: payAmount.value.trim() || receipt.total_amount }
        : undefined
    await purchaseApi.confirm(receipt.id, receipt.version, payment)
    createVisible.value = false
    message.success('采购已入库')
    await load()
  } finally {
    saving.value = false
  }
}

async function saveReturn() {
  if (!returnVendorId.value) {
    message.warning('请选择退回的目标供应商')
    return
  }
  if (
    returnItems.value.some(
      (row) =>
        (row.mode === 'spu' ? !row.spu_id : !row.sku_id) ||
        Number(row.quantity) <= 0 ||
        !/^\d+(?:\.\d{1,4})?$/.test(row.unit_cost),
    )
  ) {
    message.warning('请填好退货商品、数量和退货单价')
    return
  }
  saving.value = true
  try {
    await purchaseApi.createReturn({
      vendor_id: returnVendorId.value,
      remark: returnRemark.value.trim() || undefined,
      items: returnItems.value.map((row) => ({
        spu_id: row.mode === 'spu' ? row.spu_id! : undefined,
        sku_id: row.mode === 'sku' ? row.sku_id! : null,
        quantity: row.quantity,
        unit_cost: row.unit_cost,
      })),
    })
    returnVisible.value = false
    message.success('已记录退回供应商并冲减应付')
    await load()
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await load()
  const [spus, skus, vendors] = await Promise.all([
    fetchAllPages<ProductSPU>((p) => productApi.spus({ page: p, page_size: 50 })),
    fetchAllPages<ProductSKU>((p) => productApi.allSkus({ page: p, page_size: 50 })),
    fetchAllPages<Vendor>((p) => vendorApi.list({ page: p, page_size: 50 })),
  ])
  spuOptions.value = spus.map((s) => ({ label: `${s.name}（${s.base_unit || '斤'}）`, value: s.id }))
  skuOptions.value = skus.map((sku) => ({
    label: `${sku.spu_name || `#${sku.spu_id}`} ${Object.values(sku.specs || {}).join(' ')}`,
    value: sku.id,
  }))
  realVendorOptions.value = vendors.map((v) => ({ label: v.name, value: v.id }))
})
</script>

<style scoped>
.purchase-row {
  display: grid;
  grid-template-columns: 96px 2.2fr 1fr 1fr auto auto;
  gap: 8px;
  align-items: center;
  margin: 10px 0;
}
.return-row {
  display: grid;
  grid-template-columns: 96px 2.2fr 1fr 1fr auto;
  gap: 8px;
  align-items: center;
  margin: 10px 0;
}
.n-pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
