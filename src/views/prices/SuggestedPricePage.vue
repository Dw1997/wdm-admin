<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">建议价格</h2>
      </div>
      <div class="filter-bar">
        <n-cascader
          v-model:value="categoryPath"
          :options="categoryOptions"
          clearable
          placeholder="选择商品分类"
          style="width: 260px"
          @update:value="applyFilters"
        />
        <n-input
          v-model:value="keyword"
          clearable
          placeholder="搜索商品名称 / 编码"
          style="width: 240px"
          @keyup.enter="applyFilters"
        />
        <n-button type="primary" size="small" @click="applyFilters">查询</n-button>
        <n-button size="small" @click="resetFilters">重置</n-button>
      </div>
      <n-alert type="info" :bordered="false" style="margin-bottom: 12px">
        展开商品可编辑其下 SKU 的成本价、建议零售价计算方式与数值；建议零售价由后端定价规则计算并在页面实时预览。
      </n-alert>
      <n-data-table
        :columns="productColumns"
        :data="rows"
        :loading="loading"
        :bordered="false"
        size="small"
        :row-key="(row: ProductSPU) => row.id"
        :expanded-row-keys="expandedKeys"
        :row-props="rowProps"
        @update:expanded-row-keys="(k: Array<string | number>) => (expandedKeys = k as number[])"
      />
      <div class="pagination-bar">
        <n-pagination v-model:page="page" :item-count="total" :page-size="pageSize" @update:page="reload" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, ref, computed, onMounted } from 'vue'
import {
  NButton, NInputNumber, NSelect, NDataTable, useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { productApi, categoryApi, PAGE_SIZE } from '@/api'
import { calcSuggestedPrice } from '@/utils/format'
import type { Category, ProductSKU, ProductSPU, PriceMethod } from '@/types'

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const page = ref(1)
const pageSize = PAGE_SIZE
const keyword = ref('')
const categoryPath = ref<string | number | null>(null)
const categoryTree = ref<Category[]>([])
const rows = ref<ProductSPU[]>([])
const total = ref(0)
const skuMap = ref<Record<number, ProductSKU[]>>({})
const expandedKeys = ref<number[]>([])

/** 点击行内空白处切换展开（点击左侧展开箭头时跳过，避免双重切换） */
function toggleExpand(id: number) {
  const idx = expandedKeys.value.indexOf(id)
  if (idx >= 0) expandedKeys.value.splice(idx, 1)
  else expandedKeys.value.push(id)
}

const rowProps = (row: ProductSPU) => ({
  style: 'cursor: pointer',
  onClick: (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest?.('.n-data-table-expand-trigger')) return
    toggleExpand(row.id)
  },
})

const priceMethodOptions = [
  { label: '百分比 (%)', value: 'percent' },
  { label: '固定金额 (元)', value: 'amount' },
]

const categoryOptions = computed(() => mapCategories(categoryTree.value))

function mapCategories(nodes: Category[]): any[] {
  return nodes.map((n) => ({
    label: n.name,
    value: n.id,
    children: n.children?.length ? mapCategories(n.children) : undefined,
  }))
}

/** 分类 id → 完整父路径（如 "辛香料 / 八角"），基于 GET /categories/tree 在前端拼接 */
function buildCatPathMap(nodes: Category[], prefix = '', map: Record<number, string> = {}): Record<number, string> {
  for (const n of nodes) {
    const path = prefix ? `${prefix} / ${n.name}` : n.name
    map[n.id] = path
    if (n.children) buildCatPathMap(n.children, path, map)
  }
  return map
}

const categoryPathMap = computed<Record<number, string>>(() => buildCatPathMap(categoryTree.value))

function selectedCategoryId(): number | null {
  // 单选 n-cascader 的 value 是叶子分类 id（非路径数组）
  return categoryPath.value == null ? null : Number(categoryPath.value)
}

function suggestedPrice(sku: ProductSKU): number {
  return calcSuggestedPrice(sku)
}

function specsLabel(sku: ProductSKU): string {
  if (sku.specs) {
    const vals = Object.values(sku.specs).filter(Boolean)
    if (vals.length) return vals.join(' / ')
  }
  return sku.remark || '—'
}

const skuColumns = computed<DataTableColumns<ProductSKU>>(() => [
  { title: 'SKU 规格', key: 'specs', minWidth: 120, render: (r) => specsLabel(r) },
  {
    title: '成本价 (元)', key: 'cost_price', width: 140,
    render: (r) => h(NInputNumber, {
      value: Number(r.cost_price) || 0,
      size: 'small',
      precision: 2,
      min: 0,
      style: 'width: 110px',
      'onUpdate:value': (v: number | null) => { r.cost_price = v ?? 0 },
    }),
  },
  {
    title: '计算方式', key: 'price_method', width: 150,
    render: (r) => h(NSelect, {
      value: r.price_method || 'percent',
      size: 'small',
      options: priceMethodOptions,
      style: 'width: 130px',
      'onUpdate:value': (v: PriceMethod) => { r.price_method = v },
    }),
  },
  {
    title: '数值', key: 'price_value', width: 140,
    render: (r) => h(NInputNumber, {
      value: Number(r.price_value) || 0,
      size: 'small',
      precision: 2,
      style: 'width: 110px',
      'onUpdate:value': (v: number | null) => { r.price_value = v ?? 0 },
    }),
  },
  {
    title: '最终建议价格', key: 'suggested', width: 130,
    render: (r) => h('span', { style: 'color:#ea580c;font-weight:600' }, `¥${suggestedPrice(r).toFixed(2)}`),
  },
  {
    title: '操作', key: 'actions', width: 100,
    render: (r) => h(NButton, {
      size: 'small', text: true, type: 'primary', loading: saving.value,
      onClick: () => saveSku(r),
    }, { default: () => '保存' }),
  },
])

const productColumns = computed<DataTableColumns<ProductSPU>>(() => [
  { type: 'expand', title: '', width: 48, renderExpand: (row) => renderSkuPanel(row) },
  { title: '商品编码', key: 'code', width: 170, ellipsis: { tooltip: true } },
  { title: '商品名称', key: 'name', ellipsis: { tooltip: true }, minWidth: 160 },
  {
    title: '分类', key: 'category_id', width: 180, ellipsis: { tooltip: true },
    render: (r) => categoryPathMap.value[r.category_id ?? 0] || '—',
  },
  {
    title: 'SKU 数', key: 'sku_count', width: 80,
    render: (r) => (skuMap.value[r.id] || []).length,
  },
])

function renderSkuPanel(row: ProductSPU) {
  const skus = skuMap.value[row.id] || []
  if (!skus.length) {
    return h('div', { style: 'padding:12px;color:var(--text-3)' }, '该商品暂无 SKU')
  }
  return h('div', { style: 'padding: 8px 8px 8px 32px' }, [
    h('div', { style: 'font-size:12px;color:var(--text-3);margin-bottom:6px' }, `商品：${row.name}`),
    h(NDataTable, {
      columns: skuColumns.value,
      data: skus,
      size: 'small',
      bordered: false,
      'row-key': (s: ProductSKU) => s.id,
    }),
  ])
}

/** 服务端分页：GET /spus 支持 keyword/category_id（含子孙分类）/page/page_size，统一 page_size=20 */
async function reload() {
  loading.value = true
  try {
    const spuPage = await productApi.spusPage({
      keyword: keyword.value || undefined,
      category_id: selectedCategoryId() ?? undefined,
      page: page.value,
      page_size: pageSize,
    })
    rows.value = spuPage.items
    total.value = spuPage.total
    await loadPageSkus()
  } finally {
    loading.value = false
  }
}

/** 仅加载当前页各 SPU 的 SKU（展开面板与 SKU 数列） */
async function loadPageSkus() {
  const entries = await Promise.all(rows.value.map(async (row) => [row.id, await productApi.skus(row.id)] as const))
  const map: Record<number, ProductSKU[]> = {}
  for (const [id, skus] of entries) map[id] = skus
  skuMap.value = map
}

/** 筛选条件变化：回到第一页再查询 */
function applyFilters() {
  page.value = 1
  reload()
}

function resetFilters() {
  keyword.value = ''
  categoryPath.value = null
  page.value = 1
  skuMap.value = {}
  reload()
}

async function saveSku(sku: ProductSKU) {
  saving.value = true
  try {
    await productApi.updateSku(sku.id, {
      cost_price: Number(sku.cost_price) || 0,
      price_method: sku.price_method || 'percent',
      price_value: Number(sku.price_value) || 0,
    })
    message.success('SKU 建议价格已保存')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    categoryTree.value = await categoryApi.tree()
    await reload()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.filter-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 12px; }
</style>
