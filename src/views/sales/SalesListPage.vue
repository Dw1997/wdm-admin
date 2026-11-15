<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">销售管理</h2>
        <div class="header-actions">
          <n-input v-model:value="keyword" placeholder="搜索姓名 / 手机号" clearable style="width: 210px" @keyup.enter="load" />
          <n-select v-model:value="statusFilter" :options="statusOptions" style="width: 110px" @update:value="load" />
          <n-button @click="load">查询</n-button>
          <n-button type="primary" @click="router.push('/sales/new')">新建销售</n-button>
        </div>
      </div>
      <n-data-table :columns="columns" :data="sales" :loading="loading" :bordered="false" size="small" />
      <n-empty v-if="!loading && sales.length === 0" description="暂无销售账号" style="padding: 32px" />
    </div>

    <n-modal v-model:show="editVisible" title="编辑销售" preset="card" style="width: 440px">
      <n-form :model="editForm" label-placement="left" label-width="80">
        <n-form-item label="姓名"><n-input v-model:value="editForm.real_name" /></n-form-item>
        <n-form-item label="手机号"><n-input v-model:value="editForm.phone" maxlength="11" /></n-form-item>
        <n-form-item label="提成比例"><n-input v-model:value="editForm.commissionPercent" placeholder="例如 5 表示 5%"><template #suffix>%</template></n-input></n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="editVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="saveEdit">保存</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="passwordVisible" title="重置销售密码" preset="card" style="width: 440px">
      <n-form label-placement="left" label-width="90">
        <n-form-item label="新密码"><n-input v-model:value="newPassword" type="password" show-password-on="click" /></n-form-item>
        <n-form-item label="确认密码"><n-input v-model:value="confirmPassword" type="password" show-password-on="click" /></n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="passwordVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="savePassword">确认重置</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NTag, useDialog, useMessage, type DataTableColumns } from 'naive-ui'
import { accountApi } from '@/api'
import { formatDate } from '@/utils/format'
import type { SystemAccount } from '@/types'

const router = useRouter()
const dialog = useDialog()
const message = useMessage()
const sales = ref<SystemAccount[]>([])
const loading = ref(false)
const saving = ref(false)
const keyword = ref('')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
]
const editVisible = ref(false)
const editForm = reactive({ id: 0, real_name: '', phone: '', commissionPercent: '' })
const passwordVisible = ref(false)
const passwordId = ref(0)
const newPassword = ref('')
const confirmPassword = ref('')
const phonePattern = /^1[3-9]\d{9}$/

const columns = computed<DataTableColumns<SystemAccount>>(() => [
  { title: '姓名', key: 'real_name', render: (row) => row.real_name || '—' },
  { title: '手机号', key: 'phone', render: (row) => row.phone || '—' },
  { title: '状态', key: 'is_active', render: (row) => h(NTag, { size: 'small', type: row.is_active ? 'success' : 'default' }, { default: () => row.is_active ? '启用' : '停用' }) },
  { title: '名下客户数', key: 'customer_count' },
  { title: '提成比例', key: 'commission_rate', render: (row) => row.commission_rate == null ? '—' : `${(Number(row.commission_rate) * 100).toFixed(2)}%` },
  { title: '推广码', key: 'invite_code', render: (row) => row.is_active ? row.invite_code || '—' : '已失效' },
  { title: '最后登录', key: 'last_login_at', render: (row) => row.last_login_at ? formatDate(row.last_login_at) : '—' },
  { title: '创建时间', key: 'created_at', render: (row) => row.created_at ? formatDate(row.created_at) : '—' },
  { title: '操作', key: 'actions', render: (row) => h('div', { style: 'display:flex;gap:10px' }, [
    h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openEdit(row) }, { default: () => '编辑' }),
    h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openPassword(row) }, { default: () => '重置密码' }),
    h(NButton, { size: 'small', text: true, type: row.is_active ? 'warning' : 'primary', onClick: () => changeStatus(row) }, { default: () => row.is_active ? '停用' : '启用' }),
  ]) },
])

async function load() {
  loading.value = true
  try {
    sales.value = await accountApi.listSales({
      keyword: keyword.value.trim() || undefined,
      is_active: statusFilter.value === 'all' ? undefined : statusFilter.value === 'active',
    })
  } finally {
    loading.value = false
  }
}

function openEdit(row: SystemAccount) {
  Object.assign(editForm, {
    id: row.id,
    real_name: row.real_name || '',
    phone: row.phone || '',
    commissionPercent: row.commission_rate == null ? '' : String(Number(row.commission_rate) * 100),
  })
  editVisible.value = true
}

async function saveEdit() {
  if (!editForm.real_name.trim() || !phonePattern.test(editForm.phone)) {
    message.warning('请填写姓名和正确的手机号')
    return
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(editForm.commissionPercent) || Number(editForm.commissionPercent) > 100) {
    message.warning('提成比例请填写 0 至 100，最多两位小数')
    return
  }
  saving.value = true
  try {
    await accountApi.update(editForm.id, {
      real_name: editForm.real_name.trim(),
      phone: editForm.phone,
      commission_rate: (Number(editForm.commissionPercent) / 100).toFixed(4),
    })
    editVisible.value = false
    message.success('已保存')
    await load()
  } finally {
    saving.value = false
  }
}

function openPassword(row: SystemAccount) {
  passwordId.value = row.id
  newPassword.value = ''
  confirmPassword.value = ''
  passwordVisible.value = true
}

async function savePassword() {
  if (newPassword.value.length < 6 || newPassword.value !== confirmPassword.value) {
    message.warning('密码至少 6 位，且两次输入必须一致')
    return
  }
  saving.value = true
  try {
    await accountApi.updatePassword(passwordId.value, newPassword.value)
    passwordVisible.value = false
    message.success('密码已重置')
  } finally {
    saving.value = false
  }
}

function changeStatus(row: SystemAccount) {
  dialog.warning({
    title: row.is_active ? '停用销售' : '启用销售',
    content: row.is_active
      ? `该销售名下有 ${row.customer_count} 个客户。停用后客户将全部归店主，推广码失效；重新启用不会自动转回客户。`
      : '启用后该销售可重新登录，推广码恢复。',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      await accountApi.update(row.id, { is_active: !row.is_active })
      message.success(row.is_active ? '已停用' : '已启用')
      await load()
    },
  })
}

onMounted(load)
</script>
