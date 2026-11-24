<template>
  <div class="page-container dashboard">
    <!-- 顶栏：标题 + 日期 + 自动刷新状态 -->
    <div class="dash-header">
      <div class="dash-header-left">
        <h2 class="page-title">数据看板</h2>
        <span class="today-date">{{ todayDateText }}</span>
      </div>
      <div class="header-right">
        <span class="stamp">
          <i class="dot" />自动刷新 · 更新于 {{ stampText }}
        </span>
        <n-button size="small" :loading="refreshing" @click="manualRefresh">刷新</n-button>
      </div>
    </div>

    <n-alert v-if="overviewError" type="error" :bordered="false" class="dash-alert">
      看板数据加载失败：{{ overviewError }}
      <n-button text type="primary" style="margin-left: 8px" @click="loadOverview(true, false)">重试</n-button>
    </n-alert>

    <!-- 第一排：今日经营 KPI（5 列等宽） -->
    <n-spin :show="!overview && !overviewError">
      <section class="kpi-grid">
        <div class="kpi-card accent-primary" @click="go('/order-center/list', { date: 'today' })">
          <div class="kpi-top">
            <span class="kpi-label">今日销售额</span>
            <span class="kpi-arrow">›</span>
          </div>
          <div class="kpi-value">{{ formatYuan(today?.sales_amount) }}</div>
          <div class="kpi-sub">新下 <strong>{{ today?.sales_order_count ?? 0 }}</strong> 单 · 按下单日期</div>
        </div>

        <div class="kpi-card accent-amber" @click="go('/order-center/list', { status: 'pending' })">
          <div class="kpi-top">
            <span class="kpi-label">今日待配送</span>
            <span class="kpi-arrow">›</span>
          </div>
          <div class="kpi-value">{{ today?.pending_order_count ?? 0 }}<small>单</small></div>
          <div class="kpi-sub">待送金额 <strong>{{ formatYuan(today?.pending_amount) }}</strong></div>
        </div>

        <div class="kpi-card accent-indigo" @click="go('/delivery/trips')">
          <div class="kpi-top">
            <span class="kpi-label">今日出车</span>
            <span class="kpi-arrow">›</span>
          </div>
          <div class="kpi-value">{{ today?.trip_count ?? 0 }}<small>趟</small></div>
          <div class="kpi-sub">共 {{ today?.trip_order_count ?? 0 }} 单 · 已送达 <strong>{{ today?.trip_delivered_count ?? 0 }}</strong></div>
        </div>

        <div class="kpi-card accent-cyan" @click="go('/delivery/pool', { delivery_mode: 'freight' })">
          <div class="kpi-top">
            <span class="kpi-label">今日物流</span>
            <span class="kpi-arrow">›</span>
          </div>
          <div class="kpi-value">{{ today?.freight_order_count ?? 0 }}<small>单</small></div>
          <div class="kpi-sub">待交车 <strong :class="{ 'text-warn': (today?.freight_pending_count ?? 0) > 0 }">{{ today?.freight_pending_count ?? 0 }}</strong> 单</div>
        </div>

        <div class="kpi-card accent-green" @click="go('/finance/credit')">
          <div class="kpi-top">
            <span class="kpi-label">今日收款</span>
            <span class="kpi-arrow">›</span>
          </div>
          <div class="kpi-value text-profit">{{ formatYuan(today?.payment_amount) }}</div>
          <div class="kpi-sub">已扣除退款</div>
        </div>
      </section>
    </n-spin>

    <!-- 第二排：待办与审核工作区（3 列等高卡片） -->
    <section class="work-grid">
      <!-- 栏 1：要处理的事 -->
      <div class="work-card">
        <div class="card-head">
          <div class="card-head-title">
            <span>要处理的事</span>
            <span class="badge" :class="todoBadgeClass">{{ overview?.todos.length ?? 0 }}</span>
          </div>
          <span class="card-head-meta">点击直达处理</span>
        </div>
        <div class="card-body scroll-body">
          <div v-if="overview && !overview.todos.length" class="empty-box">
            今天没有待处理的事
          </div>
          <ul v-else class="list-rows">
            <li
              v-for="t in overview?.todos"
              :key="t.code"
              class="todo-row"
              @click="go(DASHBOARD_TODO[t.code].to)"
            >
              <span class="badge" :class="todoLevel(t)">{{ t.code === 'no_upcoming_trip' ? '!' : t.count }}</span>
              <div class="row-main">
                <div class="row-title">{{ todoTitle(t) }}</div>
                <div v-if="todoDesc(t)" class="row-sub">{{ todoDesc(t) }}</div>
              </div>
              <span class="row-link">{{ DASHBOARD_TODO[t.code].toLabel }} ›</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- 栏 2：待审核订单 -->
      <div class="work-card">
        <div class="card-head clickable" @click="go('/order-center/approvals')">
          <div class="card-head-title">
            <span>待审核订单</span>
            <span class="badge" :class="pendingOrdersCount > 0 ? 'warn' : 'zero'">{{ pendingOrdersCount }}</span>
          </div>
          <span class="card-head-link">去审批 ›</span>
        </div>
        <n-alert v-if="auditsError" type="error" :bordered="false" class="inline-alert">
          加载失败
          <n-button text size="tiny" type="primary" style="margin-left: 6px" @click="loadAudits(false)">重试</n-button>
        </n-alert>
        <n-spin :show="auditsLoading" class="card-body-spin">
          <div class="card-body scroll-body">
            <div v-if="!pendingOrders.length" class="empty-box clickable" @click="go('/order-center/approvals')">
              暂无待审核订单
            </div>
            <ul v-else class="list-rows">
              <li
                v-for="item in pendingOrders"
                :key="item.order.id"
                class="audit-row"
                @click="go('/order-center/approvals')"
              >
                <div class="row-main">
                  <div class="row-title">{{ item.order.customer_name }}</div>
                  <div class="row-sub">{{ item.order.order_no }}</div>
                </div>
                <div class="row-meta">
                  <div class="row-amt">{{ formatYuan(item.order.total_amount) }}</div>
                  <div class="row-sub" :class="{ 'wait-crit': item.waiting_hours >= 24 }">
                    {{ formatWaitingHours(item.waiting_hours) }}
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </n-spin>
      </div>

      <!-- 栏 3：待审核客户 -->
      <div class="work-card">
        <div class="card-head clickable" @click="go('/customers/audit')">
          <div class="card-head-title">
            <span>待审核客户</span>
            <span class="badge" :class="pendingCustomersCount > 0 ? 'warn' : 'zero'">{{ pendingCustomersCount }}</span>
          </div>
          <span class="card-head-link">去审核 ›</span>
        </div>
        <n-spin :show="auditsLoading" class="card-body-spin">
          <div class="card-body scroll-body">
            <div v-if="!pendingCustomers.length" class="empty-box clickable" @click="go('/customers/audit')">
              暂无待审核客户
            </div>
            <ul v-else class="list-rows">
              <li
                v-for="c in pendingCustomers"
                :key="c.id"
                class="audit-row"
                @click="go('/customers/audit')"
              >
                <div class="row-main">
                  <div class="row-title">{{ c.name }}</div>
                  <div class="row-sub">{{ customerContactText(c) }}</div>
                </div>
                <div class="row-meta">
                  <div class="row-source">{{ c.created_by ? '销售录入' : '小程序注册' }}</div>
                  <div class="row-sub">{{ formatShortTime(c.created_at) }}</div>
                </div>
              </li>
            </ul>
          </div>
        </n-spin>
      </div>
    </section>

    <!-- 第三排：资金与利润（左 7 栏资金组合 + 右 5 栏本月利润损益） -->
    <section class="finance-grid">
      <div class="finance-left">
        <div class="finance-top-pair">
          <div class="money-card" @click="go('/finance/credit')">
            <div class="kpi-top">
              <span class="kpi-label">客户欠款总额</span>
              <span class="kpi-arrow">›</span>
            </div>
            <div class="money-val">{{ formatYuan(money?.ar_total) }}</div>
            <div class="kpi-sub"><strong>{{ money?.ar_customer_count ?? 0 }}</strong> 位客户当前有欠款</div>
          </div>

          <div class="money-card" @click="go('/suppliers/transactions')">
            <div class="kpi-top">
              <span class="kpi-label">欠供应商逾期总额</span>
              <span class="kpi-arrow">›</span>
            </div>
            <div class="money-val" :class="{ 'text-crit': Number(money?.ap_overdue_total) > 0 }">
              {{ formatYuan(money?.ap_overdue_total) }}
            </div>
            <div class="kpi-sub">已逾期应付合计</div>
          </div>
        </div>

        <div
          class="money-card overdue-card"
          :class="{ crit: Number(money?.ar_overdue_total) > 0 }"
          @click="go('/finance/credit', { overdue: 'true' })"
        >
          <div class="overdue-head">
            <div>
              <div class="kpi-label">客户逾期总额（按账龄分布）</div>
              <div class="money-val">{{ formatYuan(money?.ar_overdue_total) }}</div>
            </div>
            <span class="card-head-link">查看逾期客户 ›</span>
          </div>
          <div class="bucket" role="img" aria-label="逾期账龄分布">
            <span v-for="b in buckets" :key="b.key" :class="'b-' + b.key" :style="{ width: b.pct + '%' }" />
          </div>
          <div class="legend">
            <span v-for="b in buckets" :key="b.key">
              <i :class="'sw-' + b.key" />{{ OVERDUE_BUCKET[b.key] }} <strong>{{ formatYuan(b.amount) }}</strong>
            </span>
          </div>
        </div>
      </div>

      <div class="money-card profit-card" @click="go('/finance/cost-center')">
        <div class="overdue-head">
          <div>
            <div class="kpi-label">本月利润{{ money ? `（${monthText} · 送达口径）` : '' }}</div>
            <div class="profit-val">{{ formatYuan(money?.month_profit.profit) }}</div>
          </div>
          <span class="card-head-link">成本中心 ›</span>
        </div>
        <div class="pl-list">
          <div class="pl-item">
            <span class="pl-k"><i class="pl-dot dot-sales" />本月销售额</span>
            <span class="pl-v">{{ formatYuan(money?.month_profit.sales_amount) }}</span>
          </div>
          <div class="pl-item">
            <span class="pl-k"><i class="pl-dot dot-cost" />商品成本</span>
            <span class="pl-v neg">−{{ formatYuan(money?.month_profit.goods_cost) }}</span>
          </div>
          <div class="pl-item">
            <span class="pl-k"><i class="pl-dot dot-freight" />发货运费</span>
            <span class="pl-v neg">−{{ formatYuan(money?.month_profit.freight_cost) }}</span>
          </div>
          <div class="pl-item">
            <span class="pl-k"><i class="pl-dot dot-op" />经营成本</span>
            <span class="pl-v neg">−{{ formatYuan(money?.month_profit.operating_cost) }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 第四排：趋势与排行（共享时间切换，2 行工整网格） -->
    <section class="analytics-section">
      <div class="analytics-head">
        <div class="analytics-title-wrap">
          <h3 class="section-heading">经营趋势与排行</h3>
          <span class="section-sub">按下单日期统计 · 点击排行条目可跳转查看</span>
        </div>
        <n-radio-group v-model:value="days" size="small" @update:value="() => loadCharts(false)">
          <n-radio-button :value="7">近 7 天</n-radio-button>
          <n-radio-button :value="30">近 30 天</n-radio-button>
        </n-radio-group>
      </div>

      <n-alert v-if="chartsError" type="error" :bordered="false" class="dash-alert">
        图表数据加载失败：{{ chartsError }}
        <n-button text type="primary" style="margin-left: 8px" @click="loadCharts(false)">重试</n-button>
      </n-alert>

      <!-- 上行：销售额趋势（7 栏） + 销售业绩前 5（5 栏） -->
      <div class="analytics-row top-analytics">
        <div class="panel">
          <div class="panel-head">
            <span class="panel-title">销售额趋势</span>
            <span class="panel-sub">单位：元</span>
          </div>
          <v-chart class="chart" :option="trendOption" autoresize />
        </div>

        <div class="panel">
          <div class="panel-head">
            <span class="panel-title">销售业绩排行</span>
            <span class="panel-sub">前 5 名</span>
          </div>
          <ol class="rank-list">
            <li
              v-for="(r, i) in salesRows"
              :key="r.id"
              class="rank-item"
              @click="go('/sales/dashboard', { sales_id: String(r.id) })"
            >
              <span class="rank-idx" :class="rankClass(i)">{{ i + 1 }}</span>
              <span class="rank-name" :title="r.name">{{ r.name }}</span>
              <span class="rank-amt">{{ formatYuan(r.amount) }}</span>
              <span class="rank-bar"><b :style="{ width: r.pct + '%' }" /></span>
            </li>
            <li v-if="!salesRows.length" class="rank-empty">暂无数据</li>
          </ol>
        </div>
      </div>

      <!-- 下行：热销商品前 10（6 栏） + 客户销售额前 10（6 栏） -->
      <div class="analytics-row bottom-analytics">
        <div class="panel">
          <div class="panel-head">
            <span class="panel-title">热销商品</span>
            <span class="panel-sub">按销售金额 · 前 10</span>
          </div>
          <ol class="rank-list">
            <li
              v-for="(r, i) in productRows"
              :key="r.id"
              class="rank-item"
              @click="go('/spus/list')"
            >
              <span class="rank-idx" :class="rankClass(i)">{{ i + 1 }}</span>
              <span class="rank-name" :title="r.name">{{ r.name }}</span>
              <span class="rank-amt">{{ formatYuan(r.amount) }}</span>
              <span class="rank-bar"><b :style="{ width: r.pct + '%' }" /></span>
            </li>
            <li v-if="!productRows.length" class="rank-empty">暂无数据</li>
          </ol>
        </div>

        <div class="panel">
          <div class="panel-head">
            <span class="panel-title">客户销售额</span>
            <span class="panel-sub">前 10 名</span>
          </div>
          <ol class="rank-list">
            <li
              v-for="(r, i) in customerRows"
              :key="r.id"
              class="rank-item"
              @click="go('/customers/list')"
            >
              <span class="rank-idx" :class="rankClass(i)">{{ i + 1 }}</span>
              <span class="rank-name" :title="r.name">{{ r.name }}</span>
              <span class="rank-amt">{{ formatYuan(r.amount) }}</span>
              <span class="rank-bar"><b :style="{ width: r.pct + '%' }" /></span>
            </li>
            <li v-if="!customerRows.length" class="rank-empty">暂无数据</li>
          </ol>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import dayjs from 'dayjs'
import { useRouter } from 'vue-router'
import { adminCustomerApi, dashboardApi, orderApi } from '@/api'
import { useAppStore } from '@/stores/app'
import { formatPhone, formatYuan } from '@/utils/format'
import { DASHBOARD_TODO, OVERDUE_BUCKET } from '@/utils/dict'
import type {
  AdminCustomer, DashboardDays, DashboardOverview, DashboardTodo,
  OrderApprovalItem, SalesTrendPoint, ProductRanking, CustomerRanking, SalesRanking,
} from '@/types'

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const router = useRouter()
const message = useMessage()
const app = useAppStore()

const AUTO_REFRESH_MS = 30_000
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const overview = ref<DashboardOverview | null>(null)
const overviewError = ref('')
const refreshing = ref(false)

const pendingOrders = ref<OrderApprovalItem[]>([])
const pendingOrdersTotal = ref(0)
const pendingCustomers = ref<AdminCustomer[]>([])
const auditsLoading = ref(false)
const auditsError = ref('')

const days = ref<DashboardDays>(7)
const trend = ref<SalesTrendPoint[]>([])
const products = ref<ProductRanking[]>([])
const customers = ref<CustomerRanking[]>([])
const salesTop = ref<SalesRanking[]>([])
const chartsError = ref('')

const todayDateText = computed(() => {
  const now = dayjs()
  return `${now.format('YYYY年M月D日')} ${WEEKDAYS[now.day()]}`
})
const today = computed(() => overview.value?.today)
const money = computed(() => overview.value?.money)
const pendingOrdersCount = computed(
  () => pendingOrdersTotal.value || overview.value?.todos.find((t) => t.code === 'pending_orders')?.count || 0,
)
const pendingCustomersCount = computed(
  () => overview.value?.todos.find((t) => t.code === 'pending_customers')?.count ?? pendingCustomers.value.length,
)
const todoBadgeClass = computed(() => {
  const list = overview.value?.todos ?? []
  if (!list.length) return 'zero'
  if (list.some((t) => todoLevel(t) === 'crit')) return 'crit'
  if (list.some((t) => todoLevel(t) === 'warn')) return 'warn'
  return ''
})
const stampText = computed(() => (overview.value ? dayjs(overview.value.generated_at).format('HH:mm:ss') : '--:--'))
const monthText = computed(() => {
  const m = money.value?.month_profit.month
  return m ? `${Number(m.slice(5))} 月` : ''
})

const buckets = computed(() => {
  const list = money.value?.ar_overdue_buckets ?? []
  const total = list.reduce((sum, b) => sum + Number(b.amount), 0)
  return list.map((b) => ({ ...b, pct: total > 0 ? (Number(b.amount) / total) * 100 : 0 }))
})

function errText(e: unknown): string {
  return e instanceof Error ? e.message : '请稍后重试'
}

/** silent=true 为自动刷新：不出加载状态，失败时保留旧数据不报错 */
async function loadOverview(force: boolean, silent: boolean) {
  try {
    overview.value = await dashboardApi.overview(force)
    overviewError.value = ''
  } catch (e) {
    if (!silent) overviewError.value = errText(e)
  }
}

async function loadCharts(silent: boolean) {
  const d = days.value
  try {
    const [t, p, c, s] = await Promise.all([
      dashboardApi.salesTrend(d),
      dashboardApi.topProducts(d, 10),
      dashboardApi.topCustomers(d, 10),
      dashboardApi.topSales(d, 5),
    ])
    if (d !== days.value) return // 用户已切换时间范围，丢弃过期结果
    trend.value = t
    products.value = p
    customers.value = c
    salesTop.value = s
    chartsError.value = ''
  } catch (e) {
    if (!silent) chartsError.value = errText(e)
  }
}

async function loadAudits(silent: boolean) {
  if (!silent) auditsLoading.value = true
  try {
    const [orderPage, customerList] = await Promise.all([
      orderApi.approvals({ stage: 'admin', page: 1, page_size: 5 }),
      adminCustomerApi.list({ status: 'pending', page: 1, page_size: 5 }),
    ])
    pendingOrders.value = orderPage.items
    pendingOrdersTotal.value = orderPage.total
    pendingCustomers.value = customerList
    auditsError.value = ''
  } catch (e) {
    if (!silent) auditsError.value = errText(e)
  } finally {
    if (!silent) auditsLoading.value = false
  }
}

async function manualRefresh() {
  refreshing.value = true
  await Promise.all([loadOverview(true, false), loadAudits(false), loadCharts(false)])
  refreshing.value = false
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  loadOverview(false, false)
  loadAudits(false)
  loadCharts(false)
  timer = setInterval(() => {
    if (document.hidden) return
    loadOverview(false, true)
    loadAudits(true)
    loadCharts(true)
  }, AUTO_REFRESH_MS)
})
onBeforeUnmount(() => timer && clearInterval(timer))

// ---------- 待审核卡片辅助 ----------
function formatWaitingHours(hours: number): string {
  if (hours < 1) return '刚刚提交'
  if (hours < 24) return `已等 ${hours} 小时`
  const daysNum = Math.floor(hours / 24)
  const rem = hours % 24
  return rem > 0 ? `已等 ${daysNum} 天 ${rem} 小时` : `已等 ${daysNum} 天`
}

function customerContactText(c: AdminCustomer): string {
  const parts = [c.contact_name, c.phone ? formatPhone(c.phone) : ''].filter(Boolean)
  return parts.length ? parts.join(' · ') : '未填联系方式'
}

function formatShortTime(v?: string | null): string {
  return v ? dayjs(v).format('MM-DD HH:mm') : '—'
}

// ---------- 要处理的事 ----------
function todoLevel(t: DashboardTodo): '' | 'warn' | 'crit' {
  if (t.code === 'pool_orders') {
    const overdue = (t.data?.overdue_count ?? 0) > 0
    const urgent = (t.data?.min_remaining_hours ?? 99) <= 24
    return overdue || urgent ? 'crit' : 'warn'
  }
  if (t.code === 'pending_orders' || t.code === 'pending_customers' || t.code === 'pending_returns') return 'warn'
  return ''
}

function todoTitle(t: DashboardTodo): string {
  if (t.code === 'no_upcoming_trip') return `未来 ${t.data?.days ?? 3} 天没有安排出车`
  return DASHBOARD_TODO[t.code].label
}

function todoDesc(t: DashboardTodo): string {
  if (t.code === 'pool_orders') {
    const parts: string[] = []
    const h = t.data?.min_remaining_hours
    if (h !== undefined) parts.push(h >= 0 ? `最紧急一张还剩 ${h} 小时改发物流` : `最紧急一张已超期 ${-h} 小时`)
    const o = t.data?.overdue_count ?? 0
    if (o > 0) parts.push(`其中 ${o} 张无默认物流线路，超期未排车`)
    return parts.join('，')
  }
  if (t.code === 'pending_orders') return '超授信额度待管理员审批'
  if (t.code === 'pending_returns') return '含销售在手机上提交的'
  if (t.code === 'no_upcoming_trip') return '提醒天数可在系统参数里调整，设为 0 不再提醒'
  return ''
}

// ---------- 排行 ----------
function toRows<T>(list: T[], id: (x: T) => number, name: (x: T) => string, amount: (x: T) => string) {
  const max = Math.max(...list.map((x) => Number(amount(x))), 0)
  return list.map((x) => ({ id: id(x), name: name(x), amount: amount(x), pct: max > 0 ? (Number(amount(x)) / max) * 100 : 0 }))
}
function rankClass(i: number): string {
  if (i === 0) return 'top-1'
  if (i === 1) return 'top-2'
  if (i === 2) return 'top-3'
  return ''
}
const productRows = computed(() => toRows(products.value, (x) => x.spu_id, (x) => x.spu_name, (x) => x.amount))
const customerRows = computed(() => toRows(customers.value, (x) => x.customer_id, (x) => x.customer_name, (x) => x.amount))
const salesRows = computed(() => toRows(salesTop.value, (x) => x.sales_id, (x) => x.sales_name, (x) => x.amount))

// ---------- 趋势图（适配明暗模式） ----------
const trendOption = computed(() => {
  const dark = app.isDark
  const lineColor = dark ? '#818cf8' : '#4f46e5'
  const axisColor = dark ? '#8089a0' : '#8a91a1'
  const gridLine = dark ? '#2a2f3d' : '#eef0f4'
  return {
    grid: { left: 54, right: 18, top: 18, bottom: 26 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: { dataIndex: number }[]) => {
        const p = trend.value[params[0].dataIndex]
        return p ? `${dayjs(p.date).format('M月D日')}<br/>销售额 ${formatYuan(p.amount)}<br/>订单 ${p.order_count} 单` : ''
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trend.value.map((p) => dayjs(p.date).format('M/D')),
      axisLine: { lineStyle: { color: gridLine } },
      axisTick: { show: false },
      axisLabel: { color: axisColor, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: axisColor, fontSize: 11, formatter: (v: number) => v.toLocaleString('zh-CN') },
      splitLine: { lineStyle: { color: gridLine, type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        data: trend.value.map((p) => Number(p.amount)),
        smooth: 0.2,
        symbolSize: 6,
        lineStyle: { width: 2.5, color: lineColor },
        itemStyle: { color: lineColor },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: dark ? 'rgba(129, 140, 248, 0.24)' : 'rgba(79, 70, 229, 0.16)' },
              { offset: 1, color: dark ? 'rgba(129, 140, 248, 0.01)' : 'rgba(79, 70, 229, 0.01)' },
            ],
          },
        },
      },
    ],
  }
})

// ---------- 跳转 ----------
function go(path: string, query?: Record<string, string>) {
  const target = router.resolve({ path, query })
  // 兜底路由会把未知路径重定向到首页，所以用 matched 判断页面是否已建
  const exists = target.matched.some((r) => r.path !== '/:pathMatch(.*)*')
  if (!exists) {
    message.info('该页面尚未开放')
    return
  }
  router.push({ path, query })
}
</script>

<style scoped>
.dashboard { display: flex; flex-direction: column; gap: 14px; }
.dash-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.dash-header-left { display: flex; align-items: baseline; gap: 10px; }
.today-date { font-size: 12px; color: var(--text-3); }
.header-right { display: flex; align-items: center; gap: 10px; }
.stamp { display: inline-flex; align-items: center; color: var(--text-3); font-size: 12px; font-variant-numeric: tabular-nums; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #16a34a; margin-right: 6px; }
.dash-alert { margin: 0; }

/* 第一排：今日 KPI（5 列等宽） */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.kpi-card {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 13px 15px 12px;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s, transform 0.15s;
}
.kpi-card::before {
  content: '';
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--primary);
  opacity: 0.85;
}
.kpi-card.accent-amber::before { background: #f59e0b; }
.kpi-card.accent-indigo::before { background: #6366f1; }
.kpi-card.accent-cyan::before { background: #06b6d4; }
.kpi-card.accent-green::before { background: #16a34a; }
.kpi-card:hover { border-color: var(--primary); transform: translateY(-1px); }
.kpi-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.kpi-label { color: var(--text-3); font-size: 12px; font-weight: 500; }
.kpi-arrow { color: var(--text-3); font-size: 14px; line-height: 1; transition: transform 0.15s, color 0.15s; }
.kpi-card:hover .kpi-arrow, .money-card:hover .kpi-arrow { color: var(--primary); transform: translateX(2px); }
.kpi-value {
  font-size: 24px; font-weight: 700; color: var(--text-1);
  margin: 4px 0 3px; line-height: 1.2;
  white-space: nowrap; font-variant-numeric: tabular-nums;
}
.kpi-value small { font-size: 13px; font-weight: 500; color: var(--text-3); margin-left: 3px; }
.kpi-sub { font-size: 12px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.kpi-sub strong { color: var(--text-2); font-weight: 600; }
.text-profit { color: #16a34a !important; }
.text-warn { color: #ea580c !important; }
.text-crit { color: #dc2626 !important; }

/* 第二排：待办与审核（3 列等高） */
.work-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: stretch;
}
.work-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
.card-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-subtle);
}
.card-head.clickable { cursor: pointer; }
.card-head.clickable:hover { background: var(--bg-hover); }
.card-head-title { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: var(--text-1); }
.card-head-meta { font-size: 11px; color: var(--text-3); }
.card-head-link { font-size: 12px; color: var(--primary); white-space: nowrap; }
.card-body-spin { flex: 1; display: flex; flex-direction: column; }
.card-body-spin :deep(.n-spin-content) { flex: 1; display: flex; flex-direction: column; }
.card-body { flex: 1; display: flex; flex-direction: column; }
.scroll-body { max-height: 248px; overflow-y: auto; }
.inline-alert { margin: 8px 12px 0; }
.empty-box {
  flex: 1; display: flex; align-items: center; justify-content: center;
  min-height: 112px; padding: 16px;
  color: var(--text-3); font-size: 13px;
}
.empty-box.clickable { cursor: pointer; }
.empty-box.clickable:hover { background: var(--bg-hover); }

.list-rows { margin: 0; padding: 0; list-style: none; }
.todo-row, .audit-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 9px 14px;
  border-top: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.12s;
}
.todo-row:first-child, .audit-row:first-child { border-top: 0; }
.todo-row:hover, .audit-row:hover { background: var(--bg-hover); }
.row-main { min-width: 0; flex: 1; }
.row-title { font-size: 13px; font-weight: 500; color: var(--text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-sub { font-size: 11px; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
.row-meta { text-align: right; flex-shrink: 0; font-variant-numeric: tabular-nums; }
.row-amt { font-size: 13px; font-weight: 600; color: var(--text-1); }
.row-source { font-size: 12px; color: var(--primary); }
.row-link { font-size: 12px; color: var(--text-3); white-space: nowrap; }
.todo-row:hover .row-link { color: var(--primary); }
.wait-crit { color: #dc2626; font-weight: 600; }

.badge {
  min-width: 24px; text-align: center; border-radius: 99px;
  padding: 1px 7px; font-weight: 600; font-size: 12px; line-height: 18px;
  background: rgba(79, 70, 229, 0.12); color: var(--primary);
  font-variant-numeric: tabular-nums;
}
.badge.warn { background: rgba(234, 88, 12, 0.14); color: #ea580c; }
.badge.crit { background: rgba(220, 38, 38, 0.14); color: #dc2626; }
.badge.zero { background: var(--bg-hover); color: var(--text-3); }

/* 第三排：资金与利润（左 7 栏 + 右 5 栏） */
.finance-grid {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: 12px;
  align-items: stretch;
}
.finance-left { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.finance-top-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.money-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
  min-width: 0;
  transition: border-color 0.15s;
}
.money-card:hover { border-color: var(--primary); }
.money-val {
  font-size: 22px; font-weight: 700; color: var(--text-1);
  margin: 4px 0 3px; line-height: 1.2;
  white-space: nowrap; font-variant-numeric: tabular-nums;
}
.overdue-card { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
.overdue-card.crit .money-val { color: #dc2626; }
.overdue-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.bucket { display: flex; height: 8px; border-radius: 99px; overflow: hidden; margin: 10px 0 8px; background: var(--bg-subtle); }
.b-1_30, .sw-1_30 { background: #f5b971; }
.b-31_60, .sw-31_60 { background: #ea580c; }
.b-60_plus, .sw-60_plus { background: #dc2626; }
.legend { display: flex; gap: 6px 14px; flex-wrap: wrap; color: var(--text-3); font-size: 12px; font-variant-numeric: tabular-nums; }
.legend strong { color: var(--text-2); font-weight: 600; margin-left: 2px; }
.legend i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 5px; }

.profit-card { display: flex; flex-direction: column; justify-content: space-between; }
.profit-val {
  font-size: 28px; font-weight: 700; color: #16a34a;
  margin: 4px 0 10px; line-height: 1.15;
  font-variant-numeric: tabular-nums;
}
.pl-list {
  display: flex; flex-direction: column; gap: 7px;
  padding-top: 10px; border-top: 1px dashed var(--border);
}
.pl-item { display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-variant-numeric: tabular-nums; }
.pl-k { display: inline-flex; align-items: center; gap: 7px; color: var(--text-2); }
.pl-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
.dot-sales { background: var(--primary); }
.dot-cost { background: #f59e0b; }
.dot-freight { background: #06b6d4; }
.dot-op { background: #94a3b8; }
.pl-v { font-weight: 600; color: var(--text-1); }
.pl-v.neg { color: var(--text-2); font-weight: 500; }

/* 第四排：趋势与排行 */
.analytics-section { display: flex; flex-direction: column; gap: 12px; }
.analytics-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.analytics-title-wrap { display: flex; align-items: baseline; gap: 10px; }
.section-heading { margin: 0; font-size: 14px; font-weight: 600; color: var(--text-1); }
.section-sub { font-size: 12px; color: var(--text-3); }

.analytics-row { display: grid; gap: 12px; align-items: stretch; }
.top-analytics { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); }
.bottom-analytics { grid-template-columns: repeat(2, minmax(0, 1fr)); }

.panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.panel-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.panel-title { font-size: 14px; font-weight: 600; color: var(--text-1); }
.panel-sub { font-size: 12px; color: var(--text-3); }
.chart { width: 100%; height: 230px; }

.rank-list { display: flex; flex-direction: column; gap: 9px; margin: 0; padding: 0; list-style: none; }
.rank-item {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  gap: 4px 8px;
  align-items: center;
  font-size: 13px;
  cursor: pointer;
  padding: 2px 4px;
  margin: 0 -4px;
  border-radius: 6px;
  transition: background 0.12s;
}
.rank-item:hover { background: var(--bg-hover); }
.rank-idx {
  width: 20px; height: 20px; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; color: var(--text-3); background: var(--bg-subtle);
}
.rank-idx.top-1 { background: rgba(245, 158, 11, 0.18); color: #d97706; }
.rank-idx.top-2 { background: rgba(100, 116, 139, 0.18); color: #475569; }
.rank-idx.top-3 { background: rgba(234, 88, 12, 0.15); color: #c2410c; }
.rank-name { color: var(--text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-amt { font-weight: 600; color: var(--text-1); font-variant-numeric: tabular-nums; white-space: nowrap; }
.rank-bar { grid-column: 2 / 4; height: 5px; border-radius: 99px; background: var(--bg-subtle); overflow: hidden; }
.rank-bar b { display: block; height: 100%; border-radius: 99px; background: var(--primary); opacity: 0.85; }
.rank-empty { padding: 36px 0; color: var(--text-3); text-align: center; font-size: 13px; }

@media (max-width: 1200px) {
  .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .work-grid { grid-template-columns: 1fr; }
  .finance-grid, .top-analytics, .bottom-analytics { grid-template-columns: 1fr; }
}
@media (max-width: 680px) {
  .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .finance-top-pair { grid-template-columns: 1fr; }
}
</style>
