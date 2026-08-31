<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">收支流水</h2><n-button @click="exportData">导出</n-button></div>
      <div class="filter-bar">
        <n-input v-model:value="query.keyword" placeholder="客户 / 订单号" clearable style="width: 240px" @keyup.enter="reload" />
        <n-select v-model:value="query.status" placeholder="状态" clearable style="width: 120px" :options="[{label:'处理中',value:'pending'},{label:'成功',value:'success'},{label:'失败',value:'failed'}]" @update:value="reload" />
        <n-date-picker v-model:value="dateRange" type="daterange" style="width: 280px" />
        <n-button type="primary" size="small" @click="reload">查询</n-button>
      </div>
      <n-grid :cols="4" :x-gap="12" style="margin-bottom: 12px" responsive="screen" item-responsive>
        <n-gi v-for="s in stats" :key="s.label" :span="1"><n-card size="small" :bordered="false"><div class="stat-card"><div class="icon-wrap" :style="{ background: s.color }">{{ s.icon }}</div><div><div class="stat-label">{{ s.label }}</div><div class="stat-value">{{ s.value }}</div></div></div></n-card></n-gi>
      </n-grid>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" />
      <div class="pagination-bar"><n-pagination v-model:page="query.page" :page-size="query.page_size" :item-count="total" @update:page="reload" /></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { h, ref, reactive, onMounted, computed, watch } from 'vue'
import { NTag, useMessage, type DataTableColumns } from 'naive-ui'
import { financeApi } from '@/api'
import { PAYMENT_METHOD } from '@/utils/dict'
import { formatQty, formatDate } from '@/utils/format'
import type { Payment } from '@/types'

const list = ref<Payment[]>([]); const total = ref(0); const loading = ref(false)
const query = reactive<{ page: number; page_size: number; keyword: string; status: string; start_date?: string; end_date?: string }>({ page: 1, page_size: 20, keyword: '', status: '' })
const dateRange = ref<[number, number] | null>(null); const message = useMessage()

const stats = computed(() => [
  { label: '总收入', value: `¥${formatQty(list.value.filter(p => p.status === 'success').reduce((s, p) => s + p.amount, 0))}`, color: 'linear-gradient(135deg,#dc2626,#ef4444)', icon: '💰' },
  { label: '成功笔数', value: formatQty(list.value.filter(p => p.status === 'success').length), color: 'linear-gradient(135deg,#16a34a,#22c55e)', icon: '✅' },
  { label: '处理中', value: formatQty(list.value.filter(p => p.status === 'pending').length), color: 'linear-gradient(135deg,#ea580c,#f59e0b)', icon: '⏰' },
  { label: '失败', value: formatQty(list.value.filter(p => p.status === 'failed').length), color: 'linear-gradient(135deg,#7c3aed,#a855f7)', icon: '❌' },
])

const columns = computed<DataTableColumns<Payment>>(() => [
  { title: '流水号', key: 'id', width: 80 },
  { title: '订单号', key: 'order_id', width: 130 },
  { title: '客户', key: 'customer_name', ellipsis: { tooltip: true } },
  { title: '金额', key: 'amount', width: 100, render: (r) => `¥${r.amount.toFixed(2)}` },
  { title: '支付方式', key: 'method', width: 100, render: (r) => PAYMENT_METHOD[r.method as keyof typeof PAYMENT_METHOD] },
  { title: '状态', key: 'status', width: 80, render: (r) => h(NTag, { size: 'small', type: r.status === 'success' ? 'success' : r.status === 'pending' ? 'warning' : 'error' }, { default: () => r.status === 'success' ? '成功' : r.status === 'pending' ? '处理中' : '失败' }) },
  { title: '时间', key: 'created_at', width: 150, render: (r) => formatDate(r.created_at) },
])

async function reload() { loading.value = true; try { const res = await financeApi.payments({ ...query }); list.value = res.items; total.value = res.total } finally { loading.value = false } }
function exportData() { message.success('已导出（演示）') }
watch(dateRange, (v) => { if (v) { query.start_date = new Date(v[0]).toISOString().slice(0,10); query.end_date = new Date(v[1]).toISOString().slice(0,10) } })
onMounted(reload)
</script>
