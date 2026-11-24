<template>
  <div class="page-container product-create-page">
    <div class="page-header sticky-header">
      <div class="header-left">
        <h2 class="page-title">{{ isEdit ? '编辑商品' : '新建商品' }}</h2>
        <span v-if="form.code" class="header-sub">{{ form.code }}</span>
      </div>
      <div class="header-actions">
        <n-button size="small" @click="router.push('/spus/list')">取消</n-button>
        <n-button size="small" type="primary" :loading="saving" @click="onSave">保存商品</n-button>
      </div>
    </div>

    <div class="create-stack">
      <!-- 1. 基础信息：12 栏高密度栅格，2 行收口 -->
      <section class="card-section compact-card">
        <div class="section-head">
          <h3 class="section-title">基础信息</h3>
          <span class="section-tip">分类需选最末级；临时拿货商品需指定默认供应商</span>
        </div>
        <div class="base-grid">
          <div class="field-item span-5">
            <label class="field-label required">商品名称</label>
            <n-input v-model:value="form.name" size="small" placeholder="请输入商品标题，如 大红八角（箱装）" />
          </div>
          <div class="field-item span-3">
            <label class="field-label">SPU ID</label>
            <n-input v-model:value="form.code" size="small" placeholder="自定义编号，便于检索" />
          </div>
          <div class="field-item span-4">
            <label class="field-label">商品分类</label>
            <!-- 单选 n-cascader 的 value 是叶子分类 id（非路径数组），直接绑定 form.category_id -->
            <n-cascader
              v-model:value="form.category_id"
              :options="cascaderOptions"
              size="small"
              placeholder="选择最末级分类"
              clearable
              show-path
              style="width: 100%"
            />
          </div>

          <div class="field-item span-4">
            <label class="field-label">默认货源</label>
            <n-radio-group v-model:value="form.supply_mode" size="small" class="supply-radio-group">
              <n-radio-button value="self">店家自己（记库存）</n-radio-button>
              <n-radio-button value="temp_pick">临时拿货（记应付）</n-radio-button>
            </n-radio-group>
          </div>
          <div class="field-item span-4">
            <label class="field-label" :class="{ required: form.supply_mode === 'temp_pick' }">默认供应商</label>
            <n-select
              v-model:value="form.supplier_id"
              :options="supplierOptions"
              size="small"
              filterable
              :placeholder="form.supply_mode === 'temp_pick' ? '请选择同市场拿货供应商（必填）' : '不选则默认自营（0）'"
              clearable
            />
          </div>
          <div class="field-item span-2">
            <label class="field-label required">基础单位</label>
            <!-- 库存按基础单位计数；称重商品填"斤"，瓶装填"瓶"（04 §2.2） -->
            <n-auto-complete
              v-model:value="form.base_unit"
              :options="baseUnitOptions"
              size="small"
              placeholder="斤 / 个 / 瓶"
            />
          </div>
          <div class="field-item span-2">
            <label class="field-label">上架小程序</label>
            <div class="switch-inline">
              <n-switch v-model:value="form.is_miniprogram" size="small" />
              <span class="switch-text" :class="{ active: form.is_miniprogram }">
                {{ form.is_miniprogram ? '已上架' : '未上架' }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. 规格与定价：商品属性 + SKU 紧凑表格一体 -->
      <section class="card-section compact-card">
        <div class="section-head">
          <div class="section-head-left">
            <h3 class="section-title">规格与定价</h3>
            <n-tag size="small" :bordered="false" type="info">{{ skuList.length }} 个 SKU</n-tag>
          </div>
          <span class="section-tip">输入属性值按回车继续添加，自动按笛卡尔积生成 SKU；预估价仅供参考，保存后以服务端为准</span>
        </div>

        <div class="attr-box">
          <div v-for="(attr, i) in form.sku_attributes" :key="i" class="attr-row">
            <n-input
              v-model:value="attr.name"
              size="small"
              placeholder="属性名，如 规格"
              class="attr-name-input"
              @keyup.enter="focusValue(i as number, 0)"
            />
            <span class="attr-colon">:</span>
            <div class="attr-values">
              <div v-for="(v, vi) in attr.values" :key="vi" class="attr-value-item">
                <n-input
                  :ref="(el: any) => setValueRef(i as number, vi as number, el)"
                  v-model:value="attr.values[vi]"
                  size="small"
                  placeholder="属性值，如 1斤"
                  class="attr-val-input"
                  @keyup.enter="focusValue(i as number, (vi as number) + 1)"
                />
                <!-- 末尾空白值是待输入框，不显示删除 -->
                <button
                  v-if="(v || '').trim()"
                  type="button"
                  class="attr-val-del"
                  title="删除属性值"
                  @click="removeValue(i as number, vi as number)"
                >×</button>
              </div>
            </div>
            <!-- 末尾空白属性行是待输入行，不显示移除 -->
            <n-button
              v-if="attr.name?.trim() || (attr.values || []).some((v: string) => v.trim()) || i !== form.sku_attributes.length - 1"
              text
              size="small"
              type="error"
              @click="removeAttribute(i as number)"
            >移除</n-button>
          </div>
        </div>

        <div v-if="skuList.length" class="sku-table">
          <div class="sku-thead">
            <span>规格</span>
            <span>换算 / 小数</span>
            <span>成本价</span>
            <span>建议售价规则</span>
            <span>最低售价规则</span>
            <span>条码</span>
            <span>状态</span>
          </div>
          <div v-for="sku in skuList" :key="JSON.stringify(sku.specs)" class="sku-tr">
            <div class="sku-cell cell-specs">
              <div class="spec-tags">
                <n-tag v-for="(value, key) in sku.specs" :key="key" size="small" :bordered="false">
                  {{ key }}：{{ value }}
                </n-tag>
              </div>
            </div>

            <div class="sku-cell">
              <div class="unit-input-wrap">
                <n-input-number v-model:value="sku.base_qty" :precision="1" :min="0.1" :show-button="false" size="small" />
                <span class="unit-suffix">{{ form.base_unit || '基础' }}</span>
              </div>
              <label class="cell-sub-toggle">
                <n-switch v-model:value="sku.allow_decimal" size="small" />
                <span>允许小数</span>
              </label>
            </div>

            <div class="sku-cell">
              <n-input-number v-model:value="sku.cost_price" :precision="2" :min="0" :show-button="false" size="small" placeholder="成本价">
                <template #prefix>¥</template>
              </n-input-number>
              <div class="cell-sub-metric" :class="{ 'cost-warning': costMismatch }">
                折合 ¥{{ costPerBase(sku).toFixed(2) }}/{{ form.base_unit || '单位' }}
              </div>
            </div>

            <div class="sku-cell">
              <div class="price-combo">
                <n-select v-model:value="sku.price_method" :options="priceMethodOpts" size="small" class="method-select" />
                <n-input-number v-model:value="sku.price_value" :precision="2" :show-button="false" size="small" class="val-input" />
              </div>
              <div class="cell-sub-metric suggested-price">
                预估 ¥{{ calcDefaultPrice(sku).toFixed(2) }}
              </div>
            </div>

            <div class="sku-cell">
              <div class="price-combo">
                <n-select v-model:value="sku.min_price_method" :options="priceMethodOpts" size="small" class="method-select" />
                <n-input-number v-model:value="sku.min_price_value" :precision="2" :show-button="false" size="small" class="val-input" />
              </div>
              <div class="cell-sub-metric">
                最低 ¥{{ calcMinPrice(sku).toFixed(2) }}
              </div>
            </div>

            <div class="sku-cell">
              <n-input
                :value="sku.barcode ?? ''"
                maxlength="50"
                placeholder="扫码枪录入"
                size="small"
                @update:value="sku.barcode = $event.trim() || null"
              />
            </div>

            <div class="sku-cell cell-status">
              <label class="cell-sub-toggle">
                <n-switch v-model:value="sku.is_enabled" size="small" />
                <span>{{ sku.is_enabled ? '启用' : '停用' }}</span>
              </label>
              <label class="cell-sub-toggle">
                <n-switch v-model:value="sku.is_miniprogram" size="small" />
                <span>小程序</span>
              </label>
            </div>
          </div>
        </div>
        <div v-else class="sku-empty-bar">在上方输入商品属性名与属性值后，这里将自动生成 SKU 行</div>

        <n-alert v-if="costMismatch" type="warning" :bordered="false" class="cost-alert">
          各规格折合每基础单位的成本相差超过 30%，请确认换算数量没有填错（不阻止保存）。
        </n-alert>
      </section>

      <!-- 3. 商品图片：左右并排双栏 -->
      <section class="media-grid">
        <div class="card-section compact-card">
          <div class="section-head">
            <h3 class="section-title">主图上传（{{ form.main_images.length }}/5）</h3>
            <span class="section-tip">拖动排序，首张为封面</span>
          </div>
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
              <div class="img-add"><span class="plus">＋</span><span>上传主图</span></div>
            </n-upload>
          </div>
        </div>

        <div class="card-section compact-card">
          <div class="section-head">
            <h3 class="section-title">详情图上传（{{ form.detail_images.length }}/10）</h3>
            <div class="section-head-right">
              <span class="section-tip">拖动调整拼接顺序</span>
              <n-button v-if="form.detail_images.length" text size="small" type="primary" @click="showDetailPreview = true">
                预览长图
              </n-button>
            </div>
          </div>
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
              <div class="img-add"><span class="plus">＋</span><span>上传详情图</span></div>
            </n-upload>
          </div>
        </div>
      </section>
    </div>

    <n-modal v-model:show="showDetailPreview" preset="card" title="详情长图预览" style="width: 460px; max-width: 92vw">
      <div class="long-image-preview">
        <img v-for="url in form.detail_images" :key="url" :src="url" alt="详情图" />
      </div>
    </n-modal>
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
const showDetailPreview = ref(false)
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
  supply_mode: 'self' as 'self' | 'temp_pick',
  supplier_id: null as number | null,
  main_images: [] as string[],
  detail_images: [] as string[],
  sku_attributes: [{ name: '', values: [''] }] as { name: string; values: string[] }[],
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
  if (form.supply_mode === 'temp_pick' && !form.supplier_id) {
    message.warning('默认货源为「临时拿货」时，必须设置默认供应商')
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
    sku_attributes: validAttrs(),
    status: form.status ?? 1,
    supply_mode: form.supply_mode,
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
    form.supply_mode = spu.supply_mode || 'self'
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
.product-create-page { display: flex; flex-direction: column; gap: 12px; }
.sticky-header {
  position: sticky; top: 0; z-index: 10;
  margin-bottom: 0; padding: 10px 16px;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
}
.header-left { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.header-sub { font-size: 12px; color: var(--text-3); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.header-actions { display: flex; align-items: center; gap: 8px; }

.create-stack { display: flex; flex-direction: column; gap: 12px; }
.compact-card { padding: 14px 16px; margin-bottom: 0; }

.section-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap; margin-bottom: 12px;
}
.section-head-left, .section-head-right { display: flex; align-items: center; gap: 8px; }
.section-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--text-1); }
.section-tip { font-size: 12px; color: var(--text-3); }

/* 1. 基础信息：12 栏高密度栅格 */
.base-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 10px 14px;
  align-items: end;
}
.field-item { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.span-2 { grid-column: span 2; }
.span-3 { grid-column: span 3; }
.span-4 { grid-column: span 4; }
.span-5 { grid-column: span 5; }
.field-label { font-size: 12px; font-weight: 500; color: var(--text-2); line-height: 18px; }
.field-label.required::after { content: ' *'; color: #dc2626; }
.supply-radio-group { display: flex; width: 100%; }
.supply-radio-group :deep(.n-radio-button) { flex: 1; text-align: center; padding: 0 8px; }
.switch-inline {
  display: flex; align-items: center; gap: 8px;
  height: 28px; padding: 0 10px;
  border: 1px solid var(--border); border-radius: 6px; background: var(--bg-subtle);
}
.switch-text { font-size: 12px; color: var(--text-3); }
.switch-text.active { color: var(--primary); font-weight: 500; }

/* 2. 商品属性（紧凑行内框） */
.attr-box {
  padding: 10px 12px; margin-bottom: 12px;
  border: 1px solid var(--border); border-radius: 8px; background: var(--bg-subtle);
  display: flex; flex-direction: column; gap: 8px;
}
.attr-row { display: flex; align-items: center; gap: 8px; }
.attr-name-input { width: 128px; flex: none; }
.attr-colon { color: var(--text-3); font-weight: 600; flex: none; }
.attr-values { flex: 1; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-width: 0; }
.attr-value-item { position: relative; display: flex; align-items: center; }
.attr-val-input { width: 118px; }
.attr-val-del {
  position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
  width: 16px; height: 16px; padding: 0; border: 0; border-radius: 50%;
  background: transparent; color: var(--text-3); font-size: 13px; line-height: 1;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.attr-val-del:hover { background: rgba(220, 38, 38, 0.12); color: #dc2626; }

/* SKU 紧凑表格（7 列，统一表头） */
.sku-table {
  border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
}
.sku-thead, .sku-tr {
  display: grid;
  grid-template-columns:
    minmax(110px, 1.15fr)
    minmax(120px, 1fr)
    minmax(125px, 1.05fr)
    minmax(175px, 1.45fr)
    minmax(175px, 1.45fr)
    minmax(115px, 1fr)
    minmax(92px, 0.8fr);
  gap: 10px;
  align-items: start;
  padding: 8px 12px;
}
.sku-thead {
  background: var(--bg-subtle); border-bottom: 1px solid var(--border);
  font-size: 12px; font-weight: 600; color: var(--text-2);
}
.sku-tr { border-top: 1px solid var(--border); background: var(--bg-card); }
.sku-tr:first-of-type { border-top: 0; }
.sku-tr:hover { background: var(--bg-subtle); }
.sku-cell { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.cell-specs { padding-top: 2px; }
.spec-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.unit-input-wrap { display: flex; align-items: center; gap: 4px; }
.unit-input-wrap :deep(.n-input-number) { flex: 1; min-width: 0; }
.unit-suffix { font-size: 12px; color: var(--text-3); white-space: nowrap; }
.price-combo { display: flex; gap: 4px; }
.method-select { width: 88px; flex: none; }
.val-input { flex: 1; min-width: 0; }
.cell-sub-metric {
  font-size: 11px; color: var(--text-3); line-height: 16px;
  font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cell-sub-toggle {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; color: var(--text-2); cursor: pointer; user-select: none; line-height: 18px;
}
.cell-status { gap: 6px; padding-top: 2px; }
.cost-warning { color: #d97706; font-weight: 600; }
.suggested-price { color: #ea580c; font-weight: 600; }
.sku-empty-bar {
  padding: 18px 12px; text-align: center; font-size: 13px; color: var(--text-3);
  border: 1px dashed var(--border); border-radius: 8px;
}
.cost-alert { margin-top: 10px; }

/* 3. 商品图片：左右并排双栏 */
.media-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.45fr);
  gap: 12px;
  align-items: start;
}
.img-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.img-item {
  position: relative; width: 88px; height: 88px;
  border: 1px solid var(--border); border-radius: 8px;
  overflow: hidden; cursor: grab; user-select: none;
}
.img-item:active { cursor: grabbing; }
.img-item.dragging { opacity: 0.45; }
.img-item img { width: 100%; height: 100%; object-fit: cover; }
.img-badge {
  position: absolute; left: 0; top: 0;
  background: var(--primary); color: #fff;
  font-size: 10px; line-height: 1; padding: 3px 5px; border-radius: 0 0 6px 0;
}
.img-remove {
  position: absolute; top: 3px; right: 3px;
  width: 20px; height: 20px; padding: 0; border: none; border-radius: 50%;
  background: rgba(0, 0, 0, 0.55); color: #fff; font-size: 13px; line-height: 1;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.img-remove:hover { background: rgba(220, 38, 38, 0.9); }
.img-add {
  width: 88px; height: 88px;
  border: 1px dashed var(--border); border-radius: 8px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; color: var(--text-3); font-size: 11px; cursor: pointer;
}
.img-add .plus { font-size: 22px; line-height: 1; }
.img-add:hover { border-color: var(--primary); color: var(--primary); }
.long-image-preview {
  max-height: 68vh; overflow-y: auto;
  border: 1px solid var(--border); border-radius: 8px; background: var(--bg-subtle);
}
.long-image-preview img { display: block; width: 100%; }

@media (max-width: 1180px) {
  .base-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .span-5, .span-4, .span-3 { grid-column: span 3; }
  .span-2 { grid-column: span 2; }
  .sku-thead { display: none; }
  .sku-tr { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 12px; }
  .cell-specs { grid-column: 1 / -1; }
  .media-grid { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .base-grid { grid-template-columns: 1fr; }
  .span-5, .span-4, .span-3, .span-2 { grid-column: span 1; }
  .sku-tr { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
