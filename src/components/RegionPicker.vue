<template>
  <div class="region-picker">
    <n-select
      class="region-picker__select"
      :value="value"
      :options="selectOptions"
      :loading="searching"
      :disabled="disabled"
      :placeholder="effectivePlaceholder"
      :render-label="renderOptionLabel"
      filterable
      remote
      clearable
      @search="onSearch"
      @update:value="onSelectValue"
    />
    <n-popover
      v-model:show="cascadeOpen"
      trigger="click"
      placement="bottom-end"
      :disabled="disabled"
      :width="640"
      @update:show="onCascadeShow"
    >
      <template #trigger>
        <n-button secondary :disabled="disabled">按级选择</n-button>
      </template>
      <div class="region-cascade">
        <div class="region-cascade__header">
          <span class="region-cascade__crumbs">
            <template v-if="cascadePath.length">
              已选路径：{{ cascadePath.map((n) => n.name).join(' / ') }}
            </template>
            <template v-else>请依次选择省 / 市 / 县 / 乡镇</template>
          </span>
          <n-button
            v-if="cascadePath.length"
            size="tiny"
            type="primary"
            @click="confirmCascadeCurrent"
          >
            选定当前（{{ cascadePath[cascadePath.length - 1].name }}）
          </n-button>
        </div>
        <div class="region-cascade__cols">
          <div
            v-for="(col, colIdx) in cascadeColumns"
            :key="colIdx"
            class="region-cascade__col"
          >
            <div class="region-cascade__col-title">{{ LEVEL_TITLES[colIdx] || `第 ${colIdx + 1} 级` }}</div>
            <n-spin :show="loadingCol === colIdx" size="small">
              <div v-if="col.length" class="region-cascade__list">
                <div
                  v-for="item in col"
                  :key="item.id"
                  class="region-cascade__item"
                  :class="{ active: cascadePath[colIdx]?.id === item.id }"
                  @click="onClickCascadeItem(item, colIdx)"
                >
                  <span class="region-cascade__name">{{ item.name }}</span>
                  <span v-if="item.has_children" class="region-cascade__arrow">›</span>
                </div>
              </div>
              <div v-else class="region-cascade__empty">
                {{ loadingCol === colIdx ? '加载中...' : '暂无下级' }}
              </div>
            </n-spin>
          </div>
        </div>
      </div>
    </n-popover>
  </div>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import { NTag, type SelectOption } from 'naive-ui'
import { regionApi } from '@/api'
import type { RegionNode, RegionSelection } from '@/types'

const LEVEL_LABELS: Record<number, string> = { 1: '省', 2: '市', 3: '县区', 4: '乡镇' }
const LEVEL_TAG_TYPES: Record<number, 'default' | 'info' | 'warning' | 'success'> = {
  1: 'default',
  2: 'info',
  3: 'warning',
  4: 'success',
}
const LEVEL_TITLES = ['省 / 直辖市', '市', '县 / 区', '乡镇 / 街道']

// 模块级缓存：所有组件实例共享，避免重复请求省列表和已展开的子级
const childrenCache = new Map<number, RegionNode[]>()
const nodeCache = new Map<number, RegionNode>()

const props = withDefaults(
  defineProps<{
    value: number | null
    placeholder?: string
    fallbackLabel?: string
    disabled?: boolean
  }>(),
  {
    value: null,
    placeholder: '输入乡镇或县名搜索（如“太平”或“枣阳 太平”）',
    fallbackLabel: '',
    disabled: false,
  },
)

const emit = defineEmits<{
  (e: 'update:value', v: number | null): void
  (e: 'change', v: RegionSelection | null): void
}>()

const searching = ref(false)
const searchRows = ref<RegionNode[]>([])
const selectedNode = ref<RegionNode | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | undefined

const effectivePlaceholder = computed(() =>
  !props.value && props.fallbackLabel ? `${props.fallbackLabel}（输入搜索重新选择）` : props.placeholder,
)

function toSelection(node: RegionNode): RegionSelection {
  const fullName = node.full_name || node.name
  const parts = fullName.split(' / ').map((s) => s.trim()).filter(Boolean)
  return {
    id: node.id,
    level: node.level,
    name: node.name,
    full_name: fullName,
    province: parts[0] || '',
    city: parts[1] || '',
    district: parts[2] || '',
    town: parts[3] || '',
  }
}

function cacheNodes(rows: RegionNode[]) {
  for (const row of rows) nodeCache.set(row.id, row)
}

const selectOptions = computed<SelectOption[]>(() => {
  const map = new Map<number, RegionNode>()
  if (selectedNode.value) map.set(selectedNode.value.id, selectedNode.value)
  for (const row of searchRows.value) map.set(row.id, row)
  return Array.from(map.values()).map((node) => ({
    label: node.full_name || node.name,
    value: node.id,
    level: node.level,
  }))
})

function renderOptionLabel(option: SelectOption) {
  const level = Number(option.level || 0)
  const tagText = LEVEL_LABELS[level]
  if (!tagText) return String(option.label || '')
  return h('div', { style: 'display:flex;align-items:center;gap:8px;width:100%' }, [
    h(
      NTag,
      { size: 'tiny', bordered: false, type: LEVEL_TAG_TYPES[level] || 'default' },
      { default: () => tagText },
    ),
    h('span', { style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, String(option.label || '')),
  ])
}

async function ensureSelectedLoaded(id: number | null) {
  if (id == null) {
    selectedNode.value = null
    return
  }
  const cached = nodeCache.get(id)
  if (cached) {
    selectedNode.value = cached
    return
  }
  try {
    const node = await regionApi.get(id)
    nodeCache.set(node.id, node)
    if (props.value === id) selectedNode.value = node
  } catch {
    // 区域不存在时忽略
  }
}

watch(
  () => props.value,
  (id) => {
    void ensureSelectedLoaded(id)
  },
  { immediate: true },
)

function onSearch(keyword: string) {
  if (searchTimer) clearTimeout(searchTimer)
  const trimmed = keyword.trim()
  if (!trimmed) {
    searchRows.value = []
    searching.value = false
    return
  }
  searching.value = true
  searchTimer = setTimeout(async () => {
    try {
      const rows = await regionApi.list({ keyword: trimmed, limit: 50 })
      cacheNodes(rows)
      searchRows.value = rows
    } catch {
      searchRows.value = []
    } finally {
      searching.value = false
    }
  }, 200)
}

function onSelectValue(val: number | null) {
  if (val == null) {
    selectedNode.value = null
    emit('update:value', null)
    emit('change', null)
    return
  }
  const node = nodeCache.get(val) || searchRows.value.find((r) => r.id === val) || null
  selectedNode.value = node
  emit('update:value', val)
  emit('change', node ? toSelection(node) : null)
}

/* ---------- 懒加载按级选择 ---------- */
const cascadeOpen = ref(false)
const cascadeColumns = ref<RegionNode[][]>([])
const cascadePath = ref<RegionNode[]>([])
const loadingCol = ref<number | null>(null)

async function loadChildren(parentId: number): Promise<RegionNode[]> {
  const cached = childrenCache.get(parentId)
  if (cached) return cached
  const rows =
    parentId === 0
      ? await regionApi.list({ level: 1 })
      : await regionApi.list({ parent_id: parentId })
  cacheNodes(rows)
  childrenCache.set(parentId, rows)
  return rows
}

async function onCascadeShow(show: boolean) {
  if (!show) return
  if (cascadeColumns.value.length) return
  loadingCol.value = 0
  try {
    const provinces = await loadChildren(0)
    cascadeColumns.value = [provinces]
  } finally {
    loadingCol.value = null
  }
}

async function onClickCascadeItem(item: RegionNode, colIdx: number) {
  cascadePath.value = [...cascadePath.value.slice(0, colIdx), item]
  cascadeColumns.value = cascadeColumns.value.slice(0, colIdx + 1)

  if (!item.has_children) {
    applyCascadeNode(item)
    return
  }

  const nextCol = colIdx + 1
  loadingCol.value = nextCol
  cascadeColumns.value = [...cascadeColumns.value, []]
  try {
    const children = await loadChildren(item.id)
    if (cascadePath.value[colIdx]?.id !== item.id) return
    if (!children.length) {
      cascadeColumns.value = cascadeColumns.value.slice(0, colIdx + 1)
      applyCascadeNode(item)
      return
    }
    const nextCols = [...cascadeColumns.value]
    nextCols[nextCol] = children
    cascadeColumns.value = nextCols
  } finally {
    if (loadingCol.value === nextCol) loadingCol.value = null
  }
}

function confirmCascadeCurrent() {
  const last = cascadePath.value[cascadePath.value.length - 1]
  if (!last) return
  applyCascadeNode(last)
}

function applyCascadeNode(node: RegionNode) {
  const fullName = node.full_name || cascadePath.value.map((n) => n.name).join(' / ')
  const enriched: RegionNode = { ...node, full_name: fullName }
  nodeCache.set(enriched.id, enriched)
  selectedNode.value = enriched
  emit('update:value', enriched.id)
  emit('change', toSelection(enriched))
  cascadeOpen.value = false
}
</script>

<style scoped>
.region-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.region-picker__select {
  flex: 1;
  min-width: 0;
}
.region-cascade {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.region-cascade__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 12px;
  color: #666;
}
.region-cascade__crumbs {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.region-cascade__cols {
  display: flex;
  gap: 0;
  border: 1px solid #eee;
  border-radius: 6px;
  overflow-x: auto;
}
.region-cascade__col {
  flex: 1;
  min-width: 145px;
  border-right: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
}
.region-cascade__col:last-child {
  border-right: none;
}
.region-cascade__col-title {
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #888;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}
.region-cascade__list {
  height: 240px;
  overflow-y: auto;
  padding: 4px 0;
}
.region-cascade__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s;
}
.region-cascade__item:hover {
  background: #f5f7fa;
}
.region-cascade__item.active {
  background: #edf5ff;
  color: #1677ff;
  font-weight: 500;
}
.region-cascade__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.region-cascade__arrow {
  color: #bbb;
  margin-left: 4px;
}
.region-cascade__empty {
  height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #aaa;
}
</style>
