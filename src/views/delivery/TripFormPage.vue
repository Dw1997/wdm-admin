<template>
  <div class="page-container trip-form-page">
    <div class="page-header">
      <div>
        <n-button text type="primary" class="back-link" @click="goBack">← 返回出车列表</n-button>
        <h2 class="page-title">{{ isEdit ? '修改出车' : '安排出车' }}</h2>
        <p class="subtitle">选择出车日期和自送路线，右侧实时预览覆盖客户与将自动加入的待送货自送订单。</p>
      </div>
    </div>

    <n-alert v-if="loadError" type="error" :bordered="false" class="block-alert">
      页面加载失败：{{ loadError }}
      <n-button text type="primary" size="small" style="margin-left: 8px" @click="init">重试</n-button>
    </n-alert>

    <n-spin :show="loading">
      <div class="arrange-grid">
        <div class="card-section form-card">
          <h3>出车信息</h3>
          <n-form label-placement="top">
            <n-form-item label="出车日期" required>
              <n-date-picker
                v-model:formatted-value="form.trip_date"
                type="date"
                value-format="yyyy-MM-dd"
                :is-date-disabled="disablePastDate"
                style="width: 100%"
              />
            </n-form-item>

            <n-form-item label="选择路线" required>
              <div class="route-select-row">
                <n-select
                  v-model:value="form.template_id"
                  :options="templateOptions"
                  filterable
                  placeholder="请选择一条自送路线"
                  style="flex: 1"
                  @update:value="onTemplateChange"
                />
                <n-button text type="primary" @click="router.push('/delivery/places')">去路线设置</n-button>
              </div>
              <template #feedback>
                <span v-if="!templates.length" class="muted">还没有启用的自送路线，请先到「路线设置」新建。</span>
              </template>
            </n-form-item>

            <n-form-item label="负责人" required>
              <n-select v-model:value="form.owner_id" :options="ownerOptions" filterable placeholder="选择负责人" />
            </n-form-item>

            <n-form-item label="出车名称">
              <n-input v-model:value="form.name" maxlength="50" placeholder="选填，默认使用路线名称" />
            </n-form-item>
          </n-form>

          <n-divider title-placement="left">途径地点（{{ selectedStops.length }}）</n-divider>
          <div v-if="selectedStops.length" class="stop-list">
            <div v-for="(stop, index) in selectedStops" :key="stop.region_id" class="stop-row">
              <span class="stop-seq">{{ index + 1 }}</span>
              <span class="stop-name">
                {{ stop.region_name }}
                <span v-if="stop.parent_region_name" class="muted" style="margin-left: 6px">{{ stop.parent_region_name }}</span>
              </span>
              <n-button size="tiny" text type="error" :disabled="selectedStops.length <= 1" @click="removeStop(index)">移除</n-button>
            </div>
          </div>
          <n-empty v-else description="选择路线后自动带出途径地点" size="small" style="padding: 20px 0" />
        </div>

        <div class="card-section preview-card">
          <div class="preview-head">
            <h3>本趟预览</h3>
            <n-spin v-if="draftLoading" size="small" />
          </div>

          <n-alert v-if="draftError" type="error" :bordered="false" class="block-alert">
            预览刷新失败：{{ draftError }}
            <n-button text type="primary" size="small" style="margin-left: 8px" @click="refreshDraft">重试</n-button>
          </n-alert>

          <div class="kpi-row">
            <div class="kpi-box">
              <div class="kpi-label">将列入询单客户</div>
              <div class="kpi-value">{{ draft?.customer_count ?? 0 }}<small>位</small></div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">将自动加入订单</div>
              <div class="kpi-value">{{ includedJoinCount }} / {{ draft?.join_orders.length ?? 0 }}<small>张</small></div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">将自动挪过来</div>
              <div class="kpi-value">{{ draft?.move_orders.length ?? 0 }}<small>张</small></div>
            </div>
          </div>

          <n-alert
            v-for="(w, i) in draft?.warnings || []"
            :key="i"
            type="warning"
            :bordered="false"
            class="block-alert"
          >
            {{ w.message }}
          </n-alert>

          <div class="preview-section">
            <div class="section-title">将自动加入的待送货自送订单（取消勾选则保留在待排车）</div>
            <div v-if="draft?.join_orders.length" class="order-list">
              <label v-for="o in draft.join_orders" :key="o.order_id" class="order-row">
                <n-checkbox
                  :checked="!excludedOrderIds.has(o.order_id)"
                  @update:checked="(checked: boolean) => toggleExclude(o.order_id, checked)"
                />
                <div class="order-main">
                  <b>{{ o.order_no }}</b>
                  <span class="muted">{{ o.customer_name }} · {{ o.region_name || '—' }}</span>
                </div>
                <span class="order-amount">¥{{ formatNum(o.total_amount) }}</span>
              </label>
            </div>
            <div v-else class="empty-note">暂无符合条件的待排车自送订单</div>
          </div>

          <div v-if="draft?.move_orders.length" class="preview-section">
            <div class="section-title">将从更晚趟次自动挪过来的订单</div>
            <div class="order-list">
              <div v-for="o in draft.move_orders" :key="o.order_id" class="order-row readonly">
                <div class="order-main">
                  <b>{{ o.order_no }}</b>
                  <span class="muted">{{ o.customer_name }} · 原 {{ o.from_trip_date }} → {{ o.to_trip_date }}</span>
                </div>
                <span class="order-amount">¥{{ formatNum(o.total_amount) }}</span>
              </div>
            </div>
          </div>

          <div v-if="isEdit && draft?.return_orders.length" class="preview-section">
            <div class="section-title">将退回待排车的订单</div>
            <div class="order-list">
              <div v-for="o in draft.return_orders" :key="o.order_id" class="order-row readonly">
                <div class="order-main">
                  <b>{{ o.order_no }}</b>
                  <span class="muted">{{ o.customer_name }} · {{ o.region_name || '—' }}</span>
                </div>
                <span class="order-amount">¥{{ formatNum(o.total_amount) }}</span>
              </div>
            </div>
          </div>

          <div class="preview-footer">
            <n-button @click="goBack">取消</n-button>
            <n-button type="primary" :loading="saving" :disabled="!canSave" @click="save">
              {{ isEdit ? '保存修改' : '保存出车' }}
            </n-button>
          </div>
        </div>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage, type SelectOption } from 'naive-ui'
import { adminCustomerApi, routeTripApi } from '@/api'
import type { RouteStopOrigin, RouteTemplate, RouteTripDraft } from '@/types'

interface SelectedStop {
  region_id: number
  region_name: string
  parent_region_name: string | null
  origin: RouteStopOrigin
}

const route = useRoute()
const router = useRouter()
const message = useMessage()

const tripId = computed(() => (route.params.id ? Number(route.params.id) : null))
const isEdit = computed(() => tripId.value !== null && Number.isFinite(tripId.value))

const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const draftLoading = ref(false)
const draftError = ref('')
const draft = ref<RouteTripDraft | null>(null)
const templates = ref<RouteTemplate[]>([])
const ownerOptions = ref<SelectOption[]>([])
const defaultOwnerId = ref<number | null>(null)
const selectedStops = ref<SelectedStop[]>([])
const excludedOrderIds = ref<Set<number>>(new Set())

function tomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function disablePastDate(ts: number) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return ts < today.getTime()
}

const form = reactive({
  trip_date: tomorrowStr(),
  name: '',
  owner_id: null as number | null,
  template_id: null as number | null,
})

const templateOptions = computed<SelectOption[]>(() =>
  templates.value.map((t) => ({
    label: `${t.name}（${t.stops_text || `${t.stops.length} 个地点`}）`,
    value: t.id,
  })),
)

const includedJoinCount = computed(() => {
  if (!draft.value) return 0
  return draft.value.join_orders.filter((o) => !excludedOrderIds.value.has(o.order_id)).length
})

const canSave = computed(() => Boolean(form.trip_date && form.owner_id && selectedStops.value.length > 0))

function formatNum(v: number | string | null | undefined) {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function onTemplateChange(tplId: number | null) {
  if (!tplId) {
    selectedStops.value = []
    draft.value = null
    return
  }
  const tpl = templates.value.find((t) => t.id === tplId)
  if (!tpl) return
  selectedStops.value = tpl.stops.map((s) => ({
    region_id: s.region_id,
    region_name: s.region_name,
    parent_region_name: s.parent_region_name,
    origin: s.origin,
  }))
  if (!isEdit.value) {
    form.name = tpl.name
    if (tpl.default_owner_id) form.owner_id = tpl.default_owner_id
    else if (defaultOwnerId.value) form.owner_id = defaultOwnerId.value
    if (tpl.next_trip_date) form.trip_date = tpl.next_trip_date
  }
  excludedOrderIds.value = new Set()
  scheduleDraft()
}

function removeStop(index: number) {
  if (selectedStops.value.length <= 1) return
  selectedStops.value.splice(index, 1)
  scheduleDraft()
}

function toggleExclude(orderId: number, checked: boolean) {
  const next = new Set(excludedOrderIds.value)
  if (checked) next.delete(orderId)
  else next.add(orderId)
  excludedOrderIds.value = next
}

let draftTimer: ReturnType<typeof setTimeout> | null = null
let draftSeq = 0

function scheduleDraft() {
  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = setTimeout(() => {
    refreshDraft()
  }, 250)
}

async function refreshDraft() {
  if (!form.trip_date || !selectedStops.value.length) {
    draft.value = null
    return
  }
  const seq = ++draftSeq
  draftLoading.value = true
  draftError.value = ''
  try {
    const res = await routeTripApi.draft({
      trip_date: form.trip_date,
      template_id: form.template_id ?? undefined,
      stops: selectedStops.value.map((s) => ({ region_id: s.region_id, origin: s.origin })),
      trip_id: isEdit.value ? tripId.value ?? undefined : undefined,
      exclude_order_ids: Array.from(excludedOrderIds.value),
    })
    if (seq === draftSeq) {
      draft.value = res
    }
  } catch (e: any) {
    if (seq === draftSeq) {
      draftError.value = e?.message || '草稿预览失败'
    }
  } finally {
    if (seq === draftSeq) {
      draftLoading.value = false
    }
  }
}

watch(() => form.trip_date, () => {
  if (selectedStops.value.length) scheduleDraft()
})

async function save() {
  if (!form.trip_date) return message.warning('请选择出车日期')
  if (!selectedStops.value.length) return message.warning('请选择路线')
  if (!form.owner_id) return message.warning('请选择负责人')

  saving.value = true
  try {
    const payload = {
      trip_date: form.trip_date,
      name: form.name.trim() || null,
      owner_id: form.owner_id,
      template_id: form.template_id,
      stops: selectedStops.value.map((s) => ({ region_id: s.region_id, origin: s.origin })),
      exclude_order_ids: Array.from(excludedOrderIds.value),
    }
    const res = isEdit.value && tripId.value
      ? await routeTripApi.update(tripId.value, payload)
      : await routeTripApi.create(payload)
    const joined = res.joined_orders?.length ?? 0
    const moved = res.moved_orders?.length ?? 0
    message.success(`已保存出车（自动加入 ${joined} 单，自动挪单 ${moved} 单）`)
    router.push({ path: '/delivery/trips', query: { highlight: String(res.route_trip.id) } })
  } finally {
    saving.value = false
  }
}

function goBack() {
  router.push('/delivery/trips')
}

async function init() {
  loading.value = true
  loadError.value = ''
  try {
    const [tpls, owners] = await Promise.all([
      routeTripApi.templates({ is_active: true }),
      adminCustomerApi.salesOptions(),
    ])
    templates.value = tpls
    ownerOptions.value = owners.map((u) => ({
      label: u.is_admin ? `管理员·${u.name}` : u.name,
      value: u.id,
    }))
    const ownerAccount = owners.find((u) => u.is_owner) || owners.find((u) => u.is_admin) || owners[0]
    defaultOwnerId.value = ownerAccount?.id ?? null

    if (isEdit.value && tripId.value) {
      const trip = await routeTripApi.get(tripId.value)
      if (trip.status !== 'planned') {
        message.warning('该出车已不能修改')
        return goBack()
      }
      form.trip_date = trip.trip_date
      form.name = trip.name || ''
      form.owner_id = trip.owner_id
      form.template_id = trip.template_id
      selectedStops.value = trip.stops.map((s) => ({
        region_id: s.region_id,
        region_name: s.region_name,
        parent_region_name: s.parent_region_name,
        origin: s.origin,
      }))
      await refreshDraft()
    } else {
      form.owner_id = defaultOwnerId.value
    }
  } catch (e: any) {
    loadError.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(init)
</script>

<style scoped>
.back-link { margin-bottom: 4px; padding: 0; }
.subtitle { margin: 4px 0 0; font-size: 12px; color: var(--text-3); }
.block-alert { margin-bottom: 12px; }
.arrange-grid { display: grid; grid-template-columns: minmax(340px, 440px) minmax(0, 1fr); gap: 16px; align-items: start; }
.form-card h3, .preview-card h3 { margin: 0 0 14px; font-size: 15px; }
.route-select-row { display: flex; align-items: center; gap: 10px; width: 100%; }
.stop-list { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.stop-row { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--border); }
.stop-row:first-child { border-top: 0; }
.stop-seq { color: var(--text-3); text-align: center; }
.stop-name { font-weight: 500; }
.preview-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.preview-head h3 { margin: 0; }
.kpi-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
.kpi-box { padding: 12px; border: 1px solid var(--border); border-radius: 8px; }
.kpi-label { font-size: 12px; color: var(--text-3); }
.kpi-value { font-size: 22px; font-weight: 700; margin-top: 4px; }
.kpi-value small { font-size: 12px; font-weight: 400; margin-left: 4px; color: var(--text-3); }
.preview-section { margin-bottom: 14px; }
.section-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.order-list { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; max-height: 280px; overflow-y: auto; }
.order-row { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-top: 1px solid var(--border); cursor: pointer; }
.order-row.readonly { cursor: default; }
.order-row:first-child { border-top: 0; }
.order-main { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.order-amount { font-weight: 600; }
.empty-note { padding: 14px; text-align: center; font-size: 12px; color: var(--text-3); border: 1px dashed var(--border); border-radius: 8px; }
.preview-footer { display: flex; justify-content: flex-end; gap: 10px; padding-top: 12px; border-top: 1px solid var(--border); margin-top: 16px; }
.muted { color: var(--text-3); font-size: 12px; }
@media (max-width: 960px) {
  .arrange-grid { grid-template-columns: 1fr; }
}
</style>
