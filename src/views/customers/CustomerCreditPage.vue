<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">客户额度</h2>
        <n-tag v-if="pendingCount" type="warning">待审批调额申请 {{ pendingCount }} 条</n-tag>
      </div>
      <n-tabs v-model:value="tab" type="line" @update:value="onTabChange">
        <n-tab-pane name="credit" tab="客户额度">
          <div class="filter-bar">
            <n-input v-model:value="keyword" placeholder="客户名称 / 手机号" clearable style="width: 220px" @keyup.enter="search" />
            <n-select v-model:value="salesFilter" placeholder="归属销售" clearable filterable style="width: 160px" :options="salesOpts" @update:value="search" />
            <n-select v-model:value="levelFilter" placeholder="客户等级" clearable style="width: 160px" :options="levelOpts" @update:value="search" />
            <n-select v-model:value="sourceFilter" placeholder="额度来源" clearable style="width: 140px" :options="sourceOpts" @update:value="search" />
            <n-button type="primary" size="small" @click="search">查询</n-button>
          </div>
          <n-data-table :columns="creditColumns" :data="pagedList" :loading="loading" :bordered="false" size="small" :scroll-x="1100" :row-key="(r: AdminCustomer) => r.id" />
          <div class="pagination-bar">
            <n-pagination v-model:page="page" :item-count="list.length" :page-size="pageSize" />
          </div>
        </n-tab-pane>

        <n-tab-pane name="applications" tab="调额申请">
          <div class="filter-bar">
            <n-select v-model:value="appStatus" style="width: 140px" :options="appStatusOpts" @update:value="loadApplications" />
          </div>
          <n-data-table :columns="appColumns" :data="applications" :loading="appLoading" :bordered="false" size="small" :scroll-x="1100" />
        </n-tab-pane>
      </n-tabs>
    </div>

    <!-- 设置额度 -->
    <n-modal v-model:show="setVisible" title="设置额度与账期" preset="card" style="width: 640px">
      <n-form label-placement="left" label-width="100">
        <n-form-item label="客户">
          <span>{{ target?.name }}</span>
          <span style="margin-left: 12px; color: #999">
            当前生效 ¥{{ money(target?.effective_credit_limit) }}（{{ target?.credit_source === 'custom' ? '单独额度' : '等级默认' }}）
          </span>
        </n-form-item>
        <n-form-item label="额度">
          <n-radio-group v-model:value="setForm.mode">
            <n-radio-button value="level">跟随等级（¥{{ money(target?.level_default_credit_limit ?? '1000') }}）</n-radio-button>
            <n-radio-button value="custom">单独额度</n-radio-button>
          </n-radio-group>
        </n-form-item>
        <n-form-item v-if="setForm.mode === 'custom'" label="单独额度">
          <n-input-number v-model:value="setForm.credit_limit" :min="0" :step="1000" style="width: 220px">
            <template #suffix>元</template>
          </n-input-number>
          <span style="margin-left: 8px; color: #999">0 表示不允许欠款</span>
        </n-form-item>
        <n-form-item label="账期方式">
          <n-radio-group v-model:value="setForm.payment_term_type">
            <n-radio-button value="days">送达后 N 天</n-radio-button>
            <n-radio-button value="monthly">月结</n-radio-button>
          </n-radio-group>
        </n-form-item>
        <n-form-item v-if="setForm.payment_term_type === 'days'" label="天数">
          <n-input-number v-model:value="setForm.term_days" :min="1" :max="365" style="width: 160px"><template #suffix>天</template></n-input-number>
        </n-form-item>
        <n-form-item v-else label="每月几号">
          <n-input-number v-model:value="setForm.monthly_due_day" :min="1" :max="31" style="width: 160px"><template #suffix>号</template></n-input-number>
        </n-form-item>
        <n-form-item label="评定备注"><n-input v-model:value="setForm.credit_note" type="textarea" :rows="2" placeholder="选填" /></n-form-item>
        <n-form-item label="变更原因" :required="limitChanged">
          <n-input v-model:value="setForm.reason" :placeholder="limitChanged ? '额度有变化，必须填写原因' : '额度不变时不用填'" />
        </n-form-item>
      </n-form>
      <n-divider title-placement="left">额度变动记录</n-divider>
      <n-data-table :columns="logColumns" :data="logs" :loading="logsLoading" :bordered="false" size="small" max-height="220" />
      <template #footer>
        <n-button @click="setVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="onSaveCredit">保存</n-button>
      </template>
    </n-modal>

    <!-- 变动记录 -->
    <n-drawer v-model:show="logVisible" :width="640">
      <n-drawer-content :title="`额度变动记录 · ${target?.name || ''}`" closable>
        <n-data-table :columns="logColumns" :data="logs" :loading="logsLoading" :bordered="false" size="small" />
      </n-drawer-content>
    </n-drawer>

    <!-- 审批 -->
    <n-modal v-model:show="reviewVisible" :title="reviewApprove ? '同意调额申请' : '驳回调额申请'" preset="card" style="width: 480px">
      <n-form label-placement="left" label-width="100">
        <n-form-item label="客户">{{ reviewTarget?.customer_name }}（{{ reviewTarget?.sales_name }} 申请）</n-form-item>
        <n-form-item label="额度">
          <span>¥{{ money(reviewTarget?.current_limit) }} → 申请 ¥{{ money(reviewTarget?.requested_limit) }}</span>
        </n-form-item>
        <n-form-item v-if="reviewApprove" label="批准额度">
          <n-input-number v-model:value="reviewForm.approved_limit" :min="0" :step="1000" style="width: 220px">
            <template #suffix>元</template>
          </n-input-number>
          <span style="margin-left: 8px; color: #999">管理员可超过 10000</span>
        </n-form-item>
        <n-form-item label="审批意见" required><n-input v-model:value="reviewForm.comment" type="textarea" :rows="2" /></n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="reviewVisible = false">取消</n-button>
        <n-button :type="reviewApprove ? 'primary' : 'error'" :loading="saving" @click="onReview">{{ reviewApprove ? '同意' : '驳回' }}</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, reactive, computed, onMounted } from 'vue'
import { NButton, NTag, useMessage, type DataTableColumns, type SelectOption } from 'naive-ui'
import { adminCustomerApi, creditApplicationApi, levelApi, fetchAllPages, PAGE_SIZE } from '@/api'
import type { AdminCustomer, CreditApplication, CreditLog, LevelConfig, SalesOption } from '@/types'

const message = useMessage()
const tab = ref('credit')
const loading = ref(false)
const saving = ref(false)
const pageSize = PAGE_SIZE
const page = ref(1)
const list = ref<AdminCustomer[]>([])
const keyword = ref('')
const salesFilter = ref<number | null>(null)
const levelFilter = ref<number | null>(null)
const sourceFilter = ref<string | null>(null)
const salesList = ref<SalesOption[]>([])
const levels = ref<LevelConfig[]>([])

const target = ref<AdminCustomer | null>(null)
const setVisible = ref(false)
const logVisible = ref(false)
const logs = ref<CreditLog[]>([])
const logsLoading = ref(false)
const setForm = reactive<any>({ mode: 'level', credit_limit: 1000, payment_term_type: 'days', term_days: 30, monthly_due_day: 10, credit_note: '', reason: '' })

const applications = ref<CreditApplication[]>([])
const appLoading = ref(false)
const appStatus = ref('pending')
const pendingCount = ref(0)
const reviewVisible = ref(false)
const reviewApprove = ref(true)
const reviewTarget = ref<CreditApplication | null>(null)
const reviewForm = reactive<any>({ approved_limit: 0, comment: '' })

const salesOpts = computed<SelectOption[]>(() => salesList.value.map((o) => ({ label: o.is_admin ? `管理员·${o.name}` : o.name, value: o.id })))
const levelOpts = computed<SelectOption[]>(() => levels.value.map((l) => ({ label: l.nickname, value: l.id })))
const sourceOpts = [{ label: '等级默认', value: 'level' }, { label: '单独额度', value: 'custom' }]
const appStatusOpts = [
  { label: '待审批', value: 'pending' },
  { label: '已通过', value: 'approved' },
  { label: '已驳回', value: 'rejected' },
  { label: '全部', value: '' },
]
const pagedList = computed(() => list.value.slice((page.value - 1) * pageSize, page.value * pageSize))

function money(v?: string | number | null) {
  return Number(v ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatTime(v?: string | null) {
  return v ? v.slice(0, 16).replace('T', ' ') : '—'
}

function termText(r: AdminCustomer) {
  return r.payment_term_type === 'monthly' ? `月结${r.monthly_due_day ?? '—'}日` : `${r.term_days ?? 30}天`
}

const creditColumns = computed<DataTableColumns<AdminCustomer>>(() => [
  { title: '客户', key: 'name', width: 150, ellipsis: { tooltip: true }, render: (r) => `${r.name}${r.phone ? `（${r.phone}）` : ''}` },
  { title: '归属销售', key: 'sales_name', width: 110, render: (r) => r.sales_name ? (r.sales_is_admin ? `管理员·${r.sales_name}` : r.sales_name) : '—' },
  { title: '客户等级', key: 'level_nickname', width: 110, render: (r) => r.level_nickname || '—' },
  {
    title: '生效额度', key: 'effective_credit_limit', width: 160,
    render: (r) => h('span', [
      `¥${money(r.effective_credit_limit)} `,
      h(NTag, { size: 'small', type: r.credit_source === 'custom' ? 'info' : 'default' }, { default: () => (r.credit_source === 'custom' ? '单独' : '等级默认') }),
    ]),
  },
  { title: '账期', key: 'term', width: 90, render: termText },
  { title: '评定备注', key: 'credit_note', ellipsis: { tooltip: true }, render: (r) => r.credit_note || '—' },
  {
    title: '操作', key: 'actions', width: 140, fixed: 'right',
    render: (r) => h('div', { style: 'display:flex;gap:8px' }, [
      h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openSet(r) }, { default: () => '设置额度' }),
      h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openLogs(r) }, { default: () => '变动记录' }),
    ]),
  },
])

const CHANGE_LABEL: Record<string, string> = {
  level_default: '等级默认变化',
  application: '调额通过',
  admin_set: '管理员设置',
  level_change: '换等级',
}

const logColumns: DataTableColumns<CreditLog> = [
  { title: '时间', key: 'created_at', width: 140, render: (r) => formatTime(r.created_at) },
  { title: '类型', key: 'change_type', width: 100, render: (r) => CHANGE_LABEL[r.change_type] || r.change_type },
  { title: '改前', key: 'before', width: 80, render: (r) => (r.before != null ? `¥${money(r.before)}` : '—') },
  { title: '改后', key: 'after', width: 80, render: (r) => (r.after != null ? `¥${money(r.after)}` : '—') },
  { title: '操作人', key: 'operator_name', width: 90, render: (r) => r.operator_name || '—' },
  { title: '原因', key: 'reason', ellipsis: { tooltip: true }, render: (r) => (r.application_id ? `申请单 #${r.application_id}${r.reason ? ' · ' + r.reason : ''}` : r.reason || '—') },
]

const APP_STATUS: Record<string, { label: string; type: 'warning' | 'success' | 'error' }> = {
  pending: { label: '待审批', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  rejected: { label: '已驳回', type: 'error' },
}

const appColumns: DataTableColumns<CreditApplication> = [
  { title: '申请时间', key: 'created_at', width: 140, render: (r) => formatTime(r.created_at) },
  { title: '客户', key: 'customer_name', width: 130, ellipsis: { tooltip: true } },
  { title: '申请销售', key: 'sales_name', width: 90, render: (r) => r.sales_name || '—' },
  { title: '额度', key: 'limit', width: 160, render: (r) => `¥${money(r.current_limit)} → ¥${money(r.requested_limit)}` },
  { title: '理由', key: 'reason', width: 180, ellipsis: { tooltip: true } },
  { title: '状态', key: 'status', width: 80, render: (r) => h(NTag, { size: 'small', type: APP_STATUS[r.status].type }, { default: () => APP_STATUS[r.status].label }) },
  {
    title: '审批', key: 'review', width: 220, ellipsis: { tooltip: true },
    render: (r) => (r.status === 'pending' ? '—' : `${r.status === 'approved' ? `批准 ¥${money(r.approved_limit)} · ` : ''}${r.reviewer_name || ''} ${formatTime(r.reviewed_at)} · ${r.review_comment || ''}`),
  },
  {
    title: '操作', key: 'actions', width: 120, fixed: 'right',
    render: (r) => (r.status !== 'pending' ? '—' : h('div', { style: 'display:flex;gap:8px' }, [
      h(NButton, { size: 'small', type: 'primary', onClick: () => openReview(r, true) }, { default: () => '同意' }),
      h(NButton, { size: 'small', type: 'error', onClick: () => openReview(r, false) }, { default: () => '驳回' }),
    ])),
  },
]

/** 额度是否有变化：切换跟随 / 单独，或单独金额变了 */
const limitChanged = computed(() => {
  if (!target.value) return false
  if (setForm.mode === 'level') return target.value.credit_source === 'custom'
  return target.value.credit_source !== 'custom' || Number(target.value.credit_limit) !== Number(setForm.credit_limit)
})

function search() {
  page.value = 1
  reload()
}

async function reload() {
  loading.value = true
  try {
    list.value = await fetchAllPages((p) =>
      adminCustomerApi.list({
        keyword: keyword.value || undefined,
        sales_id: salesFilter.value ?? undefined,
        level_id: levelFilter.value ?? undefined,
        credit_source: sourceFilter.value ?? undefined,
        status: 'active,order_disabled',
        page: p,
        page_size: pageSize,
      }),
    )
  } finally { loading.value = false }
}

async function loadApplications() {
  appLoading.value = true
  try {
    applications.value = await creditApplicationApi.list({ status: appStatus.value || undefined, page_size: 100 })
  } finally { appLoading.value = false }
}

async function loadPendingCount() {
  pendingCount.value = (await creditApplicationApi.list({ status: 'pending', page_size: 100 })).length
}

function onTabChange(name: string) {
  if (name === 'applications') loadApplications()
}

async function loadLogs(id: number) {
  logsLoading.value = true
  try { logs.value = await adminCustomerApi.creditLogs(id) } finally { logsLoading.value = false }
}

function openSet(r: AdminCustomer) {
  target.value = r
  Object.assign(setForm, {
    mode: r.credit_source === 'custom' ? 'custom' : 'level',
    credit_limit: Number(r.credit_limit ?? r.effective_credit_limit ?? 1000),
    payment_term_type: r.payment_term_type || 'days',
    term_days: r.term_days ?? 30,
    monthly_due_day: r.monthly_due_day ?? 10,
    credit_note: r.credit_note || '',
    reason: '',
  })
  setVisible.value = true
  loadLogs(r.id)
}

function openLogs(r: AdminCustomer) {
  target.value = r
  logVisible.value = true
  loadLogs(r.id)
}

async function onSaveCredit() {
  if (!target.value) return
  if (limitChanged.value && !setForm.reason.trim()) {
    message.warning('额度有变化，请填写变更原因')
    return
  }
  const payload: any = {
    payment_term_type: setForm.payment_term_type,
    credit_note: setForm.credit_note || null,
  }
  if (setForm.payment_term_type === 'days') payload.term_days = setForm.term_days
  else payload.monthly_due_day = setForm.monthly_due_day
  if (limitChanged.value) {
    payload.credit_limit = setForm.mode === 'level' ? null : setForm.credit_limit
    payload.reason = setForm.reason.trim()
  }
  saving.value = true
  try {
    await adminCustomerApi.setCredit(target.value.id, payload)
    message.success('已保存')
    setVisible.value = false
    reload()
  } finally { saving.value = false }
}

function openReview(r: CreditApplication, approve: boolean) {
  reviewTarget.value = r
  reviewApprove.value = approve
  Object.assign(reviewForm, { approved_limit: Number(r.requested_limit), comment: '' })
  reviewVisible.value = true
}

async function onReview() {
  if (!reviewTarget.value) return
  if (!reviewForm.comment.trim()) {
    message.warning('请填写审批意见')
    return
  }
  saving.value = true
  try {
    if (reviewApprove.value) {
      await creditApplicationApi.approve(reviewTarget.value.id, { approved_limit: reviewForm.approved_limit, comment: reviewForm.comment.trim() })
      message.success('已同意')
    } else {
      await creditApplicationApi.reject(reviewTarget.value.id, { comment: reviewForm.comment.trim() })
      message.success('已驳回')
    }
    reviewVisible.value = false
    loadApplications()
    loadPendingCount()
    reload()
  } finally { saving.value = false }
}

onMounted(async () => {
  salesList.value = await adminCustomerApi.salesOptions()
  levels.value = await levelApi.list()
  reload()
  loadPendingCount()
})
</script>
