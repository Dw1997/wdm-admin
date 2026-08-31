<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">客户地址</h2>
        <n-button type="primary" @click="reload">刷新</n-button>
      </div>
      <div class="filter-bar">
        <n-input v-model:value="keyword" placeholder="搜索客户名称 / 手机号" clearable style="width: 240px" @keyup.enter="reload" />
        <n-button type="primary" size="small" @click="reload">查询</n-button>
      </div>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" :row-key="(r:any)=>r.id" />
    </div>

    <n-modal v-model:show="editVisible" title="编辑收货地址" preset="card" style="width: 520px">
      <n-form label-placement="left" label-width="100">
        <n-form-item label="客户"><span>{{ form.name }}</span></n-form-item>
        <n-form-item label="收货地址"><n-input v-model:value="form.address" type="textarea" :rows="3" placeholder="请输入完整收货地址" /></n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="editVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="onSave">保存</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, reactive, computed, onMounted } from 'vue'
import { NButton, NPopconfirm, useMessage, type DataTableColumns } from 'naive-ui'
import { adminCustomerApi } from '@/api'
import type { AdminCustomer } from '@/types'

const message = useMessage()
const list = ref<AdminCustomer[]>([])
const keyword = ref('')
const loading = ref(false)
const saving = ref(false)
const editVisible = ref(false)
const form = reactive<any>({ id: 0, name: '', address: '' })

const columns = computed<DataTableColumns<AdminCustomer>>(() => [
  { title: 'ID', key: 'id', width: 60 },
  { title: '客户名称', key: 'name', width: 140 },
  { title: '手机号', key: 'phone', width: 140 },
  { title: '收货地址', key: 'address', ellipsis: { tooltip: true }, render: (r) => r.address || h('span', { style: 'color:#909399' }, '未填写') },
  { title: '操作', key: 'actions', width: 150, render: (r) => h('div', [
    h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openEdit(r) }, { default: () => '编辑地址' }),
    r.address ? h(NPopconfirm, { onPositiveClick: () => onClear(r) }, {
      default: () => '确认清除该地址?',
      trigger: () => h(NButton, { size: 'small', text: true, type: 'error', style: 'margin-left:8px' }, { default: () => '清除' }),
    }) : null,
  ]) },
])

async function reload() {
  loading.value = true
  try { list.value = await adminCustomerApi.list({ keyword: keyword.value || undefined, page_size: 100 }) } finally { loading.value = false }
}

function openEdit(r: AdminCustomer) {
  Object.assign(form, { id: r.id, name: r.name, address: r.address || '' })
  editVisible.value = true
}

async function onSave() {
  saving.value = true
  try {
    await adminCustomerApi.update(form.id, { address: form.address || null })
    message.success('地址已更新')
    editVisible.value = false
    reload()
  } finally { saving.value = false }
}

async function onClear(r: AdminCustomer) {
  await adminCustomerApi.update(r.id, { address: null })
  message.success('地址已清除')
  reload()
}

onMounted(reload)
</script>
