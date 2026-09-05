// src/api/index.ts - Public API facade (one module per backend resource).
import { get, post, put, del } from './http'
import type {
  UserInfo,
  TokenResponse,
  Customer,
  AdminCustomer,
  CustomerRegisterPayload,
  CustomerUpdatePayload,
  Warehouse,
  WarehouseCreatePayload,
  WarehouseUpdatePayload,
  WarehouseZone,
  WarehouseZoneCreatePayload,
  WarehouseZoneUpdatePayload,
  Sales,
  SalesRankingItem,
  Order,
  OrderItem,
  PriceStrategy,
  Payment,
  CreditInfo,
  Statement,
  Commission,
  KPIResponse,
  ProductRanking,
  CustomerRanking,
  SalesTrendPoint,
  AlertItem,
  Category,
  RegionNode,
  LevelConfig,
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
  SkuAttribute,
  AuditLog,
  RoleConfig,
  FeatureNode,
  SystemAccount,
  AccountCreatePayload,
  AccountUpdatePayload,
  UploadImageResponse,
  PageQuery,
  PageResult,
} from '@/types'

// Auth
export const authApi = {
  login: (username: string, password: string) => post<TokenResponse>('/auth/login', { username, password }),
  refresh: (refresh_token: string) => post<TokenResponse>('/auth/refresh', { refresh_token }),
  logout: () => post('/auth/logout'),
  me: () => get<UserInfo>('/auth/me'),
}

// Products — SPU / SKU (backend /spus, /skus)
// Real backend paginates /spus and /skus into PageResult; mock returns bare arrays — normalize to arrays.
const toItems = <T>(v: T[] | PageResult<T>): T[] => (Array.isArray(v) ? v : v.items)

export const productApi = {
  spus: (q: { keyword?: string; category_id?: number; page?: number; page_size?: number } = {}) =>
    get<ProductSPU[] | PageResult<ProductSPU>>('/spus', { params: q }).then(toItems),
  spu: (id: number) => get<ProductSPU>(`/spus/${id}`),
  createSpu: (payload: any) => post<ProductSPU>('/spus', payload),
  updateSpu: (id: number, payload: Partial<ProductSPU>) => put<ProductSPU>(`/spus/${id}`, payload),
  removeSpu: (id: number) => del<void>(`/spus/${id}`),
  skus: (spuId: number) => get<ProductSKU[]>(`/spus/${spuId}/skus`),
  allSkus: (q: { page?: number; page_size?: number } = {}) =>
    get<ProductSKU[] | PageResult<ProductSKU>>('/skus', { params: q }).then(toItems),
  createSku: (spuId: number, payload: Partial<ProductSKU>) => post<ProductSKU>(`/spus/${spuId}/skus`, payload),
  updateSku: (skuId: number, payload: Partial<ProductSKU>) => put<ProductSKU>(`/skus/${skuId}`, payload),
  removeSku: (skuId: number) => del<void>(`/skus/${skuId}`),
  generateSkus: (spuId: number, payload: { attributes: SkuAttribute[]; overwrite?: boolean }) =>
    post<ProductSKU[]>(`/spus/${spuId}/skus/generate`, payload),
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

export const adminCustomerApi = {
  list: (q: { keyword?: string; status?: string; page?: number; page_size?: number } = {}) =>
    get<AdminCustomer[]>('/customers', { params: q }),
  register: (payload: CustomerRegisterPayload) => post<AdminCustomer>('/customers/register', payload),
  get: (id: number) => get<AdminCustomer>(`/customers/${id}`),
  update: (id: number, payload: CustomerUpdatePayload) => put<AdminCustomer>(`/customers/${id}`, payload),
  remove: (id: number) => del<void>(`/customers/${id}`),
  assignLevel: (id: number, level_id: number) => put<AdminCustomer>(`/customers/${id}/level`, { level_id }),
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
  list: (q: PageQuery = {}) => get<PageResult<Sales>>('/sales', { params: q }),
  all: () => get<Sales[]>('/sales/all'),
  get: (id: number) => get<Sales>(`/sales/${id}`),
  create: (payload: Omit<Sales, 'id' | 'joined_at' | 'total_customers' | 'active_customers' | 'total_gmv' | 'estimated_commission'>) =>
    post<Sales>('/sales', payload),
  update: (id: number, payload: Partial<Sales>) => put<Sales>(`/sales/${id}`, payload),
  ranking: (start: string, end: string) =>
    get<SalesRankingItem[]>('/sales/ranking', { params: { period_start: start, period_end: end } }),
}

// Orders
export const orderApi = {
  list: (q: PageQuery = {}) => get<PageResult<Order>>('/orders', { params: q }),
  get: (id: string) => get<Order>(`/orders/${id}`),
  create: (payload: { customer_id: number; items: { product_id: number; quantity: number; unit: string }[]; payment_method: Order['payment_method']; remark?: string }) =>
    post<Order>('/orders', payload),
  audit: (id: string, approved: boolean, reason?: string) => post<Order>(`/orders/${id}/audit`, { approved, reason }),
  updateStatus: (id: string, status: Order['status']) => post<Order>(`/orders/${id}/status`, { status }),
  pickingList: (q: PageQuery = {}) => get<{ sku: string; name: string; unit: string; quantity: number; order_ids: string[] }[]>('/orders/picking', { params: q }),
}

// Prices
export const priceApi = {
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

// Dashboard
export const dashboardApi = {
  kpi: (start: string, end: string) => get<KPIResponse>('/dashboard/kpi', { params: { period_start: start, period_end: end } }),
  topProducts: (start: string, end: string, limit = 10) =>
    get<ProductRanking[]>('/dashboard/products/top', { params: { period_start: start, period_end: end, limit } }),
  topCustomers: (start: string, end: string, limit = 10) =>
    get<CustomerRanking[]>('/dashboard/customers/top', { params: { period_start: start, period_end: end, limit } }),
  salesTrend: (start: string, end: string) =>
    get<SalesTrendPoint[]>('/dashboard/sales/trend', { params: { period_start: start, period_end: end } }),
  alerts: () => get<AlertItem[]>('/dashboard/alerts'),
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
  get: (id: number) => get<SystemAccount>(`/system/accounts/${id}`),
  create: (payload: AccountCreatePayload) => post<SystemAccount>('/system/accounts', payload),
  update: (id: number, payload: AccountUpdatePayload) => put<SystemAccount>(`/system/accounts/${id}`, payload),
  remove: (id: number) => del<void>(`/system/accounts/${id}`),
  updatePassword: (id: number, new_password: string, old_password?: string | null) =>
    put<void>(`/system/accounts/${id}/password`, old_password ? { new_password, old_password } : { new_password }),
}
