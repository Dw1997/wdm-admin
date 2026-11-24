<template>
  <div class="page-container cost-center">
    <div class="page-header">
      <h2 class="page-title">成本中心</h2>
      <div class="header-right">
        <div class="month-switch">
          <n-button size="small" quaternary :disabled="!canPrev" @click="shiftMonth(-1)">‹</n-button>
          <span class="month-text">{{ monthLabel }}</span>
          <n-button size="small" quaternary :disabled="!canNext" @click="shiftMonth(1)">›</n-button>
        </div>
        <n-tag v-if="isLiveMonth" type="warning" size="small" :bordered="false">进行中</n-tag>
        <n-button size="small" :disabled="!report" @click="exportReport">导出报表</n-button>
      </div>
    </div>

    <n-alert v-if="error" type="error" :bordered="false" class="block">
      成本数据加载失败：{{ error }}
      <n-button text type="primary" style="margin-left: 8px" @click="loadAll">重试</n-button>
    </n-alert>

    <n-spin :show="loading">
      <div class="kpis">
        <div v-for="k in kpis" :key="k.label" class="kpi" :class="{ main: k.main, loss: k.main && Number(k.value) < 0 }">
          <div class="k">{{ k.label }}<span v-if="k.hint" class="hint">{{ k.hint }}</span></div>
          <div class="v">{{ formatMoney(k.value) }}</div>
          <div class="d">
            <template v-if="report?.prev">
              上月 <b>{{ formatMoney(k.prev) }}</b>
              <span v-if="k.delta" class="delta" :class="k.delta.cls">{{ k.delta.text }}</span>
            </template>
            <template v-else>上月无数据</template>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <section class="card-section">
          <div class="sec-head">
            <h3>利润构成</h3>
            <span class="muted">{{ monthLabel }}{{ isLiveMonth ? ' · 截至今天' : ' · 整月' }}</span>
          </div>
          <div class="breakdown">
            <div
              v-for="row in breakdown"
              :key="row.name"
              class="row"
              :class="{ divider: row.divider, strong: row.strong, final: row.final }"
            >
              <span class="name">{{ row.name }}</span>
              <span class="bar"><i :class="row.kind" :style="{ width: row.pct + '%' }" /></span>
              <span class="amt" :class="{ neg: row.neg, loss: row.final && Number(row.amount) < 0 }">{{ row.neg ? '− ' : '' }}{{ formatMoney(row.amount) }}</span>
            </div>
          </div>
          <p class="foot">
            商品成本按成本价快照计算，报损部分仍计入；运费含发货运费与退货运费；抹零含订单抹零和事后减免。
            利润率 {{ profitRate }}。
          </p>
        </section>

        <section class="card-section">
          <div class="sec-head">
            <h3>近 6 个月趋势</h3>
            <span class="muted">{{ isLiveMonth ? '本月进行中（柱子到当前日期）' : '悬停柱子看金额' }}</span>
          </div>
          <v-chart v-if="report" class="chart" :option="trendOption" autoresize />
          <p class="foot">
            订单利润 = 销售额 − 商品成本 − 运费 − 抹零；月度利润 = 订单利润 − 经营成本。
          </p>
        </section>
      </div>

      <section class="card-section">
        <div class="sec-head">
          <h3>经营成本明细</h3>
          <span class="muted">{{ isLiveMonth ? '本月' : '整月' }} {{ pagination.itemCount }} 笔 · 合计 {{ formatMoney(report?.operating_cost) }}</span>
          <span class="spacer" />
          <n-select
            v-model:value="filter.categoryId"
            :options="categoryOptions"
            placeholder="全部类别"
            clearable
            size="small"
            style="width: 140px"
            @update:value="reloadList"
          />
          <n-input
            v-model:value="filter.keyword"
            placeholder="搜索备注"
            clearable
            size="small"
            style="width: 160px"
            @keyup.enter="reloadList"
            @clear="reloadList"
          />
          <n-button size="small" type="primary" @click="openCreate">记一笔</n-button>
        </div>

        <div v-if="report?.categories.length" class="dist">
          <div class="dist-bar">
            <i
              v-for="c in report.categories"
              :key="c.category"
              :style="{ width: share(c.amount) + '%', background: expenseCategoryColor(c.category) }"
            />
          </div>
          <div class="dist-legend">
            <span v-for="c in report.categories" :key="c.category">
              <i :style="{ background: expenseCategoryColor(c.category) }" />{{ c.category }}
              <b>{{ formatMoney(c.amount) }}</b> · {{ share(c.amount).toFixed(1) }}%
            </span>
          </div>
        </div>

        <n-data-table
          remote
          size="small"
          :bordered="false"
          :columns="columns"
          :data="expenses"
          :loading="listLoading"
          :pagination="pagination"
          :scroll-x="860"
          :row-key="(r: OperatingExpense) => r.id"
          style="margin-top: 8px"
        />
      </section>
    </n-spin>

    <n-modal
      v-model:show="showModal"
      preset="card"
      :title="editingId ? '编辑费用' : '记一笔经营成本'"
      style="width: 460px"
      :bordered="false"
    >
      <n-form label-placement="left" label-width="72" :show-feedback="false">
        <n-form-item label="发生日期">
          <n-date-picker
            v-model:formatted-value="form.expenseDate"
            value-format="yyyy-MM-dd"
            type="date"
            :clearable="false"
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="类别">
          <n-select
            v-model:value="form.categoryId"
            :options="manualCategoryOptions"
            placeholder="选择类别"
            filterable
          />
        </n-form-item>
        <n-form-item label="金额">
          <n-input-number
            v-model:value="form.amount"
            :min="0.01"
            :precision="2"
            :show-button="false"
            placeholder="0.00"
            style="width: 100%"
          >
            <template #suffix>元</template>
          </n-input-number>
        </n-form-item>
        <n-form-item label="备注">
          <n-input v-model:value="form.remark" maxlength="200" placeholder="如：11/03 配送车加柴油 420L" />
        </n-form-item>
        <div class="form-hint">
          归属月份按发生日期算（{{ form.expenseDate ? form.expenseDate.slice(0, 7) : monthLabel }}）；经营成本不参与单笔订单利润，只在月度利润里扣减；同一类别可以录多笔。
        </div>
      </n-form>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="save">{{ editingId ? '保存' : '记一笔' }}</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { NTag, useDialog, useMessage, type DataTableColumns } from 'naive-ui'
import { actionBar, actionIcon } from '@/components/tableActions'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import dayjs from 'dayjs'
import type { EChartsOption } from 'echarts'
import { financeApi } from '@/api'
import { formatDate, formatMoney } from '@/utils/format'
import { expenseCategoryColor } from '@/utils/dict'
import { confirmAction } from '@/utils/confirm'
import type { ExpenseCategory, MonthlyProfitReport, OperatingExpense } from '@/types'

use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const message = useMessage()
const dialog = useDialog()

const month = ref(dayjs().format('YYYY-MM'))
const report = ref<MonthlyProfitReport | null>(null)
const expenses = ref<OperatingExpense[]>([])
const loading = ref(false)
const listLoading = ref(false)
const error = ref('')

const filter = reactive({ categoryId: null as number | null, keyword: '' })
const categories = ref<ExpenseCategory[]>([])
const pagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: false,
  onChange: (page: number) => {
    pagination.page = page
    loadExpenses()
  },
})

const currentMonth = dayjs().format('YYYY-MM')
const isLiveMonth = computed(() => month.value === currentMonth)
const monthLabel = computed(() => `${month.value.slice(0, 4)} 年 ${Number(month.value.slice(5))} 月`)
const canPrev = computed(() => true)
const canNext = computed(() => month.value < currentMonth)

/* ---------- 汇总卡 ---------- */
type Delta = { text: string; cls: string } | null
function delta(cur: string, prev: string | undefined, lowerIsBetter: boolean): Delta {
  if (prev === undefined) return null
  const base = Number(prev)
  if (!base) return null
  const change = ((Number(cur) - base) / Math.abs(base)) * 100
  if (Math.abs(change) < 0.05) return { text: '持平', cls: 'flat' }
  const up = change > 0
  const good = lowerIsBetter ? !up : up
  return { text: `${up ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}%`, cls: good ? 'good' : 'bad' }
}

const kpis = computed(() => {
  const r = report.value
  if (!r) return []
  const p = r.prev
  return [
    { label: '销售额', hint: '已送达订单', value: r.sales_amount, prev: p?.sales_amount, delta: delta(r.sales_amount, p?.sales_amount, false), main: false },
    { label: '订单利润', value: r.order_profit, prev: p?.order_profit, delta: delta(r.order_profit, p?.order_profit, false), main: false },
    { label: '经营成本', value: r.operating_cost, prev: p?.operating_cost, delta: delta(r.operating_cost, p?.operating_cost, true), main: false },
    { label: '月度利润', value: r.profit, prev: p?.profit, delta: delta(r.profit, p?.profit, false), main: true },
  ]
})

/* ---------- 利润构成 ---------- */
const breakdown = computed(() => {
  const r = report.value
  if (!r) return []
  const base = Number(r.sales_amount) || 1
  const rows = [
    { name: '销售额', amount: r.sales_amount, kind: 'income' },
    { name: '商品成本', amount: r.goods_cost, kind: 'cost', neg: true },
    { name: '运费成本', amount: r.freight_cost, kind: 'cost', neg: true },
    { name: '抹零减免', amount: r.rounding_amount, kind: 'cost', neg: true },
    { name: '订单利润', amount: r.order_profit, kind: 'profit', divider: true, strong: true },
    { name: '经营成本', amount: r.operating_cost, kind: 'cost', neg: true },
    { name: '月度利润', amount: r.profit, kind: 'net', divider: true, final: true },
  ]
  return rows.map((row) => ({
    ...row,
    pct: Math.max(0, Math.min(100, (Number(row.amount) / base) * 100)),
  }))
})

const profitRate = computed(() => {
  const r = report.value
  const sales = Number(r?.sales_amount || 0)
  if (!sales) return '—'
  return `${((Number(r!.profit) / sales) * 100).toFixed(1)}%`
})

/* ---------- 趋势图 ---------- */
const trendOption = computed<EChartsOption>(() => {
  const trend = report.value?.trend ?? []
  const months = trend.map((p) => `${Number(p.month.slice(5))} 月`)
  const orderProfit = trend.map((p) => Number(p.order_profit))
  const profit = trend.map((p) => Number(p.profit))
  // 金额小的时候用"元"，上万才换成"万"，避免刻度全挤成 0 万
  const peak = Math.max(0, ...orderProfit, ...profit)
  const inWan = peak >= 10000
  const tick = (v: number) => {
    if (!inWan) return `${Math.round(v)} 元`
    const w = v / 10000
    return `${Number.isInteger(w) ? w : w.toFixed(1)} 万`
  }
  return {
    grid: { left: 4, right: 18, top: 30, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v) => formatMoney(v as number),
      textStyle: { fontSize: 12 },
    },
    legend: {
      right: 0,
      top: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { fontSize: 11, color: '#8a91a1' },
      data: ['订单利润', '月度利润'],
    },
    xAxis: {
      type: 'category',
      // 进行中的月份用主色加粗，代替原来靠半透明区分
      data: months.map((m, i) => ({
        value: m,
        textStyle:
          trend[i].month === currentMonth
            ? { color: '#4f46e5', fontWeight: 'bold' }
            : { color: '#8a91a1' },
      })),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e8eaf0' } },
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#f1f3f9' } },
      axisLabel: {
        fontSize: 11,
        color: '#8a91a1',
        formatter: tick,
      },
    },
    series: [
      {
        name: '订单利润',
        type: 'bar',
        data: orderProfit,
        barWidth: 12,
        barGap: '30%',
        itemStyle: { color: '#c7c9f5', borderRadius: [3, 3, 0, 0] },
      },
      {
        name: '月度利润',
        type: 'bar',
        data: profit,
        barWidth: 12,
        itemStyle: { color: '#4f46e5', borderRadius: [3, 3, 0, 0] },
      },
    ],
  }
})

/* ---------- 明细表 ---------- */
const categoryOptions = computed(() =>
  categories.value.map((c) => ({ label: c.name, value: c.id })),
)
/** 「销售提成」由提成结算写入，不能手工录入 */
const manualCategoryOptions = computed(() =>
  categories.value.filter((c) => !c.is_system).map((c) => ({ label: c.name, value: c.id })),
)

function share(amount: string): number {
  const total = Number(report.value?.operating_cost || 0)
  if (!total) return 0
  return (Number(amount) / total) * 100
}

const columns = computed<DataTableColumns<OperatingExpense>>(() => [
  {
    title: '类别',
    key: 'category',
    width: '13%',
    render: (r) =>
      h('div', { class: 'cat-cell' }, [
        h(
          NTag,
          {
            size: 'small',
            bordered: false,
            color: { color: `${expenseCategoryColor(r.category)}14`, textColor: expenseCategoryColor(r.category) },
          },
          { default: () => r.category },
        ),
        r.source === 'commission' ? h('span', { class: 'auto-tag' }, '自动') : null,
      ]),
  },
  { title: '发生日期', key: 'expense_date', width: '13%', render: (r) => r.expense_date },
  { title: '备注', key: 'remark', width: '26%', ellipsis: { tooltip: true }, render: (r) => r.remark || '—' },
  {
    title: '金额',
    key: 'amount',
    width: '12%',
    render: (r) => h('span', { class: 'amount-cell' }, formatMoney(r.amount)),
  },
  {
    title: '录入人',
    key: 'operator_name',
    width: '12%',
    ellipsis: { tooltip: true },
    render: (r) => (r.source === 'commission' ? '系统' : r.operator_name || '—'),
  },
  { title: '录入时间', key: 'created_at', width: '14%', render: (r) => formatDate(r.created_at, 'MM-DD HH:mm') },
  {
    title: '操作',
    key: 'actions',
    width: '10%',
    align: 'right',
    render: (r) =>
      r.source === 'commission'
        ? h('span', { class: 'sys-note', title: '由提成结算写入，撤销结算时自动冲销' }, '系统生成')
        : actionBar([
            actionIcon({ icon: 'edit', label: '编辑', size: 16, onClick: () => openEdit(r) }),
            actionIcon({ icon: 'delete', label: '删除', size: 16, onClick: () => removeExpense(r) }),
          ], { justify: 'flex-end' }),
  },
])

/* ---------- 数据加载 ---------- */
async function loadReport() {
  report.value = await financeApi.monthlyProfit(month.value)
}

async function loadExpenses() {
  listLoading.value = true
  try {
    const res = await financeApi.expenses({
      month: month.value,
      category_id: filter.categoryId ?? undefined,
      keyword: filter.keyword || undefined,
      page: pagination.page,
      page_size: pagination.pageSize,
    })
    expenses.value = res.items
    pagination.itemCount = res.total
  } finally {
    listLoading.value = false
  }
}

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    if (!categories.value.length) {
      categories.value = (await financeApi.expenseCategories()).items
    }
    await Promise.all([loadReport(), loadExpenses()])
  } catch (e: any) {
    error.value = e?.response?.data?.message || e?.message || '请稍后重试'
  } finally {
    loading.value = false
  }
}

function reloadList() {
  pagination.page = 1
  loadExpenses()
}

function shiftMonth(step: number) {
  const next = dayjs(`${month.value}-01`).add(step, 'month').format('YYYY-MM')
  if (next > currentMonth) return
  month.value = next
  filter.categoryId = null
  filter.keyword = ''
  pagination.page = 1
  loadAll()
}

/* ---------- 弹窗 ---------- */
const showModal = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({
  expenseDate: '',
  categoryId: null as number | null,
  amount: null as number | null,
  remark: '',
})

/** 新增时的默认发生日期：当前月用今天，历史月用该月 1 号。 */
function defaultExpenseDate(): string {
  return month.value === currentMonth ? dayjs().format('YYYY-MM-DD') : `${month.value}-01`
}

function openCreate() {
  editingId.value = null
  form.expenseDate = defaultExpenseDate()
  form.categoryId = null
  form.amount = null
  form.remark = ''
  showModal.value = true
}

function openEdit(row: OperatingExpense) {
  editingId.value = row.id
  form.expenseDate = row.expense_date
  form.categoryId = row.category_id
  form.amount = Number(row.amount)
  form.remark = row.remark || ''
  showModal.value = true
}

async function save() {
  if (!form.expenseDate) {
    message.warning('请选择发生日期')
    return
  }
  if (!form.categoryId) {
    message.warning('请选择类别')
    return
  }
  if (!form.amount || form.amount <= 0) {
    message.warning('请填写大于 0 的金额')
    return
  }
  saving.value = true
  try {
    const payload = {
      expense_date: form.expenseDate,
      category_id: form.categoryId,
      amount: form.amount.toFixed(2),
      remark: form.remark || undefined,
    }
    if (editingId.value) {
      await financeApi.updateExpense(editingId.value, payload)
      message.success('已保存')
    } else {
      await financeApi.createExpense(payload)
      message.success('已记一笔')
    }
    showModal.value = false
    // 发生日期落在别的月份时，切过去让用户看到这笔
    const targetMonth = form.expenseDate.slice(0, 7)
    if (targetMonth !== month.value && targetMonth <= currentMonth) {
      month.value = targetMonth
      filter.categoryId = null
      filter.keyword = ''
      pagination.page = 1
      await loadAll()
      message.info(`这笔费用记在 ${targetMonth}`)
      return
    }
    await Promise.all([loadReport(), loadExpenses()])
  } catch {
    /* 错误提示由请求层统一给出 */
  } finally {
    saving.value = false
  }
}

function removeExpense(row: OperatingExpense) {
  confirmAction(dialog, {
    title: '删除这笔费用',
    content: `${row.category} ${formatMoney(row.amount)}，删除后${monthLabel.value}的经营成本和月度利润会立即变化。`,
    confirmText: '删除',
    danger: true,
    onConfirm: async () => {
      try {
        await financeApi.deleteExpense(row.id)
        message.success('已删除')
        await Promise.all([loadReport(), loadExpenses()])
      } catch {
        /* 错误提示由请求层统一给出 */
      }
    },
  })
}

/* ---------- 导出 ---------- */
async function exportReport() {
  const r = report.value
  if (!r) return
  try {
    const res = await financeApi.expenses({ month: month.value, page: 1, page_size: 100 })
    if (res.total > 100) {
      message.warning('明细超过 100 条，请先按类别筛选后再导出')
      return
    }
    const rows: string[][] = [
      ['味都美 月度利润报表', monthLabel.value],
      ['销售额', r.sales_amount],
      ['商品成本', r.goods_cost],
      ['运费成本', r.freight_cost],
      ['抹零减免', r.rounding_amount],
      ['订单利润', r.order_profit],
      ['经营成本', r.operating_cost],
      ['月度利润', r.profit],
      ['已送达订单数', String(r.order_count)],
      [],
      ['经营成本明细'],
      ['发生日期', '类别', '备注', '金额', '录入人', '录入时间'],
      ...res.items.map((e) => [e.expense_date, e.category, e.remark || '', e.amount, e.source === 'commission' ? '系统' : e.operator_name || '', formatDate(e.created_at)]),
    ]
    const csv = rows.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `月度利润报表-${month.value}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    message.success('已导出 CSV')
  } catch {
    /* 错误提示由请求层统一给出 */
  }
}

onMounted(loadAll)
</script>

<style scoped>
.cost-center { display: flex; flex-direction: column; gap: 12px; }
.cost-center .page-header {
  position: sticky;
  top: 0;
  z-index: 20;
  margin: -12px -16px 0;
  padding: 12px 16px;
  background: var(--bg-page);
  border-bottom: 1px solid var(--border);
}
.header-right { display: flex; align-items: center; gap: 8px; }
.month-switch {
  display: inline-flex; align-items: center; gap: 2px;
  border: 1px solid var(--border); border-radius: 8px; padding: 0 4px; height: 30px;
}
.month-text { font-size: 13px; font-weight: 600; min-width: 96px; text-align: center; }
.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.kpi {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 14px 16px; box-shadow: var(--shadow-card);
}
.kpi .k { font-size: 12px; color: var(--text-3); display: flex; align-items: center; gap: 6px; }
.kpi .k .hint { color: var(--text-3); opacity: 0.75; }
.kpi .v { font-size: 23px; font-weight: 600; margin-top: 6px; letter-spacing: 0.2px; }
.kpi .d { font-size: 11px; color: var(--text-3); margin-top: 6px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.kpi .d b { color: var(--text-2); font-weight: 600; }
.kpi.main { border-color: rgba(79, 70, 229, 0.35); background: linear-gradient(180deg, var(--primary-soft), var(--bg-card)); }
.kpi.main .v { color: var(--success); }
.kpi.main.loss .v { color: var(--danger); }
.delta { border-radius: 5px; padding: 1px 6px; font-weight: 600; font-size: 11px; }
.delta.good { background: rgba(22, 163, 74, 0.12); color: var(--success); }
.delta.bad { background: rgba(220, 38, 38, 0.1); color: var(--danger); }
.delta.flat { background: var(--bg-hover); color: var(--text-3); }

.grid-2 { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 12px; align-items: stretch; }
.grid-2 .card-section { display: flex; flex-direction: column; }
.sec-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.sec-head h3 { font-size: 15px; font-weight: 600; margin: 0; }
.sec-head .muted { font-size: 12px; color: var(--text-3); }
.sec-head .spacer { flex: 1; }

.breakdown { display: flex; flex-direction: column; }
.breakdown .row {
  display: grid; grid-template-columns: 88px minmax(0, 1fr) 124px;
  align-items: center; gap: 12px; padding: 6px 4px; font-size: 13px; border-radius: 6px;
}
.breakdown .row .name { color: var(--text-2); }
.breakdown .bar { height: 8px; border-radius: 5px; background: var(--bg-hover); overflow: hidden; }
.breakdown .bar i { display: block; height: 100%; border-radius: 5px; min-width: 2px; }
.breakdown .bar i.income { background: var(--primary); }
.breakdown .bar i.cost { background: #c9ced9; }
.breakdown .bar i.profit { background: #8b8cf0; }
.breakdown .bar i.net { background: var(--success); }
.breakdown .amt { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
.breakdown .amt.neg { color: var(--text-3); font-weight: 500; }
.breakdown .row.divider { border-top: 1px dashed var(--border); border-radius: 0; margin-top: 4px; padding-top: 10px; }
.breakdown .row.strong .name { color: var(--text-1); font-weight: 600; }
.breakdown .row.final { background: rgba(22, 163, 74, 0.07); }
.breakdown .row.final .name { color: var(--text-1); font-weight: 700; }
.breakdown .row.final .amt { color: var(--success); font-size: 15px; }
.breakdown .row.final .amt.loss { color: var(--danger); }
.foot { font-size: 11px; color: var(--text-3); line-height: 1.65; margin: 10px 0 0; }
.chart { height: 236px; }

.dist { padding: 10px 12px; background: var(--bg-subtle); border-radius: 8px; margin-bottom: 4px; }
.dist-bar { display: flex; height: 10px; border-radius: 6px; overflow: hidden; background: var(--bg-hover); gap: 2px; }
.dist-bar i { display: block; height: 100%; }
.dist-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 8px; font-size: 11px; color: var(--text-2); }
.dist-legend span { display: inline-flex; align-items: center; gap: 5px; }
.dist-legend i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.dist-legend b { color: var(--text-1); font-weight: 600; }
.form-hint {
  background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 8px;
  padding: 9px 11px; font-size: 12px; color: var(--text-3); line-height: 1.6;
}
:deep(.row-actions) { display: flex; justify-content: flex-end; gap: 8px; }
:deep(.amount-cell) { font-weight: 500; font-variant-numeric: tabular-nums; }
:deep(.cat-cell) { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
:deep(.auto-tag) {
  font-size: 10px; font-weight: 600; color: #be185d; background: #fdf2f8;
  border-radius: 4px; padding: 1px 5px;
}
:deep(.sys-note) { font-size: 11.5px; color: var(--text-3); }

@media (max-width: 1180px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid-2 { grid-template-columns: minmax(0, 1fr); }
}
</style>
