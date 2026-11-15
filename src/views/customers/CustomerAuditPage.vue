<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">客户审核</h2>
        <n-tag type="warning">待审核 {{ pending.length }} 人</n-tag>
      </div>
      <n-alert type="info" :bordered="false" style="margin-bottom: 16px">
        通过时选择客户等级（可改归属销售），客户即可看价格和下单；驳回需填原因，客户被禁止登录，可在「已驳回」里重新通过。
      </n-alert>
      <n-tabs v-model:value="tab" type="line" @update:value="onTab">
        <n-tab-pane name="pending" tab="待审核">
          <n-data-table :columns="columns" :data="pending" :loading="loading" :bordered="false" size="small" :scroll-x="1200" />
        </n-tab-pane>
        <n-tab-pane name="rejected" tab="已驳回">
          <n-data-table :columns="columns" :data="rejected" :loading="loading" :bordered="false" size="small" :scroll-x="1200" />
        </n-tab-pane>
      </n-tabs>
    </div>

    <n-modal v-model:show="approveVisible" title="通过审核" preset="card" style="width: 520px">
      <n-form label-placement="left" label-width="90">
        <n-form-item label="客户">{{ target?.name }}（{{ target?.phone || '无手机号' }}）</n-form-item>
        <n-form-item label="客户等级" required>
          <n-select v-model:value="approveForm.level_id" :options="levelOpts" placeholder="请选择客户等级" />
        </n-form-item>
        <n-form-item label="归属销售">
          <n-select v-model:value="approveForm.sales_id" clearable filterable :options="salesOpts" placeholder="不选则保持当前归属；无归属时归店家" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="approveVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="onApprove">确认通过</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="rejectVisible" title="驳回审核" preset="card" style="width: 480px">
      <n-form label-placement="left" label-width="90">
        <n-form-item label="客户">{{ target?.name }}</n-form-item>
        <n-form-item label="驳回原因" required>
          <n-input v-model:value="rejectReason" type="textarea" :rows="3" placeholder="必填，驳回后客户将被禁止登录" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="rejectVisible = false">取消</n-button>
        <n-button type="error" :loading="saving" @click="onReject">确认驳回</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, reactive, computed, onMounted } from 'vue'
import { NButton, NTag, useMessage, type DataTableColumns, type SelectOption } from 'naive-ui'
import { adminCustomerApi, levelApi } from '@/api'
import { formatPhone } from '@/utils/format'
import type { AdminCustomer, LevelConfig, SalesOption } from '@/types'

const message = useMessage()
const tab = ref('pending')
const pending = ref<AdminCustomer[]>([])
const rejected = ref<AdminCustomer[]>([])
const loading = ref(false)
const saving = ref(false)
const levels = ref<LevelConfig[]>([])
const salesList = ref<SalesOption[]>([])
const target = ref<AdminCustomer | null>(null)
const approveVisible = ref(false)
const rejectVisible = ref(false)
const rejectReason = ref('')
const approveForm = reactive<{ level_id: number | null; sales_id: number | null }>({ level_id: null, sales_id: null })

const levelOpts = computed<SelectOption[]>(() => levels.value.map((l) => ({ label: `${l.nickname}（默认额度 ¥${Number(l.default_credit_limit ?? 1000).toLocaleString()}）`, value: l.id, disabled: !l.is_active })))
const salesOpts = computed<SelectOption[]>(() => salesList.value.map((o) => ({ label: o.is_admin ? `管理员·${o.name}` : o.name, value: o.id })))

function formatTime(v?: string | null) {
  return v ? v.slice(0, 16).replace('T', ' ') : '—'
}

const columns = computed<DataTableColumns<AdminCustomer>>(() => {
  const base: DataTableColumns<AdminCustomer> = [
    { title: '客户名称', key: 'name', width: 130, ellipsis: { tooltip: true } },
    { title: '联系人', key: 'contact_name', width: 90, render: (r) => r.contact_name || '—' },
    { title: '手机号', key: 'phone', width: 120, render: (r) => formatPhone(r.phone || undefined) },
    { title: '微信', key: 'wechat_bound', width: 80, render: (r) => h(NTag, { size: 'small', type: r.wechat_bound ? 'success' : 'default' }, { default: () => (r.wechat_bound ? '已绑定' : '未绑定') }) },
    { title: '归属销售', key: 'sales_name', width: 110, render: (r) => (r.sales_name ? (r.sales_is_admin ? `管理员·${r.sales_name}` : r.sales_name) : '—') },
    { title: '地址', key: 'address', width: 180, ellipsis: { tooltip: true }, render: (r) => r.address || [r.province, r.city, r.district, r.town, r.detail_address].filter(Boolean).join('') || '—' },
    { title: '来源', key: 'source', width: 90, render: (r) => (r.created_by ? `销售录入${r.created_by_name ? '·' + r.created_by_name : ''}` : '小程序注册') },
    { title: '注册时间', key: 'created_at', width: 140, render: (r) => formatTime(r.created_at) },
  ]
  if (tab.value === 'rejected') {
    base.push(
      { title: '驳回原因', key: 'reject_reason', width: 180, ellipsis: { tooltip: true }, render: (r) => r.reject_reason || '—' },
      { title: '驳回时间', key: 'audited_at', width: 140, render: (r) => formatTime(r.audited_at) },
    )
  }
  base.push({
    title: '操作', key: 'actions', width: tab.value === 'pending' ? 140 : 100, fixed: 'right',
    render: (r) => h('div', { style: 'display:flex;gap:8px' }, tab.value === 'pending'
      ? [
        h(NButton, { size: 'small', type: 'primary', onClick: () => openApprove(r) }, { default: () => '通过' }),
        h(NButton, { size: 'small', type: 'error', onClick: () => openReject(r) }, { default: () => '驳回' }),
      ]
      : [h(NButton, { size: 'small', type: 'primary', onClick: () => openApprove(r) }, { default: () => '重新通过' })]),
  })
  return base
})

async function load() {
  loading.value = true
  try {
    ;[pending.value, rejected.value] = await Promise.all([
      adminCustomerApi.list({ status: 'pending', page_size: 100 }),
      adminCustomerApi.list({ audit: 'rejected', page_size: 100 }),
    ])
  } finally { loading.value = false }
}

function onTab() { /* 列随标签变化，数据已一起加载 */ }

function openApprove(r: AdminCustomer) {
  target.value = r
  Object.assign(approveForm, { level_id: r.level_id ?? null, sales_id: null })
  approveVisible.value = true
}

async function onApprove() {
  if (!target.value) return
  if (!approveForm.level_id) {
    message.warning('请选择客户等级')
    return
  }
  saving.value = true
  try {
    await adminCustomerApi.audit(target.value.id, { approved: true, level_id: approveForm.level_id, sales_id: approveForm.sales_id ?? null })
    message.success('已通过')
    approveVisible.value = false
    load()
  } finally { saving.value = false }
}

function openReject(r: AdminCustomer) {
  target.value = r
  rejectReason.value = ''
  rejectVisible.value = true
}

async function onReject() {
  if (!target.value) return
  if (!rejectReason.value.trim()) {
    message.warning('请填写驳回原因')
    return
  }
  saving.value = true
  try {
    await adminCustomerApi.audit(target.value.id, { approved: false, reason: rejectReason.value.trim() })
    message.success('已驳回')
    rejectVisible.value = false
    load()
  } finally { saving.value = false }
}

onMounted(async () => {
  levels.value = await levelApi.list()
  salesList.value = await adminCustomerApi.salesOptions()
  load()
})
</script>
