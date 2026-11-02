// src/types/index.ts - Domain types shared across the admin frontend.
// Aligned with backend/app/api/v1/*.py Pydantic schemas.

export type Role = 'admin' | 'sales' | 'customer'

export interface UserInfo {
  id: number
  username: string
  real_name?: string
  role: Role
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
  credit_limit: number
  contact_name?: string | null
  contact_phone?: string | null
  openid?: string | null
  unionid: string
  phone: string
  level_id?: number | null
  level_code?: string | null
  level_nickname?: string | null
  status: AdminCustomerStatus
  sales_id?: number | null
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

export interface CustomerRegisterPayload {
  name: string
  phone: string
  unionid: string
  openid?: string | null
  invite_code?: string | null
  address?: string | null
  province?: string | null
  city?: string | null
  district?: string | null
  town?: string | null
  detail_address?: string | null
}

export interface CustomerUpdatePayload {
  name?: string
  channel_type?: CustomerChannelType
  credit_limit?: number
  contact_name?: string | null
  contact_phone?: string | null
  openid?: string | null
  unionid?: string
  phone?: string
  status?: AdminCustomerStatus
  sales_id?: number | null
  invite_code?: string | null
  address?: string | null
  province?: string | null
  city?: string | null
  district?: string | null
  town?: string | null
  detail_address?: string | null
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

// ---------- Dashboard ----------
export interface KPIResponse {
  period_start: string
  period_end: string
  gmv: number
  order_count: number
  new_customers: number
  active_customers: number
  pending_orders: number
  low_stock_products: number
  expiring_batches: number
}

export interface ProductRanking {
  product_id: number
  product_name: string
  quantity_sold: number
  gmv: number
}

export interface CustomerRanking {
  customer_id: number
  customer_name: string
  gmv: number
  order_count: number
}

export interface SalesTrendPoint {
  date: string
  gmv: number
  order_count: number
}

export interface AlertItem {
  id: number
  type: 'low_stock' | 'expiring' | 'overdue_payment' | 'abnormal_price'
  level: 'info' | 'warning' | 'danger'
  title: string
  description: string
  created_at: string
  link?: string
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
  created_at?: string
  updated_at?: string
}

export interface LevelCreatePayload {
  level_id: string
  nickname: string
  type: CustomerLevelType
  description?: string | null
  is_active?: boolean
}

export interface LevelUpdatePayload {
  level_id?: string
  nickname?: string
  type?: CustomerLevelType
  description?: string | null
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
  created_at?: string
  updated_at?: string
}

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
  role_id: number
  is_active: boolean
}

export interface AccountUpdatePayload {
  real_name?: string | null
  role_id?: number | null
  is_active?: boolean | null
}

export interface AccountPasswordUpdate {
  new_password: string
  old_password?: string | null
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

/** POST /vendors、PUT /vendors/{id} 载荷（PUT 只传改过的字段，清空可空字段传 null） */
export type VendorPayload = Partial<Omit<Vendor, 'id' | 'wechat_bound' | 'created_at' | 'updated_at'>>
