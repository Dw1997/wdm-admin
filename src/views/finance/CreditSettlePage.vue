<template>
  <div class="page-container settle-page">
    <div class="sticky-top">
      <div class="page-header">
        <div>
          <n-button text size="small" class="back" @click="goBack">‹ 返回客户账期</n-button>
          <h2 class="page-title">
            {{ summary?.name || '客户' }}
            <span class="muted code">C-{{ String(customerId).padStart(4, '0') }}</span>
          </h2>
          <div class="badges">
            <span>归属销售 <b>{{ summary?.sales_name || '未归属' }}</b></span>
            <span>账期 <b>{{ summary?.term_label || '—' }}</b></span>
            <span>
              生效额度 <b>{{ formatMoney(summary?.effective_credit) }}</b>
              <em v-if="overCredit" class="warn">已超额</em>
            </span>
            <span>
              最近收款
              <b>{{ summary?.last_payment_at ? `${formatDate(summary.last_payment_at, 'YYYY-MM-DD')} · ${methodLabel(summary.last_payment_method)}` : '从未' }}</b>
            </span>
          </div>
        </div>
        <div class="header-right">
          <n-button size="small" @click="ledgerShow = true">查看流水</n-button>
          <n-button size="small" :loading="loading" @click="loadBills">刷新</n-button>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi main">
          <div class="k">当前欠款</div>
          <div class="v num" :class="{ prepaid: balance < 0 }">
            {{ balance < 0 ? `预收 ${formatMoney(-balance)}` : formatMoney(balance) }}
          </div>
          <div class="d">往来流水余额</div>
        </div>
        <div class="kpi">
          <div class="k">未结清合计</div>
          <div class="v num">{{ formatMoney(billsTotal) }}</div>
          <div class="d">{{ bills.length }} 张账单 · 本页平账上限</div>
        </div>
        <div class="kpi">
          <div class="k">逾期金额</div>
          <div class="v num" :class="{ red: overdueTotal > 0 }">{{ formatMoney(overdueTotal) }}</div>
          <div class="d">{{ overdueTotal ? `最长逾期 ${maxOverdue} 天` : '没有逾期' }}</div>
        </div>
        <div class="kpi">
          <div class="k">已用额度</div>
          <div class="v num" :class="{ red: creditUsed > 100 }">{{ creditUsed }}%</div>
          <div class="d">额度 {{ formatMoney(summary?.effective_credit) }}</div>
        </div>
      </div>
    </div>

    <n-alert v-if="resultBar" type="success" :bordered="false" class="block" closable @close="resultBar = ''">
      {{ resultBar }}
    </n-alert>

    <n-alert v-if="Number(summary?.return_credit_amount) > 0" type="warning" :bordered="false" class="block">
      退货挂账待抵 {{ formatMoney(summary?.return_credit_amount) }}，不会自动抵扣账单，需要在「退货平单」处理。
      平完可能出现"余额已 0、某单还欠钱"，属正常（08 §2.2）。
    </n-alert>

    <div class="grid">
      <div class="left">
        <div class="card-section bills-card">
          <div class="sec-head">
            <div class="sec-title">
              <h3>未结清账单</h3>
              <span class="count-pill">{{ bills.length }} 张</span>
            </div>
            <div class="spacer" />
            <span class="order-hint">按送达日正序 · 前账在前</span>
            <n-input v-model:value="keyword" size="small" placeholder="搜单号" clearable style="width: 150px" />
          </div>

          <div class="bills-table-wrap">
            <n-data-table
              class="bills-table"
              :columns="columns"
              :data="visibleBills"
              :loading="loading"
              :row-key="(r: Bill) => r.order_id"
              :row-props="rowProps"
              size="small"
              flex-height
              style="height: 100%"
              :bordered="false"
              :single-line="false"
            />
          </div>

          <div class="table-footer">
            <div class="tf-left">
              <span>共 <b>{{ visibleBills.length }}</b> 张</span>
              <span class="sep">·</span>
              <span>实送合计 <b class="num">{{ formatMoney(visibleDeliveredTotal) }}</b></span>
              <span class="sep">·</span>
              <span>待核销合计 <b class="num primary">{{ formatMoney(visiblePendingTotal) }}</b></span>
            </div>
            <div v-if="mode === 'order' && selected.length" class="tf-picked">
              已选 <b>{{ selected.length }}</b> 张 · 待核销 <b class="num">{{ formatMoney(selectedTotal) }}</b>
            </div>
            <div v-else class="tf-hint">
              {{ mode === 'order' ? '点击行即可勾选要平的账单' : '整数平模式下按送达日自动依次抵扣' }}
            </div>
          </div>
        </div>

        <div class="rules-strip">
          <div class="rule-item">
            <div class="rule-title">核销规则</div>
            <p>按单平只核销勾选账单；整数平从最早送达的账单依次往后抵扣，提交后实时更新账单状态与往来余额。</p>
          </div>
          <div class="rule-item">
            <div class="rule-title">抹零结清（≥ {{ minRatioPct }}%）</div>
            <p>最后一张未付满订单累计已付达 {{ minRatioPct }}% 时，可勾选将差额抹零并结清；未满则按部分付款继续挂账。</p>
          </div>
          <div class="rule-item">
            <div class="rule-title">防重与冲正</div>
            <p>重复提交不会重复平账；平账记录提交后不可直接删改，登错需走反向冲正处理。</p>
          </div>
        </div>
      </div>

      <div class="card-section panel">
        <div class="sec-head panel-head"><h3>平账</h3><span class="muted">客户打来的钱</span></div>

        <div class="panel-body">
          <div class="seg">
            <button type="button" :class="{ on: mode === 'order' }" @click="switchMode('order')">按单平</button>
            <button type="button" :class="{ on: mode === 'amount' }" @click="switchMode('amount')">整数平</button>
          </div>

          <div class="selinfo">
            <template v-if="mode === 'order'">
              <span v-if="selected.length">
                已选 <b>{{ selected.length }} 张</b> · 待核销合计 <b class="num">{{ formatMoney(selectedTotal) }}</b>
              </span>
              <span v-else>在左侧勾选要平的账单。只平一张就勾一张，勾多张按送达日先后依次平。</span>
            </template>
            <template v-else>
              输入客户实际到账金额，从最早一张开始依次填满。待核销上限
              <b class="num">{{ formatMoney(billsTotal) }}</b>
            </template>
          </div>

          <div class="field">
            <label>实收金额 <em>{{ mode === 'order' ? '（改小 = 部分付款或抹零结清）' : '（客户实际到账）' }}</em></label>
            <n-input-number
              v-model:value="received"
              :min="0"
              :precision="2"
              :show-button="false"
              placeholder="0.00"
              style="width: 100%"
              @update:value="onReceived"
            >
              <template #prefix>¥</template>
            </n-input-number>
          </div>

          <div v-if="tailPartial && !errorText" class="settle-box" :class="tailPartial.eligible ? 'can' : 'cant'">
            <n-checkbox
              v-model:checked="settleWithRounding"
              :disabled="!tailPartial.eligible"
            >
              <span class="settle-label">
                <template v-if="tailPartial.eligible">
                  差额 <b class="num">{{ formatMoney(tailPartial.diff) }}</b> 抹零并结清
                </template>
                <template v-else>
                  实收未满 {{ minRatioPct }}%，不可抹零结清
                </template>
              </span>
            </n-checkbox>
            <div class="settle-sub">
              <template v-if="tailPartial.eligible">
                尾单 {{ tailPartial.bill.order_no }} 累计已付 <b>{{ tailPartial.pctText }}%</b>（已达 {{ minRatioPct }}%），勾选后整单结清
              </template>
              <template v-else>
                尾单 {{ tailPartial.bill.order_no }} 累计已付 <b>{{ tailPartial.pctText }}%</b>，差额 {{ formatMoney(tailPartial.diff) }} 将按部分付款挂账
              </template>
            </div>
          </div>

          <div class="preview">
            <div class="ph">
              <span>{{ mode === 'order' ? '按勾选账单分配' : '从最早未结清开始分配' }}</span>
              <span class="muted">{{ previewRange }}</span>
            </div>
            <div class="pv">
              <div v-if="!allocation.lines.length" class="pvempty">
                {{ mode === 'order' && !selected.length ? '先在左侧勾选账单' : '输入实收金额后自动显示分配结果' }}
              </div>
              <div v-for="line in allocation.lines" :key="line.bill.order_id" class="pvrow">
                <span class="n">{{ line.bill.order_no }}</span>
                <span
                  class="t"
                  :class="line.roundedClosed ? 'round' : line.closed ? 'closed' : 'part'"
                >
                  {{ line.roundedClosed ? `抹零 ${formatMoney(line.rounding)} 结清` : line.closed ? '结清' : '部分' }}
                </span>
                <span class="a num">{{ formatMoney(line.take) }}</span>
              </div>
            </div>
            <div class="sum">
              <div class="line">
                <span>{{ previewCount }}</span>
                <b class="num">{{ formatMoney(allocatedTotal) }}</b>
              </div>
              <div v-if="effectiveRounding > 0" class="line">
                <span>其中实收 / 抹零</span>
                <span class="num"><b>{{ formatMoney(received || 0) }}</b> / <em>{{ formatMoney(effectiveRounding) }}</em></span>
              </div>
              <div class="line">
                <span>平完这笔客户还欠</span>
                <b class="num">{{ formatMoney(Math.max(0, billsTotal - allocatedTotal)) }}</b>
              </div>
            </div>
          </div>

          <p v-if="errorText" class="err">{{ errorText }}</p>

          <div class="field">
            <label>收款方式</label>
            <div class="method-grid">
              <button
                v-for="m in methods"
                :key="m.value"
                type="button"
                class="method-btn"
                :class="{ on: method === m.value }"
                @click="method = m.value"
              >
                {{ m.label }}
              </button>
            </div>
          </div>

          <div class="field">
            <label>收款时间 <em>可回填历史，影响对账单归期</em></label>
            <n-date-picker v-model:value="paidAt" type="datetime" style="width: 100%" />
          </div>

          <div class="field">
            <label>备注 <em>选填</em></label>
            <n-input v-model:value="remark" type="textarea" :rows="2" placeholder="如：客户微信转账，抹零结清" />
          </div>
        </div>

        <div class="submitbar">
          <div class="amt">
            <b class="num">{{ formatMoney(allocatedTotal) }}</b>
            <span>{{ submitHint }}</span>
          </div>
          <n-button size="small" @click="resetForm">清空</n-button>
          <n-button type="primary" :disabled="!canSubmit" :loading="submitting" @click="submit">
            提交平账
          </n-button>
        </div>
      </div>
    </div>

    <LedgerDrawer
      v-model:show="ledgerShow"
      :customer-id="customerId"
      :customer-name="summary?.name || ''"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NCheckbox, NTag, useMessage, type DataTableColumns } from 'naive-ui'
import { financeApi } from '@/api'
import { formatDate, formatMoney } from '@/utils/format'
import LedgerDrawer from '@/components/LedgerDrawer.vue'
import type { Bill, BillSummary, PaymentPayload } from '@/types'

const props = defineProps<{ customerId: number }>()
const router = useRouter()
const message = useMessage()

const loading = ref(false)
const submitting = ref(false)
const bills = ref<Bill[]>([])
const summary = ref<BillSummary | null>(null)
const settleMinRatio = ref(0.95)
const keyword = ref('')
const ledgerShow = ref(false)
const resultBar = ref('')

const mode = ref<'order' | 'amount'>('order')
const selected = ref<number[]>([])
const received = ref<number | null>(null)
const settleWithRounding = ref(false)
const method = ref<'wechat' | 'alipay' | 'cash' | 'other'>('wechat')
const paidAt = ref<number>(Date.now())
const remark = ref('')
let autoReceived = true

const methods = [
  { label: '微信', value: 'wechat' as const },
  { label: '支付宝', value: 'alipay' as const },
  { label: '现金', value: 'cash' as const },
  { label: '其他', value: 'other' as const },
]

const round2 = (n: number) => Math.round(n * 100) / 100
const methodLabel = (m?: string | null) =>
  methods.find((x) => x.value === m)?.label ?? '—'

const minRatioPct = computed(() => Math.round(settleMinRatio.value * 100))

/* ---------- 数据 ---------- */
const visibleBills = computed(() => {
  const q = keyword.value.trim().toUpperCase()
  return q ? bills.value.filter((b) => b.order_no.toUpperCase().includes(q)) : bills.value
})
const visibleDeliveredTotal = computed(() =>
  visibleBills.value.reduce((s, b) => s + Number(b.delivered_amount), 0),
)
const visiblePendingTotal = computed(() =>
  visibleBills.value.reduce((s, b) => s + Number(b.pending_amount), 0),
)
const billsTotal = computed(() => bills.value.reduce((s, b) => s + Number(b.pending_amount), 0))
const balance = computed(() => Number(summary.value?.balance ?? 0))
const overdueTotal = computed(() => Number(summary.value?.overdue_amount ?? 0))
const maxOverdue = computed(() => summary.value?.max_overdue_days ?? 0)
const overCredit = computed(
  () => balance.value > Number(summary.value?.effective_credit ?? 0),
)
const creditUsed = computed(() => {
  const limit = Number(summary.value?.effective_credit ?? 0)
  return limit ? Math.round((balance.value / limit) * 100) : 0
})
const selectedBills = computed(() =>
  bills.value.filter((b) => selected.value.includes(b.order_id)),
)
const selectedTotal = computed(() =>
  selectedBills.value.reduce((s, b) => s + Number(b.pending_amount), 0),
)
const capacity = computed(() => (mode.value === 'order' ? selectedTotal.value : billsTotal.value))
const targets = computed(() => (mode.value === 'order' ? selectedBills.value : bills.value))

const allVisibleSelected = computed(
  () =>
    visibleBills.value.length > 0 &&
    visibleBills.value.every((b) => selected.value.includes(b.order_id)),
)
const someVisibleSelected = computed(
  () =>
    !allVisibleSelected.value &&
    visibleBills.value.some((b) => selected.value.includes(b.order_id)),
)

/** 第一步：按纯实收金额从最早一张开始依次预分配 */
const baseAllocation = computed(() => {
  let left = received.value || 0
  const lines: { bill: Bill; cash: number; pending: number; closed: boolean }[] = []
  for (const bill of targets.value) {
    if (left <= 0.001) break
    const pending = Number(bill.pending_amount)
    const cash = round2(Math.min(left, pending))
    lines.push({ bill, cash, pending, closed: cash >= pending - 0.001 })
    left = round2(left - cash)
  }
  return { lines, rest: left }
})

/** 最后一张未付满的账单：判断累计已付 ÷ 实送金额是否达到最低比例（默认 95%） */
const tailPartial = computed(() => {
  const lines = baseAllocation.value.lines
  if (!lines.length) return null
  const last = lines[lines.length - 1]
  if (last.closed) return null
  const diff = round2(last.pending - last.cash)
  if (diff <= 0.001) return null
  const delivered = Number(last.bill.delivered_amount)
  const cumPaid = round2(Number(last.bill.paid_amount) + last.cash)
  const ratio = delivered > 0 ? cumPaid / delivered : 0
  const eligible = delivered > 0 && ratio >= settleMinRatio.value - 1e-6
  return {
    bill: last.bill,
    diff,
    ratio,
    pctText: (ratio * 100).toFixed(1).replace(/\.0$/, ''),
    eligible,
  }
})

// 不满足 95% 或无尾单差额时自动取消抹零结清勾选
watch(
  () => Boolean(tailPartial.value?.eligible),
  (ok) => {
    if (!ok) settleWithRounding.value = false
  },
)

const effectiveRounding = computed(() =>
  settleWithRounding.value && tailPartial.value?.eligible ? tailPartial.value.diff : 0,
)

/** 第二步：合并抹零结清后的最终分配结果（与后端同一套算法） */
const allocation = computed(() => {
  const base = baseAllocation.value.lines
  const lastIdx = base.length - 1
  const lines = base.map((l, idx) => {
    const isRoundClose =
      idx === lastIdx && settleWithRounding.value && Boolean(tailPartial.value?.eligible)
    const rounding = isRoundClose ? tailPartial.value!.diff : 0
    const take = isRoundClose ? l.pending : l.cash
    return {
      bill: l.bill,
      take,
      rounding,
      closed: isRoundClose || l.closed,
      roundedClosed: isRoundClose,
    }
  })
  return { lines }
})

const allocationMap = computed(() => {
  const map = new Map<number, { take: number; closed: boolean; roundedClosed: boolean; rounding: number }>()
  for (const l of allocation.value.lines) {
    map.set(l.bill.order_id, {
      take: l.take,
      closed: l.closed,
      roundedClosed: l.roundedClosed,
      rounding: l.rounding,
    })
  }
  return map
})

const allocatedTotal = computed(() =>
  round2(allocation.value.lines.reduce((s, l) => s + l.take, 0)),
)
const previewRange = computed(() => {
  const list = allocation.value.lines
  if (!list.length) return ''
  return list.length === 1
    ? list[0].bill.order_no
    : `${list[0].bill.order_no.slice(-4)} → ${list[list.length - 1].bill.order_no.slice(-4)}`
})
const previewCount = computed(() => {
  const lines = allocation.value.lines
  if (!lines.length) return '尚未分配'
  const closed = lines.filter((l) => l.closed).length
  const part = lines.length - closed
  const untouched = targets.value.length - lines.length
  return `结清 ${closed} 张 · 部分 ${part} 张 · 未涉及 ${untouched} 张`
})

const errorText = computed(() => {
  const cash = received.value || 0
  if (mode.value === 'order' && !selected.value.length) {
    return cash > 0 ? '先在左侧勾选要平的账单。' : ''
  }
  if (cash > capacity.value + 0.001) {
    return `超出未结清合计 ${formatMoney(cash - capacity.value)}，本期不支持多收转预收，请把金额改小。`
  }
  return ''
})

const canSubmit = computed(
  () => !errorText.value && allocatedTotal.value > 0 && (received.value || 0) > 0,
)
const submitHint = computed(() => {
  const n = allocation.value.lines.length
  if (!n) return '未分配'
  const hasPart = allocation.value.lines.some((l) => !l.closed)
  const hasRound = effectiveRounding.value > 0
  if (hasRound) return `平掉 ${n} 张（含抹零 ${formatMoney(effectiveRounding.value)}）`
  return `平掉 ${n} 张${hasPart ? '（含部分付款）' : '（全部结清）'}`
})

/* ---------- 交互 ---------- */
function onReceived() {
  autoReceived = false
}
function syncAutoReceived() {
  if (mode.value === 'order' && autoReceived) {
    received.value = round2(selectedTotal.value)
  }
}
function toggle(id: number) {
  if (mode.value === 'amount') return
  selected.value = selected.value.includes(id)
    ? selected.value.filter((x) => x !== id)
    : [...selected.value, id]
  autoReceived = true
  settleWithRounding.value = false
  syncAutoReceived()
}
function toggleAll(checked: boolean) {
  if (mode.value === 'amount') return
  const visibleIds = visibleBills.value.map((b) => b.order_id)
  if (checked) {
    selected.value = Array.from(new Set([...selected.value, ...visibleIds]))
  } else {
    const drop = new Set(visibleIds)
    selected.value = selected.value.filter((id) => !drop.has(id))
  }
  autoReceived = true
  settleWithRounding.value = false
  syncAutoReceived()
}
function switchMode(next: 'order' | 'amount') {
  if (mode.value === next) return
  mode.value = next
  selected.value = []
  settleWithRounding.value = false
  received.value = next === 'order' ? 0 : null
  autoReceived = next === 'order'
}
function resetForm() {
  selected.value = []
  settleWithRounding.value = false
  received.value = mode.value === 'order' ? 0 : null
  remark.value = ''
  autoReceived = mode.value === 'order'
}

const columns: DataTableColumns<Bill> = [
  {
    title: () =>
      h(NCheckbox, {
        checked: allVisibleSelected.value,
        indeterminate: someVisibleSelected.value,
        disabled: mode.value === 'amount' || !visibleBills.value.length,
        'onUpdate:checked': (val: boolean) => toggleAll(val),
      }),
    key: 'pick',
    width: 42,
    align: 'center',
    render: (r) =>
      h(NCheckbox, {
        checked: selected.value.includes(r.order_id),
        disabled: mode.value === 'amount',
        onClick: (e: Event) => e.stopPropagation(),
        'onUpdate:checked': () => toggle(r.order_id),
      }),
  },
  {
    title: '单号',
    key: 'order_no',
    minWidth: 128,
    render: (r) => h('span', { class: 'order-no num' }, r.order_no),
  },
  {
    title: '送达 / 到期',
    key: 'dates',
    minWidth: 152,
    render: (r) =>
      h('span', { class: 'date-pair num' }, [
        r.delivered_at ? formatDate(r.delivered_at, 'MM-DD') : '—',
        h('span', { class: 'muted' }, ' → '),
        h('span', { class: r.overdue_days > 0 ? 'danger-text' : '' }, r.due_date ?? '—'),
      ]),
  },
  {
    title: '账龄',
    key: 'overdue_days',
    width: 108,
    render: (r) => {
      if (r.overdue_days > 0) {
        return h(
          NTag,
          { size: 'small', bordered: false, round: true, type: r.overdue_days > 30 ? 'error' : 'warning' },
          { default: () => `逾期 ${r.overdue_days} 天` },
        )
      }
      const days = r.due_date ? Math.ceil((new Date(r.due_date).getTime() - Date.now()) / 86400000) : null
      return h(
        NTag,
        { size: 'small', bordered: false, round: true },
        { default: () => `未到期${days !== null && days >= 0 ? ` ${days}天` : ''}` },
      )
    },
  },
  {
    title: '实送',
    key: 'delivered_amount',
    align: 'right',
    width: 100,
    render: (r) => h('span', { class: 'num' }, formatMoney(r.delivered_amount)),
  },
  {
    title: '已收 / 抹零',
    key: 'paid_amount',
    align: 'right',
    width: 112,
    render: (r) => {
      const paid = Number(r.paid_amount)
      const disc = Number(r.discount_amount)
      if (!paid && !disc) return h('span', { class: 'muted' }, '—')
      return h('div', { class: 'paid-cell num' }, [
        h('span', null, paid ? formatMoney(paid) : '¥0.00'),
        disc ? h('span', { class: 'disc-tag' }, `抹 ${formatMoney(disc)}`) : null,
      ])
    },
  },
  {
    title: '待核销',
    key: 'pending_amount',
    align: 'right',
    minWidth: 126,
    render: (r) => {
      const alloc = allocationMap.value.get(r.order_id)
      return h('div', { class: 'pending-cell' }, [
        h('b', { class: 'num' }, formatMoney(r.pending_amount)),
        alloc
          ? h(
              'span',
              {
                class: `row-badge ${alloc.roundedClosed ? 'round' : alloc.closed ? 'closed' : 'part'}`,
              },
              alloc.roundedClosed ? '抹零结清' : alloc.closed ? '结清' : '部分',
            )
          : null,
      ])
    },
  },
]

function rowProps(row: Bill) {
  const isPicked = selected.value.includes(row.order_id)
  const isAllocated = allocationMap.value.has(row.order_id)
  return {
    style:
      isPicked || isAllocated
        ? 'cursor: pointer; background: #f6f7ff'
        : mode.value === 'order'
          ? 'cursor: pointer'
          : undefined,
    onClick: () => toggle(row.order_id),
  }
}

/* ---------- 提交 ---------- */
async function submit() {
  if (!canSubmit.value) return
  const payload: PaymentPayload = {
    customer_id: props.customerId,
    amount: (received.value || 0).toFixed(2),
    rounding_amount: effectiveRounding.value.toFixed(2),
    method: method.value,
    paid_at: new Date(paidAt.value).toISOString(),
    remark: remark.value || undefined,
  }
  if (mode.value === 'order') {
    payload.allocations = allocation.value.lines.map((l) => ({
      order_id: l.bill.order_id,
      amount: l.take.toFixed(2),
    }))
  }
  submitting.value = true
  try {
    const res = await financeApi.createPayment(payload)
    const closed = res.allocations.filter((a) => a.closed).length
    const roundMsg = Number(res.rounding_amount) > 0 ? `（含抹零 ${formatMoney(res.rounding_amount)}）` : ''
    resultBar.value =
      `已平 ${res.allocations.length} 张（结清 ${closed} 张），本次核销 ${formatMoney(res.allocated_total)}${roundMsg}，` +
      `客户欠款 ${formatMoney(res.balance_before)} → ${formatMoney(res.balance_after)}`
    resetForm()
    await loadBills()
  } catch (e: any) {
    message.error(e?.response?.data?.message || '提交失败')
  } finally {
    submitting.value = false
  }
}

/* ---------- 加载 ---------- */
async function loadBills() {
  loading.value = true
  try {
    const res = await financeApi.customerBills(props.customerId)
    bills.value = res.bills
    summary.value = res.summary
    if (res.settle_min_ratio) {
      const parsed = Number(res.settle_min_ratio)
      if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 1) {
        settleMinRatio.value = parsed
      }
    }
    const ids = new Set(res.bills.map((b) => b.order_id))
    selected.value = selected.value.filter((id) => ids.has(id))
  } catch (e: any) {
    message.error(e?.response?.data?.message || '账单加载失败')
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push({ name: 'finance-credit' })
}

onMounted(loadBills)
</script>

<style scoped>
.settle-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sticky-top {
  flex-shrink: 0;
  margin: -12px -16px 12px;
  padding: 12px 16px;
  background: var(--bg-page);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 4px 12px -4px rgba(15, 23, 42, 0.06);
  z-index: 20;
}
.sticky-top .page-header { margin-bottom: 10px; }
.sticky-top .kpis { margin-bottom: 0; }

.back { margin-bottom: 4px; color: var(--text-3); }
.page-title { display: flex; align-items: baseline; gap: 8px; }
.code { font-size: 12px; font-weight: 400; }
.muted { color: var(--text-3); }
.block { margin-bottom: 12px; flex-shrink: 0; }
.spacer { flex: 1; }
.num { font-variant-numeric: tabular-nums; }

.badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
  font-size: 11.5px;
  color: var(--text-2);
}
.badges span {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 2px 9px;
}
.badges b { color: var(--text-1); font-weight: 600; }
.badges em { font-style: normal; color: var(--danger); margin-left: 4px; }

.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.kpi {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  padding: 12px 14px;
}
.kpi.main { background: linear-gradient(180deg, #f7f8ff, #fff); border-color: #d9dcff; }
.kpi .k { font-size: 12px; color: var(--text-3); }
.kpi .v { font-size: 22px; font-weight: 700; margin-top: 6px; }
.kpi .v.red { color: var(--danger); }
.kpi .v.prepaid { color: var(--success); font-size: 18px; }
.kpi .d { font-size: 11px; color: var(--text-3); margin-top: 6px; }

.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 392px;
  gap: 14px;
  align-items: stretch;
  overflow: hidden;
}
.left {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.sec-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.sec-title { display: flex; align-items: center; gap: 8px; }
.sec-head h3 { font-size: 14.5px; font-weight: 600; margin: 0; }
.sec-head .muted { font-size: 12px; }
.count-pill {
  font-size: 11.5px;
  font-weight: 600;
  color: #4f46e5;
  background: #eef2ff;
  border-radius: 999px;
  padding: 1px 8px;
}
.order-hint {
  font-size: 11.5px;
  color: var(--text-3);
}

.bills-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 12px;
}
.bills-card .sec-head { flex-shrink: 0; }
.bills-table-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #eef0f6;
  border-radius: 8px;
  overflow: hidden;
}
.bills-table :deep(.n-data-table-th) {
  background: #f8f9fc;
  font-size: 12px;
  color: var(--text-2);
  font-weight: 600;
}
.bills-table :deep(.n-data-table-td) {
  padding-top: 10px;
  padding-bottom: 10px;
}
:deep(.order-no) { font-weight: 600; color: var(--text-1); }
:deep(.date-pair) { font-size: 12.5px; color: var(--text-2); }
:deep(.paid-cell) {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 12.5px;
}
:deep(.disc-tag) {
  font-size: 10.5px;
  color: #b45309;
  background: #fef3c7;
  border-radius: 4px;
  padding: 0 4px;
  line-height: 1.5;
}
:deep(.pending-cell) {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}
:deep(.row-badge) {
  font-size: 10.5px;
  font-weight: 600;
  border-radius: 4px;
  padding: 1px 5px;
  line-height: 1.4;
}
:deep(.row-badge.closed) { background: #e7f7ee; color: #1f7a4d; }
:deep(.row-badge.round) { background: #eef2ff; color: #4338ca; }
:deep(.row-badge.part) { background: #fff3e0; color: #a45b11; }

.table-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  padding: 9px 12px;
  background: #f8f9fc;
  border: 1px solid #eef0f6;
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-2);
}
.tf-left { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.tf-left b { color: var(--text-1); }
.tf-left b.primary { color: #4f46e5; }
.tf-left .sep { color: var(--text-3); }
.tf-picked {
  font-size: 12px;
  color: #4338ca;
  background: #eef2ff;
  padding: 2px 8px;
  border-radius: 6px;
}
.tf-hint { font-size: 11.5px; color: var(--text-3); }

/* 底部紧凑业务说明条 */
.rules-strip {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 12px 14px;
  background: #f8f9fc;
  border: 1px solid #eceef5;
  border-radius: var(--radius);
}
.rule-item { min-width: 0; }
.rule-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.rule-title::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6366f1;
  flex-shrink: 0;
}
.rule-item p {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--text-3);
}

.panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.panel-head { flex-shrink: 0; }
.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}
.seg {
  display: flex;
  background: #f1f2f7;
  border-radius: 9px;
  padding: 3px;
  margin-bottom: 10px;
}
.seg button {
  flex: 1;
  border: 0;
  background: transparent;
  border-radius: 7px;
  padding: 6px 8px;
  font-size: 12.5px;
  color: var(--text-2);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.seg button.on { background: #fff; color: #4f46e5; box-shadow: 0 1px 3px rgba(16, 24, 40, 0.08); }

.selinfo {
  font-size: 12px;
  color: var(--text-2);
  background: #f9fafd;
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 10px;
  line-height: 1.5;
}
.selinfo b { color: var(--text-1); }

.field { margin-bottom: 11px; }
.field label { display: block; font-size: 12px; font-weight: 500; color: var(--text-2); margin-bottom: 5px; }
.field label em { font-style: normal; font-weight: 400; color: var(--text-3); font-size: 11px; }

/* 95% 抹零结清选项框 */
.settle-box {
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 10px;
  border: 1px solid var(--border);
  transition: background 0.15s ease, border-color 0.15s ease;
}
.settle-box.can {
  background: #f4f6ff;
  border-color: #c7d2fe;
}
.settle-box.cant {
  background: #fafafa;
  border-color: #eceef2;
}
.settle-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-1);
}
.settle-box.cant .settle-label { color: var(--text-3); font-weight: 500; }
.settle-sub {
  margin-top: 4px;
  padding-left: 24px;
  font-size: 11.5px;
  color: var(--text-2);
  line-height: 1.45;
}
.settle-box.cant .settle-sub { color: var(--text-3); }

.preview { border: 1px solid var(--border); border-radius: 9px; overflow: hidden; margin-bottom: 11px; }
.preview .ph {
  display: flex;
  justify-content: space-between;
  background: #f9fafd;
  padding: 6px 10px;
  font-size: 11.5px;
  color: var(--text-2);
  border-bottom: 1px solid var(--border);
}
.pv { max-height: 168px; overflow: auto; }
.pvempty { padding: 16px 10px; text-align: center; font-size: 11.5px; color: var(--text-3); }
.pvrow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-bottom: 1px solid #f5f6fa;
  font-size: 12px;
}
.pvrow:last-child { border-bottom: 0; }
.pvrow .n { font-weight: 600; }
.pvrow .a { margin-left: auto; font-weight: 700; }
.pvrow .t { font-size: 10.5px; border-radius: 4px; padding: 1px 6px; font-weight: 600; }
.t.closed { background: #e7f7ee; color: #1f7a4d; }
.t.round { background: #eef2ff; color: #4338ca; }
.t.part { background: #fff3e0; color: #a45b11; }
.sum {
  border-top: 1px solid var(--border);
  padding: 7px 10px;
  font-size: 11.5px;
  color: var(--text-2);
  background: #fcfcfe;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sum .line { display: flex; justify-content: space-between; align-items: center; }
.sum .line b { color: var(--text-1); }
.sum .line em { font-style: normal; color: #4338ca; font-weight: 600; }

.err {
  font-size: 11.5px;
  color: var(--danger);
  background: #fdf2f2;
  border: 1px solid #f6d5d5;
  border-radius: 7px;
  padding: 7px 10px;
  margin: 0 0 10px;
  line-height: 1.5;
}

/* 收款方式：4 等分横向胶囊按钮，杜绝换行错位 */
.method-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.method-btn {
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: #fff;
  color: var(--text-2);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.method-btn:hover {
  border-color: #c7d2fe;
  color: #4f46e5;
}
.method-btn.on {
  background: #eef2ff;
  border-color: #4f46e5;
  color: #4338ca;
  font-weight: 600;
}

.submitbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
  margin-top: 4px;
}
.submitbar .amt { line-height: 1.3; margin-right: auto; }
.submitbar .amt b { display: block; font-size: 16px; }
.submitbar .amt span { font-size: 11px; color: var(--text-3); }

:deep(.danger-text) { color: var(--danger); }

@media (max-width: 1280px) {
  .settle-page { height: auto; overflow: visible; }
  .sticky-top { position: sticky; top: 0; }
  .grid { flex: none; grid-template-columns: minmax(0, 1fr); overflow: visible; }
  .left { height: auto; overflow: visible; }
  .bills-card { flex: none; overflow: visible; }
  .bills-table-wrap { height: 360px; }
  .panel { height: auto; overflow: visible; }
  .panel-body { overflow: visible; padding-right: 0; }
  .rules-strip { grid-template-columns: minmax(0, 1fr); }
}
</style>
