// src/utils/dict.ts - Static dictionary / enum label helpers.
import type { DashboardTodoCode, OrderStatus, PaymentMethod, CustomerStatus, CustomerLevel, ProductStatus, PriceStrategyType, PriceAdjustmentType, PriceMethod, PriceSource, VendorType, VendorStatus, RouteTripStatus, RouteStopOrigin, CallResult, OrderPriceAdjustmentStatus } from '@/types'

export const ORDER_STATUS: Record<OrderStatus, { label: string; type: 'primary' | 'success' | 'warning' | 'info' | 'danger' }> = {
  pending_audit: { label: '待审核', type: 'warning' },
  rejected: { label: '已驳回', type: 'danger' },
  paid: { label: '待分拣', type: 'primary' },
  picking: { label: '分拣中', type: 'primary' },
  shipped: { label: '已发货', type: 'success' },
  completed: { label: '已完成', type: 'success' },
  cancelled: { label: '已取消', type: 'info' },
}

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  online: '在线支付',
  credit: '账期挂账',
  wechat: '微信',
  alipay: '支付宝',
  cash: '现金',
  bank: '对公转账',
}

export const CUSTOMER_STATUS: Record<CustomerStatus, { label: string; type: 'primary' | 'success' | 'warning' | 'info' | 'danger' }> = {
  pending: { label: '待审核', type: 'warning' },
  active: { label: '正常', type: 'success' },
  disabled: { label: '已禁用', type: 'danger' },
}

export const CUSTOMER_LEVEL: Record<CustomerLevel, { label: string; type: string }> = {
  bronze: { label: '青铜', type: 'info' },
  silver: { label: '白银', type: 'info' },
  gold: { label: '黄金', type: 'warning' },
  vip: { label: 'VIP', type: 'danger' },
}

export const PRICE_ADJUSTMENT_TYPE: Record<PriceAdjustmentType, string> = {
  percent: '百分比浮动',
  amount: '固定金额加减',
}

export const PRODUCT_STATUS: Record<ProductStatus, { label: string; type: 'primary' | 'success' | 'warning' | 'info' | 'danger' }> = {
  on_sale: { label: '在售', type: 'success' },
  off_shelf: { label: '下架', type: 'info' },
  draft: { label: '草稿', type: 'warning' },
}

export const PRICE_STRATEGY_TYPE: Record<PriceStrategyType, { label: string; type: string; color: string }> = {
  tier: { label: '等级价', type: 'primary', color: '#409EFF' },
  customer: { label: '客户专属价', type: 'success', color: '#67C23A' },
  ladder: { label: '阶梯价', type: 'warning', color: '#E6A23C' },
  flash: { label: '限时特价', type: 'danger', color: '#F56C6C' },
}

export const PRICE_METHOD: Record<PriceMethod, string> = {
  percent: '百分比 (%)',
  amount: '固定金额 (元)',
}

export const PRICE_SOURCE: Record<PriceSource, { label: string; type: 'success' | 'primary' | 'info' | 'default' }> = {
  customer_fixed: { label: '客户专属价', type: 'success' },
  level_sku: { label: '等级SKU价', type: 'primary' },
  level_default: { label: '等级默认价', type: 'info' },
  suggested: { label: '建议零售价', type: 'default' },
}

export const RULE_SOURCE: Record<'sku' | 'level' | 'none', string> = {
  sku: 'SKU专属规则',
  level: '等级默认规则',
  none: '无规则',
}

// 看板「要处理的事」：文案与点击跳转（跳转目标尚未建好的页面会提示"尚未开放"）
export const DASHBOARD_TODO: Record<DashboardTodoCode, { label: string; to: string; toLabel: string }> = {
  pool_orders: { label: '待送货订单', to: '/delivery/pool', toLabel: '待送货订单' },
  pending_orders: { label: '待审核订单', to: '/order-center/approvals', toLabel: '订单审批' },
  pending_customers: { label: '待审核客户', to: '/customers/audit', toLabel: '客户审核' },
  pending_returns: { label: '待确认退货单', to: '/order-center/refund', toLabel: '退货单' },
  credit_applications: { label: '待审批调额申请', to: '/finance/credit', toLabel: '客户账期' },
  negative_stock: { label: '负库存商品', to: '/inventory/stock', toLabel: '库存查询' },
  no_upcoming_trip: { label: '近期未安排出车', to: '/delivery/trips', toLabel: '安排出车' },
}

export const OVERDUE_BUCKET: Record<'1_30' | '31_60' | '60_plus', string> = {
  '1_30': '1–30 天',
  '31_60': '31–60 天',
  '60_plus': '60 天以上',
}

// ---------- 供应商 ----------
export const VENDOR_TYPE: Record<VendorType, string> = {
  market: '市场店家',
  origin: '产地',
  manufacturer: '厂家',
}
export const VENDOR_TYPE_OPTIONS = (Object.keys(VENDOR_TYPE) as VendorType[]).map((value) => ({ label: VENDOR_TYPE[value], value }))
export const vendorTypeLabel = (t: string) => VENDOR_TYPE[t as VendorType] || t

export const VENDOR_STATUS: Record<VendorStatus, { label: string; type: 'success' | 'warning' | 'error' }> = {
  active: { label: '正常', type: 'success' },
  order_disabled: { label: '禁止下单', type: 'warning' },
  login_disabled: { label: '禁止登录', type: 'error' },
}
export const VENDOR_STATUS_OPTIONS = (Object.keys(VENDOR_STATUS) as VendorStatus[]).map((value) => ({ label: VENDOR_STATUS[value].label, value }))
export const vendorStatusMeta = (s: string) => VENDOR_STATUS[s as VendorStatus] || { label: s, type: 'error' as const }

export const returnStatusLabels = { pending: '待确认', confirmed: '已确认', rejected: '已驳回' }
export const returnSettlementLabels = { none: '—', unsettled: '未平', partial: '部分已平', settled: '已平完' }
export const returnRefundLabels = { credit: '挂账待抵', wechat: '微信退款', alipay: '支付宝退款', cash: '现金退款' }
export const returnFreightLabels = { none: '无退货运费', deduct: '运费补给客户', store_paid: '本店承担', customer_paid: '客户承担' }
export const returnDispositionLabels = { restock: '退回库存', write_off: '报损' }

// ---------- 线路配送：出车 ----------
export const ROUTE_TRIP_STATUS: Record<RouteTripStatus, { label: string; type: 'info' | 'warning' | 'success' | 'default' }> = {
  planned: { label: '计划中', type: 'info' },
  delivering: { label: '配送中', type: 'warning' },
  finished: { label: '已完成', type: 'default' },
  cancelled: { label: '已取消', type: 'default' },
}
export const ROUTE_TRIP_STATUS_OPTIONS = (Object.keys(ROUTE_TRIP_STATUS) as RouteTripStatus[]).map((value) => ({
  label: ROUTE_TRIP_STATUS[value].label,
  value,
}))

export const ROUTE_STOP_ORIGIN: Record<RouteStopOrigin, { label: string; type: 'info' | 'primary' | 'warning' }> = {
  county: { label: '县城', type: 'info' },
  corridor: { label: '沿线', type: 'primary' },
  manual: { label: '手动', type: 'warning' },
}

export const CALL_RESULT: Record<CallResult, { label: string; type: 'default' | 'success' | 'info' | 'warning' }> = {
  none: { label: '未询', type: 'default' },
  ordered: { label: '已下单', type: 'success' },
  declined: { label: '本次不要', type: 'info' },
  unreachable: { label: '未接通', type: 'warning' },
}

// ---------- 待排车订单 ----------
export const ORDER_SOURCE: Record<'route_call' | 'phone_in' | 'miniprogram' | 'counter', string> = {
  route_call: '线路询单',
  phone_in: '客户来电',
  miniprogram: '小程序',
  counter: '门店零售',
}

export const ORDER_PAY_STATUS: Record<'unpaid' | 'partial' | 'paid', { label: string; type: 'warning' | 'info' | 'success' }> = {
  unpaid: { label: '未付款', type: 'warning' },
  partial: { label: '部分付款', type: 'info' },
  paid: { label: '已付清', type: 'success' },
}

export const ORDER_PRICE_ADJUSTMENT_STATUS: Record<OrderPriceAdjustmentStatus, { label: string; type: 'warning' | 'success' | 'error' }> = {
  pending: { label: '待审批', type: 'warning' },
  approved: { label: '已同意', type: 'success' },
  rejected: { label: '已驳回', type: 'error' },
}

export const POOL_ORDER_STATE: Record<'overdue' | 'urgent' | 'normal', { label: string; type: 'error' | 'warning' | 'info' }> = {
  overdue: { label: '超期未排车', type: 'error' },
  urgent: { label: '即将到期', type: 'warning' },
  normal: { label: '待排车', type: 'info' },
}

export const FREIGHT_MODE: Record<'deduct' | 'store_paid' | 'customer_paid', string> = {
  deduct: '包邮·客户垫付抵扣',
  store_paid: '包邮·本店直接付',
  customer_paid: '不包邮·客户自付',
}

export const DELIVERY_MODE: Record<'freight' | 'route' | 'local' | 'pickup', { label: string; type: 'info' | 'primary' | 'warning' | 'success' }> = {
  freight: { label: '发物流', type: 'info' },
  route: { label: '自送', type: 'primary' },
  local: { label: '城区自送', type: 'warning' },
  pickup: { label: '自取', type: 'success' },
}

/** 经营成本的类别配色（类别可自定义，未列出的按名称散列取色）。 */
export const EXPENSE_CATEGORY_COLOR: Record<string, string> = {
  油费: '#e46d19',
  人工: '#2563eb',
  仓储: '#7c3aed',
  电费: '#b7791f',
  其他: '#6b7280',
  销售提成: '#be185d',
}

const EXTRA_CATEGORY_COLORS = ['#0f9488', '#be185d', '#4338ca', '#b45309', '#4d7c0f']

export function expenseCategoryColor(category: string): string {
  const known = EXPENSE_CATEGORY_COLOR[category]
  if (known) return known
  let hash = 0
  for (const ch of category) hash = (hash * 31 + ch.charCodeAt(0)) % 997
  return EXTRA_CATEGORY_COLORS[hash % EXTRA_CATEGORY_COLORS.length]
}
