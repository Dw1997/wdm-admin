<template>
  <div class="order-edit">
    <n-card title="编辑订单" size="small">
      <div class="header-grid">
        <label>客户<n-input :value="`${order.customer_name} ${order.customer_phone || ''}`" readonly /></label>
        <label>归属业务员<n-input :value="order.sales_name || '—'" readonly /></label>
        <label>订单来源<n-input :value="sourceLabel" readonly /></label>
        <label>配送方式<n-input :value="deliveryLabel" readonly /></label>
      </div>
      <div v-if="order.delivery_mode === 'route'" class="dispatch-grid">
        <label>出车趟次<n-input :value="order.route_trip_id ? `#${order.route_trip_id}` : '待排车'" readonly /></label>
      </div>
      <div v-if="order.delivery_mode === 'freight'" class="dispatch-grid">
        <label>零担批次<n-input :value="order.freight_shipment_id ? `#${order.freight_shipment_id}` : '待安排'" readonly /></label>
        <template v-if="canEditFreight">
          <label>运费承担<n-select v-model:value="freightMode" :options="freightOptions" /></label>
          <label>预计运费<n-input v-model:value="freightCost" :disabled="freightMode === 'customer_paid'" placeholder="留空按 0 元" /></label>
        </template>
      </div>
      <label class="remark">备注<n-input v-model:value="remark" placeholder="可填写送货或收货说明" /></label>
    </n-card>
    <n-card title="商品明细" size="small">
      <p class="hint">规格可重新选择；切换后按新 SKU 报价。成本价仅展示，保存时由服务端写入最终快照。</p>
      <div class="table-wrap"><table><thead><tr><th>商品</th><th>规格</th><th>数量</th><th>售价</th><th>成本价</th><th>本次拿货供应商</th><th>金额</th><th>SKU 利润</th><th>操作</th></tr></thead>
        <tbody><tr v-for="(row, index) in rows" :key="row.key">
          <td><span v-if="row.existing">{{ row.name }}</span><n-select v-else v-model:value="row.spuId" :options="productOptions" filterable remote placeholder="名称 / 拼音 / 条码" @search="searchProducts" @update:value="() => chooseProduct(row)" /></td>
          <td><n-select v-model:value="row.skuId" :options="row.skus.map(s => ({ label: skuLabel(s), value: s.id }))" :disabled="!row.spuId || row.purchaseConfirmed" placeholder="选择规格" @update:value="() => quoteNew(row)" /></td>
          <td><n-input v-model:value="row.quantity" :disabled="!row.skuId || row.purchaseConfirmed" placeholder="数量" @blur="quoteNew(row)" /></td>
          <td class="price-cell">
            <n-input v-model:value="row.price" placeholder="售价" :disabled="!row.skuId || !canOverridePrice" @update:value="row.manualConfirmed = false" @blur="confirmPrice(row)" />
            <div class="price-meta">
              <small class="hint">{{ row.existing ? `原售价 ¥${row.originalPrice}` : `报价 ¥${row.originalPrice || '—'}` }}</small>
              <span v-if="priceChanged(row)" class="manual-tag">手动改价</span>
              <n-button v-if="priceChanged(row)" text size="tiny" @click="resetPrice(row)">恢复原价</n-button>
            </div>
          </td>
          <td>¥{{ money(row.costPrice) }}</td>
          <td><n-select v-model:value="row.supplierId" :options="supplierOptions" :disabled="!row.skuId || row.purchaseConfirmed" filterable /></td>
          <td>¥{{ lineAmount(row) }}</td>
          <td class="profit">¥{{ lineProfit(row) }}</td>
          <td><n-button text type="error" :disabled="row.purchaseConfirmed" @click="rows.splice(index, 1)">删除</n-button></td>
        </tr></tbody></table></div>
      <n-button dashed class="add-button" @click="addRow">添加商品</n-button>
    </n-card>
    <div class="action-bar">
      <div class="totals">
        <span>原订单货款 ¥{{ Number(order.total_amount).toFixed(2) }}</span>
        <span v-if="order.profit != null">原订单利润 ¥{{ Number(order.profit).toFixed(2) }}</span>
        <span class="hint">修改后以服务端保存结果为准</span>
      </div>
      <div class="footer">
        <n-button @click="$emit('cancel')">取消</n-button>
        <n-button type="primary" :loading="saving" @click="save">保存订单</n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchAllPages, orderApi, priceApi, productApi, vendorApi } from '@/api'
import type { OrderListItem, OrderUpdatePayload, ProductSKU, ProductSPU } from '@/types'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ order: OrderListItem }>()
const emit = defineEmits<{ cancel: []; saved: [order: OrderListItem] }>()
const message = useMessage()
const auth = useAuthStore()
const canOverridePrice = computed(() => auth.user?.role === 'admin' || auth.user?.permissions?.includes('order.price_override') || auth.user?.permissions?.includes('*'))
const sourceLabel = computed(() => ({ route_call: '线路询单', phone_in: '客户来电', miniprogram: '小程序', counter: '门店零售' })[props.order.source])
const deliveryLabel = computed(() => ({ route: '开车自送', freight: '发物流', local: '自送', pickup: '现场提货' })[props.order.delivery_mode])
type Row = { key: number; existing: boolean; skuId: number | null; spuId: number | null; skus: ProductSKU[]; name: string; spec: string; quantity: string; price: string; originalPrice: string; costPrice: string; manualConfirmed: boolean; supplierId: number; purchaseConfirmed: boolean }
let nextKey = 0
const rows = ref<Row[]>(props.order.items.map(item => ({
  key: ++nextKey, existing: true, skuId: item.sku_id, spuId: null, skus: [],
  name: item.spu_name, spec: item.sku_spec, quantity: String(item.quantity),
  price: String(item.unit_price), originalPrice: String(item.unit_price), costPrice: String(item.cost_price || 0), manualConfirmed: false,
  supplierId: item.supplier_id || 0, purchaseConfirmed: item.cost_status === 'actual',
})))
const remark = ref(props.order.remark || '')
const freightMode = ref<'deduct' | 'store_paid' | 'customer_paid'>(
  props.order.freight_mode === 'store_paid' || props.order.freight_mode === 'customer_paid'
    ? props.order.freight_mode : 'deduct',
)
const freightCost = ref(String(props.order.freight_cost || 0))
const canEditFreight = computed(() => props.order.delivery_mode === 'freight' && !props.order.handed_over_at)
const freightOptions = [
  { label: '包邮·客户垫付抵扣', value: 'deduct' },
  { label: '包邮·本店直接付', value: 'store_paid' },
  { label: '不包邮·客户自付', value: 'customer_paid' },
]
const products = ref<ProductSPU[]>([])
const suppliers = ref<{ id: number; name: string }[]>([])
const supplierOptions = computed(() => [{ label: '自己进货', value: 0 }, ...suppliers.value.map(v => ({ label: v.name, value: v.id }))])
const productOptions = computed(() => products.value.map(p => ({ label: p.name, value: p.id })))
const saving = ref(false)
function addRow() {
  rows.value.push({ key: ++nextKey, existing: false, skuId: null, spuId: null, skus: [], name: '', spec: '', quantity: '1', price: '', originalPrice: '', costPrice: '', manualConfirmed: false, supplierId: 0, purchaseConfirmed: false })
}
let searchToken = 0
async function searchProducts(keyword: string) {
  const token = ++searchToken
  try {
    const result = await productApi.spusPage({ keyword: keyword || undefined, page_size: 20 })
    if (token === searchToken) products.value = result.items
  } catch { /* 请求层提示 */ }
}
async function chooseProduct(row: Row) {
  row.skuId = null
  row.price = ''
  row.originalPrice = ''
  row.costPrice = ''
  row.manualConfirmed = false
  row.supplierId = row.spuId ? (await productApi.spu(row.spuId)).supplier_id || 0 : 0
  row.skus = row.spuId ? (await productApi.skus(row.spuId)).filter(s => s.is_enabled !== false) : []
  if (row.skus.length === 1) {
    row.skuId = row.skus[0].id
    await quoteNew(row)
  }
}
function skuLabel(sku: ProductSKU) { return Object.values(sku.specs || {}).join(' ') || String(sku.id) }
async function quoteNew(row: Row) {
  if (!row.skuId) return
  const result = await priceApi.quote({ customer_id: props.order.customer_id, items: [{ sku_id: row.skuId, quantity: row.quantity || '1' }] })
  row.price = result.items[0]?.unit_price || ''
  row.originalPrice = row.price
  row.costPrice = result.items[0]?.cost_price || ''
  row.manualConfirmed = false
}
const money = (value: string) => (Number(value) || 0).toFixed(2)
const lineAmount = (row: Row) => ((Number(row.quantity) || 0) * (Number(row.price) || 0)).toFixed(2)
const lineProfit = (row: Row) => ((Number(row.quantity) || 0) * ((Number(row.price) || 0) - (Number(row.costPrice) || 0))).toFixed(2)
async function loadExistingSkus() {
  await Promise.all(rows.value.map(async row => {
    try {
      const sku = await productApi.sku(row.skuId!)
      row.spuId = sku.spu_id
      row.skus = (await productApi.skus(sku.spu_id)).filter(item => item.is_enabled !== false)
    } catch { /* 请求层提示 */ }
  }))
}
function priceChanged(row: Row) { return row.price !== '' && Number(row.price) !== Number(row.originalPrice) }
function resetPrice(row: Row) { row.price = row.originalPrice; row.manualConfirmed = false }
function confirmPrice(row: Row) {
  if (!priceChanged(row) || row.manualConfirmed || !/^(?:\d+)(?:\.\d{1,2})?$/.test(row.price)) return
  if (!window.confirm(`确认将 ${row.name || products.value.find(p => p.id === row.spuId)?.name || '该商品'} 的订单售价从 ¥${row.originalPrice} 改为 ¥${row.price}？`)) {
    resetPrice(row)
    return
  }
  row.manualConfirmed = true
}
async function save() {
  if (!rows.value.length) { message.warning('订单至少保留一行商品；如需清空请取消订单'); return }
  if (rows.value.some(row => !row.skuId || !/^(?:\d+)(?:\.\d)?$/.test(row.quantity) || Number(row.quantity) <= 0)) {
    message.warning('请选好商品并填写有效数量'); return
  }
  if (rows.value.some(row => !/^(?:\d+)(?:\.\d{1,2})?$/.test(row.price))) {
    message.warning('请填写有效售价'); return
  }
  if (canEditFreight.value && freightMode.value !== 'customer_paid' && freightCost.value && !/^(?:\d+)(?:\.\d{1,2})?$/.test(freightCost.value)) {
    message.warning('请填写有效运费'); return
  }
  if (rows.value.some(priceChanged)) {
    if (!canOverridePrice.value) { message.warning('没有手动改价权限'); return }
    if (rows.value.some(row => priceChanged(row) && !row.manualConfirmed)
      && !window.confirm('确认按修改后的订单售价保存？服务端将校验最低售价。')) return
  }
  const payload: OrderUpdatePayload = {
    version: props.order.version,
    items: rows.value.map(row => ({
      sku_id: row.skuId!, quantity: row.quantity,
      supplier_id: row.supplierId,
      ...(priceChanged(row) ? { unit_price: row.price } : {}),
    })),
    remark: remark.value || null,
  }
  if (canEditFreight.value) {
    payload.freight_mode = freightMode.value
    payload.freight_cost = freightMode.value === 'customer_paid' ? '0.00' : freightCost.value || '0.00'
  }
  saving.value = true
  try {
    const result = await orderApi.update(props.order.id, payload)
    message.success('订单已保存')
    for (const warning of result.warnings) message.warning(warning.message)
    emit('saved', result.order)
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'response' in error
      && (error as { response?: { status?: number } }).response?.status === 409) {
      message.warning('订单已被其他人修改，请返回列表后重新打开')
    }
  } finally { saving.value = false }
}
onMounted(() => { void searchProducts(''); void loadExistingSkus(); void fetchAllPages(page => vendorApi.list({ page, page_size: 20 })).then(v => { suppliers.value = v }) })
</script>

<style scoped>
.order-edit{display:grid;gap:16px;padding:16px}.header-grid,.dispatch-grid{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:12px;align-items:end}.dispatch-grid{margin-top:12px}label{display:grid;gap:5px;color:#555;font-size:13px}.remark{margin-top:12px}.hint{color:#888;font-size:12px}.table-wrap{overflow-x:auto}table{width:100%;min-width:1120px;border-collapse:collapse}th,td{padding:9px 6px;text-align:left;border-bottom:1px solid #eee;vertical-align:top}th{color:#666;font-weight:500;background:#fafafa}td:first-child{min-width:220px}td:nth-child(2){min-width:160px}td:nth-child(3),td:nth-child(4),td:nth-child(5){min-width:110px}.price-cell .n-input{max-width:130px}.price-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px}.manual-tag{color:#d03050;font-size:12px}.profit{color:#d03050;font-weight:700}.add-button{margin-top:12px}.totals,.footer{display:flex;justify-content:flex-end;gap:24px;align-items:center;padding-top:18px}.totals{flex-wrap:wrap}.totals span:nth-child(2){color:#d03050;font-weight:700}.footer{border-top:1px solid #eee;margin-top:18px}@media(max-width:900px){.header-grid,.dispatch-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.header-grid,.dispatch-grid{grid-template-columns:1fr}.totals,.footer{justify-content:flex-start}}
.order-edit{display:flex;flex-direction:column;min-height:100%;box-sizing:border-box;padding-bottom:140px}
.action-bar{position:fixed;left:var(--wdm-sider-width,220px);right:0;bottom:0;z-index:20;display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:16px 28px;box-sizing:border-box;padding:12px 16px;background:#fff;border-top:1px solid #e5e7eb;box-shadow:0 -5px 18px #10182812}
.totals,.footer{padding-top:0}
.footer{border-top:0;margin-top:0}
</style>
