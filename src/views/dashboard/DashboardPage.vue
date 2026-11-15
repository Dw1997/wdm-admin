<template>
  <div class="page-container dashboard">
    <div class="page-header">
      <h2 class="page-title">数据看板</h2>
      <div class="header-right">
        <span class="stamp">
          <i class="dot" />更新于 {{ stampText }}
        </span>
        <n-button size="small" :loading="refreshing" @click="manualRefresh">刷新</n-button>
      </div>
    </div>

    <n-alert v-if="overviewError" type="error" :bordered="false" class="block">
      看板数据加载失败：{{ overviewError }}
      <n-button text type="primary" style="margin-left: 8px" @click="loadOverview(true, false)">重试</n-button>
    </n-alert>

    <!-- 第一档：今天的经营 -->
    <section class="block">
      <h3 class="block-title">今天的经营</h3>
      <n-spin :show="!overview && !overviewError">
        <div class="cards">
          <div class="card" @click="go('/order-center/list', { date: 'today' })">
            <div class="k">今日销售额</div>
            <div class="v">{{ formatYuan(today?.sales_amount) }}</div>
            <div class="s">新下 {{ today?.sales_order_count ?? 0 }} 单</div>
          </div>
          <div class="card" @click="go('/order-center/list', { status: 'pending' })">
            <div class="k">今日待配送</div>
            <div class="v">{{ today?.pending_order_count ?? 0 }}<small>单</small></div>
            <div class="s">{{ formatYuan(today?.pending_amount) }}</div>
          </div>
          <div class="card" @click="go('/delivery/trips')">
            <div class="k">今日出车</div>
            <div class="v">{{ today?.trip_count ?? 0 }}<small>趟</small></div>
            <div class="s">{{ today?.trip_order_count ?? 0 }} 单 · 已送达 {{ today?.trip_delivered_count ?? 0 }}</div>
          </div>
          <div class="card" @click="go('/delivery/freight')">
            <div class="k">今日零担</div>
            <div class="v">{{ today?.freight_order_count ?? 0 }}<small>单</small></div>
            <div class="s">待交车 {{ today?.freight_pending_count ?? 0 }}</div>
          </div>
          <div class="card" @click="go('/finance/payments', { date: 'today' })">
            <div class="k">今日收款</div>
            <div class="v">{{ formatYuan(today?.payment_amount) }}</div>
            <div class="s">已扣除退款</div>
          </div>
        </div>
      </n-spin>
    </section>

    <!-- 第二档：要处理的事 -->
    <section class="block">
      <h3 class="block-title">要处理的事</h3>
      <div class="todos">
        <div v-if="overview && !overview.todos.length" class="todo-empty">今天没有待处理的事</div>
        <div v-for="t in overview?.todos" :key="t.code" class="todo" @click="go(DASHBOARD_TODO[t.code].to)">
          <span class="badge" :class="todoLevel(t)">{{ t.code === 'no_upcoming_trip' ? '!' : t.count }}</span>
          <div class="t">
            {{ todoTitle(t) }}
            <div v-if="todoDesc(t)" class="d">{{ todoDesc(t) }}</div>
          </div>
          <span class="go">{{ DASHBOARD_TODO[t.code].toLabel }} ›</span>
        </div>
      </div>
    </section>

    <!-- 第三档：钱 -->
    <section class="block">
      <h3 class="block-title">钱</h3>
      <div class="cards cards-money">
        <div class="card" @click="go('/finance/credit')">
          <div class="k">客户欠款总额</div>
          <div class="v">{{ formatYuan(money?.ar_total) }}</div>
          <div class="s">{{ money?.ar_customer_count ?? 0 }} 位客户有欠款</div>
        </div>
        <div class="card" :class="{ crit: Number(money?.ar_overdue_total) > 0 }" @click="go('/finance/credit', { overdue: 'true' })">
          <div class="k">客户逾期总额</div>
          <div class="v">{{ formatYuan(money?.ar_overdue_total) }}</div>
          <div class="bucket" role="img" aria-label="逾期账龄分布">
            <span v-for="b in buckets" :key="b.key" :class="'b-' + b.key" :style="{ width: b.pct + '%' }" />
          </div>
          <div class="legend">
            <span v-for="b in buckets" :key="b.key"><i :class="'sw-' + b.key" />{{ OVERDUE_BUCKET[b.key] }} {{ formatYuan(b.amount) }}</span>
          </div>
        </div>
        <div class="card" @click="go('/suppliers/transactions')">
          <div class="k">欠供应商逾期总额</div>
          <div class="v">{{ formatYuan(money?.ap_overdue_total) }}</div>
          <div class="s">已逾期应付合计</div>
        </div>
        <div class="card" @click="go('/finance/cost-center')">
          <div class="k">本月利润{{ money ? `（${monthText}）` : '' }}</div>
          <div class="v text-profit">{{ formatYuan(money?.month_profit.profit) }}</div>
          <div class="pl">
            <span>销售额</span><span class="r">{{ formatYuan(money?.month_profit.sales_amount) }}</span>
            <span>商品成本</span><span class="r">−{{ formatYuan(money?.month_profit.goods_cost) }}</span>
            <span>发货运费</span><span class="r">−{{ formatYuan(money?.month_profit.freight_cost) }}</span>
            <span>经营成本</span><span class="r">−{{ formatYuan(money?.month_profit.operating_cost) }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 第四档：趋势和排行 -->
    <section class="block">
      <div class="block-head">
        <h3 class="block-title">趋势和排行</h3>
        <n-radio-group v-model:value="days" size="small" @update:value="() => loadCharts(false)">
          <n-radio-button :value="7">近 7 天</n-radio-button>
          <n-radio-button :value="30">近 30 天</n-radio-button>
        </n-radio-group>
      </div>
      <n-alert v-if="chartsError" type="error" :bordered="false" class="block">
        图表数据加载失败：{{ chartsError }}
        <n-button text type="primary" style="margin-left: 8px" @click="loadCharts(false)">重试</n-button>
      </n-alert>
      <div class="panels">
        <div class="panel wide">
          <div class="p-title">销售额趋势 <span class="text-muted">按下单日期，元</span></div>
          <v-chart class="chart" :option="trendOption" autoresize />
        </div>
        <div class="panel">
          <div class="p-title">热销商品 <span class="text-muted">按销售金额</span></div>
          <ol class="rank">
            <li v-for="(r, i) in productRows" :key="r.id" @click="go('/spus/dashboard')">
              <span class="n">{{ i + 1 }}</span><span class="nm">{{ r.name }}</span><span class="amt">{{ formatYuan(r.amount) }}</span>
              <span class="bar"><b :style="{ width: r.pct + '%' }" /></span>
            </li>
            <li v-if="!productRows.length" class="rank-empty">暂无数据</li>
          </ol>
        </div>
        <div class="panel">
          <div class="p-title">客户销售额 <span class="text-muted">前 10</span></div>
          <ol class="rank">
            <li v-for="(r, i) in customerRows" :key="r.id" @click="go('/customers/list')">
              <span class="n">{{ i + 1 }}</span><span class="nm">{{ r.name }}</span><span class="amt">{{ formatYuan(r.amount) }}</span>
              <span class="bar"><b :style="{ width: r.pct + '%' }" /></span>
            </li>
            <li v-if="!customerRows.length" class="rank-empty">暂无数据</li>
          </ol>
        </div>
        <div class="panel">
          <div class="p-title">销售业绩 <span class="text-muted">前 5</span></div>
          <ol class="rank">
            <li v-for="(r, i) in salesRows" :key="r.id" @click="go('/sales/dashboard', { sales_id: String(r.id) })">
              <span class="n">{{ i + 1 }}</span><span class="nm">{{ r.name }}</span><span class="amt">{{ formatYuan(r.amount) }}</span>
              <span class="bar"><b :style="{ width: r.pct + '%' }" /></span>
            </li>
            <li v-if="!salesRows.length" class="rank-empty">暂无数据</li>
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
import { dashboardApi } from '@/api'
import { formatYuan } from '@/utils/format'
import { DASHBOARD_TODO, OVERDUE_BUCKET } from '@/utils/dict'
import type {
  DashboardDays, DashboardOverview, DashboardTodo,
  SalesTrendPoint, ProductRanking, CustomerRanking, SalesRanking,
} from '@/types'

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const router = useRouter()
const message = useMessage()

const AUTO_REFRESH_MS = 30_000

const overview = ref<DashboardOverview | null>(null)
const overviewError = ref('')
const refreshing = ref(false)

const days = ref<DashboardDays>(7)
const trend = ref<SalesTrendPoint[]>([])
const products = ref<ProductRanking[]>([])
const customers = ref<CustomerRanking[]>([])
const salesTop = ref<SalesRanking[]>([])
const chartsError = ref('')

const today = computed(() => overview.value?.today)
const money = computed(() => overview.value?.money)
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

async function manualRefresh() {
  refreshing.value = true
  await Promise.all([loadOverview(true, false), loadCharts(false)])
  refreshing.value = false
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  loadOverview(false, false)
  loadCharts(false)
  timer = setInterval(() => {
    if (document.hidden) return
    loadOverview(false, true)
    loadCharts(true)
  }, AUTO_REFRESH_MS)
})
onBeforeUnmount(() => timer && clearInterval(timer))

// ---------- 要处理的事 ----------
function todoLevel(t: DashboardTodo): '' | 'warn' | 'crit' {
  if (t.code === 'pool_orders') {
    const overdue = (t.data?.overdue_count ?? 0) > 0
    const urgent = (t.data?.min_remaining_hours ?? 99) <= 24
    return overdue || urgent ? 'crit' : 'warn'
  }
  if (t.code === 'pending_customers' || t.code === 'pending_returns') return 'warn'
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
    if (h !== undefined) parts.push(h >= 0 ? `最紧急一张还剩 ${h} 小时改发零担` : `最紧急一张已超期 ${-h} 小时`)
    const o = t.data?.overdue_count ?? 0
    if (o > 0) parts.push(`其中 ${o} 张无默认零担线路，超期未排车`)
    return parts.join('，')
  }
  if (t.code === 'pending_returns') return '含销售在手机上提交的'
  if (t.code === 'no_upcoming_trip') return '提醒天数可在系统参数里调整，设为 0 不再提醒'
  return ''
}

// ---------- 排行 ----------
function toRows<T>(list: T[], id: (x: T) => number, name: (x: T) => string, amount: (x: T) => string) {
  const max = Math.max(...list.map((x) => Number(amount(x))), 0)
  return list.map((x) => ({ id: id(x), name: name(x), amount: amount(x), pct: max > 0 ? (Number(amount(x)) / max) * 100 : 0 }))
}
const productRows = computed(() => toRows(products.value, (x) => x.spu_id, (x) => x.spu_name, (x) => x.amount))
const customerRows = computed(() => toRows(customers.value, (x) => x.customer_id, (x) => x.customer_name, (x) => x.amount))
const salesRows = computed(() => toRows(salesTop.value, (x) => x.sales_id, (x) => x.sales_name, (x) => x.amount))

// ---------- 趋势图 ----------
const trendOption = computed(() => ({
  grid: { left: 56, right: 24, top: 16, bottom: 28 },
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
    axisLine: { lineStyle: { color: '#e5e7eb' } },
    axisLabel: { color: '#909399' },
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#909399', formatter: (v: number) => v.toLocaleString('zh-CN') },
    splitLine: { lineStyle: { color: '#eef0f3' } },
  },
  series: [
    {
      type: 'line',
      data: trend.value.map((p) => Number(p.amount)),
      smooth: false,
      symbolSize: 6,
      lineStyle: { width: 2, color: '#2563eb' },
      itemStyle: { color: '#2563eb' },
      areaStyle: { color: 'rgba(37, 99, 235, 0.10)' },
    },
  ],
}))

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
.header-right { display: flex; align-items: center; gap: 12px; }
.stamp { color: var(--text-3); font-size: 12px; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #16a34a; margin-right: 5px; }
.block { margin-bottom: 16px; }
.block-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.block-title { margin: 0 0 8px; font-size: 13px; font-weight: 500; color: #606266; letter-spacing: 0.08em; }
.block-head .block-title { margin: 0; }

.cards { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
.cards-money { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
.card {
  background: var(--bg-card); border-radius: 8px; padding: 14px 16px; min-width: 0; cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06); border: 1px solid transparent; transition: border-color 0.15s;
}
.card:hover { border-color: #2563eb; }
.card .k { color: var(--text-3); font-size: 12px; }
.card .v { font-size: 24px; font-weight: 600; margin: 2px 0; white-space: nowrap; font-variant-numeric: tabular-nums; }
.card .v small { font-size: 13px; font-weight: 500; color: var(--text-3); margin-left: 2px; }
.card .s { color: var(--text-3); font-size: 12px; font-variant-numeric: tabular-nums; }
.card.crit .v { color: #dc2626; }
.text-profit { color: #16a34a; }

.todos { background: var(--bg-card); border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06); }
.todo { display: flex; gap: 12px; align-items: center; padding: 11px 16px; border-top: 1px solid #f0f2f5; cursor: pointer; }
.todo:first-child { border-top: 0; }
.todo:hover { background: var(--bg-hover); }
.todo-empty { padding: 16px; color: var(--text-3); text-align: center; }
.todo .t { flex: 1; min-width: 0; }
.todo .d { color: var(--text-3); font-size: 12px; }
.todo .go { color: var(--text-3); font-size: 12px; white-space: nowrap; }
.badge {
  min-width: 28px; text-align: center; border-radius: 99px; padding: 1px 8px; font-weight: 600; font-size: 13px;
  background: #e8f0fe; color: #2563eb; font-variant-numeric: tabular-nums;
}
.badge.warn { background: #fff1e0; color: #ea580c; }
.badge.crit { background: #fde8e8; color: #dc2626; }

.bucket { display: flex; height: 8px; border-radius: 4px; overflow: hidden; margin: 10px 0 6px; background: var(--bg-hover); }
.b-1_30, .sw-1_30 { background: #f5b971; }
.b-31_60, .sw-31_60 { background: #ea580c; }
.b-60_plus, .sw-60_plus { background: #dc2626; }
.legend { display: flex; gap: 4px 12px; flex-wrap: wrap; color: var(--text-3); font-size: 12px; font-variant-numeric: tabular-nums; }
.legend i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; }
.pl { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; font-size: 13px; margin-top: 6px; font-variant-numeric: tabular-nums; }
.pl .r { text-align: right; }

.panels { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.panel { background: var(--bg-card); border-radius: 8px; padding: 14px 16px; min-width: 0; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06); }
.panel.wide { grid-column: 1 / -1; }
.p-title { font-weight: 600; }
.p-title .text-muted { font-weight: 400; font-size: 12px; margin-left: 4px; }
.chart { height: 240px; }
.rank { display: grid; gap: 8px; margin: 10px 0 0; padding: 0; list-style: none; }
.rank li { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; gap: 4px 8px; align-items: center; font-size: 13px; cursor: pointer; }
.rank .n { color: var(--text-3); font-size: 12px; text-align: center; }
.rank .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank .amt { font-variant-numeric: tabular-nums; }
.rank .bar { grid-column: 2 / 4; height: 5px; border-radius: 3px; background: #e8f0fe; }
.rank .bar b { display: block; height: 100%; border-radius: 3px; background: #2563eb; }
.rank .rank-empty { display: block; color: var(--text-3); text-align: center; cursor: default; }
</style>
