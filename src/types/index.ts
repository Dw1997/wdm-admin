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

// ---------- Customer Level Config ----------
export interface LevelConfig {
  id: number
  name: string
  code: string
  type: 'retail' | 'wholesale'
  price_adjustment: number
  description?: string
  sort_order: number
  is_active: boolean
  created_at?: string
}

// ---------- SPU / SKU ----------
export interface SKULevelPrice {
  id?: number
  sku_id?: number
  level_id: number
  level_name?: string
  price: number
}

export interface ProductSKU {
  id: number
  spu_id: number
  sku_code: string
  unit: string
  conversion_ratio: number
  is_base: boolean
  cost_price: number
  default_price: number
  min_price: number
  stock: number
  barcode?: string
  is_active: boolean
  level_prices: SKULevelPrice[]
}

export interface ProductSPU {
  id: number
  name: string
  spu_code: string
  category_id: number | null
  category_name?: string
  brand?: string
  spec?: string
  description?: string
  cover?: string
  status: ProductStatus
  is_hot: boolean
  sort_order: number
  skus: ProductSKU[]
  created_at?: string
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
