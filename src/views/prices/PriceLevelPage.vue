<template>
  <div class="page-container">
    <!-- 等级列表 -->
    <div class="card-section" v-if="view === 'list'">
      <div class="page-header">
        <h2 class="page-title">等级价格</h2>
      </div>
      <n-alert type="info" :bordered="false" style="margin-bottom: 12px">
        点击等级行进入价格详情：可为该等级下每个 SKU 设置「建议零售价 ± 百分比 / ± 固定金额」规则，SKU 专属规则优先于等级默认规则。
      </n-alert>
      <n-data-table
        :columns="levelColumns"
        :data="levels"
        :loading="loading"
        size="small"
        :bordered="false"
        :row-key="(r: LevelStats) => r.id"
        :row-props="levelRowProps"
      />
    </div>

    <!-- 等级价格详情 -->
    <template v-else-if="currentLevel">
      <div class="card-section">
        <div class="page-header">
          <div style="display: flex; align-items: center; gap: 12px">
            <n-button size="small" @click="backToList">← 返回等级列表</n-button>
            <h2 class="page-title" style="margin: 0">{{ currentLevel.nickname }} · 等级价格详情</h2>
            <n-tag size="small" :bordered="false">{{ currentLevel.level_id }}</n-tag>
          </div>
          <n-button size="small" @click="openPreview">价格预览</n-button>
        </div>
        <n-descriptions :column="3" bordered size="small">
          <n-descriptions-item label="客户数">{{ currentLevel.customer_count }}</n-descriptions-item>
          <n-descriptions-item label="创建者">{{ currentLevel.created_by_name || (currentLevel.is_system ? '系统' : '—') }}</n-descriptions-item>
          <n-descriptions-item label="类型">{{ CUSTOMER_LEVEL_TYPE[currentLevel.type]?.label || currentLevel.type }}</n-descriptions-item>
        </n-descriptions>
      </div>

      <div class="card-section">
        <h3 class="page-title" style="margin-bottom: 12px">等级默认规则</h3>
        <n-alert type="info" :bordered="false" style="margin-bottom: 12px">
          默认规则作用于所有未单独设置价格的 SKU：等级价 = 建议零售价 ± 百分比 / ± 固定金额（负数下调，下限 0）。
        </n-alert>
        <div class="default-rule-bar">
          <n-tag v-if="!defaultRule" size="small" type="warning" :bordered="false">未设置（按建议零售价销售）</n-tag>
          <n-tag v-else size="small" type="primary" :bordered="false">已设置</n-tag>
          <n-select v-model:value="defaultMethod" :options="methodOptions" size="small" style="width: 170px" />
          <n-input-number v-model:value="defaultValue" size="small" :precision="2" style="width: 150px" />
          <span class="rule-hint">{{ defaultMethod === 'percent' ? '%（正数上浮，负数下调）' : '元（正数上加，负数下调）' }}</span>
          <n-button type="primary" size="small" :loading="saving" @click="saveDefault">保存默认规则</n-button>
          <n-button v-if="defaultRule" size="small" :loading="saving" @click="removeDefault">删除默认规则</n-button>
        </div>
      </div>

      <div class="card-section">
        <div class="page-header" style="margin-bottom: 12px">
          <h3 class="page-title">SKU 价格明细</h3>
          <n-input v-model:value="skuKeyword" clearable size="small" placeholder="搜索商品 / 规格" style="width: 220px" />
        </div>
        <n-data-table
          :columns="skuColumns"
          :data="pagedSkuRows"
          :loading="loading"
          size="small"
          :bordered="false"
          :row-key="(r: SkuRuleRow) => r.sku.id"
        />
        <div class="pagination-bar">
          <n-pagination v-model:page="page" :item-count="filteredSkuRows.length" :page-size="pageSize" />
        </div>
      </div>
    </template>

    <n-modal v-model:show="showPreview" preset="card" title="等级价格预览" style="width: 480px">
      <n-form label-placement="left" label-width="90">
        <n-form-item label="客户等级">
          <n-select :value="currentLevel?.id" :options="levelSelectOptions" disabled placeholder="" />
        </n-form-item>
        <n-form-item label="SKU">
          <n-select
            v-model:value="previewForm.sku_id"
            :options="allSkuOptions"
            clearable
            filterable
            placeholder="不选则按等级默认规则"
          />
        </n-form-item>
        <n-form-item label="建议零售价">
          <n-input-number v-model:value="previewForm.suggested_price" :precision="2" :min="0" style="width: 100%" placeholder="留空则取 SKU 建议价" />
        </n-form-item>
        <n-form-item label=" ">
          <n-button type="primary" size="small" :loading="previewing" @click="doPreview">计算</n-button>
        </n-form-item>
      </n-form>
      <n-descriptions v-if="previewResult" bordered :column="1" size="small" style="margin-top: 8px">
        <n-descriptions-item label="命中规则">{{ RULE_SOURCE[previewResult.rule_source] }}</n-descriptions-item>
        <n-descriptions-item label="建议零售价">¥{{ previewResult.suggested_price }}</n-descriptions-item>
        <n-descriptions-item label="等级价格">
          <span style="color: var(--primary); font-weight: 600">¥{{ previewResult.level_price }}</span>
        </n-descriptions-item>
      </n-descriptions>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, computed, onMounted } from 'vue'
import {
  NButton, NInput, NInputNumber, NSelect, NDataTable, NTag, useMessage, useDialog,
  type DataTableColumns,
} from 'naive-ui'
import { levelApi, levelPriceApi, productApi, fetchAllPages, PAGE_SIZE } from '@/api'
import { formatDate } from '@/utils/format'
import { PRICE_METHOD, RULE_SOURCE, CUSTOMER_LEVEL_TYPE } from '@/utils/dict'
import type {
  LevelStats, LevelPrice, LevelPriceRulePreview, PriceMethod, ProductSPU, ProductSKU,
} from '@/types'

const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const saving = ref(false)
const previewing = ref(false)

// 视图状态：list=等级列表，detail=某等级的 SKU 价格详情
const view = ref<'list' | 'detail'>('list')
const levels = ref<LevelStats[]>([])
const currentLevel = ref<LevelStats | null>(null)

const rules = ref<LevelPrice[]>([])
const spus = ref<ProductSPU[]>([])
const skus = ref<ProductSKU[]>([])

const methodOptions = [
  { label: PRICE_METHOD.percent, value: 'percent' },
  { label: PRICE_METHOD.amount, value: 'amount' },
]

// ---------- 等级列表 ----------
const levelRowProps = (row: LevelStats) => ({
  style: 'cursor: pointer',
  onClick: () => openDetail(row),
})

const levelColumns = computed<DataTableColumns<LevelStats>>(() => [
  { title: '等级编码', key: 'level_id', width: 110 },
  { title: '等级名称', key: 'nickname', width: 140, ellipsis: { tooltip: true } },
  {
    title: '类型', key: 'type', width: 90,
    render: (r) => h(NTag, { size: 'small', type: CUSTOMER_LEVEL_TYPE[r.type]?.type ?? 'default', bordered: false }, { default: () => CUSTOMER_LEVEL_TYPE[r.type]?.label || r.type }),
  },
  { title: '客户数', key: 'customer_count', width: 90 },
  { title: '创建者', key: 'created_by_name', width: 120, render: (r) => r.created_by_name || (r.is_system ? '系统' : '—') },
  {
    title: '状态', key: 'is_active', width: 90,
    render: (r) => h(NTag, { size: 'small', type: r.is_active === false ? 'error' : 'success', bordered: false }, { default: () => (r.is_active === false ? '已禁用' : '启用') }),
  },
  { title: '创建时间', key: 'created_at', width: 160, render: (r) => (r.created_at ? formatDate(r.created_at) : '—') },
  {
    title: '操作', key: 'actions', width: 110,
    render: (r) => h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openDetail(r) }, { default: () => '价格详情' }),
  },
])

async function loadLevels() {
  loading.value = true
  try {
    levels.value = await levelApi.stats()
  } finally {
    loading.value = false
  }
}

// ---------- 等级价格详情 ----------
interface SkuRuleRow {
  sku: ProductSKU
  rule: LevelPrice | null
  method: PriceMethod
  value: number
}

const skuRows = ref<SkuRuleRow[]>([])
const skuKeyword = ref('')
const page = ref(1)
const pageSize = PAGE_SIZE

const defaultRule = computed(() => rules.value.find((r) => r.sku_id == null) || null)
const defaultMethod = ref<PriceMethod>('percent')
const defaultValue = ref(0)

const spuMap = computed(() => new Map(spus.value.map((s) => [s.id, s])))

function specsText(sku: ProductSKU): string {
  if (sku.specs) {
    const vals = Object.values(sku.specs).filter(Boolean)
    if (vals.length) return vals.join(' / ')
  }
  return sku.remark || '—'
}

/** SKU 建议零售价（成本价 ± 百分比/固定金额，与建议价格页公式一致） */
function suggestedBase(sku: ProductSKU): number {
  const base = Number(sku.cost_price) || 0
  const value = Number(sku.price_value) || 0
  const raw = sku.price_method === 'amount' ? base + value : base * (1 + value / 100)
  return Math.max(raw, 0)
}

/** 等级价（仅展示用）：建议零售价 ± 规则的百分比/固定金额；无规则时等于建议零售价 */
function levelPriceOf(row: SkuRuleRow): number {
  const base = suggestedBase(row.sku)
  if (!row.rule) return base
  const raw = row.method === 'amount' ? base + row.value : base * (1 + row.value / 100)
  return Math.max(raw, 0)
}

function rebuildRows() {
  skuRows.value = skus.value.map((sku) => {
    const rule = rules.value.find((r) => r.sku_id === sku.id) || null
    return { sku, rule, method: rule?.price_method || 'percent', value: rule ? Number(rule.price_value) || 0 : 0 }
  })
}

function syncDefaultRule() {
  const dr = defaultRule.value
  defaultMethod.value = dr?.price_method || 'percent'
  defaultValue.value = dr ? Number(dr.price_value) || 0 : 0
}

function openDetail(row: LevelStats) {
  currentLevel.value = row
  view.value = 'detail'
  page.value = 1
  skuKeyword.value = ''
  loadDetail()
}

function backToList() {
  view.value = 'list'
  currentLevel.value = null
  loadLevels()
}

async function loadDetail() {
  if (!currentLevel.value) return
  loading.value = true
  try {
    const [ruleList, skuList, spuList] = await Promise.all([
      levelPriceApi.list({ level_id: currentLevel.value.id }),
      // SKU 明细需全量：统一 page_size=20 逐页拉取
      fetchAllPages((p) => productApi.allSkus({ page: p, page_size: PAGE_SIZE })),
      fetchAllPages((p) => productApi.spus({ page: p, page_size: PAGE_SIZE })),
    ])
    rules.value = ruleList
    skus.value = skuList
    spus.value = spuList
    syncDefaultRule()
    rebuildRows()
  } finally {
    loading.value = false
  }
}

async function reloadRules() {
  if (!currentLevel.value) return
  rules.value = await levelPriceApi.list({ level_id: currentLevel.value.id })
  syncDefaultRule()
  rebuildRows()
}

async function saveDefault() {
  if (!currentLevel.value) return
  saving.value = true
  try {
    await levelPriceApi.upsert(currentLevel.value.id, {
      sku_id: null,
      price_method: defaultMethod.value,
      price_value: defaultValue.value,
    })
    message.success('等级默认规则已保存')
    await reloadRules()
  } finally {
    saving.value = false
  }
}

function removeDefault() {
  if (!currentLevel.value) return
  dialog.warning({
    title: '删除默认规则',
    content: `确定删除「${currentLevel.value.nickname}」的等级默认规则？删除后该等级未单独设置的 SKU 按建议零售价销售。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await levelPriceApi.remove(currentLevel.value!.id)
      message.success('默认规则已删除')
      await reloadRules()
    },
  })
}

async function saveSkuRule(row: SkuRuleRow) {
  if (!currentLevel.value) return
  saving.value = true
  try {
    await levelPriceApi.upsert(currentLevel.value.id, {
      sku_id: row.sku.id,
      price_method: row.method,
      price_value: row.value,
    })
    message.success('SKU 价格规则已保存')
    await reloadRules()
  } finally {
    saving.value = false
  }
}

function removeSkuRule(row: SkuRuleRow) {
  if (!currentLevel.value) return
  dialog.warning({
    title: '清除专属规则',
    content: '确定清除该 SKU 的专属规则？清除后按等级默认规则 / 建议零售价计算。',
    positiveText: '清除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await levelPriceApi.remove(currentLevel.value!.id, { sku_id: row.sku.id })
      message.success('专属规则已清除')
      await reloadRules()
    },
  })
}

const filteredSkuRows = computed(() => {
  const kw = skuKeyword.value.trim().toLowerCase()
  if (!kw) return skuRows.value
  return skuRows.value.filter((row) => {
    const name = spuMap.value.get(row.sku.spu_id)?.name || ''
    return name.toLowerCase().includes(kw) || specsText(row.sku).toLowerCase().includes(kw)
  })
})

const pagedSkuRows = computed(() =>
  filteredSkuRows.value.slice((page.value - 1) * pageSize, page.value * pageSize),
)

const skuColumns = computed<DataTableColumns<SkuRuleRow>>(() => [
  {
    title: '商品', key: 'spu', minWidth: 160, ellipsis: { tooltip: true },
    render: (r) => spuMap.value.get(r.sku.spu_id)?.name || `SPU #${r.sku.spu_id}`,
  },
  { title: 'SKU 规格', key: 'specs', minWidth: 140, ellipsis: { tooltip: true }, render: (r) => specsText(r.sku) },
  {
    title: '建议零售价', key: 'base', width: 110,
    render: (r) => `¥${suggestedBase(r.sku).toFixed(2)}`,
  },
  {
    title: '规则来源', key: 'source', width: 100,
    render: (r) => {
      const label = r.rule ? 'SKU 专属' : defaultRule.value ? '等级默认' : '未设置'
      return h(NTag, { size: 'small', type: r.rule ? 'warning' : 'default', bordered: false }, { default: () => label })
    },
  },
  {
    title: '计算方式', key: 'method', width: 150,
    render: (r) => h(NSelect, {
      value: r.method,
      size: 'small',
      options: methodOptions,
      style: 'width: 130px',
      'onUpdate:value': (v: PriceMethod) => { r.method = v },
    }),
  },
  {
    title: '数值', key: 'value', width: 170,
    render: (r) => h('div', { style: 'display:flex;align-items:center;gap:4px' }, [
      h(NInputNumber, {
        value: r.value,
        size: 'small',
        precision: 2,
        style: 'width: 110px',
        'onUpdate:value': (v: number | null) => { r.value = v ?? 0 },
      }),
      h('span', { style: 'font-size:12px;color:var(--text-3)' }, r.method === 'percent' ? '%' : '元'),
    ]),
  },
  {
    title: '等级价', key: 'level_price', width: 110,
    render: (r) => h('span', { style: 'color:#ea580c;font-weight:600' }, `¥${levelPriceOf(r).toFixed(2)}`),
  },
  {
    title: '操作', key: 'actions', width: 150,
    render: (r) => h('div', { style: 'display:flex;gap:8px' }, [
      h(NButton, { size: 'small', text: true, type: 'primary', loading: saving.value, onClick: () => saveSkuRule(r) }, { default: () => '保存规则' }),
      r.rule ? h(NButton, { size: 'small', text: true, type: 'error', onClick: () => removeSkuRule(r) }, { default: () => '清除' }) : null,
    ]),
  },
])

// ---------- 价格预览 ----------
const showPreview = ref(false)
const previewForm = ref({ sku_id: null as number | null, suggested_price: null as number | null })
const previewResult = ref<LevelPriceRulePreview | null>(null)

const levelSelectOptions = computed(() =>
  currentLevel.value ? [{ label: currentLevel.value.nickname, value: currentLevel.value.id }] : [],
)

const allSkuOptions = computed(() =>
  skus.value.map((s) => {
    const spu = spuMap.value.get(s.spu_id)
    return { label: `${spu?.name || 'SKU'} ${specsText(s)}`.trim(), value: s.id }
  }),
)

function openPreview() {
  previewForm.value = { sku_id: null, suggested_price: null }
  previewResult.value = null
  showPreview.value = true
}

async function doPreview() {
  if (!currentLevel.value) return
  if (!previewForm.value.sku_id && (previewForm.value.suggested_price === null || previewForm.value.suggested_price === undefined)) {
    return message.warning('请选择 SKU 或填写建议零售价')
  }
  previewing.value = true
  try {
    previewResult.value = await levelPriceApi.preview(currentLevel.value.id, {
      sku_id: previewForm.value.sku_id ?? undefined,
      suggested_price: previewForm.value.suggested_price ?? undefined,
    })
  } finally {
    previewing.value = false
  }
}

onMounted(loadLevels)
</script>

<style scoped>
.default-rule-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rule-hint { font-size: 12px; color: var(--text-3); }
</style>
