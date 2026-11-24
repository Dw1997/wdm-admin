<template>
  <div class="page-container commission-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">销售提成</h2>
        <p class="page-sub">
          提成由订单推导，<b>送达并付清</b>后才能发放；发薪日由店铺发现金给销售，这里只登记。发放金额计入经营成本的「销售提成」。
        </p>
      </div>
      <div class="header-right">
        <div class="month-switch">
          <n-button size="small" quaternary @click="shiftMonth(-1)">‹</n-button>
          <span class="month-text">{{ monthLabel }}</span>
          <n-button size="small" quaternary :disabled="!canNext" @click="shiftMonth(1)">›</n-button>
        </div>
        <n-button size="small" :disabled="!summary" @click="exportCsv">导出</n-button>
        <n-button text type="primary" @click="helpVisible = true">查看口径</n-button>
      </div>
    </div>

    <n-alert type="info" :bordered="false" class="rule-bar">
      提成基数 = <b>行实送金额 − 行退货金额</b>；比例取<b>下单时的行快照</b>（不同销售、不同商品可以不同），改比例不影响历史订单。
      订单未付清或未送达为「预估」，送达并付清转「待结算」，发放后为「已结算」。
      <b>已结算的订单再退货</b>，多发的提成转成「待抵扣」，下次发放时自动扣。
    </n-alert>

    <n-spin :show="loading">
      <div class="kpis">
        <div class="kpi">
          <div class="k">本期提成合计</div>
          <div class="v">{{ money(kpi?.total_amount) }}</div>
          <div class="d">共 {{ kpi?.order_count || 0 }} 笔订单 · 基数 {{ money(kpi?.total_base) }}</div>
        </div>
        <div class="kpi action">
          <div class="k">待结算 <span class="dot" /></div>
          <div class="v">{{ money(kpi?.pending_amount) }}</div>
          <div class="d">
            {{ kpi?.pending_count || 0 }} 笔 · 涉及 {{ pendingSalesCount }} 位销售
            <template v-if="Number(kpi?.clawback_amount)">
              · 抵扣后实发 {{ money(kpi?.net_pending_amount) }}
            </template>
          </div>
        </div>
        <div class="kpi warn">
          <div class="k">待抵扣</div>
          <div class="v">{{ money(kpi?.clawback_amount) }}</div>
          <div class="d">
            {{ kpi?.clawback_count || 0 }} 位销售 · 已结算后退货，抵下次发放
          </div>
        </div>
        <div class="kpi">
          <div class="k">已结算</div>
          <div class="v">{{ money(kpi?.settled_amount) }}</div>
          <div class="d">{{ kpi?.settled_count || 0 }} 笔 · 已计入经营成本</div>
        </div>
        <div class="kpi muted">
          <div class="k">预估</div>
          <div class="v">{{ money(kpi?.estimated_amount) }}</div>
          <div class="d">{{ kpi?.estimated_count || 0 }} 笔 · 订单付清后转入待结算</div>
        </div>
      </div>

      <section class="card-section">
        <div class="sec-head">
          <h3>销售汇总</h3>
          <span class="muted">点一行筛选下方明细</span>
          <span class="spacer" />
          <n-button v-if="salesFilter" size="tiny" quaternary type="primary" @click="clearSalesFilter">
            清除筛选
          </n-button>
        </div>
        <n-data-table
          size="small"
          :bordered="false"
          :columns="salesColumns"
          :data="summary?.sales || []"
          :row-key="(r: CommissionSales) => r.sales_id"
          :row-props="salesRowProps"
          :row-class-name="salesRowClass"
        />
      </section>

      <section class="card-section">
        <n-tabs v-model:value="tab" type="line" animated @update:value="onTabChange">
          <n-tab-pane name="detail" :tab="`提成明细${salesFilter ? ` · ${salesFilterName}` : ''}`">
            <div class="toolbar">
              <n-radio-group v-model:value="status" size="small" @update:value="reloadRows">
                <n-radio-button value="all">全部 {{ kpi?.order_count || 0 }}</n-radio-button>
                <n-radio-button value="pending">待结算 {{ kpi?.pending_count || 0 }}</n-radio-button>
                <n-radio-button value="estimated">预估 {{ kpi?.estimated_count || 0 }}</n-radio-button>
                <n-radio-button value="settled">已结算 {{ kpi?.settled_count || 0 }}</n-radio-button>
                <n-radio-button value="clawback">待抵扣</n-radio-button>
              </n-radio-group>
              <n-input
                v-model:value="keyword"
                size="small"
                clearable
                placeholder="搜客户或订单号"
                style="width: 200px"
                @keyup.enter="searchRows"
                @clear="searchRows"
              />
              <span class="spacer" />
              <n-button
                size="small"
                type="primary"
                :disabled="!selectedRows.length"
                @click="openSettle(selectedRows)"
              >
                {{ selectedRows.length ? `批量结算 (${selectedRows.length}) · ${money(selectedTotal)}` : '批量结算' }}
              </n-button>
            </div>

            <n-data-table
              remote
              size="small"
              :bordered="false"
              :columns="detailColumns"
              :data="rows"
              :loading="listLoading"
              :row-key="(r: CommissionRow) => r.order_id"
              :checked-row-keys="selected"
              :pagination="pagination"
              @update:checked-row-keys="onSelect"
            />
            <div v-if="rows.length" class="table-foot">
              <span>本页 {{ rows.length }} 笔</span>
              <span>基数合计 <b>{{ money(pageBase) }}</b></span>
              <span>提成合计 <b class="accent">{{ money(pageAmount) }}</b></span>
              <span v-if="pageClawback">退货冲销 <b class="claw">−{{ money(pageClawback) }}</b></span>
            </div>
          </n-tab-pane>

          <n-tab-pane name="records" tab="结算记录">
            <n-data-table
              remote
              size="small"
              :bordered="false"
              :columns="recordColumns"
              :data="records"
              :loading="recordLoading"
              :row-key="(r: CommissionSettlement) => r.settlement_no"
              :pagination="recordPagination"
            />
          </n-tab-pane>
        </n-tabs>
      </section>
    </n-spin>

    <!-- 发放弹窗 -->
    <n-modal
      v-model:show="settleVisible"
      preset="card"
      title="登记提成发放"
      :bordered="false"
      style="width: 640px"
    >
      <div class="settle-sub">
        共 {{ settleRows.length }} 笔 · 涉及 {{ settleGroups.length }} 位销售 · 现金发放
        <span v-if="settleGroups.length > 1" class="warn">将生成 {{ settleGroups.length }} 张结算单</span>
      </div>

      <div class="settle-groups">
        <div v-for="group in settleGroups" :key="group.sales_id" class="settle-group">
          <div class="group-head">
            <span class="who">{{ group.sales_name }}</span>
            <span v-if="group.deduct > 0" class="deduct">抵扣 −{{ money(group.deduct) }}</span>
            <span class="sum">{{ money(group.net) }}</span>
          </div>
          <div v-for="row in group.rows" :key="row.order_id" class="group-row">
            <span class="no">{{ row.order_no }}</span>
            <span class="cust">{{ row.customer_name }}</span>
            <span class="amt">{{ money(row.commission_amount) }}</span>
          </div>
        </div>
      </div>

      <div class="settle-total">
        <div class="line"><span>应发合计</span><b>{{ money(settleTotal) }}</b></div>
        <div v-if="settleDeduct > 0" class="line deduct">
          <span>退货冲销抵扣</span><b>−{{ money(settleDeduct) }}</b>
        </div>
        <div class="line net"><span>本次实发（现金）</span><b>{{ money(settleNet) }}</b></div>
      </div>
      <div class="cost-hint">{{ costHint }}</div>

      <n-form label-placement="left" label-width="72" :show-feedback="false" style="margin-top: 14px">
        <n-form-item label="结算日期">
          <n-date-picker
            v-model:formatted-value="settleDate"
            value-format="yyyy-MM-dd"
            type="date"
            :clearable="false"
            style="width: 180px"
          />
          <span class="date-note">不早于最晚送达日 {{ earliestDate }}，不晚于今天</span>
        </n-form-item>
        <n-form-item label="备注">
          <n-input
            v-model:value="settleRemark"
            maxlength="200"
            placeholder="如：11 月上半月提成，发薪日现金发放"
          />
        </n-form-item>
      </n-form>
      <div class="settle-tip">
        确认后生成结算单，可在「结算记录」里撤销；撤销时对应经营成本一并冲销。抵扣部分不再发现金，剩余待抵扣继续挂在销售身上。
      </div>
      <template #footer>
        <div class="modal-footer">
          <n-button @click="settleVisible = false">取消</n-button>
          <n-button type="primary" :loading="settling" @click="submitSettle">
            确认发放 {{ money(settleNet) }}
          </n-button>
        </div>
      </template>
    </n-modal>

    <!-- 结算单明细 -->
    <n-modal
      v-model:show="detailVisible"
      preset="card"
      :title="detail ? `结算单 ${detail.settlement_no}` : '结算单'"
      :bordered="false"
      style="width: 620px"
    >
      <n-spin :show="detailLoading">
        <div v-if="detail" class="detail-meta">
          <span>{{ detail.sales_name }}</span>
          <span>{{ detail.settle_date }}</span>
          <span>{{ detail.item_count }} 笔</span>
          <span v-if="Number(detail.deduct_amount)" class="deduct-note">
            应发 {{ money(detail.gross_amount) }} · 抵扣 −{{ money(detail.deduct_amount) }}
          </span>
          <span class="amt">{{ money(detail.amount) }}</span>
          <n-tag v-if="detail.status === 'revoked'" size="tiny" type="error" :bordered="false">已撤销</n-tag>
        </div>
        <div v-if="detail" class="settle-groups">
          <div
            v-for="(item, idx) in detail.items"
            :key="`${item.order_id}-${item.kind}-${idx}`"
            class="group-row detail-row"
            :class="{ 'deduct-row': item.kind === 'deduction' }"
          >
            <span class="no">
              {{ item.order_no }}
              <em v-if="item.kind === 'deduction'" class="kind-tag">抵扣</em>
            </span>
            <span class="cust">{{ item.customer_name }}</span>
            <span class="date">{{ item.order_date }}</span>
            <span class="base">{{ Number(item.base_amount) ? money(item.base_amount) : '—' }}</span>
            <span class="amt">
              {{ item.kind === 'deduction' ? `−${money(Math.abs(Number(item.commission_amount)))}` : money(item.commission_amount) }}
            </span>
          </div>
        </div>
        <div v-if="detail" class="settle-tip">
          备注：{{ detail.remark || '—' }} · 操作人：{{ detail.operator_name || '—' }} · 计入
          {{ detail.cost_months.length ? detail.cost_months.map((m) => Number(m.slice(5))).join('、') : '—' }} 月经营成本
        </div>
      </n-spin>
    </n-modal>

    <!-- 口径说明 -->
    <n-modal v-model:show="helpVisible" preset="card" title="提成口径" :bordered="false" style="width: 560px">
      <div class="help-body">
        <p><b>1. 提成怎么算：</b>每行按 (实送数量 − 退货数量) × 单价 得出行金额，再乘该行下单时的提成比例；订单提成是各行相加。比例在「提成设置」里按销售、按商品维护。</p>
        <p><b>2. 三种状态：</b>订单未付清或未送达为「预估」；送达且付清转「待结算」；结算后为「已结算」。</p>
        <p><b>3. 发放：</b>提成由店铺在发薪日以现金发给销售，这里只做登记，系统不发起付款。一张结算单只对应一位销售，勾选多人会拆成多张。</p>
        <p><b>4. 归月：</b>按下单日期归入月份，和销售看板的「本月销售额」一致；经营成本也按下单月归属，收入和成本同月匹配。</p>
        <p><b>5. 成本：</b>发放时自动写一笔经营成本的「销售提成」，金额按实际发现金的数额，在成本中心只读；撤销结算时一并冲销，月度利润回补。</p>
        <p style="margin-bottom: 0"><b>6. 抵扣：</b>已发放的订单后来又退货，多发的提成转成该销售的「待抵扣」，下次发放时自动扣，最多扣到实发为 0，剩下的继续挂账。</p>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NTag, useDialog, useMessage, type DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import { financeApi } from '@/api'
import { confirmAction } from '@/utils/confirm'
import { formatMoney } from '@/utils/format'
import { actionBar, actionIcon } from '@/components/tableActions'
import type {
  CommissionRow,
  CommissionSales,
  CommissionSettlement,
  CommissionSettlementDetail,
  CommissionSummary,
  CommissionStatus,
} from '@/types'

const message = useMessage()
const dialog = useDialog()
const router = useRouter()

const currentMonth = dayjs().format('YYYY-MM')
const month = ref(currentMonth)
const monthLabel = computed(() => `${month.value.slice(0, 4)} 年 ${Number(month.value.slice(5))} 月`)
const canNext = computed(() => month.value < currentMonth)

const loading = ref(false)
const summary = ref<CommissionSummary | null>(null)
const kpi = computed(() => summary.value?.kpi)

const tab = ref<'detail' | 'records'>('detail')
// clawback 只是筛选值：专门捞「已结算后退货、还有待抵扣」的订单
const status = ref<'all' | CommissionStatus | 'clawback'>('all')
const keyword = ref('')
const salesFilter = ref<number | null>(null)
const salesFilterName = computed(
  () => summary.value?.sales.find((s) => s.sales_id === salesFilter.value)?.sales_name || '',
)
const pendingSalesCount = computed(
  () => (summary.value?.sales || []).filter((s) => Number(s.pending_amount) > 0).length,
)
/** 每位销售身上还没抵扣完的退货冲销 */
const clawbackBySales = computed(() => {
  const map = new Map<number, number>()
  for (const s of summary.value?.sales || []) {
    map.set(s.sales_id, Number(s.clawback_amount))
  }
  return map
})

const money = (v: string | number | null | undefined) => formatMoney(v)
const rateText = (rate: string | null) => (rate === null ? '—' : `${(Number(rate) * 100).toFixed(2)}%`)

const STATUS_LABEL: Record<CommissionStatus, string> = {
  estimated: '预估',
  pending: '待结算',
  settled: '已结算',
}
const STATUS_TYPE: Record<CommissionStatus, 'default' | 'warning' | 'success'> = {
  estimated: 'default',
  pending: 'warning',
  settled: 'success',
}

/* ---------- 数据加载 ---------- */
const rows = ref<CommissionRow[]>([])
const listLoading = ref(false)
const selected = ref<number[]>([])

const pagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: false,
  onChange: (page: number) => {
    pagination.page = page
    loadRows()
  },
})

const selectedRows = computed(() =>
  rows.value.filter((r) => selected.value.includes(r.order_id)),
)
const selectedTotal = computed(() =>
  selectedRows.value.reduce((sum, r) => sum + Number(r.commission_amount), 0),
)
const pageBase = computed(() => rows.value.reduce((sum, r) => sum + Number(r.base_amount), 0))
const pageAmount = computed(() =>
  rows.value.reduce((sum, r) => sum + Number(r.commission_amount), 0),
)
const pageClawback = computed(() =>
  rows.value.reduce((sum, r) => sum + Number(r.clawback_amount), 0),
)

async function loadSummary() {
  summary.value = await financeApi.commissionSummary(month.value)
}

async function loadRows() {
  listLoading.value = true
  try {
    const res = await financeApi.commissions({
      month: month.value,
      status: status.value === 'all' ? undefined : status.value,
      sales_id: salesFilter.value ?? undefined,
      keyword: keyword.value || undefined,
      page: pagination.page,
      page_size: pagination.pageSize,
    })
    rows.value = res.items
    pagination.itemCount = res.total
    // 翻页/筛选后保留有效勾选，避免结算到看不见的行
    const visible = new Set(res.items.filter((r) => r.status === 'pending').map((r) => r.order_id))
    selected.value = selected.value.filter((id) => visible.has(id))
  } finally {
    listLoading.value = false
  }
}

async function loadAll() {
  loading.value = true
  try {
    await Promise.all([loadSummary(), loadRows()])
  } finally {
    loading.value = false
  }
}

function reloadRows() {
  pagination.page = 1
  selected.value = []
  loadRows()
}

function searchRows() {
  reloadRows()
}

function shiftMonth(step: number) {
  const next = dayjs(`${month.value}-01`).add(step, 'month').format('YYYY-MM')
  if (next > currentMonth) return
  month.value = next
  salesFilter.value = null
  status.value = 'all'
  keyword.value = ''
  pagination.page = 1
  selected.value = []
  loadAll()
  if (tab.value === 'records') loadRecords()
}

function onSelect(keys: (string | number)[]) {
  selected.value = (keys as number[]).filter((id) => {
    const row = rows.value.find((r) => r.order_id === id)
    return row?.status === 'pending'
  })
}

/* ---------- 销售汇总 ---------- */
const salesColumns = computed<DataTableColumns<CommissionSales>>(() => [
  {
    title: '销售',
    key: 'sales_name',
    render: (r) =>
      h('div', { class: 'sales-cell' }, [
        h('span', { class: 'name' }, r.sales_name),
        r.has_rate
          ? h(
              NTag,
              { size: 'tiny', bordered: false, type: 'primary' },
              { default: () => rateText(r.default_rate) },
            )
          : h('span', { class: 'no-rate' }, '未设提成率'),
        !r.is_active ? h('span', { class: 'off' }, '已停用') : null,
      ]),
  },
  { title: '订单数', key: 'order_count', width: 90 },
  { title: '提成基数', key: 'base_amount', width: 130, align: 'right', render: (r) => money(r.base_amount) },
  {
    title: '提成金额',
    key: 'commission_amount',
    width: 130,
    align: 'right',
    render: (r) => h('b', { class: 'accent' }, money(r.commission_amount)),
  },
  {
    title: '待结算',
    key: 'pending_amount',
    width: 130,
    align: 'right',
    render: (r) => {
      const pending = Number(r.pending_amount)
      if (!pending) return h('span', { class: 'mut' }, '—')
      if (!Number(r.clawback_amount)) return money(r.pending_amount)
      return h('div', { class: 'net-cell' }, [
        h('span', {}, money(r.pending_amount)),
        h('em', {}, `实发 ${money(r.net_amount)}`),
      ])
    },
  },
  {
    title: '待抵扣',
    key: 'clawback_amount',
    width: 120,
    align: 'right',
    render: (r) =>
      Number(r.clawback_amount)
        ? h('span', { class: 'claw' }, `−${money(r.clawback_amount)}`)
        : h('span', { class: 'mut' }, '—'),
  },
  {
    title: '已结算',
    key: 'settled_amount',
    width: 120,
    align: 'right',
    render: (r) => (Number(r.settled_amount) ? money(r.settled_amount) : h('span', { class: 'mut' }, '—')),
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    align: 'right',
    render: (r) =>
      h('div', { class: 'row-actions' }, [
        r.has_rate
          ? h(
              NButton,
              {
                size: 'tiny',
                text: true,
                type: 'primary',
                disabled: Number(r.pending_amount) <= 0,
                onClick: (e: MouseEvent) => {
                  e.stopPropagation()
                  settleForSales(r)
                },
              },
              { default: () => '结算' },
            )
          : h(
              NButton,
              {
                size: 'tiny',
                text: true,
                type: 'primary',
                onClick: (e: MouseEvent) => {
                  e.stopPropagation()
                  router.push('/sales/commission-settings')
                },
              },
              { default: () => '去设置' },
            ),
      ]),
  },
])

function toggleSales(row: CommissionSales) {
  salesFilter.value = salesFilter.value === row.sales_id ? null : row.sales_id
  tab.value = 'detail'
  reloadRows()
}

function clearSalesFilter() {
  salesFilter.value = null
  reloadRows()
}

const salesRowProps = (row: CommissionSales) => ({
  style: 'cursor:pointer',
  onClick: () => toggleSales(row),
})

const salesRowClass = (row: CommissionSales) =>
  row.sales_id === salesFilter.value ? 'active-row' : ''

/* ---------- 明细表 ---------- */
const detailColumns = computed<DataTableColumns<CommissionRow>>(() => [
  {
    type: 'selection',
    width: 40,
    disabled: (row) => row.status !== 'pending',
  },
  {
    title: '订单号',
    key: 'order_no',
    width: 150,
    render: (r) =>
      h(
        NButton,
        {
          text: true,
          type: 'primary',
          class: 'mono',
          onClick: () => router.push(`/order-center/detail/${r.order_id}`),
        },
        { default: () => r.order_no },
      ),
  },
  { title: '客户', key: 'customer_name', ellipsis: { tooltip: true } },
  { title: '销售', key: 'sales_name', width: 100, render: (r) => r.sales_name || '—' },
  { title: '下单日期', key: 'order_date', width: 110 },
  {
    title: '送达日期',
    key: 'delivered_date',
    width: 110,
    render: (r) => r.delivered_date || h('span', { class: 'mut' }, '—'),
  },
  {
    title: '提成基数',
    key: 'base_amount',
    width: 130,
    align: 'right',
    render: (r) => money(r.base_amount),
  },
  {
    title: '比例',
    key: 'commission_rate',
    width: 90,
    align: 'right',
    render: (r) => rateText(r.commission_rate),
  },
  {
    title: '提成金额',
    key: 'commission_amount',
    width: 120,
    align: 'right',
    render: (r) => h('b', { class: 'accent' }, money(r.commission_amount)),
  },
  {
    title: '退货冲销',
    key: 'clawback_amount',
    width: 110,
    align: 'right',
    render: (r) =>
      Number(r.clawback_amount)
        ? h('span', { class: 'claw' }, `−${money(r.clawback_amount)}`)
        : h('span', { class: 'mut' }, '—'),
  },
  {
    title: '状态',
    key: 'status',
    width: 96,
    render: (r) =>
      h('div', { class: 'status-cell' }, [
        h(
          NTag,
          { size: 'tiny', bordered: false, type: STATUS_TYPE[r.status] },
          { default: () => STATUS_LABEL[r.status] },
        ),
        Number(r.clawback_amount) ? h('em', {}, '有待抵扣') : null,
      ]),
  },
  {
    title: '结算时间',
    key: 'settled_at',
    width: 160,
    render: (r) =>
      r.settled_at
        ? h('div', { class: 'settled-cell' }, [
            h('span', {}, r.settled_at),
            h('em', {}, r.settlement_no || ''),
          ])
        : h('span', { class: 'mut' }, '—'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 90,
    align: 'right',
    render: (r) => {
      if (r.status === 'pending') {
        return h(
          NButton,
          { size: 'tiny', text: true, type: 'primary', onClick: () => openSettle([r]) },
          { default: () => '结算' },
        )
      }
      if (r.status === 'settled' && r.settlement_no) {
        return h(
          NButton,
          { size: 'tiny', text: true, onClick: () => revokeSettlement(r.settlement_no!) },
          { default: () => '撤销' },
        )
      }
      return h('span', { class: 'mut' }, '—')
    },
  },
])

/* ---------- 结算 ---------- */
const settleVisible = ref(false)
const settling = ref(false)
const settleRows = ref<CommissionRow[]>([])
const settleDate = ref(dayjs().format('YYYY-MM-DD'))
const settleRemark = ref('')

const settleGroups = computed(() => {
  const groups = new Map<
    number,
    { sales_id: number; sales_name: string; rows: CommissionRow[]; amount: number; deduct: number; net: number }
  >()
  for (const row of settleRows.value) {
    const key = row.sales_id ?? 0
    if (!groups.has(key)) {
      groups.set(key, {
        sales_id: key,
        sales_name: row.sales_name || '—',
        rows: [],
        amount: 0,
        deduct: 0,
        net: 0,
      })
    }
    const group = groups.get(key)!
    group.rows.push(row)
    group.amount += Number(row.commission_amount)
  }
  // 每位销售身上的未抵扣退货冲销，本次最多扣到应发为 0（与后端一致）
  for (const group of groups.values()) {
    group.amount = Number(group.amount.toFixed(2))
    group.deduct = Math.min(group.amount, clawbackBySales.value.get(group.sales_id) || 0)
    group.net = Number((group.amount - group.deduct).toFixed(2))
  }
  return [...groups.values()]
})
const settleTotal = computed(() =>
  settleRows.value.reduce((sum, r) => sum + Number(r.commission_amount), 0),
)
const settleDeduct = computed(() =>
  Number(settleGroups.value.reduce((sum, g) => sum + g.deduct, 0).toFixed(2)),
)
const settleNet = computed(() => Number((settleTotal.value - settleDeduct.value).toFixed(2)))
const earliestDate = computed(() => {
  const dates = settleRows.value.map((r) => r.delivered_date).filter(Boolean) as string[]
  return dates.length ? dates.sort().slice(-1)[0] : month.value + '-01'
})

const costHint = computed(() => {
  if (!settleRows.value.length) return ''
  // 与后端一致：先按订单月归集提成，再用抵扣从最早月份起冲减，经营成本按实发记
  const byMonth = new Map<string, number>()
  for (const row of settleRows.value) {
    const key = row.order_date.slice(0, 7)
    byMonth.set(key, (byMonth.get(key) || 0) + Number(row.commission_amount))
  }
  let remaining = settleDeduct.value
  for (const key of [...byMonth.keys()].sort()) {
    if (remaining <= 0) break
    const take = Math.min(remaining, byMonth.get(key)!)
    byMonth.set(key, byMonth.get(key)! - take)
    remaining -= take
  }
  const months = [...byMonth.entries()].filter(([, v]) => v > 0).sort()
  const label = (m: string) => `${Number(m.slice(5))} 月`
  if (!months.length) return '应发已全部被退货冲销抵扣，本次不产生经营成本。'
  const suffix = settleDeduct.value > 0 ? '（已扣退货冲销，按实发记）' : ''
  if (months.length === 1) {
    return `本次发放计入 ${label(months[0][0])} 经营成本的「销售提成」${money(months[0][1])}${suffix}，月度利润同步减少。`
  }
  const parts = months.map(([m, amount]) => `${label(m)} ${money(amount)}`).join('、')
  return `订单跨 ${months.length} 个月，将按订单月份拆为 ${parts} 共 ${months.length} 条经营成本${suffix}。`
})

async function openSettle(list: CommissionRow[]) {
  const pending = list.filter((r) => r.status === 'pending')
  if (!pending.length) {
    message.warning('没有待结算的提成')
    return
  }
  settleRows.value = pending
  settleDate.value = dayjs().format('YYYY-MM-DD')
  settleRemark.value = ''
  // 抵扣额取自汇总，先刷新一次再打开，避免用旧的待抵扣金额
  try {
    await loadSummary()
  } catch {
    /* 汇总刷新失败不阻塞结算，弹窗里按已有数据展示 */
  }
  settleVisible.value = true
}

async function submitSettle() {
  if (settleDate.value > dayjs().format('YYYY-MM-DD')) {
    message.warning('结算日期不能晚于今天')
    return
  }
  if (settleDate.value < earliestDate.value) {
    message.warning(`结算日期不能早于最晚送达日 ${earliestDate.value}`)
    return
  }
  settling.value = true
  try {
    const res = await financeApi.settleCommissions({
      order_ids: settleRows.value.map((r) => r.order_id),
      settle_date: settleDate.value,
      remark: settleRemark.value || undefined,
    })
    settleVisible.value = false
    selected.value = []
    const deductTip = Number(res.total_deduct_amount) > 0 ? `，抵扣 ${money(res.total_deduct_amount)}` : ''
    message.success(
      `已生成 ${res.settlements.length} 张结算单，实发 ${money(res.total_amount)}${deductTip}`,
    )
    await loadAll()
    if (tab.value === 'records') loadRecords()
  } catch (e: any) {
    message.error(e?.response?.data?.message || '结算失败')
  } finally {
    settling.value = false
  }
}

async function settleForSales(row: CommissionSales) {
  const res = await financeApi.commissions({
    month: month.value,
    status: 'pending',
    sales_id: row.sales_id,
    page: 1,
    page_size: 100,
  })
  if (!res.items.length) {
    message.warning('该销售本月没有待结算的提成')
    return
  }
  if (res.total > res.items.length) {
    salesFilter.value = row.sales_id
    status.value = 'pending'
    tab.value = 'detail'
    reloadRows()
    message.warning('待结算超过 100 笔，请在明细里勾选后批量结算')
    return
  }
  openSettle(res.items)
}

/* ---------- 结算记录 ---------- */
const records = ref<CommissionSettlement[]>([])
const recordLoading = ref(false)
const recordPagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: false,
  onChange: (page: number) => {
    recordPagination.page = page
    loadRecords()
  },
})

async function loadRecords() {
  recordLoading.value = true
  try {
    const res = await financeApi.commissionSettlements({
      page: recordPagination.page,
      page_size: recordPagination.pageSize,
    })
    records.value = res.items
    recordPagination.itemCount = res.total
  } finally {
    recordLoading.value = false
  }
}

function onTabChange(value: string) {
  if (value === 'records') loadRecords()
}

const recordColumns = computed<DataTableColumns<CommissionSettlement>>(() => [
  {
    title: '结算单号',
    key: 'settlement_no',
    width: 150,
    render: (r) => h('span', { class: 'mono' }, r.settlement_no),
  },
  { title: '结算日期', key: 'settle_date', width: 110 },
  { title: '销售', key: 'sales_name', width: 100 },
  { title: '笔数', key: 'item_count', width: 70 },
  {
    title: '实发金额',
    key: 'amount',
    width: 190,
    align: 'right',
    render: (r) => {
      const parts: string[] = []
      if (Number(r.deduct_amount)) {
        parts.push(`应发 ${money(r.gross_amount)}`, `抵扣 −${money(r.deduct_amount)}`)
      }
      parts.push(
        r.cost_months.length
          ? `计入 ${r.cost_months.map((m) => Number(m.slice(5))).join('、')} 月成本`
          : '成本已冲销',
      )
      return h('div', { class: 'amount-cell' }, [
        h('b', { class: 'accent' }, money(r.amount)),
        h('em', {}, parts.join(' · ')),
      ])
    },
  },
  { title: '备注', key: 'remark', ellipsis: { tooltip: true }, render: (r) => r.remark || '—' },
  { title: '操作人', key: 'operator_name', width: 90, render: (r) => r.operator_name || '—' },
  {
    title: '状态',
    key: 'status',
    width: 80,
    render: (r) =>
      h(
        NTag,
        { size: 'tiny', bordered: false, type: r.status === 'active' ? 'success' : 'error' },
        { default: () => (r.status === 'active' ? '生效' : '已撤销') },
      ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 96,
    align: 'right',
    render: (r) =>
      actionBar([
        actionIcon({ icon: 'view', label: '查看明细', size: 16, onClick: () => openDetail(r.settlement_no) }),
        r.status === 'active'
          ? h(
              NButton,
              { size: 'tiny', text: true, type: 'error', onClick: () => revokeSettlement(r.settlement_no) },
              { default: () => '撤销' },
            )
          : null,
      ], { justify: 'flex-end' }),
  },
])

function revokeSettlement(no: string) {
  confirmAction(dialog, {
    title: '撤销结算',
    content: `撤销结算单 ${no}？单内明细回到「待结算」，对应的经营成本一并冲销，月度利润回补。原结算单保留为已撤销。`,
    danger: true,
    onConfirm: async () => {
      try {
        const res = await financeApi.revokeCommissionSettlement(no)
        message.success(`已撤销，冲销 ${res.removed_expense_count} 条经营成本`)
        await loadAll()
        if (tab.value === 'records') loadRecords()
      } catch (e: any) {
        message.error(e?.response?.data?.message || '撤销失败')
      }
    },
  })
}

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<CommissionSettlementDetail | null>(null)

async function openDetail(no: string) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await financeApi.commissionSettlement(no)
  } finally {
    detailLoading.value = false
  }
}

/* ---------- 导出 ---------- */
async function exportCsv() {
  const lines = [
    '订单号,客户,销售,下单日期,送达日期,提成基数,比例,提成金额,退货冲销,状态,结算单号',
  ]
  let page = 1
  for (;;) {
    const res = await financeApi.commissions({
      month: month.value,
      status: status.value === 'all' ? undefined : status.value,
      sales_id: salesFilter.value ?? undefined,
      keyword: keyword.value || undefined,
      page,
      page_size: 100,
    })
    for (const r of res.items) {
      lines.push(
        [
          r.order_no,
          r.customer_name,
          r.sales_name || '',
          r.order_date,
          r.delivered_date || '',
          r.base_amount,
          r.commission_rate ? `${(Number(r.commission_rate) * 100).toFixed(2)}%` : '',
          r.commission_amount,
          Number(r.clawback_amount) ? `-${r.clawback_amount}` : '',
          STATUS_LABEL[r.status],
          r.settlement_no || '',
        ]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(','),
      )
    }
    if (page * 100 >= res.total) break
    page += 1
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `销售提成_${month.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const helpVisible = ref(false)

onMounted(loadAll)
</script>

<style scoped>
.commission-page {
  padding-bottom: 24px;
}
.page-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.6;
}
.page-sub b {
  color: var(--primary);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.month-switch {
  display: flex;
  align-items: center;
  gap: 4px;
}
.month-text {
  min-width: 108px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
}
.rule-bar {
  margin-bottom: 12px;
  font-size: 12.5px;
}
.rule-bar b {
  color: var(--primary);
}
.kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.kpi {
  background: var(--bg-card, #fff);
  border-radius: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border, #eef0f5);
}
.kpi .k {
  font-size: 12px;
  color: var(--text-3);
  display: flex;
  align-items: center;
  gap: 6px;
}
.kpi .v {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.3px;
}
.kpi .d {
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--text-3);
}
.kpi.action {
  border-color: #e5e8ff;
  background: linear-gradient(180deg, #f7f8ff, #fff);
}
.kpi.action .v {
  color: var(--primary);
}
.kpi.warn {
  border-color: #ffe7cc;
  background: linear-gradient(180deg, #fffbf5, #fff);
}
.kpi.warn .k {
  color: #b45309;
}
.kpi.warn .v {
  color: #d46b08;
}
.kpi.muted .v {
  color: #8a91a1;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
}
.sec-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.sec-head h3 {
  margin: 0;
  font-size: 14px;
}
.sec-head .muted,
.muted {
  font-size: 12px;
  color: var(--text-3);
}
.spacer {
  margin-left: auto;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.table-foot {
  display: flex;
  justify-content: flex-end;
  gap: 24px;
  padding: 10px 4px 0;
  font-size: 12px;
  color: var(--text-3);
  border-top: 1px dashed var(--border, #eef0f5);
  margin-top: 8px;
}
.table-foot b {
  color: var(--text-1);
}
:deep(.accent) {
  color: var(--primary);
}
:deep(.mut) {
  color: #b9bec9;
}
:deep(.claw) {
  color: #d46b08;
  font-weight: 600;
}
:deep(.net-cell),
:deep(.status-cell) {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.35;
}
:deep(.status-cell) {
  align-items: flex-start;
}
:deep(.net-cell em),
:deep(.status-cell em) {
  font-style: normal;
  font-size: 10.5px;
  color: #d46b08;
}
:deep(.mono) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
:deep(.row-actions) {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
:deep(.sales-cell) {
  display: flex;
  align-items: center;
  gap: 6px;
}
:deep(.sales-cell .name) {
  font-weight: 600;
}
:deep(.sales-cell .no-rate) {
  font-size: 11px;
  color: #d03050;
  background: #fff1f2;
  border-radius: 4px;
  padding: 1px 6px;
}
:deep(.sales-cell .off) {
  font-size: 11px;
  color: var(--text-3);
}
:deep(.active-row td) {
  background: #f5f6ff !important;
}
:deep(.settled-cell) {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
:deep(.settled-cell em),
:deep(.amount-cell em) {
  font-style: normal;
  font-size: 10.5px;
  color: var(--text-3);
}
:deep(.amount-cell) {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.settle-sub {
  font-size: 12.5px;
  color: var(--text-3);
  margin-bottom: 10px;
}
.settle-sub .warn {
  margin-left: 8px;
  color: #d46b08;
}
.settle-groups {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border, #eef0f5);
  border-radius: 8px;
}
.settle-group + .settle-group {
  border-top: 1px solid var(--border, #eef0f5);
}
.group-head {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #fafbff;
  font-size: 12.5px;
}
.group-head .who {
  font-weight: 600;
  margin-right: auto;
}
.group-head .sum {
  color: var(--primary);
  font-weight: 600;
}
.group-head .deduct {
  margin-right: 10px;
  font-size: 11.5px;
  color: #d46b08;
}
.group-row {
  display: grid;
  grid-template-columns: 1fr 1fr 100px;
  gap: 8px;
  padding: 6px 12px;
  font-size: 12.5px;
  color: var(--text-2, #5b6376);
}
.group-row .amt {
  text-align: right;
}
.group-row.detail-row {
  grid-template-columns: 1fr 1fr 90px 100px 100px;
}
.group-row.detail-row .date,
.group-row.detail-row .base {
  text-align: right;
  color: var(--text-3);
}
.settle-total {
  margin-top: 12px;
  padding: 8px 12px;
  background: #f7f8ff;
  border-radius: 8px;
}
.settle-total .line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
  font-size: 12.5px;
  color: var(--text-3);
}
.settle-total .line b {
  font-size: 14px;
  color: var(--text-1, #1f2430);
}
.settle-total .line.deduct b {
  color: #d46b08;
}
.settle-total .line.net {
  border-top: 1px dashed #dfe3f0;
  margin-top: 4px;
  padding-top: 7px;
  color: var(--text-1, #1f2430);
  font-weight: 600;
}
.settle-total .line.net b {
  font-size: 20px;
  color: var(--primary);
}
.cost-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #be185d;
  background: #fdf2f8;
  border-radius: 6px;
  padding: 8px 10px;
  line-height: 1.6;
}
.date-note {
  margin-left: 10px;
  font-size: 11.5px;
  color: var(--text-3);
}
.settle-tip {
  margin-top: 8px;
  font-size: 11.5px;
  color: var(--text-3);
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.detail-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
  font-size: 12.5px;
  color: var(--text-2, #5b6376);
}
.detail-meta .amt {
  margin-left: auto;
  font-weight: 700;
  color: var(--primary);
}
.detail-meta .deduct-note {
  font-size: 11.5px;
  color: #d46b08;
}
.detail-row .kind-tag {
  margin-left: 4px;
  padding: 0 4px;
  font-style: normal;
  font-size: 10px;
  color: #d46b08;
  background: #fff7ed;
  border-radius: 3px;
}
.detail-row.deduct-row .cust,
.detail-row.deduct-row .date,
.detail-row.deduct-row .base {
  color: #b9bec9;
}
.detail-row.deduct-row .amt {
  color: #d46b08;
  font-weight: 600;
}
.help-body p {
  font-size: 12.5px;
  line-height: 1.9;
  color: var(--text-2, #5b6376);
  margin: 0 0 8px;
}
.help-body b {
  color: var(--text-1);
}
@media (max-width: 1400px) {
  .kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 1100px) {
  .kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
