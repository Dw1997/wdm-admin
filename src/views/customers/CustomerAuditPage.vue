<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">客户审核</h2><n-tag type="warning">待审核 {{ list.length }} 人</n-tag></div>
      <n-alert type="info" :bordered="false" style="margin-bottom: 16px">客户通过推广链接注册后进入待审核状态；通过后激活账号并绑定销售。</n-alert>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { h, ref, onMounted } from 'vue'
import { NButton, NTag, useMessage, useDialog, type DataTableColumns } from 'naive-ui'
import { customerApi, salesApi } from '@/api'
import { formatPhone, relativeTime } from '@/utils/format'
import type { Customer, Sales } from '@/types'

const list = ref<Customer[]>([]); const loading = ref(false); const message = useMessage(); const dialog = useDialog()
const sales = ref<Sales[]>([])

const columns: DataTableColumns<Customer> = [
  { title: 'ID', key: 'id', width: 50 },
  { title: '姓名', key: 'name', width: 100 },
  { title: '手机', key: 'phone', width: 120, render: (r) => formatPhone(r.phone) },
  { title: '店铺', key: 'shop_name', ellipsis: { tooltip: true } },
  { title: '地址', key: 'address', ellipsis: { tooltip: true } },
  { title: '邀请码', key: 'invite_code', width: 100, render: (r) => r.invite_code || '—' },
  { title: '注册时间', key: 'registered_at', width: 100, render: (r) => relativeTime(r.registered_at) },
  { title: '操作', key: 'actions', width: 300, render: (r) => h('div', { style: 'display:flex;gap:8px;align-items:center' }, [
    h(NSelect, { size: 'small', style: 'width:140px', value: (r as any)._assignSales, options: sales.value.map(s => ({ label: s.name, value: s.id })), onUpdateValue: (v: number) => { (r as any)._assignSales = v } }),
    h(NButton, { size: 'small', type: 'primary', onClick: () => approve(r) }, { default: () => '通过' }),
    h(NButton, { size: 'small', type: 'error', onClick: () => reject(r) }, { default: () => '驳回' }),
  ]) },
]

import { NSelect } from 'naive-ui'
async function load() { loading.value = true; try { list.value = (await customerApi.pending()).map((c: any) => ({ ...c, _assignSales: c.sales_id ?? sales.value[0]?.id })); } finally { loading.value = false } }
async function loadSales() { sales.value = await salesApi.all(); await load() }
function approve(c: Customer) { dialog.info({ title: '确认审核', content: `通过「${c.shop_name || c.name}」的注册审核？`, positiveText: '确认', negativeText: '取消', onPositiveClick: async () => { await customerApi.approve(c.id, (c as any)._assignSales || 1); message.success('已通过'); load() } }) }
function reject(c: Customer) { dialog.warning({ title: '驳回审核', content: `确认驳回「${c.shop_name || c.name}」？`, positiveText: '确认', negativeText: '取消', onPositiveClick: async () => { await customerApi.reject(c.id); message.success('已驳回'); load() } }) }
onMounted(loadSales)
</script>
