<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">{{ isEdit ? '编辑商品' : '新建商品' }}</h2>
      <div class="header-actions">
        <n-button @click="router.push('/spus/list')">取消</n-button>
        <n-button type="primary" :loading="saving" @click="onSave">保存</n-button>
      </div>
    </div>

    <div class="create-grid">
      <div class="form-col">
        <div class="card-section">
          <h3 class="section-title">基础信息</h3>
          <n-form label-placement="left" label-width="96">
            <n-form-item label="SPU ID"><n-input v-model:value="form.code" placeholder="自定义编号，便于记忆与检索" /></n-form-item>
            <n-form-item label="商品名称"><n-input v-model:value="form.name" placeholder="请输入商品标题" /></n-form-item>
            <n-form-item label="商品分类">
              <!-- 单选 n-cascader 的 value 是叶子分类 id（非路径数组），直接绑定 form.category_id -->
              <n-cascader
                v-model:value="form.category_id"
                :options="cascaderOptions"
                placeholder="选择商品分类"
                clearable
                show-path
                style="width: 100%"
              />
            </n-form-item>
            <n-form-item label="供应商">
              <!-- 供应商选项来自 GET /vendors（Apifox 505911554） -->
              <n-select v-model:value="form.supplier_id" :options="supplierOptions" placeholder="不选则默认自营（0）" clearable />
            </n-form-item>
            <n-form-item label="基础单位">
              <!-- 库存按基础单位计数；称重商品填"斤"，瓶装填"瓶"（04 §2.2） -->
              <n-auto-complete v-model:value="form.base_unit" :options="baseUnitOptions" placeholder="如 斤 / 个 / 瓶 / 包 / 件" />
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
            <n-input
              v-model:value="attr.name"
              placeholder="属性名，如 规格"
              style="width: 150px"
              @keyup.enter="focusValue(i as number, 0)"
            />
            <div class="attr-values">
              <div v-for="(v, vi) in attr.values" :key="vi" class="attr-value-item">
                <n-input
                  :ref="(el: any) => setValueRef(i as number, vi as number, el)"
                  v-model:value="attr.values[vi]"
                  placeholder="属性值，如 1斤"
                  style="width: 140px"
                  @keyup.enter="focusValue(i as number, (vi as number) + 1)"
                />
                <!-- 末尾空白值是待输入框，不显示删除 -->
                <n-button v-if="(v || '').trim()" text type="error" @click="removeValue(i as number, vi as number)">×</n-button>
              </div>
            </div>
            <!-- 末尾空白属性行是待输入行，不显示移除 -->
            <n-button
              v-if="attr.name?.trim() || (attr.values || []).some((v: string) => v.trim()) || i !== form.sku_attributes.length - 1"
              text type="error" @click="removeAttribute(i as number)"
            >移除</n-button>
          </div>
        </div>

        <div class="card-section">
          <h3 class="section-title">SKU 编辑（{{ skuList.length }}）</h3>
          <div v-if="skuList.length" class="sku-editor">
            <div v-for="sku in skuList" :key="JSON.stringify(sku.specs)" class="sku-card">
              <div class="sku-row sku-single-row">
                <div class="sku-field sku-specs">
                  <span class="sku-label">规格</span>
                  <div class="spec-tags">
                    <n-tag v-for="(value, key) in sku.specs" :key="key" size="small" :bordered="false">{{ key }}：{{ value }}</n-tag>
                  </div>
                </div>
                <div class="sku-field">
                  <span class="sku-label">是否启用</span>
                  <n-select :value="sku.is_enabled ? 1 : 0" :options="enabledOpts" size="small" @update:value="sku.is_enabled = $event === 1" />
                </div>
                <div class="sku-field">
                  <span class="sku-label">上架小程序</span>
                  <n-switch v-model:value="sku.is_miniprogram" size="small" />
                </div>
                <div class="sku-field">
                  <span class="sku-label">换算数量</span>
                  <n-input-number v-model:value="sku.base_qty" :precision="1" :min="0.1" :show-button="false" size="small" />
                </div>
                <div class="sku-field">
                  <span class="sku-label">允许小数</span>
                  <n-switch v-model:value="sku.allow_decimal" size="small" />
                </div>
                <div class="sku-field">
                  <span class="sku-label">条码</span>
                  <n-input :value="sku.barcode ?? ''" maxlength="50" placeholder="扫码枪录入" size="small" @update:value="sku.barcode = $event.trim() || null" />
                </div>
                <div class="sku-field">
                  <span class="sku-label">成本价</span>
                  <n-input-number v-model:value="sku.cost_price" :precision="2" :min="0" :show-button="false" size="small" />
                </div>
                <div class="sku-field">
                  <span class="sku-label">折合每{{ form.base_unit || '基础单位' }}成本</span>
                  <strong :class="{ 'cost-warning': costMismatch }">¥{{ costPerBase(sku).toFixed(2) }}</strong>
                </div>
                <div class="sku-field">
                  <span class="sku-label">默认价格方式</span>
                  <n-select v-model:value="sku.price_method" :options="priceMethodOpts" size="small" />
                </div>
                <div class="sku-field">
                  <span class="sku-label">默认价格数值</span>
                  <n-input-number v-model:value="sku.price_value" :precision="2" :show-button="false" size="small" />
                </div>
                <div class="sku-field">
                  <span class="sku-label">默认售价（预估）</span>
                  <strong class="suggested-price">¥{{ calcDefaultPrice(sku).toFixed(2) }}</strong>
                </div>
                <div class="sku-field">
                  <span class="sku-label">最低售价规则</span>
                  <n-select v-model:value="sku.min_price_method" :options="priceMethodOpts" size="small" />
                </div>
                <div class="sku-field">
                  <span class="sku-label">最低售价数值</span>
                  <n-input-number v-model:value="sku.min_price_value" :precision="2" :show-button="false" size="small" />
                </div>
                <div class="sku-field">
                  <span class="sku-label">最低售价（预估）</span>
                  <strong>¥{{ calcMinPrice(sku).toFixed(2) }}</strong>
                </div>
              </div>
            </div>
          </div>
          <n-empty v-else description="请先填写商品属性" size="small" />
          <n-alert v-if="costMismatch" type="warning" :bordered="false" style="margin-top: 8px">各规格折合每基础单位的成本相差超过 30%，请确认换算数量没有填错（不阻止保存）。</n-alert>
        </div>
      </div>

      <div class="media-col">
        <div class="card-section">
          <h3 class="section-title">主图上传（{{ form.main_images.length }}/5）</h3>
          <div class="img-grid">
            <div
              v-for="(url, i) in (form.main_images as string[])"
              :key="url"
              class="img-item"
              :class="{ dragging: dragFrom && dragFrom.key === 'main' && dragFrom.index === i }"
              draggable="true"
              @dragstart="onDragStart('main', i)"
              @dragover.prevent
              @drop.prevent="onDrop('main', i)"
              @dragend="onDragEnd"
            >
              <img :src="url" alt="主图" draggable="false" />
              <span v-if="i === 0" class="img-badge">封面</span>
              <button class="img-remove" type="button" title="删除" @click.stop="removeImg('main', i)">×</button>
            </div>
            <n-upload
              v-if="form.main_images.length < 5"
              :show-file-list="false"
              multiple
              accept="image/*"
              :custom-request="uploadMain"
            >
              <div class="img-add"><span class="plus">＋</span><span>多选上传</span></div>
            </n-upload>
          </div>
          <div class="img-hint">支持一次多选上传，拖动图片可调整顺序，第一张为封面</div>
        </div>
        <div class="card-section">
          <h3 class="section-title">详情图上传（{{ form.detail_images.length }}/10）</h3>
          <div class="img-grid">
            <div
              v-for="(url, i) in (form.detail_images as string[])"
              :key="url"
              class="img-item"
              :class="{ dragging: dragFrom && dragFrom.key === 'detail' && dragFrom.index === i }"
              draggable="true"
              @dragstart="onDragStart('detail', i)"
              @dragover.prevent
              @drop.prevent="onDrop('detail', i)"
              @dragend="onDragEnd"
            >
              <img :src="url" alt="详情图" draggable="false" />
              <button class="img-remove" type="button" title="删除" @click.stop="removeImg('detail', i)">×</button>
            </div>
            <n-upload
              v-if="form.detail_images.length < 10"
              :show-file-list="false"
              multiple
              accept="image/*"
              :custom-request="uploadDetail"
            >
              <div class="img-add"><span class="plus">＋</span><span>多选上传</span></div>
            </n-upload>
          </div>
          <div class="img-hint">支持一次多选上传，拖动图片可调整长图拼接顺序</div>
          <div v-if="form.detail_images.length" class="long-image-preview">
            <img v-for="url in form.detail_images" :key="url" :src="url" alt="详情图" />
          </div>
          <div v-else class="long-image-empty">上传详情图后按顺序上下拼接，可上下滑动预览长图</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage, useDialog, type UploadFileInfo } from 'naive-ui'
import { productApi, categoryApi, uploadApi, vendorApi, fetchAllPages, PAGE_SIZE } from '@/api'
import type { Category, PriceImpact, PriceMethod, SkuUpsertPayload, SpuSavePayload } from '@/types'

interface SkuRow {
  id?: number
  specs: Record<string, string>
  cost_price: number
  price_method: PriceMethod
  price_value: number
  is_enabled: boolean
  is_miniprogram: boolean
  base_qty: number
  allow_decimal: boolean
  min_price_method: PriceMethod
  min_price_value: number
  /** 条码、换算备注：编辑页要原样带回，否则整体保存会把它们清空 */
  barcode: string | null
  remark: string | null
}

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const saving = ref(false)
const categoryTree = ref<Category[]>([])
const skuList = ref<SkuRow[]>([])
// 供应商下拉选项：GET /vendors（Apifox 505911554）
const supplierOptions = ref<{ label: string; value: number }[]>([])

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
  base_unit: '斤',
  supplier_id: null as number | null,
  main_images: [] as string[],
  detail_images: [] as string[],
  sku_attributes: [{ name: '', values: [''] }] as { name: string; values: string[] }[],
})

const priceMethodOpts = [
  { label: '百分比', value: 'percent' },
  { label: '固定金额', value: 'amount' },
]

const enabledOpts = [
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
]

function mapCats(nodes: Category[]): any[] {
  return nodes.map((n) => ({
    label: n.name,
    value: n.id,
    children: n.children && n.children.length ? mapCats(n.children) : undefined,
  }))
}

const cascaderOptions = computed(() => mapCats(categoryTree.value))

const baseUnitOptions = ['斤', '个', '瓶', '包', '件'].map((u) => ({ label: u, value: u }))

// 保存前的实时显示只是预估，以服务端计算为准（保存后列表和报价里的值都来自服务端）
function calcDefaultPrice(r: SkuRow): number {
  const base = Number(r.cost_price) || 0
  const val = Number(r.price_value) || 0
  const raw = r.price_method === 'amount' ? base + val : base * (1 + val / 100)
  return Math.max(raw, 0)
}

/** 最低售价预估：规则算出来低于成本价时按成本价（05 §2 规则 4） */
function calcMinPrice(r: SkuRow): number {
  const base = Number(r.cost_price) || 0
  const val = Number(r.min_price_value) || 0
  const raw = r.min_price_method === 'percent' ? base * (1 + val / 100) : base + val
  return Math.max(raw, base)
}

/** 折合每基础单位成本 = 成本价 ÷ 换算数量 */
function costPerBase(r: SkuRow): number {
  return r.base_qty > 0 ? (Number(r.cost_price) || 0) / r.base_qty : 0
}

/** 同一 SPU 下各规格折合成本相差超过 30% 时标黄提示，不阻止保存（04 §3） */
const costMismatch = computed(() => {
  const vals = skuList.value.map(costPerBase).filter((v) => v > 0)
  if (vals.length < 2) return false
  const min = Math.min(...vals)
  return (Math.max(...vals) - min) / min > 0.3
})

function removeAttribute(i: number) {
  form.sku_attributes.splice(i, 1)
}

function removeValue(i: number, vi: number) {
  form.sku_attributes[i].values.splice(vi, 1)
}

// 属性值输入框引用：回车后聚焦下一个自动出现的输入框，全程无需点击加号
const valueInputRefs = new Map<string, { focus: () => void }>()
function setValueRef(i: number, vi: number, el: unknown) {
  const key = `${i}:${vi}`
  if (el) valueInputRefs.set(key, el as { focus: () => void })
  else valueInputRefs.delete(key)
}
function focusValue(i: number, vi: number) {
  nextTick(() => valueInputRefs.get(`${i}:${vi}`)?.focus())
}

/** 有效属性：名称非空且至少一个非空属性值（自动过滤末尾待输入的空白值） */
function validAttrs(): { name: string; values: string[] }[] {
  return form.sku_attributes
    .map((a: any) => ({ name: (a.name || '').trim(), values: (a.values || []).filter((v: string) => v.trim()) }))
    .filter((a: { name: string; values: string[] }) => a.name && a.values.length > 0)
}

function cartesianSpecs(): Record<string, string>[] {
  const attrs = validAttrs()
  if (!attrs.length) return [{}]
  return attrs.reduce((acc: Record<string, string>[], a: any) => {
    const next: Record<string, string>[] = []
    for (const combo of acc) {
      for (const value of a.values) next.push({ ...combo, [a.name]: value })
    }
    return next
  }, [{}])
}

/** 以当前属性顺序生成组合键，避免 specs 键序不一致导致匹配失败 */
function specsKey(specs: Record<string, string>): string {
  return validAttrs().map((a) => `${a.name}=${specs?.[a.name] ?? ''}`).join('|')
}

function buildSkuList(): SkuRow[] {
  const next: SkuRow[] = []
  for (const specs of cartesianSpecs()) {
    const existing = skuList.value.find((s) => specsKey(s.specs || {}) === specsKey(specs))
    next.push(existing ? { ...existing, specs } : { id: undefined, specs, cost_price: 0, price_method: 'percent', price_value: 0, is_enabled: true, is_miniprogram: false, base_qty: 1, allow_decimal: false, min_price_method: 'amount', min_price_value: 0, barcode: null, remark: null })
  }
  return next
}

// 属性变化时：① 自动重算 SKU 行（保留已填写价格与已有 id，消失的组合自动移除）；
// ② 每个属性末尾保持一个空白值输入框、属性列表末尾保持一个空白属性行，输入后自动出现下一行，无需点击加号
watch(
  () => form.sku_attributes,
  () => {
    skuList.value = buildSkuList()
    const attrs = form.sku_attributes
    for (const a of attrs) {
      const vals = a.values as string[]
      const lastVal = vals[vals.length - 1]
      if (lastVal === undefined || (lastVal && lastVal.trim())) vals.push('')
    }
    const last = attrs[attrs.length - 1]
    if (!last || (last.name && last.name.trim())) attrs.push({ name: '', values: [''] })
  },
  { deep: true },
)

// —— 图片上传与排序 ——
// 多选上传：同区域请求按选择顺序串行执行，保证图片顺序与选择顺序一致；上限在入队时校验
const IMAGE_LIMITS = { main: 5, detail: 10 }
const uploadQueues: Record<'main' | 'detail', Promise<void>> = { main: Promise.resolve(), detail: Promise.resolve() }

function uploadMain(options: any) {
  enqueueUpload('main', options)
}

function uploadDetail(options: any) {
  enqueueUpload('detail', options)
}

function enqueueUpload(kind: 'main' | 'detail', options: any) {
  const file = (options.file as UploadFileInfo).file as File | null
  if (!file) return
  uploadQueues[kind] = uploadQueues[kind].then(async () => {
    const list = kind === 'main' ? form.main_images : form.detail_images
    if (list.length >= IMAGE_LIMITS[kind]) {
      message.warning(kind === 'main' ? '主图最多 5 张' : '详情图最多 10 张')
      options.onError?.()
      return
    }
    try {
      const res = await uploadApi.image(file)
      options.onFinish?.()
      if (!list.includes(res.url)) list.push(res.url)
    } catch {
      options.onError?.()
    }
  })
}

// 拖动排序：同区域内拖动换位，跨列表拖动忽略
const dragFrom = ref<{ key: 'main' | 'detail'; index: number } | null>(null)

function onDragStart(key: 'main' | 'detail', i: number) {
  dragFrom.value = { key, index: i }
}

function onDrop(key: 'main' | 'detail', i: number) {
  const from = dragFrom.value
  if (from && from.key === key && from.index !== i) {
    const list = key === 'main' ? form.main_images : form.detail_images
    const [url] = list.splice(from.index, 1)
    list.splice(i, 0, url)
  }
  dragFrom.value = null
}

function onDragEnd() {
  dragFrom.value = null
}

function removeImg(kind: 'main' | 'detail', i: number) {
  const list = kind === 'main' ? form.main_images : form.detail_images
  list.splice(i, 1)
}

function skuPayload(r: SkuRow): SkuUpsertPayload {
  return {
    id: r.id,
    specs: r.specs,
    cost_price: Number(r.cost_price) || 0,
    price_method: r.price_method,
    price_value: Number(r.price_value) || 0,
    is_enabled: r.is_enabled ?? true,
    is_miniprogram: !!r.is_miniprogram,
    base_qty: Number(r.base_qty) || 1,
    allow_decimal: !!r.allow_decimal,
    min_price_method: r.min_price_method,
    min_price_value: Number(r.min_price_value) || 0,
    barcode: r.barcode || null,
    remark: r.remark || null,
  }
}

/** 已有规格的价格字段是否被改过（对比加载时的快照） */
const loadedPrices = new Map<number, string>()
const priceKey = (r: SkuRow) => [r.cost_price, r.price_method, r.price_value, r.min_price_method, r.min_price_value].join('|')

/** 保存前预览：改了成本或规则的规格，逐个看等级价变化和会低于新最低售价的专属价（pricing.md §2） */
async function previewImpacts(): Promise<{ row: SkuRow; impact: PriceImpact }[]> {
  const changed = skuList.value.filter((r) => r.id && loadedPrices.get(r.id) !== priceKey(r))
  const out: { row: SkuRow; impact: PriceImpact }[] = []
  for (const row of changed) {
    out.push({
      row,
      impact: await productApi.priceImpact(row.id as number, {
        cost_price: Number(row.cost_price) || 0,
        price_method: row.price_method,
        price_value: Number(row.price_value) || 0,
        min_price_method: row.min_price_method,
        min_price_value: Number(row.min_price_value) || 0,
      }),
    })
  }
  return out
}

function impactLines(items: { row: SkuRow; impact: PriceImpact }[]): string[] {
  const lines: string[] = []
  for (const { row, impact } of items) {
    const spec = Object.values(row.specs || {}).join(' ') || `SKU${row.id}`
    lines.push(`【${spec}】建议零售价 ${impact.suggested_before} → ${impact.suggested_after}，最低售价 ${impact.min_before} → ${impact.min_after}`)
    for (const lv of impact.levels.filter((l) => l.price_before !== l.price_after)) {
      lines.push(`　${lv.level_name}：${lv.price_before} → ${lv.price_after}${lv.clamped ? '（按最低售价）' : ''}`)
    }
    for (const a of impact.affected_customer_prices) {
      lines.push(`　⚠ ${a.customer_name} 的专属价 ${a.price} 将低于最低售价 ${a.min_price}`)
    }
  }
  return lines
}

function confirmImpacts(items: { row: SkuRow; impact: PriceImpact }[]): Promise<boolean> {
  const lines = impactLines(items)
  if (!lines.length) return Promise.resolve(true)
  return new Promise((resolve) => {
    dialog.warning({
      title: '价格变化预览',
      content: () => h('div', { style: 'max-height:360px;overflow:auto;white-space:pre-wrap;line-height:1.7;font-size:13px' }, lines.join('\n')),
      positiveText: '确认保存',
      negativeText: '取消',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onClose: () => resolve(false),
    })
  })
}

async function onSave() {
  if (!form.name) {
    message.warning('请填写商品名称')
    return
  }
  if (!skuList.value.length) {
    message.warning('请先添加商品属性')
    return
  }
  if (!(form.base_unit || '').trim()) {
    message.warning('请填写基础单位')
    return
  }
  // 只提示不阻止：商品已上架但没有可展示的规格
  if (form.is_miniprogram && !skuList.value.some((s) => s.is_enabled && s.is_miniprogram)) {
    message.warning('商品已上架，但没有上架的规格，小程序不会展示')
  }
  const basicPayload = {
    name: form.name,
    category_id: form.category_id || null,
    brand: form.brand || null,
    shelf_life_days: form.shelf_life_days || null,
    description: form.description || null,
    main_images: form.main_images,
    detail_images: form.detail_images,
    sku_attributes: validAttrs(),
    status: form.status ?? 1,
    // 未选供应商时提交 0（后端语义：0=自己/自营）
    supplier_id: form.supplier_id || 0,
    is_miniprogram: !!form.is_miniprogram,
    base_unit: (form.base_unit || '').trim(),
  }
  const payload: SpuSavePayload = {
    ...basicPayload,
    code: form.code || `SPU-${Date.now()}`,
    skus: skuList.value.map(skuPayload),
  }
  saving.value = true
  try {
    if (isEdit.value && !(await confirmImpacts(await previewImpacts()))) return
    // 单请求保存：SPU 与其 SKU 一起提交，后端在单事务内同步；被引用的规格只停用不删除
    const result = isEdit.value
      ? await productApi.updateSpu(editId.value, payload)
      : await productApi.createSpu(payload)
    message.success('已保存')
    for (const w of result.warnings || []) message.warning(w.message)
    const affected = result.affected_customer_prices || []
    if (affected.length) {
      // 消息已发给归属销售和管理员；这里列出来方便当场决定调价还是保持不变
      await new Promise<void>((resolve) => {
        dialog.warning({
          title: `${affected.length} 个专属价已低于新的最低售价`,
          content: () => h('div', { style: 'max-height:320px;overflow:auto;line-height:1.7;font-size:13px' },
            affected.map((a) => h('div', `${a.customer_name}：专属价 ${a.price}，最低售价 ${a.min_price}`))),
          positiveText: '知道了',
          onPositiveClick: () => resolve(),
          onClose: () => resolve(),
        })
      })
    }
    router.push('/spus/list')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  categoryTree.value = await categoryApi.tree()
  // 供应商选项（GET /vendors）：加载失败不阻塞商品编辑，拦截器会提示错误
  // 供应商下拉需全量选项：统一 page_size=20 逐页拉取
  fetchAllPages((p) => vendorApi.list({ page: p, page_size: PAGE_SIZE })).then((list) => {
    supplierOptions.value = list.map((v) => ({ label: v.name, value: v.id }))
  }).catch(() => {})
  if (isEdit.value) {
    const spu = await productApi.spu(editId.value)
    Object.assign(form, JSON.parse(JSON.stringify(spu)))
    form.is_miniprogram = !!spu.is_miniprogram
    form.status = spu.status ?? 1
    form.supplier_id = spu.supplier_id || null
    form.base_unit = spu.base_unit || '斤'
    form.sku_attributes = (spu.sku_attributes || []).map((a) => ({ name: a.name, values: [...a.values] }))
    const skusList = await productApi.skus(editId.value)
    skuList.value = skusList.map((s) => ({
      id: s.id,
      specs: s.specs || {},
      cost_price: Number(s.cost_price) || 0,
      price_method: s.price_method || 'percent',
      price_value: Number(s.price_value) || 0,
      is_enabled: s.is_enabled !== false,
      is_miniprogram: !!s.is_miniprogram,
      base_qty: Number(s.base_qty) || 1,
      allow_decimal: !!s.allow_decimal,
      min_price_method: s.min_price_method || 'amount',
      min_price_value: Number(s.min_price_value) || 0,
      barcode: s.barcode || null,
      remark: s.remark || null,
    }))
    loadedPrices.clear()
    for (const r of skuList.value) if (r.id) loadedPrices.set(r.id, priceKey(r))
  } else {
    form.code = `SPU-${Date.now()}`
  }
})
</script>

<style scoped>
.header-actions { display: flex; align-items: center; gap: 8px; }
.create-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
.form-col, .media-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.section-title { margin: 0 0 16px; font-size: 16px; font-weight: 600; }
.attr-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.attr-values { flex: 1; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; min-width: 0; }
.attr-value-item { display: flex; align-items: center; gap: 2px; }
.sku-editor { display: flex; flex-direction: column; gap: 12px; }
.sku-card { padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-subtle); }
.sku-row { display: grid; gap: 10px; align-items: end; }
.sku-single-row { grid-template-columns: minmax(160px, 1.6fr) repeat(13, minmax(0, 1fr)); }
.sku-field { display: flex; min-width: 0; flex-direction: column; gap: 5px; }
.sku-label { overflow: hidden; color: var(--text-3); font-size: 12px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
.spec-tags { display: flex; min-height: 28px; flex-wrap: wrap; align-items: center; gap: 4px; }
.sku-field strong { display: flex; min-height: 28px; align-items: center; font-size: 13px; }
.cost-warning { color: #d97706; }
.suggested-price { color: #ea580c; }
.long-image-preview { margin-top: 16px; max-height: 560px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-subtle); }
.long-image-preview img { display: block; width: 100%; }
.long-image-empty { margin-top: 16px; padding: 24px; text-align: center; font-size: 13px; color: var(--text-3); border: 1px dashed var(--border); border-radius: 8px; }
/* 图片网格：可拖动排序 */
.img-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.img-item { position: relative; width: 128px; height: 128px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; cursor: grab; user-select: none; }
.img-item:active { cursor: grabbing; }
.img-item.dragging { opacity: 0.45; }
.img-item img { width: 100%; height: 100%; object-fit: cover; }
.img-badge { position: absolute; left: 0; top: 0; background: var(--primary); color: #fff; font-size: 11px; line-height: 1; padding: 3px 6px; border-radius: 0 0 6px 0; }
.img-remove { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; padding: 0; border: none; border-radius: 50%; background: rgba(0,0,0,0.55); color: #fff; font-size: 14px; line-height: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.img-remove:hover { background: rgba(220, 38, 38, 0.9); }
.img-add { width: 128px; height: 128px; border: 1px dashed #d1d5db; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--text-3); font-size: 12px; cursor: pointer; }
.img-add .plus { font-size: 26px; line-height: 1; }
.img-add:hover { border-color: var(--primary); color: var(--primary); }
.img-hint { margin-top: 8px; font-size: 12px; color: var(--text-3); }
@media (max-width: 900px) {
  .create-grid { grid-template-columns: 1fr; }
  .sku-single-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sku-specs { grid-column: 1 / -1; }
}
</style>
