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
        :data="pagedProducts"
        :loading="loading"
        :bordered="false"
        size="small"
        :row-key="(row: ProductSPU) => row.id"
      />
      <div class="pagination-bar">
        <n-pagination v-model:page="page" :item-count="total" :page-size="pageSize" @update:page="loadPageSkus" />
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
import { productApi, categoryApi } from '@/api'
import type { Category, ProductSKU, ProductSPU, PriceMethod } from '@/types'

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const page = ref(1)
const pageSize = 10
const keyword = ref('')
const categoryPath = ref<Array<string | number>>([])
const categoryTree = ref<Category[]>([])
const spuList = ref<ProductSPU[]>([])
const skuMap = ref<Record<number, ProductSKU[]>>({})

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

function flattenCategories(nodes: Category[], map: Record<number, string> = {}): Record<number, string> {
  for (const n of nodes) {
    map[n.id] = n.name
    if (n.children) flattenCategories(n.children, map)
  }
  return map
}

const categoryMap = ref<Record<number, string>>({})

function selectedCategoryId(): number | null {
  const path = categoryPath.value
  return path?.length ? Number(path[path.length - 1]) : null
}

function collectCategoryIds(nodes: Category[], parentId: number, out: Set<number>): void {
  for (const n of nodes) {
    if (n.id === parentId) {
      const walk = (node: Category) => {
        out.add(node.id)
        node.children?.forEach(walk)
      }
      walk(n)
      return
    }
    if (n.children) collectCategoryIds(n.children, parentId, out)
  }
}

const filteredProducts = computed(() => {
  const catId = selectedCategoryId()
  let allowed: Set<number> | null = null
  if (catId) {
    allowed = new Set<number>()
    collectCategoryIds(categoryTree.value, catId, allowed)
  }
  const kw = keyword.value.trim().toLowerCase()
  return spuList.value.filter((s) => {
    if (allowed && !allowed.has(s.category_id ?? -1)) return false
    if (kw && !s.name.toLowerCase().includes(kw) && !s.code.toLowerCase().includes(kw)) return false
    return true
  })
})

const total = computed(() => filteredProducts.value.length)
const pagedProducts = computed(() =>
  filteredProducts.value.slice((page.value - 1) * pageSize, page.value * pageSize),
)

function suggestedPrice(sku: ProductSKU): number {
  const base = Number(sku.cost_price) || 0
  const value = Number(sku.price_value) || 0
  const raw = sku.price_method === 'amount' ? base + value : base * (1 + value / 100)
  return Math.max(raw, 0)
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
  { title: '商品编码', key: 'code', width: 130 },
  { title: '商品名称', key: 'name', ellipsis: { tooltip: true }, minWidth: 160 },
  {
    title: '分类', key: 'category_id', width: 140,
    render: (r) => categoryMap.value[r.category_id ?? 0] || '—',
  },
  {
    title: 'SKU 数', key: 'sku_count', width: 80,
    render: (r) => (skuMap.value[r.id] || []).length,
  },
])

function renderSkuPanel(row: ProductSPU) {
  const skus = skuMap.value[row.id] || []
  if (!skus.length) {
    return h('div', { style: 'padding:12px;color:#909399' }, '该商品暂无 SKU')
  }
  return h('div', { style: 'padding: 8px 8px 8px 32px' }, [
    h('div', { style: 'font-size:12px;color:#909399;margin-bottom:6px' }, `商品：${row.name}`),
    h(NDataTable, {
      columns: skuColumns.value,
      data: skus,
      size: 'small',
      bordered: false,
      'row-key': (s: ProductSKU) => s.id,
    }),
  ])
}

async function loadPageSkus() {
  const rows = pagedProducts.value
  const entries = await Promise.all(rows.map(async (row) => [row.id, await productApi.skus(row.id)] as const))
  const map: Record<number, ProductSKU[]> = {}
  for (const [id, skus] of entries) map[id] = skus
  skuMap.value = map
}

async function applyFilters() {
  page.value = 1
  loading.value = true
  try {
    await loadPageSkus()
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  keyword.value = ''
  categoryPath.value = []
  page.value = 1
  skuMap.value = {}
  loadPageSkus()
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
    const [spus, cats] = await Promise.all([productApi.spus(), categoryApi.tree()])
    spuList.value = spus
    categoryTree.value = cats
    categoryMap.value = flattenCategories(cats)
    await loadPageSkus()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.filter-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 12px; }
</style>
