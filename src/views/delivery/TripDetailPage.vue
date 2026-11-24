<template>
  <div class="page-container trip-detail-page">
    <div class="page-header">
      <div>
        <n-button text type="primary" class="back-link" @click="router.push('/delivery/trips')">← 返回出车列表</n-button>
        <div class="title-row">
          <h2 class="page-title">{{ trip ? `${formatDate(trip.trip_date, 'M月D日')} ${trip.name || '未命名出车'}` : '出车详情' }}</h2>
          <n-tag v-if="trip" :type="statusMeta(trip.status).type" :bordered="false">{{ statusMeta(trip.status).label }}</n-tag>
          <n-tag v-if="trip?.auto_generated" size="small" type="info" :bordered="false">自动排车</n-tag>
        </div>
        <p v-if="trip" class="subtitle">
          负责人 {{ trip.owner_name }} · {{ trip.stops_text || '—' }} · 创建于 {{ formatDate(trip.created_at) }}
        </p>
      </div>
      <div class="header-actions">
        <n-button v-if="trip?.status === 'planned'" @click="router.push(`/delivery/trips/${tripId}/edit`)">编辑出车</n-button>
        <n-button v-if="trip?.status === 'planned'" type="primary" :loading="actionLoading" @click="onDepart">出车</n-button>
        <n-button v-if="trip?.status === 'delivering'" type="primary" :loading="actionLoading" @click="onFinish">收车</n-button>
        <n-button v-if="trip?.status === 'planned'" type="error" ghost @click="onCancel">取消出车</n-button>
        <n-button @click="openTemplate">存为常用路线</n-button>
        <n-button disabled title="打印中心尚未接入">打印全部送货单</n-button>
      </div>
    </div>

    <n-alert v-if="loadError" type="error" :bordered="false" class="block-alert">
      出车详情加载失败：{{ loadError }}
      <n-button text type="primary" size="small" style="margin-left: 8px" @click="reloadAll">重试</n-button>
    </n-alert>

    <n-spin :show="loading">
      <template v-if="trip">
        <div class="stats-grid">
          <div class="card-section stat-card">
            <div class="stat-label">询单进度</div>
            <div class="stat-value">{{ trip.called_count }} / {{ trip.customer_count }}</div>
            <n-progress type="line" :percentage="calledPercent" :show-indicator="false" :height="5" />
          </div>
          <div class="card-section stat-card">
            <div class="stat-label">本趟订单</div>
            <div class="stat-value">{{ trip.order_count }} 单</div>
            <div class="stat-sub">{{ formatMoney(trip.order_amount) }}</div>
          </div>
          <div class="card-section stat-card">
            <div class="stat-label">送达情况</div>
            <div class="stat-value">{{ deliveredCount }} / {{ activeOrderCount }}</div>
            <div class="stat-sub">已送达 / 未取消订单</div>
          </div>
          <div class="card-section stat-card">
            <div class="stat-label">负责人</div>
            <div class="stat-value">{{ trip.owner_name }}</div>
            <div class="stat-sub">经过 {{ trip.stops.length }} 个地点</div>
          </div>
        </div>

        <div class="card-section tabs-card">
          <n-tabs v-model:value="tab" type="line" @update:value="onTabChange">
            <n-tab-pane name="calls" :tab="`询单清单（${calls.length}）`">
              <div class="filter-bar">
                <n-select v-model:value="callResultFilter" :options="callResultOptions" style="width: 150px" />
                <n-input v-model:value="callKeyword" clearable placeholder="客户名称 / 联系人 / 手机号" style="width: 240px" />
                <n-button @click="loadCalls">刷新</n-button>
                <span class="mini">按站点顺序分组；其他趟次已有订单的客户排在最后</span>
              </div>
              <template v-if="callGroups.length">
                <div v-for="group in callGroups" :key="group.seq" class="call-group">
                  <div class="call-group-head">
                    <b>#{{ group.seq }} {{ group.regionName }}</b>
                    <span>{{ group.all.length }} 位客户 · 已询 {{ group.called }}</span>
                  </div>
                  <n-data-table :columns="callColumns" :data="group.items" :bordered="false" size="small" :row-key="(row: CallListCustomer) => row.customer_id" />
                </div>
              </template>
              <n-empty v-else description="本趟没有客户，请检查经过地点" style="padding: 40px 0" />
            </n-tab-pane>

            <n-tab-pane name="orders" :tab="`订单 / 送达（${orders.length}）`">
              <div class="filter-bar">
                <n-select v-model:value="orderStatusFilter" :options="orderStatusOptions" style="width: 140px" />
                <n-input v-model:value="orderKeyword" clearable placeholder="订单号 / 客户 / 手机号" style="width: 220px" />
                <n-checkbox v-model:checked="onlyPending">只看未处理</n-checkbox>
                <n-button @click="loadOrders">刷新</n-button>
              </div>
              <n-data-table :columns="orderColumns" :data="filteredOrders" :bordered="false" size="small" :row-key="(row: RouteTripOrder) => row.order_id" />
              <n-empty v-if="!filteredOrders.length" description="还没有订单" style="padding: 32px 0" />
            </n-tab-pane>

            <n-tab-pane name="summary" tab="出车汇总">
              <div class="filter-bar">
                <n-input v-model:value="summaryKeyword" clearable placeholder="商品名称 / 规格" style="width: 240px" />
                <n-button :loading="summaryLoading" @click="loadSummary">刷新</n-button>
                <n-button disabled title="打印中心尚未接入">打印出车汇总单</n-button>
              </div>
              <n-data-table :columns="summaryColumns" :data="filteredSummary" :loading="summaryLoading" :bordered="false" size="small" :row-key="(row: SummaryRow) => row.key" />
            </n-tab-pane>
          </n-tabs>
        </div>
      </template>
    </n-spin>

    <n-modal v-model:show="orderVisible" preset="card" title="订单详情" style="width: 820px; max-width: 95vw">
      <template v-if="selectedOrder">
        <n-alert v-if="selectedOrder.pending_price_adjustment" type="warning" :bordered="false" style="margin-bottom: 12px">
          该订单有送达前改价待审批（申请人：{{ selectedOrder.pending_price_adjustment.applicant_name || '—' }}），处理完成前不能送达。
        </n-alert>
        <n-descriptions :column="2" bordered size="small">
          <n-descriptions-item label="订单号">{{ selectedOrder.order_no }}</n-descriptions-item>
          <n-descriptions-item label="客户">{{ selectedOrder.customer_name }}</n-descriptions-item>
          <n-descriptions-item label="销售">{{ selectedOrder.sales_name || '—' }}</n-descriptions-item>
          <n-descriptions-item label="状态">{{ orderStatusLabel(selectedOrder.status) }}</n-descriptions-item>
          <n-descriptions-item label="下单金额">{{ formatMoney(selectedOrder.total_amount) }}</n-descriptions-item>
          <n-descriptions-item label="实送金额">{{ selectedOrder.delivered_amount != null ? formatMoney(selectedOrder.delivered_amount) : '—' }}</n-descriptions-item>
          <n-descriptions-item v-if="selectedOrder.dispatch_note" label="调度备注" :span="2">{{ selectedOrder.dispatch_note }}</n-descriptions-item>
        </n-descriptions>
        <n-data-table :columns="orderItemColumns" :data="selectedOrder.items" :bordered="false" size="small" style="margin-top: 14px" />
      </template>
    </n-modal>

    <n-modal v-model:show="deliverVisible" preset="card" title="确认送达" style="width: 680px; max-width: 95vw">
      <template v-if="deliverOrder">
        <p class="modal-note">实送数量默认等于下单数量，可以改小，不能超过下单数量。</p>
        <n-data-table :columns="deliverColumns" :data="deliverRows" :bordered="false" size="small" />
        <n-alert v-if="allDeliveredZero" type="error" :bordered="false" style="margin-top: 12px">
          全部实送为 0，提交后将按整单拒收直接取消订单。
        </n-alert>
        <div v-if="allDeliveredZero" class="cancel-reason">
          <span>拒收原因（选填）</span>
          <n-input v-model:value="cancelReason" type="textarea" :rows="2" placeholder="如：客户临时不要货" />
        </div>
      </template>
      <template #footer>
        <n-button @click="deliverVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="saveDeliver">{{ allDeliveredZero ? '确认拒收' : '确认送达' }}</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="rescheduleVisible" preset="card" title="退回 / 改挂" style="width: 540px; max-width: 95vw">
      <n-form label-placement="top">
        <n-form-item label="目标">
          <n-radio-group v-model:value="rescheduleForm.target">
            <n-radio-button value="pool">退回待排车</n-radio-button>
            <n-radio-button value="trip">挂到其他趟次</n-radio-button>
            <n-radio-button value="freight">改发物流</n-radio-button>
          </n-radio-group>
        </n-form-item>
        <n-form-item v-if="rescheduleForm.target === 'trip'" label="目标趟次">
          <n-select v-model:value="rescheduleForm.trip_id" :options="tripOptions" filterable placeholder="选择 planned 趟次" />
        </n-form-item>
        <n-form-item v-if="rescheduleForm.target === 'freight'" label="物流线路">
          <n-select v-model:value="rescheduleForm.freight_line_id" :options="freightLineOptions" filterable clearable placeholder="按客户送货乡镇匹配" />
        </n-form-item>
        <n-form-item label="原因">
          <n-input v-model:value="rescheduleForm.reason" type="textarea" :rows="2" placeholder="选填，写审计" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="rescheduleVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="saveReschedule">确认</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="templateVisible" preset="card" title="存为常用路线" style="width: 480px">
      <n-form label-placement="left" label-width="80">
        <n-form-item label="名称" required><n-input v-model:value="templateForm.name" maxlength="100" /></n-form-item>
        <n-form-item label="备注"><n-input v-model:value="templateForm.remark" type="textarea" :rows="2" /></n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="templateVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="saveTemplate">保存</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton, NDropdown, NInput, NProgress, NTag,
  useDialog, useMessage,
  type DataTableColumns, type SelectOption,
} from 'naive-ui'
import dayjs from 'dayjs'
import { deliveryApi, orderApi, routeTripApi } from '@/api'
import { CALL_RESULT, ROUTE_TRIP_STATUS } from '@/utils/dict'
import { confirmAction } from '@/utils/confirm'
import { formatDate, formatMoney } from '@/utils/format'
import { actionBar, actionIcon } from '@/components/tableActions'
import type {
  CallListCustomer, CallResult, OrderListItem, RouteTrip, RouteTripOrder,
} from '@/types'

interface SummaryRow {
  key: string
  spuName: string
  skuSpec: string
  unit: string
  ordered: number
  delivered: number
}

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const tripId = computed(() => Number(route.params.id))

const trip = ref<RouteTrip | null>(null)
const orders = ref<RouteTripOrder[]>([])
const calls = ref<CallListCustomer[]>([])
const loading = ref(false)
const loadError = ref('')
const actionLoading = ref(false)
const saving = ref(false)
const tab = ref('calls')

const callResultFilter = ref<'all' | CallResult>('all')
const callKeyword = ref('')
const orderStatusFilter = ref('all')
const orderKeyword = ref('')
const onlyPending = ref(false)
const summaryKeyword = ref('')
const summaryLoading = ref(false)
const orderDetails = ref<Record<number, OrderListItem>>({})

const orderVisible = ref(false)
const selectedOrder = ref<OrderListItem | null>(null)
const deliverVisible = ref(false)
const deliverOrder = ref<OrderListItem | null>(null)
const deliverRows = ref<{ order_item_id: number; name: string; unit: string; ordered: number; delivered: number | null }[]>([])
const cancelReason = ref('')
const rescheduleVisible = ref(false)
const rescheduleOrder = ref<OrderListItem | null>(null)
const rescheduleForm = reactive<{ target: 'pool' | 'trip' | 'freight'; trip_id: number | null; freight_line_id: number | null; reason: string }>({ target: 'pool', trip_id: null, freight_line_id: null, reason: '' })
const tripOptions = ref<SelectOption[]>([])
const freightLineOptions = ref<SelectOption[]>([])
const templateVisible = ref(false)
const templateForm = reactive({ name: '', remark: '' })

const callResultOptions = [
  { label: '全部结果', value: 'all' },
  ...(Object.keys(CALL_RESULT) as CallResult[]).map((value) => ({ label: CALL_RESULT[value].label, value })),
]
const orderStatusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '待配送', value: 'pending' },
  { label: '配送中', value: 'delivering' },
  { label: '已送达', value: 'delivered' },
  { label: '已取消', value: 'cancelled' },
]

const calledPercent = computed(() => {
  if (!trip.value || !trip.value.customer_count) return 0
  return Math.min(100, Math.round((trip.value.called_count / trip.value.customer_count) * 100))
})
const activeOrderCount = computed(() => orders.value.filter((order) => order.status !== 'cancelled').length)
const deliveredCount = computed(() => orders.value.filter((order) => order.status === 'delivered').length)
const allDeliveredZero = computed(() => deliverRows.value.length > 0 && deliverRows.value.every((row) => row.delivered != null && Number(row.delivered) === 0))

const filteredCalls = computed(() => calls.value.filter((row) => {
  if (callResultFilter.value !== 'all' && row.call_result !== callResultFilter.value) return false
  const keyword = callKeyword.value.trim().toLowerCase()
  if (!keyword) return true
  return [row.customer_name, row.customer_phone || '', row.region_name].some((value) => value.toLowerCase().includes(keyword))
}))
const callGroups = computed(() => {
  const groups: { seq: number; regionName: string; items: CallListCustomer[]; all: CallListCustomer[]; called: number }[] = []
  const map = new Map<number, (typeof groups)[number]>()
  for (const row of calls.value) {
    let group = map.get(row.stop_seq)
    if (!group) {
      group = { seq: row.stop_seq, regionName: row.region_name, items: [], all: [], called: 0 }
      map.set(row.stop_seq, group)
      groups.push(group)
    }
    group.all.push(row)
    if (row.call_result !== 'none' || row.trip_order_ids.length) group.called += 1
  }
  for (const row of filteredCalls.value) {
    const group = map.get(row.stop_seq)
    if (group) group.items.push(row)
  }
  return groups.filter((group) => group.items.length).sort((a, b) => a.seq - b.seq)
})

const filteredOrders = computed(() => orders.value.filter((order) => {
  if (orderStatusFilter.value !== 'all' && order.status !== orderStatusFilter.value) return false
  if (onlyPending.value && !['pending', 'delivering'].includes(order.status)) return false
  const keyword = orderKeyword.value.trim().toLowerCase()
  if (!keyword) return true
  return [order.order_no, order.customer_name, order.customer_phone || ''].some((value) => value.toLowerCase().includes(keyword))
}))

const summaryRows = computed<SummaryRow[]>(() => {
  const map = new Map<string, SummaryRow>()
  for (const order of Object.values(orderDetails.value)) {
    if (order.status === 'cancelled') continue
    for (const item of order.items) {
      const key = `${item.spu_name}|${item.sku_spec}|${item.unit}`
      const row = map.get(key) || { key, spuName: item.spu_name, skuSpec: item.sku_spec, unit: item.unit, ordered: 0, delivered: 0 }
      row.ordered += Number(item.quantity) || 0
      row.delivered += Number(item.delivered_quantity || 0)
      map.set(key, row)
    }
  }
  return Array.from(map.values()).sort((a, b) => a.spuName.localeCompare(b.spuName))
})
const filteredSummary = computed(() => {
  const keyword = summaryKeyword.value.trim().toLowerCase()
  if (!keyword) return summaryRows.value
  return summaryRows.value.filter((row) => `${row.spuName} ${row.skuSpec}`.toLowerCase().includes(keyword))
})

function statusMeta(status: RouteTrip['status']) {
  return ROUTE_TRIP_STATUS[status]
}

function orderStatusLabel(status: string) {
  return ({ pending: '待配送', delivering: '配送中', delivered: '已送达', cancelled: '已取消', pending_approval: '待审批', rejected: '已驳回' } as Record<string, string>)[status] || status
}

function resultMeta(result: CallResult) {
  return CALL_RESULT[result]
}

function copyPhone(phone: string | null) {
  if (!phone) return
  navigator.clipboard?.writeText(phone).then(() => message.success('电话已复制')).catch(() => message.warning('复制失败'))
}

const callColumns: DataTableColumns<CallListCustomer> = [
  {
    title: '客户 / 联系人', key: 'customer_name', minWidth: 150,
    render: (row) => h('div', [
      h('b', row.customer_name),
      row.customer_phone ? h('div', { class: 'muted' }, row.customer_phone) : null,
    ]),
  },
  {
    title: '电话', key: 'phone', width: 140,
    render: (row) => row.customer_phone
      ? h('div', { class: 'phone-cell' }, [
          h('a', { href: `tel:${row.customer_phone}` }, row.customer_phone),
          h(NButton, { text: true, size: 'tiny', type: 'primary', onClick: () => copyPhone(row.customer_phone) }, { default: () => '复制' }),
        ])
      : '—',
  },
  { title: '归属销售', key: 'sales_name', width: 100, render: (row) => row.sales_name || '—' },
  { title: '上次下单', key: 'last_order_date', width: 110, render: (row) => row.last_order_date ? formatDate(row.last_order_date, 'YYYY-MM-DD') : '—' },
  {
    title: '当前欠款', key: 'ar_balance', width: 110,
    render: (row) => h('span', { style: Number(row.ar_balance) > 0 ? 'color: var(--danger)' : '' }, formatMoney(row.ar_balance)),
  },
  {
    title: '询单状态', key: 'call_result', width: 100,
    render: (row) => h(NTag, { size: 'small', type: resultMeta(row.call_result).type, bordered: false }, { default: () => resultMeta(row.call_result).label }),
  },
  {
    title: '已有订单', key: 'orders', width: 150,
    render: (row) => {
      if (row.trip_order_ids.length) return h(NTag, { size: 'small', type: 'success', bordered: false }, { default: () => `本趟 ${row.trip_order_ids.length} 单` })
      if (row.other_trip_order) return h(NTag, { size: 'small', type: 'info', bordered: false }, { default: () => `已有 ${formatDate(row.other_trip_order!.trip_date, 'M月D日')} 订单` })
      return '—'
    },
  },
  {
    title: '操作', key: 'actions', width: 160,
    render: (row) => h('div', { class: 'row-actions' }, [
      h(NButton, { text: true, size: 'small', type: 'primary', onClick: () => goRecord(row) }, { default: () => '录单' }),
      h(NDropdown, {
        options: [
          { label: '本次不要', key: 'declined' },
          { label: '未接通', key: 'unreachable' },
          { label: '恢复未询', key: 'none' },
        ],
        onSelect: (key: string | number) => markCall(row, String(key) as Exclude<CallResult, 'ordered'>),
        trigger: 'click',
      }, {
        default: () => h(NButton, {
          text: true, size: 'small', type: 'primary',
          disabled: row.call_result === 'ordered' || trip.value?.status !== 'planned',
        }, { default: () => '标记' }),
      }),
    ]),
  },
]

const orderColumns: DataTableColumns<RouteTripOrder> = [
  {
    title: '站点/顺序', key: 'stop_seq', width: 130,
    render: (row) => h('div', { class: 'seq-cell' }, [
      h('span', `${row.stop_seq}-${row.sort_no || 0}`),
      trip.value?.status !== 'finished'
        ? h(NButton, { text: true, size: 'tiny', disabled: !canMove(row, -1), onClick: () => moveOrder(row, -1) }, { default: () => '↑' })
        : null,
      trip.value?.status !== 'finished'
        ? h(NButton, { text: true, size: 'tiny', disabled: !canMove(row, 1), onClick: () => moveOrder(row, 1) }, { default: () => '↓' })
        : null,
    ]),
  },
  { title: '订单号', key: 'order_no', width: 150, render: (row) => h(NButton, { text: true, type: 'primary', onClick: () => openOrder(row) }, { default: () => row.order_no }) },
  {
    title: '客户 / 电话', key: 'customer_name', minWidth: 140,
    render: (row) => h('div', [h('div', row.customer_name), h('small', { class: 'muted' }, row.customer_phone || '')]),
  },
  { title: '销售', key: 'sales_name', width: 90, render: (row) => row.sales_name || '—' },
  {
    title: '金额 / 实送', key: 'total_amount', width: 130,
    render: (row) => h('div', [h('div', formatMoney(row.total_amount)), h('small', { class: 'muted' }, row.delivered_amount != null ? formatMoney(row.delivered_amount) : '—')]),
  },
  {
    title: '状态', key: 'status', width: 90,
    render: (row) => h(NTag, { size: 'small', type: row.status === 'delivered' ? 'success' : row.status === 'cancelled' ? 'default' : 'info', bordered: false }, { default: () => orderStatusLabel(row.status) }),
  },
  {
    title: '标记', key: 'mark', width: 130,
    render: (row) => h('div', { class: 'flags' }, [
      row.pending_price_adjustment
        ? h(NTag, { size: 'tiny', type: 'warning', bordered: false, title: row.pending_price_adjustment.reason || '' }, { default: () => '改价审批中' })
        : null,
      row.auto_joined ? h(NTag, { size: 'tiny', type: 'info', bordered: false }, { default: () => '自动加入' }) : null,
      row.auto_moved ? h(NTag, { size: 'tiny', type: 'warning', bordered: false, title: row.dispatch_note || '' }, { default: () => '自动挪单' }) : null,
    ]),
  },
  {
    title: '操作', key: 'actions', width: 195,
    render: (row) => actionBar([
      actionIcon({ icon: 'view', label: '查看', onClick: () => openOrder(row) }),
      row.status === 'pending' && actionIcon({ icon: 'edit', label: '编辑', onClick: () => router.push(`/order-center/detail/${row.order_id}?edit=1`) }),
      trip.value?.status === 'delivering' && row.status === 'delivering'
        ? h(NButton, {
            text: true, size: 'small', type: 'primary',
            disabled: Boolean(row.pending_price_adjustment),
            title: row.pending_price_adjustment ? '改价审批中，请先处理审批' : undefined,
            onClick: () => openDeliver(row),
          }, { default: () => row.pending_price_adjustment ? '改价审批中' : '送达' })
        : null,
      ['pending', 'delivering'].includes(row.status)
        ? h(NButton, { text: true, size: 'small', type: 'warning', onClick: () => openReschedule(row) }, { default: () => '退回/改挂' })
        : null,
      actionIcon({ icon: 'print', label: '打印', onClick: () => message.info('打印中心尚未接入') }),
    ]),
  },
]

const orderItemColumns: DataTableColumns<OrderListItem['items'][number]> = [
  { title: '商品', key: 'spu_name' },
  { title: '规格', key: 'sku_spec' },
  { title: '单位', key: 'unit', width: 70 },
  { title: '数量', key: 'quantity', width: 80 },
  {
    title: '售价', key: 'unit_price', width: 130,
    render: (row) => {
      const original = row.original_unit_price
      const changed = original != null && original !== '' && Number(original) !== Number(row.unit_price)
      return h('div', { class: 'price-cell' }, [
        ...(changed ? [h('span', { class: 'price-orig' }, formatMoney(original)), h('span', { class: 'price-arrow' }, '→')] : []),
        h('span', { class: changed ? 'price-new' : '' }, formatMoney(row.unit_price)),
      ])
    },
  },
  { title: '金额', key: 'amount', width: 100, render: (row) => formatMoney(row.amount) },
]

const deliverColumns: DataTableColumns<{ order_item_id: number; name: string; unit: string; ordered: number; delivered: number | null }> = [
  { title: '商品', key: 'name' },
  { title: '单位', key: 'unit', width: 70 },
  { title: '下单数量', key: 'ordered', width: 90 },
  {
    title: '实送数量', key: 'delivered', width: 140,
    render: (row) => h(NInput, {
      value: row.delivered == null ? '' : String(row.delivered),
      size: 'small',
      onUpdateValue: (value: string) => {
        const parsed = Number(value)
        row.delivered = Number.isFinite(parsed) ? parsed : null
      },
    }),
  },
]

const summaryColumns: DataTableColumns<SummaryRow> = [
  { title: '商品', key: 'spuName', minWidth: 180 },
  { title: '规格', key: 'skuSpec', minWidth: 130 },
  { title: '单位', key: 'unit', width: 80 },
  { title: '下单数量', key: 'ordered', width: 110 },
  { title: '已送数量', key: 'delivered', width: 110 },
]

async function loadTrip() {
  try {
    trip.value = await routeTripApi.get(tripId.value)
    loadError.value = ''
  } catch (e: unknown) {
    const error = e as { response?: { status?: number } }
    loadError.value = error.response?.status === 404 ? '出车不存在或已被删除' : '请稍后重试'
  }
}

async function loadOrders() {
  orders.value = await routeTripApi.orders(tripId.value).catch(() => [])
}

async function loadCalls() {
  calls.value = await routeTripApi.callList(tripId.value).catch(() => [])
}

async function reloadAll() {
  loading.value = true
  try {
    await Promise.all([loadTrip(), loadOrders(), loadCalls()])
  } finally {
    loading.value = false
  }
}

async function refreshTrip() {
  await loadTrip()
  await loadOrders()
}

async function markCall(row: CallListCustomer, result: Exclude<CallResult, 'ordered'>) {
  try {
    const updated = await routeTripApi.markCall(tripId.value, row.customer_id, result)
    calls.value = calls.value.map((item) => item.customer_id === updated.customer_id ? updated : item)
    await loadTrip()
  } catch {
    /* 请求层提示 */
  }
}

function goRecord(row: CallListCustomer) {
  router.push({
    path: '/order-center/create',
    query: { customer_id: String(row.customer_id), trip_id: String(tripId.value), source: 'route_call' },
  })
}

function sameStopOrders(row: RouteTripOrder): RouteTripOrder[] {
  return orders.value
    .filter((item) => item.stop_seq === row.stop_seq && item.status !== 'cancelled')
    .sort((a, b) => (a.sort_no || 0) - (b.sort_no || 0) || a.order_id - b.order_id)
}

function canMove(row: RouteTripOrder, direction: -1 | 1): boolean {
  const list = sameStopOrders(row)
  const index = list.findIndex((item) => item.order_id === row.order_id)
  return index >= 0 && index + direction >= 0 && index + direction < list.length
}

async function moveOrder(row: RouteTripOrder, direction: -1 | 1) {
  const list = sameStopOrders(row)
  const index = list.findIndex((item) => item.order_id === row.order_id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= list.length) return
  const ids = list.map((item) => item.order_id)
  ;[ids[index], ids[target]] = [ids[target], ids[index]]
  try {
    orders.value = await routeTripApi.orderSequence(tripId.value, ids)
    message.success('送达顺序已保存')
  } catch {
    /* 请求层提示 */
  }
}

async function openOrder(row: RouteTripOrder) {  try {
    selectedOrder.value = await orderApi.get(row.order_id)
    orderDetails.value[row.order_id] = selectedOrder.value
    orderVisible.value = true
  } catch {
    /* 请求层提示 */
  }
}

async function openDeliver(row: RouteTripOrder) {
  try {
    const detail = await orderApi.get(row.order_id)
    if (detail.pending_price_adjustment) {
      message.warning('该订单有送达前改价待审批，请先处理审批后再送达')
      return
    }
    deliverOrder.value = detail
    deliverRows.value = detail.items.map((item) => ({
      order_item_id: item.id,
      name: `${item.spu_name} ${item.sku_spec}`,
      unit: item.unit,
      ordered: Number(item.quantity),
      delivered: Number(item.delivered_quantity ?? item.quantity),
    }))
    cancelReason.value = ''
    deliverVisible.value = true
  } catch {
    /* 请求层提示 */
  }
}

async function saveDeliver() {
  if (!deliverOrder.value) return
  if (deliverRows.value.some((row) => row.delivered == null || row.delivered < 0 || row.delivered > row.ordered)) {
    message.warning('实送数量必须大于等于 0，且不超过下单数量')
    return
  }
  saving.value = true
  try {
    const result = await orderApi.deliver(
      deliverOrder.value.id,
      deliverRows.value.map((row) => ({
        order_item_id: row.order_item_id,
        delivered_quantity: String(row.delivered),
      })),
      undefined,
      allDeliveredZero.value ? (cancelReason.value.trim() || undefined) : undefined,
    )
    for (const warning of result.warnings) message.warning(warning.message)
    message.success(result.order?.status === 'cancelled' ? '实送为 0，订单已按整单拒收取消' : '已送达')
    deliverVisible.value = false
    await reloadAll()
  } catch {
    /* 请求层提示 */
  } finally {
    saving.value = false
  }
}

async function openReschedule(row: RouteTripOrder) {
  try {
    rescheduleOrder.value = await orderApi.get(row.order_id)
    rescheduleForm.target = 'pool'
    rescheduleForm.trip_id = null
    rescheduleForm.freight_line_id = null
    rescheduleForm.reason = ''
    const [trips, lines] = await Promise.all([
      routeTripApi.list({ status: 'planned', date_from: dayjs().format('YYYY-MM-DD'), page_size: 100 }).catch(() => null),
      deliveryApi.freightLines({
        is_active: true,
        town_region_id: rescheduleOrder.value.delivery_region_id ?? undefined,
      }).catch(() => []),
    ])
    tripOptions.value = (trips?.items || [])
      .filter((item) => item.id !== tripId.value)
      .map((item) => ({ label: `${formatDate(item.trip_date, 'M月D日')} ${item.name || '未命名'}`, value: item.id }))
    freightLineOptions.value = lines.map((line) => ({ label: line.name, value: line.id }))
    rescheduleVisible.value = true
  } catch {
    /* 请求层提示 */
  }
}

async function saveReschedule() {
  if (!rescheduleOrder.value) return
  if (rescheduleForm.target === 'trip' && !rescheduleForm.trip_id) {
    message.warning('请选择目标趟次')
    return
  }
  saving.value = true
  try {
    const result = await orderApi.reschedule(rescheduleOrder.value.id, {
      target: rescheduleForm.target,
      trip_id: rescheduleForm.trip_id ?? undefined,
      freight_line_id: rescheduleForm.freight_line_id ?? undefined,
      reason: rescheduleForm.reason || undefined,
    })
    for (const warning of result.warnings) message.warning(warning.message)
    message.success('已处理')
    rescheduleVisible.value = false
    await reloadAll()
  } catch {
    /* 请求层提示 */
  } finally {
    saving.value = false
  }
}

async function loadSummary() {
  if (!orders.value.length) return
  summaryLoading.value = true
  try {
    const details = await Promise.all(
      orders.value
        .filter((order) => order.status !== 'cancelled')
        .map((order) => orderApi.get(order.order_id).catch(() => null)),
    )
    const map: Record<number, OrderListItem> = {}
    for (const detail of details) if (detail) map[detail.id] = detail
    orderDetails.value = map
  } finally {
    summaryLoading.value = false
  }
}

function onTabChange(name: string) {
  if (name === 'summary') void loadSummary()
}

function onDepart() {
  if (!trip.value) return
  confirmAction(dialog, {
    title: '出车',
    content: `确认出车？本趟 ${trip.value.order_count} 张待配送订单将变为配送中。`,
    confirmText: '确认出车',
    onConfirm: async () => {
      actionLoading.value = true
      try {
        const result = await routeTripApi.depart(trip.value!.id)
        for (const warning of result.warnings) message.warning(warning.message)
        message.success('已出车')
        await reloadAll()
      } catch {
        /* 请求层提示 */
      } finally {
        actionLoading.value = false
      }
    },
  })
}

function onFinish() {
  if (!trip.value) return
  confirmAction(dialog, {
    title: '收车',
    content: '收车后本趟只读，确认已经处理完所有订单？',
    confirmText: '确认收车',
    onConfirm: async () => {
      actionLoading.value = true
      try {
        await routeTripApi.finish(trip.value!.id)
        message.success('已收车')
        await reloadAll()
      } catch (e: unknown) {
        const error = e as { response?: { data?: { message?: string; data?: { pending_order_ids?: number[] } } } }
        const pending = error.response?.data?.data?.pending_order_ids
        message.warning(pending?.length ? `还有 ${pending.length} 张订单未处理` : '还有订单未处理，暂不能收车')
      } finally {
        actionLoading.value = false
      }
    },
  })
}

function onCancel() {
  if (!trip.value) return
  confirmAction(dialog, {
    title: '取消出车',
    content: `本趟挂着的 ${trip.value.order_count} 张待配送订单将全部退回待排车，不会自动加入其他趟次。`,
    confirmText: '确认取消',
    danger: true,
    onConfirm: async () => {
      actionLoading.value = true
      try {
        await routeTripApi.cancel(trip.value!.id)
        message.success('已取消出车')
        await reloadAll()
      } catch {
        /* 请求层提示 */
      } finally {
        actionLoading.value = false
      }
    },
  })
}

function openTemplate() {
  if (!trip.value) return
  templateForm.name = trip.value.name || `${formatDate(trip.value.trip_date, 'M月D日')}线路`
  templateForm.remark = ''
  templateVisible.value = true
}

async function saveTemplate() {
  if (!trip.value || !templateForm.name.trim()) {
    message.warning('请填写路线名称')
    return
  }
  saving.value = true
  try {
    await routeTripApi.saveAsTemplate(trip.value.id, {
      name: templateForm.name.trim(),
      remark: templateForm.remark.trim() || undefined,
    })
    message.success('已存为常用路线')
    templateVisible.value = false
  } finally {
    saving.value = false
  }
}

onMounted(reloadAll)
</script>

<style scoped>
.back-link { margin-bottom: 6px; padding-left: 0; }
.title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.subtitle { margin: 5px 0 0; color: var(--text-3); font-size: 12.5px; }
.header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.block-alert { margin-bottom: 12px; }
.stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
.stat-card { padding: 12px 14px; }
.stat-label { color: var(--text-3); font-size: 12px; }
.stat-value { margin: 8px 0 6px; font-size: 22px; font-weight: 650; }
.stat-sub { color: var(--text-3); font-size: 11.5px; }
.tabs-card { padding-top: 8px; }
.filter-bar { margin: 12px 0; align-items: center; }
.call-group { margin-bottom: 18px; }
.call-group-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: var(--bg-subtle); border-radius: 7px; margin-bottom: 6px; font-size: 12.5px; }
.call-group-head span { color: var(--text-3); font-size: 11.5px; }
.phone-cell { display: flex; align-items: center; gap: 4px; }
.seq-cell { display: flex; align-items: center; gap: 2px; }
.muted { color: var(--text-3); font-size: 11px; }
.row-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.flags { display: flex; gap: 4px; flex-wrap: wrap; }
.modal-note { margin: 0 0 10px; color: var(--text-3); font-size: 12px; }
.price-cell { display: inline-flex; align-items: center; gap: 4px; }
.price-orig { color: var(--text-3); text-decoration: line-through; }
.price-arrow { color: var(--text-3); }
.price-new { font-weight: 600; }
.cancel-reason { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; font-size: 12.5px; }
@media (max-width: 1000px) {
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .header-actions { width: 100%; }
}
</style>
