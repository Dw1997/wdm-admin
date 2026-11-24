<template>
  <div class="vendor-tx-layout">
    <!-- 左侧：供应商列表（独立滚动） -->
    <aside class="vendor-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title">
          <span>供应商列表</span>
          <span class="sidebar-count">{{ filteredVendors.length }} 家</span>
        </div>
        <n-input
          v-model:value="vendorKeyword"
          size="small"
          clearable
          placeholder="搜索供应商名称 / 电话"
        />
        <n-select
          v-model:value="vendorTypeFilter"
          size="small"
          clearable
          :options="vendorTypeOptions"
          placeholder="全部类型"
          style="margin-top: 8px"
        />
      </div>

      <div class="sidebar-list">
        <n-spin :show="vendorLoading">
          <div v-if="!vendorLoading && filteredVendors.length === 0" class="empty-tip">
            暂无匹配的供应商
          </div>
          <div
            v-for="v in filteredVendors"
            :key="v.id"
            class="vendor-item"
            :class="{ active: vendorId === v.id }"
            @click="selectVendor(v.id)"
          >
            <div class="vendor-item-top">
              <span class="vendor-name" :title="v.name">{{ v.name }}</span>
              <n-tag size="tiny" :bordered="false" :type="vendorTypeTagType[v.type] || 'default'">
                {{ vendorTypeLabels[v.type] || v.type }}
              </n-tag>
            </div>
            <div class="vendor-item-sub">
              <span>{{ v.contact_name || '—' }}</span>
              <span>{{ v.phone || v.contact_phone || '无电话' }}</span>
            </div>
          </div>
        </n-spin>
      </div>
    </aside>

    <!-- 右侧：往来流水与两本账抵账（独立滚动） -->
    <main class="vendor-detail">
      <div v-if="!vendorId" class="empty-detail">
        <n-empty description="请在左侧选择一家供应商查看往来流水" />
      </div>

      <template v-else>
        <!-- 顶部固定工具栏 + 统计汇总 -->
        <div class="detail-header">
          <div class="detail-toolbar">
            <div class="detail-title">
              <span>{{ currentVendor?.name || account?.vendor_name || '供应商往来' }}</span>
              <n-tag v-if="account?.linked_customer_id" size="small" type="info" :bordered="false">
                已关联客户：{{ account.linked_customer_name }}
              </n-tag>
            </div>
            <n-space align="center" :size="8" wrap>
              <n-date-picker
                v-model:value="dateRange"
                type="daterange"
                size="small"
                clearable
                @update:value="resetPage"
              />
              <n-button size="small" @click="load">刷新</n-button>
              <n-button size="small" type="primary" @click="paymentVisible = true">登记付款</n-button>
              <n-button
                v-if="account?.linked_customer_id"
                size="small"
                type="info"
                :disabled="maxOffset <= 0"
                @click="openOffset"
              >
                两本账抵账
              </n-button>
            </n-space>
          </div>

          <div v-if="account" class="summary-grid">
            <div class="stat-card highlight">
              <div class="stat-label">当前应付（我欠他）</div>
              <div class="stat-value">¥{{ fmtMoney(account.payable_balance) }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">累计进货净额</div>
              <div class="stat-value">¥{{ fmtMoney(account.total_purchases) }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">累计付款</div>
              <div class="stat-value">¥{{ fmtMoney(account.total_payments) }}</div>
            </div>
            <template v-if="account.linked_customer_id">
              <div class="stat-card info">
                <div class="stat-label">关联客户应收（他欠我）</div>
                <div class="stat-value">¥{{ fmtMoney(account.customer_ar_balance) }}</div>
              </div>
              <div class="stat-card info">
                <div class="stat-label">当前可抵账上限</div>
                <div class="stat-value">¥{{ maxOffset.toFixed(2) }}</div>
              </div>
            </template>
          </div>
        </div>

        <!-- 下方独立滚动内容区 -->
        <div class="detail-body">
          <n-tabs v-model:value="activeTab" type="line">
            <n-tab-pane name="ledger" tab="应付往来流水">
              <n-data-table :columns="columns" :data="entries" :loading="loading" :bordered="false" />
              <n-pagination
                v-if="total > 20"
                v-model:page="page"
                :page-size="20"
                :item-count="total"
                class="pager"
                @update:page="load"
              />
            </n-tab-pane>
            <n-tab-pane v-if="account?.linked_customer_id" name="offsets" tab="两本账抵账记录">
              <n-data-table :columns="offsetColumns" :data="offsets" :loading="loading" :bordered="false" />
            </n-tab-pane>
          </n-tabs>
        </div>
      </template>
    </main>

    <!-- 登记付款弹窗 -->
    <n-modal v-model:show="paymentVisible" preset="card" title="登记供应商付款" style="width: 420px">
      <n-space vertical>
        <n-input v-model:value="amount" placeholder="付款金额" />
        <n-select v-model:value="method" :options="methods" />
        <n-date-picker v-model:value="paymentTime" type="datetime" clearable placeholder="付款时间，默认现在" />
        <n-input v-model:value="remark" placeholder="备注（可选）" />
        <n-button type="primary" :loading="saving" @click="pay">确认付款</n-button>
      </n-space>
    </n-modal>

    <!-- 两本账抵账弹窗 -->
    <n-modal v-model:show="offsetVisible" preset="card" title="发起两本账抵账（应收应付互抵）" style="width: 460px">
      <n-space vertical v-if="account">
        <div>供应商：<strong>{{ account.vendor_name }}</strong>（应付 ¥{{ fmtMoney(account.payable_balance) }}）</div>
        <div>关联客户：<strong>{{ account.linked_customer_name }}</strong>（应收 ¥{{ fmtMoney(account.customer_ar_balance) }}）</div>
        <div>可抵账上限：<strong>¥{{ maxOffset.toFixed(2) }}</strong></div>
        <n-input v-model:value="offsetAmount" placeholder="抵账金额" />
        <n-input v-model:value="offsetRemark" placeholder="抵账说明（可选）" />
        <n-space justify="end">
          <n-button @click="offsetVisible = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="submitOffset">确认抵账</n-button>
        </n-space>
      </n-space>
    </n-modal>

    <!-- 撤销抵账弹窗 -->
    <n-modal v-model:show="reverseVisible" preset="card" title="撤销两本账抵账" style="width: 420px">
      <n-space vertical>
        <n-input v-model:value="reverseReason" placeholder="请输入撤销原因（必填）" />
        <n-space justify="end">
          <n-button @click="reverseVisible = false">取消</n-button>
          <n-button type="error" :loading="saving" @click="submitReverse">确认撤销</n-button>
        </n-space>
      </n-space>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { NButton, NTag, type DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import { fetchAllPages, vendorApi } from '@/api'
import type { LedgerOffset, Vendor, VendorAccount, VendorLedgerEntry } from '@/types'

const message = useMessage()

const vendors = ref<Vendor[]>([])
const vendorLoading = ref(false)
const vendorKeyword = ref('')
const vendorTypeFilter = ref<string | null>(null)
const vendorId = ref<number | null>(null)

const account = ref<VendorAccount | null>(null)
const dateRange = ref<[number, number] | null>(null)
const activeTab = ref<'ledger' | 'offsets'>('ledger')
const entries = ref<VendorLedgerEntry[]>([])
const offsets = ref<LedgerOffset[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)

const paymentVisible = ref(false)
const offsetVisible = ref(false)
const reverseVisible = ref(false)
const reverseTargetId = ref<number | null>(null)
const reverseReason = ref('')
const saving = ref(false)
const amount = ref('')
const method = ref('cash')
const paymentTime = ref<number | null>(null)
const remark = ref('')
const offsetAmount = ref('')
const offsetRemark = ref('')

const vendorTypeOptions = [
  { label: '市场店家', value: 'market' },
  { label: '产地', value: 'origin' },
  { label: '厂家', value: 'manufacturer' },
]
const vendorTypeLabels: Record<string, string> = {
  market: '市场店家',
  origin: '产地',
  manufacturer: '厂家',
}
const vendorTypeTagType: Record<string, 'info' | 'success' | 'warning'> = {
  market: 'info',
  origin: 'success',
  manufacturer: 'warning',
}

const filteredVendors = computed(() => {
  const kw = vendorKeyword.value.trim().toLowerCase()
  return vendors.value.filter((v) => {
    if (vendorTypeFilter.value && v.type !== vendorTypeFilter.value) return false
    if (!kw) return true
    return (
      v.name.toLowerCase().includes(kw) ||
      (v.phone || '').includes(kw) ||
      (v.contact_name || '').toLowerCase().includes(kw) ||
      (v.contact_phone || '').includes(kw)
    )
  })
})

const currentVendor = computed(() => vendors.value.find((v) => v.id === vendorId.value) || null)

const maxOffset = computed(() => {
  if (!account.value || !account.value.linked_customer_id) return 0
  const ap = Number(account.value.payable_balance || 0)
  const ar = Number(account.value.customer_ar_balance || 0)
  return Math.max(0, Math.min(ap, ar))
})

function fmtMoney(v: string | number | null | undefined) {
  return Number(v || 0).toFixed(2)
}

const methods = [
  { label: '现金', value: 'cash' },
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '其他', value: 'other' },
]

const labels: Record<string, string> = {
  purchase: '进货应付',
  payment: '付款',
  purchase_return: '退回供应商',
  offset: '两本账抵账',
  correction_reversal: '更正冲回',
  correction_new: '更正应付',
}

const columns: DataTableColumns<VendorLedgerEntry> = [
  { title: '入账时间', key: 'occurred_at', width: 165, render: (row) => new Date(row.occurred_at).toLocaleString('zh-CN') },
  { title: '类型', key: 'type', width: 110, render: (row) => labels[row.type] || row.type },
  { title: '采购单', key: 'purchase_receipt_id', width: 85, render: (row) => (row.purchase_receipt_id ? `#${row.purchase_receipt_id}` : '—') },
  { title: '订单', key: 'order_id', width: 85, render: (row) => (row.order_id ? `#${row.order_id}` : '—') },
  {
    title: '变动金额',
    key: 'amount',
    width: 115,
    render: (row) => {
      const n = Number(row.amount)
      return h(
        'span',
        { style: n >= 0 ? 'color: #dc2626; font-weight: 500' : 'color: #16a34a; font-weight: 500' },
        `${n > 0 ? '+' : ''}¥${n.toFixed(2)}`,
      )
    },
  },
  { title: '变动后余额', key: 'balance_after', width: 115, render: (row) => `¥${Number(row.balance_after).toFixed(2)}` },
  { title: '操作人', key: 'operator_name', width: 100, render: (row) => row.operator_name || '—' },
  { title: '备注', key: 'remark', minWidth: 140, render: (row) => row.remark || '—' },
]

const offsetColumns: DataTableColumns<LedgerOffset> = [
  { title: '时间', key: 'occurred_at', width: 165, render: (row) => new Date(row.occurred_at).toLocaleString('zh-CN') },
  { title: '客户', key: 'customer_name', width: 140 },
  { title: '抵账金额', key: 'amount', width: 115, render: (row) => `¥${Number(row.amount).toFixed(2)}` },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (row) => {
      if (row.reversed_offset_id) return h(NTag, { size: 'small', type: 'warning' }, { default: () => `撤销#${row.reversed_offset_id}` })
      if (row.is_reversed) return h(NTag, { size: 'small', type: 'default' }, { default: () => '已撤销' })
      return h(NTag, { size: 'small', type: 'success' }, { default: () => '有效' })
    },
  },
  { title: '操作人', key: 'operator_name', width: 90 },
  { title: '备注', key: 'remark', render: (row) => row.remark || '—' },
  {
    title: '操作',
    key: 'action',
    width: 85,
    render: (row) =>
      !row.reversed_offset_id && !row.is_reversed
        ? h(NButton, { text: true, type: 'error', onClick: () => openReverse(row.id) }, { default: () => '撤销' })
        : '—',
  },
]

function selectVendor(id: number) {
  if (vendorId.value === id) return
  vendorId.value = id
  activeTab.value = 'ledger'
  page.value = 1
  void load()
}

function resetPage() {
  page.value = 1
  void load()
}

async function load() {
  if (!vendorId.value) {
    account.value = null
    entries.value = []
    offsets.value = []
    return
  }
  loading.value = true
  try {
    const [accountData, pageData, offsetData] = await Promise.all([
      vendorApi.account(vendorId.value),
      vendorApi.ledger(vendorId.value, {
        page: page.value,
        page_size: 20,
        date_from: dateRange.value ? dayjs(dateRange.value[0]).format('YYYY-MM-DD') : undefined,
        date_to: dateRange.value ? dayjs(dateRange.value[1]).format('YYYY-MM-DD') : undefined,
      }),
      vendorApi.listOffsets({ vendor_id: vendorId.value, page: 1, page_size: 50 }),
    ])
    account.value = accountData
    entries.value = pageData.items
    total.value = pageData.total
    offsets.value = offsetData.items
  } finally {
    loading.value = false
  }
}

async function pay() {
  if (!vendorId.value || !/^\d+(?:\.\d{1,2})?$/.test(amount.value) || Number(amount.value) <= 0) {
    message.warning('请填写有效付款金额')
    return
  }
  saving.value = true
  try {
    await vendorApi.pay({
      vendor_id: vendorId.value,
      amount: amount.value,
      method: method.value,
      paid_at: paymentTime.value ? new Date(paymentTime.value).toISOString() : undefined,
      remark: remark.value,
    })
    paymentVisible.value = false
    amount.value = ''
    remark.value = ''
    paymentTime.value = null
    await load()
    message.success('付款已登记')
  } finally {
    saving.value = false
  }
}

function openOffset() {
  offsetAmount.value = maxOffset.value.toFixed(2)
  offsetRemark.value = ''
  offsetVisible.value = true
}

async function submitOffset() {
  if (!account.value?.linked_customer_id || !vendorId.value) return
  if (!/^\d+(?:\.\d{1,2})?$/.test(offsetAmount.value) || Number(offsetAmount.value) <= 0) {
    message.warning('请填写有效抵账金额')
    return
  }
  saving.value = true
  try {
    await vendorApi.createOffset({
      customer_id: account.value.linked_customer_id,
      vendor_id: vendorId.value,
      amount: offsetAmount.value,
      remark: offsetRemark.value.trim() || undefined,
    })
    offsetVisible.value = false
    message.success('两本账抵账成功')
    await load()
  } finally {
    saving.value = false
  }
}

function openReverse(id: number) {
  reverseTargetId.value = id
  reverseReason.value = ''
  reverseVisible.value = true
}

async function submitReverse() {
  if (!reverseTargetId.value || !reverseReason.value.trim()) {
    message.warning('请填写撤销原因')
    return
  }
  saving.value = true
  try {
    await vendorApi.reverseOffset(reverseTargetId.value, reverseReason.value.trim())
    reverseVisible.value = false
    message.success('抵账已撤销')
    await load()
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  vendorLoading.value = true
  try {
    vendors.value = await fetchAllPages<Vendor>((p) => vendorApi.list({ page: p, page_size: 50 }))
    if (vendors.value.length > 0 && !vendorId.value) {
      vendorId.value = vendors.value[0].id
      await load()
    }
  } finally {
    vendorLoading.value = false
  }
})
</script>

<style scoped>
.vendor-tx-layout {
  display: flex;
  gap: 16px;
  height: calc(100vh - 96px);
  min-height: 520px;
  overflow: hidden;
}

.vendor-sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 10px;
  overflow: hidden;
}

.sidebar-header {
  flex-shrink: 0;
  padding: 14px;
  border-bottom: 1px solid var(--border, #e5e7eb);
}

.sidebar-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
}

.sidebar-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3, #9ca3af);
}

.sidebar-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}

.empty-tip {
  padding: 32px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--text-3, #9ca3af);
}

.vendor-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  margin-bottom: 4px;
}

.vendor-item:hover {
  background: rgba(79, 70, 229, 0.06);
}

.vendor-item.active {
  background: rgba(79, 70, 229, 0.1);
  border-left-color: #4f46e5;
}

.vendor-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.vendor-name {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vendor-item-sub {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-3, #9ca3af);
}

.vendor-detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 10px;
  overflow: hidden;
}

.empty-detail {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-header {
  flex-shrink: 0;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--border, #e5e7eb);
}

.detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.detail-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
}

.summary-grid {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 14px;
}

.stat-card {
  min-width: 150px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--bg-subtle, #f8fafc);
  border: 1px solid var(--border, #e5e7eb);
}

.stat-card.highlight {
  background: rgba(220, 38, 38, 0.05);
  border-color: rgba(220, 38, 38, 0.2);
}

.stat-card.info {
  background: rgba(79, 70, 229, 0.05);
  border-color: rgba(79, 70, 229, 0.2);
}

.stat-label {
  font-size: 12px;
  color: var(--text-3, #6b7280);
}

.stat-value {
  margin-top: 4px;
  font-size: 20px;
  font-weight: 600;
}

.detail-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 20px 20px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
