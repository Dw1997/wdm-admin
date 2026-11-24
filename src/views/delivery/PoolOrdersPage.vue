<template>
  <div class="page-container pool-page">
    <div class="card-section">
      <div class="page-header">
        <div class="title-line">
          <h2 class="page-title">待送货订单</h2>
          <span class="result-count">共 {{ total }} 张</span>
        </div>
        <n-space :size="8">
          <n-button :loading="loading" @click="load()">刷新</n-button>
          <n-button type="primary" @click="router.push('/delivery/trips/new')">安排出车</n-button>
        </n-space>
      </div>

      <n-alert v-if="savedText" type="success" :bordered="false" closable class="block-alert" @close="savedText = ''">
        {{ savedText }}
      </n-alert>
      <n-alert v-if="loadError" type="error" :bordered="false" class="block-alert">
        待送货订单加载失败：{{ loadError }}
        <n-button text type="primary" size="small" style="margin-left: 8px" @click="load()">重试</n-button>
      </n-alert>

      <div class="quick-tabs">
        <n-button
          v-for="item in quickTabs"
          :key="item.key"
          size="small"
          :type="quick === item.key ? 'primary' : 'default'"
          @click="setQuick(item.key)"
        >
          {{ item.label }}
        </n-button>
      </div>

      <div class="filter-bar">
        <n-input
          v-model:value="keyword"
          clearable
          placeholder="订单号 / 客户名称 / 手机号"
          style="width: 220px"
          @keyup.enter="search"
        />
        <n-select
          v-model:value="freightLineFilter"
          :options="freightLineOptions"
          clearable
          filterable
          placeholder="筛选物流路线"
          style="width: 190px"
          @update:value="search"
        />
        <n-tree-select
          v-model:value="regionId"
          :options="regions"
          key-field="id"
          label-field="name"
          children-field="children"
          filterable
          clearable
          placeholder="送货地点"
          style="width: 170px"
        />
        <n-select
          v-model:value="statusFilter"
          :options="statusFilterOptions"
          placeholder="订单状态"
          style="width: 200px"
          @update:value="search"
        />
        <n-select
          v-model:value="salesId"
          :options="salesOptions"
          clearable
          filterable
          placeholder="归属销售"
          style="width: 140px"
        />
        <n-date-picker v-model:value="dateRange" type="daterange" clearable style="width: 240px" />
        <n-button type="primary" :loading="loading" @click="search">查询</n-button>
        <n-button @click="reset">重置</n-button>
      </div>

      <div v-if="checkedIds.length" class="batch-bar">
        <span class="batch-count">已选 <b>{{ checkedIds.length }}</b> 张订单</span>
        <div class="batch-groups">
          <n-space :size="8" wrap align="center">
            <n-button size="small" type="info" secondary @click="openDispatchModal(checkedIds, 'freight')">批量发物流</n-button>
            <n-button size="small" type="primary" secondary @click="openDispatchModal(checkedIds, 'pool')">批量设为自送</n-button>
            <n-button size="small" type="warning" secondary @click="confirmQuickBatch(checkedIds, 'local', '城区自送')">批量城区自送</n-button>
            <n-button size="small" type="success" secondary @click="confirmQuickBatch(checkedIds, 'pickup', '自取')">批量自取</n-button>
            <n-button
              v-if="selectedFreightOrders.length"
              size="small"
              type="primary"
              @click="openHandoverModal(selectedFreightOrders)"
            >
              物流交车（{{ selectedFreightOrders.length }} 单）
            </n-button>
          </n-space>
          <span class="batch-divider"></span>
          <n-space :size="8" wrap align="center">
            <n-button size="small" type="success" @click="openDeliverModal(checkedIds)">批量已送达</n-button>
            <n-button size="small" @click="openPrintModal(checkedIds)">批量打单</n-button>
            <n-button size="small" type="error" secondary @click="openBatchCancel(checkedIds)">批量取消</n-button>
          </n-space>
          <n-button size="small" text @click="checkedIds = []">清空勾选</n-button>
        </div>
      </div>

      <n-data-table
        v-model:checked-row-keys="checkedIds"
        :columns="columns"
        :data="list"
        :loading="loading"
        :bordered="false"
        size="small"
        :scroll-x="1340"
        :row-key="(row: OrderListItem) => row.id"
      >
        <template #empty>
          <n-empty description="当前没有符合条件的待送货订单" style="padding: 42px 0">
            <template #extra>
              <n-button v-if="hasFilter" size="small" @click="reset">清空筛选</n-button>
            </template>
          </n-empty>
        </template>
      </n-data-table>

      <div class="pagination-bar">
        <span>每页 20 条</span>
        <n-pagination v-model:page="page" :page-size="20" :item-count="total" show-quick-jumper @update:page="onPage" />
      </div>
    </div>

    <!-- 设置配送方式弹窗（单条 / 批量共用） -->
    <n-modal
      v-model:show="dispatchVisible"
      preset="card"
      :title="dispatchOrderIds.length > 1 ? `批量设置配送方式（已选 ${dispatchOrderIds.length} 单）` : '设置配送方式'"
      style="width: 560px; max-width: 95vw"
      :mask-closable="!saving"
    >
      <n-form label-placement="left" label-width="96">
        <n-form-item label="配送方式" required>
          <n-radio-group v-model:value="dispatchForm.mode">
            <n-space>
              <n-radio-button value="freight">发物流</n-radio-button>
              <n-radio-button value="route">自送</n-radio-button>
              <n-radio-button value="local">城区自送</n-radio-button>
              <n-radio-button value="pickup">自取</n-radio-button>
            </n-space>
          </n-radio-group>
        </n-form-item>

        <template v-if="dispatchForm.mode === 'freight'">
          <n-form-item label="物流路线" required>
            <n-select
              v-model:value="dispatchForm.freight_line_id"
              :options="activeFreightLineOptions"
              filterable
              placeholder="选择启用的物流路线"
              @update:value="onDispatchLineChange"
            />
          </n-form-item>
          <n-form-item v-if="selectedDispatchLine?.receive_address" label="收货地址">
            <span class="muted">{{ selectedDispatchLine.receive_address }}</span>
          </n-form-item>
          <n-form-item label="发运日期">
            <n-date-picker
              v-model:formatted-value="dispatchForm.ship_date"
              type="date"
              value-format="yyyy-MM-dd"
              clearable
              placeholder="留空按下一班次自动确定"
              style="width: 100%"
            />
          </n-form-item>
          <n-form-item v-if="dispatchScheduleOptions.length > 1" label="发车班次">
            <n-select
              v-model:value="dispatchForm.depart_time"
              :options="dispatchScheduleOptions"
              clearable
              placeholder="留空自动选未截单最早班次"
            />
          </n-form-item>
          <n-form-item label="运费方式">
            <n-select v-model:value="dispatchForm.freight_mode" :options="freightModeOptions" clearable placeholder="留空按客户默认" />
          </n-form-item>
        </template>

        <template v-else-if="dispatchForm.mode === 'route'">
          <n-form-item label="自送安排">
            <n-radio-group v-model:value="dispatchForm.routeTarget">
              <n-space vertical>
                <n-radio value="pool">放入自送待排车（安排出车时自动加入）</n-radio>
                <n-radio value="trip">直接挂到已有计划出车</n-radio>
              </n-space>
            </n-radio-group>
          </n-form-item>
          <n-form-item v-if="dispatchForm.routeTarget === 'trip'" label="选择趟次" required>
            <n-select
              v-model:value="dispatchForm.trip_id"
              :options="plannedTripOptions"
              filterable
              placeholder="选择计划中的出车趟次"
            />
          </n-form-item>
        </template>

        <n-alert v-else-if="dispatchForm.mode === 'local'" type="info" :bordered="false">
          将选中的 {{ dispatchOrderIds.length }} 张订单设置为「城区自送」。
        </n-alert>
        <n-alert v-else-if="dispatchForm.mode === 'pickup'" type="info" :bordered="false">
          将选中的 {{ dispatchOrderIds.length }} 张订单设置为「自取」。
        </n-alert>
      </n-form>

      <template #footer>
        <n-button @click="dispatchVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="submitDispatch">确认保存</n-button>
      </template>
    </n-modal>

    <!-- 物流交车弹窗（单条 / 批量共用） -->
    <n-modal
      v-model:show="handoverVisible"
      preset="card"
      :title="`物流交车（${handoverOrders.length} 单）`"
      style="width: 680px; max-width: 95vw"
      :mask-closable="!saving"
    >
      <div class="handover-tip">
        <span>确认交车后，订单状态将更新为「已送达」并扣减库存；包邮订单可填总运费自动按金额分摊，也可逐单填写运费。</span>
      </div>

      <div class="handover-total-row">
        <span>总运费分摊（选填）：</span>
        <n-input-number
          v-model:value="handoverTotalFreight"
          :min="0"
          :precision="2"
          clearable
          placeholder="填写总运费自动分摊"
          style="width: 200px"
        >
          <template #prefix>¥</template>
        </n-input-number>
        <span class="muted">留空则按下方逐单运费提交</span>
      </div>

      <div class="handover-list">
        <div v-for="item in handoverRows" :key="item.order_id" class="handover-row">
          <div class="handover-info">
            <b>{{ item.order_no }}</b>
            <span class="muted">{{ item.customer_name }} · {{ item.freight_line_name || '物流' }}</span>
          </div>
          <div class="handover-amount">¥{{ formatNum(item.total_amount) }}</div>
          <div class="handover-mode">
            <n-tag size="small" :bordered="false">{{ freightModeText(item.freight_mode) }}</n-tag>
          </div>
          <div class="handover-cost">
            <n-input-number
              v-if="item.freight_mode === 'deduct' || item.freight_mode === 'store_paid'"
              v-model:value="item.freight_cost"
              :min="0"
              :precision="2"
              size="small"
              clearable
              :disabled="handoverTotalFreight !== null"
              placeholder="运费"
              style="width: 110px"
            />
            <span v-else class="muted">客户自付</span>
          </div>
        </div>
      </div>

      <template #footer>
        <n-button @click="handoverVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="submitHandover">确认交车</n-button>
      </template>
    </n-modal>

    <!-- 取消订单弹窗 -->
    <n-modal v-model:show="cancelVisible" preset="card" title="取消订单" style="width: 440px; max-width: 95vw" :mask-closable="!saving">
      <n-alert type="error" :bordered="false" style="margin-bottom: 12px">
        取消后订单变为已取消，不能恢复。确认取消「{{ cancelOrder?.order_no }}」？
      </n-alert>
      <n-input v-model:value="cancelReason" type="textarea" :rows="3" maxlength="200" placeholder="取消原因（选填）" />
      <template #footer>
        <n-button @click="cancelVisible = false">再想想</n-button>
        <n-button type="error" :loading="saving" @click="submitCancel">确认取消</n-button>
      </template>
    </n-modal>

    <!-- 批量已送达（单条 / 批量共用） -->
    <n-modal
      v-model:show="deliverVisible"
      preset="card"
      :title="deliverOrderIds.length > 1 ? `批量已送达（已选 ${deliverOrderIds.length} 张）` : '确认送达'"
      style="width: 480px; max-width: 95vw"
      :mask-closable="!saving"
    >
      <n-alert type="info" :bordered="false" style="margin-bottom: 12px">
        确认后将把 {{ deliverOrderIds.length }} 张订单标记为「已送达」并扣减库存。
      </n-alert>
      <n-form label-placement="left" label-width="96">
        <n-form-item label="送达时间">
          <n-date-picker v-model:value="deliverAt" type="datetime" clearable placeholder="留空按当前时间" style="width: 100%" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="deliverVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="submitDeliver">确认送达</n-button>
      </template>
    </n-modal>

    <!-- 批量取消 -->
    <n-modal
      v-model:show="batchCancelVisible"
      preset="card"
      title="批量取消订单"
      style="width: 460px; max-width: 95vw"
      :mask-closable="!saving"
    >
      <n-alert type="error" :bordered="false" style="margin-bottom: 12px">
        取消后订单变为已取消，不能恢复。确认取消已选的 {{ batchCancelIds.length }} 张订单？
      </n-alert>
      <n-input v-model:value="batchCancelReason" type="textarea" :rows="3" maxlength="200" placeholder="取消原因（选填）" />
      <template #footer>
        <n-button @click="batchCancelVisible = false">再想想</n-button>
        <n-button type="error" :loading="saving" @click="submitBatchCancel">确认取消</n-button>
      </template>
    </n-modal>

    <!-- 批量打单 -->
    <n-modal
      v-model:show="printVisible"
      preset="card"
      title="批量打单"
      style="width: 520px; max-width: 95vw"
      :mask-closable="!printing"
    >
      <n-form label-placement="left" label-width="88">
        <n-form-item label="纸张">
          <n-radio-group v-model:value="printPaper">
            <n-space>
              <n-radio-button value="half">二等分 241×140</n-radio-button>
              <n-radio-button value="full">整张 241×280</n-radio-button>
            </n-space>
          </n-radio-group>
        </n-form-item>
        <n-form-item label="打印范围">
          <span class="muted">
            已选 {{ printIds.length }} 张，可打印 {{ printableOrders.length }} 张（待配送/配送中/已送达），单次最多 200 张
          </span>
        </n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="printVisible = false">取消</n-button>
        <n-button type="primary" :loading="printing" :disabled="!printableOrders.length" @click="submitPrint">确认打印</n-button>
      </template>
    </n-modal>

    <!-- 订单详情抽屉 -->
    <n-drawer v-model:show="drawerVisible" width="560">
      <n-drawer-content :title="drawerOrder ? `订单详情 · ${drawerOrder.order_no}` : '订单详情'" closable>
        <template v-if="drawerOrder">
          <n-descriptions :column="2" bordered size="small" style="margin-bottom: 14px">
            <n-descriptions-item label="客户">{{ drawerOrder.customer_name }}</n-descriptions-item>
            <n-descriptions-item label="电话">{{ drawerOrder.customer_phone || '—' }}</n-descriptions-item>
            <n-descriptions-item label="送货地点">{{ drawerOrder.delivery_region_name || '—' }}</n-descriptions-item>
            <n-descriptions-item label="归属销售">{{ drawerOrder.sales_name || '—' }}</n-descriptions-item>
            <n-descriptions-item label="配送方式">{{ deliveryModeMeta(drawerOrder.delivery_mode).label }}</n-descriptions-item>
            <n-descriptions-item label="订单金额">¥{{ formatNum(drawerOrder.total_amount) }}</n-descriptions-item>
            <n-descriptions-item v-if="drawerOrder.delivery_mode === 'freight'" label="物流路线">
              {{ drawerOrder.freight_line_name || '—' }}
            </n-descriptions-item>
            <n-descriptions-item v-if="drawerOrder.delivery_mode === 'freight'" label="发运班次">
              {{ [drawerOrder.freight_ship_date, drawerOrder.freight_depart_time].filter(Boolean).join(' ') || '—' }}
            </n-descriptions-item>
            <n-descriptions-item v-if="drawerOrder.delivery_mode === 'route'" label="出车安排">
              {{ drawerOrder.route_trip_id ? `${drawerOrder.route_trip_date || ''} ${drawerOrder.route_trip_name || '计划出车'}` : '未排车' }}
            </n-descriptions-item>
            <n-descriptions-item label="备注" :span="2">{{ drawerOrder.remark || '—' }}</n-descriptions-item>
          </n-descriptions>

          <n-data-table
            :columns="drawerItemColumns"
            :data="drawerOrder.items || []"
            size="small"
            :bordered="false"
            :row-key="(row: any) => row.id"
          />
        </template>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NTag, useDialog, useMessage, type DataTableColumns, type SelectOption } from 'naive-ui'
import { adminCustomerApi, deliveryApi, orderApi, regionApi, routeTripApi, systemSettingApi } from '@/api'
import { DELIVERY_MODE, FREIGHT_MODE, ORDER_SOURCE } from '@/utils/dict'
import type { FreightLine, OrderListItem, PrintRecordResult, RegionNode, RouteTrip, SalesNote, SalesNoteDocType } from '@/types'
import { actionBar, actionIcon } from '@/components/tableActions'
import { renderCustomerNameCell } from '@/components/customerCell'
import { printHtml } from '@/utils/print'
import { renderSalesNotes, type SalesPaper } from '@/views/orders/printTemplates'

type QuickKey = 'all' | 'freight' | 'route' | 'local' | 'pickup' | 'pool'
type StatusFilterValue = 'pending,delivering' | 'pending' | 'delivering' | 'delivered' | 'cancelled' | 'all'

const DEFAULT_STATUS_FILTER: StatusFilterValue = 'pending,delivering'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const savedText = ref('')
const list = ref<OrderListItem[]>([])
const total = ref(0)
const page = ref(1)
const checkedIds = ref<number[]>([])

const quick = ref<QuickKey>('all')
const statusFilter = ref<StatusFilterValue>(DEFAULT_STATUS_FILTER)
const keyword = ref('')
const freightLineFilter = ref<number | null>(null)
const regionId = ref<number | null>(null)
const salesId = ref<number | null>(null)
const dateRange = ref<[number, number] | null>(null)

const regions = ref<RegionNode[]>([])
const salesOptions = ref<SelectOption[]>([])
const freightLines = ref<FreightLine[]>([])
const plannedTrips = ref<RouteTrip[]>([])

const quickTabs: { key: QuickKey; label: string }[] = [
  { key: 'all', label: '全部待送货' },
  { key: 'route', label: '自送' },
  { key: 'local', label: '城区自送' },
  { key: 'freight', label: '物流' },
  { key: 'pickup', label: '到店取' },
  { key: 'pool', label: '未排车自送' },
]

const statusFilterOptions: SelectOption[] = [
  { label: '未收货（待配送/配送中）', value: 'pending,delivering' },
  { label: '待配送', value: 'pending' },
  { label: '配送中', value: 'delivering' },
  { label: '已送达', value: 'delivered' },
  { label: '已取消', value: 'cancelled' },
  { label: '全部状态', value: 'all' },
]

const freightModeOptions: SelectOption[] = [
  { label: FREIGHT_MODE.deduct, value: 'deduct' },
  { label: FREIGHT_MODE.store_paid, value: 'store_paid' },
  { label: FREIGHT_MODE.customer_paid, value: 'customer_paid' },
]

const freightLineOptions = computed<SelectOption[]>(() =>
  freightLines.value.map((line) => ({
    label: line.is_active ? line.name : `${line.name}（已停用）`,
    value: line.id,
  })),
)

const activeFreightLineOptions = computed<SelectOption[]>(() =>
  freightLines.value
    .filter((line) => line.is_active)
    .map((line) => {
      const times = (line.schedules || []).map((s) => s.depart_time).join('/')
      return {
        label: times ? `${line.name}（${times}）` : line.name,
        value: line.id,
      }
    }),
)

const plannedTripOptions = computed<SelectOption[]>(() =>
  plannedTrips.value.map((trip) => ({
    label: `${trip.trip_date} · ${trip.name || '未命名出车'}（${trip.stops_text || '—'}）`,
    value: trip.id,
  })),
)

const hasFilter = computed(() => Boolean(
  quick.value !== 'all'
  || statusFilter.value !== DEFAULT_STATUS_FILTER
  || keyword.value.trim()
  || freightLineFilter.value || regionId.value || salesId.value || dateRange.value,
))

const selectedOrders = computed(() => {
  const idSet = new Set(checkedIds.value)
  return list.value.filter((item) => idSet.has(item.id))
})

const selectedFreightOrders = computed(() =>
  selectedOrders.value.filter((item) => item.delivery_mode === 'freight' && item.freight_shipment_id),
)

function deliveryModeMeta(mode: OrderListItem['delivery_mode']) {
  return DELIVERY_MODE[mode] || { label: mode, type: 'info' as const }
}

function freightModeText(mode?: string) {
  if (!mode || mode === 'none') return '—'
  return FREIGHT_MODE[mode as keyof typeof FREIGHT_MODE] || mode
}

function formatNum(v: number | string | null | undefined) {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function formatDateTime(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function deliveryDetailText(row: OrderListItem): string {
  if (row.delivery_mode === 'freight') {
    const parts = [row.freight_line_name || '未指定路线']
    if (row.freight_ship_date) parts.push(row.freight_ship_date)
    if (row.freight_depart_time) parts.push(row.freight_depart_time)
    return parts.join(' · ')
  }
  if (row.delivery_mode === 'route') {
    if (row.route_trip_id) {
      return [row.route_trip_date, row.route_trip_name || '已排车'].filter(Boolean).join(' · ')
    }
    return '待排车'
  }
  return ''
}

const ORDER_STATUS_META: Record<string, { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }> = {
  pending_approval: { label: '待审批', type: 'warning' },
  pending: { label: '待配送', type: 'info' },
  delivering: { label: '配送中', type: 'info' },
  delivered: { label: '已送达', type: 'success' },
  cancelled: { label: '已取消', type: 'default' },
  rejected: { label: '已驳回', type: 'error' },
}

function orderStatusMeta(status: OrderListItem['status']) {
  return ORDER_STATUS_META[status] || { label: status, type: 'default' as const }
}

const columns = computed<DataTableColumns<OrderListItem>>(() => [
  { type: 'selection', fixed: 'left' },
  {
    title: '下单时间',
    key: 'created_at',
    width: 150,
    render: (row) => h('div', [
      h('div', formatDateTime(row.created_at)),
      h('div', { class: 'muted' }, ORDER_SOURCE[row.source] || row.source),
    ]),
  },
  {
    title: '订单号',
    key: 'order_no',
    width: 165,
    render: (row) => h(NButton, { text: true, type: 'primary', onClick: () => openDrawer(row) }, { default: () => row.order_no }),
  },
  {
    title: '客户',
    key: 'customer_name',
    minWidth: 160,
    render: (row) => renderCustomerNameCell(row.customer_name, row.customer_phone, { subtitle: row.sales_name, strong: true }),
  },
  {
    title: '订单状态',
    key: 'status',
    width: 100,
    render: (row) => {
      const meta = orderStatusMeta(row.status)
      return h(NTag, { size: 'small', type: meta.type, bordered: false }, { default: () => meta.label })
    },
  },
  {
    title: '送货地点',
    key: 'delivery_region_name',
    width: 120,
    render: (row) => row.delivery_region_name || '—',
  },
  {
    title: '配送方式',
    key: 'delivery_mode',
    minWidth: 210,
    render: (row) => {
      const meta = deliveryModeMeta(row.delivery_mode)
      const detail = deliveryDetailText(row)
      return h('div', [
        h(NTag, { size: 'small', type: meta.type, bordered: false }, { default: () => meta.label }),
        detail ? h('div', { class: 'muted', style: 'margin-top: 2px' }, detail) : null,
      ])
    },
  },
  {
    title: '订单金额',
    key: 'total_amount',
    width: 130,
    render: (row) => h('div', [
      h('div', { style: 'font-weight: 600' }, `¥${formatNum(row.total_amount)}`),
      row.delivery_mode === 'freight'
        ? h('div', { class: 'muted' }, row.freight_cost != null ? `运费 ¥${formatNum(row.freight_cost)}` : freightModeText(row.freight_mode))
        : null,
    ]),
  },
  {
    title: '操作',
    key: 'actions',
    width: 215,
    fixed: 'right',
    render: (row) => {
      const active = row.status === 'pending' || row.status === 'delivering'
      return actionBar([
        active && h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openDispatchModal([row.id], row.delivery_mode === 'route' ? (row.route_trip_id ? 'trip' : 'pool') : row.delivery_mode, row) }, { default: () => '改方式' }),
        active && row.delivery_mode === 'freight' && row.freight_shipment_id
          ? h(NButton, { size: 'small', text: true, type: 'info', onClick: () => openHandoverModal([row]) }, { default: () => '交车' })
          : null,
        active && h(NButton, { size: 'small', text: true, type: 'success', onClick: () => openDeliverModal([row.id]) }, { default: () => '送达' }),
        row.status === 'pending' && h(NButton, { size: 'small', text: true, type: 'error', onClick: () => openCancel(row) }, { default: () => '取消' }),
        actionIcon({ icon: 'view', label: '查看', type: 'default', onClick: () => openDrawer(row) }),
      ])
    },
  },
])

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const params: Record<string, any> = {
      page: page.value,
      page_size: 20,
    }
    if (statusFilter.value !== 'all') {
      params.status = statusFilter.value
    }
    if (quick.value === 'pool') {
      params.pool = true
    } else if (quick.value !== 'all') {
      params.delivery_mode = quick.value
    }
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    if (freightLineFilter.value) params.freight_line_id = freightLineFilter.value
    if (regionId.value) params.delivery_region_id = regionId.value
    if (salesId.value) params.sales_id = salesId.value
    if (dateRange.value) {
      const [start, end] = dateRange.value
      params.created_at_from = new Date(start).toISOString()
      const endDate = new Date(end)
      endDate.setDate(endDate.getDate() + 1)
      params.created_at_to = endDate.toISOString()
    }
    const res = await orderApi.list(params)
    list.value = res.items
    total.value = res.total
    checkedIds.value = []
  } catch (e: any) {
    loadError.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function setQuick(key: QuickKey) {
  quick.value = key
  if (key !== 'all' && key !== 'freight') {
    freightLineFilter.value = null
  }
  page.value = 1
  load()
}

function search() {
  page.value = 1
  load()
}

function reset() {
  quick.value = 'all'
  statusFilter.value = DEFAULT_STATUS_FILTER
  keyword.value = ''
  freightLineFilter.value = null
  regionId.value = null
  salesId.value = null
  dateRange.value = null
  page.value = 1
  load()
}

function onPage(p: number) {
  page.value = p
  load()
}

// ---------- 设置配送方式（单条 / 批量） ----------
const dispatchVisible = ref(false)
const dispatchOrderIds = ref<number[]>([])
const dispatchForm = reactive({
  mode: 'freight' as 'freight' | 'route' | 'local' | 'pickup',
  freight_line_id: null as number | null,
  ship_date: null as string | null,
  depart_time: null as string | null,
  freight_mode: null as 'deduct' | 'store_paid' | 'customer_paid' | null,
  routeTarget: 'pool' as 'pool' | 'trip',
  trip_id: null as number | null,
})

const selectedDispatchLine = computed(() =>
  freightLines.value.find((line) => line.id === dispatchForm.freight_line_id) || null,
)

const dispatchScheduleOptions = computed<SelectOption[]>(() =>
  (selectedDispatchLine.value?.schedules || []).map((s) => ({
    label: s.label ? `${s.depart_time} ${s.label}` : s.depart_time,
    value: s.depart_time,
  })),
)

function onDispatchLineChange() {
  dispatchForm.depart_time = null
}

function openDispatchModal(
  ids: number[],
  preset: 'freight' | 'pool' | 'trip' | 'local' | 'pickup',
  singleRow?: OrderListItem,
) {
  dispatchOrderIds.value = [...ids]
  if (preset === 'pool' || preset === 'trip') {
    dispatchForm.mode = 'route'
    dispatchForm.routeTarget = preset
    dispatchForm.trip_id = singleRow?.route_trip_id ?? null
  } else {
    dispatchForm.mode = preset
    dispatchForm.routeTarget = 'pool'
    dispatchForm.trip_id = null
  }
  dispatchForm.freight_line_id = singleRow?.freight_line_id ?? (activeFreightLineOptions.value[0]?.value as number | null ?? null)
  dispatchForm.ship_date = singleRow?.freight_ship_date ?? null
  dispatchForm.depart_time = singleRow?.freight_depart_time ?? null
  dispatchForm.freight_mode =
    singleRow?.freight_mode && singleRow.freight_mode !== 'none'
      ? singleRow.freight_mode
      : null
  dispatchVisible.value = true
}

function confirmQuickBatch(ids: number[], target: 'local' | 'pickup', label: string) {
  dialog.info({
    title: `批量设为${label}`,
    content: `确认将已选中的 ${ids.length} 张待送货订单全部设置为「${label}」？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      saving.value = true
      try {
        const res = await orderApi.batchReschedule({ order_ids: ids, target })
        savedText.value = `已将 ${res.updated_count} 张订单设置为「${label}」`
        await load()
      } finally {
        saving.value = false
      }
    },
  })
}

async function submitDispatch() {
  if (!dispatchOrderIds.value.length) return
  let target: 'trip' | 'pool' | 'freight' | 'local' | 'pickup'
  if (dispatchForm.mode === 'route') {
    target = dispatchForm.routeTarget
    if (target === 'trip' && !dispatchForm.trip_id) {
      return message.warning('请选择目标出车趟次')
    }
  } else {
    target = dispatchForm.mode
  }
  if (target === 'freight' && !dispatchForm.freight_line_id) {
    return message.warning('请选择物流路线')
  }

  saving.value = true
  try {
    const res = await orderApi.batchReschedule({
      order_ids: dispatchOrderIds.value,
      target,
      trip_id: target === 'trip' ? dispatchForm.trip_id ?? undefined : undefined,
      freight_line_id: target === 'freight' ? dispatchForm.freight_line_id ?? undefined : undefined,
      ship_date: target === 'freight' ? dispatchForm.ship_date ?? undefined : undefined,
      depart_time: target === 'freight' ? dispatchForm.depart_time ?? undefined : undefined,
      freight_mode: target === 'freight' ? dispatchForm.freight_mode ?? undefined : undefined,
    })
    for (const w of res.warnings || []) message.warning(w.message)
    savedText.value = `已更新 ${res.updated_count} 张订单的配送方式`
    dispatchVisible.value = false
    await load()
  } finally {
    saving.value = false
  }
}

// ---------- 物流交车（单条 / 批量） ----------
interface HandoverRow {
  order_id: number
  order_no: string
  customer_name: string
  freight_line_name: string | null
  total_amount: number
  freight_mode: string
  freight_cost: number | null
}

const handoverVisible = ref(false)
const handoverOrders = ref<OrderListItem[]>([])
const handoverRows = ref<HandoverRow[]>([])
const handoverTotalFreight = ref<number | null>(null)

function openHandoverModal(orders: OrderListItem[]) {
  handoverOrders.value = orders
  handoverTotalFreight.value = null
  handoverRows.value = orders.map((o) => ({
    order_id: o.id,
    order_no: o.order_no,
    customer_name: o.customer_name,
    freight_line_name: o.freight_line_name ?? null,
    total_amount: Number(o.total_amount ?? 0),
    freight_mode: o.freight_mode || 'none',
    freight_cost: o.freight_cost != null ? Number(o.freight_cost) : null,
  }))
  handoverVisible.value = true
}

async function submitHandover() {
  if (!handoverRows.value.length) return
  saving.value = true
  try {
    const res = await orderApi.batchFreightHandover({
      orders: handoverRows.value.map((r) => ({
        order_id: r.order_id,
        freight_cost: handoverTotalFreight.value === null && r.freight_cost !== null ? String(r.freight_cost) : null,
      })),
      total_freight: handoverTotalFreight.value !== null ? String(handoverTotalFreight.value) : null,
    })
    for (const w of res.warnings || []) message.warning(w.message)
    savedText.value = `已完成 ${res.handed_over_count} 张物流订单的交车`
    handoverVisible.value = false
    await load()
  } finally {
    saving.value = false
  }
}

// ---------- 取消订单 ----------
const cancelVisible = ref(false)
const cancelOrder = ref<OrderListItem | null>(null)
const cancelReason = ref('')

function openCancel(row: OrderListItem) {
  cancelOrder.value = row
  cancelReason.value = ''
  cancelVisible.value = true
}

async function submitCancel() {
  if (!cancelOrder.value) return
  saving.value = true
  try {
    await orderApi.cancel(cancelOrder.value.id, cancelReason.value.trim() || undefined)
    message.success('订单已取消')
    cancelVisible.value = false
    await load()
  } finally {
    saving.value = false
  }
}

// ---------- 批量结果反馈 ----------
interface SkippedItem {
  order_id: number
  order_no?: string | null
  reason: string
}

function skippedSummary(skipped: SkippedItem[]) {
  return skipped
    .map((s) => `${s.order_no || `订单#${s.order_id}`}：${s.reason}`)
    .join('；')
}

function reportBatchResult(verb: string, successCount: number, skipped: SkippedItem[], warnings: { message: string }[]) {
  for (const w of warnings || []) message.warning(w.message)
  if (!skipped.length) {
    savedText.value = `成功${verb} ${successCount} 张订单`
    return
  }
  const detail = skippedSummary(skipped)
  savedText.value = `成功${verb} ${successCount} 张，跳过 ${skipped.length} 张（${detail}）`
  message.warning(`成功 ${successCount} 张，跳过 ${skipped.length} 张：${detail}`)
}

// ---------- 批量已送达（单条 / 批量） ----------
const deliverVisible = ref(false)
const deliverOrderIds = ref<number[]>([])
const deliverAt = ref<number | null>(null)

function openDeliverModal(ids: number[]) {
  deliverOrderIds.value = [...ids]
  deliverAt.value = null
  deliverVisible.value = true
}

async function submitDeliver() {
  if (!deliverOrderIds.value.length) return
  saving.value = true
  try {
    const res = await orderApi.batchDeliver({
      order_ids: [...deliverOrderIds.value],
      delivered_at: deliverAt.value ? new Date(deliverAt.value).toISOString() : null,
    })
    reportBatchResult('送达', res.delivered_count, res.skipped, res.warnings)
    deliverVisible.value = false
    await load()
  } finally {
    saving.value = false
  }
}

// ---------- 批量取消 ----------
const batchCancelVisible = ref(false)
const batchCancelIds = ref<number[]>([])
const batchCancelReason = ref('')

function openBatchCancel(ids: number[]) {
  batchCancelIds.value = [...ids]
  batchCancelReason.value = ''
  batchCancelVisible.value = true
}

async function submitBatchCancel() {
  if (!batchCancelIds.value.length) return
  saving.value = true
  try {
    const res = await orderApi.batchCancel({
      order_ids: [...batchCancelIds.value],
      reason: batchCancelReason.value.trim() || null,
    })
    reportBatchResult('取消', res.cancelled_count, res.skipped, res.warnings)
    batchCancelVisible.value = false
    await load()
  } finally {
    saving.value = false
  }
}

// ---------- 批量打单（复用打印中心模板） ----------
const shop = reactive({ name: '味都美', phone: '', address: '' })

async function loadShop() {
  try {
    const items = await systemSettingApi.list()
    items.forEach((item) => {
      if (item.key === 'shop_name') shop.name = String(item.value ?? '味都美')
      if (item.key === 'shop_phone') shop.phone = String(item.value ?? '')
      if (item.key === 'shop_address') shop.address = String(item.value ?? '')
    })
  } catch {
    // 参数读不到就用默认店名，不影响打印
  }
}

const printVisible = ref(false)
const printPaper = ref<SalesPaper>('half')
const printIds = ref<number[]>([])
const printing = ref(false)

const printableOrders = computed(() => {
  const idSet = new Set(printIds.value)
  return list.value.filter((o) => idSet.has(o.id) && ['pending', 'delivering', 'delivered'].includes(o.status))
})

function openPrintModal(ids: number[]) {
  if (ids.length > 200) {
    message.warning('单次最多 200 张，请分批打印')
    return
  }
  printIds.value = [...ids]
  printPaper.value = 'half'
  printVisible.value = true
}

async function submitPrint() {
  if (printing.value) return
  const orders = printableOrders.value.slice(0, 200)
  if (!orders.length) {
    message.warning('选中的订单当前状态不可打印')
    return
  }
  printing.value = true
  try {
    const notes = await orderApi.salesNotes(orders.map((o) => o.id))
    const groups = new Map<SalesNoteDocType, number[]>()
    notes.forEach((note) => {
      const docType = note.doc_type as SalesNoteDocType
      const group = groups.get(docType) || []
      group.push(note.order_id)
      groups.set(docType, group)
    })
    const records = new Map<number, PrintRecordResult>()
    for (const [docType, groupIds] of groups) {
      const result = await orderApi.recordPrint(groupIds, docType)
      result.forEach((item) => records.set(item.order_id, item))
    }
    const merged: SalesNote[] = notes.map((note) => {
      const record = records.get(note.order_id)
      return {
        ...note,
        is_reprint: record?.is_reprint ?? note.is_reprint,
        print_count: record?.print_count ?? note.print_count + 1,
        last_printed_at: record?.last_printed_at ?? note.last_printed_at,
      }
    })
    const result = printHtml(renderSalesNotes(merged, {
      shopName: shop.name,
      shopPhone: shop.phone,
      shopAddress: shop.address,
      printedAt: formatDateTime(new Date().toISOString()),
      operatorName: '管理员',
      paper: printPaper.value,
    }))
    if (!result.ok) message.warning('打印窗口没有打开，请允许本站弹出窗口后重试')
    printVisible.value = false
    await load()
  } catch (error) {
    message.error(errorText(error))
  } finally {
    printing.value = false
  }
}

function errorText(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
  return detail || (error as Error)?.message || '操作失败'
}

// ---------- 详情抽屉 ----------
const drawerVisible = ref(false)
const drawerOrder = ref<OrderListItem | null>(null)
const drawerItemColumns = [
  { title: '商品', key: 'spu_name', minWidth: 140 },
  { title: '规格', key: 'sku_spec', width: 90 },
  { title: '数量', key: 'quantity', width: 80, render: (r: any) => `${r.quantity} ${r.unit}` },
  { title: '金额', key: 'amount', width: 90, render: (r: any) => `¥${formatNum(r.amount)}` },
]

async function openDrawer(row: OrderListItem) {
  drawerOrder.value = row
  drawerVisible.value = true
  try {
    drawerOrder.value = await orderApi.get(row.id)
  } catch {
    // 保留摘要展示
  }
}

onMounted(async () => {
  const modeParam = route.query.delivery_mode
  if (typeof modeParam === 'string' && ['freight', 'route', 'local', 'pickup', 'pool'].includes(modeParam)) {
    quick.value = modeParam as QuickKey
  }
  await Promise.all([
    load(),
    loadShop(),
    deliveryApi.freightLines().then((rows) => { freightLines.value = rows }),
    routeTripApi.list({ status: 'planned', page_size: 100 }).then((res) => { plannedTrips.value = res.items }),
    regionApi.tree().then((tree) => { regions.value = tree }),
    adminCustomerApi.salesOptions().then((rows) => {
      salesOptions.value = rows.map((u) => ({
        label: u.is_admin ? `管理员·${u.name}` : u.name,
        value: u.id,
      }))
    }),
  ])
})
</script>

<style scoped>
.page-container { min-width: 0; }
.card-section { min-width: 0; overflow: hidden; }
.title-line { display: flex; align-items: baseline; gap: 10px; }
.result-count { font-size: 13px; color: var(--text-3); }
.block-alert { margin-bottom: 12px; }
.quick-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 12px; }
.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 14px;
  margin-bottom: 12px;
  border-radius: 8px;
  background: var(--bg-subtle, rgba(79, 70, 229, 0.06));
  border: 1px solid var(--border);
}
.batch-count { font-size: 13px; }
.batch-groups { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.batch-divider { width: 1px; height: 18px; background: var(--border); }
.pagination-bar { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; font-size: 12px; color: var(--text-3); }
.row-actions { display: flex; align-items: center; gap: 8px; }
.muted { color: var(--text-3); font-size: 12px; }
.handover-tip { font-size: 12px; color: var(--text-3); margin-bottom: 12px; }
.handover-total-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.handover-list { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; max-height: 360px; overflow-y: auto; }
.handover-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 90px 130px 120px;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-top: 1px solid var(--border);
}
.handover-row:first-child { border-top: 0; }
.handover-info { display: flex; flex-direction: column; gap: 2px; }
.handover-amount { font-weight: 600; text-align: right; }
</style>
