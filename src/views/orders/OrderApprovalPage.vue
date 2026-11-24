<template>
  <div class="page-container order-approval-page">
    <n-tabs v-model:value="activeTab" type="line">
      <n-tab-pane name="credit" tab="超额订单审批">
    <div class="card-section">
      <div class="page-header">
        <div>
          <h2 class="page-title">待审核订单</h2>
          <span class="result-count">共 {{ total }} 条待审批订单（超授信额度）</span>
        </div>
        <n-button :loading="loading" @click="load">刷新</n-button>
      </div>

      <div class="filter-grid">
        <div class="filter-item date-filter">
          <label>提交日期</label>
          <n-date-picker v-model:value="dateRange" type="daterange" clearable format="yyyy-MM-dd" />
        </div>
        <div class="filter-item">
          <label>客户</label>
          <n-select
            v-model:value="filters.customer_id"
            :options="customerOptions"
            clearable
            filterable
            placeholder="全部客户"
          />
        </div>
        <div class="filter-item">
          <label>归属销售</label>
          <n-select
            v-model:value="filters.sales_id"
            :options="salesOptions"
            clearable
            filterable
            placeholder="全部销售"
          />
        </div>
        <div class="filter-item">
          <label>排序方式</label>
          <n-select v-model:value="filters.order_by" :options="orderByOptions" />
        </div>
        <div class="filter-actions">
          <n-button @click="reset">重置</n-button>
          <n-button type="primary" :loading="loading" @click="search">查询</n-button>
        </div>
      </div>

      <n-data-table
        :columns="columns"
        :data="list"
        :loading="loading"
        :bordered="false"
        size="small"
        :row-key="(row: OrderApprovalItem) => row.order.id"
      />

      <div class="pagination-bar">
        <span>每页 {{ pageSize }} 条</span>
        <n-pagination
          v-model:page="page"
          :page-size="pageSize"
          :item-count="total"
          show-quick-jumper
          @update:page="load"
        />
      </div>
    </div>
      </n-tab-pane>

      <n-tab-pane name="price" tab="送达前改价审批">
        <div class="card-section">
          <div class="page-header">
            <div>
              <h2 class="page-title">送达前改价审批</h2>
              <span class="result-count">共 {{ adjustTotal }} 条改价申请</span>
            </div>
            <div class="header-tools">
              <n-radio-group v-model:value="adjustStatus" size="small" @update:value="searchAdjustments">
                <n-radio-button value="pending">待审批</n-radio-button>
                <n-radio-button value="all">全部</n-radio-button>
              </n-radio-group>
              <n-button :loading="adjustLoading" @click="loadAdjustments">刷新</n-button>
            </div>
          </div>

          <n-data-table
            :columns="adjustColumns"
            :data="adjustList"
            :loading="adjustLoading"
            :bordered="false"
            size="small"
            :row-key="(row: OrderPriceAdjustment) => row.id"
          />

          <div class="pagination-bar">
            <span>每页 {{ adjustPageSize }} 条</span>
            <n-pagination
              v-model:page="adjustPage"
              :page-size="adjustPageSize"
              :item-count="adjustTotal"
              show-quick-jumper
              @update:page="loadAdjustments"
            />
          </div>
        </div>
      </n-tab-pane>
    </n-tabs>

    <!-- 同意审批弹窗 -->
    <n-modal v-model:show="approveVisible" preset="card" title="同意超额订单" style="width: 480px; max-width: 95vw">
      <div v-if="activeItem" class="modal-form">
        <div class="summary-box">
          <div><strong>{{ activeItem.order.order_no }}</strong> · {{ activeItem.order.customer_name }}</div>
          <div class="summary-sub">
            本单金额：<strong>¥{{ money(activeItem.order.total_amount) }}</strong>
            　·　当前欠款：¥{{ money(activeItem.ar_balance) }}
            　·　生效额度：{{ activeItem.effective_credit !== null ? `¥${money(activeItem.effective_credit)}` : '不限额' }}
          </div>
        </div>
        <label class="field-label">
          <span>审批意见（选填）</span>
          <n-input
            v-model:value="approveComment"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            maxlength="200"
            show-count
            placeholder="例如：老客户信用良好，先发货月底结清"
          />
        </label>
        <div class="modal-actions">
          <n-button @click="approveVisible = false">取消</n-button>
          <n-button type="primary" :loading="submitting" @click="confirmApprove">确认同意</n-button>
        </div>
      </div>
    </n-modal>

    <!-- 驳回审批弹窗 -->
    <n-modal v-model:show="rejectVisible" preset="card" title="驳回超额订单" style="width: 480px; max-width: 95vw">
      <div v-if="activeItem" class="modal-form">
        <div class="summary-box warn">
          <div><strong>{{ activeItem.order.order_no }}</strong> · {{ activeItem.order.customer_name }}</div>
          <div class="summary-sub">
            本单金额：<strong>¥{{ money(activeItem.order.total_amount) }}</strong>
            　·　逾期金额：<span :class="{ danger: Number(activeItem.overdue_amount) > 0 }">¥{{ money(activeItem.overdue_amount) }}</span>
          </div>
        </div>
        <label class="field-label">
          <span>驳回原因（必填）</span>
          <n-input
            v-model:value="rejectReason"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 5 }"
            maxlength="200"
            show-count
            placeholder="请填写驳回原因，客户或录单销售将看到该原因"
          />
        </label>
        <div class="modal-actions">
          <n-button @click="rejectVisible = false">取消</n-button>
          <n-button type="error" :loading="submitting" @click="confirmReject">确认驳回</n-button>
        </div>
      </div>
    </n-modal>

    <!-- 订单详情与审批记录弹窗 -->
    <n-modal v-model:show="detailVisible" preset="card" title="待审核订单详情" style="width: 860px; max-width: 95vw">
      <template v-if="detailItem">
        <div class="detail-heading">
          <div class="detail-no">
            <span>{{ detailItem.order.order_no }}</span>
            <n-tag type="warning" size="small">待审批</n-tag>
            <n-tag size="small">{{ sourceLabel(detailItem.order.source) }}</n-tag>
          </div>
          <div class="detail-ops">
            <n-button type="error" secondary size="small" @click="openReject(detailItem)">驳回</n-button>
            <n-button type="primary" size="small" @click="openApprove(detailItem)">同意</n-button>
          </div>
        </div>

        <n-descriptions :column="3" bordered size="small">
          <n-descriptions-item label="客户">{{ detailItem.order.customer_name }} {{ detailItem.order.customer_phone || '' }}</n-descriptions-item>
          <n-descriptions-item label="归属销售">{{ detailItem.order.sales_name || '店家' }}</n-descriptions-item>
          <n-descriptions-item label="送货方式">{{ deliveryLabel(detailItem.order.delivery_mode) }}</n-descriptions-item>
          <n-descriptions-item label="本单金额"><strong>¥{{ money(detailItem.order.total_amount) }}</strong></n-descriptions-item>
          <n-descriptions-item label="当前欠款">¥{{ money(detailItem.ar_balance) }}</n-descriptions-item>
          <n-descriptions-item label="逾期金额">
            <span :class="{ danger: Number(detailItem.overdue_amount) > 0 }">¥{{ money(detailItem.overdue_amount) }}</span>
          </n-descriptions-item>
          <n-descriptions-item label="生效额度">
            {{ detailItem.effective_credit !== null ? `¥${money(detailItem.effective_credit)}` : '不限额' }}
          </n-descriptions-item>
          <n-descriptions-item label="提交时占用额度">
            {{ detailItem.occupied_credit !== null ? `¥${money(detailItem.occupied_credit)}` : '—' }}
          </n-descriptions-item>
          <n-descriptions-item label="提交时间">{{ formatDate(detailItem.submitted_at) }}（已等 {{ detailItem.waiting_hours }} 小时）</n-descriptions-item>
          <n-descriptions-item label="订单备注" :span="3">{{ detailItem.order.remark || '—' }}</n-descriptions-item>
        </n-descriptions>

        <h3 class="detail-title">商品明细</h3>
        <n-data-table :columns="itemColumns" :data="detailItem.order.items" :bordered="false" size="small" />

        <h3 class="detail-title">审批记录</h3>
        <n-data-table
          :columns="historyColumns"
          :data="approvalHistory"
          :loading="historyLoading"
          :bordered="false"
          size="small"
        />
      </template>
    </n-modal>

    <!-- 同意改价弹窗 -->
    <n-modal v-model:show="adjustApproveVisible" preset="card" title="同意送达前改价" style="width: 520px; max-width: 95vw">
      <div v-if="activeAdjustment" class="modal-form">
        <div class="summary-box">
          <div><strong>{{ activeAdjustment.order_no }}</strong> · {{ activeAdjustment.customer_name }}</div>
          <div class="summary-sub">
            申请人：{{ activeAdjustment.applicant_name || '—' }} · 金额
            ¥{{ money(activeAdjustment.total_before) }} →
            <strong>¥{{ money(activeAdjustment.total_after) }}</strong>
            （{{ diffText(activeAdjustment.total_diff_amount) }}）
          </div>
        </div>
        <label class="field-label">
          <span>审批意见（选填）</span>
          <n-input
            v-model:value="adjustApproveComment"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            maxlength="200"
            show-count
            placeholder="例如：客户要求按新价格执行"
          />
        </label>
        <div class="modal-actions">
          <n-button @click="adjustApproveVisible = false">取消</n-button>
          <n-button type="primary" :loading="adjustSubmitting" @click="confirmAdjustApprove">确认同意改价</n-button>
        </div>
      </div>
    </n-modal>

    <!-- 驳回改价弹窗 -->
    <n-modal v-model:show="adjustRejectVisible" preset="card" title="驳回送达前改价" style="width: 520px; max-width: 95vw">
      <div v-if="activeAdjustment" class="modal-form">
        <div class="summary-box warn">
          <div><strong>{{ activeAdjustment.order_no }}</strong> · {{ activeAdjustment.customer_name }}</div>
          <div class="summary-sub">申请人：{{ activeAdjustment.applicant_name || '—' }} · 申请原因：{{ activeAdjustment.reason || '—' }}</div>
        </div>
        <label class="field-label">
          <span>驳回原因（必填）</span>
          <n-input
            v-model:value="adjustRejectComment"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 5 }"
            maxlength="200"
            show-count
            placeholder="请填写驳回原因，申请人将看到该原因"
          />
        </label>
        <div class="modal-actions">
          <n-button @click="adjustRejectVisible = false">取消</n-button>
          <n-button type="error" :loading="adjustSubmitting" @click="confirmAdjustReject">确认驳回</n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NTag, useMessage, type DataTableColumns, type SelectOption } from 'naive-ui'
import dayjs from 'dayjs'
import { adminCustomerApi, fetchAllPages, orderApi } from '@/api'
import type { OrderApprovalItem, OrderApprovalRecord, OrderListItem, OrderPriceAdjustment, SalesOption } from '@/types'
import { ORDER_PRICE_ADJUSTMENT_STATUS, ORDER_SOURCE } from '@/utils/dict'
import { formatDate } from '@/utils/format'
import { actionBar, actionIcon } from '@/components/tableActions'

const router = useRouter()
const message = useMessage()

const list = ref<OrderApprovalItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const submitting = ref(false)

const dateRange = ref<[number, number] | null>(null)
const filters = reactive<{
  customer_id: number | null
  sales_id: number | null
  order_by: 'submitted_at' | 'total_amount'
}>({
  customer_id: null,
  sales_id: null,
  order_by: 'submitted_at',
})

const customerOptions = ref<SelectOption[]>([])
const salesOptions = ref<SelectOption[]>([])
const orderByOptions: SelectOption[] = [
  { label: '按等待时间（最久在前）', value: 'submitted_at' },
  { label: '按本单金额（最高在前）', value: 'total_amount' },
]

const approveVisible = ref(false)
const rejectVisible = ref(false)
const detailVisible = ref(false)
const activeItem = ref<OrderApprovalItem | null>(null)
const detailItem = ref<OrderApprovalItem | null>(null)
const approveComment = ref('')
const rejectReason = ref('')
const approvalHistory = ref<OrderApprovalRecord[]>([])
const historyLoading = ref(false)

// 送达前改价审批
const activeTab = ref('credit')
const adjustStatus = ref<'pending' | 'all'>('pending')
const adjustList = ref<OrderPriceAdjustment[]>([])
const adjustTotal = ref(0)
const adjustPage = ref(1)
const adjustPageSize = 20
const adjustLoading = ref(false)
const adjustLoaded = ref(false)
const adjustApproveVisible = ref(false)
const adjustRejectVisible = ref(false)
const activeAdjustment = ref<OrderPriceAdjustment | null>(null)
const adjustApproveComment = ref('')
const adjustRejectComment = ref('')
const adjustSubmitting = ref(false)

const DELIVERY_LABELS: Record<string, string> = {
  route: '跟车送',
  freight: '发物流',
  local: '城区自送',
  pickup: '到店自提',
}

const ACTION_LABELS: Record<string, { label: string; type: 'default' | 'info' | 'success' | 'error' | 'warning' }> = {
  submit: { label: '提交审批', type: 'warning' },
  approve: { label: '同意', type: 'success' },
  reject: { label: '驳回', type: 'error' },
  auto_pass: { label: '自动通过', type: 'info' },
  customer_cancel: { label: '客户取消', type: 'default' },
}

const money = (v: number | string | null | undefined) => Number(v || 0).toFixed(2)
const diffText = (v: number | string | null | undefined) => {
  const n = Number(v || 0)
  return n === 0 ? '无变化' : `${n > 0 ? '+' : '−'}¥${Math.abs(n).toFixed(2)}`
}
const sourceLabel = (src: string) => ORDER_SOURCE[src as keyof typeof ORDER_SOURCE] || src
const deliveryLabel = (mode: string) => DELIVERY_LABELS[mode] || mode

function overAmount(row: OrderApprovalItem): number {
  if (row.effective_credit === null) return 0
  const occupied = Number(row.occupied_credit ?? row.ar_balance ?? 0)
  const orderAmt = Number(row.order.total_amount || 0)
  const limit = Number(row.effective_credit || 0)
  return Math.max(0, occupied + orderAmt - limit)
}

const columns: DataTableColumns<OrderApprovalItem> = [
  {
    title: '订单号 / 来源',
    key: 'order_no',
    width: 175,
    render: (row) =>
      h('div', [
        h(
          NButton,
          { text: true, type: 'primary', onClick: () => openDetail(row) },
          { default: () => row.order.order_no }
        ),
        h('div', { class: 'muted-sub' }, `${sourceLabel(row.order.source)} · ${deliveryLabel(row.order.delivery_mode)}`),
      ]),
  },
  {
    title: '客户 / 归属销售',
    key: 'customer',
    minWidth: 150,
    render: (row) =>
      h('div', [
        h('div', { class: 'strong-txt' }, row.order.customer_name),
        h('div', { class: 'muted-sub' }, `销售：${row.order.sales_name || '店家'}`),
      ]),
  },
  {
    title: '本单金额',
    key: 'total_amount',
    width: 130,
    render: (row) => {
      if (row.amount_before !== null) {
        return h('div', [
          h('div', { class: 'muted-sub' }, `¥${money(row.amount_before)} →`),
          h('strong', `¥${money(row.order.total_amount)}`),
        ])
      }
      return h('strong', `¥${money(row.order.total_amount)}`)
    },
  },
  {
    title: '欠款 / 额度 / 占用',
    key: 'credit',
    minWidth: 195,
    render: (row) => {
      const over = overAmount(row)
      const limitText = row.effective_credit !== null ? `¥${money(row.effective_credit)}` : '不限额'
      const occupiedText = row.occupied_credit !== null ? `¥${money(row.occupied_credit)}` : '—'
      return h('div', { class: 'credit-cell' }, [
        h('div', `欠款 ¥${money(row.ar_balance)} · 额度 ${limitText}`),
        h(
          'div',
          { class: over > 0 ? 'danger' : 'muted-sub' },
          over > 0 ? `占用 ${occupiedText}（超 ¥${money(over)}）` : `占用 ${occupiedText}`
        ),
      ])
    },
  },
  {
    title: '逾期金额',
    key: 'overdue_amount',
    width: 110,
    render: (row) => {
      const amt = Number(row.overdue_amount || 0)
      return h('span', { class: amt > 0 ? 'danger' : 'muted-sub' }, amt > 0 ? `¥${money(amt)}` : '¥0.00')
    },
  },
  {
    title: '已等待',
    key: 'waiting_hours',
    width: 150,
    render: (row) =>
      h('div', [
        h(
          'div',
          { class: row.waiting_hours >= 24 ? 'danger' : 'strong-txt' },
          row.waiting_hours < 1 ? '不到 1 小时' : `${row.waiting_hours} 小时`
        ),
        h('div', { class: 'muted-sub' }, formatDate(row.submitted_at)),
      ]),
  },
  {
    title: '操作',
    key: 'actions',
    width: 155,
    render: (row) =>
      actionBar([
        h(
          NButton,
          { size: 'tiny', type: 'primary', onClick: () => openApprove(row) },
          { default: () => '同意' }
        ),
        h(
          NButton,
          { size: 'tiny', type: 'error', secondary: true, onClick: () => openReject(row) },
          { default: () => '驳回' }
        ),
        actionIcon({ icon: 'view', label: '查看详情', type: 'default', onClick: () => openDetail(row) }),
      ], { gap: 8 }),
  },
]

const itemColumns: DataTableColumns<OrderListItem['items'][number]> = [
  { title: '商品', key: 'spu_name' },
  { title: '规格', key: 'sku_spec' },
  { title: '数量', key: 'quantity', width: 90, render: (r) => `${r.quantity}${r.unit || ''}` },
  { title: '售价', key: 'unit_price', width: 100, render: (r) => `¥${money(r.unit_price)}` },
  { title: '金额', key: 'amount', width: 110, render: (r) => `¥${money(r.amount)}` },
]

const historyColumns: DataTableColumns<OrderApprovalRecord> = [
  { title: '时间', key: 'created_at', width: 165, render: (r) => formatDate(r.created_at) },
  {
    title: '动作',
    key: 'action',
    width: 100,
    render: (r) => {
      const meta = ACTION_LABELS[r.action] || { label: r.action, type: 'default' as const }
      return h(NTag, { type: meta.type, size: 'small' }, { default: () => meta.label })
    },
  },
  { title: '操作人', key: 'operator_name', width: 110, render: (r) => r.operator_name || '系统' },
  { title: '当时金额', key: 'order_amount', width: 110, render: (r) => `¥${money(r.order_amount)}` },
  { title: '说明 / 意见', key: 'comment', render: (r) => r.comment || '—' },
]

const openOrderDetail = (orderId: number) => router.push(`/order-center/detail/${orderId}`)

const adjustColumns: DataTableColumns<OrderPriceAdjustment> = [
  {
    title: '订单号',
    key: 'order_no',
    width: 170,
    render: (row) =>
      h('div', [
        h(
          NButton,
          { text: true, type: 'primary', onClick: () => openOrderDetail(row.order_id) },
          { default: () => row.order_no }
        ),
        h('div', { class: 'muted-sub' }, `申请于 ${formatDate(row.created_at)}`),
      ]),
  },
  {
    title: '客户 / 销售',
    key: 'customer',
    minWidth: 150,
    render: (row) =>
      h('div', [
        h('div', { class: 'strong-txt' }, row.customer_name),
        h('div', { class: 'muted-sub' }, `销售：${row.sales_name || '店家'}`),
      ]),
  },
  {
    title: '申请人',
    key: 'applicant',
    width: 110,
    render: (row) => row.applicant_name || '—',
  },
  {
    title: '改价明细',
    key: 'items',
    minWidth: 300,
    render: (row) =>
      h('div', { class: 'adjust-lines' }, [
        ...row.items.map((item) =>
          h('div', { class: 'adjust-line' }, [
            h('span', { class: 'adjust-name' }, `${item.spu_name}${item.sku_spec ? ` ${item.sku_spec}` : ''}`),
            h('span', { class: 'muted-sub' }, `×${item.quantity}${item.unit || ''}`),
            h('span', { class: 'adjust-price' }, `¥${money(item.old_unit_price)} → ¥${money(item.new_unit_price)}`),
            h('span', { class: Number(item.diff_amount) < 0 ? 'diff-down' : 'diff-up' }, diffText(item.diff_amount)),
          ])
        ),
        h('div', { class: 'adjust-total' }, [
          `合计 ¥${money(row.total_before)} → ¥${money(row.total_after)} `,
          h('span', { class: Number(row.total_diff_amount) < 0 ? 'diff-down' : 'diff-up' }, diffText(row.total_diff_amount)),
        ]),
      ]),
  },
  {
    title: '申请原因',
    key: 'reason',
    minWidth: 140,
    render: (row) => row.reason || '—',
  },
  {
    title: '已等待',
    key: 'waiting_hours',
    width: 110,
    render: (row) =>
      row.status === 'pending'
        ? h(
            'span',
            { class: row.waiting_hours >= 24 ? 'danger' : 'strong-txt' },
            row.waiting_hours < 1 ? '不到 1 小时' : `${row.waiting_hours} 小时`
          )
        : h('span', { class: 'muted-sub' }, row.reviewed_at ? formatDate(row.reviewed_at) : '—'),
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (row) => {
      const meta = ORDER_PRICE_ADJUSTMENT_STATUS[row.status]
      return h(NTag, { type: meta.type, size: 'small' }, { default: () => meta.label })
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 190,
    render: (row) =>
      actionBar(
        [
          row.status === 'pending'
            ? h(NButton, { size: 'tiny', type: 'primary', onClick: () => openAdjustApprove(row) }, { default: () => '同意改价' })
            : null,
          row.status === 'pending'
            ? h(NButton, { size: 'tiny', type: 'error', secondary: true, onClick: () => openAdjustReject(row) }, { default: () => '驳回' })
            : null,
          h(NButton, { size: 'tiny', onClick: () => openOrderDetail(row.order_id) }, { default: () => '查看订单' }),
        ],
        { gap: 8 }
      ),
  },
]

async function load() {
  loading.value = true
  try {
    const res = await orderApi.approvals({
      stage: 'admin',
      customer_id: filters.customer_id || undefined,
      sales_id: filters.sales_id || undefined,
      date_from: dateRange.value ? dayjs(dateRange.value[0]).format('YYYY-MM-DD') : undefined,
      date_to: dateRange.value ? dayjs(dateRange.value[1]).format('YYYY-MM-DD') : undefined,
      order_by: filters.order_by,
      page: page.value,
      page_size: pageSize,
    })
    list.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

function reset() {
  dateRange.value = null
  filters.customer_id = null
  filters.sales_id = null
  filters.order_by = 'submitted_at'
  search()
}

function openApprove(item: OrderApprovalItem) {
  activeItem.value = item
  approveComment.value = ''
  approveVisible.value = true
}

function openReject(item: OrderApprovalItem) {
  activeItem.value = item
  rejectReason.value = ''
  rejectVisible.value = true
}

async function openDetail(item: OrderApprovalItem) {
  detailItem.value = item
  detailVisible.value = true
  historyLoading.value = true
  try {
    approvalHistory.value = await orderApi.approvalHistory(item.order.id)
  } catch {
    approvalHistory.value = []
  } finally {
    historyLoading.value = false
  }
}

async function confirmApprove() {
  if (!activeItem.value) return
  submitting.value = true
  try {
    await orderApi.approve(activeItem.value.order.id, approveComment.value.trim() || undefined)
    message.success(`订单 ${activeItem.value.order.order_no} 已同意，进入待配送`)
    approveVisible.value = false
    detailVisible.value = false
    await load()
  } finally {
    submitting.value = false
  }
}

async function confirmReject() {
  if (!activeItem.value) return
  const reason = rejectReason.value.trim()
  if (!reason) {
    message.warning('请填写驳回原因')
    return
  }
  submitting.value = true
  try {
    await orderApi.reject(activeItem.value.order.id, reason)
    message.success(`订单 ${activeItem.value.order.order_no} 已驳回`)
    rejectVisible.value = false
    detailVisible.value = false
    await load()
  } finally {
    submitting.value = false
  }
}

async function loadAdjustments() {
  adjustLoading.value = true
  try {
    const res = await orderApi.listOrderPriceAdjustments({
      status: adjustStatus.value,
      page: adjustPage.value,
      page_size: adjustPageSize,
    })
    adjustList.value = res.items
    adjustTotal.value = res.total
    adjustLoaded.value = true
  } finally {
    adjustLoading.value = false
  }
}

function searchAdjustments() {
  adjustPage.value = 1
  void loadAdjustments()
}

function openAdjustApprove(row: OrderPriceAdjustment) {
  activeAdjustment.value = row
  adjustApproveComment.value = ''
  adjustApproveVisible.value = true
}

function openAdjustReject(row: OrderPriceAdjustment) {
  activeAdjustment.value = row
  adjustRejectComment.value = ''
  adjustRejectVisible.value = true
}

async function confirmAdjustApprove() {
  if (!activeAdjustment.value) return
  adjustSubmitting.value = true
  try {
    await orderApi.approveOrderPriceAdjustment(activeAdjustment.value.id, adjustApproveComment.value.trim() || null)
    message.success(`订单 ${activeAdjustment.value.order_no} 改价已同意`)
    adjustApproveVisible.value = false
    await loadAdjustments()
  } finally {
    adjustSubmitting.value = false
  }
}

async function confirmAdjustReject() {
  if (!activeAdjustment.value) return
  const comment = adjustRejectComment.value.trim()
  if (!comment) {
    message.warning('请填写驳回原因')
    return
  }
  adjustSubmitting.value = true
  try {
    await orderApi.rejectOrderPriceAdjustment(activeAdjustment.value.id, comment)
    message.success(`订单 ${activeAdjustment.value.order_no} 改价已驳回`)
    adjustRejectVisible.value = false
    await loadAdjustments()
  } finally {
    adjustSubmitting.value = false
  }
}

async function loadOptions() {
  try {
    const [customers, sales] = await Promise.all([
      fetchAllPages((p) => adminCustomerApi.list({ page: p, page_size: 100 })),
      adminCustomerApi.salesOptions(),
    ])
    customerOptions.value = customers.map((c) => ({
      label: c.phone ? `${c.name}（${c.phone}）` : c.name,
      value: c.id,
    }))
    salesOptions.value = (sales as SalesOption[]).map((s) => ({
      label: s.name,
      value: s.id,
    }))
  } catch {
    // 筛选下拉加载失败不阻塞主列表
  }
}

watch(activeTab, (tab) => {
  if (tab === 'price' && !adjustLoaded.value) void loadAdjustments()
})

onMounted(() => {
  loadOptions()
  load()
})
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.result-count {
  font-size: 13px;
  color: var(--text-muted, #64748b);
}

.filter-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 16px;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 180px;
}

.filter-item.date-filter {
  min-width: 260px;
}

.filter-item label {
  font-size: 12px;
  color: var(--text-muted, #64748b);
}

.filter-actions {
  display: flex;
  gap: 8px;
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  font-size: 13px;
  color: var(--text-muted, #64748b);
}

.strong-txt {
  font-weight: 600;
}

.muted-sub {
  font-size: 12px;
  color: var(--text-muted, #64748b);
}

.credit-cell {
  font-size: 13px;
  line-height: 1.45;
}

.danger {
  color: #dc2626;
  font-weight: 600;
}

.row-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.summary-box {
  background: var(--bg-soft, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.6;
}

.summary-box.warn {
  background: #fff7ed;
  border-color: #fed7aa;
}

.summary-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted, #64748b);
}

.field-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.detail-no {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}

.detail-ops {
  display: flex;
  gap: 8px;
}

.detail-title {
  margin: 16px 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.header-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.adjust-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12.5px;
}

.adjust-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
}

.adjust-name {
  font-weight: 600;
}

.adjust-price {
  color: var(--text-muted, #64748b);
}

.adjust-total {
  margin-top: 2px;
  padding-top: 4px;
  border-top: 1px dashed var(--border-color, #e2e8f0);
  font-size: 12px;
  color: var(--text-muted, #64748b);
}

.diff-down {
  color: #dc2626;
  font-weight: 600;
}

.diff-up {
  color: #15803d;
  font-weight: 600;
}
</style>
