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
          <n-select v-model:value="form.spu_id" :options="spuOptions" filterable placeholder="选择商品" @update:value="form.sku_id = null" />
        </n-form-item>
        <n-form-item label="SKU">
          <n-select v-model:value="form.sku_id" :options="skuOptionsFor(form.spu_id)" placeholder="选择 SKU" />
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
            <span style="color: #dc2626; font-weight: 600">¥{{ previewResult.final_price }}</span>
          </n-descriptions-item>
        </n-descriptions>
      </n-spin>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, computed, onMounted } from 'vue'
import {
  NButton, NInputNumber, NSelect, NDataTable, useMessage, useDialog,
  type DataTableColumns,
} from 'naive-ui'
import { adminCustomerApi, customerSkuPriceApi, productApi } from '@/api'
import { formatDate } from '@/utils/format'
import { PRICE_SOURCE } from '@/utils/dict'
import type { AdminCustomer, CustomerSkuPrice, CustomerSkuPricePreview, ProductSPU, ProductSKU } from '@/types'

const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const saving = ref(false)
const previewing = ref(false)

const customers = ref<AdminCustomer[]>([])
const spus = ref<ProductSPU[]>([])
const skus = ref<ProductSKU[]>([])
const prices = ref<CustomerSkuPrice[]>([])
const filterCustomerId = ref<number | null>(null)

const customerOptions = ref<{ label: string; value: number }[]>([])
const spuOptions = ref<{ label: string; value: number }[]>([])

function skuOptionsFor(spuId: number | null) {
  if (!spuId) return []
  return skus.value
    .filter((s) => s.spu_id === spuId)
    .map((s) => ({ label: skuLabel(s), value: s.id }))
}

function skuLabel(sku: ProductSKU): string {
  const spu = spus.value.find((s) => s.id === sku.spu_id)
  const spec = sku.specs ? Object.values(sku.specs).filter(Boolean).join('/') : sku.remark || ''
  return `${spu?.name || 'SKU'} ${spec}`.trim()
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
    title: '操作', key: 'actions', width: 150,
    render: (r) => h('div', { style: 'display:flex;gap:8px' }, [
      h(NButton, { size: 'small', text: true, type: 'primary', loading: saving.value, onClick: () => saveRow(r) }, { default: () => '保存' }),
      h(NButton, { size: 'small', text: true, onClick: () => previewRow(r) }, { default: () => '预览' }),
      h(NButton, {
        size: 'small', text: true, type: 'error',
        onClick: () => dialog.warning({
          title: '删除专属价',
          content: `确定删除「${r.customer_name}」对「${specsText(r)}」的专属价？删除后按等级价格/建议零售价成交。`,
          positiveText: '删除',
          negativeText: '取消',
          onPositiveClick: () => removeRow(r),
        }),
      }, { default: () => '删除' }),
    ]),
  },
])

const showCreate = ref(false)
const form = ref({ customer_id: null as number | null, spu_id: null as number | null, sku_id: null as number | null, price: 0 })

const showPreview = ref(false)
const previewResult = ref<CustomerSkuPricePreview | null>(null)

function openCreate() {
  form.value = { customer_id: filterCustomerId.value, spu_id: null, sku_id: null, price: 0 }
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
    const [customerList, spuList, skuList] = await Promise.all([
      adminCustomerApi.list({ page_size: 100 }),
      productApi.spus(),
      productApi.allSkus({ page_size: 100 }),
    ])
    customers.value = customerList
    spus.value = spuList
    skus.value = skuList
    customerOptions.value = customerList.map((c) => ({ label: c.name, value: c.id }))
    spuOptions.value = spuList.map((s) => ({ label: `${s.name} (${s.code})`, value: s.id }))
    await loadPrices()
  } finally {
    loading.value = false
  }
})
</script>
