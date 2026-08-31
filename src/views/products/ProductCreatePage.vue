<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">{{ isEdit ? '编辑商品' : '新建商品' }}</h2>
      <div class="header-actions">
        <n-button @click="router.push('/products/list')">取消</n-button>
        <n-button type="primary" :loading="saving" @click="onSave">保存</n-button>
      </div>
    </div>

    <div class="create-grid">
      <div class="media-col">
        <div class="card-section">
          <h3 class="section-title">主图上传（{{ form.main_images.length }}/5）</h3>
          <n-upload
            v-model:file-list="mainFileList"
            :max="5"
            list-type="image-card"
            accept="image/*"
            :custom-request="uploadMain"
            @remove="onMainRemove"
          />
        </div>
        <div class="card-section">
          <h3 class="section-title">详情图上传（{{ form.detail_images.length }}/10）</h3>
          <n-upload
            v-model:file-list="detailFileList"
            :max="10"
            list-type="image-card"
            accept="image/*"
            :custom-request="uploadDetail"
            @remove="onDetailRemove"
          />
        </div>
      </div>

      <div class="form-col">
        <div class="card-section">
          <h3 class="section-title">基础信息</h3>
          <n-form label-placement="left" label-width="96">
            <n-form-item label="商品名称"><n-input v-model:value="form.name" placeholder="请输入商品标题" /></n-form-item>
            <n-form-item label="商品分类">
              <n-cascader
                v-model:value="categoryPath"
                :options="cascaderOptions"
                placeholder="选择商品分类"
                clearable
                style="width: 100%"
                @update:value="onCategoryChange"
              />
            </n-form-item>
            <n-form-item label="上架小程序">
              <n-switch v-model:value="form.is_miniprogram" />
            </n-form-item>
          </n-form>
        </div>

        <div class="card-section">
          <h3 class="section-title">商品属性</h3>
          <n-alert type="info" :bordered="false" style="margin-bottom: 12px">属性值按笛卡尔积自动生成 SKU，例如 规格[1斤,2斤] 会生成对应 SKU。</n-alert>
          <div v-for="(attr, i) in form.sku_attributes" :key="i" class="attr-row">
            <n-input v-model:value="attr.name" placeholder="属性名，如 规格" style="width: 150px" />
            <n-dynamic-tags v-model:value="attr.values" :max="50" placeholder="输入值后回车，如 1斤" style="flex: 1" />
            <n-button text type="error" @click="removeAttribute(i)">移除</n-button>
          </div>
          <div class="attr-actions">
            <n-button dashed @click="addAttribute">添加属性</n-button>
            <n-button type="primary" secondary @click="generateSkus">生成SKU</n-button>
          </div>
        </div>

        <div class="card-section">
          <h3 class="section-title">SKU 编辑（{{ skuList.length }}）</h3>
          <n-data-table :columns="skuColumns" :data="skuList" :bordered="false" size="small" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NTag, NButton, NInputNumber, NSelect, useMessage,
  type DataTableColumns, type UploadFileInfo,
} from 'naive-ui'
import { productApi, categoryApi, uploadApi } from '@/api'
import type { Category, ProductSKU, PriceMethod } from '@/types'

interface SkuRow {
  id?: number
  specs: Record<string, string>
  cost_price: number
  price_method: PriceMethod
  price_value: number
}

const route = useRoute()
const router = useRouter()
const message = useMessage()
const saving = ref(false)
const categoryTree = ref<Category[]>([])
const categoryPath = ref<(string | number)[]>([])
const mainFileList = ref<UploadFileInfo[]>([])
const detailFileList = ref<UploadFileInfo[]>([])
const skuList = ref<SkuRow[]>([])
const originalSkus = ref<ProductSKU[]>([])

const isEdit = computed(() => !!route.params.id)
const editId = computed(() => Number(route.params.id))

const form = reactive<any>({
  id: 0,
  code: '',
  name: '',
  category_id: null,
  brand: '',
  shelf_life_days: null,
  description: '',
  status: 1,
  is_miniprogram: false,
  supplier_id: 0,
  main_images: [] as string[],
  detail_images: [] as string[],
  sku_attributes: [] as { name: string; values: string[] }[],
})

const priceMethodOpts = [
  { label: '百分比', value: 'percent' },
  { label: '固定金额', value: 'amount' },
]

function mapCats(nodes: Category[]): any[] {
  return nodes.map((n) => ({
    label: n.name,
    value: n.id,
    children: n.children && n.children.length ? mapCats(n.children) : undefined,
  }))
}

const cascaderOptions = computed(() => mapCats(categoryTree.value))

function findPath(nodes: Category[], id: number, path: number[] = []): number[] | null {
  for (const n of nodes) {
    const p = [...path, n.id]
    if (n.id === id) return p
    if (n.children) {
      const f = findPath(n.children, id, p)
      if (f) return f
    }
  }
  return null
}

function onCategoryChange(path: (string | number)[] | null) {
  form.category_id = path && path.length ? Number(path[path.length - 1]) : null
}

function calcDefaultPrice(r: SkuRow): number {
  const base = Number(r.cost_price) || 0
  const val = Number(r.price_value) || 0
  const raw = r.price_method === 'amount' ? base + val : base * (1 + val / 100)
  return Math.max(raw, 0)
}

const skuColumns = computed<DataTableColumns<SkuRow>>(() => [
  { title: '规格', key: 'specs', render: (r) => h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px' }, Object.entries(r.specs || {}).map(([k, v]) => h(NTag, { size: 'small', bordered: false }, { default: () => `${k}: ${v}` }))) },
  { title: '成本价', key: 'cost_price', width: 110, render: (r) => h(NInputNumber, { value: r.cost_price, size: 'small', precision: 2, min: 0, 'onUpdate:value': (v: number | null) => { r.cost_price = v ?? 0 } }) },
  { title: '默认价格计算方式', key: 'price_method', width: 150, render: (r) => h(NSelect, { value: r.price_method, size: 'small', options: priceMethodOpts, 'onUpdate:value': (v) => { r.price_method = v as PriceMethod } }) },
  { title: '数值', key: 'price_value', width: 110, render: (r) => h(NInputNumber, { value: r.price_value, size: 'small', precision: 2, 'onUpdate:value': (v: number | null) => { r.price_value = v ?? 0 } }) },
  { title: '默认售价', key: 'default_price', width: 110, render: (r) => h('span', { style: 'color:#ea580c;font-weight:600' }, `¥${calcDefaultPrice(r).toFixed(2)}`) },
])

function addAttribute() {
  form.sku_attributes.push({ name: '', values: [] })
}

function removeAttribute(i: number) {
  form.sku_attributes.splice(i, 1)
}

function cartesianSpecs(): Record<string, string>[] {
  const attrs = form.sku_attributes.filter((a: any) => a.name?.trim() && a.values?.length)
  if (!attrs.length) return [{}]
  return attrs.reduce((acc: Record<string, string>[], a: any) => {
    const next: Record<string, string>[] = []
    for (const combo of acc) {
      for (const value of a.values) next.push({ ...combo, [a.name]: value })
    }
    return next
  }, [{}])
}

function buildSkuList(): SkuRow[] {
  const combos = cartesianSpecs()
  const next: SkuRow[] = []
  for (const specs of combos) {
    const existing = skuList.value.find((s) => JSON.stringify(s.specs || {}) === JSON.stringify(specs))
    if (existing) {
      next.push({ ...existing })
    } else {
      next.push({ id: undefined, specs, cost_price: 0, price_method: 'percent', price_value: 0 })
    }
  }
  return next
}

function generateSkus() {
  skuList.value = buildSkuList()
  message.success(`已生成 ${skuList.value.length} 个 SKU`)
}

async function uploadMain(options: any) {
  const file = options.file as UploadFileInfo
  if (!file.file) return
  try {
    const res = await uploadApi.image(file.file as File)
    file.url = res.url
    file.status = 'finished'
    options.onFinish?.()
    if (!form.main_images.includes(res.url)) form.main_images.push(res.url)
  } catch {
    file.status = 'error'
    options.onError?.()
  }
}

async function uploadDetail(options: any) {
  const file = options.file as UploadFileInfo
  if (!file.file) return
  try {
    const res = await uploadApi.image(file.file as File)
    file.url = res.url
    file.status = 'finished'
    options.onFinish?.()
    if (!form.detail_images.includes(res.url)) form.detail_images.push(res.url)
  } catch {
    file.status = 'error'
    options.onError?.()
  }
}

function onMainRemove(options: any) {
  form.main_images = form.main_images.filter((u: string) => u !== options.file.url)
}

function onDetailRemove(options: any) {
  form.detail_images = form.detail_images.filter((u: string) => u !== options.file.url)
}

function skuPayload(r: SkuRow) {
  return {
    cost_price: Number(r.cost_price) || 0,
    price_method: r.price_method,
    price_value: Number(r.price_value) || 0,
    specs: r.specs,
  }
}

async function onSave() {
  if (!form.name) {
    message.warning('请填写商品名称')
    return
  }
  if (!skuList.value.length) skuList.value = buildSkuList()
  if (!skuList.value.length) {
    message.warning('请先生成 SKU')
    return
  }
  const basicPayload = {
    name: form.name,
    category_id: form.category_id || null,
    brand: form.brand || null,
    shelf_life_days: form.shelf_life_days || null,
    description: form.description || null,
    main_images: form.main_images,
    detail_images: form.detail_images,
    sku_attributes: form.sku_attributes.filter((a: any) => a.name?.trim() && a.values?.length),
    status: form.status ?? 1,
    supplier_id: form.supplier_id || 0,
    is_miniprogram: !!form.is_miniprogram,
  }
  saving.value = true
  try {
    if (isEdit.value) {
      const id = editId.value
      await productApi.updateSpu(id, basicPayload)
      const rows = skuList.value
      const updates = rows.filter((r) => r.id).map((r) => productApi.updateSku(r.id!, skuPayload(r)))
      const creates = rows.filter((r) => !r.id).map((r) => productApi.createSku(id, skuPayload(r)))
      const removed = originalSkus.value
        .filter((o) => !rows.some((r) => r.id === o.id))
        .map((o) => productApi.removeSku(o.id))
      await Promise.all([...updates, ...creates, ...removed])
    } else {
      const spu = await productApi.createSpu({ ...basicPayload, code: form.code || `SPU-${Date.now()}` })
      await Promise.all(skuList.value.map((r) => productApi.createSku(spu.id, skuPayload(r))))
    }
    message.success('已保存')
    router.push('/products/list')
  } finally {
    saving.value = false
  }
}

function syncImagesFromForm() {
  mainFileList.value = (form.main_images || []).map((u: string, i: number) => ({ id: i, url: u, status: 'finished', name: String(i) }))
  detailFileList.value = (form.detail_images || []).map((u: string, i: number) => ({ id: i, url: u, status: 'finished', name: String(i) }))
}

onMounted(async () => {
  categoryTree.value = await categoryApi.tree()
  if (isEdit.value) {
    const spu = await productApi.spu(editId.value)
    Object.assign(form, JSON.parse(JSON.stringify(spu)))
    form.is_miniprogram = !!spu.is_miniprogram
    form.status = spu.status ?? 1
    form.sku_attributes = (spu.sku_attributes || []).map((a) => ({ name: a.name, values: [...a.values] }))
    if (form.category_id) {
      const p = findPath(categoryTree.value, Number(form.category_id))
      if (p) categoryPath.value = p
    }
    const skusList = await productApi.skus(editId.value)
    originalSkus.value = skusList
    skuList.value = skusList.map((s) => ({
      id: s.id,
      specs: s.specs || {},
      cost_price: Number(s.cost_price) || 0,
      price_method: s.price_method || 'percent',
      price_value: Number(s.price_value) || 0,
    }))
    syncImagesFromForm()
  } else {
    form.code = `SPU-${Date.now()}`
  }
})
</script>

<style scoped>
.header-actions { display: flex; align-items: center; gap: 8px; }
.create-grid { display: grid; grid-template-columns: 380px minmax(0, 1fr); gap: 16px; align-items: start; }
.form-col, .media-col { display: flex; flex-direction: column; gap: 16px; }
.section-title { margin: 0 0 16px; font-size: 16px; font-weight: 600; }
.attr-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.attr-actions { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
@media (max-width: 900px) {
  .create-grid { grid-template-columns: 1fr; }
}
</style>
