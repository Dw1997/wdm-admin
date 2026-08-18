<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">订单列表</h2><n-button @click="openCreate">代客下单</n-button></div>
      <div class="filter-bar">
        <n-input v-model:value="query.keyword" placeholder="订单号 / 客户" clearable style="width: 240px" @keyup.enter="reload" />
        <n-select v-model:value="query.status" placeholder="状态" clearable style="width: 140px" :options="statusOpts" @update:value="reload" />
        <n-select v-model:value="query.payment_method" placeholder="支付方式" clearable style="width: 140px" :options="paymentOpts" @update:value="reload" />
        <n-date-picker v-model:value="dateRange" type="daterange" style="width: 280px" @update:value="reload" />
        <n-button type="primary" size="small" @click="reload">查询</n-button>
      </div>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" />
      <div class="pagination-bar"><n-pagination v-model:page="query.page" :page-size="query.page_size" :item-count="total" @update:page="reload" /></div>
    </div>
    <n-modal v-model:show="detailVisible" title="订单详情" preset="card" style="width: 780px">
      <template v-if="detail">
        <n-descriptions :column="2" label-placement="left" bordered>
          <n-descriptions-item label="订单号">{{ detail.id }}</n-descriptions-item>
          <n-descriptions-item label="客户">{{ detail.customer_name }}</n-descriptions-item>
          <n-descriptions-item label="支付方式">{{ PAYMENT_METHOD[detail.payment_method as keyof typeof PAYMENT_METHOD] }}</n-descriptions-item>
          <n-descriptions-item label="状态"><n-tag :type="ORDER_STATUS[detail.status as keyof typeof ORDER_STATUS].type as any" size="small">{{ ORDER_STATUS[detail.status as keyof typeof ORDER_STATUS].label }}</n-tag></n-descriptions-item>
          <n-descriptions-item label="金额">¥{{ formatQty(detail.total_amount) }}</n-descriptions-item>
          <n-descriptions-item label="下单时间">{{ formatDate(detail.created_at) }}</n-descriptions-item>
          <n-descriptions-item label="收货地址" :span="2">{{ detail.delivery_address || '—' }}</n-descriptions-item>
        </n-descriptions>
        <h4 style="margin: 12px 0 8px">商品明细</h4>
        <n-data-table :columns="itemColumns" :data="detail.items" :bordered="false" size="small" />
      </template>
    </n-modal>
  </div>
</template>
<script setup lang="ts">
import { h, ref, reactive, watch, onMounted, computed } from 'vue'
import { NButton, NTag, NSpace, NDropdown, useMessage, useDialog, type DataTableColumns } from 'naive-ui'
import { orderApi, customerApi, productApi } from '@/api'
import { ORDER_STATUS, PAYMENT_METHOD } from '@/utils/dict'
import { formatQty, formatDate } from '@/utils/format'
import type { Order, PageQuery } from '@/types'

const list = ref<Order[]>([]); const total = ref(0); const loading = ref(false)
const query = reactive<PageQuery>({ page: 1, page_size: 20, keyword: '', status: '', payment_method: '' })
const dateRange = ref<[number, number] | null>(null); const message = useMessage(); const dialog = useDialog()
const detailVisible = ref(false); const detail = ref<Order | null>(null)
const statusOpts = [{label:'待审核',value:'pending_audit'},{label:'已驳回',value:'rejected'},{label:'待分拣',value:'paid'},{label:'分拣中',value:'picking'},{label:'已发货',value:'shipped'},{label:'已完成',value:'completed'},{label:'已取消',value:'cancelled'}]
const paymentOpts = [{label:'在线支付',value:'online'},{label:'账期挂账',value:'credit'},{label:'微信',value:'wechat'},{label:'对公转账',value:'bank'}]

const itemColumns: DataTableColumns = [
  { title: '商品', key: 'product_name', ellipsis: { tooltip: true } },
  { title: '单位', key: 'unit', width: 60 },
  { title: '数量', key: 'quantity', width: 60 },
  { title: '单价', key: 'unit_price', width: 80, render: (r: any) => `¥${r.unit_price.toFixed(2)}` },
  { title: '小计', key: 'subtotal', width: 100, render: (r: any) => `¥${r.subtotal.toFixed(2)}` },
]

const columns = computed<DataTableColumns<Order>>(() => [
  { title: '订单号', key: 'id', width: 130, fixed: 'left' },
  { title: '客户', key: 'customer_name', ellipsis: { tooltip: true } },
  { title: '商品', key: 'items', width: 80, render: (r) => h(NTag, { size: 'small', bordered: false }, { default: () => `${r.items.length} 种` }) },
  { title: '金额', key: 'total_amount', width: 120, render: (r) => h('div', [h('div', `¥${formatQty(r.total_amount)}`), h('div', { style: 'font-size:12px;color:#909399' }, PAYMENT_METHOD[r.payment_method as keyof typeof PAYMENT_METHOD])]) },
  { title: '状态', key: 'status', width: 90, render: (r) => h(NTag, { size: 'small', type: ORDER_STATUS[r.status as keyof typeof ORDER_STATUS].type as any }, { default: () => ORDER_STATUS[r.status as keyof typeof ORDER_STATUS].label }) },
  { title: '下单时间', key: 'created_at', width: 150, render: (r) => formatDate(r.created_at) },
  { title: '操作', key: 'actions', width: 220, fixed: 'right', render: (r) => h(NSpace, null, { default: () => [
    h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openDetail(r) }, { default: () => '详情' }),
    r.status === 'pending_audit' ? h(NButton, { size: 'small', text: true, type: 'success', onClick: () => audit(r, true) }, { default: () => '通过' }) : null,
    r.status === 'pending_audit' ? h(NButton, { size: 'small', text: true, type: 'error', onClick: () => audit(r, false) }, { default: () => '驳回' }) : null,
    canAdvance(r) ? h(NDropdown, { options: nextSteps(r.status), onSelect: (s: string) => advanceStatus(r, s as Order['status']) }, { default: () => h(NButton, { size: 'small', text: true, type: 'primary' }, { default: () => '流转' }) }) : null,
  ] }) },
])

const nextStatusMap: Record<string, { label: string; value: string }[]> = {
  paid: [{ label: '开始分拣', value: 'picking' }, { label: '取消', value: 'cancelled' }],
  picking: [{ label: '已发货', value: 'shipped' }, { label: '取消', value: 'cancelled' }],
  shipped: [{ label: '确认完成', value: 'completed' }],
}
function canAdvance(r: Order) { return (nextStatusMap[r.status] || []).length > 0 }
function nextSteps(s: string) { return (nextStatusMap[s] || []).map(o => ({ label: o.label, key: o.value })) }

async function reload() { loading.value = true; try { const res = await orderApi.list({ ...query }); list.value = res.items; total.value = res.total } finally { loading.value = false } }
function openDetail(r: Order) { detail.value = r; detailVisible.value = true }
function audit(r: Order, approved: boolean) {
  if (approved) { dialog.success({ title: '审核通过', content: `确认通过订单 ${r.id}？`, positiveText: '确认', negativeText: '取消', onPositiveClick: async () => { await orderApi.audit(r.id, true); message.success('已通过'); reload() } }) }
  else { dialog.warning({ title: '驳回订单', content: '请输入驳回原因', positiveText: '确认驳回', negativeText: '取消', onPositiveClick: async () => { await orderApi.audit(r.id, false, '驳回'); message.success('已驳回'); reload() } }) }
}
function advanceStatus(r: Order, status: Order['status']) { dialog.warning({ title: '流转确认', content: `确认将 ${r.id} 流转到 ${ORDER_STATUS[status as keyof typeof ORDER_STATUS].label}？`, positiveText: '确认', negativeText: '取消', onPositiveClick: async () => { await orderApi.updateStatus(r.id, status); message.success('已更新'); reload() } }) }
function openCreate() { message.info('代客下单功能请使用销售端APP') }
watch(dateRange, (v) => { if (v) { query.start_date = dayjs(v[0]).format('YYYY-MM-DD'); query.end_date = dayjs(v[1]).format('YYYY-MM-DD') } else { query.start_date = undefined; query.end_date = undefined } })
import dayjs from 'dayjs'
onMounted(reload)
</script>
