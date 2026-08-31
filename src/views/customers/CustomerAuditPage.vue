<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">客户审核</h2><n-tag type="warning">待审核 {{ list.length }} 人</n-tag></div>
      <n-alert type="info" :bordered="false" style="margin-bottom: 16px">客户注册后进入待审核状态；通过后激活账号，驳回后客户被禁用。</n-alert>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { h, ref, onMounted } from 'vue'
import { NButton, NTag, useMessage, useDialog, type DataTableColumns } from 'naive-ui'
import { adminCustomerApi } from '@/api'
import { formatPhone, formatDate } from '@/utils/format'
import type { AdminCustomer } from '@/types'

const list = ref<AdminCustomer[]>([])
const loading = ref(false)
const message = useMessage()
const dialog = useDialog()

const columns: DataTableColumns<AdminCustomer> = [
  { title: 'ID', key: 'id', width: 50 },
  { title: '客户名称', key: 'name', width: 120 },
  { title: '手机', key: 'phone', width: 130, render: (r) => formatPhone(r.phone) },
  { title: '联系人', key: 'contact_name', width: 100, render: (r) => r.contact_name || '—' },
  { title: '地址', key: 'address', ellipsis: { tooltip: true } },
  { title: '邀请码', key: 'invite_code', width: 100, render: (r) => r.invite_code || '—' },
  { title: '注册时间', key: 'created_at', width: 150, render: (r) => r.created_at ? formatDate(r.created_at) : '—' },
  { title: '操作', key: 'actions', width: 150, render: (r) => h('div', { style: 'display:flex;gap:8px' }, [
    h(NButton, { size: 'small', type: 'primary', onClick: () => approve(r) }, { default: () => '通过' }),
    h(NButton, { size: 'small', type: 'error', onClick: () => reject(r) }, { default: () => '驳回' }),
  ]) },
]

async function load() {
  loading.value = true
  try { list.value = await adminCustomerApi.list({ status: 'pending', page_size: 100 }) } finally { loading.value = false }
}

function approve(c: AdminCustomer) {
  dialog.info({
    title: '确认审核',
    content: `通过「${c.name}」的注册审核？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      await adminCustomerApi.update(c.id, { status: 'active' })
      message.success('已通过')
      load()
    },
  })
}

function reject(c: AdminCustomer) {
  dialog.warning({
    title: '驳回审核',
    content: `确认驳回「${c.name}」？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      await adminCustomerApi.update(c.id, { status: 'login_disabled' })
      message.success('已驳回')
      load()
    },
  })
}

onMounted(load)
</script>
