<template>
  <div class="page-container order-list-page">
    <div class="card-section order-list-card">
      <div class="page-header">
        <div><h2 class="page-title">订单列表</h2><span class="result-count">共 {{ total }} 条订单</span></div>
        <n-button type="primary" @click="router.push('/order-center/create')">录单</n-button>
      </div>
      <div class="filter-grid">
        <div class="filter-item date-filter"><label>下单日期与时间</label><n-date-picker v-model:value="dateRange" type="datetimerange" clearable format="yyyy-MM-dd HH:mm" /></div>
        <div class="filter-item keyword"><label>订单号 / 客户 / 手机号</label><n-input v-model:value="filters.keyword" clearable placeholder="输入关键词" @keyup.enter="search" /></div>
        <div class="filter-item"><label>客户</label><n-select v-model:value="filters.customer_id" :options="customerOptions" clearable filterable placeholder="全部客户" /></div>
        <div class="filter-item"><label>销售</label><n-select v-model:value="filters.sales_id" :options="salesOptions" clearable placeholder="全部销售" /></div>
        <div class="filter-item"><label>来源</label><n-select v-model:value="filters.source" :options="sourceOptions" clearable placeholder="全部来源" /></div>
        <div class="filter-item"><label>送货方式</label><n-select v-model:value="filters.delivery_mode" :options="deliveryOptions" clearable placeholder="全部方式" /></div>
        <div class="filter-item"><label>订单状态</label><n-select v-model:value="filters.status" :options="statusOptions" clearable placeholder="全部状态" /></div>
        <div class="filter-item"><label>付款状态</label><n-select v-model:value="filters.pay_status" :options="payOptions" clearable placeholder="全部付款状态" /></div>
        <div class="filter-actions"><n-button @click="reset">重置</n-button><n-button type="primary" :loading="loading" @click="search">查询</n-button></div>
      </div>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" :row-key="row => row.id" />
      <div class="pagination-bar">
        <span>每页 10 条</span>
        <n-pagination v-model:page="page" :page-size="10" :item-count="total" show-quick-jumper @update:page="load" />
      </div>
    </div>
    <n-modal v-model:show="detailVisible" preset="card" title="订单详情" style="width: 820px; max-width: 95vw">
      <template v-if="detail">
        <div class="detail-heading">
          <span>{{ detail.order_no }}　<n-tag :type="stateColors[detail.status] || 'default'" size="small">{{ labelOf(statusOptions, detail.status) }}</n-tag></span>
          <n-button v-if="detail.status === 'pending' && canEdit" type="primary" @click="openEdit(detail)">编辑订单</n-button>
        </div>
        <n-descriptions :column="2" bordered size="small">
          <n-descriptions-item label="订单号">{{ detail.order_no }}</n-descriptions-item>
          <n-descriptions-item label="下单时间">{{ formatDate(detail.created_at) }}</n-descriptions-item>
          <n-descriptions-item label="客户">{{ detail.customer_name }} {{ detail.customer_phone || '' }}</n-descriptions-item>
          <n-descriptions-item label="销售">{{ detail.sales_name || '—' }}</n-descriptions-item>
          <n-descriptions-item label="来源">{{ labelOf(sourceOptions, detail.source) }}</n-descriptions-item>
          <n-descriptions-item label="送货方式">{{ labelOf(deliveryOptions, detail.delivery_mode) }}</n-descriptions-item>
          <n-descriptions-item label="订单状态">{{ labelOf(statusOptions, detail.status) }}</n-descriptions-item>
          <n-descriptions-item label="付款状态">{{ labelOf(payOptions, detail.pay_status) }}</n-descriptions-item>
          <n-descriptions-item label="备注" :span="2">{{ detail.remark || '—' }}</n-descriptions-item>
        </n-descriptions>
        <h3 class="detail-title">商品明细</h3>
        <n-data-table :columns="itemColumns" :data="detail.items" :bordered="false" size="small" />
        <div class="detail-total">订单金额　¥{{ money(detail.total_amount) }}　 · 　剩余应收　¥{{ money(detail.unpaid_amount) }}</div>
      </template>
    </n-modal>
    <n-modal v-model:show="purchaseVisible" preset="card" :title="purchaseItem?.purchase_receipt_id ? '更正拿货' : '确认拿货'" style="width: 520px; max-width: 95vw">
      <div v-if="purchaseItem" class="purchase-form">
        <label>商品<n-input :value="`${purchaseItem.spu_name} ${purchaseItem.sku_spec}`" readonly /></label>
        <label>本次拿货供应商<n-select v-model:value="purchaseSupplierId" :options="supplierOptions" :disabled="!purchaseItem.purchase_receipt_id" filterable /></label>
        <label>实际进价<n-input v-model:value="purchaseCost" placeholder="每个销售规格的进价，最多 4 位小数" /></label>
        <template v-if="!purchaseItem.purchase_receipt_id && purchaseSupplierId > 0">
          <label>本次已付款<n-input v-model:value="purchasePaid" placeholder="留空表示尚未付款" /></label>
          <label v-if="purchasePaid">付款方式<n-select v-model:value="purchaseMethod" :options="paymentMethods" /></label>
        </template>
        <label v-if="purchaseItem.purchase_receipt_id">更正原因<n-input v-model:value="purchaseReason" placeholder="必填" /></label>
        <div class="purchase-actions"><n-button @click="purchaseVisible = false">取消</n-button><n-button type="primary" :loading="purchaseSaving" @click="savePurchase">保存</n-button></div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NIcon, NTag, type DataTableColumns, type SelectOption } from 'naive-ui'
import { Eye, Edit } from '@vicons/tabler'
import dayjs from 'dayjs'
import { adminCustomerApi, fetchAllPages, orderApi, purchaseApi, vendorApi } from '@/api'
import type { OrderListItem, SalesOption } from '@/types'
import { formatDate } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const canEdit = computed(() => auth.user?.role === 'admin' || auth.user?.permissions?.includes('order.edit') || auth.user?.permissions?.includes('*'))
const list = ref<OrderListItem[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const detailVisible = ref(false)
const detail = ref<OrderListItem | null>(null)
const purchaseVisible = ref(false)
const purchaseSaving = ref(false)
const purchaseItem = ref<OrderListItem['items'][number] | null>(null)
const purchaseSupplierId = ref(0)
const purchaseCost = ref('')
const purchasePaid = ref('')
const purchaseMethod = ref('cash')
const purchaseReason = ref('')
const purchaseVersion = ref(0)
const pendingReceipts = new Map<number, { id: number; version: number; unitCost: string }>()
const suppliers = ref<{ id: number; name: string }[]>([])
const supplierOptions = computed(() => [{ label: '自己进货', value: 0 }, ...suppliers.value.map(v => ({ label: v.name, value: v.id }))])
const paymentMethods = [{ label: '现金', value: 'cash' }, { label: '微信', value: 'wechat' }, { label: '支付宝', value: 'alipay' }, { label: '其他', value: 'other' }]
const dateRange = ref<[number, number] | null>(null)
const filters = reactive<{ keyword: string; customer_id: number | null; sales_id: number | null; source: string | null; delivery_mode: string | null; status: string | null; pay_status: string | null }>({ keyword: '', customer_id: null, sales_id: null, source: null, delivery_mode: null, status: null, pay_status: null })
const customerOptions = ref<SelectOption[]>([])
const salesOptions = ref<SelectOption[]>([])
const sourceOptions = [{ label: '线路询单', value: 'route_call' }, { label: '客户来电', value: 'phone_in' }, { label: '小程序', value: 'miniprogram' }, { label: '门店零售', value: 'counter' }]
const deliveryOptions = [{ label: '开车自送', value: 'route' }, { label: '发物流', value: 'freight' }, { label: '自送', value: 'local' }, { label: '现场提货', value: 'pickup' }]
const statusOptions = [{ label: '待审批', value: 'pending_approval' }, { label: '待配送', value: 'pending' }, { label: '配送中', value: 'delivering' }, { label: '已送达', value: 'delivered' }, { label: '已取消', value: 'cancelled' }, { label: '已驳回', value: 'rejected' }]
const payOptions = [{ label: '未付款', value: 'unpaid' }, { label: '部分付款', value: 'partial' }, { label: '已付清', value: 'paid' }]
const stateColors: Record<string, 'warning' | 'info' | 'success' | 'error' | 'default'> = { pending_approval: 'warning', pending: 'info', delivering: 'info', delivered: 'success', cancelled: 'default', rejected: 'error' }
const payColors: Record<string, 'warning' | 'info' | 'success'> = { unpaid: 'warning', partial: 'info', paid: 'success' }
const money = (v: number) => Number(v || 0).toFixed(2)
const labelOf = (options: { label: string; value: string }[], value: string) => options.find(option => option.value === value)?.label || value
const columns: DataTableColumns<OrderListItem> = [
  { title: '下单时间', key: 'created_at', width: 155, render: row => formatDate(row.created_at) },
  { title: '订单号', key: 'order_no', width: 155, render: row => h(NButton, { text: true, type: 'primary', onClick: () => openDetail(row) }, { default: () => row.order_no }) },
  { title: '客户', key: 'customer_name', render: row => h('div', [h('div', row.customer_name), h('small', { class: 'muted' }, row.customer_phone || '')]) },
  { title: '销售', key: 'sales_name', width: 100, render: row => row.sales_name || '—' },
  { title: '来源', key: 'source', width: 100, render: row => labelOf(sourceOptions, row.source) },
  { title: '送货方式', key: 'delivery_mode', width: 100, render: row => labelOf(deliveryOptions, row.delivery_mode) },
  { title: '状态', key: 'status', width: 100, render: row => h(NTag, { type: stateColors[row.status] || 'default', size: 'small' }, { default: () => labelOf(statusOptions, row.status) }) },
  { title: '付款状态', key: 'pay_status', width: 100, render: row => h(NTag, { type: payColors[row.pay_status] || 'warning', size: 'small' }, { default: () => labelOf(payOptions, row.pay_status) }) },
  { title: '订单金额', key: 'total_amount', width: 110, render: row => `¥${money(row.total_amount)}` },
  { title: '剩余应收', key: 'unpaid_amount', width: 110, render: row => `¥${money(row.unpaid_amount)}` },
  { title: '操作', key: 'action', width: 88, render: row => h('div', { class: 'row-actions' }, [
    h(NButton, { text: true, type: 'primary', title: '查看', 'aria-label': '查看订单', onClick: () => openDetail(row) }, { icon: () => h(NIcon, { component: Eye, size: 18 }) }),
    ...(row.status === 'pending' && canEdit.value ? [h(NButton, { text: true, type: 'primary', title: '编辑', 'aria-label': '编辑订单', onClick: () => openEdit(row) }, { icon: () => h(NIcon, { component: Edit, size: 18 }) })] : []),
  ]) },
]
const itemColumns: DataTableColumns<OrderListItem['items'][number]> = [
  { title: '商品', key: 'spu_name' }, { title: '规格', key: 'sku_spec' }, { title: '数量', key: 'quantity' },
  { title: '售价', key: 'unit_price', render: row => `¥${money(row.unit_price)}` },
  { title: '拿货供应商', key: 'supplier_name', render: row => row.supplier_name || '自己进货' },
  { title: '成本', key: 'cost_price', render: row => `¥${money(row.cost_price || 0)}（${row.cost_status === 'actual' ? '实际' : '估计'}）` },
  { title: '金额', key: 'amount', render: row => `¥${money(row.amount)}` },
  { title: '拿货', key: 'purchase', render: row => row.purchase_receipt_id || !['cancelled', 'rejected'].includes(detail.value?.status || '')
    ? h(NButton, { text: true, type: 'primary', onClick: () => openPurchase(row) }, { default: () => row.purchase_receipt_id ? '更正拿货' : '确认拿货' }) : '—' },
]
async function openPurchase(row: OrderListItem['items'][number]) {
  purchaseItem.value = row
  purchaseSupplierId.value = row.supplier_id || 0
  purchaseCost.value = String(row.cost_price || '0')
  purchasePaid.value = ''
  purchaseReason.value = ''
  if (row.purchase_receipt_id) {
    const receipt = await purchaseApi.get(row.purchase_receipt_id)
    purchaseVersion.value = receipt.version
    purchaseCost.value = receipt.items[0]?.unit_cost || purchaseCost.value
  } else {
    purchaseVersion.value = pendingReceipts.get(row.id)?.version || 0
  }
  purchaseVisible.value = true
}
async function savePurchase() {
  if (!detail.value || !purchaseItem.value) return
  if (!/^\d+(?:\.\d{1,4})?$/.test(purchaseCost.value)) { message.warning('请填写有效实际进价'); return }
  if (purchasePaid.value && (!/^\d+(?:\.\d{1,2})?$/.test(purchasePaid.value) || Number(purchasePaid.value) <= 0)) { message.warning('请填写有效付款金额'); return }
  if (purchaseItem.value.purchase_receipt_id && !purchaseReason.value.trim()) { message.warning('请填写更正原因'); return }
  purchaseSaving.value = true
  try {
    if (purchaseItem.value.purchase_receipt_id) {
      await purchaseApi.update(purchaseItem.value.purchase_receipt_id, { version: purchaseVersion.value, vendor_id: purchaseSupplierId.value, unit_cost: purchaseCost.value, reason: purchaseReason.value.trim() })
    } else {
      if (purchaseSupplierId.value !== (purchaseItem.value.supplier_id || 0)) { message.warning('请先在订单编辑页修改拿货供应商'); return }
      const cached = pendingReceipts.get(purchaseItem.value.id)
      const receipt = cached || await purchaseApi.create({ source_type: 'order', vendor_id: purchaseSupplierId.value, items: [{ order_item_id: purchaseItem.value.id, sku_id: purchaseItem.value.sku_id, quantity: String(purchaseItem.value.quantity), unit_cost: purchaseCost.value }] })
      pendingReceipts.set(purchaseItem.value.id, { id: receipt.id, version: receipt.version, unitCost: cached?.unitCost || purchaseCost.value })
      let version = receipt.version
      if (cached && cached.unitCost !== purchaseCost.value) {
        const changed = await purchaseApi.update(receipt.id, { version, unit_cost: purchaseCost.value })
        version = changed.purchase_receipt.version
        pendingReceipts.set(purchaseItem.value.id, { id: receipt.id, version, unitCost: purchaseCost.value })
      }
      await purchaseApi.confirm(receipt.id, version, purchasePaid.value ? { method: purchaseMethod.value, amount: purchasePaid.value } : undefined)
      pendingReceipts.delete(purchaseItem.value.id)
    }
    detail.value = await orderApi.get(detail.value.id)
    purchaseVisible.value = false
    message.success('拿货记录已保存')
    await load()
  } finally { purchaseSaving.value = false }
}
async function load() {
  loading.value = true
  try {
    const from = dateRange.value ? dayjs(dateRange.value[0]).toISOString() : undefined
    const to = dateRange.value ? dayjs(dateRange.value[1]).add(1, 'minute').toISOString() : undefined
    const result = await orderApi.list({ page: page.value, page_size: 10, keyword: filters.keyword || undefined, customer_id: filters.customer_id || undefined, sales_id: filters.sales_id || undefined, source: filters.source || undefined, delivery_mode: filters.delivery_mode || undefined, status: filters.status || undefined, pay_status: filters.pay_status || undefined, created_at_from: from, created_at_to: to })
    list.value = result.items
    total.value = result.total
  } finally { loading.value = false }
}
function search() { page.value = 1; load() }
function reset() { filters.keyword = ''; filters.customer_id = null; filters.sales_id = null; filters.source = null; filters.delivery_mode = null; filters.status = null; filters.pay_status = null; dateRange.value = null; search() }
async function openDetail(row: OrderListItem) { detail.value = await orderApi.get(row.id); detailVisible.value = true }
function openEdit(row: OrderListItem) { detailVisible.value = false; router.push(`/order-center/edit/${row.id}`) }
const message = useMessage()
onMounted(() => {
  void load()
  void fetchAllPages(page => vendorApi.list({ page, page_size: 20 })).then(v => { suppliers.value = v })
  void adminCustomerApi.list({ page: 1, page_size: 100 })
    .then(customers => { customerOptions.value = customers.map(customer => ({ label: customer.name, value: customer.id })) })
    .catch(() => { /* 请求层提示 */ })
  void adminCustomerApi.salesOptions()
    .then(sales => { salesOptions.value = sales.map((sale: SalesOption) => ({ label: sale.name, value: sale.id })) })
    .catch(() => { /* 请求层提示 */ })
})
</script>

<style scoped>
.order-list-page{height:100%;display:flex;padding-bottom:68px}.order-list-card{flex:1;display:flex;flex-direction:column}.filter-grid{display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:14px;margin:16px 0 22px}.filter-item label{display:block;font-size:12px;color:#6b7280;margin-bottom:6px}.filter-item :deep(.n-date-picker),.filter-item :deep(.n-input),.filter-item :deep(.n-select){width:100%}.date-filter{grid-column:span 2}.keyword{grid-column:span 2}.filter-actions{grid-column:span 2;display:flex;align-items:end;justify-content:flex-end;gap:8px}.result-count,.muted{font-size:12px;color:#8b95a5}.pagination-bar{position:fixed;left:var(--wdm-sider-width);right:0;bottom:0;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;font-size:12px;color:#818b99;background:var(--bg-card);border-top:1px solid var(--border);box-shadow:0 -4px 12px rgba(15,23,42,.08)}.detail-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.detail-title{font-size:15px;margin:20px 0 10px}.detail-total{text-align:right;margin-top:16px;font-weight:600}@media(max-width:1200px){.filter-grid{grid-template-columns:repeat(4,minmax(150px,1fr))}.date-filter,.keyword{grid-column:span 2}.filter-actions{grid-column:span 2}}@media(max-width:900px){.filter-grid{grid-template-columns:repeat(2,minmax(140px,1fr))}.date-filter,.keyword,.filter-actions{grid-column:span 2}}@media(max-width:560px){.filter-grid{grid-template-columns:1fr}.date-filter,.keyword,.filter-actions{grid-column:auto}}
.row-actions{display:flex;align-items:center;gap:10px}
.purchase-form{display:grid;gap:12px}.purchase-form label{display:grid;gap:5px}.purchase-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
</style>
