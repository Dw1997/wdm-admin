<template>
  <div class="counter-page">
    <section class="card head-card">
      <div class="head-field">
        <span class="label">客户</span>
        <n-select
          v-model:value="customerId"
          :options="customerOptions"
          :loading="customerLoading"
          filterable
          remote
          placeholder="门店散客"
          style="width: 220px"
          @search="loadCustomers"
          @update:show="(show: boolean) => show && loadCustomers('')"
          @update:value="onCustomerChange"
        />
      </div>
      <div class="head-field">
        <span class="label">业务员</span>
        <n-select
          v-model:value="salesId"
          :options="salesOptionsUI"
          placeholder="店家"
          style="width: 200px"
        />
      </div>
      <div class="head-meta">
        <template v-if="selectedCustomer">
          <span v-if="customerAccount" class="meta-pill">欠款 <b>{{ yuan(customerAccount.ar_balance) }}</b></span>
          <span v-if="customerAccount && Number(customerAccount.overdue_amount) > 0" class="meta-pill danger">
            逾期 <b>{{ yuan(customerAccount.overdue_amount) }}</b>（{{ customerAccount.max_overdue_days }} 天）
          </span>
          <span class="meta-pill">额度 <b>{{ yuan(selectedCustomer.effective_credit_limit) }}</b></span>
          <span v-if="selectedCustomer.status !== 'active'" class="meta-pill danger">客户状态：{{ selectedCustomer.status }}</span>
        </template>
        <span v-else class="meta-pill">散客 · 必须当场付清</span>
      </div>
      <div class="spacer" />
      <n-button text type="primary" @click="suspendCurrent">挂起当前单</n-button>
      <n-button text type="primary" @click="suspendVisible = true">
        挂起单 <span class="badge">{{ suspended.length }}</span>
      </n-button>
    </section>

    <section class="card table-card">
      <div class="table-head">
        <div class="cell">商品 <span class="sub">（名称 / 拼音 / 条码）</span></div>
        <div class="cell">规格</div>
        <div class="cell">数量</div>
        <div class="cell">售价</div>
        <div class="cell total-head">总价</div>
        <div class="cell" />
      </div>
      <div ref="tableBodyEl" class="table-body">
        <div
          v-for="row in rows"
          :key="row.key"
          :data-key="row.key"
          class="row"
          :class="{ focused: activeRowKey === row.key }"
        >
          <div class="cell product-cell">
            <input
              v-model="row.query"
              class="product-input"
              :placeholder="row.spuId ? '' : '搜索商品 / 拼音首字母 / 扫码'"
              autocomplete="off"
              @focus="onProductFocus($event, row)"
              @input="onProductInput(row)"
              @keydown="onProductKeydown($event, row)"
              @blur="onProductBlur(row)"
            >
            <button v-if="row.spuId" class="clear-btn" type="button" title="清空该行" @click="clearRow(row)">×</button>
          </div>

          <div class="cell">
            <select
              v-model="row.skuId"
              class="sku-select"
              :disabled="!row.spuId || row.skuOptions.length <= 1"
              @change="onSkuChange(row)"
            >
              <option v-if="!row.spuId" value="">—</option>
              <option v-for="sku in row.skuOptions" :key="sku.id" :value="sku.id">
                {{ skuLabel(sku) }}{{ skuUnit(sku) && skuLabel(sku) !== skuUnit(sku) ? `（${skuUnit(sku)}）` : '' }}
              </option>
            </select>
          </div>

          <div class="cell">
            <div class="qty-wrap" :class="{ disabled: !row.spuId }">
              <input
                v-model="row.qty"
                class="qty-input"
                :disabled="!row.spuId"
                inputmode="decimal"
                @input="onQtyInput(row)"
                @blur="onQtyBlur(row)"
              >
              <span class="unit">{{ row.unit || '—' }}</span>
            </div>
            <div v-if="row.spuId" class="stock-line" :class="{ warn: stockWarn(row) }">
              {{ stockText(row) }}
            </div>
            <div v-else class="stock-line" />
          </div>

          <div class="cell">
            <div class="price-wrap" :class="{ disabled: !row.spuId, manual: row.manual }">
              <span class="yen">¥</span>
              <input
                v-model="row.unitPrice"
                class="price-input"
                :disabled="!row.spuId"
                inputmode="decimal"
                @blur="onPriceBlur(row)"
                @keydown.enter.prevent="blurInput"
              >
            </div>
            <div class="price-meta">
              <span v-if="row.spuId" :class="{ 'tag-manual': row.manual }">
                {{ row.manual ? '手动改价' : sourceLabel(row.priceSource) }}
              </span>
            </div>
          </div>

          <div class="cell total-cell">{{ row.spuId ? money(rowTotal(row)) : '—' }}</div>

          <div class="cell del-cell">
            <n-button v-if="row.spuId" quaternary circle size="tiny" title="删除该行" @click="removeRow(row)">
              <template #icon><n-icon :component="Trash" /></template>
            </n-button>
          </div>
        </div>

        <div v-if="!filledRows.length" class="empty-hint">
          输入商品名称、拼音首字母或条码，也可以直接用扫码枪扫码<br>
          <kbd>Enter</kbd> 选中商品后自动跳到数量，再按 <kbd>Enter</kbd> 加下一行
        </div>
      </div>
    </section>

    <section class="card foot-card">
      <div class="foot-top">
        <div class="total-block">
          <div class="total-label">应收合计</div>
          <div class="total-amount">{{ money(totalCents) }}</div>
          <div class="total-sub">{{ filledRows.length ? `${filledRows.length} 行商品` : '还没有商品' }}</div>
        </div>
        <div class="foot-fields">
          <div class="mini-field">
            <span class="label">抹零</span>
            <input
              v-model="rounding"
              class="input money"
              inputmode="decimal"
              :disabled="paymentMethod === 'credit'"
              placeholder="0.00"
              @blur="normalizeRounding"
            >
          </div>
          <div class="mini-field">
            <span class="label">收款方式</span>
            <n-select v-model:value="paymentMethod" :options="paymentOptions" style="width: 130px" :disabled="!filledRows.length" />
          </div>
          <div class="mini-field">
            <span class="label">{{ paymentMethod === 'credit' ? '挂账金额' : '实收' }}</span>
            <input
              v-model="received"
              class="input money"
              :readonly="paymentMethod !== 'cash'"
              inputmode="decimal"
              :disabled="!filledRows.length"
            >
          </div>
          <div v-if="paymentMethod === 'cash'" class="mini-field">
            <span class="label">找零</span>
            <span class="static-money" :class="{ danger: changeCents < 0 }">
              {{ changeCents >= 0 ? money(changeCents) : `还差 ${money(-changeCents)}` }}
            </span>
          </div>
          <div class="mini-field">
            <span class="label">备注</span>
            <input v-model="remark" class="input" style="width: 180px" placeholder="可不填" maxlength="50">
          </div>
        </div>
      </div>
      <div class="foot-actions">
        <n-button type="primary" size="large" :loading="saving" @click="submit(false)">保存</n-button>
        <n-button size="large" :loading="saving" @click="submit(true)">打单</n-button>
        <n-button size="large" disabled title="打印机暂未接入，先置灰">打单并打印</n-button>
      </div>
    </section>

    <!-- 商品搜索下拉 -->
    <Teleport to="body">
      <div
        v-if="searchOpen"
        class="search-pop"
        :style="searchStyle"
        @mousedown.prevent
      >
        <div v-if="searchLoading" class="pop-empty">搜索中…</div>
        <template v-else-if="searchResults.length">
          <div
            v-for="(spu, index) in searchResults"
            :key="spu.id"
            class="pop-item"
            :class="{ active: index === searchIndex }"
            @mouseenter="searchIndex = index"
            @mousedown.prevent="chooseSpu(spu)"
          >
            <div class="pop-name">
              {{ spu.name }}
              <span class="pop-tag">{{ spu.code }}</span>
              <span class="pop-tag">{{ spu.base_unit || '斤' }}</span>
            </div>
            <div class="pop-sub">{{ spu.sku_count || 0 }} 个规格 · 回车添加</div>
          </div>
        </template>
        <div v-else class="pop-empty">没有找到商品</div>
      </div>
    </Teleport>

    <!-- 销售单结果 -->
    <n-modal
      v-model:show="receiptVisible"
      preset="card"
      title="销售单已生成"
      style="width: 640px; max-height: 90vh"
      :bordered="false"
      @after-leave="focusFirstSearch"
    >
      <div class="receipt-meta">{{ receiptMeta }}</div>
      <div class="receipt-box">
        <img :src="receiptImage" alt="销售单">
      </div>
      <template #footer>
        <div class="modal-actions">
          <n-button @click="copyReceipt">复制图片</n-button>
          <n-button @click="saveReceiptImage">保存图片</n-button>
          <n-button type="primary" @click="closeReceipt">开下一单</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 挂起单 -->
    <n-modal v-model:show="suspendVisible" preset="card" title="挂起单" style="width: 560px" :bordered="false">
      <div v-if="!suspended.length" class="suspend-empty">暂无挂起单</div>
      <div v-for="item in suspended" :key="item.id" class="suspend-item">
        <div class="suspend-info">
          <div class="suspend-customer">{{ item.customerName }}</div>
          <div class="suspend-sub">{{ item.time }} · {{ item.rows.length }} 行商品 · 预估 {{ item.totalText }}</div>
        </div>
        <div class="suspend-actions">
          <n-button size="small" @click="restoreSuspended(item)">恢复</n-button>
          <n-button size="small" quaternary type="error" @click="deleteSuspended(item)">删除</n-button>
        </div>
      </div>
      <template #footer>
        <div class="modal-actions">
          <span class="tip">挂起单只保存在本机浏览器</span>
          <n-button @click="suspendCurrent">挂起当前单</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import { Trash } from '@vicons/tabler'
import type { SelectOption } from 'naive-ui'
import { adminCustomerApi, orderApi, priceApi, productApi } from '@/api'
import { formatDate } from '@/utils/format'
import type {
  AdminCustomer,
  CustomerAccount,
  CounterOrder,
  CounterOrderPayload,
  CounterPaymentMethod,
  PriceQuoteItem,
  ProductSKU,
  ProductSPU,
  SalesOption,
} from '@/types'

interface SaleRow {
  key: string
  spuId: number | null
  spuName: string
  skuId: number | null
  skuName: string
  unit: string
  allowDecimal: boolean
  baseQty: string
  qty: string
  unitPrice: string
  quotedPrice: string
  minPrice: string
  priceSource: string
  stockOnHand: string | null
  manual: boolean
  skuOptions: ProductSKU[]
  query: string
}

interface SuspendedRow {
  spuId: number
  spuName: string
  skuId: number
  qty: string
  unitPrice: string
  manual: boolean
}

interface SuspendedOrder {
  id: string
  time: string
  customerId: number
  salesId: number | null
  customerName: string
  totalText: string
  rows: SuspendedRow[]
}

const message = useMessage()
const dialog = useDialog()
const SUSPEND_KEY = 'wdm_counter_suspend_v1'
const PAYMENT_LABELS: Record<string, string> = {
  wechat: '微信支付',
  cash: '现金',
  alipay: '支付宝',
  other: '其他',
  credit: '挂账',
}
const SOURCE_LABELS: Record<string, string> = {
  contract: '专属价',
  level: '等级价',
  suggested: '建议价',
  manual: '手动改价',
}

const customerId = ref<number>(0)
const customers = ref<AdminCustomer[]>([])
const customerAccount = ref<CustomerAccount | null>(null)
const customerLoading = ref(false)
const customerOptions = ref<{ label: string; value: number }[]>([{ label: '门店散客', value: 0 }])
const salesId = ref<number | null>(null)
const salesOptions = ref<SalesOption[]>([])
const rows = ref<SaleRow[]>([newRow()])
type PaymentChoice = CounterPaymentMethod | 'credit'
const paymentMethod = ref<PaymentChoice>('wechat')
const rounding = ref('0.00')
const received = ref('')
const remark = ref('')
const saving = ref(false)
const activeRowKey = ref<string | null>(null)
const tableBodyEl = ref<HTMLElement | null>(null)

const searchOpen = ref(false)
const searchLoading = ref(false)
const searchResults = ref<ProductSPU[]>([])
const searchIndex = ref(0)
const searchRowKey = ref<string | null>(null)
const searchStyle = ref<Record<string, string>>({ left: '0px', top: '0px', width: '420px' })
let searchTimer: number | undefined
let searchToken = 0

const receiptVisible = ref(false)
const receiptImage = ref('')
const receiptMeta = ref('')
let receiptCanvas: HTMLCanvasElement | null = null
let receiptOrder: CounterOrder | null = null

const suspendVisible = ref(false)
const suspended = ref<SuspendedOrder[]>(loadSuspended())

const selectedCustomer = computed(() => customers.value.find(c => c.id === customerId.value) || null)
const salesOptionsUI = computed<SelectOption[]>(() =>
  salesOptions.value.map(s => ({
    label: s.is_owner
      ? `店家（${s.name}）`
      : `${s.name}（${s.is_admin ? '管理员' : '销售'}）`,
    value: s.id,
  })),
)
const filledRows = computed(() => rows.value.filter(r => r.spuId && r.skuId))
const totalCents = computed(() => filledRows.value.reduce((sum, r) => sum + rowTotalCents(r), 0))
const roundingCents = computed(() => Math.min(Math.max(parseCents(rounding.value), 0), totalCents.value))
const payableCents = computed(() => Math.max(totalCents.value - roundingCents.value, 0))
const receivedCents = computed(() => {
  if (paymentMethod.value === 'credit') return 0
  if (paymentMethod.value === 'cash') return parseCents(received.value)
  return payableCents.value
})
const changeCents = computed(() => receivedCents.value - payableCents.value)
const paymentOptions = computed<SelectOption[]>(() => {
  const opts: SelectOption[] = [
    { label: '微信支付', value: 'wechat' },
    { label: '现金', value: 'cash' },
    { label: '支付宝', value: 'alipay' },
    { label: '其他', value: 'other' },
  ]
  if (selectedCustomer.value) opts.push({ label: '挂账', value: 'credit' })
  return opts
})

function newRow(): SaleRow {
  return {
    key: `r${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    spuId: null,
    spuName: '',
    skuId: null,
    skuName: '',
    unit: '',
    allowDecimal: true,
    baseQty: '1',
    qty: '1',
    unitPrice: '0.00',
    quotedPrice: '0.00',
    minPrice: '0.00',
    priceSource: '',
    stockOnHand: null,
    manual: false,
    skuOptions: [],
    query: '',
  }
}

function parseCents(value: string | number | null | undefined): number {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
function money(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}
function yuan(value: string | number | null | undefined): string {
  const n = Number(value)
  return `¥${(Number.isFinite(n) ? n : 0).toFixed(2)}`
}
function moneyText(cents: number): string {
  return (cents / 100).toFixed(2)
}
function rowTotalCents(row: SaleRow): number {
  return Math.round((Number(row.qty) || 0) * parseCents(row.unitPrice))
}
function rowTotal(row: SaleRow): number {
  return rowTotalCents(row)
}
function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] || ''
}
function sanitizeQty(row: SaleRow, value: string): string {
  if (row.allowDecimal) {
    return value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
  }
  return value.replace(/[^\d]/g, '')
}
function fmtQty(value: string | number): string {
  const n = Number(value)
  return Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : ''
}
function skuUnit(sku: ProductSKU): string {
  return String(sku.specs?.['规格'] || '')
}
function skuLabel(sku: ProductSKU): string {
  const specs = sku.specs || {}
  const others = Object.entries(specs)
    .filter(([key]) => key !== '规格')
    .map(([, value]) => String(value))
    .filter(Boolean)
  if (others.length) return others.join(' / ')
  return String(specs['规格'] || sku.remark || `规格 ${sku.id}`)
}
function stockWarn(row: SaleRow): boolean {
  return row.stockOnHand !== null && Number(row.qty) > Number(row.stockOnHand)
}
function stockText(row: SaleRow): string {
  if (row.stockOnHand === null || row.stockOnHand === undefined) return '库存 —'
  return `库存 ${fmtQty(row.stockOnHand)} ${row.unit}`
}

/* ---------- 客户 / 业务员 ---------- */
async function loadCustomers(keyword = '') {
  customerLoading.value = true
  try {
    const list = await adminCustomerApi.list({ keyword: keyword || undefined, page_size: 20, status: 'active' })
    const merged = new Map(customers.value.map(c => [c.id, c]))
    list.forEach(c => merged.set(c.id, c))
    customers.value = [...merged.values()]
    customerOptions.value = [
      { label: '门店散客', value: 0 },
      ...customers.value.map(c => ({ label: c.name + (c.phone ? ` · ${c.phone}` : ''), value: c.id })),
    ]
  } catch {
    /* 请求层已经提示 */
  } finally {
    customerLoading.value = false
  }
}

function onCustomerChange() {
  if (!selectedCustomer.value) {
    customerId.value = 0
    customerAccount.value = null
    if (paymentMethod.value === 'credit') paymentMethod.value = 'wechat'
  } else {
    customerAccount.value = null
    void loadAccount(customerId.value)
  }
  syncReceived()
  void quoteAll()
}

async function loadAccount(id: number) {
  try {
    const data = await adminCustomerApi.account(id)
    if (customerId.value === id) customerAccount.value = data
  } catch {
    if (customerId.value === id) customerAccount.value = null
  }
}

/* ---------- 商品搜索 ---------- */
function onProductFocus(event: FocusEvent, row: SaleRow) {
  activeRowKey.value = row.key
  const input = event.target as HTMLInputElement
  if (row.spuId) {
    input.select()
    return
  }
  openSearch(row, input, '')
}

function onProductInput(row: SaleRow) {
  activeRowKey.value = row.key
  searchRowKey.value = row.key
  const input = document.activeElement as HTMLInputElement
  if (!input || !input.classList.contains('product-input')) return
  openSearch(row, input, row.query)
}

function onProductKeydown(event: KeyboardEvent, row: SaleRow) {
  if (event.key === 'Escape') {
    closeSearch()
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!searchOpen.value || !searchResults.value.length) return
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    searchIndex.value = (searchIndex.value + step + searchResults.value.length) % searchResults.value.length
    return
  }
  if (event.key !== 'Enter') return
  event.preventDefault()
  const q = row.query.trim()
  if (/^\d{6,}$/.test(q)) {
    void tryBarcode(row, q)
    return
  }
  if (searchOpen.value && searchResults.value.length) {
    chooseSpu(searchResults.value[searchIndex.value] || searchResults.value[0])
    return
  }
}

function onProductBlur(row: SaleRow) {
  window.setTimeout(() => {
    if (document.activeElement && (document.activeElement as HTMLElement).classList.contains('pop-item')) return
    closeSearch()
    if (row.spuId && row.query !== row.spuName) row.query = row.spuName
  }, 120)
}

function openSearch(row: SaleRow, input: HTMLInputElement, keyword: string) {
  searchRowKey.value = row.key
  searchOpen.value = true
  searchIndex.value = 0
  positionSearch(input)
  if (searchTimer) window.clearTimeout(searchTimer)
  const token = ++searchToken
  searchTimer = window.setTimeout(async () => {
    searchLoading.value = true
    try {
      const res = await productApi.spusPage({ keyword: keyword || undefined, page_size: 10 })
      if (token !== searchToken) return
      searchResults.value = res.items
    } catch {
      if (token === searchToken) searchResults.value = []
    } finally {
      if (token === searchToken) searchLoading.value = false
    }
  }, keyword ? 220 : 0)
}

function positionSearch(input: HTMLInputElement) {
  const rect = input.getBoundingClientRect()
  const width = Math.min(Math.max(rect.width, 420), 560)
  const below = rect.bottom + 6
  const top = below + 322 > window.innerHeight - 8 ? Math.max(8, rect.top - 328) : below
  searchStyle.value = {
    left: `${rect.left}px`,
    top: `${top}px`,
    width: `${width}px`,
  }
}

async function chooseSpu(spu: ProductSPU) {
  const row = rows.value.find(r => r.key === searchRowKey.value)
  if (!row) return
  closeSearch()
  try {
    const skus = (await productApi.skus(spu.id)).filter(s => s.is_enabled !== false)
    if (!skus.length) {
      message.warning('该商品没有可售规格')
      return
    }
    row.spuId = spu.id
    row.spuName = spu.name
    row.query = spu.name
    row.skuOptions = skus
    row.skuId = skus[0].id
    row.skuName = skuLabel(skus[0])
    row.unit = skuUnit(skus[0]) || spu.base_unit || ''
    row.allowDecimal = skus[0].allow_decimal !== false
    row.baseQty = String(skus[0].base_qty ?? '1')
    row.manual = false
    row.qty = '1'
    await quoteAll()
    ensureTrailingBlank()
    await nextTick()
    focusQty(row.key)
  } catch {
    /* 请求层已经提示 */
  }
}

async function tryBarcode(row: SaleRow, barcode: string) {
  if (!/^\d{6,}$/.test(barcode)) {
    message.warning('没有找到该商品')
    return
  }
  try {
    const sku = await productApi.skuByBarcode(barcode)
    const spuId = sku.spu_id
    row.spuId = spuId
    row.spuName = sku.spu_name || ''
    row.query = row.spuName || barcode
    row.skuOptions = [sku]
    row.skuId = sku.id
    row.skuName = skuLabel(sku)
    row.unit = skuUnit(sku) || sku.base_unit || ''
    row.allowDecimal = sku.allow_decimal !== false
    row.baseQty = String(sku.base_qty ?? '1')
    row.manual = false
    row.qty = '1'
    closeSearch()
    await quoteAll()
    ensureTrailingBlank()
    await nextTick()
    focusQty(row.key)
  } catch {
    /* 请求层已经提示 404 */
  }
}

/* ---------- 规格 / 数量 / 售价 ---------- */
async function onSkuChange(row: SaleRow) {
  const sku = row.skuOptions.find(s => s.id === row.skuId)
  if (!sku) return
  row.skuName = skuLabel(sku)
  row.unit = skuUnit(sku) || row.unit
  row.allowDecimal = sku.allow_decimal !== false
  row.baseQty = String(sku.base_qty ?? '1')
  if (!row.allowDecimal) row.qty = String(Math.max(1, Math.floor(Number(row.qty) || 1)))
  row.manual = false
  await quoteAll()
}

function onQtyInput(row: SaleRow) {
  row.qty = sanitizeQty(row, row.qty)
}
function onQtyBlur(row: SaleRow) {
  const n = Number(row.qty)
  if (!n || n <= 0) {
    row.qty = '1'
    return
  }
  row.qty = row.allowDecimal ? fmtQty(n) : String(Math.max(1, Math.floor(n)))
}

function blurInput(event: KeyboardEvent) {
  ;(event.target as HTMLInputElement | null)?.blur()
}

function onPriceBlur(row: SaleRow) {
  if (!row.spuId) return
  const cents = parseCents(row.unitPrice)
  const min = parseCents(row.minPrice)
  const quoted = parseCents(row.quotedPrice)
  if (!cents || cents < min) {
    row.unitPrice = (quoted / 100).toFixed(2)
    message.warning(`不能低于最低售价 ${money(min)}`)
    return
  }
  if (cents === quoted) {
    row.manual = false
    row.priceSource = row.priceSource === 'manual' ? '' : row.priceSource
    return
  }
  if (row.manual) {
    row.manual = true
    return
  }
  dialog.warning({
    title: '手动改价',
    content: `将「${row.spuName} ${row.skuName}」售价由 ${money(quoted)} 改为 ${money(cents)}？\n手动改价会写审计日志，且不能低于最低售价。`,
    positiveText: '确认改价',
    negativeText: '取消',
    maskClosable: false,
    closeOnEsc: false,
    onPositiveClick: () => {
      row.unitPrice = (cents / 100).toFixed(2)
      row.manual = true
    },
    onNegativeClick: () => {
      row.unitPrice = row.quotedPrice
      row.manual = false
    },
  })
}

function clearRow(row: SaleRow) {
  Object.assign(row, newRow(), { key: row.key })
  normalizeRows()
  focusFirstSearch()
}

function removeRow(row: SaleRow) {
  rows.value = rows.value.filter(r => r !== row)
  normalizeRows()
  void quoteAll()
}

function ensureTrailingBlank() {
  if (!rows.value.length || rows.value[rows.value.length - 1].spuId) {
    rows.value.push(newRow())
  }
}
function normalizeRows() {
  const filled = rows.value.filter(r => r.spuId)
  rows.value = filled.length ? [...filled, newRow()] : [newRow()]
}
function focusQty(key: string) {
  void nextTick(() => {
    const el = document.querySelector<HTMLInputElement>(`.row[data-key="${key}"] .qty-input`)
    el?.focus()
    el?.select()
  })
}
function focusFirstSearch() {
  void nextTick(() => {
    document.querySelector<HTMLInputElement>('.product-input')?.focus()
  })
}

/* ---------- 报价 ---------- */
let quoteToken = 0
async function quoteAll() {
  const targets = rows.value.filter(r => r.skuId && Number(r.qty) > 0)
  if (!targets.length) return
  const token = ++quoteToken
  try {
    const res = await priceApi.quote({
      customer_id: customerId.value || undefined,
      items: targets.map(r => ({ sku_id: r.skuId as number, quantity: r.qty })),
    })
    if (token !== quoteToken) return
    const map = new Map(res.items.map(i => [i.sku_id, i]))
    rows.value.forEach(row => {
      if (!row.skuId) return
      const quote = map.get(row.skuId)
      if (quote) applyQuote(row, quote)
    })
  } catch {
    /* 请求层已经提示 */
  }
}

function applyQuote(row: SaleRow, quote: PriceQuoteItem) {
  row.unit = quote.unit || row.unit
  row.allowDecimal = quote.allow_decimal
  row.baseQty = quote.base_qty || row.baseQty
  row.minPrice = quote.min_price || row.minPrice || '0.00'
  row.quotedPrice = quote.unit_price
  row.stockOnHand = quote.stock_on_hand
  if (!row.manual) {
    row.unitPrice = quote.unit_price
    row.priceSource = quote.price_source || ''
  } else if (parseCents(row.unitPrice) < parseCents(row.minPrice)) {
    row.manual = false
    row.unitPrice = quote.unit_price
    row.priceSource = quote.price_source || ''
  }
  if (row.skuName === '' && quote.sku_spec) row.skuName = quote.sku_spec
}

/* ---------- 收款 ---------- */
function normalizeRounding() {
  rounding.value = moneyText(roundingCents.value)
  syncReceived()
}
function syncReceived() {
  if (paymentMethod.value === 'cash') {
    if (!received.value) received.value = moneyText(payableCents.value)
  } else if (paymentMethod.value === 'credit') {
    received.value = moneyText(payableCents.value)
  } else {
    received.value = moneyText(payableCents.value)
  }
}
/* ---------- 提交 ---------- */
function validate(): boolean {
  if (!filledRows.value.length) {
    message.warning('请先添加商品')
    return false
  }
  for (const row of filledRows.value) {
    if (!(Number(row.qty) > 0)) {
      message.warning(`「${row.spuName}」的数量必须大于 0`)
      return false
    }
    if (!row.allowDecimal && !Number.isInteger(Number(row.qty))) {
      message.warning(`「${row.spuName}」的数量必须是整数`)
      return false
    }
    if (parseCents(row.unitPrice) < parseCents(row.minPrice)) {
      message.warning(`「${row.spuName}」不能低于最低售价`)
      return false
    }
  }
  if (roundingCents.value > totalCents.value) {
    message.warning('抹零不能超过应收合计')
    return false
  }
  if (paymentMethod.value === 'cash' && receivedCents.value < payableCents.value) {
    message.warning('实收金额不足')
    return false
  }
  return true
}

function buildPayload(): CounterOrderPayload {
  const payload: CounterOrderPayload = {
    customer_id: customerId.value || null,
    sales_id: salesId.value,
    source: 'counter',
    delivery_mode: 'pickup',
    items: filledRows.value.map(row => ({
      sku_id: row.skuId as number,
      quantity: row.qty,
      ...(row.manual ? { unit_price: row.unitPrice } : {}),
    })),
    remark: remark.value.trim() || null,
  }
  if (paymentMethod.value !== 'credit') {
    payload.payment = {
      method: paymentMethod.value,
      amount: moneyText(payableCents.value),
      rounding_amount: moneyText(roundingCents.value),
      ...(paymentMethod.value === 'cash' ? { received_amount: moneyText(receivedCents.value) } : {}),
    }
  }
  return payload
}

async function submit(withReceipt: boolean) {
  if (saving.value || !validate()) return
  saving.value = true
  try {
    const res = await orderApi.counterCreate(buildPayload())
    const stockWarnings = res.warnings.filter(w => w.code === 'stock_insufficient')
    if (stockWarnings.length) message.warning(stockWarnings.map(w => w.message).join('；'))
    if (res.order.over_credit) message.warning('本单超出客户授信额度，已记录超额度标记')
    if (res.order.status === 'pending_approval') {
      message.warning(`已提交审批 ${res.order.order_no}，审批通过后才能打单`)
      resetOrder()
    } else if (withReceipt) {
      showReceipt(res.order)
      resetOrder()
    } else {
      message.success(`已保存 ${res.order.order_no}，已开新单`)
      resetOrder()
    }
  } catch {
    /* 请求层已经提示 */
  } finally {
    saving.value = false
  }
}

function resetOrder() {
  rows.value = [newRow()]
  customerId.value = 0
  paymentMethod.value = 'wechat'
  rounding.value = '0.00'
  received.value = ''
  remark.value = ''
  customerAccount.value = null
  normalizeRows()
  void nextTick(() => {
    syncReceived()
    focusFirstSearch()
  })
}

/* ---------- 销售单 ---------- */
function showReceipt(order: CounterOrder) {
  receiptOrder = order
  receiptCanvas = drawReceipt(order)
  receiptImage.value = receiptCanvas.toDataURL('image/png')
  receiptMeta.value = `单号 ${order.order_no} · ${order.customer_name} · 合计 ${yuan(order.total_amount)}`
  receiptVisible.value = true
}
function closeReceipt() {
  receiptVisible.value = false
  receiptOrder = null
  receiptCanvas = null
}
function copyReceipt() {
  if (!receiptCanvas) return
  receiptCanvas.toBlob(blob => {
    if (!blob) return
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      message.warning('当前环境不能复制图片，请用「保存图片」')
      return
    }
    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      .then(() => message.success('销售单图片已复制'))
      .catch(() => message.warning('当前环境不能复制图片，请用「保存图片」'))
  }, 'image/png')
}
function saveReceiptImage() {
  if (!receiptCanvas || !receiptOrder) return
  const a = document.createElement('a')
  a.href = receiptCanvas.toDataURL('image/png')
  a.download = `销售单-${receiptOrder.order_no}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  message.success('图片已保存')
}

function drawReceipt(order: CounterOrder): HTMLCanvasElement {
  const W = 720
  const SCALE = 2
  const PAD = 40
  const ROW = 32
  const n = Math.max(order.items.length, 1)
  const credit = order.payments.length === 0
  const tLines = credit ? 3 : 4
  const remarkH = order.remark ? 44 : 0
  const H = 276 + n * ROW + 26 * tLines + remarkH + 64
  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#111111'

  const F = '"PingFang SC", "Microsoft YaHei", sans-serif'
  const center = (text: string, y: number, font: string, color = '#111111') => {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(text, W / 2, y)
  }
  const left = (text: string, x: number, y: number, font: string, color = '#111111') => {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, x, y)
  }
  const right = (text: string, x: number, y: number, font: string, color = '#111111') => {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'right'; ctx.fillText(text, x, y)
  }
  const dashed = (y: number) => {
    ctx.strokeStyle = '#b8b8b8'; ctx.lineWidth = 1
    ctx.setLineDash([5, 4])
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke()
    ctx.setLineDash([])
  }
  const fit = (text: string, maxW: number) => {
    let s = String(text)
    if (ctx.measureText(s).width <= maxW) return s
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1)
    return s + '…'
  }
  const fmt2 = (v: string | number) => Number(v || 0).toFixed(2)
  const fmtQty = (v: string | number) => String(Math.round(Number(v || 0) * 1000) / 1000)

  center('味都美副食批零', 46, '700 22px ' + F)
  center('门店零售销售单', 76, '13px ' + F, '#555555')
  dashed(96)
  left('单号：' + order.order_no, PAD, 122, '13px ' + F)
  right('时间：' + formatDate(order.created_at), W - PAD, 122, '13px ' + F)
  left('客户：' + order.customer_name, PAD, 146, '13px ' + F)
  right('业务员：' + (order.sales_name || ''), W - PAD, 146, '13px ' + F)
  dashed(168)
  left('品名', PAD, 194, '600 13px ' + F)
  left('规格', 250, 194, '600 13px ' + F)
  right('数量', 430, 194, '600 13px ' + F)
  right('单价', 540, 194, '600 13px ' + F)
  right('金额', W - PAD, 194, '600 13px ' + F)
  dashed(206)

  let y = 236
  for (const it of order.items) {
    left(fit(it.spu_name, 180), PAD, y, '13px ' + F)
    left(fit(it.sku_spec, 120), 250, y, '13px ' + F)
    right(fmtQty(it.quantity) + ' ' + it.unit, 430, y, '13px ' + F)
    right(fmt2(it.unit_price), 540, y, '13px ' + F)
    right(fmt2(it.amount), W - PAD, y, '13px ' + F)
    y += ROW
  }
  y += 4
  dashed(y)
  y += 30
  const sumLine = (label: string, value: string, bold = false) => {
    right(label, 470, y, (bold ? '700 14px ' : '13px ') + F, '#444444')
    right(value, W - PAD, y, (bold ? '700 15px ' : '13px ') + F)
    y += 26
  }
  sumLine('合计', '¥' + fmt2(order.total_amount), true)
  sumLine('抹零', Number(order.discount_amount) ? '-¥' + fmt2(order.discount_amount) : '¥0.00')
  if (credit) {
    sumLine('挂账', '¥' + fmt2(order.total_amount))
  } else {
    const payment = order.payments[0]
    const actual = payment.method === 'cash' ? (payment.received_amount || payment.amount) : payment.amount
    sumLine('实收（' + (PAYMENT_LABELS[payment.method] || payment.method) + '）', '¥' + fmt2(actual))
    if (payment.method === 'cash') sumLine('找零', '¥' + fmt2(payment.change_amount || '0'))
  }
  if (order.remark) {
    y += 8
    left(fit('备注：' + order.remark, W - PAD * 2), PAD, y, '12px ' + F, '#555555')
  }
  center('谢谢惠顾，欢迎下次光临', H - 28, '12px ' + F, '#666666')
  return canvas
}

/* ---------- 挂起单 ---------- */
function loadSuspended(): SuspendedOrder[] {
  try {
    const raw = localStorage.getItem(SUSPEND_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}
function persistSuspended() {
  try {
    localStorage.setItem(SUSPEND_KEY, JSON.stringify(suspended.value))
  } catch {
    /* 忽略 */
  }
}
function suspendCurrent() {
  if (!filledRows.value.length) {
    message.warning('当前单还没有商品')
    return
  }
  suspended.value.push({
    id: `s${Date.now()}`,
    time: formatDate(new Date().toISOString()),
    customerId: customerId.value,
    salesId: salesId.value,
    customerName: selectedCustomer.value?.name || '门店散客',
    totalText: money(totalCents.value),
    rows: filledRows.value.map(r => ({
      spuId: r.spuId as number,
      spuName: r.spuName,
      skuId: r.skuId as number,
      qty: r.qty,
      unitPrice: r.unitPrice,
      manual: r.manual,
    })),
  })
  persistSuspended()
  suspendVisible.value = false
  message.success('已挂起，可在「挂起单」里恢复')
  resetOrder()
}
async function restoreSuspended(item: SuspendedOrder) {
  customerId.value = item.customerId
  salesId.value = item.salesId && salesOptions.value.some(s => s.id === item.salesId) ? item.salesId : (salesOptions.value.find(s => s.is_owner)?.id ?? null)
  if (item.customerId && !customers.value.some(c => c.id === item.customerId)) {
    try {
      const c = await adminCustomerApi.get(item.customerId)
      customers.value = [c, ...customers.value]
      customerOptions.value = [
        { label: '门店散客', value: 0 },
        ...customers.value.map(x => ({ label: x.name + (x.phone ? ` · ${x.phone}` : ''), value: x.id })),
      ]
    } catch {
      /* 客户已删除时保持原 id */
    }
  }
  const nextRows: SaleRow[] = []
  for (const itemRow of item.rows) {
    try {
      const skus = (await productApi.skus(itemRow.spuId)).filter(s => s.is_enabled !== false)
      const sku = skus.find(s => s.id === itemRow.skuId)
      if (!sku) continue
      nextRows.push({
        ...newRow(),
        spuId: itemRow.spuId,
        spuName: itemRow.spuName,
        skuId: sku.id,
        skuName: skuLabel(sku),
        unit: skuUnit(sku),
        allowDecimal: sku.allow_decimal !== false,
        baseQty: String(sku.base_qty ?? '1'),
        qty: itemRow.qty,
        unitPrice: itemRow.unitPrice,
        quotedPrice: itemRow.unitPrice,
        manual: itemRow.manual,
        skuOptions: skus,
        query: itemRow.spuName,
      })
    } catch {
      /* 单个商品恢复失败不影响其他 */
    }
  }
  rows.value = nextRows.length ? [...nextRows, newRow()] : [newRow()]
  suspended.value = suspended.value.filter(s => s.id !== item.id)
  persistSuspended()
  suspendVisible.value = false
  paymentMethod.value = 'wechat'
  rounding.value = '0.00'
  received.value = ''
  await nextTick()
  await quoteAll()
  if (customerId.value) void loadAccount(customerId.value)
  syncReceived()
  message.success('已恢复挂起单')
}
function deleteSuspended(item: SuspendedOrder) {
  suspended.value = suspended.value.filter(s => s.id !== item.id)
  persistSuspended()
}

/* ---------- 键盘 / 滚动 ---------- */
function hideSearchOnScroll() {
  closeSearch()
}
function closeSearch() {
  searchOpen.value = false
}
function handleDocumentClick(event: MouseEvent) {
  if (!searchOpen.value) return
  const target = event.target as HTMLElement
  if (target.closest('.search-pop') || target.classList.contains('product-input')) return
  closeSearch()
}

watch(paymentMethod, (method) => {
  if (method === 'credit') rounding.value = '0.00'
  received.value = moneyText(payableCents.value)
})

watch(payableCents, (value) => {
  if (paymentMethod.value !== 'cash' || !received.value) received.value = moneyText(value)
})

onMounted(async () => {
  document.addEventListener('click', handleDocumentClick)
  tableBodyEl.value?.addEventListener('scroll', hideSearchOnScroll, { passive: true })
  window.addEventListener('resize', hideSearchOnScroll)
  await loadCustomers('')
  try {
    salesOptions.value = await adminCustomerApi.salesOptions()
    const owner = salesOptions.value.find(s => s.is_owner)
    salesId.value = owner?.id ?? salesOptions.value[0]?.id ?? null
  } catch {
    salesOptions.value = []
  }
  syncReceived()
  focusFirstSearch()
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  tableBodyEl.value?.removeEventListener('scroll', hideSearchOnScroll)
  window.removeEventListener('resize', hideSearchOnScroll)
})
</script>

<style scoped>
.counter-page {
  height: calc(100vh - 100px);
  min-height: 560px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  box-sizing: border-box;
}
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}
.head-card {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 10px 16px;
  flex-wrap: wrap;
}
.head-field { display: flex; align-items: center; gap: 8px; }
.head-field .label { font-size: 13px; color: var(--text-3); white-space: nowrap; }
.head-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.meta-pill {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--bg-subtle); border: 1px solid var(--border);
  border-radius: 999px; padding: 3px 10px; font-size: 12px; color: var(--text-2);
}
.meta-pill b { color: var(--text-1); }
.meta-pill.danger { background: rgba(220, 38, 38, .06); border-color: rgba(220, 38, 38, .2); color: var(--danger); }
.meta-pill.danger b { color: var(--danger); }
.spacer { flex: 1; }
.badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px; margin-left: 4px;
  border-radius: 999px; background: var(--primary); color: #fff; font-size: 11px;
}

.table-card { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.table-head, .row {
  display: grid;
  grid-template-columns: minmax(200px, 1.7fr) 188px 148px 166px 128px 40px;
}
.table-head {
  flex: 0 0 auto; height: 38px; padding: 0 8px; align-items: center;
  background: var(--bg-subtle); border-bottom: 1px solid var(--border);
  font-size: 12px; font-weight: 600; color: var(--text-3);
}
.table-head .sub { font-weight: 400; }
.table-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 2px 8px 12px; }
.row { align-items: start; min-height: 62px; padding: 6px 0; border-bottom: 1px solid var(--border); }
.row:last-of-type { border-bottom: none; }
.row.focused { background: var(--primary-soft); }
.cell { padding: 0 9px; min-width: 0; }
.total-head { text-align: right; padding-right: 12px; }
.product-cell { position: relative; }
.product-input {
  width: 100%; height: 34px; border: 1px solid transparent; border-radius: 7px;
  background: transparent; padding: 0 28px 0 8px; outline: none; font-size: 14px; color: var(--text-1);
}
.product-input::placeholder { color: var(--text-3); }
.product-input:hover { background: var(--bg-hover); }
.product-input:focus { background: var(--bg-card); border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.clear-btn {
  position: absolute; right: 14px; top: 12px; width: 20px; height: 20px; border: none;
  border-radius: 50%; background: var(--bg-hover); color: var(--text-3);
  font-size: 14px; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0;
}
.clear-btn:hover { background: #fee2e2; color: var(--danger); }
.sku-select {
  width: 100%; height: 34px; border: 1px solid var(--border); border-radius: 7px;
  background-color: var(--bg-card); padding: 0 8px; font-size: 13px; color: var(--text-1); outline: none;
}
.sku-select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.sku-select:disabled { background: var(--bg-subtle); border-color: transparent; color: var(--text-3); cursor: default; }
.qty-wrap, .price-wrap {
  display: flex; align-items: center; gap: 4px; height: 34px; padding: 0 8px;
  border: 1px solid var(--border); border-radius: 7px; background: var(--bg-card);
}
.qty-wrap:focus-within, .price-wrap:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.qty-wrap.disabled, .price-wrap.disabled { background: var(--bg-subtle); border-color: transparent; opacity: .72; }
.qty-input, .price-input {
  width: 100%; min-width: 0; border: none; outline: none; background: transparent;
  font-size: 14px; font-weight: 600; text-align: right; color: var(--text-1); padding: 0;
}
.qty-input:disabled, .price-input:disabled { color: var(--text-3); cursor: default; }
.unit, .yen { font-size: 12px; color: var(--text-3); white-space: nowrap; }
.stock-line {
  height: 15px; line-height: 15px; margin-top: 2px; font-size: 11px; color: var(--text-3);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.stock-line.warn { color: var(--warning); }
.price-meta { height: 15px; line-height: 15px; margin-top: 2px; font-size: 11px; color: var(--text-3); }
.tag-manual {
  color: var(--warning); background: rgba(234, 88, 12, .08);
  border: 1px solid rgba(234, 88, 12, .18); border-radius: 4px;
  padding: 0 5px; font-size: 10px; line-height: 14px;
}
.total-cell { text-align: right; font-weight: 600; font-size: 14px; padding-right: 12px; line-height: 34px; }
.del-cell { height: 34px; display: flex; align-items: center; justify-content: flex-end; }
.empty-hint { padding: 26px 0 18px; text-align: center; font-size: 13px; color: var(--text-3); line-height: 1.9; }
.empty-hint kbd {
  display: inline-block; padding: 0 5px; margin: 0 2px; border: 1px solid var(--border);
  border-bottom-width: 2px; border-radius: 4px; background: var(--bg-subtle);
  font-size: 11px; font-family: inherit; color: var(--text-2);
}
.foot-card { flex: 0 0 auto; display: flex; flex-direction: column; gap: 10px; padding: 12px 16px; }
.foot-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.total-block { min-width: 138px; }
.total-label { font-size: 12px; color: var(--text-3); }
.total-amount { font-size: 27px; font-weight: 700; letter-spacing: -.5px; line-height: 1.15; }
.total-sub { font-size: 11px; color: var(--text-3); height: 15px; }
.foot-fields { display: flex; align-items: flex-end; gap: 14px; flex: 1; flex-wrap: wrap; justify-content: flex-end; }
.mini-field { display: flex; flex-direction: column; gap: 4px; }
.mini-field .label { font-size: 11px; color: var(--text-3); }
.input {
  height: 34px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card);
  padding: 0 10px; outline: none; font-size: 14px; color: var(--text-1);
}
.input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.input[readonly] { background: var(--bg-subtle); color: var(--text-3); border-color: var(--border); }
.input.money { width: 104px; text-align: right; }
.static-money { height: 34px; display: flex; align-items: center; font-size: 14px; font-weight: 600; padding: 0 2px; }
.static-money.danger { color: var(--danger); }
.foot-actions {
  display: flex; gap: 10px; justify-content: flex-end;
  border-top: 1px solid var(--border); padding-top: 10px;
}
.search-pop {
  position: fixed; z-index: 60; max-height: 322px; overflow: auto;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
  box-shadow: 0 14px 36px rgba(16, 24, 40, .16); padding: 6px;
}
.pop-item { padding: 8px 10px; border-radius: 8px; cursor: pointer; }
.pop-item:hover, .pop-item.active { background: var(--primary-soft); }
.pop-name { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
.pop-tag {
  font-size: 11px; font-weight: 400; color: var(--text-3);
  background: var(--bg-subtle); border: 1px solid var(--border);
  border-radius: 4px; padding: 0 5px; line-height: 15px;
}
.pop-sub { margin-top: 2px; font-size: 11.5px; color: var(--text-3); }
.pop-empty { padding: 20px 10px; text-align: center; font-size: 12px; color: var(--text-3); }
.receipt-meta { padding: 0 0 10px; font-size: 12.5px; color: var(--text-3); }
.receipt-box {
  padding: 12px; background: var(--bg-subtle); border: 1px solid var(--border);
  border-radius: 10px; display: flex; justify-content: center; overflow: auto;
}
.receipt-box img {
  max-width: 100%; max-height: 62vh; display: block; margin: 0 auto;
  background: #fff; border-radius: 4px; box-shadow: 0 4px 18px rgba(16, 24, 40, .14);
}
.modal-actions { display: flex; justify-content: flex-end; align-items: center; gap: 10px; width: 100%; }
.modal-actions .tip { margin-right: auto; font-size: 12px; color: var(--text-3); }
.suspend-empty { padding: 30px 0; text-align: center; font-size: 13px; color: var(--text-3); }
.suspend-item {
  display: flex; align-items: center; gap: 12px;
  border: 1px solid var(--border); border-radius: 10px; padding: 11px 14px; margin-top: 10px;
}
.suspend-item:first-of-type { margin-top: 0; }
.suspend-info { flex: 1; min-width: 0; }
.suspend-customer { font-size: 13.5px; font-weight: 600; }
.suspend-sub { margin-top: 2px; font-size: 12px; color: var(--text-3); }
.suspend-actions { display: flex; gap: 6px; }
</style>
