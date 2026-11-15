<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">分拣单 / 配送排线</h2><n-space><n-button @click="print">打印分拣单</n-button><n-button type="primary" @click="routeDialog = true">排线</n-button></n-space></div>
      <n-alert type="info" :bordered="false" style="margin-bottom: 16px">按商品汇总所有待分拣订单，便于仓库拣货；配送排线按客户地址聚类。</n-alert>
      <n-grid :cols="4" :x-gap="12" :y-gap="12" style="margin-bottom: 12px" responsive="screen" item-responsive>
        <n-gi v-for="s in summary" :key="s.label" :span="1"><n-card size="small" :bordered="false"><div class="stat-card"><div class="icon-wrap" :style="{ background: s.color }">{{ s.icon }}</div><div><div class="stat-label">{{ s.label }}</div><div class="stat-value">{{ s.value }}</div></div></div></n-card></n-gi>
      </n-grid>
      <h3 style="margin: 12px 0 8px">商品汇总（仓库拣货）</h3>
      <n-data-table :columns="columns" :data="rows" :loading="loading" :bordered="false" size="small" />
    </div>
    <n-modal v-model:show="routeDialog" title="配送排线" preset="card" style="width: 780px">
      <n-data-table :columns="routeColumns" :data="routes" :bordered="false" size="small" />
    </n-modal>
  </div>
</template>
<script setup lang="ts">
import { h, ref, computed, onMounted } from 'vue'
import { NTag, NInput, useMessage, type DataTableColumns } from 'naive-ui'
import { orderApi, customerApi, fetchAllPages, PAGE_SIZE } from '@/api'
import { formatQty } from '@/utils/format'
import type { Order, Customer } from '@/types'

const rows = ref<{ sku: string; name: string; unit: string; quantity: number; order_ids: string[] }[]>([]); const loading = ref(false); const message = useMessage()
const routeDialog = ref(false); const routes = ref<any[]>([])

const summary = computed(() => {
  const skus = new Set(rows.value.map(r => r.sku)); const totalQty = rows.value.reduce((s, r) => s + r.quantity, 0); const orders = new Set(rows.value.flatMap(r => r.order_ids))
  return [
    { label: '待拣 SKU', value: formatQty(skus.size), color: 'linear-gradient(135deg,#4f46e5,#818cf8)', icon: '📦' },
    { label: '待拣总数', value: formatQty(totalQty), color: 'linear-gradient(135deg,#ea580c,#f59e0b)', icon: '📋' },
    { label: '涉及订单', value: formatQty(orders.size), color: 'linear-gradient(135deg,#16a34a,#22c55e)', icon: '💰' },
    { label: '待分拣', value: formatQty(orders.size), color: 'linear-gradient(135deg,#7c3aed,#a855f7)', icon: '🚚' },
  ]
})

const columns: DataTableColumns<any> = [
  { title: 'SKU', key: 'sku', width: 120 },
  { title: '商品', key: 'name', ellipsis: { tooltip: true } },
  { title: '单位', key: 'unit', width: 80 },
  { title: '待拣数量', key: 'quantity', width: 100, render: (r) => h('span', { style: 'color:#ea580c;font-weight:600' }, formatQty(r.quantity)) },
  { title: '涉及订单', key: 'order_ids', render: (r) => r.order_ids.map((id: string) => h(NTag, { size: 'small', bordered: false, style: 'margin-right:4px;margin-bottom:4px' }, { default: () => id })) },
]

const routeColumns: DataTableColumns<any> = [
  { title: '区域', key: 'region', width: 140 },
  { title: '客户', key: 'customers', render: (r) => r.customers.map((c: string) => h(NTag, { size: 'small', style: 'margin-right:4px' }, { default: () => c })) },
  { title: '订单数', key: 'order_count', width: 80 },
  { title: 'GMV', key: 'total_amount', width: 100, render: (r) => `¥${formatQty(r.total_amount)}` },
  { title: '建议司机', key: 'driver', width: 160, render: (r) => h(NInput, { size: 'small', value: r.driver, onUpdateValue: (v: string) => { r.driver = v } }) },
]

function print() { message.success('已发送到打印机（演示）') }
async function reload() {
  loading.value = true; try { rows.value = await orderApi.pickingList({}) } finally { loading.value = false }
}
async function buildRoutes() {
  const customers = await customerApi.all(); const custMap = new Map<number, Customer>(); customers.forEach(c => custMap.set(c.id, c))
  // 排线需覆盖全部待分拣订单：统一 page_size=20 逐页拉全量
  const orders = await fetchAllPages((p) => orderApi.list({ status: 'paid', page: p, page_size: PAGE_SIZE }))
  const regions = new Map<string, { customers: Set<string>; orders: number; amount: number }>()
  for (const o of orders) {
    const c = custMap.get(o.customer_id); const region = c?.address?.split(/\d+/)[0]?.trim() || '未分区'
    const cur = regions.get(region) ?? { customers: new Set(), orders: 0, amount: 0 }
    cur.customers.add(c?.shop_name || c?.name || o.customer_name); cur.orders++; cur.amount += o.total_amount; regions.set(region, cur)
  }
  routes.value = Array.from(regions.entries()).map(([region, v]) => ({ region, customers: Array.from(v.customers), order_count: v.orders, total_amount: v.amount, driver: '' }))
}
onMounted(() => { reload(); buildRoutes() })
</script>
