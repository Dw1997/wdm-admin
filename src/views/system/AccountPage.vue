<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">账户管理</h2>
        <div class="header-actions">
          <n-input v-model:value="keyword" placeholder="搜索用户名 / 姓名" clearable style="width: 220px" @keyup.enter="reload" />
          <n-button type="primary" @click="reload">查询</n-button>
          <n-button type="primary" @click="openCreate">新建账户</n-button>
        </div>
      </div>
      <n-alert type="info" :bordered="false" style="margin-bottom: 16px">账户通过角色获得权限；新建账户时设置初始密码，之后可在列表中重置密码。</n-alert>
      <n-data-table :columns="columns" :data="accounts" :loading="loading" :bordered="false" size="small" />
    </div>

    <n-modal v-model:show="editVisible" :title="form.id ? '编辑账户' : '新建账户'" preset="card" style="width: 520px">
      <n-form :model="form" label-placement="left" label-width="110">
        <n-form-item label="用户名"><n-input v-model:value="form.username" :disabled="!!form.id" placeholder="3-64 位" /></n-form-item>
        <n-form-item v-if="!form.id" label="初始密码"><n-input v-model:value="form.password" type="password" show-password-on="click" placeholder="至少 6 位" /></n-form-item>
        <n-form-item label="姓名"><n-input v-model:value="form.real_name" /></n-form-item>
        <n-form-item label="手机号"><n-input v-model:value="form.phone" placeholder="移动端登录手机号" /></n-form-item>
        <n-form-item label="角色">
          <n-select v-model:value="form.role_id" :options="roleOptions" placeholder="选择角色" />
        </n-form-item>
        <n-form-item label="启用"><n-switch v-model:value="form.is_active" /></n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="editVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="onSave">保存</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="passwordVisible" :title="`重置密码 · ${passwordAccount?.username || ''}`" preset="card" style="width: 460px">
      <n-form label-placement="left" label-width="110">
        <n-form-item label="新密码"><n-input v-model:value="newPassword" type="password" show-password-on="click" placeholder="至少 6 位" /></n-form-item>
        <n-form-item label="确认密码"><n-input v-model:value="confirmPassword" type="password" show-password-on="click" placeholder="再次输入新密码" /></n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="passwordVisible = false">取消</n-button>
        <n-button type="primary" :loading="passwordSaving" @click="onPasswordSave">确认重置</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NTag, NPopconfirm, useMessage, type DataTableColumns, type SelectOption } from 'naive-ui'
import { accountApi, roleApi } from '@/api'
import { formatDate } from '@/utils/format'
import type { SystemAccount, RoleConfig } from '@/types'

const message = useMessage()
const router = useRouter()
const accounts = ref<SystemAccount[]>([])
const roles = ref<RoleConfig[]>([])
const loading = ref(false)
const saving = ref(false)
const keyword = ref('')
const editVisible = ref(false)
const form = reactive<any>({ id: 0, username: '', password: '', real_name: '', phone: '', role_id: null, is_active: true })

const passwordVisible = ref(false)
const passwordSaving = ref(false)
const passwordAccount = ref<SystemAccount | null>(null)
const newPassword = ref('')
const confirmPassword = ref('')

const roleOptions = computed<SelectOption[]>(() => roles.value.filter((r) => r.code !== 'sales').map((r) => ({ label: `${r.name} (${r.code})`, value: r.id, disabled: !r.is_active })))

const columns = computed<DataTableColumns<SystemAccount>>(() => [
  { title: 'ID', key: 'id', width: 60 },
  { title: '用户名', key: 'username', width: 130 },
  { title: '姓名', key: 'real_name', width: 110, render: (r) => r.real_name || '—' },
  { title: '手机号', key: 'phone', width: 130, render: (r) => r.phone || '—' },
  { title: '角色', key: 'role_name', width: 140, render: (r) => h('div', [r.role_name, h('div', { style: 'font-size:12px;color:var(--text-3)' }, r.role_code)]) },
  { title: '平台', key: 'platform', width: 110, render: (r) => h(NTag, { size: 'small', type: r.platform === 'web' ? 'primary' : 'warning' }, { default: () => r.platform === 'web' ? 'Web 管理端' : '销售端' }) },
  { title: '状态', key: 'is_active', width: 70, render: (r) => h(NTag, { size: 'small', type: r.is_active ? 'success' : 'error' }, { default: () => r.is_active ? '启用' : '禁用' }) },
  { title: '最后登录', key: 'last_login_at', width: 150, render: (r) => r.last_login_at ? formatDate(r.last_login_at) : '—' },
  { title: '操作', key: 'actions', width: 190, render: (r) => r.role_code === 'sales'
    ? h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => router.push('/sales/list') }, { default: () => '销售管理' })
    : h('div', [
    h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openEdit(r) }, { default: () => '编辑' }),
    h(NButton, { size: 'small', text: true, type: 'primary', style: 'margin-left:8px', onClick: () => openPassword(r) }, { default: () => '重置密码' }),
    h(NPopconfirm, { onPositiveClick: () => onDelete(r) }, {
      default: () => '确认删除该账户?',
      trigger: () => h(NButton, { size: 'small', text: true, type: 'error', style: 'margin-left:8px' }, { default: () => '删除' }),
    }),
  ]) },
])

async function reload() {
  loading.value = true
  try { accounts.value = await accountApi.list(keyword.value || undefined) } finally { loading.value = false }
}

async function loadRoles() {
  roles.value = await roleApi.list()
}

function openCreate() {
  Object.assign(form, { id: 0, username: '', password: '', real_name: '', phone: '', role_id: roles.value.find((r) => r.is_active && r.code !== 'sales')?.id ?? null, is_active: true })
  editVisible.value = true
}

function openEdit(r: SystemAccount) {
  Object.assign(form, { id: r.id, username: r.username, password: '', real_name: r.real_name || '', phone: r.phone || '', role_id: r.role_id, is_active: r.is_active })
  editVisible.value = true
}

async function onSave() {
  if (!form.username || !form.role_id) {
    message.warning('请填写用户名并选择角色')
    return
  }
  if (!form.id && (!form.password || form.password.length < 6)) {
    message.warning('初始密码至少 6 位')
    return
  }
  saving.value = true
  try {
    if (form.id) {
      await accountApi.update(form.id, { real_name: form.real_name || null, phone: form.phone || null, role_id: form.role_id, is_active: form.is_active })
      message.success('已更新')
    } else {
      await accountApi.create({ username: form.username, password: form.password, real_name: form.real_name || null, phone: form.phone || null, role_id: form.role_id, is_active: form.is_active })
      message.success('已创建')
    }
    editVisible.value = false
    reload()
  } finally { saving.value = false }
}

async function onDelete(r: SystemAccount) {
  await accountApi.remove(r.id)
  message.success('已删除')
  reload()
}

function openPassword(r: SystemAccount) {
  passwordAccount.value = r
  newPassword.value = ''
  confirmPassword.value = ''
  passwordVisible.value = true
}

async function onPasswordSave() {
  if (!passwordAccount.value) return
  if (!newPassword.value || newPassword.value.length < 6) {
    message.warning('新密码至少 6 位')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    message.warning('两次输入的密码不一致')
    return
  }
  passwordSaving.value = true
  try {
    await accountApi.updatePassword(passwordAccount.value.id, newPassword.value)
    message.success('密码已重置')
    passwordVisible.value = false
  } finally { passwordSaving.value = false }
}

onMounted(() => { reload(); loadRoles() })
</script>

<style scoped>
.header-actions { display: flex; align-items: center; gap: 8px; }
</style>
