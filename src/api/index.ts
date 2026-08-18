// src/api/index.ts - Public API facade (one module per backend resource).
import { get, post, put, del } from './http'
import type {
  UserInfo,
  TokenResponse,
  Product,
  ProductSummary,
  PriceResponse,
  Customer,
  Sales,
  SalesPerformance,
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
  LevelConfig,
  ProductSPU,
  AuditLog,
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

// Products
export const productApi = {
  list: (q: PageQuery = {}) => get<PageResult<Product>>('/products', { params: q }),
  all: () => get<Product[]>('/products/all'),
  summary: () => get<ProductSummary[]>('/products/summary'),
  get: (id: number) => get<Product>(`/products/${id}`),
  create: (payload: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => post<Product>('/products', payload),
  update: (id: number, payload: Partial<Product>) => put<Product>(`/products/${id}`, payload),
  remove: (id: number) => del<void>(`/products/${id}`),
  price: (productId: number, customerId: number, unit = '包') =>
    get<PriceResponse>(`/products/${productId}/price`, { params: { customer_id: customerId, unit } }),
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

// Sales
export const salesApi = {
  list: (q: PageQuery = {}) => get<PageResult<Sales>>('/sales', { params: q }),
  all: () => get<Sales[]>('/sales/all'),
  get: (id: number) => get<Sales>(`/sales/${id}`),
  create: (payload: Omit<Sales, 'id' | 'joined_at' | 'total_customers' | 'active_customers' | 'total_gmv' | 'estimated_commission'>) =>
    post<Sales>('/sales', payload),
  update: (id: number, payload: Partial<Sales>) => put<Sales>(`/sales/${id}`, payload),
  performance: (id: number, start: string, end: string) =>
    get<SalesPerformance>(`/sales/${id}/performance`, { params: { period_start: start, period_end: end } }),
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

// Customer Levels
export const levelApi = {
  list: () => get<LevelConfig[]>('/customer-levels'),
  create: (payload: any) => post<LevelConfig>('/customer-levels', payload),
  update: (id: number, payload: any) => put<LevelConfig>(`/customer-levels/${id}`, payload),
  remove: (id: number) => del<void>(`/customer-levels/${id}`),
}

// SPU/SKU
export const spuApi = {
  list: (q: { keyword?: string; category_id?: number } = {}) => get<ProductSPU[]>('/products/spus', { params: q }),
  all: () => get<ProductSPU[]>('/products/spus/all'),
  get: (id: number) => get<ProductSPU>(`/products/spus/${id}`),
  create: (payload: any) => post<ProductSPU>('/products/spus', payload),
  update: (id: number, payload: any) => put<ProductSPU>(`/products/spus/${id}`, payload),
  remove: (id: number) => del<void>(`/products/spus/${id}`),
  updateSKU: (skuId: number, payload: any) => put<void>(`/products/skus/${skuId}`, payload),
}

// Audit Logs
export const auditLogApi = {
  list: (q: { target_type?: string; action?: string; limit?: number } = {}) =>
    get<AuditLog[]>('/audit-logs', { params: q }),
}
