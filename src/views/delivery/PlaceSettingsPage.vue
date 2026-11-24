<template>
  <div class="page-container route-settings-page">
    <div class="card-section">
      <div class="page-header">
        <div>
          <h2 class="page-title">路线设置</h2>
          <p class="page-note">维护自送路线的途径地点与发车安排；安排出车时直接选择日期和路线即可。</p>
        </div>
        <n-space :size="8">
          <n-button :loading="loading" @click="load">刷新</n-button>
          <n-button type="primary" @click="openCreate">新建路线</n-button>
        </n-space>
      </div>

      <n-alert v-if="loadError" type="error" :bordered="false" class="block-alert">
        路线加载失败：{{ loadError }}
        <n-button text type="primary" size="small" style="margin-left: 8px" @click="load">重试</n-button>
      </n-alert>

      <div class="filter-bar">
        <n-input v-model:value="keyword" clearable placeholder="搜索路线名称 / 途径地点 / 备注" style="width: 260px" />
        <n-select v-model:value="statusFilter" clearable placeholder="状态" style="width: 120px" :options="statusOptions" />
        <span class="muted">共 {{ filteredTemplates.length }} 条路线</span>
      </div>

      <n-data-table
        :columns="columns"
        :data="filteredTemplates"
        :loading="loading"
        :bordered="false"
        size="small"
        :scroll-x="960"
        :row-key="(row: RouteTemplate) => row.id"
      >
        <template #empty>
          <n-empty description="还没有自送路线，先新建一条" class="empty" />
        </template>
      </n-data-table>
    </div>

    <n-modal
      v-model:show="formVisible"
      preset="card"
      :title="form.id ? '编辑路线' : '新建路线'"
      style="width: 760px; max-width: 95vw"
      :mask-closable="false"
    >
      <n-form label-placement="left" label-width="96">
        <div class="form-grid">
          <n-form-item label="路线名称" required>
            <n-input v-model:value="form.name" maxlength="100" placeholder="如：城北自送线 / 东区专线" />
          </n-form-item>
          <n-form-item label="默认负责人">
            <n-select v-model:value="form.default_owner_id" :options="ownerOptions" clearable filterable placeholder="留空默认店家" />
          </n-form-item>
          <n-form-item label="备注">
            <n-input v-model:value="form.remark" maxlength="200" placeholder="选填，如发车说明" />
          </n-form-item>
          <n-form-item label="启用">
            <n-switch v-model:value="form.is_active" />
          </n-form-item>
        </div>

        <n-divider title-placement="left">途径地点（县城 / 乡镇）</n-divider>
        <div class="stop-tools">
          <n-select
            v-model:value="newStopId"
            :options="availableStopOptions"
            filterable
            clearable
            placeholder="搜索并选择途径地点（县城 / 乡镇）"
            style="width: 320px"
          />
          <n-button type="primary" secondary :disabled="!newStopId" @click="addStop">添加地点</n-button>
          <span class="stop-total">已选 {{ form.stops.length }} 个地点</span>
        </div>

        <div v-if="form.stops.length" class="stop-list">
          <div v-for="(stop, index) in form.stops" :key="stop.region_id" class="stop-row">
            <span class="stop-seq">{{ index + 1 }}</span>
            <span class="stop-name">
              {{ stop.region_name }}
              <n-tag v-if="stop.level === 3" size="tiny" type="info" style="margin-left: 6px">县城</n-tag>
              <span v-else-if="stop.parent_name" class="muted" style="margin-left: 6px">{{ stop.parent_name }}</span>
            </span>
            <n-space :size="6">
              <n-button size="tiny" text :disabled="index === 0" @click="moveStop(index, -1)">上移</n-button>
              <n-button size="tiny" text :disabled="index === form.stops.length - 1" @click="moveStop(index, 1)">下移</n-button>
              <n-button size="tiny" text type="error" @click="removeStop(index)">移除</n-button>
            </n-space>
          </div>
        </div>
        <n-empty v-else description="请至少添加一个途径地点" size="small" class="stop-empty" />

        <n-divider title-placement="left">自动发车计划（选填）</n-divider>
        <n-form-item label="计划类型">
          <n-radio-group v-model:value="form.schedule_type">
            <n-space>
              <n-radio value="none">手动安排</n-radio>
              <n-radio value="weekly">按周循环</n-radio>
              <n-radio value="monthly">按月循环</n-radio>
            </n-space>
          </n-radio-group>
        </n-form-item>
        <n-form-item v-if="form.schedule_type === 'weekly'" label="每周发车日">
          <n-checkbox-group v-model:value="form.schedule_weekdays">
            <n-space>
              <n-checkbox v-for="w in weekdayOptions" :key="w.value" :value="w.value" :label="w.label" />
            </n-space>
          </n-checkbox-group>
        </n-form-item>
        <n-form-item v-if="form.schedule_type === 'monthly'" label="每月发车日">
          <n-checkbox-group v-model:value="form.schedule_month_days">
            <div class="month-grid">
              <n-checkbox v-for="d in 31" :key="d" :value="d" :label="`${d}日`" />
            </div>
          </n-checkbox-group>
        </n-form-item>
      </n-form>

      <template #footer>
        <n-button @click="formVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="save">保存路线</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { NButton, NTag, useDialog, useMessage, type DataTableColumns, type SelectOption } from 'naive-ui'
import { adminCustomerApi, regionApi, routeTripApi } from '@/api'
import type { RegionNode, RouteScheduleType, RouteStopOrigin, RouteTemplate, RouteTemplateSavePayload } from '@/types'
import { actionBar, actionIcon } from '@/components/tableActions'

interface StopOption extends SelectOption {
  label: string
  value: number
  name: string
  parentName: string | null
  level: number
}

interface StopDraft {
  region_id: number
  region_name: string
  parent_name: string | null
  level: number
  origin: RouteStopOrigin
}

const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const templates = ref<RouteTemplate[]>([])
const regions = ref<RegionNode[]>([])
const ownerOptions = ref<SelectOption[]>([])
const keyword = ref('')
const statusFilter = ref<'active' | 'inactive' | null>(null)
const formVisible = ref(false)
const newStopId = ref<number | null>(null)

const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
]

const weekdayOptions = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
]

const emptyForm = () => ({
  id: 0,
  name: '',
  remark: '',
  is_active: true,
  default_owner_id: null as number | null,
  schedule_type: 'none' as RouteScheduleType,
  schedule_weekdays: [] as number[],
  schedule_month_days: [] as number[],
  stops: [] as StopDraft[],
})
const form = reactive(emptyForm())

function flattenStops(nodes: RegionNode[], county = ''): StopOption[] {
  const out: StopOption[] = []
  for (const node of nodes) {
    if (node.level === 3) {
      out.push({
        label: `${node.name}（县城）`,
        value: node.id,
        name: node.name,
        parentName: null,
        level: 3,
      })
      out.push(...flattenStops(node.children || [], node.name))
    } else if (node.level === 4) {
      out.push({
        label: county ? `${county} / ${node.name}` : node.name,
        value: node.id,
        name: node.name,
        parentName: county || null,
        level: 4,
      })
    } else {
      out.push(...flattenStops(node.children || [], county))
    }
  }
  return out
}

const allStops = computed(() => flattenStops(regions.value))
const stopMap = computed(() => new Map(allStops.value.map((s) => [s.value, s])))
const availableStopOptions = computed<SelectOption[]>(() => {
  const used = new Set(form.stops.map((s) => s.region_id))
  return allStops.value
    .filter((s) => !used.has(s.value))
    .map(({ label, value }) => ({ label, value }))
})

const filteredTemplates = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return templates.value.filter((t) => {
    if (statusFilter.value === 'active' && !t.is_active) return false
    if (statusFilter.value === 'inactive' && t.is_active) return false
    if (kw) {
      const hay = `${t.name} ${t.stops_text} ${t.remark || ''}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })
})

function scheduleText(row: RouteTemplate): string {
  if (row.schedule_type === 'weekly' && row.schedule_weekdays?.length) {
    const names = row.schedule_weekdays
      .slice()
      .sort((a, b) => a - b)
      .map((d) => weekdayOptions.find((w) => w.value === d)?.label || `周${d}`)
    return `每${names.join('、')}`
  }
  if (row.schedule_type === 'monthly' && row.schedule_month_days?.length) {
    const days = row.schedule_month_days.slice().sort((a, b) => a - b).map((d) => `${d}日`)
    return `每月 ${days.join('、')}`
  }
  return '手动安排'
}

const columns = computed<DataTableColumns<RouteTemplate>>(() => [
  {
    title: '路线名称',
    key: 'name',
    minWidth: 160,
    render: (row) => h('div', [
      h(NButton, { text: true, type: 'primary', onClick: () => openEdit(row) }, { default: () => row.name }),
      h('div', { class: 'muted' }, `${row.stops.length} 个途径地点`),
    ]),
  },
  {
    title: '途径地点',
    key: 'stops_text',
    minWidth: 260,
    ellipsis: { tooltip: true },
    render: (row) => row.stops_text || row.stops.map((s) => s.region_name).join(' → ') || '—',
  },
  {
    title: '发车计划',
    key: 'schedule',
    width: 150,
    render: (row) => scheduleText(row),
  },
  {
    title: '默认负责人',
    key: 'default_owner_name',
    width: 120,
    render: (row) => row.default_owner_name || '店家',
  },
  {
    title: '备注',
    key: 'remark',
    minWidth: 140,
    ellipsis: { tooltip: true },
    render: (row) => row.remark || '—',
  },
  {
    title: '状态',
    key: 'is_active',
    width: 80,
    render: (row) => h(NTag, { size: 'small', type: row.is_active ? 'success' : 'default' }, { default: () => (row.is_active ? '启用' : '停用') }),
  },
  {
    title: '操作',
    key: 'actions',
    width: 115,
    fixed: 'right',
    render: (row) => actionBar([
      actionIcon({ icon: 'edit', label: '编辑', onClick: () => openEdit(row) }),
      actionIcon({
        icon: row.is_active ? 'disable' : 'enable',
        label: row.is_active ? '停用' : '启用',
        onClick: () => toggleActive(row),
      }),
      actionIcon({ icon: 'delete', label: '删除', onClick: () => confirmDelete(row) }),
    ]),
  },
])

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    templates.value = await routeTripApi.templates()
  } catch (e: any) {
    loadError.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(form, emptyForm())
  newStopId.value = null
  formVisible.value = true
}

function openEdit(row: RouteTemplate) {
  Object.assign(form, {
    id: row.id,
    name: row.name,
    remark: row.remark || '',
    is_active: row.is_active,
    default_owner_id: row.default_owner_id,
    schedule_type: row.schedule_type || 'none',
    schedule_weekdays: [...(row.schedule_weekdays || [])],
    schedule_month_days: [...(row.schedule_month_days || [])],
    stops: row.stops.map((s) => {
      const opt = stopMap.value.get(s.region_id)
      return {
        region_id: s.region_id,
        region_name: s.region_name || opt?.name || `#${s.region_id}`,
        parent_name: s.parent_region_name ?? opt?.parentName ?? null,
        level: opt?.level ?? (s.origin === 'county' ? 3 : 4),
        origin: s.origin,
      }
    }),
  })
  newStopId.value = null
  formVisible.value = true
}

function addStop() {
  if (!newStopId.value) return
  const opt = stopMap.value.get(newStopId.value)
  if (!opt) return
  form.stops.push({
    region_id: opt.value,
    region_name: opt.name,
    parent_name: opt.parentName,
    level: opt.level,
    origin: opt.level === 3 ? 'county' : 'manual',
  })
  newStopId.value = null
}

function moveStop(index: number, offset: number) {
  const next = index + offset
  if (next < 0 || next >= form.stops.length) return
  const [item] = form.stops.splice(index, 1)
  form.stops.splice(next, 0, item)
}

function removeStop(index: number) {
  form.stops.splice(index, 1)
}

async function save() {
  if (!form.name.trim()) return message.warning('请填写路线名称')
  if (!form.stops.length) return message.warning('请至少添加一个途径地点')
  if (form.schedule_type === 'weekly' && !form.schedule_weekdays.length) {
    return message.warning('按周循环至少选择一个发车日')
  }
  if (form.schedule_type === 'monthly' && !form.schedule_month_days.length) {
    return message.warning('按月循环至少选择一个发车日')
  }
  const payload: RouteTemplateSavePayload = {
    name: form.name.trim(),
    remark: form.remark.trim() || null,
    is_active: form.is_active,
    default_owner_id: form.default_owner_id,
    schedule_type: form.schedule_type,
    schedule_weekdays: form.schedule_type === 'weekly' ? [...form.schedule_weekdays].sort((a, b) => a - b) : [],
    schedule_month_days: form.schedule_type === 'monthly' ? [...form.schedule_month_days].sort((a, b) => a - b) : [],
    stops: form.stops.map((s) => ({ region_id: s.region_id, origin: s.origin })),
  }
  saving.value = true
  try {
    if (form.id) {
      await routeTripApi.updateTemplate(form.id, payload)
    } else {
      await routeTripApi.createTemplate(payload)
    }
    message.success('路线已保存')
    formVisible.value = false
    await load()
  } finally {
    saving.value = false
  }
}

async function toggleActive(row: RouteTemplate) {
  await routeTripApi.updateTemplate(row.id, { is_active: !row.is_active })
  message.success(row.is_active ? '已停用' : '已启用')
  await load()
}

function confirmDelete(row: RouteTemplate) {
  dialog.warning({
    title: '删除路线',
    content: `确认删除路线「${row.name}」？已安排的历史出车不受影响。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await routeTripApi.deleteTemplate(row.id)
      message.success('已删除')
      await load()
    },
  })
}

onMounted(async () => {
  await Promise.all([
    load(),
    regionApi.tree().then((tree) => { regions.value = tree }),
    adminCustomerApi.salesOptions().then((rows) => {
      ownerOptions.value = rows.map((u) => ({
        label: u.is_admin ? `管理员·${u.name}` : u.name,
        value: u.id,
      }))
    }),
  ])
})
</script>

<style scoped>
.page-container { min-width: 0; }
.card-section { min-width: 0; overflow: hidden; }
.page-note { margin: 4px 0 0; font-size: 12px; color: var(--text-3); }
.block-alert { margin-bottom: 12px; }
.filter-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; }
.stop-tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.stop-total { margin-left: auto; font-size: 12px; color: var(--text-3); }
.stop-list { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 12px; }
.stop-row { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 9px 12px; border-top: 1px solid var(--border); }
.stop-row:first-child { border-top: 0; }
.stop-seq { color: var(--text-3); text-align: center; width: 24px; }
.stop-name { font-weight: 500; display: flex; align-items: center; }
.stop-empty { padding: 20px 0; }
.month-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; width: 100%; }
.empty { padding: 48px 0; }
.row-actions { display: flex; align-items: center; gap: 8px; }
.muted { color: var(--text-3); font-size: 12px; }
@media (max-width: 760px) {
  .form-grid { grid-template-columns: 1fr; }
}
</style>
