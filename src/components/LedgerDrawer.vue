<template>
  <n-drawer :show="show" width="min(960px, 92vw)" @update:show="emit('update:show', $event)">
    <n-drawer-content
      :title="`${customerName || '客户'} · 往来流水`"
      closable
      :body-content-style="{ display: 'flex', flexDirection: 'column', height: '100%', padding: '14px 20px' }"
    >
      <div class="ledger-head">
        <div class="type-pills">
          <button
            v-for="opt in TYPE_FILTERS"
            :key="opt.value"
            type="button"
            class="pill"
            :class="{ on: activeType === opt.value }"
            @click="selectType(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
        <n-button size="small" :loading="loading" @click="load(1)">刷新</n-button>
      </div>

      <div class="ledger-table-wrap">
        <n-data-table
          class="ledger-table"
          :columns="columns"
          :data="rows"
          :loading="loading"
          :row-key="(r: LedgerEntry) => r.id"
          size="small"
          flex-height
          style="height: 100%"
          :bordered="false"
          :single-line="false"
        />
      </div>

      <div class="ledger-foot">
        <span class="foot-hint">共 <b>{{ total }}</b> 笔 · 按发生时间倒序，流水只追加不删改</span>
        <n-pagination
          v-model:page="page"
          :page-size="pageSize"
          :item-count="total"
          size="small"
          @update:page="load"
        />
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { h, ref, watch } from 'vue'
import { NTag, useMessage, type DataTableColumns } from 'naive-ui'
import { financeApi } from '@/api'
import { formatDate, formatMoney } from '@/utils/format'
import type { LedgerEntry } from '@/types'

const props = defineProps<{ show: boolean; customerId: number | null; customerName: string }>()
const emit = defineEmits<{ 'update:show': [boolean] }>()

const message = useMessage()
const rows = ref<LedgerEntry[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 50
const loading = ref(false)
const activeType = ref('')

const TYPE_FILTERS = [
  { label: '全部', value: '' },
  { label: '送货', value: 'delivery' },
  { label: '收款', value: 'payment' },
  { label: '抹零减免', value: 'discount' },
  { label: '退货', value: 'return' },
  { label: '运费抵扣', value: 'freight_offset' },
  { label: '对冲', value: 'offset' },
]

const TYPE_LABEL: Record<string, string> = {
  delivery: '送货',
  freight_offset: '运费抵扣',
  payment: '收款',
  return: '退货',
  discount: '抹零减免',
  offset: '对冲',
}
const TYPE_TAG: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  delivery: 'info',
  freight_offset: 'warning',
  payment: 'success',
  return: 'error',
  discount: 'warning',
  offset: 'default',
}

function refLabel(r: LedgerEntry) {
  if (r.order_id) return `订单 #${r.order_id}`
  if (r.ref_type === 'payment' && r.ref_id) return `收款 #${r.ref_id}`
  if (r.ref_type === 'return_order' && r.ref_id) return `退货 #${r.ref_id}`
  if (r.ref_id) return `#${r.ref_id}`
  return '—'
}

const columns: DataTableColumns<LedgerEntry> = [
  {
    title: '发生时间',
    key: 'occurred_at',
    width: 142,
    render: (r) => h('span', { class: 'num muted-2' }, formatDate(r.occurred_at)),
  },
  {
    title: '类型',
    key: 'type',
    width: 92,
    render: (r) =>
      h(NTag, { size: 'small', bordered: false, round: true, type: TYPE_TAG[r.type] ?? 'default' }, {
        default: () => TYPE_LABEL[r.type] ?? r.type,
      }),
  },
  {
    title: '单据',
    key: 'ref',
    width: 104,
    render: (r) => h('span', { class: 'num' }, refLabel(r)),
  },
  {
    title: '增加',
    key: 'plus',
    align: 'right',
    width: 100,
    render: (r) =>
      Number(r.amount) > 0
        ? h('span', { class: 'amt-plus num' }, formatMoney(r.amount))
        : h('span', { class: 'muted' }, '—'),
  },
  {
    title: '减少',
    key: 'minus',
    align: 'right',
    width: 100,
    render: (r) =>
      Number(r.amount) < 0
        ? h('span', { class: 'amt-minus num' }, formatMoney(Math.abs(Number(r.amount))))
        : h('span', { class: 'muted' }, '—'),
  },
  {
    title: '余额',
    key: 'balance_after',
    align: 'right',
    width: 106,
    render: (r) =>
      h(
        'b',
        { class: 'num', style: Number(r.balance_after) < 0 ? 'color: var(--success)' : '' },
        formatMoney(r.balance_after),
      ),
  },
  {
    title: '操作人',
    key: 'operator_name',
    width: 84,
    render: (r) => r.operator_name || h('span', { class: 'muted' }, '—'),
  },
  {
    title: '备注',
    key: 'remark',
    minWidth: 150,
    ellipsis: { tooltip: true },
    render: (r) => r.remark || h('span', { class: 'muted' }, '—'),
  },
]

function selectType(val: string) {
  if (activeType.value === val) return
  activeType.value = val
  load(1)
}

async function load(to = page.value) {
  if (!props.customerId) return
  loading.value = true
  try {
    const res = await financeApi.ledger(props.customerId, {
      page: to,
      page_size: pageSize,
      type: activeType.value || undefined,
    })
    rows.value = res.items
    total.value = res.total
    page.value = res.page
  } catch {
    message.error('流水加载失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.show, props.customerId],
  ([show, id]) => {
    if (show && id) {
      activeType.value = ''
      load(1)
    }
  },
)
</script>

<style scoped>
.ledger-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.type-pills {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.pill {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: #fff;
  color: var(--text-2);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.pill:hover {
  border-color: #c7d2fe;
  color: #4f46e5;
}
.pill.on {
  background: #eef2ff;
  border-color: #4f46e5;
  color: #4338ca;
  font-weight: 600;
}

.ledger-table-wrap {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.ledger-table :deep(.n-data-table-th) {
  background: #f8f9fc;
  font-size: 12px;
  color: var(--text-2);
  font-weight: 600;
}
.ledger-table :deep(.n-data-table-td) {
  padding-top: 9px;
  padding-bottom: 9px;
}

.ledger-foot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-3);
}
.foot-hint b { color: var(--text-1); }

:deep(.num) { font-variant-numeric: tabular-nums; }
:deep(.muted) { color: var(--text-3); }
:deep(.muted-2) { color: var(--text-2); font-size: 12.5px; }
:deep(.amt-plus) { color: var(--danger); font-weight: 600; }
:deep(.amt-minus) { color: var(--success); font-weight: 600; }
</style>
