<template>
  <div class="page-container">
    <div class="filter-bar" style="margin-bottom: 16px">
      <n-radio-group v-model:value="preset" size="small" @update:value="loadAll">
        <n-radio-button value="7">近 7 天</n-radio-button>
        <n-radio-button value="30">近 30 天</n-radio-button>
        <n-radio-button value="90">近 90 天</n-radio-button>
      </n-radio-group>
      <n-button type="primary" size="small" @click="loadAll">刷新</n-button>
    </div>

    <n-grid :cols="4" :x-gap="12" :y-gap="12" responsive="screen" item-responsive>
      <n-gi v-for="k in kpis" :key="k.key" :span="1">
        <n-card size="small" :bordered="false" class="kpi-card">
          <div class="stat-card">
            <div class="icon-wrap" :style="{ background: k.color }">{{ k.icon }}</div>
            <div>
              <div class="stat-label">{{ k.label }}</div>
              <div class="stat-value">{{ k.value }}</div>
              <div class="stat-extra">{{ k.extra }}</div>
            </div>
          </div>
        </n-card>
      </n-gi>
    </n-grid>

    <n-card title="销售趋势" size="small" style="margin-top: 12px" :bordered="false">
      <v-chart :option="trendOption" autoresize style="height: 320px" />
    </n-card>

    <n-grid :cols="2" :x-gap="12" style="margin-top: 12px" responsive="screen" item-responsive>
      <n-gi><n-card title="商品销售排行 Top 10" size="small" :bordered="false"><v-chart :option="productOption" autoresize style="height: 320px" /></n-card></n-gi>
      <n-gi><n-card title="客户复购排行 Top 10" size="small" :bordered="false"><v-chart :option="customerOption" autoresize style="height: 320px" /></n-card></n-gi>
    </n-grid>

    <n-card title="异常监控" size="small" style="margin-top: 12px" :bordered="false">
      <template #header-extra>
        <n-tag v-if="alerts.length" type="warning" size="small">{{ alerts.length }} 条</n-tag>
      </template>
      <n-data-table :columns="alertColumns" :data="alerts" :bordered="false" size="small" />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { h, ref, computed, onMounted } from 'vue'
import { NTag, NButton, NSpace } from 'naive-ui'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import dayjs from 'dayjs'
import { dashboardApi } from '@/api'
import { formatMoney, formatQty, formatDate } from '@/utils/format'
import type { KPIResponse, ProductRanking, CustomerRanking, SalesTrendPoint, AlertItem } from '@/types'

use([CanvasRenderer, LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent])

const preset = ref('30')
const kpi = ref<KPIResponse | null>(null)
const topProducts = ref<ProductRanking[]>([])
const topCustomers = ref<CustomerRanking[]>([])
const trend = ref<SalesTrendPoint[]>([])
const alerts = ref<AlertItem[]>([])

const alertColumns = [
  { title: '级别', key: 'level', width: 80, render: (r: AlertItem) => h(NTag, { type: r.level === 'danger' ? 'error' : r.level === 'warning' ? 'warning' : 'info', size: 'small' }, { default: () => r.level === 'danger' ? '严重' : r.level === 'warning' ? '警告' : '提示' }) },
  { title: '标题', key: 'title', width: 200 },
  { title: '描述', key: 'description' },
  { title: '时间', key: 'created_at', width: 160, render: (r: AlertItem) => formatDate(r.created_at) },
]

const kpis = computed(() => [
  { key: 'gmv', label: '销售 GMV', value: formatMoney(kpi.value?.gmv), extra: `订单 ${formatQty(kpi.value?.order_count)}`, color: 'linear-gradient(135deg,#dc2626,#ef4444)', icon: '💰' },
  { key: 'pending', label: '待审核订单', value: formatQty(kpi.value?.pending_orders), extra: '需尽快处理', color: 'linear-gradient(135deg,#ea580c,#f59e0b)', icon: '⏰' },
  { key: 'new', label: '新增客户', value: formatQty(kpi.value?.new_customers), extra: `活跃 ${formatQty(kpi.value?.active_customers)}`, color: 'linear-gradient(135deg,#16a34a,#22c55e)', icon: '👥' },
  { key: 'alerts', label: '库存告警', value: formatQty((kpi.value?.low_stock_products ?? 0) + (kpi.value?.expiring_batches ?? 0)), extra: `低库存 ${formatQty(kpi.value?.low_stock_products)} / 临期 ${formatQty(kpi.value?.expiring_batches)}`, color: 'linear-gradient(135deg,#7c3aed,#a855f7)', icon: '⚠️' },
])

const trendOption = computed(() => ({
  tooltip: { trigger: 'axis' }, legend: { data: ['GMV', '订单数'], right: 0 },
  grid: { left: 50, right: 50, top: 40, bottom: 30 },
  xAxis: { type: 'category', data: trend.value.map(t => t.date.slice(5)) },
  yAxis: [{ type: 'value', name: 'GMV' }, { type: 'value', name: '订单数' }],
  series: [
    { name: 'GMV', type: 'line', smooth: true, data: trend.value.map(t => t.gmv), itemStyle: { color: '#dc2626' }, areaStyle: { color: 'rgba(220,38,38,0.1)' } },
    { name: '订单数', type: 'bar', yAxisIndex: 1, data: trend.value.map(t => t.order_count), itemStyle: { color: '#16a34a', borderRadius: [4,4,0,0] }, barWidth: 14 },
  ],
}))
const productOption = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { left: 100, right: 30, top: 20, bottom: 20 },
  xAxis: { type: 'value' },
  yAxis: { type: 'category', data: topProducts.value.map(p => p.product_name).reverse(), axisLabel: { width: 90, overflow: 'truncate' } },
  series: [{ type: 'bar', data: topProducts.value.map(p => p.gmv).reverse(), itemStyle: { color: '#dc2626', borderRadius: [0,4,4,0] } }],
}))
const customerOption = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { left: 100, right: 30, top: 20, bottom: 20 },
  xAxis: { type: 'value' },
  yAxis: { type: 'category', data: topCustomers.value.map(c => c.customer_name).reverse(), axisLabel: { width: 90, overflow: 'truncate' } },
  series: [{ type: 'bar', data: topCustomers.value.map(c => c.gmv).reverse(), itemStyle: { color: '#ea580c', borderRadius: [0,4,4,0] } }],
}))

async function loadAll() {
  const days = Number(preset.value)
  const [start, end] = [dayjs().subtract(days-1,'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')]
  const [k, p, c, a, t] = await Promise.all([
    dashboardApi.kpi(start, end), dashboardApi.topProducts(start, end, 10),
    dashboardApi.topCustomers(start, end, 10), dashboardApi.alerts(), dashboardApi.salesTrend(start, end),
  ])
  kpi.value = k; topProducts.value = p; topCustomers.value = c; alerts.value = a; trend.value = t
}
onMounted(loadAll)
</script>
