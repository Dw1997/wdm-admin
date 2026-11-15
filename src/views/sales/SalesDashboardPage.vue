<template>
  <div class="page-container sales-dashboard">
    <div class="page-header">
      <div>
        <h2 class="page-title">销售看板</h2>
        <p class="page-note">按销售查看当前客户、今日与本月业绩及提成</p>
      </div>
      <div class="header-actions">
        <span v-if="updatedAt" class="updated-at">更新于 {{ updatedAt }}</span>
        <n-button size="small" :loading="loadingDashboard" :disabled="selectedId === null" @click="loadSelected">刷新当前销售</n-button>
      </div>
    </div>

    <div class="dashboard-layout">
      <n-card size="small" class="sales-picker">
        <div class="picker-title">选择销售</div>
        <p class="picker-note">一次查看一位销售的业绩</p>
        <n-input v-model:value="keyword" clearable placeholder="搜索销售姓名" aria-label="搜索销售姓名" />
        <n-alert v-if="accountsError" type="error" :bordered="false" class="picker-error">
          销售名单加载失败
          <n-button text type="primary" @click="loadAccounts">重试</n-button>
        </n-alert>
        <n-spin :show="loadingAccounts">
          <div v-if="loadingAccounts" class="picker-loading" />
          <div v-else-if="filteredSales.length" class="sales-list">
            <button
              v-for="account in filteredSales"
              :key="account.id"
              type="button"
              class="sales-item"
              :class="{ selected: selectedId === account.id }"
              :aria-pressed="selectedId === account.id"
              @click="selectSales(account.id)"
            >
              <span class="sales-avatar">{{ (account.real_name || account.username).slice(0, 1) }}</span>
              <span class="sales-info">
                <strong>{{ account.real_name || account.username }}</strong>
                <small>{{ account.customer_count }} 位当前客户</small>
              </span>
              <n-tag size="tiny" :type="account.is_active ? 'success' : 'default'" :bordered="false">
                {{ account.is_active ? '启用' : '停用' }}
              </n-tag>
            </button>
          </div>
          <n-empty v-else-if="!accountsError" :description="keyword ? '没有匹配的销售' : '暂无销售账号'" class="picker-empty">
            <template v-if="!keyword" #extra>
              <n-button size="small" @click="router.push('/sales/list')">前往销售列表</n-button>
            </template>
          </n-empty>
        </n-spin>
      </n-card>

      <div class="dashboard-main">
        <template v-if="selectedAccount">
          <n-card size="small" class="identity-card">
            <div>
              <div class="identity-name">{{ dashboard?.sales_name || selectedAccount.real_name || selectedAccount.username }}</div>
              <div class="identity-note">销售编号 {{ selectedAccount.id }} · 个人业绩</div>
            </div>
            <div class="identity-date">
              <n-tag size="small" :type="(dashboard?.is_active ?? selectedAccount.is_active) ? 'success' : 'default'">
                {{ (dashboard?.is_active ?? selectedAccount.is_active) ? '启用' : '停用' }}
              </n-tag>
              <span v-if="dashboard">截至 {{ formatDate(dashboard.as_of_date, 'YYYY年M月D日') }}</span>
            </div>
          </n-card>

          <n-alert v-if="dashboardError" type="error" :bordered="false" class="data-error">
            销售统计加载失败，请重试。
            <n-button text type="primary" @click="loadSelected">重试</n-button>
          </n-alert>

          <n-spin :show="loadingDashboard">
            <div v-if="loadingDashboard" class="dashboard-loading" />
            <template v-else-if="dashboard">
              <div class="metrics">
                <n-card size="small" class="metric-card">
                  <div class="metric-label">当前名下客户</div>
                  <div class="metric-value">{{ dashboard.customer_count }} <span>位</span></div>
                  <div class="metric-note">按当前客户归属统计</div>
                </n-card>
                <n-card size="small" class="metric-card">
                  <div class="metric-label">今日销售额</div>
                  <div class="metric-value">{{ formatMoney(dashboard.today.sales_amount) }}</div>
                  <div class="metric-note">今日 {{ dashboard.today.order_count }} 笔订单 · 按下单日期</div>
                </n-card>
                <n-card size="small" class="metric-card">
                  <div class="metric-label">本月销售额</div>
                  <div class="metric-value">{{ formatMoney(dashboard.month.sales_amount) }}</div>
                  <div class="metric-note">本月 {{ dashboard.month.order_count }} 笔订单 · 按下单日期</div>
                </n-card>
              </div>

              <n-card size="small" class="commission-card">
                <div class="section-heading">
                  <h3>销售提成</h3>
                  <n-button text type="primary" @click="showCommissionHelp = true">查看口径说明</n-button>
                </div>
                <div class="commission-grid">
                  <div><div class="commission-label">预估提成</div><strong>{{ formatMoney(dashboard.commissions.estimated_amount) }}</strong><small>未付清订单</small></div>
                  <div><div class="commission-label">待结算</div><strong>{{ formatMoney(dashboard.commissions.pending_amount) }}</strong><small>已付清，尚未支付销售</small></div>
                  <div><div class="commission-label">已结算</div><strong>{{ formatMoney(dashboard.commissions.settled_amount) }}</strong><small>已支付销售</small></div>
                </div>
                <div class="commission-foot">统计截至今天的全部订单；金额由服务端按售价和下单时提成比例计算。</div>
              </n-card>

              <div class="details-grid">
                <n-card size="small" class="trend-card">
                  <div class="section-heading"><h3>本月每日销售额</h3><span>按下单日期</span></div>
                  <v-chart v-if="dashboard.month.daily_sales.length" class="trend-chart" :option="trendOption" autoresize />
                  <n-empty v-else description="本月暂无销售数据" class="details-empty" />
                </n-card>
                <n-card size="small" class="orders-card">
                  <div class="section-heading"><h3>近期订单</h3><span>当前销售</span></div>
                  <n-alert v-if="ordersError" type="error" :bordered="false" class="orders-error">
                    订单加载失败
                    <n-button text type="primary" @click="loadSelected">重试</n-button>
                  </n-alert>
                  <div v-else-if="recentOrders.length">
                    <div v-for="order in recentOrders" :key="order.id" class="order-row">
                      <div class="order-info"><strong>{{ order.customer_name }}</strong><small>{{ order.order_no }} · {{ formatDate(order.created_at) }}</small></div>
                      <strong class="order-amount">{{ formatMoney(order.total_amount) }}</strong>
                    </div>
                  </div>
                  <n-empty v-else description="该销售暂无订单" class="details-empty" />
                </n-card>
              </div>
            </template>
          </n-spin>
        </template>
        <n-card v-else size="small" class="unselected-card">
          <n-empty :description="accountsError ? '销售名单暂不可用' : '请选择销售查看看板'" />
        </n-card>
      </div>
    </div>

    <n-modal v-model:show="showCommissionHelp" preset="card" title="提成口径" style="width: 520px; max-width: 94vw">
      <p>提成按订单售价与下单时的销售提成比例计算。未付清订单显示预估提成；付清后进入待结算；支付给销售后计入已结算。</p>
      <p>取消订单不计提成；退货按退货商品售价扣减。已结算后发生退货，多付部分从下一次待结算提成中抵扣。</p>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'
import VChart from 'vue-echarts'
import dayjs from 'dayjs'
import { accountApi, orderApi, salesApi } from '@/api'
import { useAppStore } from '@/stores/app'
import { formatDate, formatMoney } from '@/utils/format'
import type { OrderListItem, SalesDashboard, SystemAccount } from '@/types'

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const router = useRouter()
const route = useRoute()
const app = useAppStore()
const keyword = ref('')
const accounts = ref<SystemAccount[]>([])
const selectedId = ref<number | null>(null)
const dashboard = ref<SalesDashboard | null>(null)
const recentOrders = ref<OrderListItem[]>([])
const loadingAccounts = ref(false)
const loadingDashboard = ref(false)
const accountsError = ref(false)
const dashboardError = ref(false)
const ordersError = ref(false)
const updatedAt = ref('')
const showCommissionHelp = ref(false)
let requestId = 0

const filteredSales = computed(() => accounts.value.filter(account =>
  (account.real_name || account.username).includes(keyword.value.trim()),
))
const selectedAccount = computed(() => accounts.value.find(account => account.id === selectedId.value) || null)
const trendOption = computed<EChartsOption>(() => ({
  color: [app.isDark ? '#818cf8' : '#4f46e5'],
  grid: { left: 50, right: 12, top: 24, bottom: 26 },
  tooltip: { trigger: 'axis' },
  xAxis: {
    type: 'category',
    data: dashboard.value?.month.daily_sales.map(point => dayjs(point.date).format('D日')) || [],
    axisLabel: { color: app.isDark ? '#8089a0' : '#8a91a1', interval: 'auto' },
    axisLine: { lineStyle: { color: app.isDark ? '#2a2f3d' : '#e8eaf0' } },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value',
    min: 0,
    axisLabel: { color: app.isDark ? '#8089a0' : '#8a91a1' },
    splitLine: { lineStyle: { color: app.isDark ? '#2a2f3d' : '#e8eaf0' } },
  },
  series: [{ type: 'bar', barMaxWidth: 24, data: dashboard.value?.month.daily_sales.map(point => Number(point.sales_amount)) || [] }],
}))

async function loadAccounts(): Promise<void> {
  loadingAccounts.value = true
  accountsError.value = false
  try {
    const rows = await accountApi.listSales({})
    accounts.value = rows
    const requestedId = Number(route.query.sales_id)
    if (selectedId.value === null && rows.some(account => account.id === requestedId)) selectedId.value = requestedId
    else if (!rows.some(account => account.id === selectedId.value)) selectedId.value = rows[0]?.id ?? null
    if (selectedId.value !== null) await loadSelected()
  } catch {
    accountsError.value = true
  } finally {
    loadingAccounts.value = false
  }
}

function selectSales(id: number): void {
  if (selectedId.value === id) return
  selectedId.value = id
  void loadSelected()
}

async function loadSelected(): Promise<void> {
  const id = selectedId.value
  if (id === null) return
  const current = ++requestId
  dashboard.value = null
  recentOrders.value = []
  dashboardError.value = false
  ordersError.value = false
  updatedAt.value = ''
  loadingDashboard.value = true
  const [stats, orders] = await Promise.allSettled([
    salesApi.dashboard(id),
    orderApi.list({ sales_id: id, page: 1, page_size: 3 }),
  ])
  if (current !== requestId) return
  if (stats.status === 'fulfilled') {
    dashboard.value = stats.value
    updatedAt.value = dayjs().format('HH:mm')
  } else {
    dashboardError.value = true
  }
  if (orders.status === 'fulfilled') recentOrders.value = orders.value.items
  else ordersError.value = true
  loadingDashboard.value = false
}

onMounted(loadAccounts)
</script>

<style scoped>
.sales-dashboard{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.sales-dashboard>.page-header{flex:none}
.page-note,.picker-note,.identity-note,.updated-at,.metric-note,.commission-foot,.section-heading span{color:var(--text-3);font-size:12px}
.page-note{margin:4px 0 0}.header-actions{display:flex;align-items:center;gap:12px}.dashboard-layout{display:grid;grid-template-columns:250px minmax(0,1fr);align-items:start;gap:16px}.dashboard-main{min-width:0}.sales-picker{min-width:0}.picker-title{font-size:15px;font-weight:600}.picker-note{margin:4px 0 14px}.picker-error{margin-top:12px}.picker-loading{height:120px}.sales-list{margin:12px -16px -12px}.sales-item{width:100%;display:flex;align-items:center;gap:10px;padding:11px 16px;border:0;border-top:1px solid var(--border);background:transparent;color:var(--text-1);text-align:left;cursor:pointer}.sales-item:hover{background:var(--bg-hover)}.sales-item.selected{background:var(--primary-soft);box-shadow:inset 3px 0 var(--primary)}.sales-avatar{display:grid;place-items:center;flex:none;width:32px;height:32px;border-radius:8px;background:var(--bg-hover);color:var(--text-2);font-weight:600}.sales-item.selected .sales-avatar{background:var(--primary-soft-hover);color:var(--primary)}.sales-info{min-width:0;flex:1}.sales-info strong,.sales-info small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sales-info strong{font-size:13px}.sales-info small{margin-top:3px;color:var(--text-3);font-size:11px}.picker-empty{padding:30px 0}.identity-card,.commission-card{margin-bottom:14px}.identity-card :deep(.n-card__content){display:flex;justify-content:space-between;align-items:center;gap:12px}.identity-name{font-size:19px;font-weight:600}.identity-note{margin-top:5px}.identity-date{display:flex;align-items:end;flex-direction:column;gap:7px;color:var(--text-3);font-size:12px}.data-error{margin-bottom:14px}.dashboard-loading{height:300px}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:14px}.metric-card{min-width:0}.metric-label,.commission-label{color:var(--text-3);font-size:12px}.metric-value{margin:16px 0 9px;color:var(--text-1);font-size:25px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}.metric-value span{font-size:14px}.commission-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:17px}.commission-grid>div{padding-left:18px;border-left:1px solid var(--border)}.commission-grid>div:first-child{padding-left:0;border-left:0}.commission-grid strong,.commission-grid small{display:block}.commission-grid strong{margin-top:9px;font-size:21px;font-weight:600;font-variant-numeric:tabular-nums}.commission-grid small{margin-top:5px;color:var(--text-3);font-size:11px}.commission-foot{margin-top:18px;padding:9px 11px;border-radius:6px;background:var(--bg-subtle)}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}.section-heading h3{margin:0;font-size:15px;font-weight:600}.details-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:14px}.trend-chart{width:100%;height:255px}.details-empty{padding:55px 0}.orders-error{margin-top:14px}.order-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 0;border-bottom:1px solid var(--border)}.order-row:last-child{border-bottom:0}.order-info{min-width:0}.order-info strong,.order-info small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.order-info strong{font-size:13px}.order-info small{margin-top:5px;color:var(--text-3);font-size:11px}.order-amount{white-space:nowrap;font-variant-numeric:tabular-nums}.unselected-card{padding:55px 0}
.dashboard-layout{flex:1;min-height:0;overflow:hidden;align-items:stretch}
.sales-picker{height:100%;overflow-y:auto;overscroll-behavior:contain}
.dashboard-main{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable;padding-right:4px}
@media(max-width:1100px){.dashboard-layout{grid-template-columns:210px minmax(0,1fr)}.details-grid{grid-template-columns:1fr}.metrics{grid-template-columns:1fr}.metric-value{margin:8px 0}}
@media(max-width:650px){.sales-dashboard{height:auto;min-height:100%;overflow:visible}.dashboard-layout{flex:none;overflow:visible;grid-template-columns:1fr}.sales-picker{height:auto;max-height:220px}.dashboard-main{overflow:visible;padding-right:0}.sales-list{max-height:220px;overflow:auto}.commission-grid{gap:8px}.commission-grid>div{padding-left:8px}.commission-grid strong{font-size:16px}.header-actions{width:100%;justify-content:space-between}}
</style>
