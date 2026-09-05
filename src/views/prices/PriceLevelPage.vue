<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">等级价格</h2>
      </div>
      <div class="filter-bar">
        <n-select
          v-model:value="filterLevelId"
          :options="levelOptions"
          clearable
          placeholder="按客户等级筛选"
          style="width: 220px"
          @update:value="loadRules"
        />
        <n-button size="small" @click="loadRules">刷新</n-button>
        <n-button type="primary" size="small" @click="openCreate">新增规则</n-button>
        <n-button size="small" @click="openPreview">价格预览</n-button>
      </div>
      <n-alert type="info" :bordered="false" style="margin-bottom: 12px">
        规则基于「建议零售价」计算：百分比正数上浮、负数下调，金额同理（下限 0）。SKU 专属规则优先于等级默认规则。
      </n-alert>
      <n-data-table
        :columns="columns"
        :data="rules"
        :loading="loading"
        size="small"
        :bordered="false"
        :row-key="(r: LevelPrice) => r.id"
      />
    </div>

    <n-modal v-model:show="showCreate" preset="card" title="新增等级价格规则" style="width: 480px">
      <n-form label-placement="left" label-width="90">
        <n-form-item label="客户等级">
          <n-select v-model:value="form.level_id" :options="levelOptions" placeholder="选择客户等级" />
        </n-form-item>
        <n-form-item label="规则维度">
          <n-radio-group v-model:value="form.scope">
            <n-radio value="default">等级默认</n-radio>
            <n-radio value="sku">SKU 专属</n-radio>
          </n-radio-group>
        </n-form-item>
        <template v-if="form.scope === 'sku'">
          <n-form-item label="商品">
            <n-select v-model:value="form.spu_id" :options="spuOptions" filterable placeholder="选择商品" @update:value="form.sku_id = null" />
          </n-form-item>
          <n-form-item label="SKU">
            <n-select v-model:value="form.sku_id" :options="skuOptionsFor(form.spu_id)" placeholder="选择 SKU" />
          </n-form-item>
        </template>
        <n-form-item label="计算方式">
          <n-select v-model:value="form.price_method" :options="methodOptions" />
        </n-form-item>
        <n-form-item :label="form.price_method === 'percent' ? '百分比 (%)' : '金额 (元)'">
          <n-input-number v-model:value="form.price_value" :precision="2" style="width: 100%" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <n-button size="small" @click="showCreate = false">取消</n-button>
          <n-button type="primary" size="small" :loading="saving" @click="saveCreate">保存</n-button>
        </div>
      </template>
    </n-modal>

    <n-modal v-model:show="showPreview" preset="card" title="等级价格预览" style="width: 480px">
      <n-form label-placement="left" label-width="90">
        <n-form-item label="客户等级">
          <n-select v-model:value="previewForm.level_id" :options="levelOptions" placeholder="选择客户等级" />
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
          <span style="color: #dc2626; font-weight: 600">¥{{ previewResult.level_price }}</span>
        </n-descriptions-item>
      </n-descriptions>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, computed, onMounted } from 'vue'
import {
  NButton, NInputNumber, NSelect, NDataTable, NTag, useMessage, useDialog,
  type DataTableColumns,
} from 'naive-ui'
import { levelApi, levelPriceApi, productApi } from '@/api'
import { formatDate } from '@/utils/format'
import { PRICE_METHOD, RULE_SOURCE } from '@/utils/dict'
import type { LevelConfig, LevelPrice, LevelPriceRulePreview, PriceMethod, ProductSPU, ProductSKU } from '@/types'

const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const saving = ref(false)
const previewing = ref(false)

const levels = ref<LevelConfig[]>([])
const spus = ref<ProductSPU[]>([])
const skus = ref<ProductSKU[]>([])
const rules = ref<LevelPrice[]>([])
const filterLevelId = ref<number | null>(null)

const methodOptions = [
  { label: PRICE_METHOD.percent, value: 'percent' },
  { label: PRICE_METHOD.amount, value: 'amount' },
]

const levelOptions = ref<{ label: string; value: number }[]>([])
const spuOptions = ref<{ label: string; value: number }[]>([])

const allSkuOptions = ref<{ label: string; value: number }[]>([])

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

function specsText(r: LevelPrice): string {
  if (!r.sku_id) return '—'
  const specs = r.sku_specs ? Object.values(r.sku_specs).filter(Boolean).join('/') : ''
  return [r.spu_name, specs].filter(Boolean).join(' · ') || '—'
}

const columns = computed<DataTableColumns<LevelPrice>>(() => [
  { title: '客户等级', key: 'level_nickname', width: 120 },
  {
    title: '规则类型', key: 'scope', width: 110,
    render: (r) => h(NTag, { size: 'small', type: r.sku_id ? 'warning' : 'default', bordered: false }, { default: () => (r.sku_id ? 'SKU 专属' : '等级默认') }),
  },
  { title: '商品 / SKU', key: 'sku', minWidth: 180, render: (r) => specsText(r) },
  {
    title: '计算方式', key: 'price_method', width: 150,
    render: (r) => h(NSelect, {
      value: r.price_method,
      size: 'small',
      options: methodOptions,
      style: 'width: 130px',
      'onUpdate:value': (v: PriceMethod) => { r.price_method = v },
    }),
  },
  {
    title: '数值', key: 'price_value', width: 140,
    render: (r) => h(NInputNumber, {
      value: Number(r.price_value),
      size: 'small',
      precision: 2,
      style: 'width: 120px',
      'onUpdate:value': (v: number | null) => { r.price_value = String(v ?? 0) },
    }),
  },
  { title: '更新时间', key: 'updated_at', width: 160, render: (r) => (r.updated_at ? formatDate(r.updated_at) : '—') },
  {
    title: '操作', key: 'actions', width: 130,
    render: (r) => h('div', { style: 'display:flex;gap:8px' }, [
      h(NButton, { size: 'small', text: true, type: 'primary', loading: saving.value, onClick: () => saveRow(r) }, { default: () => '保存' }),
      h(NButton, {
        size: 'small', text: true, type: 'error',
        onClick: () => dialog.warning({
          title: '删除规则',
          content: r.sku_id ? `确定删除该等级对「${specsText(r)}」的专属规则？` : `确定删除「${r.level_nickname}」的默认规则？删除后该等级按建议零售价销售。`,
          positiveText: '删除',
          negativeText: '取消',
          onPositiveClick: () => removeRow(r),
        }),
      }, { default: () => '删除' }),
    ]),
  },
])

const showCreate = ref(false)
const form = ref({
  level_id: null as number | null,
  scope: 'default' as 'default' | 'sku',
  spu_id: null as number | null,
  sku_id: null as number | null,
  price_method: 'percent' as PriceMethod,
  price_value: 0,
})

const showPreview = ref(false)
const previewForm = ref({ level_id: null as number | null, sku_id: null as number | null, suggested_price: null as number | null })
const previewResult = ref<LevelPriceRulePreview | null>(null)

function openCreate() {
  form.value = { level_id: filterLevelId.value, scope: 'default', spu_id: null, sku_id: null, price_method: 'percent', price_value: 0 }
  showCreate.value = true
}

function openPreview() {
  previewForm.value = { level_id: filterLevelId.value, sku_id: null, suggested_price: null }
  previewResult.value = null
  showPreview.value = true
}

async function loadRules() {
  loading.value = true
  try {
    rules.value = await levelPriceApi.list(filterLevelId.value ? { level_id: filterLevelId.value } : {})
  } finally {
    loading.value = false
  }
}

async function saveRow(r: LevelPrice) {
  saving.value = true
  try {
    await levelPriceApi.upsert(r.level_id, { sku_id: r.sku_id, price_method: r.price_method, price_value: Number(r.price_value) })
    message.success('规则已保存')
    await loadRules()
  } finally {
    saving.value = false
  }
}

async function removeRow(r: LevelPrice) {
  await levelPriceApi.remove(r.level_id, r.sku_id ? { sku_id: r.sku_id } : {})
  message.success('规则已删除')
  await loadRules()
}

async function saveCreate() {
  if (!form.value.level_id) return message.warning('请选择客户等级')
  if (form.value.scope === 'sku' && !form.value.sku_id) return message.warning('请选择 SKU')
  saving.value = true
  try {
    await levelPriceApi.upsert(form.value.level_id, {
      sku_id: form.value.scope === 'sku' ? form.value.sku_id : null,
      price_method: form.value.price_method,
      price_value: form.value.price_value,
    })
    message.success('规则已保存')
    showCreate.value = false
    await loadRules()
  } finally {
    saving.value = false
  }
}

async function doPreview() {
  if (!previewForm.value.level_id) return message.warning('请选择客户等级')
  if (!previewForm.value.sku_id && (previewForm.value.suggested_price === null || previewForm.value.suggested_price === undefined)) {
    return message.warning('请选择 SKU 或填写建议零售价')
  }
  previewing.value = true
  try {
    previewResult.value = await levelPriceApi.preview(previewForm.value.level_id, {
      sku_id: previewForm.value.sku_id ?? undefined,
      suggested_price: previewForm.value.suggested_price ?? undefined,
    })
  } finally {
    previewing.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    const [levelList, spuList, skuList] = await Promise.all([levelApi.list(), productApi.spus(), productApi.allSkus({ page_size: 100 })])
    levels.value = levelList
    spus.value = spuList
    skus.value = skuList
    levelOptions.value = levelList.map((l) => ({ label: l.nickname, value: l.id }))
    spuOptions.value = spuList.map((s) => ({ label: `${s.name} (${s.code})`, value: s.id }))
    allSkuOptions.value = skuList.map((s) => ({ label: skuLabel(s), value: s.id }))
    await loadRules()
  } finally {
    loading.value = false
  }
})
</script>
