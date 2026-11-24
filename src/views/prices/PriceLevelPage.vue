<template>
  <div class="page-container">
    <!-- 等级列表 -->
    <div class="card-section" v-if="view === 'list'">
      <div class="page-header">
        <h2 class="page-title">等级价格</h2>
        <div class="header-actions">
          <n-button type="primary" @click="openCreateLevel">新建等级</n-button>
        </div>
      </div>
      <n-alert type="info" :bordered="false" style="margin-bottom: 12px">
        等级价格统一由管理员维护。客户绑定某个等级价格后，成交价按该等级规则计算（除非为该客户单独设置了专属价格）。点击等级行或「价格详情」可进入为 SKU 设置等级价格。
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
          <div class="header-actions">
            <n-button size="small" @click="openEditLevel(currentLevel)">编辑等级</n-button>
            <n-button size="small" @click="openPreview">价格预览</n-button>
          </div>
        </div>
        <n-descriptions :column="3" bordered size="small">
          <n-descriptions-item label="客户数">{{ currentLevel.customer_count }}</n-descriptions-item>
          <n-descriptions-item label="默认额度">
            {{ currentLevel.default_credit_limit != null ? `¥${Number(currentLevel.default_credit_limit).toLocaleString()}` : '—' }}
          </n-descriptions-item>
          <n-descriptions-item label="适用标签（参考）">
            <span v-if="!(currentLevel.applicable_tags && currentLevel.applicable_tags.length)">—</span>
            <n-space v-else :size="4">
              <n-tag v-for="t in currentLevel.applicable_tags" :key="t.id" size="small" :bordered="false">{{ t.name }}</n-tag>
            </n-space>
          </n-descriptions-item>
          <n-descriptions-item v-if="currentLevel.description" label="适用说明/备注" :span="3">{{ currentLevel.description }}</n-descriptions-item>
        </n-descriptions>
      </div>

      <div class="card-section">
        <h3 class="page-title" style="margin-bottom: 12px">等级默认规则</h3>
        <n-alert type="info" :bordered="false" style="margin-bottom: 12px">
          默认规则作用于所有未单独设置价格的 SKU：等级价 = 建议零售价 ± 百分比 / ± 固定金额（负数下调，最终不低于最低售价）。
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

    <!-- 新建 / 编辑等级弹窗 -->
    <n-modal v-model:show="levelEditVisible" :title="levelForm.id ? '编辑等级' : '新建等级'" preset="card" style="width: 580px">
      <n-form :model="levelForm" label-placement="left" label-width="120">
        <n-form-item label="等级名称" required>
          <n-input v-model:value="levelForm.nickname" placeholder="请输入等级显示名称" />
        </n-form-item>
        <n-form-item label="编码" required>
          <n-input
            v-model:value="levelForm.level_id"
            :disabled="isBuiltinLevel(levelForm.level_id) && !!levelForm.id"
            placeholder="等级业务编码，如 vip（仅支持字母/数字/下划线/中划线）"
          />
        </n-form-item>
        <n-form-item label="适用客户标签">
          <n-select
            v-model:value="levelForm.applicable_tag_ids"
            multiple
            clearable
            filterable
            :options="tagOpts"
            placeholder="选填，可多选，仅作人工参考不限制客户绑定"
          />
        </n-form-item>
        <n-form-item label="适用说明/备注">
          <n-input v-model:value="levelForm.description" type="textarea" :rows="2" placeholder="选填，可自由填写适用客户说明或备注" />
        </n-form-item>
        <n-form-item label="默认额度">
          <n-input-number v-model:value="levelForm.default_credit_limit" :min="0" :step="1000" style="width: 200px">
            <template #suffix>元</template>
          </n-input-number>
          <span style="margin-left: 8px; color: var(--text-3); font-size: 12px">客户未单独设额度时默认按此额度</span>
        </n-form-item>
        <n-form-item label="启用">
          <n-switch v-model:value="levelForm.is_active" :disabled="isBuiltinLevel(levelForm.level_id) && !!levelForm.id" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="levelEditVisible = false">取消</n-button>
        <n-button type="primary" :loading="levelSaving" @click="onSaveLevel">保存</n-button>
      </template>
    </n-modal>

    <!-- 价格预览弹窗 -->
    <n-modal v-model:show="showPreview" preset="card" title="等级价格预览" style="width: 480px">
      <n-form label-placement="left" label-width="90">
        <n-form-item label="等级价格">
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
import { h, ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton, NInput, NInputNumber, NSelect, NDataTable, NTag, useMessage, useDialog,
  type DataTableColumns, type SelectOption,
} from 'naive-ui'
import { levelApi, levelPriceApi, productApi, customerTagApi, fetchAllPages, PAGE_SIZE } from '@/api'
import { PRICE_METHOD, RULE_SOURCE } from '@/utils/dict'
import type {
  CustomerTag, LevelStats, LevelPrice, LevelPriceRulePreview, PriceMethod, ProductSPU, ProductSKU,
} from '@/types'
import { actionBar, actionIcon } from '@/components/tableActions'

const BUILTIN_LEVEL_CODES = new Set(['default_retail', 'walk_in'])
const isBuiltinLevel = (code?: string | null) => Boolean(code && BUILTIN_LEVEL_CODES.has(code))

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const saving = ref(false)
const levelSaving = ref(false)
const previewing = ref(false)

// 视图状态：list=等级列表，detail=某等级的 SKU 价格详情
const view = ref<'list' | 'detail'>('list')
const levels = ref<LevelStats[]>([])
const tags = ref<CustomerTag[]>([])
const currentLevel = ref<LevelStats | null>(null)

const rules = ref<LevelPrice[]>([])
const spus = ref<ProductSPU[]>([])
const skus = ref<ProductSKU[]>([])

const methodOptions = [
  { label: PRICE_METHOD.percent, value: 'percent' },
  { label: PRICE_METHOD.amount, value: 'amount' },
]

const tagOpts = computed<SelectOption[]>(() =>
  tags.value.map((t) => ({ label: t.is_active ? t.name : `${t.name}（已停用）`, value: t.id })),
)

// ---------- 新建 / 编辑等级 ----------
const levelEditVisible = ref(false)
const levelForm = reactive<{
  id: number
  level_id: string
  nickname: string
  applicable_tag_ids: number[]
  description: string
  default_credit_limit: number
  is_active: boolean
}>({
  id: 0,
  level_id: '',
  nickname: '',
  applicable_tag_ids: [],
  description: '',
  default_credit_limit: 1000,
  is_active: true,
})

function openCreateLevel() {
  Object.assign(levelForm, {
    id: 0,
    level_id: '',
    nickname: '',
    applicable_tag_ids: [],
    description: '',
    default_credit_limit: 1000,
    is_active: true,
  })
  levelEditVisible.value = true
}

function openEditLevel(row: LevelStats) {
  Object.assign(levelForm, {
    id: row.id,
    level_id: row.level_id,
    nickname: row.nickname,
    applicable_tag_ids: [...(row.applicable_tag_ids || [])],
    description: row.description || '',
    default_credit_limit: Number(row.default_credit_limit ?? 1000),
    is_active: row.is_active !== false,
  })
  levelEditVisible.value = true
}

async function onSaveLevel() {
  const nickname = String(levelForm.nickname || '').trim()
  const levelId = String(levelForm.level_id || '').trim()
  if (!nickname || !levelId) {
    message.warning('请填写等级显示名称和业务编码')
    return
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(levelId)) {
    message.warning('业务编码仅支持字母、数字、下划线和中划线')
    return
  }
  const payload = {
    level_id: levelId,
    nickname,
    applicable_tag_ids: levelForm.applicable_tag_ids,
    description: levelForm.description || null,
    default_credit_limit: levelForm.default_credit_limit ?? 1000,
    is_active: levelForm.is_active,
  }
  levelSaving.value = true
  try {
    if (levelForm.id) {
      await levelApi.update(levelForm.id, payload)
      message.success('等级已更新')
    } else {
      await levelApi.create(payload)
      message.success('等级已创建')
    }
    levelEditVisible.value = false
    await loadLevels()
    if (currentLevel.value) {
      const updated = levels.value.find((l) => l.id === currentLevel.value!.id)
      if (updated) currentLevel.value = updated
    }
  } finally {
    levelSaving.value = false
  }
}

async function onDeleteLevel(row: LevelStats) {
  await levelApi.remove(row.id)
  message.success('等级已删除')
  await loadLevels()
}

// ---------- 等级列表 ----------
const levelRowProps = (row: LevelStats) => ({
  style: 'cursor: pointer',
  onClick: () => openDetail(row),
})

const levelColumns = computed<DataTableColumns<LevelStats>>(() => [
  {
    title: '等级名称', key: 'nickname', width: 160, ellipsis: { tooltip: true },
    render: (r) => h('div', { style: 'display:flex;align-items:center;gap:6px' }, [
      h('span', r.nickname),
      r.level_id === 'default_retail' ? h(NTag, { size: 'tiny', type: 'info', bordered: false }, { default: () => '内置默认' }) : null,
      r.level_id === 'walk_in' ? h(NTag, { size: 'tiny', type: 'default', bordered: false }, { default: () => '内置散客' }) : null,
    ]),
  },
  { title: '等级编码', key: 'level_id', width: 120, ellipsis: { tooltip: true } },
  {
    title: '适用客户标签（参考）', key: 'applicable_tags', width: 200,
    render: (r) => {
      const items = r.applicable_tags || []
      if (!items.length) return '—'
      return h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px' }, items.map((t) =>
        h(NTag, { size: 'small', bordered: false }, { default: () => t.name }),
      ))
    },
  },
  {
    title: '默认额度', key: 'default_credit_limit', width: 100,
    render: (r) => r.default_credit_limit != null ? `¥${Number(r.default_credit_limit).toLocaleString()}` : '—',
  },
  { title: '客户数', key: 'customer_count', width: 80 },
  { title: '适用说明', key: 'description', ellipsis: { tooltip: true }, render: (r) => r.description || '—' },
  {
    title: '状态', key: 'is_active', width: 80,
    render: (r) => h(NTag, { size: 'small', type: r.is_active === false ? 'error' : 'success', bordered: false }, { default: () => (r.is_active === false ? '禁用' : '启用') }),
  },
  {
    title: '操作', key: 'actions', width: 145,
    render: (r) => actionBar([
      h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openDetail(r) }, { default: () => '价格详情' }),
      actionIcon({ icon: 'edit', label: '编辑', onClick: () => openEditLevel(r) }),
      !isBuiltinLevel(r.level_id) && actionIcon({
        icon: 'delete',
        label: '删除',
        confirm: '确认删除该等级？',
        onClick: () => onDeleteLevel(r),
      }),
    ], { stopPropagation: true }),
  },
])

async function loadLevels() {
  loading.value = true
  try {
    ;[levels.value, tags.value] = await Promise.all([
      levelApi.stats(),
      customerTagApi.list(),
    ])
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
  if (route.query.levelId) {
    router.replace({ path: '/prices/levels' })
  }
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
    title: '操作', key: 'actions', width: 96,
    render: (r) => actionBar([
      actionIcon({ icon: 'save', label: '保存规则', loading: saving.value, onClick: () => saveSkuRule(r) }),
      r.rule && actionIcon({ icon: 'delete', label: '清除', onClick: () => removeSkuRule(r) }),
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

function tryOpenByQuery() {
  const raw = route.query.levelId
  if (!raw) return
  const targetId = Number(raw)
  if (!Number.isFinite(targetId)) return
  const matched = levels.value.find((l) => l.id === targetId)
  if (matched) openDetail(matched)
}

watch(() => route.query.levelId, () => {
  if (levels.value.length) tryOpenByQuery()
})

onMounted(async () => {
  await loadLevels()
  tryOpenByQuery()
})
</script>

<style scoped>
.header-actions { display: flex; align-items: center; gap: 8px; }
.default-rule-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rule-hint { font-size: 12px; color: var(--text-3); }
</style>
