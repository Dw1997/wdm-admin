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
      <div class="table-wrap">
        <n-data-table flex-height :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" :row-key="row => row.id" />
      </div>
      <div class="pagination-bar">
        <span>每页 10 条</span>
        <n-pagination v-model:page="page" :page-size="10" :item-count="total" show-quick-jumper @update:page="load" />
      </div>
    </div>
    <OrderDeliverModal v-model:show="deliverVisible" :order="deliverOrder" @success="load" />
    <OrderApprovalModal v-model:show="approvalVisible" :order-id="approvalOrderId" @success="load" />
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NTag, type DataTableColumns, type SelectOption } from 'naive-ui'
import dayjs from 'dayjs'
import { adminCustomerApi, orderApi } from '@/api'
import type { OrderListItem, SalesOption } from '@/types'
import { formatDate } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import OrderDeliverModal from '@/components/OrderDeliverModal.vue'
import OrderApprovalModal from '@/components/OrderApprovalModal.vue'
import { actionBar, actionIcon } from '@/components/tableActions'
import { renderCustomerNameCell } from '@/components/customerCell'

const router = useRouter()
const auth = useAuthStore()
const canEdit = computed(() => auth.user?.role === 'admin' || auth.user?.permissions?.includes('order.edit') || auth.user?.permissions?.includes('*'))
const list = ref<OrderListItem[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const deliverVisible = ref(false)
const deliverOrder = ref<OrderListItem | null>(null)
const approvalVisible = ref(false)
const approvalOrderId = ref<number | null>(null)
const dateRange = ref<[number, number] | null>(null)
const filters = reactive<{ keyword: string; customer_id: number | null; sales_id: number | null; source: string | null; delivery_mode: string | null; status: string | null; pay_status: string | null }>({ keyword: '', customer_id: null, sales_id: null, source: null, delivery_mode: null, status: null, pay_status: null })
const customerOptions = ref<SelectOption[]>([])
const salesOptions = ref<SelectOption[]>([])
const sourceOptions = [{ label: '线路询单', value: 'route_call' }, { label: '客户来电', value: 'phone_in' }, { label: '小程序', value: 'miniprogram' }, { label: '门店零售', value: 'counter' }]
const deliveryOptions = [{ label: '开车自送', value: 'route' }, { label: '发物流', value: 'freight' }, { label: '城区自送', value: 'local' }, { label: '现场提货', value: 'pickup' }]
const statusOptions = [{ label: '待审批', value: 'pending_approval' }, { label: '待配送', value: 'pending' }, { label: '配送中', value: 'delivering' }, { label: '已送达', value: 'delivered' }, { label: '已取消', value: 'cancelled' }, { label: '已驳回', value: 'rejected' }]
const payOptions = [{ label: '未付款', value: 'unpaid' }, { label: '部分付款', value: 'partial' }, { label: '已付清', value: 'paid' }]
const stateColors: Record<string, 'warning' | 'info' | 'success' | 'error' | 'default'> = { pending_approval: 'warning', pending: 'info', delivering: 'info', delivered: 'success', cancelled: 'default', rejected: 'error' }
const payColors: Record<string, 'warning' | 'info' | 'success'> = { unpaid: 'warning', partial: 'info', paid: 'success' }
const money = (v: number) => Number(v || 0).toFixed(2)
const labelOf = (options: { label: string; value: string }[], value: string) => options.find(option => option.value === value)?.label || value

function canEditRow(row: OrderListItem) {
  return canEdit.value && !['cancelled', 'rejected'].includes(row.status) && row.pay_status !== 'paid'
}
function canDeliver(row: OrderListItem) {
  return row.status === 'pending' || row.status === 'delivering'
}

const columns: DataTableColumns<OrderListItem> = [
  { title: '下单时间', key: 'created_at', width: 155, render: row => formatDate(row.created_at) },
  { title: '订单号', key: 'order_no', width: 155, render: row => h(NButton, { text: true, type: 'primary', onClick: () => openDetail(row) }, { default: () => row.order_no }) },
  { title: '客户', key: 'customer_name', render: row => renderCustomerNameCell(row.customer_name, row.customer_phone, { strong: true }) },
  { title: '销售', key: 'sales_name', width: 100, render: row => row.sales_name || '—' },
  { title: '来源', key: 'source', width: 100, render: row => labelOf(sourceOptions, row.source) },
  { title: '送货方式', key: 'delivery_mode', width: 100, render: row => labelOf(deliveryOptions, row.delivery_mode) },
  { title: '状态', key: 'status', width: 100, render: row => h(NTag, { type: stateColors[row.status] || 'default', size: 'small' }, { default: () => labelOf(statusOptions, row.status) }) },
  { title: '付款状态', key: 'pay_status', width: 100, render: row => h(NTag, { type: payColors[row.pay_status] || 'warning', size: 'small' }, { default: () => labelOf(payOptions, row.pay_status) }) },
  { title: '订单金额', key: 'total_amount', width: 110, render: row => `¥${money(row.total_amount)}` },
  { title: '剩余应收', key: 'unpaid_amount', width: 110, render: row => `¥${money(row.unpaid_amount)}` },
  { title: '操作', key: 'action', width: 155, render: row => actionBar([
    actionIcon({ icon: 'view', label: '查看详情', onClick: () => openDetail(row) }),
    canEditRow(row) && actionIcon({ icon: 'edit', label: '编辑订单', onClick: () => openEdit(row) }),
    row.status === 'pending_approval' && h(NButton, { text: true, size: 'small', type: 'warning', onClick: () => openApproval(row) }, { default: () => '审批' }),
    canDeliver(row) && h(NButton, { text: true, size: 'small', type: 'primary', onClick: () => openDeliver(row) }, { default: () => '送达' }),
  ]) },
]

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
function openDetail(row: OrderListItem) { router.push(`/order-center/detail/${row.id}`) }
function openEdit(row: OrderListItem) { router.push(`/order-center/detail/${row.id}?edit=1`) }
function openApproval(row: OrderListItem) { approvalOrderId.value = row.id; approvalVisible.value = true }
function openDeliver(row: OrderListItem) { deliverOrder.value = row; deliverVisible.value = true }

onMounted(() => {
  void load()
  void adminCustomerApi.list({ page: 1, page_size: 100 })
    .then(customers => { customerOptions.value = customers.map(customer => ({ label: customer.name, value: customer.id })) })
    .catch(() => { /* 请求层提示 */ })
  void adminCustomerApi.salesOptions()
    .then(sales => { salesOptions.value = sales.map((sale: SalesOption) => ({ label: sale.name, value: sale.id })) })
    .catch(() => { /* 请求层提示 */ })
})
</script>

<style scoped>
.order-list-page{height:100%;display:flex;flex-direction:column;overflow:hidden}.order-list-card{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}.filter-grid{flex-shrink:0;display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:14px;margin:16px 0 16px}.filter-item label{display:block;font-size:12px;color:#6b7280;margin-bottom:6px}.filter-item :deep(.n-date-picker),.filter-item :deep(.n-input),.filter-item :deep(.n-select){width:100%}.date-filter{grid-column:span 2}.keyword{grid-column:span 2}.filter-actions{grid-column:span 2;display:flex;align-items:end;justify-content:flex-end;gap:8px}.result-count,.muted{font-size:12px;color:#8b95a5}.table-wrap{flex:1;min-height:0;display:flex;flex-direction:column}.table-wrap :deep(.n-data-table){height:100%}.pagination-bar{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:12px;font-size:12px;color:#818b99;border-top:1px solid var(--border)}@media(max-width:1200px){.filter-grid{grid-template-columns:repeat(4,minmax(150px,1fr))}.date-filter,.keyword{grid-column:span 2}.filter-actions{grid-column:span 2}}@media(max-width:900px){.filter-grid{grid-template-columns:repeat(2,minmax(140px,1fr))}.date-filter,.keyword,.filter-actions{grid-column:span 2}}@media(max-width:560px){.filter-grid{grid-template-columns:1fr}.date-filter,.keyword,.filter-actions{grid-column:auto}}
.row-actions{display:flex;align-items:center;gap:10px}
</style>
