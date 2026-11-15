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

export type CustomerChannelType = 'sales' | 'self_use'

export interface AdminCustomer {
  id: number
  name: string
  channel_type: CustomerChannelType
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
  default_delivery_mode?: 'route' | 'freight' | 'local'
  delivery_region_id?: number | null
  freight_line_id?: number | null
  freight_stop_id?: number | null
  default_freight_mode?: 'deduct' | 'store_paid' | 'customer_paid'
  invite_code?: string | null
  address?: string | null
  province?: string | null
  city?: string | null
  district?: string | null
  town?: string | null
  detail_address?: string | null
  created_at?: string
  updated_at?: string
}

/** POST /customers：内部账号新建客户，不带 unionid / openid（customers.md） */
export interface CustomerCreatePayload {
  name: string
  phone: string
  contact_name?: string | null
  contact_phone?: string | null
  /** 仅管理员有效；不传归当前账号 */
  sales_id?: number | null
  /** 仅管理员有效；传了直接分配等级并置为正常 */
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
  freight_stop_id?: number | null
  default_freight_mode?: 'deduct' | 'store_paid' | 'customer_paid'
}

export interface CustomerUpdatePayload {
  name?: string
  channel_type?: CustomerChannelType
  contact_name?: string | null
  contact_phone?: string | null
  phone?: string
  status?: AdminCustomerStatus
  invite_code?: string | null
  address?: string | null
  province?: string | null
  city?: string | null
  district?: string | null
  town?: string | null
  detail_address?: string | null
  default_delivery_mode?: 'route' | 'freight' | 'local'
  delivery_region_id?: number | null
  freight_line_id?: number | null
  freight_stop_id?: number | null
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
  sales_id?: number | null
  reason?: string
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
  returned_amount: number
  unpaid_amount: number
  route_trip_id?: number | null
  freight_shipment_id?: number | null
  freight_mode?: 'deduct' | 'store_paid' | 'customer_paid' | 'none'
  freight_cost?: number | null
  handed_over_at?: string | null
  over_credit: boolean
  approval_stage?: string | null
  created_at: string
  delivered_at?: string | null
  remark?: string | null
  version: number
  items: { id: number; sku_id: number; spu_name: string; sku_spec: string; unit: string; quantity: number; unit_price: number; amount: number; cost_price?: number | null; supplier_id?: number | null; supplier_name?: string | null; cost_status?: 'estimated' | 'actual' | null; purchase_receipt_id?: number | null }[]
  profit?: number | null
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
export interface Payment {
  id: number
  order_id: string
  customer_id: number
  customer_name: string
  amount: number
  method: PaymentMethod
  status: 'pending' | 'success' | 'failed'
  created_at: string
  remark?: string
}

export interface CreditInfo {
  customer_id: number
  credit_limit: number
  used_credit: number
  available_credit: number
}

export interface StatementItem {
  order_id: string
  occurred_at: string
  amount: number
  type: 'order' | 'payment' | 'adjust'
  remark?: string
}

export interface Statement {
  customer_id: number
  customer_name: string
  period_start: string
  period_end: string
  opening_balance: number
  closing_balance: number
  items: StatementItem[]
}

export interface Commission {
  id: number
  sales_id: number
  sales_name: string
  order_id: string
  customer_id: number
  customer_name: string
  order_amount: number
  commission_rate: number
  commission_amount: number
  status: 'pending' | 'settled'
  settled_at?: string
  created_at: string
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
  children?: RegionNode[]
}

// ---------- Customer Level Config ----------
export type CustomerLevelType = 'retail' | 'wholesale'
export type PriceAdjustmentType = 'percent' | 'amount'

export interface LevelConfig {
  id: number
  level_id: string
  nickname: string
  type: CustomerLevelType
  is_system: boolean
  created_by?: number | null
  description?: string
  is_active: boolean
  customer_count?: number
  /** 该等级客户的默认授信额度（销售私有等级只能 1000 / 3000 / 5000） */
  default_credit_limit?: string
  created_at?: string
  updated_at?: string
}

/** GET /customer-levels/stats（Apifox CustomerLevelStatsResponse）：等级价格界面的等级行，附带创建人与客户数等聚合统计 */
export interface LevelStats {
  id: number
  level_id: string
  nickname: string
  type: CustomerLevelType
  description?: string | null
  is_active?: boolean
  is_system?: boolean
  created_by?: number | null
  created_by_name?: string | null
  customer_count: number
  monthly_sales?: string | null
  monthly_orders: number
  created_at?: string | null
  updated_at?: string | null
}

export interface LevelCreatePayload {
  level_id: string
  nickname: string
  type: CustomerLevelType
  description?: string | null
  default_credit_limit?: number | string
  is_active?: boolean
}

export interface LevelUpdatePayload {
  level_id?: string
  nickname?: string
  type?: CustomerLevelType
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

export interface PurchaseReceipt {
  id: number
  source_type: 'order' | 'stock'
  vendor_id: number
  vendor_name: string
  order_id: number | null
  order_no: string | null
  status: 'draft' | 'confirmed' | 'cancelled'
  purchased_at: string | null
  confirmed_at: string | null
  total_amount: string
  paid_amount: string
  version: number
  created_at: string
  remark: string | null
  corrections: { before: Record<string, unknown> | null; after: Record<string, unknown> | null; reason: string | null; operator_name: string; created_at: string }[]
  items: { id: number; order_item_id: number | null; sku_id: number; sku_name: string; quantity: string; unit_cost: string; amount: string; update_cost: boolean }[]
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
}

export interface VendorLedgerEntry {
  id: number
  type: 'purchase' | 'payment' | 'correction_reversal' | 'correction_new'
  amount: string
  balance_after: string
  purchase_receipt_id: number | null
  order_id: number | null
  occurred_at: string
  operator_name: string | null
  remark: string | null
}

/** POST /vendors、PUT /vendors/{id} 载荷（PUT 只传改过的字段，清空可空字段传 null） */
export type VendorPayload = Partial<Omit<Vendor, 'id' | 'wechat_bound' | 'created_at' | 'updated_at'>>

export interface UploadImageResponse {
  url: string
}

// ---------- Price Center (level-prices / customer-sku-prices / price-books) ----------
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

export type PriceChannelType = 'county_wholesale' | 'street_vendor'

export interface PriceBook {
  id: number
  name: string
  channel_type: PriceChannelType
  created_at?: string | null
  updated_at?: string | null
}

export interface PriceBookCreatePayload {
  name: string
  channel_type: PriceChannelType
}

export interface PriceBookUpdatePayload {
  name?: string | null
  channel_type?: PriceChannelType | null
}

export interface PriceBookItem {
  id: number
  book_id: number
  spu_id: number
  price: string
  effective_date: string
  created_at?: string | null
  updated_at?: string | null
}

export interface PriceBookItemCreatePayload {
  book_id: number
  spu_id: number
  price: number | string
  effective_date: string
}

export interface PriceBookItemUpdatePayload {
  price?: number | string | null
  effective_date?: string | null
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
  within_pool_days: boolean
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
  pool_max_days: number
  trips: RecordTripOption[]
  existing_orders: RecordExistingOrder[]
  freight: { line_id: number; line_name: string; ship_date: string; cutoff_passed: boolean; default_freight_mode: 'deduct' | 'store_paid' | 'customer_paid' } | null
  suggestion: string
}

export interface RecordFreightLine {
  id: number
  name: string
  stops: { id: number; town_name: string; drop_point: string }[]
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
  freight_stop_id?: number | null
  ship_date?: string | null
  freight_mode?: 'deduct' | 'store_paid' | 'customer_paid'
  freight_cost?: string
  remark?: string
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
