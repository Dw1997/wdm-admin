<template>
  <div class="page-container credit-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">客户账期</h2>
        <p class="sub">谁欠多少、欠了多久、还有哪几张单没平。点「平账」把钱平到具体账单上。</p>
      </div>
      <div class="header-right">
        <n-button size="small" :loading="loading" @click="loadAll">刷新</n-button>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi main">
        <div class="k">应收总额</div>
        <div class="v">{{ formatMoney(summary?.ar_total) }}</div>
        <div class="d">{{ summary?.customer_count ?? 0 }} 家有欠款 · 预收不计入</div>
      </div>
      <div class="kpi">
        <div class="k">逾期金额</div>
        <div class="v red">{{ formatMoney(summary?.overdue_total) }}</div>
        <div class="d">
          <span class="delta bad" v-if="overdueRate">{{ overdueRate }}%</span>
          {{ summary?.overdue_customer_count ?? 0 }} 家已过到期日
        </div>
      </div>
      <div class="kpi">
        <div class="k">本月已收</div>
        <div class="v">{{ formatMoney(summary?.month_received) }}</div>
        <div class="d">{{ summary?.month_payment_count ?? 0 }} 笔收款</div>
      </div>
      <div class="kpi">
        <div class="k">退货挂账待抵</div>
        <div class="v">{{ formatMoney(summary?.return_credit_total) }}</div>
        <div class="d">不冲抵欠款，走退货平单</div>
      </div>
    </div>

    <n-alert v-if="error" type="error" :bordered="false" class="block">
      账期数据加载失败：{{ error }}
      <n-button text type="primary" style="margin-left: 8px" @click="loadAll">重试</n-button>
    </n-alert>

    <div class="card-section">
      <div class="filter-bar">
        <n-input
          v-model:value="filters.keyword"
          placeholder="客户名称 / 联系人 / 手机号"
          clearable
          style="width: 240px"
          @keyup.enter="reload"
          @clear="reload"
        />
        <n-select
          v-model:value="filters.sales_id"
          :options="salesOptions"
          placeholder="全部销售"
          clearable
          style="width: 150px"
          @update:value="reload"
        />
        <n-select
          v-model:value="filters.term_type"
          :options="termOptions"
          placeholder="全部账期"
          clearable
          style="width: 130px"
          @update:value="reload"
        />
        <n-checkbox v-model:checked="filters.overdue_only" @update:checked="reload">只看逾期</n-checkbox>
        <n-checkbox v-model:checked="filters.has_balance" @update:checked="reload">只看有欠款</n-checkbox>
        <div class="spacer" />
        <n-select
          v-model:value="filters.sort"
          :options="sortOptions"
          style="width: 170px"
          @update:value="reload"
        />
      </div>

      <div class="buckets">
        <button class="bk" :class="{ on: !filters.bucket }" @click="pickBucket(null)">
          全部 <b>{{ total }}</b> 家
        </button>
        <button
          v-for="b in bucketDefs"
          :key="b.key"
          class="bk"
          :class="{ on: filters.bucket === b.key, danger: b.danger }"
          @click="pickBucket(b.key)"
        >
          {{ b.label }} <b>{{ formatMoney(summary?.buckets[b.key]) }}</b>
        </button>
        <span class="bk-hint">按账单金额分桶，合计 = 应收总额</span>
      </div>

      <n-data-table
        :columns="columns"
        :data="rows"
        :loading="loading"
        :row-key="(r: AccountRow) => r.customer_id"
        :row-props="rowProps"
        size="small"
        :bordered="false"
        :single-line="false"
        :scroll-x="1180"
      />
      <div class="pagination-bar">
        <span>共 {{ total }} 家</span>
        <n-pagination
          v-model:page="filters.page"
          :page-size="filters.page_size"
          :item-count="total"
          size="small"
          @update:page="loadRows"
        />
      </div>
    </div>

    <LedgerDrawer
      v-model:show="ledgerShow"
      :customer-id="ledgerCustomer?.id ?? null"
      :customer-name="ledgerCustomer?.name ?? ''"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NTag, type DataTableColumns } from 'naive-ui'
import { adminCustomerApi, financeApi } from '@/api'
import { formatDate, formatMoney } from '@/utils/format'
import LedgerDrawer from '@/components/LedgerDrawer.vue'
import type { AccountRow, AccountSummary, SalesOption } from '@/types'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const error = ref('')
const rows = ref<AccountRow[]>([])
const total = ref(0)
const summary = ref<AccountSummary | null>(null)
const salesOptions = ref<{ label: string; value: number }[]>([])
const ledgerShow = ref(false)
const ledgerCustomer = ref<{ id: number; name: string } | null>(null)

const filters = reactive({
  keyword: '',
  sales_id: null as number | null,
  term_type: null as 'days' | 'monthly' | null,
  overdue_only: route.query.overdue === 'true',
  has_balance: false,
  bucket: null as 'fresh' | 'o1' | 'o2' | 'o3' | null,
  sort: 'overdue' as 'overdue' | 'balance' | 'max_overdue_days' | 'last_payment',
  page: 1,
  page_size: 20,
})

const termOptions = [
  { label: '按天（送达后 N 天）', value: 'days' },
  { label: '月结', value: 'monthly' },
]
const sortOptions = [
  { label: '按逾期金额排序', value: 'overdue' },
  { label: '按当前欠款排序', value: 'balance' },
  { label: '按最长逾期排序', value: 'max_overdue_days' },
  { label: '按最近收款排序', value: 'last_payment' },
]
const bucketDefs = [
  { key: 'fresh' as const, label: '未到期', danger: false },
  { key: 'o1' as const, label: '1–30 天', danger: false },
  { key: 'o2' as const, label: '31–60 天', danger: true },
  { key: 'o3' as const, label: '60 天以上', danger: true },
]

const overdueRate = computed(() => {
  const ar = Number(summary.value?.ar_total ?? 0)
  if (!ar) return ''
  return Math.round((Number(summary.value?.overdue_total ?? 0) / ar) * 100)
})

const code = (id: number) => `C-${String(id).padStart(4, '0')}`

const columns: DataTableColumns<AccountRow> = [
  {
    title: '客户',
    key: 'name',
    width: 180,
    render: (r) =>
      h('div', { class: 'cust' }, [
        h('b', null, r.name),
        h('span', null, code(r.customer_id)),
      ]),
  },
  {
    title: '归属销售',
    key: 'sales_name',
    width: 100,
    render: (r) => r.sales_name || h('span', { class: 'muted' }, '未归属'),
  },
  { title: '账期', key: 'term_label', width: 100 },
  {
    title: '当前欠款',
    key: 'balance',
    align: 'right',
    width: 130,
    render: (r) => {
      const v = Number(r.balance)
      if (v < 0) return h('b', { class: 'prepaid' }, `预收 ${formatMoney(-v)}`)
      return h('b', null, formatMoney(r.balance))
    },
  },
  {
    title: '逾期金额',
    key: 'overdue_amount',
    align: 'right',
    width: 120,
    render: (r) =>
      Number(r.overdue_amount) > 0
        ? h('b', { class: 'danger-text' }, formatMoney(r.overdue_amount))
        : h('span', { class: 'muted' }, '—'),
  },
  {
    title: '最长逾期',
    key: 'max_overdue_days',
    width: 110,
    render: (r) => {
      if (!r.max_overdue_days) return h('span', { class: 'muted' }, '—')
      const long = r.max_overdue_days > 60
      return h(
        NTag,
        { size: 'small', bordered: false, type: long ? 'error' : r.max_overdue_days > 30 ? 'warning' : 'default' },
        { default: () => `${r.max_overdue_days} 天${long ? ' · 长期' : ''}` },
      )
    },
  },
  {
    title: '待核销合计',
    key: 'pending_amount',
    align: 'right',
    width: 150,
    render: (r) => {
      const diff = Number(r.return_credit_amount) > 0
      return h('div', { class: 'pend' }, [
        h('b', null, formatMoney(r.pending_amount)),
        diff
          ? h('span', { class: 'flag', title: `与当前欠款的差额：退货挂账待抵 ${formatMoney(r.return_credit_amount)}` }, `待抵 ${formatMoney(r.return_credit_amount)}`)
          : null,
      ])
    },
  },
  {
    title: '最近收款',
    key: 'last_payment_at',
    width: 110,
    render: (r) => {
      if (!r.last_payment_at) return h('span', { class: 'muted' }, '从未')
      return formatDate(r.last_payment_at, 'YYYY-MM-DD')
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 130,
    fixed: 'right',
    render: (r) =>
      h('div', { class: 'acts' }, [
        h(
          NButton,
          {
            text: true,
            type: 'primary',
            size: 'small',
            onClick: (e: Event) => {
              e.stopPropagation()
              goSettle(r.customer_id)
            },
          },
          { default: () => '平账' },
        ),
        h(
          NButton,
          {
            text: true,
            size: 'small',
            onClick: (e: Event) => {
              e.stopPropagation()
              openLedger(r)
            },
          },
          { default: () => '流水' },
        ),
      ]),
  },
]

function rowProps(row: AccountRow) {
  return {
    style: 'cursor: pointer',
    onClick: () => goSettle(row.customer_id),
  }
}

function goSettle(id: number) {
  router.push({ name: 'finance-credit-settle', params: { customerId: String(id) } })
}

function openLedger(row: AccountRow) {
  ledgerCustomer.value = { id: row.customer_id, name: row.name }
  ledgerShow.value = true
}

function pickBucket(bucket: typeof filters.bucket) {
  filters.bucket = bucket
  reload()
}

function reload() {
  filters.page = 1
  loadRows()
}

async function loadRows() {
  loading.value = true
  error.value = ''
  try {
    const res = await financeApi.accounts({
      keyword: filters.keyword || undefined,
      sales_id: filters.sales_id ?? undefined,
      term_type: filters.term_type ?? undefined,
      overdue_only: filters.overdue_only || undefined,
      has_balance: filters.has_balance || undefined,
      bucket: filters.bucket ?? undefined,
      sort: filters.sort,
      page: filters.page,
      page_size: filters.page_size,
    })
    rows.value = res.items
    total.value = res.total
  } catch (e: any) {
    error.value = e?.response?.data?.message || e?.message || '未知错误'
  } finally {
    loading.value = false
  }
}

async function loadSummary() {
  summary.value = await financeApi.accountSummary()
}

async function loadAll() {
  await Promise.all([loadRows(), loadSummary()])
}

onMounted(async () => {
  adminCustomerApi.salesOptions().then((items: SalesOption[]) => {
    salesOptions.value = items.map((s) => ({ label: s.name, value: s.id }))
  })
  await loadAll()
})
</script>

<style scoped>
.sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-3);
}
.header-right { display: flex; align-items: center; gap: 8px; }
.block { margin-bottom: 12px; }
.spacer { flex: 1; }

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
.kpi .d { font-size: 11px; color: var(--text-3); margin-top: 6px; }
.delta {
  display: inline-block;
  border-radius: 5px;
  padding: 1px 6px;
  margin-right: 4px;
  font-weight: 600;
}
.delta.bad { background: #fdecec; color: #c33a3a; }

.buckets {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 0 0 12px;
}
.bk {
  border: 1px solid var(--border);
  background: var(--bg-card);
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--text-2);
  cursor: pointer;
}
.bk:hover { border-color: var(--primary, #4f46e5); color: var(--primary, #4f46e5); }
.bk.on { background: #eef0ff; border-color: #c7cdf7; color: #4f46e5; }
.bk b { font-weight: 600; color: var(--text-1); }
.bk.on b { color: #4f46e5; }
.bk.danger b { color: var(--danger); }
.bk-hint { font-size: 11px; color: var(--text-3); margin-left: 2px; }

:deep(.cust) { display: flex; flex-direction: column; }
:deep(.cust b) { font-weight: 600; }
:deep(.cust span) { font-size: 11px; color: var(--text-3); }
:deep(.muted) { color: var(--text-3); }
:deep(.danger-text) { color: var(--danger); }
:deep(.prepaid) { color: var(--success); }
:deep(.pend) { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
:deep(.flag) {
  background: #fff3e8;
  color: #b8641a;
  border-radius: 4px;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 600;
}
:deep(.acts) { display: flex; gap: 12px; }
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-3);
}
</style>
