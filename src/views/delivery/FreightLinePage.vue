<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <div>
          <h2 class="page-title">物流路线</h2>
          <p class="page-note">维护物流车信息、收货地址、发车时间及途径地点；一辆车可编排多个发车班次。</p>
        </div>
        <n-button type="primary" @click="openCreate">新建物流</n-button>
      </div>

      <div class="filter-bar">
        <n-input v-model:value="keyword" clearable placeholder="物流名称 / 收货地址 / 车牌 / 司机" style="width: 240px" @keyup.enter="load" />
        <n-select v-model:value="statusFilter" clearable placeholder="状态" style="width: 130px" :options="statusOptions" @update:value="load" />
        <n-select v-model:value="townFilter" clearable filterable placeholder="途径地点（县城 / 乡镇）" style="width: 220px" :options="stopOptions" @update:value="load" />
        <n-button type="primary" size="small" @click="load">查询</n-button>
        <n-button size="small" @click="resetFilters">重置</n-button>
      </div>

      <n-data-table
        :columns="columns"
        :data="lines"
        :loading="loading"
        :bordered="false"
        size="small"
        :scroll-x="1120"
        :row-key="(r: FreightLine) => r.id"
      >
        <template #empty>
          <n-empty description="还没有物流路线，先新建一条" class="empty" />
        </template>
      </n-data-table>
    </div>

    <n-modal v-model:show="formVisible" preset="card" :title="form.id ? '编辑物流' : '新建物流'" style="width: 780px; max-width: 95vw" :mask-closable="false">
      <n-form label-placement="left" label-width="96">
        <div class="form-grid">
          <n-form-item label="物流名称" required><n-input v-model:value="form.name" maxlength="100" placeholder="如：城南物流 / XX 专线" /></n-form-item>
          <n-form-item label="车牌"><n-input v-model:value="form.plate_no" maxlength="50" placeholder="如：川A12345" /></n-form-item>
          <n-form-item label="司机电话"><n-input v-model:value="form.driver_phone" maxlength="30" placeholder="司机联系电话" /></n-form-item>
          <n-form-item label="司机姓名"><n-input v-model:value="form.driver_name" maxlength="50" placeholder="选填" /></n-form-item>
          <n-form-item label="收货地址" class="full-span"><n-input v-model:value="form.receive_address" maxlength="200" placeholder="物流停靠点 / 货场收货地址" /></n-form-item>
          <n-form-item label="截单提前">
            <n-input-number v-model:value="form.cutoff_minutes" :min="0" :precision="0" style="width: 100%" placeholder="留空用系统默认（全班次共用）">
              <template #suffix>分钟</template>
            </n-input-number>
          </n-form-item>
          <n-form-item label="启用"><n-switch v-model:value="form.is_active" /></n-form-item>
        </div>

        <n-divider title-placement="left">发车时间（一天可多趟）</n-divider>
        <div class="schedule-tools">
          <n-button size="small" type="primary" secondary @click="addSchedule">+ 添加班次</n-button>
          <span class="muted">保存时自动按发车时间排序；修改班次不影响已生成的批次。</span>
        </div>
        <div class="schedule-list">
          <div v-for="(item, index) in form.schedules" :key="index" class="schedule-row">
            <span class="stop-seq">{{ index + 1 }}</span>
            <n-time-picker
              v-model:formatted-value="item.depart_time"
              format="HH:mm"
              value-format="HH:mm"
              style="width: 150px"
              placeholder="发车时间"
            />
            <n-input
              v-model:value="item.label"
              maxlength="30"
              placeholder="班次备注（选填，如：午班、下午班）"
              style="flex: 1"
            />
            <n-button size="tiny" text type="error" :disabled="form.schedules.length <= 1" @click="removeSchedule(index)">删除</n-button>
          </div>
        </div>

        <n-divider title-placement="left">途径地点（县城 / 乡镇）</n-divider>
        <div class="stop-tools">
          <n-select v-model:value="newStopId" :options="availableStopOptions" filterable clearable placeholder="添加县城或乡镇（精确匹配）" style="width: 280px" />
          <n-button type="primary" secondary :disabled="!newStopId" @click="addStop">添加</n-button>
          <span class="stop-total">共 {{ form.stops.length }} 个站点 · 覆盖 {{ totalCustomers }} 位客户</span>
        </div>

        <div v-if="form.stops.length" class="stop-list">
          <div v-for="(stop, index) in form.stops" :key="stop.town_region_id" class="stop-row">
            <span class="stop-seq">{{ index + 1 }}</span>
            <span class="stop-name">
              {{ stop.town_name }}
              <n-tag v-if="stop.level === 3" size="tiny" type="info" style="margin-left: 6px">县城</n-tag>
            </span>
            <span class="stop-count">{{ stop.customer_count }} 位客户</span>
            <n-space :size="4">
              <n-button size="tiny" text :disabled="index === 0" @click="moveStop(index, -1)">上移</n-button>
              <n-button size="tiny" text :disabled="index === form.stops.length - 1" @click="moveStop(index, 1)">下移</n-button>
              <n-button size="tiny" text type="error" @click="removeStop(index)">移除</n-button>
            </n-space>
          </div>
        </div>
        <n-empty v-else description="至少添加一个站点" size="small" class="stop-empty" />
      </n-form>

      <template #footer>
        <n-button @click="formVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="save">保存</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { NButton, NTag, useDialog, useMessage, type DataTableColumns, type SelectOption } from 'naive-ui'
import { deliveryApi, regionApi } from '@/api'
import type { FreightLine, FreightLinePayload, RegionNode } from '@/types'
import { actionBar, actionIcon } from '@/components/tableActions'

interface StopDraft {
  town_region_id: number
  town_name: string
  level: number
  customer_count: number
}

interface ScheduleDraft {
  depart_time: string | null
  label: string
}

const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const saving = ref(false)
const lines = ref<FreightLine[]>([])
const regions = ref<RegionNode[]>([])
const keyword = ref('')
const statusFilter = ref<'active' | 'inactive' | null>(null)
const townFilter = ref<number | null>(null)
const formVisible = ref(false)
const newStopId = ref<number | null>(null)

const emptyForm = () => ({
  id: 0,
  name: '',
  plate_no: '',
  driver_name: '',
  driver_phone: '',
  receive_address: '',
  schedules: [{ depart_time: '12:00', label: '' }] as ScheduleDraft[],
  cutoff_minutes: null as number | null,
  is_active: true,
  stops: [] as StopDraft[],
})
const form = reactive(emptyForm())

const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
]

interface RegionStopOption extends SelectOption {
  label: string
  value: number
  name: string
  level: number
}

function flattenStops(nodes: RegionNode[], county = ''): RegionStopOption[] {
  const out: RegionStopOption[] = []
  for (const node of nodes) {
    if (node.level === 3) {
      out.push({
        label: `${node.name}（县城）`,
        value: node.id,
        name: node.name,
        level: 3,
      })
      out.push(...flattenStops(node.children || [], node.name))
    } else if (node.level === 4) {
      out.push({
        label: county ? `${county} / ${node.name}` : node.name,
        value: node.id,
        name: node.name,
        level: 4,
      })
    } else {
      out.push(...flattenStops(node.children || [], county))
    }
  }
  return out
}

const allStops = computed(() => flattenStops(regions.value))
const stopOptions = computed<SelectOption[]>(() => allStops.value.map(({ label, value }) => ({ label: label as string, value })))
const availableStopOptions = computed<SelectOption[]>(() => {
  const used = new Set(form.stops.map((stop) => stop.town_region_id))
  return stopOptions.value.filter((option) => !used.has(option.value as number))
})
const totalCustomers = computed(() => form.stops.reduce((sum, stop) => sum + stop.customer_count, 0))

const columns = computed<DataTableColumns<FreightLine>>(() => [
  {
    title: '物流名称',
    key: 'name',
    minWidth: 160,
    render: (row) => h('div', [
      h(NButton, { text: true, type: 'primary', onClick: () => openEdit(row) }, { default: () => row.name }),
      h('div', { class: 'muted' }, `${row.stops.length} 个途径地点`),
    ]),
  },
  {
    title: '途径地点',
    key: 'stops',
    minWidth: 220,
    ellipsis: { tooltip: true },
    render: (row) => row.stops.map((stop) => (stop.level === 3 ? `${stop.town_name}[县]` : stop.town_name)).join(' → ') || '—',
  },
  {
    title: '发车时间',
    key: 'schedules',
    minWidth: 160,
    render: (row) => h(
      'div',
      { class: 'schedule-tags' },
      (row.schedules || []).map((s) =>
        h(
          NTag,
          { size: 'small', bordered: false, type: 'info' },
          { default: () => (s.label ? `${s.depart_time} ${s.label}` : s.depart_time) },
        ),
      ),
    ),
  },
  {
    title: '收货地址',
    key: 'receive_address',
    minWidth: 180,
    ellipsis: { tooltip: true },
    render: (row) => row.receive_address || '—',
  },
  {
    title: '司机电话 / 车牌',
    key: 'vehicle',
    width: 170,
    render: (row) => h('div', [
      h('div', [row.driver_phone, row.driver_name].filter(Boolean).join(' · ') || '—'),
      h('div', { class: 'muted' }, row.plate_no || '—'),
    ]),
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
    width: 90,
    fixed: 'right',
    render: (row) => actionBar([
      actionIcon({ icon: 'edit', label: '编辑', onClick: () => openEdit(row) }),
      actionIcon({
        icon: row.is_active ? 'disable' : 'enable',
        label: row.is_active ? '停用' : '启用',
        onClick: () => toggleLine(row),
      }),
    ]),
  },
])

async function load() {
  loading.value = true
  try {
    lines.value = await deliveryApi.freightLines({
      keyword: keyword.value.trim() || undefined,
      is_active: statusFilter.value == null ? undefined : statusFilter.value === 'active',
      town_region_id: townFilter.value ?? undefined,
    })
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  keyword.value = ''
  statusFilter.value = null
  townFilter.value = null
  load()
}

function openCreate() {
  Object.assign(form, emptyForm())
  newStopId.value = null
  formVisible.value = true
}

function openEdit(line: FreightLine) {
  Object.assign(form, {
    id: line.id,
    name: line.name,
    plate_no: line.plate_no || '',
    driver_name: line.driver_name || '',
    driver_phone: line.driver_phone || '',
    receive_address: line.receive_address || '',
    schedules: line.schedules?.length
      ? line.schedules.map((s) => ({ depart_time: s.depart_time, label: s.label || '' }))
      : [{ depart_time: '12:00', label: '' }],
    cutoff_minutes: line.cutoff_minutes,
    is_active: line.is_active,
    stops: line.stops.map((stop) => ({
      town_region_id: stop.town_region_id,
      town_name: stop.town_name,
      level: stop.level ?? 4,
      customer_count: stop.customer_count,
    })),
  })
  newStopId.value = null
  formVisible.value = true
}

function addSchedule() {
  form.schedules.push({ depart_time: '16:30', label: '' })
}

function removeSchedule(index: number) {
  if (form.schedules.length <= 1) return
  form.schedules.splice(index, 1)
}

function addStop() {
  const stop = allStops.value.find((item) => item.value === newStopId.value)
  if (!stop) return
  form.stops.push({ town_region_id: stop.value, town_name: stop.name, level: stop.level, customer_count: 0 })
  newStopId.value = null
}

function moveStop(index: number, offset: number) {
  const next = index + offset
  if (next < 0 || next >= form.stops.length) return
  const [stop] = form.stops.splice(index, 1)
  form.stops.splice(next, 0, stop)
}

function removeStop(index: number) {
  const stop = form.stops[index]
  if (!form.id) {
    form.stops.splice(index, 1)
    return
  }
  dialog.warning({
    title: '移除站点',
    content: `移除「${stop.town_name}」后，该地点的未交车订单仍留在原批次，并标记为“站点已移除”。确认移除？`,
    positiveText: '确认移除',
    negativeText: '取消',
    onPositiveClick: () => form.stops.splice(index, 1),
  })
}

function payload(): FreightLinePayload {
  return {
    name: form.name.trim(),
    plate_no: form.plate_no.trim() || null,
    driver_name: form.driver_name.trim() || null,
    driver_phone: form.driver_phone.trim() || null,
    receive_address: form.receive_address.trim() || null,
    schedules: form.schedules.map((s) => ({
      depart_time: s.depart_time || '08:00',
      label: s.label.trim() || null,
    })),
    cutoff_minutes: form.cutoff_minutes,
    is_active: form.is_active,
    stops: form.stops.map((stop) => ({ town_region_id: stop.town_region_id })),
  }
}

async function save() {
  if (!form.name.trim()) return message.warning('请填写线路名称')
  if (!form.schedules.length) return message.warning('至少添加一个发车班次')
  const times: string[] = []
  for (const s of form.schedules) {
    if (!s.depart_time) return message.warning('请完善所有班次的发车时间')
    if (times.includes(s.depart_time)) return message.warning(`发车时间 ${s.depart_time} 重复`)
    times.push(s.depart_time)
  }
  if (!form.stops.length) return message.warning('至少添加一个站点')
  const stopIds = form.stops.map((stop) => stop.town_region_id)
  if (new Set(stopIds).size !== stopIds.length) return message.warning('站点不能重复')
  saving.value = true
  try {
    const result = form.id
      ? await deliveryApi.updateFreightLine(form.id, payload())
      : await deliveryApi.createFreightLine(payload())
    for (const warning of result.warnings || []) message.warning(warning.message)
    if (!result.warnings?.length) message.success('线路已保存')
    formVisible.value = false
    await load()
  } finally {
    saving.value = false
  }
}

function toggleLine(line: FreightLine) {
  if (line.is_active) {
    dialog.warning({
      title: '停用线路',
      content: '停用后新订单不再匹配这条线路，已有未交车批次仍可交车。确认停用？',
      positiveText: '确认停用',
      negativeText: '取消',
      onPositiveClick: () => updateStatus(line, false),
    })
  } else {
    updateStatus(line, true)
  }
}

async function updateStatus(line: FreightLine, isActive: boolean) {
  const result = await deliveryApi.updateFreightLine(line.id, { is_active: isActive })
  for (const warning of result.warnings || []) message.warning(warning.message)
  message.success(isActive ? '已启用' : '已停用')
  await load()
}

onMounted(async () => {
  await Promise.all([
    load(),
    regionApi.tree().then((tree) => { regions.value = tree }),
  ])
})
</script>

<style scoped>
.page-container { min-width: 0; }
.card-section { min-width: 0; overflow: hidden; }
.page-note { margin: 4px 0 0; font-size: 12px; color: var(--text-3); }
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 14px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; }
.full-span { grid-column: 1 / -1; }
.schedule-tools { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.schedule-list { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 12px; }
.schedule-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-top: 1px solid var(--border); }
.schedule-row:first-child { border-top: 0; }
.schedule-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.stop-tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.stop-total { margin-left: auto; font-size: 12px; color: var(--text-3); }
.stop-list { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.stop-row { display: grid; grid-template-columns: 36px minmax(0, 1fr) 90px auto; align-items: center; gap: 10px; padding: 9px 12px; border-top: 1px solid var(--border); }
.stop-row:first-child { border-top: 0; }
.stop-seq { color: var(--text-3); text-align: center; width: 24px; }
.stop-name { font-weight: 500; display: flex; align-items: center; }
.stop-count { color: var(--text-3); font-size: 12px; }
.stop-empty { padding: 20px 0; }
.empty { padding: 48px 0; }
.row-actions { display: flex; align-items: center; gap: 8px; }
.muted { color: var(--text-3); font-size: 12px; }
@media (max-width: 760px) {
  .form-grid { grid-template-columns: 1fr; }
  .stop-row { grid-template-columns: 28px minmax(0, 1fr) auto; }
  .stop-count { display: none; }
}
</style>
