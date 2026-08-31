<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">商品管理</h2><n-button type="primary" @click="$router.push('/products/create')">新建商品</n-button></div>
      <div class="filter-bar">
        <n-input v-model:value="keyword" placeholder="搜索商品名称 / 编码" clearable style="width: 240px" @keyup.enter="reload" />
        <n-button type="primary" size="small" @click="reload">查询</n-button>
      </div>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" :row-key="(r:any)=>r.id" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NTag, NPopconfirm, useMessage, type DataTableColumns } from 'naive-ui'
import { productApi, categoryApi } from '@/api'
import { formatDate } from '@/utils/format'
import type { ProductSPU, ProductSKU, Category } from '@/types'

const router = useRouter()
const message = useMessage()
const list = ref<ProductSPU[]>([])
const keyword = ref('')
const loading = ref(false)
const categoryMap = ref<Record<number, string>>({})
const skuBySpu = ref<Record<number, ProductSKU[]>>({})

function skuDefaultPrice(sku: ProductSKU | undefined): number {
  if (!sku) return 0
  const base = Number(sku.cost_price) || 0
  const val = Number(sku.price_value) || 0
  const raw = sku.price_method === 'amount' ? base + val : base * (1 + val / 100)
  return Math.max(raw, 0)
}

const columns = computed<DataTableColumns<ProductSPU>>(() => [
  { title: '编码', key: 'code', width: 120 },
  { title: '商品名称', key: 'name', ellipsis: { tooltip: true } },
  { title: '分类', key: 'category_id', width: 110, render: (r) => categoryMap.value[r.category_id ?? 0] || '—' },
  { title: 'SKU数量', key: 'sku_count', width: 90, render: (r) => (skuBySpu.value[r.id] || []).length },
  { title: 'SKU默认价格', key: 'sku_price', width: 110, render: (r) => { const s = (skuBySpu.value[r.id] || [])[0]; return s ? `¥${skuDefaultPrice(s).toFixed(2)}` : '—' } },
  { title: '上架小程序', key: 'is_miniprogram', width: 100, render: (r) => r.is_miniprogram ? h(NTag, { size: 'small', type: 'success' }, { default: () => '已上架' }) : h(NTag, { size: 'small', type: 'default' }, { default: () => '未上架' }) },
  { title: '创建时间', key: 'created_at', width: 150, render: (r) => formatDate(r.created_at) },
  { title: '操作', key: 'actions', width: 120, render: (r) => h('div', [
    h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => router.push(`/products/edit/${r.id}`) }, { default: () => '编辑' }),
    h(NPopconfirm, { onPositiveClick: () => onDelete(r) }, {
      default: () => '确认删除?',
      trigger: () => h(NButton, { size: 'small', text: true, type: 'error', style: 'margin-left:8px' }, { default: () => '删除' }),
    }),
  ]) },
])

async function reload() {
  loading.value = true
  try {
    const [spus, cats, skus] = await Promise.all([
      productApi.spus({ keyword: keyword.value || undefined }),
      categoryApi.tree(),
      productApi.allSkus({ page_size: 100 }),
    ])
    list.value = spus
    categoryMap.value = buildCatMap(cats)
    skuBySpu.value = groupSkuBySpu(skus)
  } finally {
    loading.value = false
  }
}

function buildCatMap(nodes: Category[], map: Record<number, string> = {}): Record<number, string> {
  for (const n of nodes) {
    map[n.id] = n.name
    if (n.children) buildCatMap(n.children, map)
  }
  return map
}

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
