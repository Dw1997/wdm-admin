<template>
  <div class="page-container">
    <div class="filter-bar" style="margin-bottom: 12px">
      <n-radio-group v-model:value="period" size="small" @update:value="reload">
        <n-radio-button value="1">今日</n-radio-button><n-radio-button value="7">近7天</n-radio-button>
        <n-radio-button value="30">近30天</n-radio-button><n-radio-button value="month">本月</n-radio-button>
      </n-radio-group>
    </div>
    <n-card v-if="performance" size="small" :bordered="false" style="margin-bottom: 12px">
      <n-grid :cols="4" :x-gap="12" responsive="screen" item-responsive>
        <n-gi v-for="s in summary" :key="s.key" :span="1">
          <div class="stat-card"><div class="icon-wrap" :style="{ background: s.color }">{{ s.icon }}</div>
            <div><div class="stat-label">{{ s.label }}</div><div class="stat-value">{{ s.value }}</div></div></div>
        </n-gi>
      </n-grid>
    </n-card>
    <n-card title="排行榜" size="small" :bordered="false">
      <n-data-table :columns="columns" :data="ranking" :loading="loading" :bordered="false" size="small" />
    </n-card>
    <n-card title="最近提成" size="small" :bordered="false" style="margin-top: 12px">
      <n-data-table :columns="commissionColumns" :data="commissions" :bordered="false" size="small" />
    </n-card>
  </div>
</template>
<script setup lang="ts">
import { h, ref, computed, onMounted } from 'vue'
import { NTag, type DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import { salesApi, financeApi } from '@/api'
import { formatQty } from '@/utils/format'
import type { SalesPerformance, SalesRankingItem, Commission } from '@/types'

const period = ref('30'); const performance = ref<SalesPerformance | null>(null)
const ranking = ref<SalesRankingItem[]>([]); const loading = ref(false)
const commissions = ref<Commission[]>([])

const summary = computed(() => [
  { key: 'gmv', label: '团队GMV', value: `¥${formatQty(ranking.value.reduce((s, r) => s + r.gmv, 0))}`, color: 'linear-gradient(135deg,#4f46e5,#818cf8)', icon: '💰' },
  { key: 'order', label: '订单数', value: formatQty(ranking.value.reduce((s, r) => s + r.order_count, 0)), color: 'linear-gradient(135deg,#16a34a,#22c55e)', icon: '📋' },
  { key: 'new', label: '新增客户', value: formatQty(ranking.value.reduce((s, r) => s + r.new_customers, 0)), color: 'linear-gradient(135deg,#ea580c,#f59e0b)', icon: '👥' },
  { key: 'comm', label: '团队提成', value: `¥${formatQty(ranking.value.reduce((s, r) => s + r.estimated_commission, 0))}`, color: 'linear-gradient(135deg,#7c3aed,#a855f7)', icon: '🏆' },
])

const columns = computed<DataTableColumns<SalesRankingItem>>(() => [
  { title: '排名', key: 'ranking', width: 70, render: (r) => r.ranking <= 3 ? ['🥇','🥈','🥉'][r.ranking-1] + ` ${r.ranking}` : `${r.ranking}` },
  { title: '销售', key: 'sales_name', width: 100 },
  { title: '订单数', key: 'order_count', width: 80 },
  { title: 'GMV', key: 'gmv', width: 120, render: (r) => `¥${formatQty(r.gmv)}` },
  { title: '提成', key: 'estimated_commission', width: 120, render: (r) => h('span', { style: 'color:#ea580c' }, `¥${formatQty(r.estimated_commission)}`) },
  { title: '占比', key: 'pct', render: (r) => { const max = Math.max(...ranking.value.map(x => x.gmv), 1); const pct = Math.round((r.gmv / max) * 100); return h('div', { style: 'display:flex;align-items:center;gap:4px' }, [h('div', { style: `width:120px;height:8px;background:var(--bg-subtle);border-radius:4px;overflow:hidden` }, [h('div', { style: `width:${pct}%;height:100%;background:linear-gradient(90deg,#4f46e5,#818cf8)` })]), h('span', { style: 'font-size:12px;color:var(--text-3)' }, `${pct}%`)]) } },
])

const commissionColumns: DataTableColumns<Commission> = [
  { title: '客户', key: 'customer_name', width: 120 },
  { title: '订单号', key: 'order_id', width: 120 },
  { title: '订单金额', key: 'order_amount', width: 100, render: (r) => `¥${formatQty(r.order_amount)}` },
  { title: '提成金额', key: 'commission_amount', width: 100, render: (r) => h('span', { style: 'color:#ea580c' }, `+¥${r.commission_amount.toFixed(2)}`) },
  { title: '状态', key: 'status', width: 80, render: (r) => h(NTag, { size: 'small', type: r.status === 'settled' ? 'success' : 'warning' }, { default: () => r.status === 'settled' ? '已结算' : '待结算' }) },
  { title: '时间', key: 'created_at', width: 120 },
]

async function reload() {
  loading.value = true; const [s, e] = period.value === 'month' ? [dayjs().startOf('month').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')] : [dayjs().subtract(Number(period.value)-1,'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')]
  try {
    const [rank, comms] = await Promise.all([salesApi.ranking(s, e), financeApi.commissions({ page: 1, page_size: 10 })])
    ranking.value = rank
    performance.value = rank.length ? {
      sales_id: 0, sales_name: '团队', period_start: s, period_end: e,
      order_count: rank.reduce((a, r) => a + r.order_count, 0),
      gmv: rank.reduce((a, r) => a + r.gmv, 0),
      estimated_commission: rank.reduce((a, r) => a + r.estimated_commission, 0),
      new_customers: rank.reduce((a, r) => a + r.new_customers, 0),
    } : null
    commissions.value = comms.items
  } finally { loading.value = false }
}
onMounted(reload)
</script>
