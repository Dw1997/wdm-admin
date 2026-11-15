<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">操作审计日志</h2></div>
      <n-alert type="warning" :bordered="false" style="margin-bottom: 16px">销售修改名下客户的商品售价、订单状态等操作均自动记录。管理员可查看全部日志。</n-alert>
      <div class="filter-bar">
        <n-select v-model:value="filterType" placeholder="目标类型" clearable style="width: 140px" :options="typeOpts" @update:value="reload" />
        <n-select v-model:value="filterAction" placeholder="操作类型" clearable style="width: 120px" :options="actionOpts" @update:value="reload" />
        <n-button type="primary" size="small" @click="reload">查询</n-button>
      </div>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { h, ref, onMounted, computed } from 'vue'
import { NTag, type DataTableColumns } from 'naive-ui'
import { auditLogApi } from '@/api'
import { formatDate } from '@/utils/format'
import type { AuditLog } from '@/types'

const list = ref<AuditLog[]>([]); const loading = ref(false); const filterType = ref(''); const filterAction = ref('')
const typeOpts = [{label:'商品',value:'product'},{label:'价格',value:'price'},{label:'订单',value:'order'},{label:'客户',value:'customer'},{label:'分类',value:'category'},{label:'等级',value:'level'}]
const actionOpts = [{label:'创建',value:'create'},{label:'更新',value:'update'},{label:'删除',value:'delete'}]

const columns = computed<DataTableColumns<AuditLog>>(() => [
  { title: 'ID', key: 'id', width: 60 },
  { title: '操作人', key: 'user_name', width: 140, render: (r) => h('div', [r.user_name, h('div', { style: 'font-size:12px;color:var(--text-3)' }, r.user_role === 'admin' ? '管理员' : '销售')]) },
  { title: '操作', key: 'action', width: 70, render: (r) => h(NTag, { size: 'small', type: r.action === 'create' ? 'success' : r.action === 'update' ? 'warning' : 'error' }, { default: () => { const m: Record<string,string> = { create: '创建', update: '更新', delete: '删除' }; return m[r.action] || r.action } }) },
  { title: '目标', key: 'target_name', ellipsis: { tooltip: true }, render: (r) => h('div', [r.target_name || r.target_id, h('div', { style: 'font-size:12px;color:var(--text-3)' }, `${targetLabel(r.target_type)} · ${r.target_id}`)]) },
  { title: '变更内容', key: 'changes', render: (r) => r.before_value || r.after_value ? h('div', { style: 'font-size:12px' }, [r.before_value ? h('div', { style: 'color:#dc2626' }, `- ${r.before_value}`) : null, r.after_value ? h('div', { style: 'color:#16a34a' }, `+ ${r.after_value}`) : null]) : h('span', { style: 'color:var(--text-3)' }, '—') },
  { title: '备注', key: 'remark', ellipsis: { tooltip: true } },
  { title: 'IP', key: 'ip_address', width: 120, render: (r) => r.ip_address || '—' },
  { title: '时间', key: 'created_at', width: 150, render: (r) => formatDate(r.created_at) },
])

function targetLabel(t: string) { const m: Record<string,string> = { product:'商品', price:'价格', order:'订单', customer:'客户', category:'分类', level:'等级' }; return m[t] || t }

async function reload() {
  loading.value = true
  try { list.value = await auditLogApi.list({ target_type: filterType.value || undefined, action: filterAction.value || undefined }) } finally { loading.value = false }
}
onMounted(reload)
</script>
