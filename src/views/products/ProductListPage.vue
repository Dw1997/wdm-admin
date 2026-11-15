<template>
  <div class="page-container">
    <div class="card-section">
      <div class="product-toolbar">
        <div class="page-header"><h2 class="page-title">商品管理</h2><n-button type="primary" @click="$router.push('/spus/create')">新建商品</n-button></div>
        <div class="filter-bar">
          <n-input v-model:value="keyword" placeholder="搜索商品名称 / 编码" clearable style="width: 240px" @keyup.enter="search" />
          <!-- 分类筛选：GET /spus?category_id= 含子孙分类，单选 n-cascader 的值为标量 id -->
          <n-cascader
            v-model:value="filterCategoryId"
            :options="categoryCascaderOptions"
            clearable
            check-strategy="all"
            expand-trigger="hover"
            show-path
            placeholder="全部分类"
            style="width: 240px"
            @update:value="search"
          />
          <!-- 上架状态筛选：GET /spus?is_miniprogram=（true=已上架，false=未上架，缺省不过滤） -->
          <n-select
            v-model:value="filterMiniprogram"
            :options="miniprogramOptions"
            clearable
            placeholder="上架状态"
            style="width: 160px"
            @update:value="search"
          />
          <n-button type="primary" size="small" @click="search">查询</n-button>
        </div>
      </div>
      <n-data-table
        :columns="columns"
        :data="list"
        :loading="loading"
        :bordered="false"
        size="small"
        :row-key="(r:any)=>r.id"
        :row-props="rowProps"
        :expanded-row-keys="expandedKeys"
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
import { useRouter } from 'vue-router'
import { NButton, NDataTable, NTag, NPopconfirm, useMessage, type DataTableColumns } from 'naive-ui'
import { productApi, categoryApi } from '@/api'
import { formatDate } from '@/utils/format'
import type { ProductSPU, ProductSKU, Category } from '@/types'

const router = useRouter()
const message = useMessage()
const list = ref<ProductSPU[]>([])
const keyword = ref('')
const loading = ref(false)
const page = ref(1)
const pageSize = 20
const total = ref(0)
const filterCategoryId = ref<number | null>(null)
const filterMiniprogram = ref<string | null>(null)
const categoryTree = ref<Category[]>([])
const skuBySpu = ref<Record<number, ProductSKU[]>>({})

const categoryPathMap = computed<Record<number, string>>(() => buildCatPathMap(categoryTree.value))

function skuDefaultPrice(sku: ProductSKU | undefined): number {
  if (!sku) return 0
  // 建议零售价由服务端算好下发，前端不再自己算（products.md）；缺失时才退回按规则预估
  if (sku.suggested_price != null) return Number(sku.suggested_price)
  const base = Number(sku.cost_price) || 0
  const val = Number(sku.price_value) || 0
  const raw = sku.price_method === 'amount' ? base + val : base * (1 + val / 100)
  return Math.max(raw, 0)
}

function openEdit(r: ProductSPU) {
  router.push(`/spus/edit/${r.id}`)
}

/** 编码/名称可点击跳编辑页；用内联 <a> 保证列 ellipsis 截断与 tooltip 生效 */
function linkCell(text: string, r: ProductSPU) {
  return h('a', { style: 'cursor:pointer;color:var(--primary);', onClick: (e: MouseEvent) => { e.stopPropagation(); openEdit(r) } }, text)
}

// 行点击展开/收起 SKU 明细；受控 expandedKeys 供行点击与展开箭头共用
const expandedKeys = ref<number[]>([])

function toggleExpand(id: number) {
  expandedKeys.value = expandedKeys.value.includes(id)
    ? expandedKeys.value.filter((k) => k !== id)
    : [...expandedKeys.value, id]
}

function rowProps(r: ProductSPU) {
  return {
    style: 'cursor: pointer;',
    onClick: (e: MouseEvent) => {
      // 点击展开箭头时交给 n-data-table 自身处理，避免冒泡导致双重切换
      if ((e.target as HTMLElement).closest?.('.n-data-table-expand-trigger')) return
      toggleExpand(r.id)
    },
  }
}

/** SPU 上下架状态 + 已上架规格数；SPU 已上架但没有可展示的规格时标黄 */
function shelfCell(r: ProductSPU) {
  const skus = skuBySpu.value[r.id] || []
  // 优先用列表接口返回的统计（已启用且已上架 / 已启用规格数），没有时才用已展开的 SKU 自己数
  const on = r.miniprogram_sku_count ?? skus.filter((s) => s.is_enabled !== false && s.is_miniprogram).length
  const total = r.sku_count ?? skus.length
  const tag = r.is_miniprogram
    ? h(NTag, { size: 'small', type: on === 0 && total ? 'warning' : 'success' }, { default: () => '已上架' })
    : h(NTag, { size: 'small', type: 'default' }, { default: () => '未上架' })
  return h('div', { style: 'display:flex;align-items:center;gap:6px' }, [tag, h('span', { style: 'font-size:12px;color:var(--text-3)' }, `${on} / ${total} 个规格`)])
}

const columns = computed<DataTableColumns<ProductSPU>>(() => [
  { type: 'expand', title: '', width: 48, renderExpand: (row) => renderSkuPanel(row) },
  { title: '编码', key: 'code', width: 170, ellipsis: { tooltip: true }, render: (r) => linkCell(r.code, r) },
  { title: '商品名称', key: 'name', ellipsis: { tooltip: true }, render: (r) => linkCell(r.name, r) },
  { title: '分类', key: 'category_id', width: 180, ellipsis: { tooltip: true }, render: (r) => categoryPathMap.value[r.category_id ?? 0] || '—' },
  { title: 'SKU数量', key: 'sku_count', width: 90, render: (r) => r.sku_count ?? (skuBySpu.value[r.id] || []).length },
  { title: 'SKU默认价格', key: 'sku_price', width: 110, render: (r) => { const s = (skuBySpu.value[r.id] || [])[0]; return s ? `¥${skuDefaultPrice(s).toFixed(2)}` : '—' } },
  { title: '上架小程序', key: 'is_miniprogram', width: 150, render: (r) => shelfCell(r) },
  { title: '创建时间', key: 'created_at', width: 150, render: (r) => formatDate(r.created_at) },
  { title: '操作', key: 'actions', width: 120, render: (r) => h('div', { onClick: (e: Event) => e.stopPropagation() }, [
    h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openEdit(r) }, { default: () => '编辑' }),
    h(NPopconfirm, { onPositiveClick: () => onDelete(r) }, {
      default: () => '确认删除?',
      trigger: () => h(NButton, { size: 'small', text: true, type: 'error', style: 'margin-left:8px' }, { default: () => '删除' }),
    }),
  ]) },
])

// SKU 明细子表：规格 / 状态 / 定价规则与默认售价（默认售价 = 成本价按规则实时预览）
const skuColumns = computed<DataTableColumns<ProductSKU>>(() => [
  {
    title: '规格', key: 'specs', minWidth: 160,
    render: (r) => {
      const entries = Object.entries(r.specs || {}).filter(([, v]) => v)
      if (!entries.length) return r.remark || '—'
      return h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px' }, entries.map(([k, v]) => h(NTag, { size: 'small', bordered: false }, { default: () => `${k}: ${v}` })))
    },
  },
  { title: '状态', key: 'is_enabled', width: 80, render: (r) => h(NTag, { size: 'small', type: r.is_enabled !== false ? 'success' : 'default' }, { default: () => (r.is_enabled !== false ? '启用' : '停用') }) },
  { title: '上架小程序', key: 'is_miniprogram', width: 100, render: (r) => h(NTag, { size: 'small', type: r.is_miniprogram ? 'success' : 'default' }, { default: () => (r.is_miniprogram ? '已上架' : '未上架') }) },
  { title: '成本价 (元)', key: 'cost_price', width: 100, render: (r) => `¥${Number(r.cost_price || 0).toFixed(2)}` },
  { title: '计算方式', key: 'price_method', width: 90, render: (r) => (r.price_method === 'amount' ? '固定金额' : '百分比') },
  { title: '数值', key: 'price_value', width: 90, render: (r) => (r.price_method === 'amount' ? `+¥${Number(r.price_value || 0).toFixed(2)}` : `+${Number(r.price_value || 0).toFixed(2)}%`) },
  { title: '默认售价 (元)', key: 'default_price', width: 110, render: (r) => h('span', { style: 'color:#ea580c;font-weight:600' }, `¥${skuDefaultPrice(r).toFixed(2)}`) },
  { title: '最低售价 (元)', key: 'min_price', width: 110, render: (r) => (r.min_price != null ? `¥${Number(r.min_price).toFixed(2)}` : '—') },
  { title: '换算数量', key: 'base_qty', width: 90, render: (r) => (r.base_qty != null ? String(Number(r.base_qty)) : '—') },
  { title: '允许小数', key: 'allow_decimal', width: 80, render: (r) => (r.allow_decimal ? '是' : '否') },
])

function renderSkuPanel(row: ProductSPU) {
  const skus = skuBySpu.value[row.id] || []
  if (!skus.length) {
    return h('div', { style: 'padding:12px;color:var(--text-3)' }, '该商品暂无 SKU')
  }
  return h('div', { style: 'padding: 8px 8px 8px 40px' }, [
    h(NDataTable, {
      class: 'sku-table',
      columns: skuColumns.value,
      data: skus,
      size: 'small',
      bordered: false,
      'row-key': (s: ProductSKU) => s.id,
    }),
  ])
}

/** 筛选条件变化：回到第一页再查询 */
async function search() {
  page.value = 1
  await reload()
}

async function reload() {
  loading.value = true
  try {
    const [spuPage, cats] = await Promise.all([
      productApi.spusPage({
        keyword: keyword.value || undefined,
        category_id: filterCategoryId.value ?? undefined,
        is_miniprogram: filterMiniprogram.value == null ? undefined : filterMiniprogram.value === 'true',
        page: page.value,
        page_size: pageSize,
      }),
      categoryApi.tree(),
    ])
    list.value = spuPage.items
    total.value = spuPage.total
    categoryTree.value = cats
    // 统一 page_size=20：按当前页逐 SPU 拉取 SKU（展开面板与 SKU 数列），不再一次性拉全量 /skus
    const skuLists = await Promise.all(spuPage.items.map((s) => productApi.skus(s.id)))
    skuBySpu.value = groupSkuBySpu(skuLists.flat())
    expandedKeys.value = []
  } finally {
    loading.value = false
  }
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

/** 分类筛选项：GET /categories/tree → n-cascader options */
function mapCats(nodes: Category[]): any[] {
  return nodes.map((n) => ({
    label: n.name,
    value: n.id,
    children: n.children && n.children.length ? mapCats(n.children) : undefined,
  }))
}

const categoryCascaderOptions = computed(() => mapCats(categoryTree.value))

// 上架状态筛选项：null=全部（清除选择）；n-select 的 value 只支持 string/number，查询时再转为 boolean
const miniprogramOptions = [
  { label: '已上架小程序', value: 'true' },
  { label: '未上架小程序', value: 'false' },
]

function groupSkuBySpu(skus: ProductSKU[]): Record<number, ProductSKU[]> {
  const map: Record<number, ProductSKU[]> = {}
  for (const s of skus) (map[s.spu_id] = map[s.spu_id] || []).push(s)
  return map
}

async function onDelete(r: ProductSPU) {
  await productApi.removeSpu(r.id)
  message.success('已删除')
  reload()
}

onMounted(reload)
</script>

<style scoped>
.product-toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--bg-card);
}
/* SKU 子表表头底色 */
:deep(.sku-table .n-data-table-thead th) { background: var(--bg-subtle); }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 12px; }
</style>
