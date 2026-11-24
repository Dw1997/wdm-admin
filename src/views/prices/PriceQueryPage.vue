<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">价格查询</h2>
      </div>
      <div class="filter-bar">
        <n-select
          v-model:value="customerId"
          :options="customerOptions"
          filterable
          clearable
          placeholder="选择客户（必选）"
          style="width: 240px"
          @update:value="onCustomerChange"
        />
        <n-select
          v-model:value="spuId"
          :options="spuOptions"
          :loading="spuLoading"
          filterable
          remote
          clearable
          placeholder="选择商品（可选）"
          style="width: 240px"
          @search="searchSpus"
          @update:value="onSpuChange"
        />
        <n-select
          v-model:value="skuId"
          :options="skuOptions"
          :loading="skuLoading"
          :disabled="!spuId"
          clearable
          placeholder="选择 SKU（可选）"
          style="width: 200px"
          @update:value="applyFilters"
        />
        <n-input
          v-model:value="keyword"
          clearable
          placeholder="商品名称 / 编码 / 条码"
          style="width: 220px"
          @keyup.enter="applyFilters"
        />
        <n-button type="primary" size="small" :loading="loading" @click="applyFilters">查询</n-button>
        <n-button size="small" @click="resetFilters">重置</n-button>
      </div>

      <n-alert v-if="selectedCustomer" type="info" :bordered="false" style="margin-bottom: 12px">
        {{ summaryText }}
      </n-alert>

      <n-data-table
        :columns="columns"
        :data="rows"
        :loading="loading"
        :bordered="false"
        size="small"
        :row-key="(r: CustomerPriceRow) => r.sku_id"
        :expanded-row-keys="expandedKeys"
        :row-props="rowProps"
        @update:expanded-row-keys="(k: Array<string | number>) => (expandedKeys = k as number[])"
      >
        <template #empty>
          <div style="padding: 24px; color: var(--text-3)">
            {{ customerId ? '没有符合条件的规格' : '请先选择客户' }}
          </div>
        </template>
      </n-data-table>

      <div v-if="customerId && total > pageSize" class="pagination-bar">
        <n-pagination v-model:page="page" :item-count="total" :page-size="pageSize" @update:page="load" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, ref, computed, onMounted } from 'vue'
import {
  NDataTable, NDescriptions, NDescriptionsItem, NTag,
  type DataTableColumns,
} from 'naive-ui'
import { priceApi, productApi, adminCustomerApi, fetchAllPages, PAGE_SIZE } from '@/api'
import { PRICE_SOURCE } from '@/utils/dict'
import { formatDate } from '@/utils/format'
import type { AdminCustomer, CustomerPriceRow, ProductSKU } from '@/types'

const customerId = ref<number | null>(null)
const spuId = ref<number | null>(null)
const skuId = ref<number | null>(null)
const keyword = ref('')
const page = ref(1)
const pageSize = PAGE_SIZE

const loading = ref(false)
const spuLoading = ref(false)
const skuLoading = ref(false)

const customers = ref<AdminCustomer[]>([])
const customerOptions = ref<{ label: string; value: number }[]>([])
const spuOptions = ref<{ label: string; value: number }[]>([])
const skus = ref<ProductSKU[]>([])

const rows = ref<CustomerPriceRow[]>([])
const total = ref(0)
const expandedKeys = ref<number[]>([])

let searchTimer: ReturnType<typeof setTimeout> | undefined

const selectedCustomer = computed(() => customers.value.find((c) => c.id === customerId.value) || null)
/** 客户摘要：客户名 · 等级（未分配等级时说明按建议零售价成交）· 结果条数 */
const summaryText = computed(() => {
  const c = selectedCustomer.value
  if (!c) return ''
  const level = c.level_id
    ? `等级：${c.level_nickname || c.level_code || '—'}`
    : '未分配等级（按建议零售价成交）'
  return `客户：${c.name} · ${level}${total.value ? ` · 共 ${total.value} 个规格` : ''}`
})
const skuOptions = computed(() =>
  skus.value.map((s) => ({
    label: (s.specs ? Object.values(s.specs).filter(Boolean).join('/') : s.remark || '') || `SKU ${s.id}`,
    value: s.id,
  })),
)

/** 点击行内空白处展开（点左侧展开箭头时跳过，避免双重切换） */
function rowProps(row: CustomerPriceRow) {
  return {
    style: 'cursor: pointer',
    onClick: (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest?.('.n-data-table-expand-trigger')) return
      const idx = expandedKeys.value.indexOf(row.sku_id)
      if (idx >= 0) expandedKeys.value.splice(idx, 1)
      else expandedKeys.value.push(row.sku_id)
    },
  }
}

function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return `¥${Number(value).toFixed(2)}`
}

/** 成交价单元格：低于最低售价时加一个提示标签（专属价在成本上涨后会出现） */
function renderPrice(r: CustomerPriceRow) {
  return h('div', { style: 'display:flex;align-items:center;gap:6px' }, [
    h('span', { style: 'color:var(--primary);font-weight:600' }, money(r.unit_price)),
    r.below_min
      ? h(NTag, { size: 'small', type: 'warning', bordered: false }, { default: () => '低于最低售价' })
      : null,
  ])
}

function renderSkuPanel(r: CustomerPriceRow) {
  const items: { label: string; value: string }[] = [
    { label: '建议零售价', value: money(r.suggested_price) },
    { label: '等级价', value: money(r.level_price) },
    { label: '最低售价', value: money(r.min_price) },
    { label: '成本价', value: money(r.cost_price) },
    {
      label: '1 个 SKU 等于',
      value: `${r.base_qty}${r.base_unit ? ` ${r.base_unit}` : ''}`,
    },
    { label: '数量小数', value: r.allow_decimal ? '允许 1 位小数' : '必须整数' },
  ]
  return h('div', { style: 'padding: 8px 8px 8px 32px' }, [
    h(NDescriptions, { column: 3, size: 'small', bordered: true, labelStyle: 'width:120px' }, {
      default: () =>
        items.map((item) =>
          h(NDescriptionsItem, { label: item.label }, { default: () => item.value }),
        ),
    }),
  ])
}

const columns = computed<DataTableColumns<CustomerPriceRow>>(() => [
  { type: 'expand', title: '', width: 48, renderExpand: (r) => renderSkuPanel(r) },
  {
    title: '商品', key: 'spu_name', minWidth: 180,
    render: (r) =>
      h('div', [
        h('div', { style: 'font-size:13px' }, r.spu_name),
        h('div', { style: 'font-size:12px;color:var(--text-3)' }, r.spu_code),
      ]),
  },
  { title: '规格', key: 'sku_spec', width: 140, render: (r) => r.sku_spec || '—' },
  { title: '成交价', key: 'unit_price', width: 200, render: (r) => renderPrice(r) },
  {
    title: '价格来源', key: 'price_source', width: 130,
    render: (r) =>
      h(NTag, { size: 'small', type: PRICE_SOURCE[r.price_source].type, bordered: false }, {
        default: () => PRICE_SOURCE[r.price_source].label,
      }),
  },
  {
    title: '来源设定时间', key: 'price_source_set_at', width: 160,
    render: (r) => (r.price_source_set_at ? formatDate(r.price_source_set_at) : '—'),
  },
  {
    title: '状态', key: 'is_enabled', width: 80,
    render: (r) =>
      r.is_enabled ? '' : h(NTag, { size: 'small', type: 'default', bordered: false }, { default: () => '已停用' }),
  },
])

/** 客户换人：清掉 SKU 选择，回到第一页重查 */
function onCustomerChange() {
  page.value = 1
  load()
}

/** 商品换人：SKU 选项跟着换，回到第一页重查 */
async function onSpuChange() {
  skuId.value = null
  skus.value = []
  if (spuId.value) {
    skuLoading.value = true
    try {
      skus.value = await productApi.skus(spuId.value)
    } finally {
      skuLoading.value = false
    }
  }
  page.value = 1
  load()
}

async function loadSpus(kw = '') {
  spuLoading.value = true
  try {
    const list = await productApi.spus({ keyword: kw || undefined, page: 1, page_size: PAGE_SIZE })
    spuOptions.value = list.map((s) => ({ label: `${s.name} (${s.code})`, value: s.id }))
  } finally {
    spuLoading.value = false
  }
}

function searchSpus(kw: string) {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadSpus(kw.trim()), 300)
}

/** 未选客户不发请求（页面空状态提示先选客户） */
async function load() {
  if (!customerId.value) {
    rows.value = []
    total.value = 0
    return
  }
  loading.value = true
  try {
    const res = await priceApi.customerPrices({
      customer_id: customerId.value,
      spu_id: spuId.value || undefined,
      sku_id: skuId.value || undefined,
      keyword: keyword.value.trim() || undefined,
      page: page.value,
      page_size: pageSize,
    })
    rows.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  expandedKeys.value = []
  load()
}

function resetFilters() {
  spuId.value = null
  skuId.value = null
  skus.value = []
  keyword.value = ''
  applyFilters()
}

onMounted(async () => {
  // 客户下拉需全量选项：统一 page_size=20 逐页拉取
  customers.value = await fetchAllPages((p) => adminCustomerApi.list({ page: p, page_size: PAGE_SIZE }))
  customerOptions.value = customers.value.map((c) => ({ label: c.name, value: c.id }))
  await loadSpus()
})
</script>

<style scoped>
.filter-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 12px; }
</style>
