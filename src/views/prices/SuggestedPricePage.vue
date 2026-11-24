<template>
  <div class="page-container list-page suggested-price-page">
    <!-- 顶部筛选与批量操作栏 -->
    <div class="card-section toolbar-card">
      <div class="toolbar-row">
        <div class="filter-bar">
          <n-cascader
            v-model:value="categoryPath"
            :options="categoryOptions"
            clearable
            size="small"
            placeholder="选择商品分类"
            style="width: 240px"
            @update:value="handleFilterChange"
          />
          <n-input
            v-model:value="keyword"
            clearable
            size="small"
            placeholder="搜索商品名称 / 编码"
            style="width: 220px"
            @keyup.enter="handleFilterChange"
            @clear="handleFilterChange"
          />
          <n-button type="primary" size="small" @click="handleFilterChange">查询</n-button>
          <n-button size="small" @click="handleResetFilters">重置</n-button>
        </div>

        <div class="toolbar-actions">
          <n-button
            v-if="rows.length"
            size="small"
            quaternary
            @click="toggleAllCards"
          >
            {{ allCollapsed ? '全部展开' : '全部收起' }}
          </n-button>
          <span v-if="dirtyCount > 0" class="dirty-badge">
            <span class="dirty-dot" />
            {{ dirtyCount }} 项未保存
          </span>
          <n-button
            v-if="dirtyCount > 0"
            size="small"
            :disabled="savingAll"
            @click="revertAll"
          >
            撤销修改
          </n-button>
          <n-button
            type="primary"
            size="small"
            :disabled="dirtyCount === 0"
            :loading="savingAll"
            @click="saveAll"
          >
            {{ dirtyCount > 0 ? `全部保存 (${dirtyCount})` : '全部保存' }}
          </n-button>
        </div>
      </div>
      <div class="toolbar-tip">
        所有商品已自动展开，可直接修改成本价与加价规则并实时预览建议零售价；编辑完成后点击「全部保存」一次性提交。
      </div>
    </div>

    <!-- SPU 卡片列表 -->
    <n-spin :show="loading">
      <div v-if="!loading && !rows.length" class="card-section empty-wrap">
        <n-empty description="暂无符合条件的商品" />
      </div>

      <div v-else class="spu-card-list">
        <section
          v-for="spu in rows"
          :key="spu.id"
          class="spu-card"
          :class="{ 'is-dirty': spuDirtyCount(spu.id) > 0 }"
        >
          <!-- SPU 卡片头部 -->
          <header class="spu-card-header" @click="toggleCard(spu.id)">
            <div class="spu-header-left">
              <span class="collapse-arrow" :class="{ collapsed: isCollapsed(spu.id) }">▾</span>
              <span class="spu-name" :title="spu.name">{{ spu.name }}</span>
              <span class="spu-code">{{ spu.code }}</span>
              <n-tag size="small" :bordered="false" class="spu-cat-tag">
                {{ categoryPathMap[spu.category_id ?? 0] || '未分类' }}
              </n-tag>
              <n-tag size="small" :bordered="false" type="info">
                {{ (skuMap[spu.id] || []).length }} 个规格
              </n-tag>
              <n-tag
                v-if="spuDirtyCount(spu.id) > 0"
                size="small"
                :bordered="false"
                type="warning"
              >
                已改 {{ spuDirtyCount(spu.id) }} 项
              </n-tag>
            </div>
            <div class="spu-header-right" @click.stop>
              <n-button
                v-if="spuDirtyCount(spu.id) > 0"
                size="tiny"
                type="primary"
                secondary
                :loading="savingAll"
                @click="saveSpuSkus(spu.id)"
              >
                保存本商品
              </n-button>
            </div>
          </header>

          <!-- SPU 卡片主体：SKU 价格编辑列表 -->
          <div v-show="!isCollapsed(spu.id)" class="spu-card-body">
            <div v-if="!(skuMap[spu.id] && skuMap[spu.id].length)" class="sku-empty">
              该商品暂无 SKU
            </div>
            <div v-else class="sku-table-scroll">
              <div class="sku-grid sku-grid-head">
                <div>SKU 规格</div>
                <div>成本价 (元)</div>
                <div>计算方式</div>
                <div>加价数值</div>
                <div class="col-right">最低售价</div>
                <div class="col-right">建议零售价</div>
                <div class="col-center">操作</div>
              </div>

              <div
                v-for="sku in skuMap[spu.id]"
                :key="sku.id"
                class="sku-grid sku-grid-row"
                :class="{ 'row-dirty': isSkuDirty(sku) }"
              >
                <!-- 规格信息 -->
                <div class="sku-spec-cell">
                  <div class="sku-spec-name">{{ specsLabel(sku) }}</div>
                  <div v-if="skuSubText(sku)" class="sku-spec-sub">{{ skuSubText(sku) }}</div>
                </div>

                <!-- 成本价 -->
                <div>
                  <n-input-number
                    :value="sku.cost_price"
                    size="small"
                    :precision="2"
                    :min="0"
                    :show-button="false"
                    style="width: 100%"
                    @update:value="(v) => { sku.cost_price = v ?? 0 }"
                  >
                    <template #prefix>
                      <span class="input-affix">¥</span>
                    </template>
                  </n-input-number>
                </div>

                <!-- 计算方式 -->
                <div>
                  <n-select
                    :value="sku.price_method"
                    size="small"
                    :options="priceMethodOptions"
                    style="width: 100%"
                    @update:value="(v: PriceMethod) => { sku.price_method = v }"
                  />
                </div>

                <!-- 加价数值 -->
                <div>
                  <n-input-number
                    :value="sku.price_value"
                    size="small"
                    :precision="2"
                    :show-button="false"
                    style="width: 100%"
                    @update:value="(v) => { sku.price_value = v ?? 0 }"
                  >
                    <template #suffix>
                      <span class="input-affix">{{ sku.price_method === 'amount' ? '元' : '%' }}</span>
                    </template>
                  </n-input-number>
                </div>

                <!-- 最低售价（服务端下发只读） -->
                <div class="col-right min-price-cell">
                  {{ sku.min_price != null && sku.min_price !== '' ? formatMoney(sku.min_price) : '—' }}
                </div>

                <!-- 建议零售价实时预览 -->
                <div class="col-right suggested-price-cell">
                  <span class="suggested-price-val">¥{{ suggestedPrice(sku).toFixed(2) }}</span>
                  <span v-if="hasSuggestedDiff(sku)" class="suggested-price-old">
                    原 ¥{{ originalSuggestedPrice(sku).toFixed(2) }}
                  </span>
                </div>

                <!-- 单行操作 -->
                <div class="col-center row-actions">
                  <template v-if="isSkuDirty(sku)">
                    <n-button
                      size="tiny"
                      type="primary"
                      :loading="savingSkuIds.has(sku.id) || savingAll"
                      @click="saveSku(sku)"
                    >
                      保存
                    </n-button>
                    <n-button
                      size="tiny"
                      quaternary
                      :disabled="savingSkuIds.has(sku.id) || savingAll"
                      @click="revertSku(sku)"
                    >
                      撤销
                    </n-button>
                  </template>
                  <span v-else class="synced-text">已同步</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </n-spin>

    <!-- 底部固定汇总与翻页栏 -->
    <div class="pagination-bar">
      <div class="footer-left">
        <span>共 {{ total }} 个商品</span>
        <template v-if="dirtyCount > 0">
          <span class="footer-sep">·</span>
          <span class="footer-dirty-text">{{ dirtyCount }} 项修改未保存</span>
          <n-button
            type="primary"
            size="small"
            :loading="savingAll"
            @click="saveAll"
          >
            全部保存 ({{ dirtyCount }})
          </n-button>
        </template>
      </div>
      <n-pagination
        :page="page"
        :item-count="total"
        :page-size="pageSize"
        @update:page="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import { productApi, categoryApi, PAGE_SIZE } from '@/api'
import { calcSuggestedPrice, formatMoney } from '@/utils/format'
import type { Category, ProductSKU, ProductSPU, PriceMethod } from '@/types'

interface SkuSnapshot {
  cost_price: number
  price_method: PriceMethod
  price_value: number
}

const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const savingAll = ref(false)
const savingSkuIds = ref<Set<number>>(new Set())
const page = ref(1)
const pageSize = PAGE_SIZE
const keyword = ref('')
const categoryPath = ref<string | number | null>(null)
const categoryTree = ref<Category[]>([])
const rows = ref<ProductSPU[]>([])
const total = ref(0)
const skuMap = ref<Record<number, ProductSKU[]>>({})
const originalMap = ref<Record<number, SkuSnapshot>>({})
/** 默认全部展开；仅记录被手动折叠的 SPU id */
const collapsedIds = ref<Set<number>>(new Set())

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
  return categoryPath.value == null ? null : Number(categoryPath.value)
}

function normalizeSku(sku: ProductSKU): ProductSKU {
  return {
    ...sku,
    cost_price: Number(sku.cost_price) || 0,
    price_method: (sku.price_method || 'percent') as PriceMethod,
    price_value: Number(sku.price_value) || 0,
  }
}

function snapshotOf(sku: ProductSKU): SkuSnapshot {
  return {
    cost_price: Number(sku.cost_price) || 0,
    price_method: (sku.price_method || 'percent') as PriceMethod,
    price_value: Number(sku.price_value) || 0,
  }
}

function isSkuDirty(sku: ProductSKU): boolean {
  const orig = originalMap.value[sku.id]
  if (!orig) return false
  return (
    Math.abs((Number(sku.cost_price) || 0) - orig.cost_price) > 1e-6 ||
    (sku.price_method || 'percent') !== orig.price_method ||
    Math.abs((Number(sku.price_value) || 0) - orig.price_value) > 1e-6
  )
}

const dirtySkus = computed<ProductSKU[]>(() => {
  const list: ProductSKU[] = []
  for (const spu of rows.value) {
    for (const sku of skuMap.value[spu.id] || []) {
      if (isSkuDirty(sku)) list.push(sku)
    }
  }
  return list
})

const dirtyCount = computed(() => dirtySkus.value.length)

function spuDirtyCount(spuId: number): number {
  const skus = skuMap.value[spuId] || []
  let count = 0
  for (const sku of skus) {
    if (isSkuDirty(sku)) count++
  }
  return count
}

function suggestedPrice(sku: ProductSKU): number {
  return calcSuggestedPrice(sku)
}

function originalSuggestedPrice(sku: ProductSKU): number {
  const orig = originalMap.value[sku.id]
  return orig ? calcSuggestedPrice(orig) : calcSuggestedPrice(sku)
}

function hasSuggestedDiff(sku: ProductSKU): boolean {
  if (!isSkuDirty(sku)) return false
  return Math.abs(suggestedPrice(sku) - originalSuggestedPrice(sku)) > 0.004
}

function specsLabel(sku: ProductSKU): string {
  if (sku.specs) {
    const vals = Object.values(sku.specs).filter(Boolean)
    if (vals.length) return vals.join(' / ')
  }
  return sku.remark || '默认规格'
}

function skuSubText(sku: ProductSKU): string {
  const parts: string[] = []
  if (sku.barcode) parts.push(`条码 ${sku.barcode}`)
  if (sku.remark && sku.specs && Object.values(sku.specs).filter(Boolean).length) {
    parts.push(sku.remark)
  }
  return parts.join(' · ')
}

function isCollapsed(spuId: number): boolean {
  return collapsedIds.value.has(spuId)
}

function toggleCard(spuId: number) {
  const next = new Set(collapsedIds.value)
  if (next.has(spuId)) next.delete(spuId)
  else next.add(spuId)
  collapsedIds.value = next
}

const allCollapsed = computed(() =>
  rows.value.length > 0 && rows.value.every((spu) => collapsedIds.value.has(spu.id)),
)

function toggleAllCards() {
  if (allCollapsed.value) {
    collapsedIds.value = new Set()
  } else {
    collapsedIds.value = new Set(rows.value.map((r) => r.id))
  }
}

function confirmDiscardIfDirty(action: () => void) {
  if (dirtyCount.value === 0) {
    action()
    return
  }
  dialog.warning({
    title: '有未保存的修改',
    content: `当前页有 ${dirtyCount.value} 个 SKU 的价格修改尚未保存，继续操作将丢失这些修改，是否继续？`,
    positiveText: '放弃修改并继续',
    negativeText: '取消',
    onPositiveClick: action,
  })
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
    collapsedIds.value = new Set()
    await loadPageSkus()
  } finally {
    loading.value = false
  }
}

/** 加载当前页各 SPU 的 SKU，并建立原始快照 */
async function loadPageSkus() {
  const entries = await Promise.all(rows.value.map(async (row) => [row.id, await productApi.skus(row.id)] as const))
  const map: Record<number, ProductSKU[]> = {}
  const orig: Record<number, SkuSnapshot> = {}
  for (const [id, skus] of entries) {
    const normalized = skus.map(normalizeSku)
    map[id] = normalized
    for (const s of normalized) {
      orig[s.id] = snapshotOf(s)
    }
  }
  skuMap.value = map
  originalMap.value = orig
}

function handleFilterChange() {
  confirmDiscardIfDirty(() => {
    page.value = 1
    reload()
  })
}

function handleResetFilters() {
  confirmDiscardIfDirty(() => {
    keyword.value = ''
    categoryPath.value = null
    page.value = 1
    skuMap.value = {}
    originalMap.value = {}
    reload()
  })
}

function handlePageChange(nextPage: number) {
  if (nextPage === page.value) return
  confirmDiscardIfDirty(() => {
    page.value = nextPage
    reload()
  })
}

function applySavedSku(target: ProductSKU, updated?: ProductSKU) {
  if (updated) {
    target.cost_price = Number(updated.cost_price) || 0
    target.price_method = (updated.price_method || 'percent') as PriceMethod
    target.price_value = Number(updated.price_value) || 0
    if (updated.suggested_price !== undefined) target.suggested_price = updated.suggested_price
    if (updated.min_price !== undefined) target.min_price = updated.min_price
  }
  originalMap.value = {
    ...originalMap.value,
    [target.id]: snapshotOf(target),
  }
}

function revertSku(sku: ProductSKU) {
  const orig = originalMap.value[sku.id]
  if (!orig) return
  sku.cost_price = orig.cost_price
  sku.price_method = orig.price_method
  sku.price_value = orig.price_value
}

function revertAll() {
  for (const sku of dirtySkus.value) {
    revertSku(sku)
  }
  message.info('已撤销当前页未保存的修改')
}

async function saveSku(sku: ProductSKU) {
  const nextSet = new Set(savingSkuIds.value)
  nextSet.add(sku.id)
  savingSkuIds.value = nextSet
  try {
    const updated = await productApi.updateSku(sku.id, {
      cost_price: Number(sku.cost_price) || 0,
      price_method: sku.price_method || 'percent',
      price_value: Number(sku.price_value) || 0,
    })
    applySavedSku(sku, updated)
    message.success('建议价格已保存')
  } finally {
    const after = new Set(savingSkuIds.value)
    after.delete(sku.id)
    savingSkuIds.value = after
  }
}

async function saveBatch(targets: ProductSKU[]) {
  if (!targets.length) return
  savingAll.value = true
  let okCount = 0
  let failCount = 0
  try {
    // 分批并发（每批 6 个），兼顾速度与接口压力
    const batchSize = 6
    for (let i = 0; i < targets.length; i += batchSize) {
      const chunk = targets.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        chunk.map(async (sku) => {
          const updated = await productApi.updateSku(sku.id, {
            cost_price: Number(sku.cost_price) || 0,
            price_method: sku.price_method || 'percent',
            price_value: Number(sku.price_value) || 0,
          })
          return { sku, updated }
        }),
      )
      for (const res of results) {
        if (res.status === 'fulfilled') {
          applySavedSku(res.value.sku, res.value.updated)
          okCount++
        } else {
          failCount++
        }
      }
    }
    if (failCount === 0) {
      message.success(`已成功保存 ${okCount} 个 SKU 的建议价格`)
    } else if (okCount > 0) {
      message.warning(`已保存 ${okCount} 个，${failCount} 个保存失败，请重试`)
    } else {
      message.error(`保存失败（${failCount} 个），请稍后重试`)
    }
  } finally {
    savingAll.value = false
  }
}

function saveSpuSkus(spuId: number) {
  const targets = (skuMap.value[spuId] || []).filter(isSkuDirty)
  saveBatch(targets)
}

function saveAll() {
  saveBatch([...dirtySkus.value])
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
.suggested-price-page {
  gap: 12px;
}

.toolbar-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-tip {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
}

.dirty-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: var(--warning);
  background: rgba(234, 88, 12, 0.1);
}

.dirty-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--warning);
}

.empty-wrap {
  padding: 48px 16px;
}

.spu-card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.spu-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.spu-card.is-dirty {
  border-color: var(--warning);
  box-shadow: 0 0 0 1px rgba(234, 88, 12, 0.12), var(--shadow-card);
}

.spu-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  user-select: none;
}

.spu-card-header:hover {
  background: var(--bg-hover);
}

.spu-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.spu-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.collapse-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: var(--text-3);
  font-size: 12px;
  transition: transform 0.18s ease;
}

.collapse-arrow.collapsed {
  transform: rotate(-90deg);
}

.spu-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}

.spu-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: var(--text-3);
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--bg-card);
  border: 1px solid var(--border);
}

.spu-cat-tag {
  color: var(--text-2);
}

.spu-card-body {
  background: var(--bg-card);
}

.sku-empty {
  padding: 16px 20px;
  font-size: 13px;
  color: var(--text-3);
}

.sku-table-scroll {
  overflow-x: auto;
}

.sku-grid {
  display: grid;
  grid-template-columns: minmax(170px, 1.5fr) 128px 146px 132px 104px 136px 116px;
  align-items: center;
  gap: 12px;
  min-width: 860px;
  padding: 0 16px;
}

.sku-grid-head {
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  border-bottom: 1px solid var(--border);
}

.sku-grid-row {
  position: relative;
  padding-top: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
  transition: background-color 0.15s ease;
}

.sku-grid-row:last-child {
  border-bottom: none;
}

.sku-grid-row:hover {
  background: var(--bg-hover);
}

.sku-grid-row.row-dirty {
  background: rgba(234, 88, 12, 0.05);
}

.sku-grid-row.row-dirty::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--warning);
}

.sku-spec-cell {
  min-width: 0;
}

.sku-spec-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
  word-break: break-word;
}

.sku-spec-sub {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.input-affix {
  font-size: 12px;
  color: var(--text-3);
}

.col-right {
  text-align: right;
}

.col-center {
  text-align: center;
}

.min-price-cell {
  font-size: 13px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}

.suggested-price-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
}

.suggested-price-val {
  font-size: 15px;
  font-weight: 700;
  color: var(--warning);
}

.suggested-price-old {
  font-size: 11px;
  color: var(--text-3);
  text-decoration: line-through;
  margin-top: 2px;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.synced-text {
  font-size: 12px;
  color: var(--text-3);
}

.footer-left {
  margin-right: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer-sep {
  color: var(--border);
}

.footer-dirty-text {
  color: var(--warning);
  font-weight: 500;
}
</style>
