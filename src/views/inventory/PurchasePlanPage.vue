<template>
  <div class="purchase-plan-page">
    <!-- 筛选栏 -->
    <n-card size="small" class="filter-card">
      <n-space align="center" justify="space-between" :wrap="true" :size="[12, 10]">
        <n-space align="center" :wrap="true" :size="[10, 8]">
          <n-radio-group v-model:value="scopeMode" size="small" @update:value="onScopeModeChange">
            <n-radio-button value="all_pending">全部待配送</n-radio-button>
            <n-radio-button value="route_trip">按出车趟次</n-radio-button>
            <n-radio-button value="freight_shipment">按物流批次</n-radio-button>
            <n-radio-button value="date">按日期</n-radio-button>
          </n-radio-group>

          <n-select
            v-if="scopeMode === 'route_trip'"
            v-model:value="selectedTripId"
            :options="tripOptions"
            placeholder="选择出车趟次"
            clearable
            filterable
            size="small"
            style="width: 240px"
            @update:value="loadPreview"
          />

          <n-select
            v-if="scopeMode === 'freight_shipment'"
            v-model:value="selectedShipmentId"
            :options="shipmentOptions"
            placeholder="选择物流批次"
            clearable
            filterable
            size="small"
            style="width: 240px"
            @update:value="loadPreview"
          />

          <n-date-picker
            v-if="scopeMode === 'date'"
            v-model:formatted-value="selectedDate"
            type="date"
            value-format="yyyy-MM-dd"
            size="small"
            style="width: 150px"
            @update:formatted-value="loadPreview"
          />

          <n-select
            v-model:value="selectedSupplierId"
            :options="vendorFilterOptions"
            placeholder="全部供应商"
            clearable
            filterable
            size="small"
            style="width: 180px"
            @update:value="loadPreview"
          />

          <n-space align="center" :size="6">
            <n-switch v-model:value="includeSelfShortage" size="small" @update:value="loadPreview" />
            <span class="switch-label">包含自营缺口商品</span>
          </n-space>
        </n-space>

        <n-space align="center" :size="8">
          <n-button size="small" :loading="loading" @click="loadPreview">刷新</n-button>
          <n-button size="small" :disabled="!plan?.groups.length" @click="printGroups(plan?.groups || [])">
            打印全部
          </n-button>
          <n-button
            v-if="hasAnyCreatable"
            type="primary"
            size="small"
            :loading="creatingReceipts"
            @click="createReceiptsForGroups(creatableGroups)"
          >
            一键生成草稿入库单（{{ creatableGroups.length }} 组）
          </n-button>
        </n-space>
      </n-space>
    </n-card>

    <!-- 汇总卡 -->
    <div v-if="plan" class="summary-grid">
      <n-card size="small">
        <div class="stat-label">需拿货供应商</div>
        <div class="stat-value">{{ plan.summary.supplier_count }} <span class="stat-unit">家</span></div>
      </n-card>
      <n-card size="small">
        <div class="stat-label">待拿商品项</div>
        <div class="stat-value">
          {{ plan.summary.item_count }} <span class="stat-unit">项</span>
          <span v-if="checkedCount > 0" class="stat-sub">（已核对 {{ checkedCount }}）</span>
        </div>
      </n-card>
      <n-card size="small">
        <div class="stat-label">涉及待配送订单</div>
        <div class="stat-value">{{ plan.summary.order_count }} <span class="stat-unit">单</span></div>
      </n-card>
      <n-card size="small">
        <div class="stat-label">预估拿货总额</div>
        <div class="stat-value stat-money">¥{{ fmtMoney(plan.summary.estimated_amount) }}</div>
      </n-card>
    </div>

    <!-- 分组清单 -->
    <n-spin :show="loading">
      <div v-if="!loading && (!plan || !plan.groups.length)" class="empty-wrap">
        <n-empty :description="emptyTip" />
      </div>

      <n-space v-else-if="plan" vertical :size="14">
        <n-card
          v-for="group in plan.groups"
          :key="group.supplier_id"
          size="small"
          class="vendor-card"
        >
          <template #header>
            <div class="vendor-header">
              <div class="vendor-title-wrap">
                <span class="vendor-name">{{ group.supplier_name || '未指定供应商' }}</span>
                <n-tag
                  size="small"
                  :type="group.supplier_id === 0 ? 'default' : 'info'"
                  :bordered="false"
                >
                  {{ group.supplier_id === 0 ? '自营补货' : '供应商拿货' }}
                </n-tag>
                <span v-if="group.supplier_phone" class="vendor-meta">电话：{{ group.supplier_phone }}</span>
                <span v-if="group.supplier_address" class="vendor-meta">地址：{{ group.supplier_address }}</span>
              </div>
              <div class="vendor-summary">
                <span>{{ group.item_count }} 项</span>
                <span class="vendor-amount">预估 ¥{{ fmtMoney(group.estimated_amount) }}</span>
              </div>
            </div>
          </template>

          <template #header-extra>
            <n-space :size="8">
              <n-button size="tiny" secondary @click="copyGroupText(group)">复制拿货文本</n-button>
              <n-button size="tiny" secondary @click="printGroups([group])">打印本组</n-button>
              <n-button
                v-if="group.can_create_receipt"
                size="tiny"
                type="primary"
                :loading="creatingReceipts"
                @click="createReceiptsForGroups([group])"
              >
                生成草稿入库单
              </n-button>
            </n-space>
          </template>

          <n-table :bordered="false" :single-line="false" size="small" class="plan-table">
            <thead>
              <tr>
                <th style="width: 48px; text-align: center">已拿</th>
                <th style="min-width: 220px">商品 / 规格</th>
                <th style="width: 170px">需拿货 / 缺口</th>
                <th v-if="group.can_create_receipt" style="width: 130px">建议采购量</th>
                <th style="width: 110px; text-align: right">参考进价</th>
                <th style="width: 110px; text-align: right">预估金额</th>
                <th style="min-width: 260px">来源订单与拿货单</th>
                <th v-if="group.can_create_receipt" style="width: 160px">临时换供应商</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in group.items"
                :key="item.item_key"
                :class="{ 'row-checked': isChecked(item.item_key) }"
              >
                <td style="text-align: center">
                  <n-checkbox
                    :checked="isChecked(item.item_key)"
                    @update:checked="(v: boolean) => toggleChecked(item.item_key, v)"
                  />
                </td>
                <td>
                  <div class="sku-cell">
                    <span class="sku-name">{{ item.sku_name }}</span>
                    <n-tag
                      size="tiny"
                      :type="item.supply_mode === 'temp_pick' ? 'warning' : 'success'"
                      :bordered="false"
                    >
                      {{ item.supply_mode === 'temp_pick' ? '临时拿货' : '自营商品' }}
                    </n-tag>
                    <n-tag v-if="item.has_auto_receipt && !item.can_create_receipt" size="tiny" type="info" :bordered="false">
                      已自动记应付
                    </n-tag>
                  </div>
                  <div v-if="item.on_hand !== null" class="sub-text">
                    现有库存 {{ item.on_hand }} {{ item.base_unit }} · 待送需求 {{ item.required_quantity }} {{ item.unit }}
                  </div>
                </td>
                <td>
                  <span class="qty-highlight">{{ item.display }}</span>
                </td>
                <td v-if="group.can_create_receipt">
                  <n-input-number
                    v-if="item.can_create_receipt"
                    :value="getDraftQty(item)"
                    :min="0.1"
                    :step="1"
                    :precision="1"
                    size="small"
                    style="width: 112px"
                    @update:value="(v: number | null) => setDraftQty(item.item_key, v)"
                  />
                  <span v-else class="muted">—</span>
                </td>
                <td style="text-align: right">¥{{ fmtCost(item.suggested_unit_cost) }}</td>
                <td style="text-align: right; font-weight: 600">¥{{ fmtMoney(item.estimated_amount) }}</td>
                <td>
                  <div class="orders-list">
                    <div
                      v-for="ord in item.orders"
                      :key="ord.order_item_id"
                      class="order-ref-row"
                    >
                      <span class="order-customer">{{ ord.customer_name || '客户' }}</span>
                      <span class="order-no">{{ ord.order_no }}</span>
                      <span class="order-qty">× {{ ord.quantity }}{{ ord.unit }}</span>
                      <span class="order-cost">@ ¥{{ fmtCost(ord.unit_cost) }}</span>
                      <n-button
                        v-if="ord.purchase_receipt_id && ord.receipt_status === 'confirmed'"
                        text
                        type="primary"
                        size="tiny"
                        @click="openCorrectModal(item, ord)"
                      >
                        更正进价/换供应商
                      </n-button>
                      <n-tag
                        v-else-if="ord.purchase_receipt_id"
                        size="tiny"
                        :bordered="false"
                      >
                        草稿#{{ ord.purchase_receipt_id }}
                      </n-tag>
                    </div>
                  </div>
                </td>
                <td v-if="group.can_create_receipt">
                  <n-select
                    v-if="item.can_create_receipt"
                    :value="getOverrideSupplier(item, group.supplier_id)"
                    :options="vendorOverrideOptions"
                    size="small"
                    filterable
                    style="width: 145px"
                    @update:value="(v: number) => onOverrideSupplier(item, v)"
                  />
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </n-table>
        </n-card>
      </n-space>
    </n-spin>

    <!-- 临时拿货单快捷更正弹窗 -->
    <n-modal
      v-model:show="correctVisible"
      preset="card"
      title="更正临时拿货实际进价 / 供应商"
      style="width: 480px"
    >
      <n-form v-if="correctTarget" label-placement="left" label-width="96" size="small">
        <n-form-item label="商品规格">
          <span>{{ correctTarget.skuName }}</span>
        </n-form-item>
        <n-form-item label="关联订单">
          <span>{{ correctTarget.orderNo }}（{{ correctTarget.customerName }} · × {{ correctTarget.quantity }}{{ correctTarget.unit }}）</span>
        </n-form-item>
        <n-form-item label="供应商" required>
          <n-select
            v-model:value="correctForm.vendor_id"
            :options="vendorOnlyOptions"
            filterable
            placeholder="选择供应商"
          />
        </n-form-item>
        <n-form-item label="实际进价" required>
          <n-input-number
            v-model:value="correctForm.unit_cost"
            :min="0"
            :precision="4"
            :step="0.5"
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="更正原因" required>
          <n-input
            v-model:value="correctForm.reason"
            placeholder="如：市场拿货实际涨价 / 临时换档口拿货"
            maxlength="200"
          />
        </n-form-item>
      </n-form>
      <div class="modal-tip">
        保存后将自动冲正原供应商应付、按新值重记应付，并同步重算该订单成本与利润。
      </div>
      <template #footer>
        <n-space justify="end">
          <n-button size="small" @click="correctVisible = false">取消</n-button>
          <n-button size="small" type="primary" :loading="correctSaving" @click="submitCorrect">
            确认更正
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDialog, useMessage } from 'naive-ui'
import {
  freightShipmentApi,
  purchaseApi,
  purchasePlanApi,
  routeTripApi,
  vendorApi,
} from '@/api'
import type {
  FreightShipment,
  PurchasePlanGroup,
  PurchasePlanItem,
  PurchasePlanOrderRef,
  PurchasePlanPreviewResult,
  PurchasePlanScopeMode,
  PurchasePlanSupplierOverride,
  RouteTrip,
  Vendor,
} from '@/types'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const scopeMode = ref<PurchasePlanScopeMode>('all_pending')
const selectedTripId = ref<number | null>(null)
const selectedShipmentId = ref<number | null>(null)
const selectedDate = ref<string>(todayYmd())
const selectedSupplierId = ref<number | null>(null)
const includeSelfShortage = ref(false)

const loading = ref(false)
const creatingReceipts = ref(false)
const plan = ref<PurchasePlanPreviewResult | null>(null)

const trips = ref<RouteTrip[]>([])
const shipments = ref<FreightShipment[]>([])
const vendors = ref<Vendor[]>([])

const supplierOverrides = ref<PurchasePlanSupplierOverride[]>([])
const draftQuantities = reactive<Record<string, number>>({})
const checkedMap = reactive<Record<string, boolean>>({})

const correctVisible = ref(false)
const correctSaving = ref(false)
const correctTarget = ref<{
  receiptId: number
  version: number
  skuName: string
  orderNo: string
  customerName: string
  quantity: string
  unit: string
} | null>(null)
const correctForm = reactive({
  vendor_id: 0,
  unit_cost: 0,
  reason: '市场拿货实际核对',
})

function todayYmd(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fmtMoney(v: string | number | null | undefined): string {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function fmtCost(v: string | number | null | undefined): string {
  const n = Number(v ?? 0)
  if (!Number.isFinite(n)) return '0'
  return parseFloat(n.toFixed(4)).toString()
}

const tripOptions = computed(() =>
  trips.value.map((t) => ({
    label: `${t.trip_date} ${t.name || `趟次#${t.id}`}（${t.order_count ?? 0}单）`,
    value: t.id,
  })),
)

const shipmentOptions = computed(() =>
  shipments.value.map((s) => ({
    label: `${s.ship_date} ${s.line_name || `物流批次#${s.id}`}（${s.order_count ?? 0}单）`,
    value: s.id,
  })),
)

const vendorOnlyOptions = computed(() =>
  vendors.value.map((v) => ({
    label: v.name,
    value: v.id,
  })),
)

const vendorFilterOptions = computed(() => [
  { label: '自己进货', value: 0 },
  ...vendorOnlyOptions.value,
])

const vendorOverrideOptions = computed(() => [
  { label: '自己进货', value: 0 },
  ...vendorOnlyOptions.value,
])

const creatableGroups = computed(() =>
  (plan.value?.groups || []).filter((g) => g.can_create_receipt),
)

const hasAnyCreatable = computed(() => creatableGroups.value.length > 0)

const emptyTip = computed(() => {
  if (scopeMode.value === 'route_trip' && !selectedTripId.value) {
    return '请选择一个出车趟次'
  }
  if (scopeMode.value === 'freight_shipment' && !selectedShipmentId.value) {
    return '请选择一个物流批次'
  }
  return includeSelfShortage.value
    ? '当前范围内没有需要去供应商拿货或自营缺口的商品'
    : '当前范围内没有需要去供应商拿的货（可打开“包含自营缺口商品”查看自营缺口）'
})

const storageKey = computed(() => {
  const scopePart =
    scopeMode.value === 'route_trip'
      ? `trip:${selectedTripId.value || 0}`
      : scopeMode.value === 'freight_shipment'
        ? `ship:${selectedShipmentId.value || 0}`
        : scopeMode.value === 'date'
          ? `date:${selectedDate.value}`
          : 'all'
  return `wdm_admin_purchase_plan_checked:${scopePart}`
})

function loadCheckedFromStorage() {
  Object.keys(checkedMap).forEach((k) => delete checkedMap[k])
  try {
    const raw = localStorage.getItem(storageKey.value)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, boolean>
    Object.entries(parsed).forEach(([k, v]) => {
      if (v) checkedMap[k] = true
    })
  } catch {
    /* ignore */
  }
}

function isChecked(key: string): boolean {
  return Boolean(checkedMap[key])
}

function toggleChecked(key: string, val: boolean) {
  if (val) checkedMap[key] = true
  else delete checkedMap[key]
  try {
    localStorage.setItem(storageKey.value, JSON.stringify(checkedMap))
  } catch {
    /* ignore */
  }
}

const checkedCount = computed(() => {
  if (!plan.value) return 0
  let cnt = 0
  for (const g of plan.value.groups) {
    for (const it of g.items) {
      if (checkedMap[it.item_key]) cnt += 1
    }
  }
  return cnt
})

function getDraftQty(item: PurchasePlanItem): number {
  if (draftQuantities[item.item_key] !== undefined) {
    return draftQuantities[item.item_key]
  }
  const parsed = Number(item.shortage_quantity)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function setDraftQty(key: string, val: number | null) {
  if (val !== null && val > 0) {
    draftQuantities[key] = val
  }
}

function getOverrideSupplier(item: PurchasePlanItem, currentSupplierId: number): number {
  const hit = supplierOverrides.value.find(
    (o) => o.spu_id === item.spu_id && (o.sku_id ?? null) === (item.sku_id ?? null),
  )
  return hit ? hit.supplier_id : currentSupplierId
}

function onOverrideSupplier(item: PurchasePlanItem, supplierId: number) {
  const idx = supplierOverrides.value.findIndex(
    (o) => o.spu_id === item.spu_id && (o.sku_id ?? null) === (item.sku_id ?? null),
  )
  if (idx >= 0) {
    supplierOverrides.value[idx].supplier_id = supplierId
  } else {
    supplierOverrides.value.push({
      spu_id: item.spu_id,
      sku_id: item.sku_id,
      supplier_id: supplierId,
    })
  }
  loadPreview()
}

function onScopeModeChange() {
  if (scopeMode.value === 'route_trip' && !selectedTripId.value && trips.value.length) {
    selectedTripId.value = trips.value[0].id
  }
  if (scopeMode.value === 'freight_shipment' && !selectedShipmentId.value && shipments.value.length) {
    selectedShipmentId.value = shipments.value[0].id
  }
  loadPreview()
}

async function loadOptions() {
  try {
    const [tripRes, shipRes, vendorRes] = await Promise.all([
      routeTripApi.list({ status: 'planned', page: 1, page_size: 50 }),
      freightShipmentApi.list({ status: 'pending', page: 1, page_size: 50 }),
      vendorApi.list({ page: 1, page_size: 100 }),
    ])
    trips.value = tripRes?.items || []
    shipments.value = shipRes?.items || []
    vendors.value = Array.isArray(vendorRes) ? vendorRes : vendorRes?.items || []
  } catch {
    /* ignore */
  }
}

async function loadPreview() {
  if (scopeMode.value === 'route_trip' && !selectedTripId.value) {
    plan.value = null
    return
  }
  if (scopeMode.value === 'freight_shipment' && !selectedShipmentId.value) {
    plan.value = null
    return
  }
  loading.value = true
  try {
    const res = await purchasePlanApi.preview({
      route_trip_id: scopeMode.value === 'route_trip' ? selectedTripId.value : undefined,
      freight_shipment_id: scopeMode.value === 'freight_shipment' ? selectedShipmentId.value : undefined,
      date: scopeMode.value === 'date' ? selectedDate.value : undefined,
      supplier_id: selectedSupplierId.value ?? undefined,
      include_self_shortage: includeSelfShortage.value,
      supplier_overrides: supplierOverrides.value.length ? supplierOverrides.value : undefined,
    })
    plan.value = res
    loadCheckedFromStorage()
  } catch (e: any) {
    message.error(e?.message || '加载采购清单失败')
  } finally {
    loading.value = false
  }
}

function formatGroupPlainText(group: PurchasePlanGroup): string {
  const lines: string[] = []
  const header = `【采购拿货单】${group.supplier_name}${group.supplier_phone ? `（${group.supplier_phone}）` : ''}`
  lines.push(header)
  if (plan.value?.scope.label) {
    lines.push(`范围：${plan.value.scope.label}`)
  }
  lines.push('----------------')
  group.items.forEach((it, idx) => {
    lines.push(`${idx + 1}. ${it.sku_name}：${it.display}`)
  })
  lines.push('----------------')
  lines.push(`共 ${group.item_count} 项，预估 ¥${fmtMoney(group.estimated_amount)}`)
  return lines.join('\n')
}

async function copyGroupText(group: PurchasePlanGroup) {
  const text = formatGroupPlainText(group)
  try {
    await navigator.clipboard.writeText(text)
    message.success(`已复制「${group.supplier_name}」拿货清单，可直接粘贴发送`)
  } catch {
    message.error('复制失败，请手动选中复制')
  }
}

function printGroups(groups: PurchasePlanGroup[]) {
  if (!groups.length) return
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const blocks = groups
    .map((g) => {
      const rows = g.items
        .map(
          (it, idx) => `
          <tr>
            <td style="text-align:center">☐</td>
            <td>${idx + 1}</td>
            <td>${esc(it.sku_name)}</td>
            <td style="font-weight:bold">${esc(it.display)}</td>
            <td style="text-align:right">¥${fmtCost(it.suggested_unit_cost)}</td>
            <td>${esc(it.order_nos.join('、'))}</td>
          </tr>`,
        )
        .join('')
      return `
        <div class="vendor-block">
          <h3>${esc(g.supplier_name)} ${g.supplier_phone ? `（${esc(g.supplier_phone)}）` : ''}</h3>
          ${g.supplier_address ? `<div class="addr">地址：${esc(g.supplier_address)}</div>` : ''}
          <table>
            <thead>
              <tr>
                <th style="width:40px">已拿</th>
                <th style="width:36px">#</th>
                <th>商品 / 规格</th>
                <th style="width:150px">需拿货量</th>
                <th style="width:90px">参考进价</th>
                <th>涉及单号</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`
    })
    .join('')

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    message.warning('请允许浏览器弹出打印窗口')
    return
  }
  win.document.write(`<!doctype html>
  <html><head><meta charset="utf-8"><title>采购清单 - ${esc(plan.value?.scope.label || '')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; padding: 20px; color: #111; }
    h2 { margin: 0 0 6px; }
    .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
    .vendor-block { margin-bottom: 22px; page-break-inside: avoid; }
    .vendor-block h3 { margin: 0 0 4px; font-size: 16px; }
    .addr { color: #555; font-size: 12px; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; }
  </style></head><body>
    <h2>采购清单（${esc(plan.value?.scope.label || '')}）</h2>
    <div class="meta">打印时间：${new Date().toLocaleString()}</div>
    ${blocks}
  </body></html>`)
  win.document.close()
  win.focus()
  win.print()
}

function openCorrectModal(item: PurchasePlanItem, ord: PurchasePlanOrderRef) {
  if (!ord.purchase_receipt_id || ord.receipt_version === null) return
  correctTarget.value = {
    receiptId: ord.purchase_receipt_id,
    version: ord.receipt_version,
    skuName: item.sku_name,
    orderNo: ord.order_no,
    customerName: ord.customer_name,
    quantity: ord.quantity,
    unit: ord.unit,
  }
  correctForm.vendor_id = ord.vendor_id
  correctForm.unit_cost = Number(ord.unit_cost)
  correctForm.reason = '市场拿货实际核对'
  correctVisible.value = true
}

async function submitCorrect() {
  if (!correctTarget.value) return
  if (!correctForm.vendor_id || correctForm.vendor_id <= 0) {
    message.warning('请选择供应商')
    return
  }
  if (!correctForm.reason.trim()) {
    message.warning('请填写更正原因')
    return
  }
  correctSaving.value = true
  try {
    await purchaseApi.update(correctTarget.value.receiptId, {
      version: correctTarget.value.version,
      vendor_id: correctForm.vendor_id,
      unit_cost: Number(correctForm.unit_cost).toFixed(4),
      reason: correctForm.reason.trim(),
    })
    message.success('已更正进价/供应商并同步重算应付和利润')
    correctVisible.value = false
    await loadPreview()
  } catch (e: any) {
    message.error(e?.message || '更正失败')
  } finally {
    correctSaving.value = false
  }
}

async function createReceiptsForGroups(groups: PurchasePlanGroup[]) {
  const payloadGroups = groups
    .map((g) => ({
      supplier_id: g.supplier_id,
      items: g.items
        .filter((it) => it.can_create_receipt)
        .map((it) => ({
          spu_id: it.spu_id,
          sku_id: it.sku_id,
          quantity: getDraftQty(it).toFixed(1),
          unit_cost: it.suggested_unit_cost,
        })),
    }))
    .filter((g) => g.items.length > 0)

  if (!payloadGroups.length) {
    message.info('没有可生成草稿入库单的商品行')
    return
  }

  creatingReceipts.value = true
  try {
    const idemKey = `plan-to-receipts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const res = await purchasePlanApi.toReceipts(
      {
        groups: payloadGroups,
        remark: `采购清单生成（${plan.value?.scope.label || ''}）`,
      },
      idemKey,
    )
    const count = res.receipts?.length || payloadGroups.length
    dialog.success({
      title: '草稿入库单已生成',
      content: `已生成 ${count} 张草稿入库单，请前往「采购入库」核对实际数量和进价后确认入库。`,
      positiveText: '前往采购入库',
      negativeText: '留在当前页',
      onPositiveClick: () => {
        router.push('/inventory/purchases')
      },
    })
  } catch (e: any) {
    message.error(e?.message || '生成草稿入库单失败')
  } finally {
    creatingReceipts.value = false
  }
}

onMounted(async () => {
  await loadOptions()
  await loadPreview()
})
</script>

<style scoped>
.purchase-plan-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.filter-card {
  border-radius: 10px;
}

.switch-label {
  font-size: 13px;
  color: var(--n-text-color-2);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.stat-label {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}

.stat-unit {
  font-size: 13px;
  font-weight: 400;
  color: var(--n-text-color-3);
}

.stat-sub {
  font-size: 12px;
  font-weight: 400;
  color: #18a058;
  margin-left: 6px;
}

.stat-money {
  color: #d03050;
}

.vendor-card {
  border-radius: 10px;
}

.vendor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.vendor-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.vendor-name {
  font-size: 16px;
  font-weight: 600;
}

.vendor-meta {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.vendor-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--n-text-color-2);
}

.vendor-amount {
  font-weight: 600;
  color: #d03050;
}

.plan-table .row-checked td {
  opacity: 0.55;
  text-decoration: line-through;
}

.sku-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.sku-name {
  font-weight: 500;
}

.sub-text {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 2px;
}

.qty-highlight {
  font-size: 15px;
  font-weight: 700;
  color: #2080f0;
}

.orders-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.order-ref-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12px;
}

.order-customer {
  font-weight: 500;
}

.order-no {
  color: var(--n-text-color-3);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.order-qty {
  font-weight: 600;
}

.order-cost {
  color: var(--n-text-color-3);
}

.muted {
  color: var(--n-text-color-3);
}

.empty-wrap {
  padding: 48px 0;
}

.modal-tip {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 4px;
}

@media (max-width: 960px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
