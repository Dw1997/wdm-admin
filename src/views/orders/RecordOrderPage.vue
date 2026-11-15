<template>
  <div class="record-page">
    <n-card title="录单" size="small">
      <div class="header-grid" :class="{ 'header-grid--route': deliveryMode === 'route' }">
        <label>客户
          <n-select v-model:value="customerId" :options="customerOptions" filterable remote clearable
            placeholder="搜索名称、拼音或手机号" @search="searchCustomers" @update:value="changeCustomer" />
        </label>
        <template v-if="deliveryMode === 'route'">
          <label class="trip-field">出车趟次
            <n-select v-model:value="routeTripId" :options="tripOptions" clearable placeholder="未选则自动排车或待排车" />
          </label>
        </template>
        <label>归属业务员<n-input :value="customer?.sales_name || '—'" readonly /></label>
        <label>订单来源
          <n-select v-model:value="source" :options="[{label:'客户来电',value:'phone_in'},{label:'线路询单',value:'route_call'}]" />
        </label>
        <label>配送方式
          <n-select v-model:value="deliveryMode" :options="deliveryOptions" @update:value="changeDelivery" />
        </label>
      </div>
      <div v-if="customer" class="customer-summary">
        <span>客户：{{ customer.name }}</span><span>等级：{{ customer.level_nickname || customer.level_code || '—' }}</span>
        <span>欠款：¥{{ account?.ar_balance || '0.00' }}</span>
        <span>额度：¥{{ customer.effective_credit_limit }}</span>
        <span v-if="Number(account?.overdue_amount || 0) > 0" class="warning">逾期：¥{{ account?.overdue_amount }}</span>
      </div>
      <div v-if="deliveryMode === 'freight'" class="dispatch-grid">
        <label>物流线路<n-select v-model:value="freightLineId" :options="freightOptions" @update:value="freightStopId = null" /></label>
        <label>下车点<n-select v-model:value="freightStopId" :options="stopOptions" clearable /></label>
        <label>发运日期<n-date-picker v-model:formatted-value="shipDate" type="date" value-format="yyyy-MM-dd" /></label>
        <label>运费承担
          <n-select v-model:value="freightMode" :options="freightModeOptions" />
        </label>
        <label>预计运费<n-input v-model:value="freightCost" placeholder="留空按 0 元" /></label>
        <span class="hint">未填运费表示店家不出运费，按 0 元计算。</span>
      </div>
    </n-card>

    <n-card class="product-card" title="商品明细" size="small">
      <div v-if="frequentSkus.length" class="frequent">
        <span>常购商品</span>
        <n-button v-for="item in frequentSkus" :key="item.sku_id" size="small" @click="addFrequent(item.sku_id)">
          {{ item.spu_name }} {{ item.sku_spec }}
        </n-button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>商品（直接输入）</th><th>规格</th><th>数量</th><th>售价</th><th>成本价</th><th>本次拿货供应商</th><th>金额</th><th>SKU 利润</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="(row, index) in rows" :key="row.key">
              <td class="product-cell">
                <n-select v-model:value="row.spuId" :options="productOptions" filterable remote clearable
                  placeholder="名称 / 拼音 / 条码" @search="(keyword: string) => searchProducts(keyword, row)" @update:value="(value: number | null) => chooseProduct(row, value)" />
              </td>
              <td><n-select v-model:value="row.skuId" :options="row.skus.map(s => ({label: skuName(s), value: s.id}))"
                :disabled="!row.spuId" @update:value="() => quoteRows()" /></td>
              <td><n-input v-model:value="row.quantity" :disabled="!row.skuId" @blur="quoteRows" @keyup.enter="focusNext(index)" />
                <div v-if="row.skuId" class="hint" :class="{ warning: Number(row.stockAvailable || 0) < Number(row.quantity) }">库存 {{ row.stockAvailable ?? '—' }}</div>
              </td>
              <td><n-input v-model:value="row.unitPrice" :disabled="!row.skuId" @blur="confirmPrice(row)" />
                <div v-if="row.skuId" class="hint">{{ row.manual ? '手动改价' : priceSourceLabel(row.priceSource) }}</div>
                <n-checkbox v-if="row.manual" v-model:checked="row.savePrice">以后也按此价</n-checkbox>
              </td>
              <td><n-input v-model:value="row.costPrice" :disabled="!row.skuId" @blur="confirmCost(row)" />
                <div v-if="row.skuId" class="hint">修改后更新全局成本</div>
              </td>
              <td><n-select v-model:value="row.supplierId" :options="supplierOptions" :disabled="!row.skuId" filterable placeholder="选择供应商" /></td>
              <td>¥{{ lineAmount(row) }}</td><td>¥{{ lineProfit(row) }}</td>
              <td><n-button v-if="row.skuId" text type="error" @click="removeRow(index)">删除</n-button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </n-card>
    <div class="action-bar">
      <label class="remark">备注<n-input v-model:value="remark" placeholder="可填写送货或收货说明" /></label>
      <div class="totals">
        <span>货款 ¥{{ goodsTotal }}</span><span>商品成本 ¥{{ goodsCost }}</span>
        <span>预计运费 ¥{{ sellerFreight }}</span><strong>预计总利润 ¥{{ totalProfit }}</strong>
      </div>
      <div class="footer">
        <n-button :loading="saving" @click="save(false)">保存</n-button>
        <n-button type="primary" :loading="saving" @click="save(true)">保存并录下一单</n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { adminCustomerApi, deliveryApi, fetchAllPages, orderApi, priceApi, productApi, vendorApi } from '@/api'
import type { AdminCustomer, CustomerAccount, FrequentSku, PriceQuoteItem, ProductSKU, ProductSPU, RecordFreightLine, RecordUpcomingTrips, RecordOrderPayload } from '@/types'

type DeliveryMode = 'route' | 'freight' | 'local'
type FreightMode = 'deduct' | 'store_paid' | 'customer_paid'
interface Row {
  key: number; spuId: number | null; skuId: number | null; skus: ProductSKU[]; quantity: string
  unitPrice: string; quotedPrice: string; costPrice: string; quotedCost: string
  priceSource: string; minPrice: string; manual: boolean; savePrice: boolean
  stockAvailable: string | null
  supplierId: number
}

const message = useMessage()
const customerId = ref<number | null>(null)
const customers = ref<AdminCustomer[]>([])
const account = ref<CustomerAccount | null>(null)
const source = ref<'phone_in' | 'route_call'>('phone_in')
const deliveryMode = ref<DeliveryMode>('route')
const upcoming = ref<RecordUpcomingTrips | null>(null)
const routeTripId = ref<number | null>(null)
const freightLines = ref<RecordFreightLine[]>([])
const freightLineId = ref<number | null>(null)
const freightStopId = ref<number | null>(null)
const shipDate = ref<string | null>(null)
const freightMode = ref<FreightMode>('deduct')
const freightCost = ref('')
const remark = ref('')
const products = ref<ProductSPU[]>([])
const suppliers = ref<{ id: number; name: string }[]>([])
const supplierOptions = computed(() => [{ label: '自己进货', value: 0 }, ...suppliers.value.map(v => ({ label: v.name, value: v.id }))])
const frequentSkus = ref<FrequentSku[]>([])
let rowKey = 0
const blank = (): Row => ({ key: ++rowKey, spuId: null, skuId: null, skus: [], quantity: '1', unitPrice: '', quotedPrice: '', costPrice: '', quotedCost: '', priceSource: '', minPrice: '', manual: false, savePrice: false, stockAvailable: null, supplierId: 0 })
const rows = ref<Row[]>([blank()])
const saving = ref(false)
const customer = computed(() => customers.value.find(c => c.id === customerId.value))
const customerOptions = computed(() => customers.value.map(c => ({ label: `${c.name} ${c.phone || ''}`, value: c.id })))
const productOptions = computed(() => products.value.map(p => ({ label: p.name, value: p.id })))
const deliveryOptions = [{ label: '开车自送（跟车送）', value: 'route' }, { label: '发物流（零担）', value: 'freight' }, { label: '自送', value: 'local' }]
const freightModeOptions = [{ label: '运费从货款扣', value: 'deduct' }, { label: '店家承担', value: 'store_paid' }, { label: '客户到付', value: 'customer_paid' }]
const tripOptions = computed(() => upcoming.value?.trips.map(t => ({ label: `${t.trip_date} ${t.name || ''}`, value: t.trip_id })) || [])
const selectedTrip = computed(() => upcoming.value?.trips.find(t => t.trip_id === routeTripId.value))
const freightOptions = computed(() => freightLines.value.map(l => ({ label: l.name, value: l.id })))
const stopOptions = computed(() => freightLines.value.find(l => l.id === freightLineId.value)?.stops.map(s => ({ label: `${s.town_name} ${s.drop_point}`, value: s.id })) || [])
const activeRows = computed(() => rows.value.filter(r => r.skuId))
const decimal = (value: string) => Number(value) || 0
const money = (value: number) => value.toFixed(2)
const lineAmount = (row: Row) => money(decimal(row.quantity) * decimal(row.unitPrice))
const lineProfit = (row: Row) => money(decimal(row.quantity) * (decimal(row.unitPrice) - decimal(row.costPrice)))
const goodsTotal = computed(() => money(activeRows.value.reduce((sum, row) => sum + decimal(lineAmount(row)), 0)))
const goodsCost = computed(() => money(activeRows.value.reduce((sum, row) => sum + decimal(row.quantity) * decimal(row.costPrice), 0)))
const sellerFreight = computed(() => deliveryMode.value === 'freight' && freightMode.value !== 'customer_paid' ? money(decimal(freightCost.value)) : '0.00')
const totalProfit = computed(() => money(decimal(goodsTotal.value) - decimal(goodsCost.value) - decimal(sellerFreight.value)))
const skuName = (sku: ProductSKU) => Object.values(sku.specs || {}).join(' / ') || sku.base_unit || `SKU ${sku.id}`
const priceSourceLabel = (source: string) => ({ contract: '客户专属价', level: '等级价', suggested: '建议价' }[source] || '服务端报价')

async function searchCustomers(keyword: string) {
  try {
    const selected = customer.value
    const found = await adminCustomerApi.list({ keyword: keyword || undefined, status: 'active', page_size: 20 })
    customers.value = selected && !found.some(c => c.id === selected.id) ? [selected, ...found] : found
  }
  catch { /* 请求层提示 */ }
}
async function changeCustomer(id: number | null) {
  account.value = null; upcoming.value = null; routeTripId.value = null; frequentSkus.value = []
  if (!id) return
  try {
    const [detail, balance, trips, frequent] = await Promise.all([adminCustomerApi.get(id), adminCustomerApi.account(id), deliveryApi.upcomingTrips(id), deliveryApi.frequentSkus(id)])
    customers.value = [detail, ...customers.value.filter(c => c.id !== id)]
    account.value = balance; upcoming.value = trips
    frequentSkus.value = frequent
    deliveryMode.value = detail.default_delivery_mode || 'route'
    routeTripId.value = trips.trips.find(t => t.is_default)?.trip_id || null
    freightLineId.value = detail.freight_line_id || trips.freight?.line_id || null
    freightStopId.value = detail.freight_stop_id || null
    shipDate.value = trips.freight?.ship_date || null
    freightMode.value = detail.default_freight_mode || 'deduct'
    if (deliveryMode.value === 'route') notifyTripStatus()
    await quoteRows()
  } catch { /* 请求层提示 */ }
}
function changeDelivery() {
  if (deliveryMode.value === 'route') routeTripId.value = upcoming.value?.trips.find(t => t.is_default)?.trip_id || null
  if (deliveryMode.value === 'freight') shipDate.value = upcoming.value?.freight?.ship_date || null
  if (deliveryMode.value === 'route') notifyTripStatus()
}
function notifyTripStatus() {
  if (!tripOptions.value.length) { message.info('当前没有候选趟次，订单将进入待排车'); return }
  if (selectedTrip.value && !selectedTrip.value.within_pool_days) message.warning(`该趟次超过 ${upcoming.value?.pool_max_days} 天，可改发物流`)
}
let searchToken = 0
async function searchProducts(keyword: string, row?: Row) {
  const token = ++searchToken
  if (row && /^\d{8,}$/.test(keyword)) {
    try {
      const sku = await productApi.skuByBarcode(keyword)
      if (token !== searchToken) return
      const spu = await productApi.spu(sku.spu_id)
      if (!products.value.some(p => p.id === spu.id)) products.value.unshift(spu)
      await chooseProduct(row, spu.id)
      row.skuId = sku.id
      await quoteRows()
      return
    } catch { /* 条码尚未输入完整时继续普通搜索 */ }
  }
  try {
    const result = await productApi.spusPage({ keyword: keyword || undefined, page_size: 20 })
    if (token === searchToken) {
      const selected = products.value.filter(p => rows.value.some(row => row.spuId === p.id))
      products.value = [...selected, ...result.items.filter(p => !selected.some(s => s.id === p.id))]
    }
  }
  catch { /* 请求层提示 */ }
}
async function chooseProduct(row: Row, id: number | null) {
  row.skuId = null; row.skus = []; row.supplierId = 0
  if (!id) return
  try {
    const spu = await productApi.spu(id)
    row.supplierId = spu.supplier_id || 0
    row.skus = (await productApi.skus(id)).filter(s => s.is_enabled !== false)
    row.skuId = row.skus[0]?.id || null
    if (!row.skuId) { message.warning('该商品没有可售规格'); return }
    if (rows.value.at(-1) === row) rows.value.push(blank())
    await quoteRows()
  } catch { /* 请求层提示 */ }
}
async function addFrequent(skuId: number) {
  try {
    const sku = await productApi.sku(skuId)
    const spu = await productApi.spu(sku.spu_id)
    if (!products.value.some(p => p.id === spu.id)) products.value.unshift(spu)
    const row = rows.value.find(r => !r.skuId) || blank()
    if (!rows.value.includes(row)) rows.value.push(row)
    row.spuId = spu.id
    row.supplierId = spu.supplier_id || 0
    row.skus = (await productApi.skus(spu.id)).filter(s => s.is_enabled !== false)
    row.skuId = skuId
    row.quantity = '1'
    if (rows.value.at(-1) === row) rows.value.push(blank())
    await quoteRows()
  } catch { /* 请求层提示 */ }
}
let quoteToken = 0
async function quoteRows() {
  if (!customerId.value || !activeRows.value.length) return
  const token = ++quoteToken
  try {
    const result = await priceApi.quote({ customer_id: customerId.value, items: activeRows.value.map(r => ({ sku_id: r.skuId!, quantity: r.quantity || '1' })) })
    if (token !== quoteToken) return
    const bySku = new Map<number, PriceQuoteItem>(result.items.map(item => [item.sku_id, item]))
    for (const row of activeRows.value) {
      const quote = bySku.get(row.skuId!)
      if (!quote) continue
      row.quotedPrice = quote.unit_price; row.minPrice = quote.min_price || '0'; row.priceSource = quote.price_source || ''
      row.quotedCost = quote.cost_price || '0'; row.costPrice = row.quotedCost
      row.stockAvailable = quote.stock_available
      if (!row.manual) row.unitPrice = quote.unit_price
    }
  } catch { /* 请求层提示 */ }
}
function confirmPrice(row: Row) {
  if (!row.skuId || row.unitPrice === row.quotedPrice) { row.manual = false; row.savePrice = false; return }
  if (decimal(row.unitPrice) < decimal(row.minPrice)) { message.error(`售价不能低于最低售价 ¥${row.minPrice}`); row.unitPrice = row.quotedPrice; return }
  if (!window.confirm(`确认将售价改为 ¥${row.unitPrice}？默认只影响本单，可勾选“以后也按此价”保存为客户专属价。`)) { row.unitPrice = row.quotedPrice; return }
  row.manual = true
}
async function confirmCost(row: Row) {
  if (!row.skuId || row.costPrice === row.quotedCost) return
  if (decimal(row.costPrice) < 0 || !window.confirm(`确认把此 SKU 全局成本改为 ¥${row.costPrice}？后续报价也会受影响。`)) { row.costPrice = row.quotedCost; return }
  try { await productApi.updateSku(row.skuId, { cost_price: decimal(row.costPrice) }); message.success('全局成本已更新'); await quoteRows() }
  catch { row.costPrice = row.quotedCost }
}
function removeRow(index: number) { rows.value.splice(index, 1); if (!rows.value.length || rows.value.at(-1)?.skuId) rows.value.push(blank()) }
function focusNext(index: number) { if (index === rows.value.length - 1) rows.value.push(blank()) }

async function save(next: boolean) {
  if (!customerId.value) { message.warning('请先选择客户'); return }
  if (!activeRows.value.length) { message.warning('请先录入商品'); return }
  if (activeRows.value.some(r => decimal(r.quantity) <= 0)) { message.warning('商品数量必须大于 0'); return }
  if (activeRows.value.some(r => r.manual && r.savePrice) && !window.confirm('勾选的手动售价将保存为该客户专属价，并覆盖已有专属价。确认继续？')) return
  let mergeInto: number | null = null
  const existing = upcoming.value?.existing_orders.find(o => deliveryMode.value === 'route'
    ? !!routeTripId.value && o.trip_id === routeTripId.value
    : deliveryMode.value === 'freight' && !!shipDate.value && o.ship_date === shipDate.value && o.freight_line_id === freightLineId.value)
  if (existing && window.confirm(`客户在同一${deliveryMode.value === 'route' ? '趟次' : '物流批次'}已有待配送订单 ${existing.order_no}。确定合并？取消则新建订单。${deliveryMode.value === 'freight' ? '合并时预计运费会累加。' : ''}`)) mergeInto = existing.order_id
  const payload: RecordOrderPayload = {
    customer_id: customerId.value, source: source.value, delivery_mode: deliveryMode.value,
    items: activeRows.value.map(r => ({ sku_id: r.skuId!, quantity: r.quantity, supplier_id: r.supplierId, ...(r.manual ? { unit_price: r.unitPrice } : {}), save_as_customer_price: r.manual && r.savePrice })),
    remark: remark.value,
  }
  if (mergeInto) payload.merge_into_order_id = mergeInto
  if (deliveryMode.value === 'route') payload.route_trip_id = routeTripId.value
  if (deliveryMode.value === 'freight') {
    payload.freight_line_id = freightLineId.value; payload.freight_stop_id = freightStopId.value
    payload.ship_date = shipDate.value; payload.freight_mode = freightMode.value; payload.freight_cost = freightCost.value || '0'
  }
  saving.value = true
  try {
    const result = await orderApi.recordCreate(payload)
    message.success(`订单 ${result.order.order_no} 已保存`)
    const changed = activeRows.value.some(row => result.order.items.some(item => item.sku_id === row.skuId
      && (Number(item.cost_price) !== Number(row.costPrice) || (!row.manual && Number(item.unit_price) !== Number(row.unitPrice)))))
    if (changed) message.warning('保存时成本或报价已变化，请查看订单明细中的最终快照。')
    for (const warning of result.warnings || []) message.warning(warning.message)
    if (next) { rows.value = [blank()]; remark.value = ''; freightCost.value = ''; await changeCustomer(customerId.value) }
  } catch { /* 请求层提示 */ }
  finally { saving.value = false }
}
onMounted(async () => { await Promise.all([searchCustomers(''), searchProducts(''), deliveryApi.freightLines().then(v => { freightLines.value = v }), fetchAllPages(page => vendorApi.list({ page, page_size: 20 })).then(v => { suppliers.value = v })]) })
</script>

<style scoped>
.record-page { position: fixed; top: 100px; right: 0; bottom: 0; left: var(--wdm-sider-width, 220px); display: flex; flex-direction: column; gap: 10px; height: auto; min-height: 0; overflow: hidden; box-sizing: border-box; padding-bottom: 140px; }
.record-page > .n-card:first-child { flex: 0 0 auto; }
.product-card { flex: 1; min-height: 0; }
.product-card { overflow: hidden; }
.product-card :deep(.n-card__content) { display: flex; flex: 1; min-height: 0; flex-direction: column; padding-bottom: 140px; }
.header-grid, .dispatch-grid { display: grid; grid-template-columns: repeat(4, minmax(160px, 1fr)); gap: 12px; align-items: end; }
.header-grid--route { grid-template-columns: repeat(5, minmax(160px, 1fr)); }
label { display: grid; gap: 5px; color: var(--text-2); font-size: 13px; }
.customer-summary { display: flex; flex-wrap: wrap; gap: 20px; padding: 14px 0; font-size: 13px; }
.frequent { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-bottom: 14px; }
.hint { color: #888; font-size: 12px; }.warning { color: #d03050; }
.table-wrap { flex: 1; min-height: 0; overflow: auto; } table { width: 100%; min-width: 1240px; border-collapse: collapse; }
th, td { padding: 9px 6px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
th { color: var(--text-2); font-weight: 500; background: var(--bg-subtle); } .product-cell { min-width: 220px; }
td:nth-child(2) { min-width: 160px; } td:nth-child(3), td:nth-child(4), td:nth-child(5) { min-width: 110px; }
.action-bar { position: fixed; left: var(--wdm-sider-width, 220px); right: 0; bottom: 0; z-index: 20; display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 12px 28px; box-sizing: border-box; padding: 12px 16px; background: var(--bg-card); border-top: 1px solid var(--border); box-shadow: 0 -5px 18px rgba(15, 23, 42, 0.08); }
.remark { display: flex; flex: 0 1 520px; align-items: center; gap: 8px; min-width: 260px; white-space: nowrap; }
.remark :deep(.n-input) { flex: 1; }
.totals, .footer { display: flex; justify-content: flex-end; gap: 24px; align-items: center; flex-wrap: wrap; }
.totals { margin-left: auto; }
.totals strong { color: #d03050; font-size: 18px; }
@media (max-width: 1100px) { .header-grid--route { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 900px) { .header-grid, .header-grid--route, .dispatch-grid { grid-template-columns: repeat(2, 1fr); } .remark { flex-basis: 100%; } .totals { margin-left: 0; } }
</style>
