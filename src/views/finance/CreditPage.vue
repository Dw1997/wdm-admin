<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">客户账期</h2><n-button @click="exportStatement">导出对账单</n-button></div>
      <div class="filter-bar">
        <n-select v-model:value="selectedCustomer" placeholder="选择客户" filterable style="width: 320px" :options="customerOpts" @update:value="onSelectCustomer" />
        <n-date-picker v-model:value="dateRange" type="daterange" style="width: 280px" />
        <n-button type="primary" size="small" @click="loadStatement">生成对账单</n-button>
      </div>
      <n-grid v-if="credit" :cols="4" :x-gap="12" style="margin-bottom: 12px" responsive="screen" item-responsive>
        <n-gi v-for="s in creditCards" :key="s.label" :span="1"><n-card size="small" :bordered="false"><div class="stat-card"><div class="icon-wrap" :style="{ background: s.color }">{{ s.icon }}</div><div><div class="stat-label">{{ s.label }}</div><div class="stat-value" :class="s.danger ? 'text-danger' : s.success ? 'text-success' : ''">{{ s.value }}</div></div></div></n-card></n-gi>
      </n-grid>
      <div v-if="credit" style="margin-bottom: 12px"><n-progress :percentage="credit.usage_percent" :color="credit.usage_percent > 80 ? '#dc2626' : credit.usage_percent > 60 ? '#ea580c' : '#16a34a'" /></div>
      <div v-if="statement" class="card-section" style="margin: 0">
        <h3 class="page-title" style="margin-bottom: 12px">对账单（{{ statement.period_start }} ~ {{ statement.period_end }}）</h3>
        <n-descriptions :column="3" bordered size="small" style="margin-bottom: 12px">
          <n-descriptions-item label="客户">{{ statement.customer_name || '' }}</n-descriptions-item>
          <n-descriptions-item label="期初欠款">¥{{ formatQty(statement.opening_balance) }}</n-descriptions-item>
          <n-descriptions-item label="期末欠款"><span class="text-danger" style="font-weight:600">¥{{ formatQty(statement.closing_balance) }}</span></n-descriptions-item>
        </n-descriptions>
        <n-data-table :columns="itemColumns" :data="statement.items" :bordered="false" size="small" />
      </div>
      <n-empty v-else description="请选择客户并生成对账单" style="padding: 60px" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { h, ref, onMounted, computed } from 'vue'
import { NTag, useMessage, type DataTableColumns } from 'naive-ui'
import { financeApi, customerApi } from '@/api'
import { formatQty, formatDate } from '@/utils/format'
import type { CreditInfo, Statement, Customer } from '@/types'

const customers = ref<Customer[]>([]); const selectedCustomer = ref<number | null>(null)
const dateRange = ref<[number, number] | null>([Date.now() - 30 * 86400000, Date.now()])
const credit = ref<CreditInfo | null>(null); const statement = ref<Statement | null>(null); const message = useMessage()
const customerOpts = computed(() => customers.value.map(c => ({ label: `${c.shop_name || c.name} (${c.phone})`, value: c.id })))

const creditCards = computed(() => {
  if (!credit.value) return []
  return [
    { label: '授信总额度', value: `¥${formatQty(credit.value.credit_limit)}`, color: 'linear-gradient(135deg,#dc2626,#ef4444)', icon: '💳' },
    { label: '已用欠款', value: `¥${formatQty(credit.value.used_credit)}`, color: 'linear-gradient(135deg,#ea580c,#f59e0b)', icon: '💰', danger: true },
    { label: '可用额度', value: `¥${formatQty(credit.value.available_credit)}`, color: 'linear-gradient(135deg,#16a34a,#22c55e)', icon: '✅', success: credit.value.available_credit >= credit.value.credit_limit * 0.2 },
    { label: '使用率', value: `${credit.value.usage_percent}%`, color: 'linear-gradient(135deg,#7c3aed,#a855f7)', icon: '📊' },
  ]
})

const itemColumns: DataTableColumns = [
  { title: '日期', key: 'occurred_at', width: 150, render: (r: any) => formatDate(r.occurred_at) },
  { title: '订单号', key: 'order_id', width: 130 },
  { title: '类型', key: 'type', width: 80, render: (r: any) => h(NTag, { size: 'small', type: r.type === 'order' ? 'primary' : 'success' }, { default: () => r.type === 'order' ? '消费' : '回款' }) },
  { title: '金额', key: 'amount', width: 100, render: (r: any) => h('span', { style: r.amount < 0 ? 'color:#16a34a' : 'color:#dc2626' }, `${r.amount > 0 ? '+' : ''}¥${Math.abs(r.amount).toFixed(2)}`) },
  { title: '备注', key: 'remark', ellipsis: { tooltip: true } },
]

async function onSelectCustomer(id: number) {
  if (!id) { credit.value = null; statement.value = null; return }
  credit.value = await financeApi.credit(id); await loadStatement()
}
async function loadStatement() {
  if (!selectedCustomer.value || !dateRange.value) { message.warning('请选择客户和日期'); return }
  const s = new Date(dateRange.value[0]).toISOString().slice(0, 10); const e = new Date(dateRange.value[1]).toISOString().slice(0, 10)
  statement.value = await financeApi.statement(selectedCustomer.value, s, e)
}
function exportStatement() { if (!statement.value) { message.warning('请先生成对账单'); return }; message.success('已导出（演示）') }
onMounted(() => { customerApi.all().then(c => customers.value = c) })
</script>
