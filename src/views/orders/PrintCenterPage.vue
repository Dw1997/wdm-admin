<template>
  <div class="page-container print-center-page">
    <div v-if="noPermission" class="card-section">
      <h2 class="page-title">打印中心</h2>
      <n-alert type="warning" :bordered="false" style="margin-top: 12px">
        只有管理员可以打印。请用管理员账号登录，或联系店家开通权限。
      </n-alert>
      <n-button style="margin-top: 12px" @click="router.push('/dashboard')">回数据看板</n-button>
    </div>

    <template v-else>
      <!-- 模式切换 -->
      <div class="card-section mode-bar">
        <div class="modes">
          <button type="button" class="mode" :class="{ active: mode === 'sales' }" @click="mode = 'sales'">
            <span>销售单</span>
            <small>针式打印机 · 241×140 二联复写</small>
          </button>
          <button type="button" class="mode" :class="{ active: mode === 'picking' }" @click="enterPicking">
            <span>捡货单</span>
            <small>A4 · 一个 SKU 一行 · 数量用 + 连接</small>
          </button>
        </div>
        <div class="mode-hint">
          <span>{{ mode === 'sales' ? '针式打印机 · 二联复写纸 · 一张纸两张单' : 'A4 纵向 · 一个 SKU 一行 · 不记打印次数' }}</span>
          <n-button text type="primary" size="small" @click="setupVisible = true">打印机设置</n-button>
        </div>
      </div>

      <!-- 模式一：销售单 -->
      <template v-if="mode === 'sales'">
        <div class="card-section filter-card">
          <div class="filter-grid">
            <div class="filter-item">
              <label>日期</label>
              <div class="date-line">
                <n-button-group size="small">
                  <n-button :type="quick === 'today' ? 'primary' : 'default'" @click="applyQuick('today')">今天</n-button>
                  <n-button :type="quick === 'yesterday' ? 'primary' : 'default'" @click="applyQuick('yesterday')">昨天</n-button>
                </n-button-group>
                <n-date-picker
                  v-model:value="customRange"
                  type="daterange"
                  size="small"
                  clearable
                  style="width: 230px"
                  @update:value="onCustomRange"
                />
              </div>
            </div>
            <div class="filter-item">
              <label>打印状态</label>
              <n-select v-model:value="filters.printed" :options="printedOptions" size="small" />
            </div>
            <div class="filter-item">
              <label>订单状态</label>
              <n-select v-model:value="filters.status" :options="statusOptions" size="small" />
            </div>
            <div class="filter-item">
              <label>配送方式</label>
              <n-select
                v-model:value="filters.deliveryModes"
                multiple
                :options="deliveryModeOptions"
                :max-tag-count="2"
                clearable
                size="small"
                placeholder="全部"
              />
            </div>
            <div class="filter-item">
              <label>出车趟次</label>
              <n-select
                v-model:value="filters.tripId"
                :options="tripOptions"
                clearable
                filterable
                size="small"
                placeholder="全部"
              />
            </div>
            <div class="filter-item">
              <label>物流批次</label>
              <n-select
                v-model:value="filters.shipmentId"
                :options="shipmentOptions"
                clearable
                filterable
                size="small"
                placeholder="全部"
              />
            </div>
            <div class="filter-item">
              <label>来源</label>
              <n-select v-model:value="filters.source" :options="sourceOptions" clearable size="small" placeholder="全部" />
            </div>
            <div class="filter-item keyword">
              <label>关键词</label>
              <n-input
                v-model:value="filters.keyword"
                clearable
                size="small"
                placeholder="订单号 / 客户名称 / 手机号"
                @keyup.enter="search"
              />
            </div>
            <div class="filter-actions">
              <n-button size="small" @click="resetSales">重置</n-button>
              <n-button size="small" type="primary" :loading="loading" @click="search">查询</n-button>
            </div>
          </div>
        </div>

        <div class="card-section list-card">
          <div class="list-head">
            <div>
              <h2 class="page-title">待打印订单</h2>
              <span class="result-count">
                {{ filters.tripId ? '按站点顺序排列，与装车、送货顺序一致' : '按下单时间排列，先录的先打' }} · 共
                {{ total }} 张
              </span>
            </div>
            <div class="head-actions">
              <n-select
                v-model:value="paper"
                :options="paperOptions"
                size="small"
                style="width: 140px"
              />
              <n-button size="small" :loading="loading" @click="loadOrders">刷新</n-button>
            </div>
          </div>
          <n-data-table
            :columns="columns"
            :data="rows"
            :loading="loading"
            :bordered="false"
            :row-key="(row: OrderListItem) => row.id"
            :checked-row-keys="checkedKeys"
            size="small"
            :scroll-x="1080"
            @update:checked-row-keys="onCheckedChange"
          />
          <div class="pagination-bar">
            <span>每页 {{ pageSize }} 条</span>
            <n-pagination
              v-model:page="page"
              :page-size="pageSize"
              :item-count="total"
              show-quick-jumper
              @update:page="loadOrders"
            />
          </div>
        </div>

        <div class="print-bar">
          <div class="bar-inner">
            <div class="bar-stat">
              已选 <b>{{ checkedKeys.length }}</b> 张
              <span v-if="selectedReprint" class="sub">其中补打 {{ selectedReprint }} 张</span>
            </div>
            <div class="bar-stat">
              预计用纸 <b>{{ paperCount }}</b> 张
              <span class="sub">（{{ paper === 'half' ? '241×140 二联，一张纸两张单' : '241×280 整张，一张纸一张单' }}）</span>
            </div>
            <span class="sub">单次最多 200 张</span>
            <span class="spacer"></span>
            <n-button :disabled="!checkedKeys.length" @click="checkedKeys = []">清空</n-button>
            <n-button
              type="primary"
              :disabled="!checkedKeys.length || printing"
              :loading="printing"
              @click="askPrintSales"
            >
              打印选中
            </n-button>
          </div>
        </div>
      </template>

      <!-- 模式二：捡货单 -->
      <template v-else>
        <div class="card-section scope-card">
          <div class="scope-grid">
            <label class="scope" :class="{ on: scope === 'trip' }">
              <input v-model="scope" type="radio" value="trip" @change="loadPicking" />
              <div class="scope-body">
                <b>按出车趟次</b>
                <n-select
                  v-model:value="tripId"
                  :options="tripOptions"
                  size="small"
                  filterable
                  placeholder="选择趟次"
                  @update:value="onScopeTrip"
                />
              </div>
            </label>
            <label class="scope" :class="{ on: scope === 'shipment' }">
              <input v-model="scope" type="radio" value="shipment" @change="loadPicking" />
              <div class="scope-body">
                <b>按物流批次</b>
                <n-select
                  v-model:value="shipmentId"
                  :options="shipmentOptions"
                  size="small"
                  filterable
                  placeholder="选择批次"
                  @update:value="onScopeShipment"
                />
              </div>
            </label>
            <label class="scope" :class="{ on: scope === 'unassigned' }">
              <input v-model="scope" type="radio" value="unassigned" @change="loadPicking" />
              <div class="scope-body">
                <b>未排车 + 城区自送</b>
                <div class="scope-note">还没排进趟次或物流批次、以及城区自送的订单，按订单号排</div>
              </div>
            </label>
          </div>
          <div class="scope-foot">
            只汇总需要出库配送的订单：现场提货、门店零售、已取消、已送达的订单不参与。数量取订单行的下单数量。
          </div>
        </div>

        <div class="stat-grid">
          <div class="stat-box">
            <div class="stat-k">涉及订单</div>
            <div class="stat-v">{{ picking?.summary.order_count || 0 }} <span class="sub">单</span></div>
          </div>
          <div class="stat-box">
            <div class="stat-k">SKU 行</div>
            <div class="stat-v">{{ picking?.summary.sku_count || 0 }} <span class="sub">行</span></div>
          </div>
          <div class="stat-box">
            <div class="stat-k">商品</div>
            <div class="stat-v">{{ picking?.summary.spu_count || 0 }} <span class="sub">个</span></div>
          </div>
        </div>

        <div class="card-section">
          <div class="list-head">
            <div>
              <h2 class="page-title">商品汇总</h2>
              <span class="result-count">{{ pickingScopeLabel }}</span>
            </div>
            <div class="head-actions">
              <n-button size="small" :loading="pickingLoading" @click="loadPicking">重新汇总</n-button>
              <n-button
                type="primary"
                size="small"
                :disabled="!picking?.items.length || pickingLoading"
                @click="openPickingPreview"
              >
                打印捡货单（A4）
              </n-button>
            </div>
          </div>
          <n-alert v-if="pickingError" type="error" :bordered="false" style="margin-bottom: 10px">
            {{ pickingError }}
          </n-alert>
          <div class="agg-wrap">
            <table class="agg-table">
              <thead>
                <tr>
                  <th style="width: 56px">序号</th>
                  <th style="width: 150px">商品</th>
                  <th style="width: 90px">规格</th>
                  <th style="width: 62px">单位</th>
                  <th>各订单数量（按配送顺序）</th>
                  <th style="width: 110px">合计</th>
                  <th style="width: 118px">折合基础数量</th>
                  <th style="width: 76px">订单数</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in aggRows" :key="row.item.sku_id">
                  <td class="num">{{ row.seq }}</td>
                  <td v-if="row.first" class="spu" :rowspan="row.rowspan">{{ row.item.spu_name }}</td>
                  <td>{{ row.item.sku_spec }}</td>
                  <td>{{ row.item.unit }}</td>
                  <td class="plus" :title="segmentTitle(row.item)">{{ plusText(row.item) }}</td>
                  <td class="total">{{ formatQty(row.item.total_quantity) }} {{ row.item.unit }}</td>
                  <td class="conv">
                    {{ Number(row.item.base_qty) > 1 ? `${formatQty(row.item.total_base_qty)} ${row.item.base_unit}` : '—' }}
                  </td>
                  <td class="num">{{ row.item.order_count }}</td>
                </tr>
                <tr v-if="!aggRows.length">
                  <td colspan="8" class="empty">
                    {{ pickingLoading ? '汇总中…' : '该范围没有需要配送的订单' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </template>

    <!-- 销售单预览 -->
    <n-modal v-model:show="noteVisible" preset="card" style="width: 860px; max-width: 96vw">
      <template #header>
        <div class="modal-head">
          <b>销售单预览</b>
          <span class="sub">{{ previewNoteMeta }}</span>
        </div>
      </template>
      <template #header-extra>
        <div class="head-actions">
          <n-button size="small" :loading="printing" @click="printPreviewNote">打印此张</n-button>
        </div>
      </template>
      <div class="paper-scroll">
        <div class="paper-box" :style="noteStageStyle">
          <iframe :srcdoc="noteHtml" class="paper-frame" :style="noteFrameStyle" title="销售单预览" />
        </div>
      </div>
    </n-modal>

    <!-- 捡货单预览 -->
    <n-modal v-model:show="pickingVisible" preset="card" style="width: 800px; max-width: 96vw">
      <template #header>
        <div class="modal-head">
          <b>捡货单预览</b>
          <span class="sub">A4 纵向 · 不记打印次数</span>
        </div>
      </template>
      <template #header-extra>
        <div class="head-actions">
          <n-button size="small" type="primary" @click="printPicking">打印</n-button>
        </div>
      </template>
      <div class="paper-scroll">
        <div class="paper-box" :style="pickingStageStyle">
          <iframe :srcdoc="pickingHtml" class="paper-frame" :style="pickingFrameStyle" title="捡货单预览" />
        </div>
      </div>
    </n-modal>

    <!-- 打印确认 -->
    <n-modal v-model:show="confirmVisible" preset="card" title="确认打印" style="width: 460px; max-width: 94vw">
      <div class="confirm-text">
        将连续打印 <b>{{ checkedKeys.length }}</b> 张，其中补打 <b>{{ selectedReprint }}</b> 张，预计用纸
        <b>{{ paperCount }}</b> 张。
        <p>
          确认后请在浏览器打印窗口选择针式打印机和
          <b>{{ paper === 'half' ? '241×140' : '241×280' }}</b> 纸张，边距“无”、缩放 100%。
        </p>
      </div>
      <template #footer>
        <div class="modal-actions">
          <n-button @click="confirmVisible = false">取消</n-button>
          <n-button type="primary" :loading="printing" @click="printSelected">确认打印</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 打印机设置 -->
    <n-modal v-model:show="setupVisible" preset="card" title="打印机设置" style="width: 560px; max-width: 94vw">
      <div class="setup">
        <h3>1. 建针式纸张（只需一次）</h3>
        <ol>
          <li>Windows：打印机和扫描仪 → 打印机属性 → 首选项 → 纸张大小 → 自定义</li>
          <li>新建 <b>241 × 140 mm</b>（二等分）和 <b>241 × 280 mm</b>（整张）两种</li>
        </ol>
        <h3>2. 浏览器打印窗口</h3>
        <ol>
          <li>纸张选自定义规格，边距选“无”，缩放 100%</li>
          <li>关闭“页眉和页脚”“背景图形”</li>
        </ol>
        <h3>3. A4 捡货单</h3>
        <ol>
          <li>普通 A4 纵向、边距默认即可</li>
        </ol>
        <p class="sub">二联纸装纸时对齐撕纸线；系统每页就是半张纸，打印完自动走纸到下一等分。</p>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NTag, useMessage, type DataTableColumns, type SelectOption } from 'naive-ui'
import dayjs from 'dayjs'
import { freightShipmentApi, orderApi, routeTripApi, systemSettingApi } from '@/api'
import type {
  FreightShipment,
  OrderListItem,
  PickingItem,
  PickingResult,
  PickingScopeType,
  RouteTrip,
  SalesNote,
  SalesNoteDocType,
} from '@/types'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/format'
import { actionIcon } from '@/components/tableActions'
import { mmToPx, printHtml } from '@/utils/print'
import {
  formatQty,
  renderPickingSheet,
  renderSalesNotes,
  type SalesPaper,
} from './printTemplates'

const router = useRouter()
const message = useMessage()
const auth = useAuthStore()
const noPermission = computed(() => !!auth.user && auth.user.role !== 'admin')

const mode = ref<'sales' | 'picking'>('sales')
const paper = ref<SalesPaper>('half')
const paperOptions = [
  { label: '二等分 241×140', value: 'half' },
  { label: '整张 241×280', value: 'full' },
]

// ---------- 销售单 ----------
const today = dayjs().format('YYYY-MM-DD')
const rows = ref<OrderListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const printing = ref(false)
const checkedKeys = ref<number[]>([])
const quick = ref<'today' | 'yesterday' | 'custom'>('today')
const customRange = ref<[number, number] | null>([dayjs().startOf('day').valueOf(), dayjs().endOf('day').valueOf()])
const filters = reactive<{
  printed: '' | 'true' | 'false'
  status: string
  deliveryModes: string[]
  tripId: number | null
  shipmentId: number | null
  source: string | null
  keyword: string
}>({
  printed: '',
  status: 'pending,delivering',
  deliveryModes: [],
  tripId: null,
  shipmentId: null,
  source: null,
  keyword: '',
})

const printedOptions = [
  { label: '全部', value: '' },
  { label: '待打印', value: 'false' },
  { label: '已打印（补打）', value: 'true' },
]
const statusOptions = [
  { label: '待配送 + 配送中', value: 'pending,delivering' },
  { label: '已送达', value: 'delivered' },
  { label: '全部可打印', value: 'pending,delivering,delivered' },
]
const deliveryModeOptions = [
  { label: '跟车送', value: 'route' },
  { label: '物流', value: 'freight' },
  { label: '城区自送', value: 'local' },
  { label: '现场提货', value: 'pickup' },
]
const sourceOptions = [
  { label: '线路询单', value: 'route_call' },
  { label: '客户来电', value: 'phone_in' },
  { label: '小程序', value: 'miniprogram' },
  { label: '门店零售', value: 'counter' },
]
const docLabel: Record<string, string> = {
  route_call: '送货单',
  phone_in: '送货单',
  miniprogram: '送货单',
  counter: '门店零售销售单',
}

const trips = ref<RouteTrip[]>([])
const shipments = ref<FreightShipment[]>([])
const tripOptions = computed<SelectOption[]>(() =>
  trips.value.map(trip => ({
    label: `${dayjs(trip.trip_date).format('MM-DD')} ${trip.name || '出车'} · ${trip.owner_name}`,
    value: trip.id,
  })),
)
const shipmentOptions = computed<SelectOption[]>(() =>
  shipments.value.map(shipment => ({
    label: `${dayjs(shipment.ship_date).format('MM-DD')} ${shipment.line_name}（${shipment.order_count} 单）`,
    value: shipment.id,
  })),
)

const dateRange = computed<[string, string]>(() => {
  if (quick.value === 'custom' && customRange.value) {
    return [
      dayjs(customRange.value[0]).startOf('day').format('YYYY-MM-DD HH:mm:ss'),
      dayjs(customRange.value[1]).endOf('day').format('YYYY-MM-DD HH:mm:ss'),
    ]
  }
  const day = dayjs().subtract(quick.value === 'yesterday' ? 1 : 0, 'day')
  return [day.startOf('day').format('YYYY-MM-DD HH:mm:ss'), day.endOf('day').format('YYYY-MM-DD HH:mm:ss')]
})

const selectedReprint = computed(
  () => rows.value.filter(row => checkedKeys.value.includes(row.id) && (row.print_count || 0) > 0).length,
)
const paperCount = computed(() =>
  paper.value === 'half'
    ? Math.ceil(checkedKeys.value.length / 2)
    : checkedKeys.value.length,
)

function applyQuick(value: 'today' | 'yesterday') {
  quick.value = value
  customRange.value = null
  page.value = 1
  loadOrders()
}

function onCustomRange(value: [number, number] | null) {
  quick.value = value ? 'custom' : 'today'
  if (!value) customRange.value = [dayjs().startOf('day').valueOf(), dayjs().endOf('day').valueOf()]
  page.value = 1
  loadOrders()
}

function search() {
  page.value = 1
  loadOrders()
}

function resetSales() {
  quick.value = 'today'
  customRange.value = [dayjs().startOf('day').valueOf(), dayjs().endOf('day').valueOf()]
  filters.printed = ''
  filters.status = 'pending,delivering'
  filters.deliveryModes = []
  filters.tripId = null
  filters.shipmentId = null
  filters.source = null
  filters.keyword = ''
  page.value = 1
  checkedKeys.value = []
  loadOrders()
}

function onCheckedChange(keys: Array<string | number>) {
  checkedKeys.value = keys.map(Number)
}

function deliveryPlace(row: OrderListItem) {
  if (row.delivery_mode === 'pickup') return '现场提货'
  if (row.delivery_mode === 'local') return '城区自送'
  if (row.delivery_mode === 'freight') {
    return row.delivery_region_name ? `物流 · ${row.delivery_region_name}` : '物流'
  }
  return row.delivery_region_name || '跟车送'
}

const columns = computed<DataTableColumns<OrderListItem>>(() => [
  { type: 'selection' },
  { title: '订单号', key: 'order_no', width: 150 },
  {
    title: '客户 / 电话',
    key: 'customer_name',
    width: 190,
    render: row =>
      h('div', [
        h('div', row.customer_name || '—'),
        h('small', { class: 'muted' }, row.customer_phone || ''),
      ]),
  },
  { title: '送货地点', key: 'delivery_place', width: 150, render: row => deliveryPlace(row) },
  {
    title: '单据类型',
    key: 'doc_type',
    width: 140,
    render: row =>
      h(
        NTag,
        { size: 'small', type: row.source === 'counter' ? 'default' : 'info', bordered: false },
        { default: () => docLabel[row.source] || '送货单' },
      ),
  },
  {
    title: '金额',
    key: 'total_amount',
    width: 110,
    align: 'right',
    render: row => `¥${Number(row.total_amount || 0).toFixed(2)}`,
  },
  { title: '下单时间', key: 'created_at', width: 150, render: row => formatDate(row.created_at) },
  {
    title: '打印',
    key: 'print_count',
    width: 150,
    render: row => {
      const count = row.print_count || 0
      if (!count) return h('span', { class: 'muted' }, '未打印')
      return h('div', [
        h('span', { class: 'reprint' }, `已打 ${count} 次`),
        h('small', { class: 'muted block' }, formatDate(row.last_printed_at, 'MM-DD HH:mm')),
      ])
    },
  },
  {
    title: '',
    key: 'action',
    width: 56,
    render: row => actionIcon({ icon: 'view', label: '预览', onClick: () => openNotePreview(row) }),
  },
])

async function loadOrders() {
  loading.value = true
  try {
    const [from, to] = dateRange.value
    const result = await orderApi.list({
      page: page.value,
      page_size: pageSize,
      keyword: filters.keyword || undefined,
      status: filters.status || undefined,
      source: filters.source || undefined,
      delivery_mode: filters.deliveryModes.length ? filters.deliveryModes.join(',') : undefined,
      route_trip_id: filters.tripId ?? undefined,
      freight_shipment_id: filters.shipmentId ?? undefined,
      printed: filters.printed === '' ? undefined : filters.printed === 'true',
      created_at_from: from,
      created_at_to: to,
    })
    rows.value = result.items
    total.value = result.total
  } catch {
    rows.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

// ---------- 单据渲染与打印 ----------
const shop = reactive({ name: '味都美', phone: '', address: '' })
const operatorName = computed(() => auth.user?.real_name || auth.user?.username || '管理员')

async function loadShop() {
  try {
    const items = await systemSettingApi.list()
    items.forEach(item => {
      if (item.key === 'shop_name') shop.name = String(item.value ?? '味都美')
      if (item.key === 'shop_phone') shop.phone = String(item.value ?? '')
      if (item.key === 'shop_address') shop.address = String(item.value ?? '')
    })
  } catch {
    // 参数读不到就用默认店名，不影响打印
  }
}

function salesOptions(printedAt: string) {
  return {
    shopName: shop.name,
    shopPhone: shop.phone,
    shopAddress: shop.address,
    printedAt,
    operatorName: operatorName.value,
    paper: paper.value,
  }
}

const noteVisible = ref(false)
const noteHtml = ref('')
const previewNote = ref<SalesNote | null>(null)
const previewNoteMeta = computed(() => {
  const note = previewNote.value
  if (!note) return ''
  const size = paper.value === 'half' ? '241×140 · 二联复写' : '241×280 · 整张'
  return `${note.order_no} · ${size}${note.is_reprint ? ' · 补打' : ''}`
})

async function openNotePreview(row: OrderListItem) {
  try {
    const [note] = await orderApi.salesNotes([row.id])
    if (!note) return
    previewNote.value = note
    noteHtml.value = renderSalesNotes([note], salesOptions(dayjs().format('YYYY-MM-DD HH:mm')))
    noteVisible.value = true
  } catch (error) {
    message.error(errorText(error))
  }
}

async function printPreviewNote() {
  const note = previewNote.value
  if (!note || printing.value) return
  printing.value = true
  try {
    const records = await orderApi.recordPrint([note.order_id], note.doc_type as SalesNoteDocType)
    const record = records[0]
    const merged: SalesNote = {
      ...note,
      is_reprint: record?.is_reprint ?? note.is_reprint,
      print_count: record?.print_count ?? note.print_count + 1,
      last_printed_at: record?.last_printed_at ?? note.last_printed_at,
    }
    const result = printHtml(renderSalesNotes([merged], salesOptions(dayjs().format('YYYY-MM-DD HH:mm'))))
    if (!result.ok) message.warning('打印窗口没有打开，请允许本站弹出窗口后重试')
    noteVisible.value = false
    await loadOrders()
  } catch (error) {
    message.error(errorText(error))
  } finally {
    printing.value = false
  }
}

const confirmVisible = ref(false)

function askPrintSales() {
  if (!checkedKeys.value.length) {
    message.warning('先勾选要打印的订单')
    return
  }
  if (checkedKeys.value.length > 200) {
    message.warning('单次最多 200 张，请分批打印')
    return
  }
  confirmVisible.value = true
}

async function printSelected() {
  if (printing.value) return
  const ids = [...checkedKeys.value]
  if (!ids.length) return
  printing.value = true
  try {
    const notes = await orderApi.salesNotes(ids)
    const groups = new Map<SalesNoteDocType, number[]>()
    notes.forEach(note => {
      const docType = note.doc_type as SalesNoteDocType
      const group = groups.get(docType) || []
      group.push(note.order_id)
      groups.set(docType, group)
    })
    const records = new Map<number, { is_reprint: boolean; print_count: number; last_printed_at: string }>()
    for (const [docType, groupIds] of groups) {
      const result = await orderApi.recordPrint(groupIds, docType)
      result.forEach(item => records.set(item.order_id, item))
    }
    const merged: SalesNote[] = notes.map(note => {
      const record = records.get(note.order_id)
      return {
        ...note,
        is_reprint: record?.is_reprint ?? note.is_reprint,
        print_count: record?.print_count ?? note.print_count + 1,
        last_printed_at: record?.last_printed_at ?? note.last_printed_at,
      }
    })
    const result = printHtml(renderSalesNotes(merged, salesOptions(dayjs().format('YYYY-MM-DD HH:mm'))))
    if (!result.ok) message.warning('打印窗口没有打开，请允许本站弹出窗口后重试')
    confirmVisible.value = false
    checkedKeys.value = []
    await loadOrders()
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

// ---------- 捡货单 ----------
const scope = ref<PickingScopeType>('trip')
const tripId = ref<number | null>(null)
const shipmentId = ref<number | null>(null)
const picking = ref<PickingResult | null>(null)
const pickingLoading = ref(false)
const pickingError = ref('')
const pickingLoaded = ref(false)
const pickingVisible = ref(false)
const pickingHtml = ref('')

const pickingScopeLabel = computed(() => {
  if (scope.value === 'trip') {
    const trip = trips.value.find(item => item.id === tripId.value)
    return trip ? `${dayjs(trip.trip_date).format('YYYY-MM-DD')} ${trip.name || '出车'} · ${trip.owner_name}` : '未选择趟次'
  }
  if (scope.value === 'shipment') {
    const shipment = shipments.value.find(item => item.id === shipmentId.value)
    return shipment ? `${dayjs(shipment.ship_date).format('YYYY-MM-DD')} ${shipment.line_name}` : '未选择批次'
  }
  return '未排车 + 城区自送（全部）'
})

const aggRows = computed(() => {
  const items = picking.value?.items || []
  const result: { item: PickingItem; seq: number; first: boolean; rowspan: number }[] = []
  let index = 0
  while (index < items.length) {
    let end = index
    while (end < items.length && items[end].spu_name === items[index].spu_name) end += 1
    for (let i = index; i < end; i += 1) {
      result.push({ item: items[i], seq: i + 1, first: i === index, rowspan: end - index })
    }
    index = end
  }
  return result
})

function plusText(item: PickingItem) {
  return `${item.segments.map(seg => formatQty(seg.quantity)).join('+')} ${item.unit}`
}

function segmentTitle(item: PickingItem) {
  return item.segments
    .map(seg => `${seg.order_no} ${seg.customer_name} ${formatQty(seg.quantity)}${item.unit}`)
    .join(' · ')
}

async function loadPicking() {
  if (scope.value === 'trip' && !tripId.value) {
    picking.value = null
    return
  }
  if (scope.value === 'shipment' && !shipmentId.value) {
    picking.value = null
    return
  }
  pickingLoading.value = true
  pickingError.value = ''
  try {
    picking.value = await orderApi.picking(
      scope.value === 'trip'
        ? { route_trip_id: tripId.value as number }
        : scope.value === 'shipment'
          ? { freight_shipment_id: shipmentId.value as number }
          : { unassigned: true },
    )
    pickingLoaded.value = true
  } catch (error) {
    picking.value = null
    pickingError.value = errorText(error)
  } finally {
    pickingLoading.value = false
  }
}

function onScopeTrip(value: number | null) {
  tripId.value = value
  scope.value = 'trip'
  loadPicking()
}

function onScopeShipment(value: number | null) {
  shipmentId.value = value
  scope.value = 'shipment'
  loadPicking()
}

async function enterPicking() {
  mode.value = 'picking'
  if (pickingLoaded.value) return
  if (!tripId.value) {
    const todayTrips = trips.value.filter(trip => trip.status === 'planned' || trip.status === 'delivering')
    if (todayTrips.length) {
      tripId.value = todayTrips[0].id
      scope.value = 'trip'
    } else {
      scope.value = 'unassigned'
    }
  }
  await loadPicking()
}

function openPickingPreview() {
  if (!picking.value?.items.length) return
  pickingHtml.value = renderPickingSheet(picking.value, {
    scopeLabel: pickingScopeLabel.value,
    printedAt: dayjs().format('YYYY-MM-DD HH:mm'),
    operatorName: operatorName.value,
  })
  pickingVisible.value = true
}

function printPicking() {
  if (!pickingHtml.value) return
  const result = printHtml(pickingHtml.value)
  if (!result.ok) message.warning('打印窗口没有打开，请允许本站弹出窗口后重试')
  pickingVisible.value = false
}

// ---------- 预览尺寸 ----------
const PAPER_SIZE = {
  half: { w: mmToPx(241), h: mmToPx(140), scale: 0.72 },
  full: { w: mmToPx(241), h: mmToPx(280), scale: 0.5 },
  a4: { w: mmToPx(210), h: mmToPx(297), scale: 0.72 },
}

function pageCount(html: string) {
  return Math.max(1, (html.match(/class="sheet"/g) || []).length)
}

const noteFrameStyle = computed(() => {
  const size = paper.value === 'full' ? PAPER_SIZE.full : PAPER_SIZE.half
  return {
    width: `${size.w}px`,
    height: `${size.h * pageCount(noteHtml.value)}px`,
    transform: `scale(${size.scale})`,
  }
})
const noteStageStyle = computed(() => {
  const size = paper.value === 'full' ? PAPER_SIZE.full : PAPER_SIZE.half
  const height = size.h * pageCount(noteHtml.value)
  return { width: `${size.w * size.scale}px`, height: `${height * size.scale}px` }
})
const pickingFrameStyle = computed(() => ({
  width: `${PAPER_SIZE.a4.w}px`,
  height: `${PAPER_SIZE.a4.h * pageCount(pickingHtml.value)}px`,
  transform: `scale(${PAPER_SIZE.a4.scale})`,
}))
const pickingStageStyle = computed(() => {
  const height = PAPER_SIZE.a4.h * pageCount(pickingHtml.value)
  return { width: `${PAPER_SIZE.a4.w * PAPER_SIZE.a4.scale}px`, height: `${height * PAPER_SIZE.a4.scale}px` }
})

// ---------- 初始化 ----------
async function loadOptions() {
  const from = dayjs().subtract(3, 'day').format('YYYY-MM-DD')
  const to = dayjs().add(7, 'day').format('YYYY-MM-DD')
  const [tripResult, shipmentResult] = await Promise.all([
    routeTripApi.list({ date_from: from, date_to: to, page_size: 100 }).catch(() => null),
    freightShipmentApi.list({ date_from: from, date_to: to, page_size: 100 }).catch(() => null),
  ])
  trips.value = tripResult?.items || []
  shipments.value = shipmentResult?.items || []
}

onMounted(async () => {
  if (noPermission.value) return
  await Promise.all([loadShop(), loadOptions(), loadOrders()])
})
</script>

<style scoped>
.print-center-page {
  padding-bottom: 88px;
}
.mode-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.modes {
  display: flex;
  gap: 10px;
}
.mode {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 9px 16px;
  min-width: 200px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-2);
  cursor: pointer;
  text-align: left;
}
.mode span {
  font-weight: 700;
  font-size: 14px;
}
.mode small {
  font-size: 11px;
  color: var(--text-3);
}
.mode.active {
  border-color: var(--primary);
  background: var(--primary-soft, #eef0ff);
  color: var(--primary);
}
.mode.active small {
  color: var(--primary);
  opacity: 0.8;
}
.mode-hint {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
  color: var(--text-3);
}
.filter-card {
  margin-bottom: 12px;
}
.filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px 14px;
  align-items: end;
}
.filter-item label {
  display: block;
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 6px;
}
.date-line {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.list-card {
  min-height: 320px;
}
.list-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.list-head .result-count {
  margin-left: 8px;
  font-size: 12px;
  color: var(--text-3);
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.muted {
  color: var(--text-3);
}
.block {
  display: block;
}
.reprint {
  color: #e46d19;
  font-weight: 600;
}
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-3);
}
.print-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: var(--wdm-sider-width, 220px);
  z-index: 20;
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.08);
  padding: 10px 16px;
}
.bar-inner {
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--text-2);
}
.bar-stat b {
  font-size: 17px;
  font-variant-numeric: tabular-nums;
}
.sub {
  color: var(--text-3);
  font-size: 12px;
}
.spacer {
  flex: 1;
}
.scope-card {
  margin-bottom: 12px;
}
.scope-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.scope {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
}
.scope.on {
  border-color: var(--primary);
  background: var(--primary-soft, #fafaff);
}
.scope input {
  margin-top: 4px;
}
.scope-body {
  flex: 1;
  min-width: 0;
}
.scope-body b {
  display: block;
  font-size: 13px;
  margin-bottom: 7px;
}
.scope-note {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.6;
}
.scope-foot {
  margin-top: 11px;
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.55;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.stat-box {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 16px;
}
.stat-k {
  font-size: 12px;
  color: var(--text-3);
}
.stat-v {
  font-size: 22px;
  font-weight: 700;
  margin-top: 3px;
}
.agg-wrap {
  overflow: auto;
}
.agg-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  font-size: 13px;
}
.agg-table th {
  background: var(--bg-page);
  color: var(--text-3);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  padding: 9px 10px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.agg-table td {
  padding: 10px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
.agg-table tr:hover td {
  background: #fbfcff;
}
.agg-table .spu {
  font-weight: 600;
}
.agg-table .plus {
  letter-spacing: 0.4px;
}
.agg-table .total {
  font-weight: 700;
}
.agg-table .conv {
  color: var(--text-3);
  font-size: 12px;
}
.agg-table .num {
  font-variant-numeric: tabular-nums;
}
.agg-table .empty {
  text-align: center;
  color: var(--text-3);
  padding: 32px 0;
}
.modal-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.paper-scroll {
  max-height: 72vh;
  overflow: auto;
  background: #eef0f4;
  border-radius: 8px;
  padding: 14px;
  display: flex;
  justify-content: center;
}
.paper-box {
  position: relative;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 8px 30px rgba(16, 24, 40, 0.19);
}
.paper-frame {
  position: absolute;
  top: 0;
  left: 0;
  border: 0;
  transform-origin: top left;
  background: #fff;
}
.confirm-text {
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-2);
}
.confirm-text p {
  margin: 10px 0 0;
  color: var(--text-3);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.setup {
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-2);
}
.setup h3 {
  font-size: 13px;
  margin: 0 0 4px;
  color: var(--text-1);
}
.setup ol {
  margin: 0 0 14px;
  padding-left: 20px;
}
.setup li {
  margin-bottom: 5px;
}
@media (max-width: 1360px) {
  .filter-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .scope-grid {
    grid-template-columns: 1fr;
  }
}
</style>
