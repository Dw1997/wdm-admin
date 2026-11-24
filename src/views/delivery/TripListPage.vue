<template>
  <div class="page-container trip-list-page">
    <div class="card-section">
      <div class="page-header">
        <div class="title-line">
          <h2 class="page-title">安排出车</h2>
          <span class="result-count">共 {{ total }} 趟</span>
        </div>
        <n-button type="primary" @click="router.push('/delivery/trips/new')">安排出车</n-button>
      </div>

      <n-alert v-if="savedText" type="success" :bordered="false" closable class="saved-alert" @close="clearSaved">
        {{ savedText }}
      </n-alert>

      <n-alert v-if="loadError" type="error" :bordered="false" class="saved-alert">
        出车列表加载失败：{{ loadError }}
        <n-button text type="primary" size="small" style="margin-left: 8px" @click="load">重试</n-button>
      </n-alert>

      <div class="filter-bar">
        <n-date-picker v-model:value="dateRange" type="daterange" clearable style="width: 250px" />
        <n-button-group size="small">
          <n-button :type="quick === 'today' ? 'primary' : 'default'" @click="applyQuick('today')">今天</n-button>
          <n-button :type="quick === 'tomorrow' ? 'primary' : 'default'" @click="applyQuick('tomorrow')">明天</n-button>
          <n-button :type="quick === 'week' ? 'primary' : 'default'" @click="applyQuick('week')">近 7 天</n-button>
        </n-button-group>
        <n-select v-model:value="statuses" multiple :options="statusOptions" :max-tag-count="2" clearable placeholder="状态" style="width: 220px" />
        <n-select v-model:value="ownerId" :options="ownerOptions" clearable filterable placeholder="负责人" style="width: 130px" />
        <n-input v-model:value="keyword" clearable placeholder="出车名称 / 负责人" style="width: 170px" @keyup.enter="search" />
        <n-button type="primary" :loading="loading" @click="search">查询</n-button>
        <n-button @click="reset">重置</n-button>
      </div>

      <n-data-table
        :columns="columns"
        :data="list"
        :loading="loading"
        :bordered="false"
        size="small"
        :scroll-x="1110"
        :row-key="(row: RouteTrip) => row.id"
        :row-props="rowProps"
      >
        <template #empty>
          <n-empty description="近期没有出车" style="padding: 40px 0">
            <template #extra>
              <n-button type="primary" size="small" @click="router.push('/delivery/trips/new')">安排出车</n-button>
            </template>
          </n-empty>
        </template>
      </n-data-table>

      <div class="pagination-bar">
        <span>每页 20 条</span>
        <n-pagination v-model:page="page" :page-size="20" :item-count="total" show-quick-jumper @update:page="onPage" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton, NEllipsis, NProgress, NTag,
  useDialog, useMessage,
  type DataTableColumns, type SelectOption,
} from 'naive-ui'
import dayjs from 'dayjs'
import { adminCustomerApi, routeTripApi } from '@/api'
import { ROUTE_TRIP_STATUS, ROUTE_TRIP_STATUS_OPTIONS } from '@/utils/dict'
import { confirmAction } from '@/utils/confirm'
import { formatDate, formatMoney } from '@/utils/format'
import { actionBar, actionIcon } from '@/components/tableActions'
import type { RouteTrip, SalesOption } from '@/types'

const router = useRouter()
const route = useRoute()
const message = useMessage()
const dialog = useDialog()

const today = dayjs().format('YYYY-MM-DD')
const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD')
const defaultRange = (): [number, number] => [
  dayjs().startOf('day').valueOf(),
  dayjs().add(6, 'day').startOf('day').valueOf(),
]

const list = ref<RouteTrip[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const loadError = ref('')
const dateRange = ref<[number, number] | null>(defaultRange())
const quick = ref<'today' | 'tomorrow' | 'week' | null>(null)
const statuses = ref<string[]>(['planned', 'delivering'])
const ownerId = ref<number | null>(null)
const keyword = ref('')
const owners = ref<SalesOption[]>([])

const statusOptions = ROUTE_TRIP_STATUS_OPTIONS
const ownerOptions = computed<SelectOption[]>(() =>
  owners.value.map((o) => ({ label: ownerLabel(o), value: o.id })),
)

const savedId = computed(() => (route.query.saved ? Number(route.query.saved) : null))
const savedText = computed(() => {
  if (!route.query.saved) return ''
  const joined = Number(route.query.joined || 0)
  const moved = Number(route.query.moved || 0)
  const returned = Number(route.query.returned || 0)
  const parts: string[] = []
  if (joined) parts.push(`自动加入 ${joined} 张待排车订单`)
  if (moved) parts.push(`自动挪单 ${moved} 张`)
  if (returned) parts.push(`${returned} 张退回待排车`)
  return parts.length ? `已保存，${parts.join('、')}。` : '已保存出车。'
})

function ownerLabel(o: SalesOption): string {
  if (o.is_admin) return `管理员·${o.name}`
  if (o.is_owner) return `店家·${o.name}`
  return o.name
}

function ownerText(row: RouteTrip): string {
  const matched = owners.value.find((o) => o.id === row.owner_id)
  return matched ? ownerLabel(matched) : row.owner_name || '—'
}

function errorText(e: unknown): string {
  const err = e as { response?: { status?: number; data?: { detail?: string; message?: string } }; message?: string }
  if (err.response?.status === 404) return '线路配送接口尚未实现（/route-trips）'
  return err.response?.data?.detail || err.response?.data?.message || err.message || '请稍后重试'
}

const columns = computed<DataTableColumns<RouteTrip>>(() => [
  {
    title: '出车日期', key: 'trip_date', width: 130,
    render: (row) => {
      const rel = row.trip_date === today ? '今天' : row.trip_date === tomorrow ? '明天' : ''
      return h('div', { class: 'date-cell' }, [
        h('div', { class: 'date-main' }, [
          formatDate(row.trip_date, 'YYYY-MM-DD'),
          rel ? h(NTag, { size: 'small', type: rel === '今天' ? 'primary' : 'info', bordered: false, style: 'margin-left: 5px' }, { default: () => rel }) : null,
        ]),
      ])
    },
  },
  {
    title: '名称', key: 'name', width: 150,
    render: (row) => h('div', { class: 'name-cell' }, [
      h(NButton, { text: true, type: 'primary', onClick: () => openDetail(row) }, { default: () => row.name || '—' }),
      row.auto_generated
        ? h(NTag, { size: 'small', type: 'info', bordered: false }, { default: () => '自动排车' })
        : null,
    ]),
  },
  {
    title: '经过地点', key: 'stops_text', width: 240,
    render: (row) => h(NEllipsis, { style: 'max-width: 220px' }, { default: () => row.stops_text || '—' }),
  },
  { title: '负责人', key: 'owner_name', width: 110, render: ownerText },
  {
    title: '询单进度', key: 'called_count', width: 110,
    render: (row) => {
      const pct = row.customer_count ? Math.round((row.called_count / row.customer_count) * 100) : 0
      return h('div', { class: 'progress-cell' }, [
        h('span', `${row.called_count} / ${row.customer_count}`),
        h(NProgress, { type: 'line', percentage: pct, showIndicator: false, height: 4, style: 'width: 70px' }),
      ])
    },
  },
  {
    title: '订单', key: 'order_count', width: 110,
    render: (row) => h('div', { class: 'orders-cell' }, [
      h('b', `${row.order_count} 单`),
      h('small', formatMoney(row.order_amount)),
    ]),
  },
  {
    title: '状态', key: 'status', width: 90,
    render: (row) => {
      const meta = ROUTE_TRIP_STATUS[row.status]
      return h(NTag, { size: 'small', type: meta.type, bordered: false }, { default: () => meta.label })
    },
  },
  {
    title: '操作', key: 'actions', width: 145, fixed: 'right',
    render: (row) => actionBar([
      actionIcon({ icon: 'view', label: '查看', onClick: () => openDetail(row) }),
      row.status === 'planned' && actionIcon({ icon: 'edit', label: '编辑', onClick: () => openEdit(row) }),
      row.status === 'planned' && h(NButton, { size: 'small', text: true, type: 'error', onClick: () => openCancel(row) }, { default: () => '取消出车' }),
    ]),
  },
])

function rowProps(row: RouteTrip) {
  return { class: savedId.value === row.id ? 'row-highlight' : '' }
}

async function loadOwners() {
  try {
    owners.value = await adminCustomerApi.salesOptions()
  } catch {
    /* 请求层提示 */
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  const [from, to] = dateRange.value ?? []
  try {
    const result = await routeTripApi.list({
      page: page.value,
      page_size: 20,
      status: statuses.value.length ? statuses.value.join(',') : undefined,
      date_from: from ? dayjs(from).format('YYYY-MM-DD') : undefined,
      date_to: to ? dayjs(to).format('YYYY-MM-DD') : undefined,
      owner_id: ownerId.value ?? undefined,
      keyword: keyword.value.trim() || undefined,
      order_by: 'trip_date',
    })
    list.value = result.items
    total.value = result.total
  } catch (e) {
    list.value = []
    total.value = 0
    loadError.value = errorText(e)
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

function reset() {
  dateRange.value = defaultRange()
  quick.value = null
  statuses.value = ['planned', 'delivering']
  ownerId.value = null
  keyword.value = ''
  search()
}

function applyQuick(kind: 'today' | 'tomorrow' | 'week') {
  const start = kind === 'today' ? dayjs().startOf('day') : kind === 'tomorrow' ? dayjs().add(1, 'day').startOf('day') : dayjs().startOf('day')
  const end = kind === 'today' ? dayjs().startOf('day') : kind === 'tomorrow' ? dayjs().add(1, 'day').startOf('day') : dayjs().add(6, 'day').startOf('day')
  dateRange.value = [start.valueOf(), end.valueOf()]
  quick.value = kind
  search()
}

function onPage(value: number) {
  page.value = value
  load()
}

function clearSaved() {
  router.replace({ path: '/delivery/trips' })
  load()
}

function openDetail(row: RouteTrip) {
  router.push(`/delivery/trips/${row.id}`)
}

function openEdit(row: RouteTrip) {
  router.push(`/delivery/trips/${row.id}/edit`)
}

function openCancel(row: RouteTrip) {
  confirmAction(dialog, {
    title: '取消出车',
    content: `确认取消 ${row.trip_date}「${row.name || '未命名出车'}」？本趟挂着的 ${row.order_count} 张待配送订单将全部退回待排车，不会自动加入其他趟次。`,
    confirmText: '确认取消',
    danger: true,
    onConfirm: async () => {
      try {
        const result = await routeTripApi.cancel(row.id)
        message.success(`已取消出车，${result.returned_orders.length} 张订单退回待排车`)
        await load()
      } catch {
        /* 请求层提示 */
      }
    },
  })
}

onMounted(async () => {
  if (route.query.saved) page.value = 1
  await Promise.all([loadOwners(), load()])
})
</script>

<style scoped>
.title-line { display: flex; align-items: baseline; gap: 10px; }
.result-count { color: var(--text-3); font-size: 12px; }
.saved-alert { margin-bottom: 12px; }
.filter-bar { align-items: center; }
.date-main { display: flex; align-items: center; white-space: nowrap; font-variant-numeric: tabular-nums; }
.name-cell { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.progress-cell { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-2); }
.orders-cell b { display: block; font-size: 12.5px; }
.orders-cell small { display: block; margin-top: 2px; font-size: 11px; color: var(--text-3); }
.pagination-bar { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; color: var(--text-3); font-size: 12px; }
.trip-list-page :deep(tr.row-highlight) td { background: var(--primary-soft) !important; }
</style>
