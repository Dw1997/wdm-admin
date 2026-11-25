// src/types/index.ts - Domain types shared across the admin frontend.
// Aligned with backend/app/api/v1/*.py Pydantic schemas.

export type Role = 'admin' | 'sales' | 'customer'

export interface UserInfo {
  id: number
  username: string
  real_name?: string
  role: Role
  permissions?: string[]
  avatar?: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  expires_in: number
}

// ---------- Product ----------
export type ProductStatus = 'on_sale' | 'off_shelf' | 'draft'

/** Multi-unit conversion, e.g. 1 箱 = 24 包. */
export interface ProductUnit {
  name: string // 箱 / 包 / 个
  ratio: number // relative to base unit (base = 1)
  base_unit?: string
}

/** Stock batch with production / expiry dates (FIFO). */
export interface StockBatch {
  batch_no: string
  production_date: string // YYYY-MM-DD
  expiry_date: string
  quantity: number
  cost_price: number
}

export interface Product {
  id: number
  sku: string
  name: string
  category: string
  brand?: string
  spec?: string
  base_unit: string
  units: ProductUnit[]
  status: ProductStatus
  stock: number
  safety_stock: number
  expiry_warning_days: number
  batches: StockBatch[]
  cover?: string
  description?: string
  created_at: string
  updated_at: string
}

export interface ProductSummary {
  id: number
  sku: string
  name: string
  unit: string
  stock: number
}

export interface PriceResponse {
  product_id: number
  customer_id: number
  unit: string
  unit_price: number
  currency: 'CNY'
}

// ---------- Price ----------
export type PriceStrategyType = 'tier' | 'customer' | 'ladder' | 'flash'

export interface PriceStrategy {
  id: number
  product_id: number
  product_name?: string
  type: PriceStrategyType
  name: string
  /** For 'tier': list of {level, price}. For 'customer': list of customer ids. */
  rules: PriceRule[]
  starts_at?: string
  ends_at?: string
  enabled: boolean
  priority: number
  remark?: string
  created_at: string
}

export interface PriceRule {
  level?: string // bronze/silver/gold for tier
  min_qty?: number // for ladder
  customer_id?: number // for customer-specific
  customer_name?: string
  unit: string
  unit_price: number
}

// ---------- Customer ----------
export type CustomerStatus = 'pending' | 'active' | 'disabled'
export type AdminCustomerStatus = 'pending' | 'active' | 'order_disabled' | 'login_disabled'
export type CustomerLevel = 'bronze' | 'silver' | 'gold' | 'vip'

export interface Customer {
  id: number
  name: string
  phone: string
  address?: string
  shop_name?: string
  status: CustomerStatus
  level: CustomerLevel
  sales_id?: number
  sales_name?: string
  credit_limit: number
  used_credit: number
  available_credit: number
  invite_code?: string
  registered_at: string
  last_order_at?: string
  remark?: string
}

export interface CustomerTag {
  id: number
  name: string
  level_id?: number | null
  level_code?: string | null
  level_nickname?: string | null
  customer_count?: number
  sort_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface CustomerTagPayload {
  name: string
  level_id?: number | null
  sort_order?: number
  is_active?: boolean
}

export interface ApplicableTagItem {
  id: number
  name: string
}

export interface AdminCustomer {
  id: number
  name: string
  tag_id?: number | null
  tag_name?: string | null
  is_system?: boolean
  /** 单独额度；null 表示跟随所在等级的默认额度（改额度走 PUT /customers/{id}/credit） */
  credit_limit?: string | null
  /** 生效额度 = 单独额度 ?? 等级默认额度 */
  effective_credit_limit: string
  credit_source: 'level' | 'custom'
  level_default_credit_limit?: string | null
  payment_term_type: 'days' | 'monthly'
  term_days?: number | null
  monthly_due_day?: number | null
  credit_note?: string | null
  created_by?: number | null
  created_by_name?: string | null
  reject_reason?: string | null
  audited_at?: string | null
  contact_name?: string | null
  contact_phone?: string | null
  phone?: string | null
  /** 是否已绑定微信（unionid / openid 只由微信登录写入，接口不返回） */
  wechat_bound: boolean
  wechat_bound_at?: string | null
  level_id?: number | null
  level_code?: string | null
  level_nickname?: string | null
  status: AdminCustomerStatus
  sales_id?: number | null
  sales_name?: string | null
  /** 归属账号是管理员（自来客） */
  sales_is_admin: boolean
  /** 关联供应商ID（既是客户又是供应商时用于两本账抵账） */
  vendor_id?: number | null
  default_delivery_mode?: 'route' | 'freight' | 'local'
  delivery_region_id?: number | null
  freight_line_id?: number | null
  default_freight_mode?: 'deduct' | 'store_paid' | 'customer_paid'
  invite_code?: string | null
  referrer_customer_id?: number | null
  referrer_customer_name?: string | null
  referred_at?: string | null
  address?: string | null
  province?: string | null
  city?: string | null
  district?: string | null
  town?: string | null
  detail_address?: string | null
  created_at?: string
  updated_at?: string
  warnings?: ApiWarning[]
}

/** POST /customers：内部账号新建客户，不带 unionid / openid（customers.md） */
export interface CustomerCreatePayload {
  name: string
  phone: string
  contact_name?: string | null
  contact_phone?: string | null
  /** 客户类型标签 ID（单选，可空，与等级价格无关） */
  tag_id?: number | null
  /** 关联供应商 ID（仅管理员，可空） */
  vendor_id?: number | null
  /** 仅管理员有效；不传归当前账号 */
  sales_id?: number | null
  /** 介绍人（拉新老客户）ID */
  referrer_customer_id?: number | null
  /** 等级价格 ID；不传自动绑定内置「默认售价」等级 */
  level_id?: number | null
  address?: string | null
  province?: string | null
  city?: string | null
  district?: string | null
  town?: string | null
  detail_address?: string | null
  default_delivery_mode?: 'route' | 'freight' | 'local'
  delivery_region_id?: number | null
  freight_line_id?: number | null
  default_freight_mode?: 'deduct' | 'store_paid' | 'customer_paid'
}

export interface CustomerUpdatePayload {
  name?: string
  tag_id?: number | null
  vendor_id?: number | null
  contact_name?: string | null
  contact_phone?: string | null
  phone?: string
  status?: AdminCustomerStatus
  invite_code?: string | null
  referrer_customer_id?: number | null
  referrer_customer_name?: string | null
  referred_at?: string | null
  address?: string | null
  province?: string | null
  city?: string | null
  district?: string | null
  town?: string | null
  detail_address?: string | null
  default_delivery_mode?: 'route' | 'freight' | 'local'
  delivery_region_id?: number | null
  freight_line_id?: number | null
  default_freight_mode?: 'deduct' | 'store_paid' | 'customer_paid'
}

export interface CustomerResult {
  customer: AdminCustomer
  warnings: { code: string; message: string; data?: unknown }[]
}

/** PUT /customers/{id}/credit：credit_limit 显式传 null = 恢复跟随等级 */
export interface CustomerCreditPayload {
  credit_limit?: number | string | null
  reason?: string
  payment_term_type?: 'days' | 'monthly'
  term_days?: number | null
  monthly_due_day?: number | null
  credit_note?: string | null
}

export type CreditChangeType = 'level_default' | 'application' | 'admin_set' | 'level_change'

export interface CreditLog {
  id: number
  change_type: CreditChangeType
  customer_id?: number | null
  level_id?: number | null
  before?: string | null
  after?: string | null
  application_id?: number | null
  operator_id?: number | null
  operator_name?: string | null
  reason?: string | null
  created_at?: string
}

export type CreditApplicationStatus = 'pending' | 'approved' | 'rejected'

export interface CreditApplication {
  id: number
  customer_id: number
  customer_name?: string | null
  sales_id: number
  sales_name?: string | null
  current_limit: string
  requested_limit: string
  reason: string
  status: CreditApplicationStatus
  approved_limit?: string | null
  reviewer_name?: string | null
  reviewed_at?: string | null
  review_comment?: string | null
  created_at?: string
}

export interface CreditApplicationResult {
  application: CreditApplication
  customer?: AdminCustomer | null
  warnings: { code: string; message: string }[]
}

/** POST /customers/{id}/audit */
export interface CustomerAuditPayload {
  approved: boolean
  level_id?: number | null
  tag_id?: number | null
  sales_id?: number | null
  name?: string
  contact_name?: string
  delivery_region_id?: number | null
  default_delivery_mode?: 'route' | 'freight' | 'local'
  address?: string
  detail_address?: string
  referrer_customer_id?: number | null
  reason?: string
}

/** GET /promotion/qrcode：销售/管理员推广微信小程序码 */
export interface PromotionQrcode {
  account_id?: number | null
  account_name?: string
  invite_code: string
  scene: string
  invite_url: string
  qrcode_url: string
  unavailable_reason?: string | null
}

/** GET /customers/sales-options：可选归属销售（销售和管理员账号） */
export interface SalesOption {
  id: number
  name: string
  is_admin: boolean
  is_owner: boolean
}

// ---------- Warehouse / Logistics ----------
export interface Warehouse {
  id: number
  name: string
  type: 'main' | 'return' | 'virtual'
  created_at?: string
  updated_at?: string
}

export interface WarehouseCreatePayload {
  name: string
  type: Warehouse['type']
}

export interface WarehouseUpdatePayload {
  name?: string
  type?: Warehouse['type']
}

export interface WarehouseZone {
  id: number
  warehouse_id: number
  name: string
  created_at?: string
  updated_at?: string
}

export interface WarehouseZoneCreatePayload {
  warehouse_id: number
  name: string
}

export interface WarehouseZoneUpdatePayload {
  name?: string
}

// ---------- Sales ----------
export interface Sales {
  id: number
  name: string
  phone: string
  invite_code: string
  total_customers: number
  active_customers: number
  total_gmv: number
  estimated_commission: number
  joined_at: string
  status: 'active' | 'disabled'
  region?: string
  remark?: string
}

export interface SalesPerformance {
  sales_id: number
  sales_name: string
  period_start: string
  period_end: string
  order_count: number
  gmv: number
  estimated_commission: number
  new_customers: number
}

/** Response of GET /sales/ranking */
export interface SalesRankingItem {
  sales_id: number
  sales_name: string
  period_start: string
  period_end: string
  order_count: number
  gmv: number
  estimated_commission: number
  new_customers: number
  ranking: number
}

/** GET /sales/{sales_id}/dashboard，金额均由服务端返回。 */
export interface SalesDashboard {
  sales_id: number
  sales_name: string
  is_active: boolean
  customer_count: number
  commission_rate?: string | null
  as_of_date: string
  today: { sales_amount: string; order_count: number }
  month: {
    sales_amount: string
    order_count: number
    daily_sales: { date: string; sales_amount: string }[]
  }
  commissions: {
    estimated_amount: string
    pending_amount: string
    settled_amount: string
  }
}

// ---------- Order ----------
export type OrderStatus =
  | 'pending_audit'
  | 'rejected'
  | 'paid'
  | 'picking'
  | 'shipped'
  | 'completed'
  | 'cancelled'

export type PaymentMethod = 'online' | 'credit' | 'wechat' | 'alipay' | 'cash' | 'bank'

export interface OrderItem {
  product_id: number
  product_name: string
  sku: string
  unit: string
  quantity: number
  unit_price: number
  original_unit_price?: number | string | null
  subtotal: number
}

export interface Order {
  id: string
  customer_id: number
  customer_name: string
  sales_id?: number
  sales_name?: string
  status: OrderStatus
  payment_method: PaymentMethod
  total_amount: number
  paid_amount: number
  items: OrderItem[]
  remark?: string
  rejection_reason?: string
  delivery_address?: string
  created_at: string
  audited_at?: string
  shipped_at?: string
  completed_at?: string
  pending_price_adjustment?: PendingPriceAdjustment | null
}

export interface OrderPaymentRecord {
  payment_id: number
  method: 'wechat' | 'alipay' | 'cash' | 'other' | string
  channel?: 'offline' | 'wx_miniprogram' | string
  wx_transaction_id?: string | null
  amount: number | string
  received_amount?: number | string | null
  change_amount?: number | string | null
  rounding_amount?: number | string | null
  paid_at: string
  operator_name?: string | null
}

export interface PaymentRecordAllocation {
  order_id: number
  order_no: string
  amount: number | string
}

export interface PaymentRecordItem {
  id: number
  customer_id: number
  customer_name: string
  amount: number | string
  rounding_amount: number | string
  kind: 'receipt' | 'refund' | string
  method: 'wechat' | 'alipay' | 'cash' | 'other' | string
  channel: 'offline' | 'wx_miniprogram' | string
  wx_transaction_id?: string | null
  out_trade_no?: string | null
  paid_at: string
  operator_name?: string | null
  remark?: string | null
  allocations: PaymentRecordAllocation[]
}

export interface OrderReturnSettlementRecord {
  settlement_id: number
  return_order_id: number
  return_no: string
  amount: number | string
  created_at: string
}

/** 当前后端订单摘要与详情字段（docs/00-core/api/orders.md）。 */
export interface OrderListItem {
  id: number
  order_no: string
  customer_id: number
  customer_name: string
  customer_phone?: string | null
  is_walk_in: boolean
  sales_id?: number | null
  sales_name?: string | null
  source: 'route_call' | 'phone_in' | 'miniprogram' | 'counter'
  delivery_mode: 'route' | 'freight' | 'local' | 'pickup'
  status: 'pending_approval' | 'pending' | 'delivering' | 'delivered' | 'cancelled' | 'rejected'
  pay_status: 'unpaid' | 'partial' | 'paid'
  return_status: 'none' | 'partial' | 'full'
  total_amount: number
  delivered_amount?: number | null
  paid_amount: number
  discount_amount: number
  customer_coupon_id?: number | null
  coupon_name?: string | null
  coupon_type?: CouponType | null
  coupon_amount?: number
  returned_amount: number
  return_settled_amount?: number
  return_freight_cost?: number
  unpaid_amount: number
  route_trip_id?: number | null
  route_trip_name?: string | null
  route_trip_date?: string | null
  freight_shipment_id?: number | null
  freight_line_id?: number | null
  freight_line_name?: string | null
  freight_ship_date?: string | null
  freight_depart_time?: string | null
  freight_town_region_id?: number | null
  freight_mode?: 'deduct' | 'store_paid' | 'customer_paid' | 'none'
  freight_cost?: number | null
  pool_deadline?: string | null
  remaining_hours?: number | null
  pool_overdue?: boolean
  has_freight_line?: boolean
  delivery_region_id?: number | null
  delivery_region_name?: string | null
  auto_joined?: boolean
  auto_moved?: boolean
  handed_over_at?: string | null
  due_date?: string | null
  over_credit: boolean
  approval_stage?: string | null
  reject_reason?: string | null
  dispatch_note?: string | null
  created_by_name?: string | null
  created_at: string
  delivered_at?: string | null
  remark?: string | null
  version: number
  print_count?: number
  last_printed_at?: string | null
  items: { id: number; sku_id: number; spu_name: string; sku_spec: string; unit: string; quantity: number; delivered_quantity?: number | string | null; returned_quantity?: number | string; restocked_quantity?: number | string; unit_price: number; original_unit_price?: number | string | null; price_source?: string; amount: number; cost_price?: number | null; supplier_id?: number | null; supplier_name?: string | null; cost_status?: 'estimated' | 'actual' | null; purchase_receipt_id?: number | null; commission_rate?: number | string | null; commission_amount?: number | string | null }[]
  payments?: OrderPaymentRecord[]
  return_settlements?: OrderReturnSettlementRecord[]
  commission_amount?: number | string | null
  goods_cost?: number | null
  profit?: number | null
  pending_price_adjustment?: PendingPriceAdjustment | null
  price_adjustments?: OrderPriceAdjustment[]
}

// ---------- 订单批量操作（orders.md） ----------
export interface BatchSkipItem {
  order_id: number
  order_no?: string | null
  reason: string
}

export interface BatchDeliverPayload {
  order_ids: number[]
  delivered_at?: string | null
}

export interface BatchDeliverResult {
  delivered_count: number
  order_ids: number[]
  skipped: BatchSkipItem[]
  warnings: ApiWarning[]
}

export interface BatchCancelPayload {
  order_ids: number[]
  reason?: string | null
}

export interface BatchCancelResult {
  cancelled_count: number
  order_ids: number[]
  skipped: BatchSkipItem[]
  warnings: ApiWarning[]
}

// ---------- 送达前改价审批（orders.md） ----------
export type OrderPriceAdjustmentStatus = 'pending' | 'approved' | 'rejected'

export interface OrderPriceAdjustmentItem {
  order_item_id: number
  spu_name: string
  sku_spec: string
  unit: string
  quantity: number | string
  old_unit_price: number | string
  new_unit_price: number | string
  diff_amount: number | string
}

export interface OrderPriceAdjustment {
  id: number
  order_id: number
  order_no: string
  customer_id: number
  customer_name: string
  sales_id: number | null
  sales_name: string | null
  order_status: string
  status: OrderPriceAdjustmentStatus
  reason: string | null
  applicant_id: number | null
  applicant_name: string | null
  reviewer_id: number | null
  reviewer_name: string | null
  review_comment: string | null
  total_before: number | string
  total_after: number | string
  total_diff_amount: number | string
  waiting_hours: number
  items: OrderPriceAdjustmentItem[]
  created_at: string
  reviewed_at: string | null
}

/** 订单上挂载的待审批改价摘要 */
export interface PendingPriceAdjustment {
  id: number
  reason: string | null
  applicant_name: string | null
  created_at: string
  items_count: number
  total_diff_amount: number | string
}

export interface OrderPriceAdjustmentPayload {
  items: { order_item_id: number; new_unit_price: string }[]
  reason?: string
}

export interface OrderPriceAdjustmentQuery {
  status?: OrderPriceAdjustmentStatus | 'all'
  page?: number
  page_size?: number
}

export interface OrderPriceAdjustmentResult {
  adjustment: OrderPriceAdjustment
  order: OrderListItem
}

// ---------- 打印中心（orders.md §7） ----------
export type SalesNoteDocType = 'delivery_note' | 'counter_sale'

export interface SalesNoteItem {
  spu_name: string
  sku_spec: string
  unit: string
  quantity: string
  unit_price: string
  amount: string
}

export interface SalesNote {
  order_id: number
  order_no: string
  doc_type: SalesNoteDocType
  status: string
  source: string
  delivery_mode: string
  created_at: string
  customer_name: string | null
  customer_phone: string | null
  contact_name: string | null
  sales_name: string | null
  delivery_place: string | null
  delivery_address: string | null
  items: SalesNoteItem[]
  total_amount: string
  freight_mode: string
  freight_cost: string | null
  freight_deduction: string
  coupon_name?: string | null
  coupon_amount?: string
  discount_amount: string
  amount_due: string
  paid_amount: string
  payment_method: string | null
  change_amount: string
  remark: string | null
  print_count: number
  last_printed_at: string | null
  is_reprint: boolean
}

export type PickingScopeType = 'trip' | 'shipment' | 'unassigned'

export interface PickingSegment {
  order_id: number
  order_no: string
  customer_name: string
  quantity: string
}

export interface PickingItem {
  sku_id: number
  spu_id: number
  spu_name: string
  sku_spec: string
  unit: string
  base_unit: string
  base_qty: string
  segments: PickingSegment[]
  order_count: number
  total_quantity: string
  total_base_qty: string
}

export interface PickingResult {
  scope: { type: PickingScopeType; route_trip_id: number | null; freight_shipment_id: number | null; unassigned: boolean }
  summary: { order_count: number; sku_count: number; spu_count: number }
  items: PickingItem[]
}

export interface SystemSettingItem {
  key: string
  value: unknown
  description: string | null
}

export interface OrderUpdatePayload {
  version: number
  items: { sku_id: number; quantity: string; unit_price?: string; supplier_id?: number }[]
  remark: string | null
  freight_mode?: 'deduct' | 'store_paid' | 'customer_paid'
  freight_cost?: string
}

export interface OrderUpdateResult {
  order: OrderListItem
  warnings: { code: string; message: string; data?: Record<string, unknown> }[]
}

// ---------- Finance ----------
export interface StatementItem {
  order_id: string
  occurred_at: string
  amount: number
  type: 'order' | 'payment' | 'adjust'
  remark?: string
}

// ---------- 财务：销售提成（finance.md §9） ----------
export type CommissionStatus = 'estimated' | 'pending' | 'settled'

export interface CommissionRow {
  order_id: number
  order_no: string
  sales_id: number | null
  sales_name: string | null
  customer_id: number
  customer_name: string
  order_date: string
  delivered_date: string | null
  base_amount: string
  commission_rate: string | null
  commission_amount: string
  status: CommissionStatus
  settlement_no: string | null
  settled_at: string | null
  /** 已结算时的实发金额快照；未结算为 null */
  settled_amount: string | null
  /** 已结算后又退货、尚未抵扣的提成 */
  clawback_amount: string
  /** 提成基数里已扣掉的退货金额 */
  returned_amount: string
}

export interface CommissionKpi {
  total_amount: string
  total_base: string
  order_count: number
  pending_amount: string
  pending_count: number
  settled_amount: string
  settled_count: number
  estimated_amount: string
  estimated_count: number
  /** 全店未抵扣完的退货冲销，跨月份累计 */
  clawback_amount: string
  clawback_count: number
  /** 待结算扣除待抵扣后的应发现金 */
  net_pending_amount: string
}

export interface CommissionSales {
  sales_id: number
  sales_name: string
  is_active: boolean
  default_rate: string | null
  has_rate: boolean
  order_count: number
  base_amount: string
  commission_amount: string
  pending_amount: string
  settled_amount: string
  clawback_amount: string
  net_amount: string
}

export interface CommissionSummary {
  month: string
  kpi: CommissionKpi
  sales: CommissionSales[]
}

export interface CommissionSettlementBrief {
  settlement_no: string
  sales_id: number
  sales_name: string
  gross_amount: string
  deduct_amount: string
  amount: string
  item_count: number
}

export interface CommissionSettleResult {
  settlements: CommissionSettlementBrief[]
  total_gross_amount: string
  total_deduct_amount: string
  total_amount: string
}

export interface CommissionSettlement {
  settlement_no: string
  settle_date: string
  sales_id: number
  sales_name: string
  item_count: number
  gross_amount: string
  deduct_amount: string
  amount: string
  remark: string | null
  operator_name: string | null
  status: 'active' | 'revoked'
  revoked_at: string | null
  cost_months: string[]
}

export interface CommissionSettlementItem {
  order_id: number
  order_no: string
  customer_name: string
  order_date: string
  base_amount: string
  commission_amount: string
  /** commission 提成行 / deduction 退货冲销行（金额为负） */
  kind: 'commission' | 'deduction'
}

export interface CommissionSettlementDetail extends CommissionSettlement {
  items: CommissionSettlementItem[]
}

export interface CommissionRevokeResult {
  settlement_no: string
  status: string
  amount: string
  removed_expense_count: number
}

// ---------- 财务：提成设置（finance.md §9.2） ----------
export interface CommissionSettingSales {
  sales_id: number
  sales_name: string
  is_active: boolean
  default_rate: string | null
  own_count: number
  sku_total: number
}

export interface CommissionSettingSku {
  sku_id: number
  sku_spec: string
  sku_remark: string | null
  unit: string
  barcode: string | null
  is_enabled: boolean
  own_rate: string | null
  effective_rate: string | null
  is_own: boolean
}

export interface CommissionSettingSpu {
  spu_id: number
  spu_name: string
  spu_code: string
  category_id: number | null
  category_name: string | null
  is_enabled: boolean
  skus: CommissionSettingSku[]
}

export interface CommissionSettingChangeItem {
  sku_id: number
  sku_name: string
  sku_spec: string
  old_rate: string | null
  new_rate: string | null
}

export interface CommissionSettingChange {
  batch_no: string
  created_at: string
  operator_name: string
  sales_id: number
  sales_name: string
  way: 'single' | 'batch' | 'clear'
  changed_count: number
  changes: CommissionSettingChangeItem[]
}

export interface CommissionSettingSaveResult {
  sales_id: number
  changed_count: number
  cleared_count: number
  batch_no: string | null
}

// ---------- 财务：经营成本与月度利润（finance.md §10） ----------
export interface ExpenseCategory {
  id: number
  name: string
  is_system: boolean
}

export interface OperatingExpense {
  id: number
  month: string
  expense_date: string
  category_id: number
  category: string
  amount: string
  remark: string | null
  operator_id: number | null
  operator_name: string | null
  source: 'manual' | 'commission'
  settlement_no: string | null
  created_at: string
}

export interface MonthlyProfitSummary {
  month: string
  sales_amount: string
  goods_cost: string
  freight_cost: string
  rounding_amount: string
  order_profit: string
  operating_cost: string
  profit: string
  order_count: number
}

export interface MonthlyProfitPoint {
  month: string
  order_profit: string
  operating_cost: string
  profit: string
}

export interface ExpenseCategoryTotal {
  category_id: number
  category: string
  amount: string
}

export interface MonthlyProfitReport extends MonthlyProfitSummary {
  prev: MonthlyProfitSummary | null
  trend: MonthlyProfitPoint[]
  categories: ExpenseCategoryTotal[]
}

// ---------- Dashboard（接口见 docs/00-core/api/system.md） ----------
export interface DashboardToday {
  sales_order_count: number
  sales_amount: string
  pending_order_count: number
  pending_amount: string
  trip_count: number
  trip_order_count: number
  trip_delivered_count: number
  freight_order_count: number
  freight_pending_count: number
  payment_amount: string
}

export type DashboardTodoCode =
  | 'pool_orders'
  | 'pending_orders'
  | 'pending_customers'
  | 'pending_returns'
  | 'credit_applications'
  | 'negative_stock'
  | 'no_upcoming_trip'

export interface DashboardTodo {
  code: DashboardTodoCode
  count: number
  data: { min_remaining_hours?: number; overdue_count?: number; days?: number } | null
}

export interface DashboardOverdueBucket {
  key: '1_30' | '31_60' | '60_plus'
  amount: string
}

export interface DashboardMonthProfit {
  month: string
  sales_amount: string
  goods_cost: string
  freight_cost: string
  operating_cost: string
  profit: string
}

export interface DashboardMoney {
  ar_total: string
  ar_customer_count: number
  ar_overdue_total: string
  ar_overdue_buckets: DashboardOverdueBucket[]
  ap_overdue_total: string
  month_profit: DashboardMonthProfit
}

export interface DashboardOverview {
  generated_at: string
  today: DashboardToday
  todos: DashboardTodo[]
  money: DashboardMoney
}

export type DashboardDays = 7 | 30

export interface SalesTrendPoint {
  date: string
  order_count: number
  amount: string
}

export interface ProductRanking {
  spu_id: number
  spu_name: string
  amount: string
}

export interface CustomerRanking {
  customer_id: number
  customer_name: string
  amount: string
  order_count: number
}

export interface SalesRanking {
  sales_id: number
  sales_name: string
  amount: string
  order_count: number
  customer_count: number
}

// ---------- Generic ----------
export interface PageQuery {
  page?: number
  page_size?: number
  keyword?: string
  [k: string]: unknown
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

// ---------- Category (4-level tree) ----------
export interface Category {
  id: number
  name: string
  parent_id: number | null
  level: number
  sort_order: number
  icon?: string
  description?: string
  is_active: boolean
  created_at?: string
  children?: Category[]
}

export interface RegionNode {
  id: number
  name: string
  parent_id: number | null
  level: number
  sort_order: number
  /** 送货地点在该区域的 active 客户数（接口返回时才有） */
  customer_count?: number
  is_active?: boolean
  /** 省 / 市 / 县 / 乡镇 完整路径 */
  full_name?: string | null
  /** 是否存在下级节点 */
  has_children?: boolean
  children?: RegionNode[]
}

export interface RegionSelection {
  id: number
  level: number
  name: string
  full_name: string
  province: string
  city: string
  district: string
  town: string
}

// ---------- Customer Level Config ----------
export type PriceAdjustmentType = 'percent' | 'amount'

export interface LevelConfig {
  id: number
  level_id: string
  nickname: string
  applicable_tag_ids?: number[]
  applicable_tags?: ApplicableTagItem[]
  description?: string
  is_active: boolean
  customer_count?: number
  /** 该等级客户的默认授信额度 */
  default_credit_limit?: string
  created_at?: string
  updated_at?: string
}

/** GET /customer-levels/stats（Apifox CustomerLevelStatsResponse）：等级价格界面的等级行，附带客户数等聚合统计 */
export interface LevelStats {
  id: number
  level_id: string
  nickname: string
  applicable_tag_ids?: number[]
  applicable_tags?: ApplicableTagItem[]
  description?: string | null
  default_credit_limit?: string
  is_active?: boolean
  customer_count: number
  monthly_sales?: string | null
  monthly_orders: number
  created_at?: string | null
  updated_at?: string | null
}

export interface LevelCreatePayload {
  level_id: string
  nickname: string
  applicable_tag_ids?: number[]
  description?: string | null
  default_credit_limit?: number | string
  is_active?: boolean
}

export interface LevelUpdatePayload {
  level_id?: string
  nickname?: string
  applicable_tag_ids?: number[]
  description?: string | null
  default_credit_limit?: number | string
  is_active?: boolean
}

export interface LevelPricePreview {
  level_id: number
  nickname: string
  price_adjustment_type: PriceAdjustmentType
  price_adjustment: string
  suggested_price: string
  level_price: string
}

// ---------- SPU / SKU ----------
export type PriceMethod = 'percent' | 'amount'

export interface ProductSKU {
  id: number
  spu_id: number
  cost_price: number
  price_method: PriceMethod
  price_value: number
  barcode?: string | null
  specs?: Record<string, string>
  remark?: string | null
  /** 是否启用；停用的 SKU 不参与下单（默认 true） */
  is_enabled?: boolean
  /** 该规格是否上架小程序；与 SPU 开关同时为真才展示 */
  is_miniprogram?: boolean
  /** 1 个该规格等于多少个基础单位（最多 1 位小数）；后端返回字符串 */
  base_qty?: string | number
  /** 数量是否允许 1 位小数（散称的斤为 true，件/箱/袋为 false） */
  allow_decimal?: boolean
  /** 最低售价规则（仅管理员可见） */
  min_price_method?: PriceMethod | null
  min_price_value?: string | number | null
  /** 服务端算好的建议零售价、最低售价（管理员、销售都返回；定价未配置时为 null） */
  suggested_price?: string | null
  min_price?: string | null
  /** 折合每基础单位成本（仅管理员可见） */
  cost_per_base_unit?: string | null
  /** 扫码 / 列表接口带出的 SPU 名称与基础单位 */
  spu_name?: string
  spu_code?: string | null
  base_unit?: string | null
  created_at?: string
  updated_at?: string
}

export interface SkuAttribute {
  name: string
  values: string[]
}

export interface ProductSPU {
  id: number
  code: string
  name: string
  category_id: number | null
  brand?: string
  shelf_life_days?: number | null
  description?: string
  main_images?: string[]
  detail_images?: string[]
  sku_attributes?: SkuAttribute[]
  /** 1=启用, 0=停用 */
  status: number
  /** 默认货源: self=店家自己, temp_pick=临时拿货 */
  supply_mode?: 'self' | 'temp_pick'
  supplier_id?: number
  is_miniprogram?: boolean
  /** 基础计量单位，库存按它计数 */
  base_unit?: string
  /** 已启用的规格数、已启用且已上架的规格数 */
  sku_count?: number
  miniprogram_sku_count?: number
  created_at?: string
  updated_at?: string
}

/** 随 SPU 一次性保存的 SKU 载荷：已有 SKU 带 id（更新），不带 id（新增）；不在列表中的旧 SKU 由后端删除 */
export interface SkuUpsertPayload {
  id?: number
  specs: Record<string, string>
  cost_price: number
  price_method: PriceMethod
  price_value: number
  /** 停用的 SKU 不参与下单（默认启用） */
  is_enabled?: boolean
  /** 该规格是否上架小程序（默认 false）；与 SPU 开关同时为真才展示；不传 = 不改 */
  is_miniprogram?: boolean
  /** 1 个该规格等于多少个基础单位，> 0，最多 1 位小数 */
  base_qty: number
  allow_decimal: boolean
  min_price_method: PriceMethod
  min_price_value: number
  /** 条码、换算备注：保存时整体提交，不带会被清空 */
  barcode?: string | null
  remark?: string | null
}

/** POST /spus 与 PUT /spus/{id} 的保存载荷（SPU + 内联 SKU 单请求保存） */
export type SpuSavePayload = Omit<
  ProductSPU,
  'id' | 'created_at' | 'updated_at' | 'base_unit' | 'sku_count' | 'miniprogram_sku_count'
> & {
  /** 基础计量单位，必填 */
  base_unit: string
  skus?: SkuUpsertPayload[]
}

/** 只提示不阻止的提示项（接口规范 §9） */
export interface ApiWarning {
  code: string
  message: string
  data?: Record<string, unknown> | null
}

/** 低于新最低售价的专属价 */
export interface AffectedCustomerPrice {
  customer_id: number
  customer_name: string
  sales_id?: number | null
  sales_name?: string | null
  sku_id?: number
  sku_spec?: string
  price: string
  min_price: string
}

/** POST /spus、PUT /spus/{id} 的响应（业务写操作结构） */
export interface SpuSaveResult {
  spu: ProductSPU
  affected_customer_prices: AffectedCustomerPrice[]
  warnings: ApiWarning[]
}

/** POST /skus/{id}/price-impact：改成本或规则前预览 */
export interface PriceImpact {
  suggested_before: string
  suggested_after: string
  min_before: string
  min_after: string
  levels: { level_id: number; level_name: string; price_before: string; price_after: string; clamped: boolean }[]
  affected_customer_prices: AffectedCustomerPrice[]
  cost_per_base_unit: string | null
}

// ---------- Vendor (供应商) ----------
export type VendorType = 'market' | 'origin' | 'manufacturer'
export type VendorStatus = 'active' | 'order_disabled' | 'login_disabled'

export interface Vendor {
  id: number
  name: string
  type: VendorType
  phone: string | null
  contact_name: string | null
  contact_phone: string | null
  status: VendorStatus
  province: string | null
  city: string | null
  district: string | null
  town: string | null
  detail_address: string | null
  wechat_bound: boolean
  created_at: string | null
  updated_at: string | null
}

export interface PurchaseReceiptItem {
  id: number
  order_item_id: number | null
  spu_id: number
  spu_name: string
  base_unit: string
  sku_id: number | null
  sku_name: string | null
  quantity: string
  unit_cost: string
  amount: string
  update_cost: boolean
}

export interface PurchaseReceipt {
  id: number
  source_type: 'order' | 'stock' | 'return'
  vendor_id: number
  vendor_name: string
  order_id: number | null
  order_no: string | null
  status: 'draft' | 'confirmed' | 'cancelled'
  purchased_at: string | null
  confirmed_at: string | null
  photos?: string[] | null
  total_amount: string
  paid_amount: string
  version: number
  created_at: string
  remark: string | null
  corrections: { before: Record<string, unknown> | null; after: Record<string, unknown> | null; reason: string | null; operator_name: string; created_at: string }[]
  items: PurchaseReceiptItem[]
}

export interface PurchaseResult {
  purchase_receipt: PurchaseReceipt
  order: CounterOrder | null
  vendor_balance: string | null
  vendor_balances?: Record<number, string> | null
  warnings: ApiWarning[]
}

export interface VendorAccount {
  vendor_id: number
  vendor_name: string
  payable_balance: string
  total_purchases: string
  total_payments: string
  linked_customer_id?: number | null
  linked_customer_name?: string | null
  customer_ar_balance?: string | null
}

export interface VendorLedgerEntry {
  id: number
  type: 'purchase' | 'payment' | 'purchase_return' | 'offset' | 'correction_reversal' | 'correction_new'
  amount: string
  balance_after: string
  purchase_receipt_id: number | null
  order_id: number | null
  offset_id?: number | null
  occurred_at: string
  operator_name: string | null
  remark: string | null
}

export interface LedgerOffset {
  id: number
  customer_id: number
  customer_name?: string | null
  vendor_id: number
  vendor_name?: string | null
  amount: string
  reversed_offset_id?: number | null
  is_reversed: boolean
  remark?: string | null
  operator_name?: string | null
  occurred_at: string
}

export interface StockRow {
  spu_id: number
  spu_name: string
  spu_code: string
  supply_mode: 'self' | 'temp_pick'
  base_unit: string
  on_hand: string
  pending_quantity: string
  available_quantity: string
  is_negative: boolean
  sku_count: number
  updated_at?: string | null
}

export interface StockMovementRow {
  id: number
  occurred_at: string
  spu_id: number
  spu_name: string
  base_unit: string
  sku_id: number | null
  sku_name: string | null
  type: string
  change: string
  ref_type: string | null
  ref_id: number | null
  operator_name: string | null
  remark: string | null
}

/** POST /vendors、PUT /vendors/{id} 载荷（PUT 只传改过的字段，清空可空字段传 null） */
export type VendorPayload = Partial<Omit<Vendor, 'id' | 'wechat_bound' | 'created_at' | 'updated_at'>>

export interface UploadImageResponse {
  url: string
}

// ---------- Price Center (level-prices / customer-sku-prices / 价格查询) ----------
export interface LevelPrice {
  id: number
  level_id: number
  level_code: string
  level_nickname: string
  sku_id: number | null
  spu_id: number | null
  spu_name: string | null
  sku_specs: Record<string, string> | null
  sku_remark: string | null
  price_method: PriceMethod
  price_value: string
  created_at?: string | null
  updated_at?: string | null
}

export interface LevelPriceUpsert {
  /** 为空表示等级默认规则 */
  sku_id?: number | null
  price_method: PriceMethod
  price_value: number | string
}

export interface LevelPriceRulePreview {
  level_id: number
  level_code: string
  level_nickname: string
  sku_id: number | null
  /** 命中的规则: sku=SKU专属, level=等级默认, none=无规则 */
  rule_source: 'sku' | 'level' | 'none'
  price_method: string | null
  price_value: string | null
  suggested_price: string
  level_price: string
}

export interface CustomerSkuPrice {
  id: number
  customer_id: number
  customer_name: string
  sku_id: number
  spu_id: number
  spu_name: string
  sku_specs: Record<string, string>
  sku_remark: string | null
  price: string
  created_by?: number | null
  created_by_name?: string | null
  updated_by?: number | null
  updated_by_name?: string | null
  created_at: string
  updated_at: string
}

export interface CustomerSkuPriceUpsert {
  price: number | string
}

export type PriceSource = 'customer_fixed' | 'level_sku' | 'level_default' | 'suggested'

export interface CustomerSkuPricePreview {
  customer_id: number
  sku_id: number
  suggested_price: string
  level_price: string
  final_price: string
  price_source: PriceSource
  customer_sku_price_id: number | null
}

/** GET /prices/customer-prices：某客户某 SKU 的成交价、来源与来源设定时间（价格查询页，pricing.md §7） */
export interface CustomerPriceRow {
  sku_id: number
  spu_id: number
  spu_name: string
  spu_code: string
  /** 规格属性值拼接，如"斤 本地"；接口返回，前端不再拼接 */
  sku_spec: string
  /** specs 里的"规格"值，没有时为空串 */
  unit: string
  base_qty: string | number
  /** SPU 的基础单位，如斤 */
  base_unit?: string | null
  allow_decimal: boolean
  is_enabled: boolean
  unit_price: string
  /** 内部细分四值：客户专属价 / 等级 SKU 规则 / 等级默认规则 / 建议零售价 */
  price_source: PriceSource
  /** 命中的那条规则的最后设定时间；无规则时为 SKU 记录的更新时间 */
  price_source_set_at?: string | null
  suggested_price: string
  level_price: string
  min_price: string
  /** 仅管理员返回 */
  cost_price?: string | null
  below_min: boolean
}

// ---------- Audit Log ----------
export interface AuditLog {
  id: number
  user_id: number
  user_name: string
  user_role: string
  action: string
  target_type: string
  target_id: string
  target_name?: string
  before_value?: string
  after_value?: string
  ip_address?: string
  remark?: string
  request_id?: string | null
  created_at: string
}

// ---------- Role & Permission ----------
export interface RoleConfig {
  id: number
  code: string
  name: string
  description?: string
  is_system: boolean
  sort_order: number
  is_active: boolean
  platform: string
  feature_ids: number[]
  permission_codes?: string[]
  created_at?: string
  updated_at?: string
}

export interface FeatureNode {
  id: number
  parent_id: number | null
  code: string
  name: string
  type: string
  sort_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
  children?: FeatureNode[]
}

// ---------- System Account ----------
export interface SystemAccount {
  id: number
  username: string
  real_name?: string | null
  phone?: string | null
  invite_code?: string | null
  customer_count: number
  commission_rate?: string | null
  role_id: number
  role_code: string
  role_name: string
  platform: string
  is_active: boolean
  last_login_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface AccountCreatePayload {
  username: string
  password: string
  real_name?: string | null
  phone?: string | null
  commission_rate?: string | null
  role_id: number
  is_active: boolean
}

export interface AccountUpdatePayload {
  real_name?: string | null
  phone?: string | null
  commission_rate?: string | null
  role_id?: number | null
  is_active?: boolean | null
}

export interface AccountPasswordUpdate {
  new_password: string
  old_password?: string | null
}

// ---------- 门店零售（orders.md / 门店零售页面，2026-11-06） ----------
export interface PriceQuoteItem {
  sku_id: number
  spu_name: string
  sku_spec: string
  unit: string
  base_qty: string
  allow_decimal: boolean
  unit_price: string
  price_source: 'contract' | 'level' | 'suggested' | null
  min_price: string | null
  below_min: boolean | null
  quantity: string | null
  amount: string | null
  is_enabled: boolean
  stock_on_hand: string | null
  stock_available: string | null
  cost_price?: string | null
  line_goods_cost?: string | null
  line_profit?: string | null
}

export interface RecordTripOption {
  trip_id: number
  trip_date: string
  name: string | null
  owner_name?: string | null
  days_from_today?: number
  within_pool_days: boolean
  has_customer_order?: boolean
  is_default: boolean
}

export interface RecordExistingOrder {
  order_id: number
  order_no: string
  total_amount: string
  trip_id: number | null
  freight_shipment_id: number | null
  freight_line_id?: number | null
  ship_date?: string | null
  status: string
}

export interface RecordUpcomingTrips {
  delivery_region_id?: number | null
  delivery_region_name?: string | null
  pool_max_days: number
  trips: RecordTripOption[]
  existing_orders: RecordExistingOrder[]
  freight: (FreightLineOption & { default_freight_mode: 'deduct' | 'store_paid' | 'customer_paid' }) | null
  freight_lines: FreightLineOption[]
  suggestion: string
}

export interface FreightLineSchedule {
  depart_time: string
  label?: string | null
}

export interface FreightLineOption {
  line_id: number
  line_name: string
  depart_time: string
  schedule_label?: string | null
  schedules?: FreightLineSchedule[]
  ship_date: string
  cutoff_passed: boolean
  is_default: boolean
}

export interface FreightLineStop {
  id: number
  town_region_id: number
  town_name: string
  level: number
  seq: number
  customer_count: number
}

export interface FreightLine {
  id: number
  name: string
  plate_no: string | null
  driver_name: string | null
  driver_phone: string | null
  receive_address: string | null
  schedules: FreightLineSchedule[]
  cutoff_minutes: number
  is_active: boolean
  stops: FreightLineStop[]
  customer_count: number
}

/** 录单 / 客户编辑选线路用的最小结构 */
export type RecordFreightLine = FreightLine

export interface FreightLineStopInput {
  town_region_id: number
}

export interface FreightLinePayload {
  name: string
  plate_no?: string | null
  driver_name?: string | null
  driver_phone?: string | null
  receive_address?: string | null
  schedules: FreightLineSchedule[]
  cutoff_minutes?: number | null
  is_active?: boolean
  stops: FreightLineStopInput[]
}

export interface FreightLineResult {
  line: FreightLine
  warnings: ApiWarning[]
}

export interface FrequentSku {
  sku_id: number
  spu_name: string
  sku_spec: string
  unit: string
  order_count: number
  last_ordered_at: string
  last_quantity: string
}

export interface RecordOrderPayload {
  customer_id: number
  source: 'phone_in' | 'route_call'
  delivery_mode: 'route' | 'freight' | 'local'
  items: { sku_id: number; quantity: string; unit_price?: string; save_as_customer_price?: boolean; supplier_id?: number }[]
  route_trip_id?: number | null
  merge_into_order_id?: number | null
  freight_line_id?: number | null
  ship_date?: string | null
  freight_mode?: 'deduct' | 'store_paid' | 'customer_paid'
  freight_cost?: string
  remark?: string
  customer_coupon_id?: number | null
  mark_delivered?: boolean
  delivered_at?: string
  payment?: { method: 'wechat' | 'alipay' | 'cash' | 'other'; amount: string; rounding_amount?: string }
}

// ---------- 线路配送：出车（delivery.md §5） ----------
export type RouteTripStatus = 'planned' | 'delivering' | 'finished' | 'cancelled'
export type RouteStopOrigin = 'county' | 'corridor' | 'manual'

export interface RouteTripStop {
  region_id: number
  region_name: string
  parent_region_name: string | null
  seq: number
  origin: RouteStopOrigin
  customer_count: number
}

export interface RouteTripStopInput {
  region_id: number
  origin?: RouteStopOrigin
}

export interface RouteTrip {
  id: number
  trip_date: string
  name: string | null
  owner_id: number
  owner_name: string
  template_id: number | null
  auto_generated: boolean
  status: RouteTripStatus
  departed_at: string | null
  finished_at: string | null
  stops: RouteTripStop[]
  stops_text: string
  customer_count: number
  called_count: number
  order_count: number
  order_amount: string
  created_at: string
}

export interface RouteTripOrder {
  order_id: number
  order_no: string
  customer_id: number
  customer_name: string
  customer_phone: string | null
  region_id: number
  region_name: string
  stop_seq: number
  sort_no: number
  total_amount: string
  delivered_amount: string | null
  status: 'pending' | 'delivering' | 'delivered' | 'cancelled'
  auto_joined: boolean
  auto_moved: boolean
  dispatch_note: string | null
  sales_id: number | null
  sales_name: string | null
  pending_price_adjustment?: PendingPriceAdjustment | null
}

export interface RouteTemplateStop {
  region_id: number
  region_name: string
  parent_region_name: string | null
  seq: number
  origin: RouteStopOrigin
}

export type RouteScheduleType = 'none' | 'weekly' | 'monthly'

export interface RouteTemplate {
  id: number
  name: string
  remark: string | null
  is_active: boolean
  stops: RouteTemplateStop[]
  stops_text: string
  schedule_type: RouteScheduleType
  schedule_weekdays: number[]
  schedule_month_days: number[]
  default_owner_id: number | null
  default_owner_name: string | null
  next_trip_date: string | null
}

export interface RouteTemplateSavePayload {
  name: string
  remark: string | null
  is_active: boolean
  stops: { region_id: number; origin: RouteStopOrigin }[]
  schedule_type: RouteScheduleType
  schedule_weekdays: number[]
  schedule_month_days: number[]
  default_owner_id: number | null
}

export interface CountyCorridorSavePayload {
  town_region_ids: number[]
}

export interface CountyCorridorTown {
  region_id: number
  region_name: string
  parent_region_name: string | null
  seq: number
  customer_count: number
}

export interface CountyCorridor {
  county_region_id: number
  county_name: string
  customer_count: number
  towns: CountyCorridorTown[]
}

export interface CountyCorridorSummary {
  county_region_id: number
  county_name: string
  town_count: number
  customer_count: number
}

export interface RouteTripDraftOrder {
  order_id: number
  order_no: string
  customer_id: number
  customer_name: string
  region_name: string
  total_amount: string
  pool_deadline: string
  excluded?: boolean
}

export interface RouteTripMoveOrder {
  order_id: number
  order_no: string
  customer_id: number
  customer_name: string
  from_trip_id: number
  from_trip_date: string
  to_trip_id: number
  to_trip_date: string
  total_amount: string
}

export interface RouteTripDraftRequest {
  trip_date: string
  county_region_ids?: number[]
  template_id?: number
  stops?: RouteTripStopInput[]
  trip_id?: number
  exclude_order_ids?: number[]
}

export interface RouteTripDraft {
  stops: RouteTripStop[]
  customer_count: number
  join_orders: RouteTripDraftOrder[]
  join_order_count: number
  move_orders: RouteTripMoveOrder[]
  move_order_count: number
  return_orders: RouteTripDraftOrder[]
  warnings: ApiWarning[]
}

export interface RouteTripSavePayload {
  trip_date: string
  name?: string | null
  owner_id: number
  template_id?: number | null
  stops: RouteTripStopInput[]
  exclude_order_ids?: number[]
}

export interface RouteTripSaveResult {
  route_trip: RouteTrip
  joined_orders?: RouteTripOrder[]
  returned_orders?: RouteTripOrder[]
  moved_orders?: RouteTripOrder[]
  warnings: ApiWarning[]
}

export interface RouteTripCancelResult {
  route_trip: RouteTrip
  returned_orders: RouteTripOrder[]
  warnings: ApiWarning[]
}

export type CallResult = 'none' | 'ordered' | 'declined' | 'unreachable'

export interface OtherTripOrder {
  order_id: number
  trip_id: number
  trip_date: string
}

export interface CallListCustomer {
  customer_id: number
  customer_name: string
  customer_phone: string | null
  region_id: number
  region_name: string
  stop_seq: number
  sales_id: number | null
  sales_name: string | null
  last_order_date: string | null
  ar_balance: string
  call_result: CallResult
  trip_order_ids: number[]
  other_trip_order: OtherTripOrder | null
}

export interface RouteTripActionResult {
  route_trip: RouteTrip
  warnings: ApiWarning[]
}

// ---------- 线路配送：物流批次与交车（delivery.md §9） ----------
export type FreightShipmentStatus = 'open' | 'handed_over'

export interface FreightShipment {
  id: number
  line_id: number
  line_name: string
  plate_no: string | null
  driver_name: string | null
  driver_phone: string | null
  ship_date: string
  depart_time: string
  schedule_label?: string | null
  cutoff_at: string
  status: FreightShipmentStatus
  customer_count: number
  order_count: number
  order_amount: string
  handed_over_count: number
  freight_fee: string
  handed_over_at: string | null
}

export interface FreightShipmentOrder {
  order_id: number
  order_no: string
  customer_id: number
  customer_name: string
  customer_phone: string | null
  town_region_id: number
  town_name: string
  stop_seq: number | null
  stop_removed: boolean
  customer_address: string | null
  total_amount: string
  freight_mode: 'deduct' | 'store_paid' | 'customer_paid'
  freight_cost: string | null
  status: 'pending' | 'delivered' | 'cancelled'
  handed_over_at: string | null
  handed_over_by: number | null
  handed_over_by_name: string | null
  sales_id: number | null
  sales_name: string | null
}

export interface FreightShipmentDetail extends FreightShipment {
  orders: FreightShipmentOrder[]
}

export interface FreightHandoverPayload {
  orders?: { order_id: number; freight_cost?: string | null }[]
  total_freight?: string
}

export interface FreightHandoverResult {
  orders: FreightShipmentOrder[]
  shipment: FreightShipment
  warnings: ApiWarning[]
}

export interface PriceQuoteResponse {
  customer_id: number
  customer_name: string
  level_id: number | null
  level_name: string | null
  items: PriceQuoteItem[]
}

export interface CounterOrderItemPayload {
  sku_id: number
  quantity: number | string
  /** 仅手动改价时传；不传 = 服务端报价 */
  unit_price?: string
}

export type CounterPaymentMethod = 'wechat' | 'cash' | 'alipay' | 'other'

export interface CounterPaymentPayload {
  method: CounterPaymentMethod
  amount: string | number
  rounding_amount?: string | number
  received_amount?: string | number
}

export interface CounterOrderPayload {
  customer_id?: number | null
  sales_id?: number | null
  source: 'counter'
  delivery_mode?: 'pickup'
  items: CounterOrderItemPayload[]
  payment?: CounterPaymentPayload | null
  remark?: string | null
}

export interface CounterOrderItem {
  id: number
  sku_id: number
  spu_name: string
  sku_spec: string
  unit: string
  base_qty: string
  unit_price: string
  price_source: string
  min_price: string
  quantity: string
  delivered_quantity: string | null
  returned_quantity: string
  restocked_quantity: string
  amount: string
  cost_price?: string | null
  supplier_id?: number | null
  supplier_name?: string | null
  cost_status?: 'estimated' | 'actual' | null
  purchase_receipt_id?: number | null
}

export interface CounterOrderPayment {
  payment_id: number
  method: CounterPaymentMethod
  amount: string
  received_amount: string | null
  change_amount: string | null
  rounding_amount: string
  paid_at: string
  operator_name: string | null
}

export interface CounterOrder {
  id: number
  order_no: string
  customer_id: number
  customer_name: string
  is_walk_in: boolean
  customer_phone: string | null
  sales_id: number | null
  sales_name: string | null
  source: string
  delivery_mode: string
  status: string
  pay_status: string
  return_status: string
  total_amount: string
  delivered_amount: string | null
  paid_amount: string
  discount_amount: string
  returned_amount: string
  unpaid_amount: string
  freight_mode: string
  freight_cost: string | null
  due_date: string | null
  over_credit: boolean
  approval_stage: string | null
  reject_reason: string | null
  created_by_type: string
  created_by_id: number | null
  created_by_name: string | null
  created_by_role: string | null
  created_at: string
  delivered_at: string | null
  remark: string | null
  print_count: number
  last_printed_at: string | null
  version: number
  items: CounterOrderItem[]
  payments: CounterOrderPayment[]
  goods_cost?: string | null
  profit?: string | null
}

export interface CounterOrderResult {
  order: CounterOrder
  warnings: ApiWarning[]
}

export interface OrderResult {
  order: OrderListItem
  warnings: ApiWarning[]
}

export interface OrderApprovalRecord {
  id: number
  order_id: number
  stage: string
  action: string
  operator_id: number | null
  operator_name: string | null
  order_amount: string
  occupied_credit: string | null
  effective_credit: string | null
  comment: string | null
  created_at: string
}

export interface OrderApprovalPreviousStep {
  operator_name: string | null
  created_at: string
  comment: string | null
}

export interface OrderApprovalItem {
  order: OrderListItem
  stage: string
  amount_before: string | null
  ar_balance: string
  effective_credit: string | null
  occupied_credit: string | null
  overdue_amount: string
  submitted_at: string
  waiting_hours: number
  previous_step: OrderApprovalPreviousStep | null
}

export interface OrderApprovalQuery {
  stage?: 'sales' | 'admin'
  customer_id?: number
  sales_id?: number
  date_from?: string
  date_to?: string
  order_by?: 'submitted_at' | 'total_amount'
  page?: number
  page_size?: number
}

export interface PrintRecordResult {
  order_id: number
  print_count: number
  last_printed_at: string
  is_reprint: boolean
}


export interface CustomerAccount {
  customer_id: number
  ar_balance: string
  overdue_amount: string
  max_overdue_days: number
  effective_credit: string
}

export type ReturnStatus = 'pending' | 'confirmed' | 'rejected'
export type ReturnSettlementStatus = 'none' | 'unsettled' | 'partial' | 'settled'
export type ReturnRefundMethod = 'credit' | 'wechat' | 'alipay' | 'cash'
export type ReturnFreightMode = 'none' | 'deduct' | 'store_paid' | 'customer_paid'
export type ReturnDisposition = 'restock' | 'write_off'

export interface ReturnTerms {
  return_freight_mode: ReturnFreightMode
  freight_cost: string | null
  refund_method: ReturnRefundMethod
}

export interface ReturnLineInput {
  order_item_id: number
  quantity: string
  disposition: ReturnDisposition
}

export interface ReturnCreateInput extends ReturnTerms {
  order_id: number
  reason?: string
  items: ReturnLineInput[]
}

export interface ReturnConfirmInput extends ReturnTerms {
  items: Pick<ReturnLineInput, 'order_item_id' | 'disposition'>[]
}

export interface ReturnLine extends ReturnLineInput {
  spu_name: string
  sku_spec: string
  unit: string
  unit_price: string
  amount: string
}

export interface ReturnAmounts {
  goods_amount: string
  freight_compensation_amount: string
  total_credit_amount: string
  original_offset_amount: string
}

export interface ReturnPreview extends ReturnAmounts {
  refundable_amount: string
}

export interface ReturnOrder extends ReturnTerms, ReturnAmounts {
  id: number
  return_no: string
  order_id: number
  order_no: string
  customer_id: number
  customer_name: string
  status: ReturnStatus
  reason: string
  items: ReturnLine[]
  refund_amount: string
  credit_amount: string
  settled_amount: string
  available_credit_amount: string
  settlement_status: ReturnSettlementStatus
  settlements: { settlement_id: number; order_no: string; amount: string; created_at: string }[]
  created_at: string
  created_by_name: string | null
  reject_reason: string | null
  confirmed_at: string | null
  confirmed_by_name: string | null
}

export interface ReturnResult {
  return_order: ReturnOrder
  warnings: ApiWarning[]
}

// ---------- 客户账期（finance.md §3） ----------
export interface AccountRow {
  customer_id: number
  name: string
  sales_id: number | null
  sales_name: string | null
  term_type: 'days' | 'monthly'
  /** 后端算好的账期标签，前端直接用，不要自己拼 */
  term_label: string
  balance: string
  overdue_amount: string
  max_overdue_days: number
  pending_amount: string
  return_credit_amount: string
  effective_credit: string
  credit_source: 'level' | 'custom'
  last_payment_at: string | null
}

export interface AgingBuckets {
  fresh: string
  o1: string
  o2: string
  o3: string
}

export interface AccountSummary {
  ar_total: string
  overdue_total: string
  overdue_customer_count: number
  month_received: string
  month_payment_count: number
  return_credit_total: string
  customer_count: number
  buckets: AgingBuckets
}

export interface Bill {
  order_id: number
  order_no: string
  delivered_at: string | null
  due_date: string | null
  delivered_amount: string
  paid_amount: string
  discount_amount: string
  return_settled_amount: string
  pending_amount: string
  overdue_days: number
}

export interface BillSummary extends AccountRow {
  last_payment_method: string | null
}

export interface BillsResponse {
  summary: BillSummary
  bills: Bill[]
  settle_min_ratio?: string
}

export interface LedgerEntry {
  id: number
  type: 'delivery' | 'freight_offset' | 'payment' | 'return' | 'discount' | 'offset'
  amount: string
  balance_after: string
  ref_type: string | null
  ref_id: number | null
  order_id: number | null
  occurred_at: string
  operator_name: string | null
  remark: string | null
}

export interface PaymentAllocationInput {
  order_id: number
  amount: string
}

export interface PaymentPayload {
  customer_id: number
  amount: string
  rounding_amount?: string
  method: 'wechat' | 'alipay' | 'cash' | 'other'
  paid_at?: string
  /** 传了 = 按单平；不传 = 从最早未结清订单往后自动平 */
  allocations?: PaymentAllocationInput[]
  remark?: string
}

export interface PaymentAllocationResult {
  order_id: number
  order_no: string
  amount: string
  closed: boolean
}

export interface PaymentResult {
  payment_id: number
  amount: string
  rounding_amount: string
  allocated_total: string
  balance_before: string
  balance_after: string
  allocations: PaymentAllocationResult[]
  warnings: ApiWarning[]
}


// ---------- 优惠券（coupons.md） ----------
export type CouponType = 'festival' | 'freight_subsidy' | 'diff_subsidy' | 'referral_reward'
export type CouponValidityType = 'fixed_days' | 'fixed_range'
export type CouponTemplateStatus = 'active' | 'disabled'
export type CustomerCouponStatus = 'unused' | 'used' | 'expired' | 'voided'

export interface CouponTemplate {
  id: number
  name: string
  coupon_type: CouponType
  amount: string
  min_order_amount: string
  validity_type: CouponValidityType
  valid_days?: number | null
  valid_from?: string | null
  valid_to?: string | null
  status: CouponTemplateStatus
  remark?: string | null
  issued_count: number
  used_count: number
  created_by_name?: string | null
  created_at: string
}

export interface CouponTemplatePayload {
  name: string
  coupon_type: CouponType
  amount: string
  min_order_amount: string
  validity_type: CouponValidityType
  valid_days?: number | null
  valid_from?: string | null
  valid_to?: string | null
  remark?: string | null
}

export interface CouponIssuePayload {
  template_id?: number | null
  name?: string | null
  coupon_type?: CouponType | null
  amount?: string | null
  min_order_amount?: string
  validity_type?: CouponValidityType | null
  valid_days?: number | null
  valid_from?: string | null
  valid_to?: string | null
  target_type: 'customers' | 'tags' | 'levels'
  customer_ids?: number[]
  tag_ids?: number[]
  level_ids?: number[]
  quantity_per_customer?: number
  issue_remark?: string | null
}

export interface CustomerCouponRecord {
  id: number
  coupon_code: string
  template_id?: number | null
  customer_id: number
  customer_name?: string | null
  customer_phone?: string | null
  name: string
  coupon_type: CouponType
  amount: string
  min_order_amount: string
  valid_from: string
  valid_to: string
  status: CustomerCouponStatus
  order_id?: number | null
  order_no?: string | null
  used_at?: string | null
  discount_applied?: string | null
  issued_by_name?: string | null
  issued_at: string
  issue_remark?: string | null
  void_reason?: string | null
}

export interface CustomerCouponRecordListResult {
  items: CustomerCouponRecord[]
  total: number
  page: number
  page_size: number
  summary: {
    total_issued: number
    total_used: number
    total_unused: number
    total_discount_applied: string
  }
}

export interface AvailableCoupon {
  id: number
  coupon_code: string
  name: string
  coupon_type: CouponType
  amount: string
  min_order_amount: string
  valid_from: string
  valid_to: string
  usable: boolean
  unusable_reason?: string | null
  deduct_amount: string
}

export interface AvailableCouponListResult {
  items: AvailableCoupon[]
  recommended_coupon_id: number | null
}

export interface ReferralConfig {
  enabled: boolean
  reward_amount: string
  coupon_min_amount: string
  coupon_valid_days: number
  min_order_amount: string
}

export interface ReferralConfigUpdatePayload {
  enabled?: boolean
  reward_amount?: number
  coupon_min_amount?: number
  coupon_valid_days?: number
  min_order_amount?: number
}

export interface ReferralRewardRecord {
  id: number
  referrer_customer_id: number
  referrer_customer_name?: string | null
  referrer_customer_phone?: string | null
  invitee_customer_id: number
  invitee_customer_name?: string | null
  invitee_customer_phone?: string | null
  order_id?: number | null
  order_no?: string | null
  customer_coupon_id?: number | null
  coupon_code?: string | null
  coupon_status?: string | null
  reward_amount: string
  status: 'issued' | 'skipped'
  skip_reason?: string | null
  triggered_at: string
  created_at: string
}

export interface ReferralRewardListResult {
  items: ReferralRewardRecord[]
  total: number
  page: number
  page_size: number
  summary: {
    total: number
    issued_count: number
    skipped_count: number
    issued_amount: string
  }
}

export type PurchasePlanScopeMode = 'all_pending' | 'route_trip' | 'freight_shipment' | 'date'

export interface PurchasePlanSupplierOverride {
  spu_id: number
  sku_id?: number | null
  supplier_id: number
}

export interface PurchasePlanPreviewPayload {
  route_trip_id?: number | null
  freight_shipment_id?: number | null
  date?: string | null
  supplier_id?: number | null
  include_self_shortage?: boolean
  supplier_overrides?: PurchasePlanSupplierOverride[]
}

export interface PurchasePlanOrderRef {
  order_id: number
  order_no: string
  customer_name: string
  order_item_id: number
  quantity: string
  unit: string
  unit_cost: string
  purchase_receipt_id: number | null
  receipt_status: string | null
  receipt_version: number | null
  vendor_id: number
  vendor_name: string
}

export interface PurchasePlanItem {
  item_key: string
  spu_id: number
  spu_name: string
  sku_id: number | null
  sku_name: string
  supply_mode: 'temp_pick' | 'self' | string
  unit: string
  base_unit: string
  base_qty: string
  required_quantity: string
  on_hand: string | null
  shortage_quantity: string
  suggested_unit_cost: string
  estimated_amount: string
  display: string
  can_create_receipt: boolean
  has_auto_receipt: boolean
  order_nos: string[]
  orders: PurchasePlanOrderRef[]
}

export interface PurchasePlanGroup {
  supplier_id: number
  supplier_name: string
  supplier_phone: string | null
  supplier_address: string | null
  item_count: number
  estimated_amount: string
  can_create_receipt: boolean
  items: PurchasePlanItem[]
}

export interface PurchasePlanPreviewResult {
  scope: {
    mode: PurchasePlanScopeMode
    label: string
    route_trip_id?: number | null
    freight_shipment_id?: number | null
    date?: string | null
  }
  include_self_shortage: boolean
  summary: {
    supplier_count: number
    item_count: number
    order_count: number
    estimated_amount: string
  }
  groups: PurchasePlanGroup[]
}

export interface PurchasePlanToReceiptsPayload {
  groups: {
    supplier_id: number
    items: {
      spu_id: number
      sku_id?: number | null
      quantity: string
      unit_cost?: string
    }[]
  }[]
  purchased_at?: string
  remark?: string
}

export interface PurchasePlanToReceiptsResult {
  receipts: PurchaseReceipt[]
  warnings: ApiWarning[]
}
