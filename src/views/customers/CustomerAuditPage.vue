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

    <n-modal v-model:show="approveVisible" title="补全资料并通过审核" preset="card" style="width: 600px">
      <n-form label-placement="left" label-width="90">
        <n-form-item label="手机号">{{ formatPhone(target?.phone ?? undefined) || '无手机号' }}</n-form-item>
        <n-form-item label="客户名称">
          <n-input v-model:value="approveForm.name" placeholder="填写客户真实名称/店名" maxlength="100" />
        </n-form-item>
        <n-form-item label="联系人">
          <n-input v-model:value="approveForm.contact_name" placeholder="选填，不填默认同客户名称" maxlength="50" />
        </n-form-item>
        <n-form-item label="收货地点">
          <RegionPicker
            v-model:value="approveForm.delivery_region_id"
            :fallback-label="approveFallbackRegion"
          />
        </n-form-item>
        <n-form-item label="详细地址">
          <n-input v-model:value="approveForm.detail_address" placeholder="选填，如街道 / 门牌 / 菜市场摊位号" maxlength="255" />
        </n-form-item>
        <n-form-item label="客户等级" required>
          <n-select v-model:value="approveForm.level_id" :options="levelOpts" placeholder="请选择客户等级（默认预选默认售价）" />
        </n-form-item>
        <n-form-item label="客户标签">
          <n-select v-model:value="approveForm.tag_id" clearable filterable :options="tagOpts" placeholder="选填，未实地考察可不填" />
        </n-form-item>
        <n-form-item label="归属销售">
          <n-select v-model:value="approveForm.sales_id" clearable filterable :options="salesOpts" placeholder="不选则保持当前归属；无归属时归店家" />
        </n-form-item>
        <n-form-item label="介绍人">
          <n-select v-model:value="approveForm.referrer_customer_id" clearable filterable :options="referrerOpts" placeholder="选填，填写后该客户首单送达自动给介绍人发拉新券" />
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
import { adminCustomerApi, customerTagApi, levelApi } from '@/api'
import { formatPhone } from '@/utils/format'
import type { AdminCustomer, CustomerTag, LevelConfig, SalesOption } from '@/types'
import RegionPicker from '@/components/RegionPicker.vue'

const message = useMessage()
const tab = ref('pending')
const pending = ref<AdminCustomer[]>([])
const rejected = ref<AdminCustomer[]>([])
const loading = ref(false)
const saving = ref(false)
const levels = ref<LevelConfig[]>([])
const tags = ref<CustomerTag[]>([])
const salesList = ref<SalesOption[]>([])
const activeCustomers = ref<AdminCustomer[]>([])
const target = ref<AdminCustomer | null>(null)
const approveVisible = ref(false)
const rejectVisible = ref(false)
const rejectReason = ref('')
const approveForm = reactive<{
  name: string
  contact_name: string
  delivery_region_id: number | null
  detail_address: string
  level_id: number | null
  tag_id: number | null
  sales_id: number | null
  referrer_customer_id: number | null
}>({ name: '', contact_name: '', delivery_region_id: null, detail_address: '', level_id: null, tag_id: null, sales_id: null, referrer_customer_id: null })
const approveFallbackRegion = computed(() =>
  target.value ? [target.value.province, target.value.city, target.value.district, target.value.town].filter(Boolean).join(' / ') : '',
)

const levelOpts = computed<SelectOption[]>(() =>
  levels.value
    .filter((l) => l.level_id !== 'walk_in')
    .map((l) => ({ label: `${l.nickname}（默认额度 ¥${Number(l.default_credit_limit ?? 1000).toLocaleString()}）`, value: l.id, disabled: !l.is_active }))
)
const tagOpts = computed<SelectOption[]>(() => tags.value.map((t) => ({ label: t.name, value: t.id })))
const salesOpts = computed<SelectOption[]>(() => salesList.value.map((o) => ({ label: o.is_admin ? `管理员·${o.name}` : o.name, value: o.id })))
const referrerOpts = computed<SelectOption[]>(() =>
  activeCustomers.value
    .filter((c) => !c.is_system && c.id !== target.value?.id)
    .map((c) => ({ label: `${c.name}${c.phone ? `（${c.phone}）` : ''}`, value: c.id })),
)

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
    { title: '介绍人', key: 'referrer_customer_name', width: 110, render: (r) => r.referrer_customer_name || '—' },
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
  const defaultLv = levels.value.find((l) => l.level_id === 'default_retail')
  Object.assign(approveForm, {
    name: r.name || '',
    contact_name: r.contact_name || '',
    delivery_region_id: r.delivery_region_id ?? null,
    detail_address: r.detail_address || r.address || '',
    level_id: r.level_id ?? defaultLv?.id ?? null,
    tag_id: r.tag_id ?? null,
    sales_id: null,
    referrer_customer_id: r.referrer_customer_id ?? null,
  })
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
    const detail = approveForm.detail_address.trim()
    await adminCustomerApi.audit(target.value.id, {
      approved: true,
      level_id: approveForm.level_id,
      tag_id: approveForm.tag_id ?? null,
      sales_id: approveForm.sales_id ?? null,
      name: approveForm.name.trim() || undefined,
      contact_name: approveForm.contact_name.trim() || undefined,
      delivery_region_id: approveForm.delivery_region_id ?? undefined,
      detail_address: detail || undefined,
      address: !approveForm.delivery_region_id && detail ? detail : undefined,
      referrer_customer_id: approveForm.referrer_customer_id
        ? approveForm.referrer_customer_id
        : target.value.referrer_customer_id
          ? 0
          : undefined,
    })
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
  ;[levels.value, tags.value, salesList.value, activeCustomers.value] = await Promise.all([
    levelApi.list(),
    customerTagApi.list({ is_active: true }),
    adminCustomerApi.salesOptions(),
    adminCustomerApi.list({ status: 'active', page_size: 200 }),
  ])
  load()
})
</script>
