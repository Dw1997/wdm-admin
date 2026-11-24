<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">专属价格</h2>
      </div>
      <div class="filter-bar">
        <n-select
          v-model:value="filterCustomerId"
          :options="customerOptions"
          clearable
          filterable
          placeholder="按客户筛选"
          style="width: 240px"
          @update:value="loadPrices"
        />
        <n-button size="small" @click="loadPrices">刷新</n-button>
        <n-button type="primary" size="small" @click="openCreate">新增专属价</n-button>
      </div>
      <n-alert type="info" :bordered="false" style="margin-bottom: 12px">
        客户专属价为该客户对应 SKU 的固定实际成交价，优先于等级价格与建议零售价生效。
      </n-alert>
      <n-data-table
        :columns="columns"
        :data="prices"
        :loading="loading"
        size="small"
        :bordered="false"
        :row-key="(r: CustomerSkuPrice) => r.id"
      />
    </div>

    <n-modal v-model:show="showCreate" preset="card" title="新增客户专属价" style="width: 480px">
      <n-form label-placement="left" label-width="90">
        <n-form-item label="客户">
          <n-select v-model:value="form.customer_id" :options="customerOptions" filterable placeholder="选择客户" />
        </n-form-item>
        <n-form-item label="商品">
          <n-select
            v-model:value="form.spu_id"
            :options="spuOptions"
            :loading="spuLoading"
            filterable
            remote
            clearable
            placeholder="输入名称搜索商品"
            @search="searchSpus"
            @update:value="onSpuChange"
          />
        </n-form-item>
        <n-form-item label="SKU">
          <n-select v-model:value="form.sku_id" :options="skuOptions" :loading="skuLoading" placeholder="选择 SKU" />
        </n-form-item>
        <n-form-item v-if="selectedSku" label="成本价 (元)">
          <span>¥{{ Number(selectedSku.cost_price || 0).toFixed(2) }}</span>
        </n-form-item>
        <n-form-item v-if="selectedSku" label="默认售价 (元)">
          <span style="color: #ea580c; font-weight: 600">¥{{ calcSuggestedPrice(selectedSku).toFixed(2) }}</span>
        </n-form-item>
        <n-form-item label="专属价 (元)">
          <n-input-number v-model:value="form.price" :precision="2" :min="0" style="width: 100%" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <n-button size="small" @click="showCreate = false">取消</n-button>
          <n-button type="primary" size="small" :loading="saving" @click="saveCreate">保存</n-button>
        </div>
      </template>
    </n-modal>

    <n-modal v-model:show="showPreview" preset="card" title="价格预览" style="width: 480px">
      <n-spin :show="previewing">
        <n-descriptions v-if="previewResult" bordered :column="1" size="small">
          <n-descriptions-item label="客户">{{ previewResult.customer_id }} 号客户</n-descriptions-item>
          <n-descriptions-item label="价格来源">
            <n-tag size="small" :type="PRICE_SOURCE[previewResult.price_source].type" :bordered="false">
              {{ PRICE_SOURCE[previewResult.price_source].label }}
            </n-tag>
          </n-descriptions-item>
          <n-descriptions-item label="建议零售价">¥{{ previewResult.suggested_price }}</n-descriptions-item>
          <n-descriptions-item label="等级价格">¥{{ previewResult.level_price }}</n-descriptions-item>
          <n-descriptions-item label="最终成交价">
            <span style="color: var(--primary); font-weight: 600">¥{{ previewResult.final_price }}</span>
          </n-descriptions-item>
        </n-descriptions>
      </n-spin>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, computed, onMounted } from 'vue'
import {
  NInputNumber, NSelect, NDataTable, useMessage, useDialog,
  type DataTableColumns,
} from 'naive-ui'
import { adminCustomerApi, customerSkuPriceApi, productApi, fetchAllPages, PAGE_SIZE } from '@/api'
import { formatDate, calcSuggestedPrice } from '@/utils/format'
import { PRICE_SOURCE } from '@/utils/dict'
import type { AdminCustomer, CustomerSkuPrice, CustomerSkuPricePreview, ProductSKU } from '@/types'
import { actionBar, actionIcon } from '@/components/tableActions'

const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const saving = ref(false)
const previewing = ref(false)

const customers = ref<AdminCustomer[]>([])
const skus = ref<ProductSKU[]>([])
const prices = ref<CustomerSkuPrice[]>([])
const filterCustomerId = ref<number | null>(null)

const customerOptions = ref<{ label: string; value: number }[]>([])
const spuOptions = ref<{ label: string; value: number }[]>([])

// 商品/SKU 不再整表预加载：商品按关键字远程搜索，SKU 选中商品后再取
const skuOptions = computed(() =>
  skus.value.map((s) => ({
    label: (s.specs ? Object.values(s.specs).filter(Boolean).join('/') : s.remark || '') || `SKU ${s.id}`,
    value: s.id,
  })),
)
const spuLoading = ref(false)
const skuLoading = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined

async function loadSpus(keyword = '') {
  spuLoading.value = true
  try {
    const list = await productApi.spus({ keyword: keyword || undefined, page: 1, page_size: PAGE_SIZE })
    spuOptions.value = list.map((s) => ({ label: `${s.name} (${s.code})`, value: s.id }))
  } finally {
    spuLoading.value = false
  }
}

function searchSpus(keyword: string) {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadSpus(keyword.trim()), 300)
}

async function onSpuChange(spuId: number | null) {
  form.value.sku_id = null
  skus.value = []
  if (!spuId) return
  skuLoading.value = true
  try {
    skus.value = await productApi.skus(spuId)
  } finally {
    skuLoading.value = false
  }
}

function specsText(r: CustomerSkuPrice): string {
  const specs = r.sku_specs ? Object.values(r.sku_specs).filter(Boolean).join('/') : ''
  return [r.spu_name, specs].filter(Boolean).join(' · ') || '—'
}

const columns = computed<DataTableColumns<CustomerSkuPrice>>(() => [
  { title: '客户', key: 'customer_name', width: 140 },
  { title: '商品 / SKU', key: 'sku', minWidth: 180, render: (r) => specsText(r) },
  {
    title: '专属价 (元)', key: 'price', width: 140,
    render: (r) => h(NInputNumber, {
      value: Number(r.price),
      size: 'small',
      precision: 2,
      min: 0,
      style: 'width: 120px',
      'onUpdate:value': (v: number | null) => { r.price = String(v ?? 0) },
    }),
  },
  { title: '更新人', key: 'updated_by_name', width: 100, render: (r) => r.updated_by_name || '—' },
  { title: '更新时间', key: 'updated_at', width: 160, render: (r) => (r.updated_at ? formatDate(r.updated_at) : '—') },
  {
    title: '操作', key: 'actions', width: 105,
    render: (r) => actionBar([
      actionIcon({ icon: 'save', label: '保存', loading: saving.value, onClick: () => saveRow(r) }),
      actionIcon({ icon: 'view', label: '预览', type: 'default', onClick: () => previewRow(r) }),
      actionIcon({
        icon: 'delete',
        label: '删除',
        onClick: () => dialog.warning({
          title: '删除专属价',
          content: `确定删除「${r.customer_name}」对「${specsText(r)}」的专属价？删除后按等级价格/建议零售价成交。`,
          positiveText: '删除',
          negativeText: '取消',
          onPositiveClick: () => removeRow(r),
        }),
      }),
    ]),
  },
])

const showCreate = ref(false)
const form = ref({ customer_id: null as number | null, spu_id: null as number | null, sku_id: null as number | null, price: 0 })

const selectedSku = computed(() => skus.value.find((s) => s.id === form.value.sku_id) ?? null)

const showPreview = ref(false)
const previewResult = ref<CustomerSkuPricePreview | null>(null)

function openCreate() {
  form.value = { customer_id: filterCustomerId.value, spu_id: null, sku_id: null, price: 0 }
  skus.value = []
  loadSpus()
  showCreate.value = true
}

async function loadPrices() {
  loading.value = true
  try {
    prices.value = await customerSkuPriceApi.list(filterCustomerId.value ? { customer_id: filterCustomerId.value } : {})
  } finally {
    loading.value = false
  }
}

async function saveRow(r: CustomerSkuPrice) {
  saving.value = true
  try {
    await customerSkuPriceApi.upsert(r.customer_id, r.sku_id, { price: Number(r.price) })
    message.success('专属价已保存')
    await loadPrices()
  } finally {
    saving.value = false
  }
}

async function removeRow(r: CustomerSkuPrice) {
  await customerSkuPriceApi.remove(r.customer_id, r.sku_id)
  message.success('专属价已删除')
  await loadPrices()
}

async function previewRow(r: CustomerSkuPrice) {
  previewResult.value = null
  showPreview.value = true
  previewing.value = true
  try {
    previewResult.value = await customerSkuPriceApi.preview(r.customer_id, r.sku_id)
  } finally {
    previewing.value = false
  }
}

async function saveCreate() {
  if (!form.value.customer_id) return message.warning('请选择客户')
  if (!form.value.sku_id) return message.warning('请选择 SKU')
  saving.value = true
  try {
    await customerSkuPriceApi.upsert(form.value.customer_id, form.value.sku_id, { price: form.value.price })
    message.success('专属价已保存')
    showCreate.value = false
    filterCustomerId.value = form.value.customer_id
    await loadPrices()
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    // 客户下拉需全量选项；商品/SKU 改为按需加载，避免进页面就拉几十页
    const customerList = await fetchAllPages((p) => adminCustomerApi.list({ page: p, page_size: PAGE_SIZE }))
    customers.value = customerList
    customerOptions.value = customerList.map((c) => ({ label: c.name, value: c.id }))
    await loadPrices()
  } finally {
    loading.value = false
  }
})
</script>
