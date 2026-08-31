<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">销售提成</h2><n-button type="primary" :disabled="!selected.length" @click="settle">批量结算 ({{ selected.length }})</n-button></div>
      <div class="filter-bar">
        <n-select v-model:value="query.sales_id" placeholder="销售" clearable filterable style="width: 200px" :options="salesOpts" @update:value="reload" />
        <n-select v-model:value="query.status" placeholder="状态" clearable style="width: 120px" :options="[{label:'待结算',value:'pending'},{label:'已结算',value:'settled'}]" @update:value="reload" />
        <n-button type="primary" size="small" @click="reload">查询</n-button>
      </div>
      <n-grid :cols="4" :x-gap="12" style="margin-bottom: 12px" responsive="screen" item-responsive>
        <n-gi v-for="s in stats" :key="s.label" :span="1"><n-card size="small" :bordered="false"><div class="stat-card"><div class="icon-wrap" :style="{ background: s.color }">{{ s.icon }}</div><div><div class="stat-label">{{ s.label }}</div><div class="stat-value">{{ s.value }}</div></div></div></n-card></n-gi>
      </n-grid>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" :row-key="(r:any)=>r.id" :checked-row-keys="selected" @update:checked-row-keys="onSelect" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { h, ref, reactive, onMounted, computed } from 'vue'
import { NTag, useMessage, useDialog, type DataTableColumns } from 'naive-ui'
import { financeApi, salesApi } from '@/api'
import { formatQty, formatDate } from '@/utils/format'
import type { Commission, Sales } from '@/types'

const list = ref<Commission[]>([]); const total = ref(0); const loading = ref(false)
const query = reactive<{ page: number; page_size: number; sales_id: number | null; status: string }>({ page: 1, page_size: 50, sales_id: null, status: '' })
const sales = ref<Sales[]>([]); const salesOpts = computed(() => sales.value.map(s => ({ label: s.name, value: s.id })))
const selected = ref<number[]>([]); const message = useMessage(); const dialog = useDialog()

const stats = computed(() => [
  { label: '提成总额', value: `¥${formatQty(list.value.reduce((s, c) => s + c.commission_amount, 0))}`, color: 'linear-gradient(135deg,#dc2626,#ef4444)', icon: '💰' },
  { label: '已结算', value: `¥${formatQty(list.value.filter(c => c.status === 'settled').reduce((s, c) => s + c.commission_amount, 0))}`, color: 'linear-gradient(135deg,#16a34a,#22c55e)', icon: '✅' },
  { label: '待结算', value: `¥${formatQty(list.value.filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0))}`, color: 'linear-gradient(135deg,#ea580c,#f59e0b)', icon: '⏰' },
  { label: '提成率', value: (() => { const t = list.value.reduce((s, c) => s + c.order_amount, 0); const c = list.value.reduce((s, x) => s + x.commission_amount, 0); return t ? ((c / t) * 100).toFixed(2) + '%' : '0%' })(), color: 'linear-gradient(135deg,#7c3aed,#a855f7)', icon: '📊' },
])

const columns = computed<DataTableColumns<Commission>>(() => [
  { type: 'selection' },
  { title: 'ID', key: 'id', width: 50 },
  { title: '销售', key: 'sales_name', width: 100 },
  { title: '订单号', key: 'order_id', width: 120 },
  { title: '客户', key: 'customer_name', ellipsis: { tooltip: true } },
  { title: '订单金额', key: 'order_amount', width: 100, render: (r) => `¥${formatQty(r.order_amount)}` },
  { title: '提成比例', key: 'commission_rate', width: 80, render: (r) => `${(r.commission_rate * 100).toFixed(1)}%` },
  { title: '提成金额', key: 'commission_amount', width: 100, render: (r) => h('span', { style: 'color:#ea580c' }, `¥${r.commission_amount.toFixed(2)}`) },
  { title: '状态', key: 'status', width: 80, render: (r) => h(NTag, { size: 'small', type: r.status === 'settled' ? 'success' : 'warning' }, { default: () => r.status === 'settled' ? '已结算' : '待结算' }) },
  { title: '时间', key: 'created_at', width: 120, render: (r) => formatDate(r.created_at) },
])

function onSelect(keys: (string | number)[]) { selected.value = keys as number[] }
async function reload() { loading.value = true; try { const res = await financeApi.commissions({ ...query }); list.value = res.items; total.value = res.total } finally { loading.value = false } }
function settle() { dialog.warning({ title: '批量结算', content: `确认结算 ${selected.value.length} 条提成？`, positiveText: '确认', negativeText: '取消', onPositiveClick: async () => { await financeApi.settleCommissions(selected.value); message.success('已结算'); selected.value = []; reload() } }) }
onMounted(() => { salesApi.all().then(s => sales.value = s); reload() })
</script>
