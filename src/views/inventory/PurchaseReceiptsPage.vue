<template>
  <div class="page-container">
    <n-card title="采购入库与逐次进价">
      <n-space align="center">
        <n-select v-model:value="sourceFilter" :options="sourceOptions" clearable placeholder="全部来源" style="width: 170px" @update:value="resetPage" />
        <n-select v-model:value="skuFilter" :options="skuOptions" filterable clearable placeholder="筛选 SKU" style="width: 250px" @update:value="resetPage" />
        <n-date-picker v-model:value="dateRange" type="daterange" clearable @update:value="resetPage" />
        <n-button @click="load">刷新</n-button>
        <n-button type="primary" @click="createVisible = true">主动备货入库</n-button>
      </n-space>
      <n-data-table :columns="columns" :data="receipts" :loading="loading" :bordered="false" />
      <n-pagination v-if="total > 20" v-model:page="page" :page-size="20" :item-count="total" @update:page="load" />
    </n-card>
    <n-modal v-model:show="createVisible" preset="card" title="主动备货入库" style="width: 680px; max-width: 95vw">
      <p>供应商：自己进货。实际进价逐次保存；更新全局成本需逐行勾选。</p>
      <div v-for="(row, index) in formItems" :key="index" class="purchase-row">
        <n-select v-model:value="row.sku_id" :options="skuOptions" filterable placeholder="SKU" />
        <n-input v-model:value="row.quantity" placeholder="数量" />
        <n-input v-model:value="row.unit_cost" placeholder="实际进价" />
        <n-checkbox v-model:checked="row.update_cost">更新全局成本</n-checkbox>
        <n-button text type="error" :disabled="formItems.length === 1" @click="formItems.splice(index, 1)">删除</n-button>
      </div>
      <n-space justify="end"><n-button @click="formItems.push(blank())">添加商品</n-button><n-button type="primary" :loading="saving" @click="save">确认入库</n-button></n-space>
    </n-modal>
    <n-modal v-model:show="correctVisible" preset="card" title="更正本次进价" style="width: 480px; max-width: 95vw">
      <n-space vertical v-if="correctItem">
        <div>{{ correctItem.sku_name }}，原进价 ¥{{ correctItem.unit_cost }}</div>
        <n-input v-model:value="correctCost" placeholder="更正后的实际进价" />
        <n-input v-model:value="correctReason" placeholder="更正原因（必填）" />
        <n-space justify="end"><n-button @click="correctVisible = false">取消</n-button><n-button type="primary" :loading="saving" @click="saveCorrection">保存更正</n-button></n-space>
      </n-space>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, onMounted, ref } from 'vue'
import { NButton, type DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import { fetchAllPages, productApi, purchaseApi } from '@/api'
import type { ProductSKU, PurchaseReceipt } from '@/types'

type Row = { sku_id: number | null; quantity: string; unit_cost: string; update_cost: boolean }
const blank = (): Row => ({ sku_id: null, quantity: '1', unit_cost: '', update_cost: false })
const message = useMessage()
const receipts = ref<PurchaseReceipt[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const saving = ref(false)
const createVisible = ref(false)
const correctVisible = ref(false)
const correctReceipt = ref<PurchaseReceipt | null>(null)
const correctItem = ref<PurchaseReceipt['items'][number] | null>(null)
const correctCost = ref('')
const correctReason = ref('')
const sourceFilter = ref<string | null>(null)
const skuFilter = ref<number | null>(null)
const dateRange = ref<[number, number] | null>(null)
const sourceOptions = [{ label: '临时拿货', value: 'order' }, { label: '主动备货', value: 'stock' }]
const skuOptions = ref<{ label: string; value: number }[]>([])
const formItems = ref<Row[]>([blank()])
const columns: DataTableColumns<PurchaseReceipt> = [
  { title: '拿货时间', key: 'purchased_at', render: row => row.purchased_at ? new Date(row.purchased_at).toLocaleString('zh-CN') : '待确认' },
  { title: '来源', key: 'source_type', render: row => row.source_type === 'stock' ? '主动备货' : '临时拿货' },
  { title: '销售订单', key: 'order_no', render: row => row.order_no || '—' },
  { title: '供应商', key: 'vendor_name' },
  { title: '商品 / 进价', key: 'items', render: row => row.items.map(i => `${i.sku_name} × ${i.quantity} @ ¥${i.unit_cost}`).join('；') },
  { title: '金额', key: 'total_amount', render: row => `¥${row.total_amount}` },
  { title: '状态', key: 'status', render: row => ({ draft: '草稿', confirmed: '已确认', cancelled: '已取消' })[row.status] },
  { title: '操作', key: 'action', render: row => row.status === 'draft'
    ? h(NButton, { text: true, type: 'primary', onClick: () => confirmDraft(row) }, { default: () => '确认入库' })
    : row.status === 'confirmed' && row.source_type === 'stock'
      ? h('div', row.items.map(item => h(NButton, { text: true, type: 'primary', onClick: () => openCorrection(row, item) }, { default: () => `更正 #${item.sku_id} 进价` })))
      : '—' },
]
function openCorrection(receipt: PurchaseReceipt, item: PurchaseReceipt['items'][number]) {
  correctReceipt.value = receipt; correctItem.value = item
  correctCost.value = item.unit_cost; correctReason.value = ''
  correctVisible.value = true
}
async function saveCorrection() {
  if (!correctReceipt.value || !correctItem.value) return
  if (!/^\d+(?:\.\d{1,4})?$/.test(correctCost.value) || !correctReason.value.trim()) {
    message.warning('请填写有效进价和更正原因'); return
  }
  saving.value = true
  try {
    await purchaseApi.update(correctReceipt.value.id, {
      version: correctReceipt.value.version, item_id: correctItem.value.id,
      unit_cost: correctCost.value, reason: correctReason.value.trim(),
    })
    correctVisible.value = false; message.success('进价已更正')
    await load()
  } finally { saving.value = false }
}
async function load() {
  loading.value = true
  try {
    const result = await purchaseApi.list({ page: page.value, page_size: 20,
      source_type: sourceFilter.value || undefined, sku_id: skuFilter.value || undefined,
      date_from: dateRange.value ? dayjs(dateRange.value[0]).format('YYYY-MM-DD') : undefined,
      date_to: dateRange.value ? dayjs(dateRange.value[1]).format('YYYY-MM-DD') : undefined })
    receipts.value = result.items; total.value = result.total
  } finally { loading.value = false }
}
function resetPage() { page.value = 1; void load() }
async function confirmDraft(row: PurchaseReceipt) {
  await purchaseApi.confirm(row.id, row.version)
  message.success('进货已确认')
  await load()
}
async function save() {
  if (formItems.value.some(row => !row.sku_id || Number(row.quantity) <= 0 || !/^\d+(?:\.\d{1,4})?$/.test(row.unit_cost))) { message.warning('请填好商品、数量和实际进价'); return }
  saving.value = true
  try {
    const receipt = await purchaseApi.create({ source_type: 'stock', vendor_id: 0, items: formItems.value.map(row => ({ sku_id: row.sku_id!, quantity: row.quantity, unit_cost: row.unit_cost, update_cost: row.update_cost })) })
    createVisible.value = false; formItems.value = [blank()]
    await load()
    await purchaseApi.confirm(receipt.id, receipt.version)
    message.success('主动备货已入库')
    await load()
  } finally { saving.value = false }
}
onMounted(async () => {
  await load()
  const skus = await fetchAllPages<ProductSKU>(page => productApi.allSkus({ page, page_size: 20 }))
  skuOptions.value = skus.map(sku => ({ label: `${sku.spu_name || `#${sku.spu_id}`} ${Object.values(sku.specs || {}).join(' ')}`, value: sku.id }))
})
</script>

<style scoped>
.purchase-row{display:grid;grid-template-columns:2fr 1fr 1fr auto auto;gap:8px;align-items:center;margin:12px 0}.n-pagination{margin-top:16px;justify-content:flex-end}
</style>
