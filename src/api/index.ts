import type { ReturnOrder, ReturnPreview, ReturnCreateInput, ReturnConfirmInput, ReturnResult } from '@/types'

// src/api/index.ts - Public API facade (one module per backend resource).
import { get, post, put, del } from './http'
import type {
  UserInfo,
  TokenResponse,
  Customer,
  AdminCustomer,
  CustomerCreatePayload,
  CustomerCreditPayload,
  CustomerAuditPayload,
  CreditLog,
  CreditApplication,
  CreditApplicationResult,
  CustomerResult,
  SalesOption,
  CustomerUpdatePayload,
  Warehouse,
  WarehouseCreatePayload,
  WarehouseUpdatePayload,
  WarehouseZone,
  WarehouseZoneCreatePayload,
  WarehouseZoneUpdatePayload,
  SalesRankingItem,
  SalesDashboard,
  Order,
  OrderListItem,
  OrderUpdatePayload,
  OrderUpdateResult,
  OrderItem,
  PriceStrategy,
  Payment,
  CreditInfo,
  Statement,
  Commission,
  DashboardOverview,
  DashboardDays,
  ProductRanking,
  CustomerRanking,
  SalesRanking,
  SalesTrendPoint,
  Category,
  RegionNode,
  LevelConfig,
  LevelStats,
  LevelCreatePayload,
  LevelUpdatePayload,
  LevelPricePreview,
  LevelPrice,
  LevelPriceUpsert,
  LevelPriceRulePreview,
  CustomerSkuPrice,
  CustomerSkuPriceUpsert,
  CustomerSkuPricePreview,
  PriceBook,
  PriceBookCreatePayload,
  PriceBookUpdatePayload,
  PriceBookItem,
  PriceBookItemCreatePayload,
  PriceBookItemUpdatePayload,
  ProductSPU,
  ProductSKU,
  SpuSavePayload,
  SpuSaveResult,
  PriceImpact,
  AuditLog,
  RoleConfig,
  FeatureNode,
  SystemAccount,
  AccountCreatePayload,
  AccountUpdatePayload,
  UploadImageResponse,
  Vendor,
  VendorPayload,
  PurchaseReceipt,
  PurchaseResult,
  VendorAccount,
  VendorLedgerEntry,
  PageQuery,
  PageResult,
  CustomerAccount,
  PriceQuoteResponse,
  CounterOrder,
  CounterOrderPayload,
  CounterOrderResult,
  PrintRecordResult,
  RecordOrderPayload,
  RecordUpcomingTrips,
  RecordFreightLine,
  FrequentSku,
} from '@/types'

// Auth
export const authApi = {
  login: (username: string, password: string) => post<TokenResponse>('/auth/login', { username, password }),
  refresh: (refresh_token: string) => post<TokenResponse>('/auth/refresh', { refresh_token }),
  logout: () => post('/auth/logout'),
  me: () => get<UserInfo>('/auth/me'),
}

// Products — SPU / SKU (backend /spus, /skus)
// Backend may return a PageResult envelope or a bare array for /spus and /skus — normalize to arrays.
const toItems = <T>(v: T[] | PageResult<T>): T[] => (Array.isArray(v) ? v : v.items)

// 统一分页规范：所有列表请求固定 page_size=20（与后端默认一致）；
// 主列表用服务端分页，下拉选项/批量汇总等需要全量的场景用 fetchAllPages 逐页拉取
export const PAGE_SIZE = 20

/** 按 page_size=PAGE_SIZE 逐页拉取全量（兼容裸数组与分页信封响应），最多 200 页防死循环 */
export async function fetchAllPages<T>(fetchPage: (page: number) => Promise<T[] | PageResult<T>>): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; page <= 200; page++) {
    const v = await fetchPage(page)
    const items = Array.isArray(v) ? v : v.items
    out.push(...items)
    if (items.length < PAGE_SIZE) break
    // 信封里有 total 时，凑够就停，避免整页数恰为 20 的倍数时多请求一页
    if (!Array.isArray(v) && typeof v.total === 'number' && out.length >= v.total) break
  }
  return out
}

export const productApi = {
  spus: (q: { keyword?: string; category_id?: number; is_miniprogram?: boolean; page?: number; page_size?: number } = {}) =>
    get<ProductSPU[] | PageResult<ProductSPU>>('/spus', { params: q }).then(toItems),
  // 完整分页信封（含 total，Apifox SpuPageResponse），商品管理列表分页使用；裸数组响应兼容为单页全量
  spusPage: (q: { keyword?: string; category_id?: number; is_miniprogram?: boolean; page?: number; page_size?: number } = {}) =>
    get<ProductSPU[] | PageResult<ProductSPU>>('/spus', { params: q })
      .then((v): PageResult<ProductSPU> => (Array.isArray(v) ? { items: v, total: v.length, page: 1, page_size: v.length } : v)),
  spu: (id: number) => get<ProductSPU>(`/spus/${id}`),
  // 保存商品返回业务写操作结构 {spu, affected_customer_prices, warnings}（products.md）
  createSpu: (payload: SpuSavePayload) => post<SpuSaveResult>('/spus', payload),
  updateSpu: (id: number, payload: SpuSavePayload) => put<SpuSaveResult>(`/spus/${id}`, payload),
  // 保存前预览：改成本或规则后各价格的变化和低于新最低售价的专属价（仅管理员，pricing.md §2）
  priceImpact: (
    skuId: number,
    body: { cost_price?: number; price_method?: string; price_value?: number; min_price_method?: string; min_price_value?: number },
  ) => post<PriceImpact>(`/skus/${skuId}/price-impact`, body),
  removeSpu: (id: number) => del<void>(`/spus/${id}`),
  skus: (spuId: number) =>
    // GET /spus/{spu_id}/skus 为分页响应（SkuAdminPageResponse）；单 SPU 的 SKU 数远小于 20，单页即可覆盖
    get<ProductSKU[] | PageResult<ProductSKU>>(`/spus/${spuId}/skus`, { params: { page: 1, page_size: PAGE_SIZE } }).then(toItems),
  allSkus: (q: { page?: number; page_size?: number } = {}) =>
    get<ProductSKU[] | PageResult<ProductSKU>>('/skus', { params: q }).then(toItems),
  sku: (id: number) => get<ProductSKU>(`/skus/${id}`),
  createSku: (spuId: number, payload: Partial<ProductSKU>) => post<ProductSKU>(`/spus/${spuId}/skus`, payload),
  updateSku: (skuId: number, payload: Partial<ProductSKU>) => put<ProductSKU>(`/skus/${skuId}`, payload),
  removeSku: (skuId: number) => del<void>(`/skus/${skuId}`),
  skuByBarcode: (barcode: string) => get<ProductSKU>(`/skus/by-barcode/${encodeURIComponent(barcode)}`),
}

// Vendors (供应商) — vendors.md；列表为分页信封，下拉选项用 fetchAllPages 拉全量
export const vendorApi = {
  list: (q: { keyword?: string; type?: string; status?: string; page?: number; page_size?: number } = {}) =>
    get<Vendor[] | PageResult<Vendor>>('/vendors', { params: q }),
  get: (id: number) => get<Vendor>(`/vendors/${id}`),
  create: (payload: VendorPayload) => post<Vendor>('/vendors', payload),
  update: (id: number, payload: VendorPayload) => put<Vendor>(`/vendors/${id}`, payload),
  remove: (id: number) => del<void>(`/vendors/${id}`),
  account: (id: number) => get<VendorAccount>(`/vendors/${id}/account`),
  ledger: (id: number, q: { page?: number; page_size?: number; date_from?: string; date_to?: string } = {}) =>
    get<PageResult<VendorLedgerEntry>>(`/vendors/${id}/ledger`, { params: q }),
  pay: (payload: { vendor_id: number; amount: string; method: string; paid_at?: string; remark?: string }) =>
    post<{ payable_balance: string }>('/vendor-payments', payload),
}

export const purchaseApi = {
  list: (q: { page?: number; page_size?: number; source_type?: string; vendor_id?: number; sku_id?: number; date_from?: string; date_to?: string } = {}) =>
    get<PageResult<PurchaseReceipt>>('/purchase-receipts', { params: q }),
  get: (id: number) => get<PurchaseReceipt>(`/purchase-receipts/${id}`),
  create: (payload: { source_type: 'order' | 'stock'; vendor_id: number; items: { order_item_id?: number; sku_id: number; quantity: string; unit_cost: string; update_cost?: boolean }[]; remark?: string }) =>
    post<PurchaseReceipt>('/purchase-receipts', payload),
  confirm: (id: number, version: number, payment?: { method: string; amount: string }) =>
    post<PurchaseResult>(`/purchase-receipts/${id}/confirm`, { version, payment }),
  update: (id: number, payload: { version: number; item_id?: number; vendor_id?: number; unit_cost?: string; reason?: string }) =>
    put<PurchaseResult>(`/purchase-receipts/${id}`, payload),
}

// Customers
export const customerApi = {
  list: (q: PageQuery = {}) => get<PageResult<Customer>>('/customers', { params: q }),
  all: () => get<Customer[]>('/customers/all'),
  get: (id: number) => get<Customer>(`/customers/${id}`),
  create: (payload: Omit<Customer, 'id' | 'registered_at'>) => post<Customer>('/customers', payload),
  update: (id: number, payload: Partial<Customer>) => put<Customer>(`/customers/${id}`, payload),
  audit: (id: number, approved: boolean, sales_id?: number) =>
    post<Customer>(`/customers/${id}/audit`, { approved, sales_id }),
  remove: (id: number) => del<void>(`/customers/${id}`),
}

export const creditApplicationApi = {
  list: (q: { status?: string; customer_id?: number; sales_id?: number; page?: number; page_size?: number } = {}) =>
    get<CreditApplication[]>('/credit-applications', { params: q }),
  approve: (id: number, payload: { approved_limit?: number | string; comment: string }) =>
    post<CreditApplicationResult>(`/credit-applications/${id}/approve`, payload),
  reject: (id: number, payload: { comment: string }) =>
    post<CreditApplicationResult>(`/credit-applications/${id}/reject`, payload),
}

export const adminCustomerApi = {
  list: (q: { keyword?: string; status?: string; sales_id?: number; wechat_bound?: boolean; credit_source?: string; level_id?: number; audit?: string; page?: number; page_size?: number } = {}) =>
    get<AdminCustomer[]>('/customers', { params: q }),
  create: (payload: CustomerCreatePayload) => post<CustomerResult>('/customers', payload),
  salesOptions: () => get<SalesOption[]>('/customers/sales-options'),
  unbindWechat: (id: number) => post<CustomerResult>(`/customers/${id}/unbind-wechat`),
  setCredit: (id: number, payload: CustomerCreditPayload) => put<CustomerResult>(`/customers/${id}/credit`, payload),
  creditLogs: (id: number) => get<CreditLog[]>(`/customers/${id}/credit-logs`),
  audit: (id: number, payload: CustomerAuditPayload) => post<CustomerResult>(`/customers/${id}/audit`, payload),
  get: (id: number) => get<AdminCustomer>(`/customers/${id}`),
  update: (id: number, payload: CustomerUpdatePayload) => put<AdminCustomer>(`/customers/${id}`, payload),
  remove: (id: number) => del<void>(`/customers/${id}`),
  assignLevel: (id: number, level_id: number) => put<AdminCustomer>(`/customers/${id}/level`, { level_id }),
  account: (id: number) => get<CustomerAccount>(`/customers/${id}/account`),
}

export const warehouseApi = {
  list: () => get<Warehouse[]>('/warehouses'),
  create: (payload: WarehouseCreatePayload) => post<Warehouse>('/warehouses', payload),
  update: (id: number, payload: WarehouseUpdatePayload) => put<Warehouse>(`/warehouses/${id}`, payload),
  remove: (id: number) => del<void>(`/warehouses/${id}`),
  zones: () => get<WarehouseZone[]>('/warehouse-zones'),
  createZone: (payload: WarehouseZoneCreatePayload) => post<WarehouseZone>('/warehouse-zones', payload),
  updateZone: (id: number, payload: WarehouseZoneUpdatePayload) => put<WarehouseZone>(`/warehouse-zones/${id}`, payload),
  removeZone: (id: number) => del<void>(`/warehouse-zones/${id}`),
}

// Sales
export const salesApi = {
  ranking: (start: string, end: string) =>
    get<SalesRankingItem[]>('/sales/ranking', { params: { period_start: start, period_end: end } }),
  dashboard: (salesId: number) => get<SalesDashboard>(`/sales/${salesId}/dashboard`),
}

// Orders
export const orderApi = {
  list: (q: PageQuery & { created_at_from?: string; created_at_to?: string; source?: string; delivery_mode?: string; status?: string; pay_status?: string; return_status?: string; customer_id?: number; sales_id?: number; route_trip_id?: number; freight_shipment_id?: number; over_credit?: boolean; is_walk_in?: boolean } = {}) => get<PageResult<OrderListItem>>('/orders', { params: q }),
  get: (id: number) => get<OrderListItem>(`/orders/${id}`),
  update: (id: number, payload: OrderUpdatePayload) => put<OrderUpdateResult>(`/orders/${id}`, payload),
  create: (payload: { customer_id: number; items: { product_id: number; quantity: number; unit: string }[]; payment_method: Order['payment_method']; remark?: string }) =>
    post<Order>('/orders', payload),
  audit: (id: string, approved: boolean, reason?: string) => post<Order>(`/orders/${id}/audit`, { approved, reason }),
  updateStatus: (id: string, status: Order['status']) => post<Order>(`/orders/${id}/status`, { status }),
  pickingList: (q: PageQuery = {}) => get<{ sku: string; name: string; unit: string; quantity: number; order_ids: string[] }[]>('/orders/picking', { params: q }),
  counterCreate: (payload: CounterOrderPayload) =>
    post<CounterOrderResult>('/orders', payload, {
      headers: { 'Idempotency-Key': `counter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    }),
  recordCreate: (payload: RecordOrderPayload) =>
    post<CounterOrderResult>('/orders', payload),
  deliver: (id: number, items?: { order_item_id: number; delivered_quantity: string }[]) =>
    post<CounterOrderResult>(`/orders/${id}/deliver`, { items }),
  counterGet: (id: number) => get<CounterOrder>(`/orders/${id}`),
  recordPrint: (orderIds: number[], docType: 'counter_sale' | 'delivery_note' = 'counter_sale') =>
    post<PrintRecordResult[]>('/orders/print-records', { order_ids: orderIds, doc_type: docType }),
  approve: (id: number, comment?: string) => post<CounterOrderResult>(`/orders/${id}/approve`, { comment }),
  reject: (id: number, reason: string) => post<CounterOrderResult>(`/orders/${id}/reject`, { reason }),
}

export const deliveryApi = {
  upcomingTrips: (customerId: number) => get<RecordUpcomingTrips>(`/customers/${customerId}/upcoming-trips`),
  freightLines: () => get<RecordFreightLine[]>('/freight-lines'),
  frequentSkus: (customerId: number) => get<FrequentSku[]>(`/customers/${customerId}/frequent-skus`),
}

// Prices
export const priceApi = {
  quote: (payload: { customer_id?: number | null; items: { sku_id: number; quantity: number | string }[] }) =>
    post<PriceQuoteResponse>('/prices/quote', payload),
  list: (q: PageQuery = {}) => get<PageResult<PriceStrategy>>('/prices/strategies', { params: q }),
  all: () => get<PriceStrategy[]>('/prices/strategies/all'),
  create: (payload: Omit<PriceStrategy, 'id' | 'created_at'>) => post<PriceStrategy>('/prices/strategies', payload),
  update: (id: number, payload: Partial<PriceStrategy>) => put<PriceStrategy>(`/prices/strategies/${id}`, payload),
  remove: (id: number) => del<void>(`/prices/strategies/${id}`),
}

// Finance
export const financeApi = {
  payments: (q: PageQuery = {}) => get<PageResult<Payment>>('/finance/payments', { params: q }),
  credit: (customerId: number) => get<CreditInfo>(`/finance/credit/${customerId}`),
  statement: (customerId: number, start: string, end: string) =>
    get<Statement>(`/finance/statements/${customerId}`, { params: { period_start: start, period_end: end } }),
  commissions: (q: PageQuery = {}) => get<PageResult<Commission>>('/finance/commissions', { params: q }),
  settleCommissions: (ids: number[]) => post('/finance/commissions/settle', { ids }),
}

// Dashboard（system.md「看板」，仅管理员）
export const dashboardApi = {
  overview: (refresh = false) => get<DashboardOverview>('/dashboard/overview', { params: refresh ? { refresh: true } : {} }),
  salesTrend: (days: DashboardDays) => get<SalesTrendPoint[]>('/dashboard/sales-trend', { params: { days } }),
  topProducts: (days: DashboardDays, limit = 10) => get<ProductRanking[]>('/dashboard/products/top', { params: { days, limit } }),
  topCustomers: (days: DashboardDays, limit = 10) => get<CustomerRanking[]>('/dashboard/customers/top', { params: { days, limit } }),
  topSales: (days: DashboardDays, limit = 5) => get<SalesRanking[]>('/dashboard/sales/top', { params: { days, limit } }),
}

// Categories (4-level tree)
export const categoryApi = {
  tree: () => get<Category[]>('/categories/tree', { params: {} }),
  list: (parentId?: number) => get<Category[]>('/categories', { params: { parent_id: parentId } }),
  create: (payload: any) => post<Category>('/categories', payload),
  update: (id: number, payload: any) => put<Category>(`/categories/${id}`, payload),
  remove: (id: number) => del<void>(`/categories/${id}`),
}

export const regionApi = {
  tree: () => get<RegionNode[]>('/regions/tree'),
}

// Customer Levels
export const levelApi = {
  list: () => get<LevelConfig[]>('/customer-levels'),
  // 等级行 + 聚合统计（创建人、客户数、月度销售额），等级价格界面使用（Apifox CustomerLevelStatsResponse）
  stats: () => get<LevelStats[]>('/customer-levels/stats'),
  get: (id: number) => get<LevelConfig>(`/customer-levels/${id}`),
  create: (payload: LevelCreatePayload) => post<LevelConfig>('/customer-levels', payload),
  update: (id: number, payload: LevelUpdatePayload) => put<LevelConfig>(`/customer-levels/${id}`, payload),
  remove: (id: number) => del<void>(`/customer-levels/${id}`),
  preview: (id: number, suggestedPrice: number | string) =>
    get<LevelPricePreview>(`/customer-levels/${id}/price-preview`, { params: { suggested_price: suggestedPrice } }),
}

// SPU/SKU endpoints are exposed via `productApi` (see above).

// Price Center — level price rules (等级价格)
export const levelPriceApi = {
  list: (q: { level_id?: number; sku_id?: number } = {}) => get<LevelPrice[]>('/level-prices', { params: q }),
  getDefault: (levelId: number) => get<LevelPrice>(`/level-prices/${levelId}`),
  upsert: (levelId: number, payload: LevelPriceUpsert) => put<LevelPrice>(`/level-prices/${levelId}`, payload),
  remove: (levelId: number, q: { sku_id?: number } = {}) => del<void>(`/level-prices/${levelId}`, { params: q }),
  preview: (levelId: number, q: { sku_id?: number; suggested_price?: number | string } = {}) =>
    get<LevelPriceRulePreview>(`/level-prices/${levelId}/preview`, { params: q }),
}

// Price Center — customer fixed SKU prices (专属价格)
export const customerSkuPriceApi = {
  list: (q: { customer_id?: number; sku_id?: number } = {}) =>
    get<CustomerSkuPrice[]>('/customer-sku-prices', { params: q }),
  upsert: (customerId: number, skuId: number, payload: CustomerSkuPriceUpsert) =>
    put<CustomerSkuPrice>(`/customer-sku-prices/${customerId}/${skuId}`, payload),
  remove: (customerId: number, skuId: number) => del<void>(`/customer-sku-prices/${customerId}/${skuId}`),
  preview: (customerId: number, skuId: number) =>
    get<CustomerSkuPricePreview>(`/customer-sku-prices/${customerId}/${skuId}/preview`),
}

// Price Center — channel price books (价格查询)
export const priceBookApi = {
  list: (q: { keyword?: string; page?: number; page_size?: number } = {}) => get<PriceBook[]>('/price-books', { params: q }),
  get: (id: number) => get<PriceBook>(`/price-books/${id}`),
  create: (payload: PriceBookCreatePayload) => post<PriceBook>('/price-books', payload),
  update: (id: number, payload: PriceBookUpdatePayload) => put<PriceBook>(`/price-books/${id}`, payload),
  remove: (id: number) => del<void>(`/price-books/${id}`),
  items: (q: { keyword?: string; page?: number; page_size?: number } = {}) =>
    get<PriceBookItem[]>('/price-book-items', { params: q }),
  createItem: (payload: PriceBookItemCreatePayload) => post<PriceBookItem>('/price-book-items', payload),
  updateItem: (id: number, payload: PriceBookItemUpdatePayload) => put<PriceBookItem>(`/price-book-items/${id}`, payload),
  removeItem: (id: number) => del<void>(`/price-book-items/${id}`),
}

export const uploadApi = {
  image: (file: File | Blob) => {
    const fd = new FormData()
    fd.append('file', file)
    return post<UploadImageResponse>('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

// Audit Logs
export const auditLogApi = {
  list: (q: { target_type?: string; action?: string; limit?: number } = {}) =>
    get<AuditLog[]>('/audit-logs', { params: q }),
}

// Roles & Permissions
export const roleApi = {
  list: () => get<RoleConfig[]>('/system/roles'),
  create: (payload: Omit<RoleConfig, 'id' | 'created_at' | 'updated_at' | 'is_system' | 'permission_codes'>) => post<RoleConfig>('/system/roles', payload),
  update: (id: number, payload: Partial<RoleConfig>) => put<RoleConfig>(`/system/roles/${id}`, payload),
  remove: (id: number) => del<void>(`/system/roles/${id}`),
  setFeatures: (id: number, feature_ids: number[]) => put<RoleConfig>(`/system/roles/${id}/permissions`, { feature_ids }),
}

export const featureApi = {
  tree: () => get<FeatureNode[]>('/system/features/tree'),
  create: (payload: Omit<FeatureNode, 'id' | 'created_at' | 'updated_at' | 'children'>) => post<FeatureNode>('/system/features', payload),
  update: (id: number, payload: Partial<FeatureNode>) => put<FeatureNode>(`/system/features/${id}`, payload),
  remove: (id: number) => del<void>(`/system/features/${id}`),
}

export const accountApi = {
  list: (keyword?: string) => get<SystemAccount[]>('/system/accounts', { params: { keyword } }),
  listSales: (params: { keyword?: string; is_active?: boolean }) =>
    get<SystemAccount[]>('/system/accounts', { params: { ...params, role_code: 'sales' } }),
  get: (id: number) => get<SystemAccount>(`/system/accounts/${id}`),
  create: (payload: AccountCreatePayload) => post<SystemAccount>('/system/accounts', payload),
  update: (id: number, payload: AccountUpdatePayload) => put<SystemAccount>(`/system/accounts/${id}`, payload),
  remove: (id: number) => del<void>(`/system/accounts/${id}`),
  updatePassword: (id: number, new_password: string, old_password?: string | null) =>
    put<void>(`/system/accounts/${id}/password`, old_password ? { new_password, old_password } : { new_password }),
}

export const returnApi = {
  list: (params: PageQuery) => get<PageResult<ReturnOrder>>('/return-orders', { params }),
  get: (id: number) => get<ReturnOrder>(`/return-orders/${id}`),
  preview: (payload: ReturnCreateInput) => post<ReturnPreview>('/return-orders/preview', payload),
  create: (payload: ReturnCreateInput, key: string) =>
    post<ReturnResult>('/return-orders', payload, { headers: { 'Idempotency-Key': key } }),
  confirm: (id: number, payload: ReturnConfirmInput, key: string) =>
    post<ReturnResult>(`/return-orders/${id}/confirm`, payload, { headers: { 'Idempotency-Key': key } }),
  reject: (id: number, reason: string) => post<ReturnResult>(`/return-orders/${id}/reject`, { reason }),
  recordPrint: (id: number) => post<{
    return_order_id: number; print_count: number; last_printed_at: string; is_reprint: boolean
  }>(`/return-orders/${id}/print-record`),
}
