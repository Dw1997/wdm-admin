import type {
  ReturnOrder,
  ReturnPreview,
  ReturnCreateInput,
  ReturnConfirmInput,
  ReturnResult,
  LedgerOffset,
  StockRow,
  StockMovementRow,
  PurchasePlanPreviewPayload,
  PurchasePlanPreviewResult,
  PurchasePlanToReceiptsPayload,
  PurchasePlanToReceiptsResult,
} from '@/types'

// src/api/index.ts - Public API facade (one module per backend resource).
import { get, post, put, patch, del } from './http'
import type {
  AvailableCouponListResult,
  ReferralConfig,
  ReferralConfigUpdatePayload,
  ReferralRewardListResult,
  CouponIssuePayload,
  CouponTemplate,
  CouponTemplatePayload,
  CustomerCouponRecord,
  CustomerCouponRecordListResult,
  ApiWarning,
  UserInfo,
  TokenResponse,
  Customer,
  CustomerTag,
  CustomerTagPayload,
  AdminCustomer,
  CustomerCreatePayload,
  CustomerCreditPayload,
  CustomerAuditPayload,
  CreditLog,
  CreditApplication,
  CreditApplicationResult,
  CustomerResult,
  SalesOption,
  PromotionQrcode,
  CustomerUpdatePayload,
  Warehouse,
  WarehouseCreatePayload,
  WarehouseUpdatePayload,
  WarehouseZone,
  WarehouseZoneCreatePayload,
  WarehouseZoneUpdatePayload,
  SalesRankingItem,
  SalesDashboard,
  CommissionSettingSales,
  CommissionSettingSpu,
  CommissionSettingChange,
  CommissionSettingSaveResult,
  Order,
  OrderListItem,
  BatchDeliverPayload,
  BatchDeliverResult,
  BatchCancelPayload,
  BatchCancelResult,
  OrderUpdatePayload,
  OrderUpdateResult,
  OrderItem,
  OrderApprovalItem,
  OrderApprovalQuery,
  OrderApprovalRecord,
  OrderPriceAdjustment,
  OrderPriceAdjustmentPayload,
  OrderPriceAdjustmentQuery,
  OrderPriceAdjustmentResult,
  PriceStrategy,
  AccountRow,
  AccountSummary,
  BillsResponse,
  LedgerEntry,
  PaymentPayload,
  PaymentRecordItem,
  PaymentResult,
  CommissionRow,
  CommissionSummary,
  CommissionSettleResult,
  CommissionSettlement,
  CommissionSettlementDetail,
  CommissionRevokeResult,
  ExpenseCategory,
  OperatingExpense,
  MonthlyProfitReport,
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
  CustomerPriceRow,
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
  OrderResult,
  PrintRecordResult,
  SalesNote,
  PickingResult,
  SystemSettingItem,
  RecordOrderPayload,
  RecordUpcomingTrips,
  FreightLine,
  FreightLinePayload,
  FreightLineResult,
  FrequentSku,
  RouteTrip,
  RouteTripDraft,
  RouteTripDraftRequest,
  RouteTripSavePayload,
  RouteTripSaveResult,
  RouteTripCancelResult,
  RouteTripOrder,
  RouteTemplate,
  RouteTemplateSavePayload,
  CountyCorridor,
  CountyCorridorSummary,
  CountyCorridorSavePayload,
  CallListCustomer,
  CallResult,
  RouteTripActionResult,
  FreightShipment,
  FreightShipmentDetail,
  FreightHandoverPayload,
  FreightHandoverResult,
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
  listOffsets: (q: { customer_id?: number; vendor_id?: number; page?: number; page_size?: number } = {}) =>
    get<PageResult<LedgerOffset>>('/ledger-offsets', { params: q }),
  createOffset: (payload: { customer_id: number; vendor_id: number; amount: string; remark?: string }) =>
    post<{ offset: LedgerOffset; customer_ar_balance: string; vendor_payable_balance: string }>('/ledger-offsets', payload),
  reverseOffset: (id: number, reason: string) =>
    post<{ offset: LedgerOffset; customer_ar_balance: string; vendor_payable_balance: string }>(`/ledger-offsets/${id}/reverse`, { reason }),
}

export const purchaseApi = {
  list: (q: { page?: number; page_size?: number; source_type?: string; status?: string; vendor_id?: number; spu_id?: number; sku_id?: number; date_from?: string; date_to?: string } = {}) =>
    get<PageResult<PurchaseReceipt>>('/purchase-receipts', { params: q }),
  get: (id: number) => get<PurchaseReceipt>(`/purchase-receipts/${id}`),
  create: (payload: {
    source_type: 'order' | 'stock'
    vendor_id: number
    purchased_at?: string
    photos?: string[]
    items: { order_item_id?: number; spu_id?: number; sku_id?: number | null; quantity: string; unit_cost: string; update_cost?: boolean }[]
    remark?: string
  }) => post<PurchaseReceipt>('/purchase-receipts', payload),
  confirm: (id: number, version: number, payment?: { method: string; amount: string }) =>
    post<PurchaseResult>(`/purchase-receipts/${id}/confirm`, { version, payment }),
  update: (id: number, payload: { version: number; item_id?: number; vendor_id?: number; unit_cost?: string; reason?: string }) =>
    put<PurchaseResult>(`/purchase-receipts/${id}`, payload),
  createReturn: (payload: {
    vendor_id: number
    returned_at?: string
    photos?: string[]
    items: { spu_id?: number; sku_id?: number | null; quantity: string; unit_cost: string }[]
    remark?: string
  }) => post<{ purchase_receipt: PurchaseReceipt; vendor_balance: string }>('/purchase-returns', payload),
}

export const stockApi = {
  list: (q: { keyword?: string; category_id?: number; negative_only?: boolean; include_temp_pick?: boolean; page?: number; page_size?: number } = {}) =>
    get<PageResult<StockRow>>('/stocks', { params: q }),
  adjust: (spuId: number, payload: { target_quantity?: string; change?: string; reason: string }) =>
    post<StockRow>(`/stocks/${spuId}/adjust`, payload),
  movements: (q: { spu_id?: number; sku_id?: number; type?: string; date_from?: string; date_to?: string; page?: number; page_size?: number } = {}) =>
    get<PageResult<StockMovementRow>>('/stock-movements', { params: q }),
}

export const purchasePlanApi = {
  preview: (payload: PurchasePlanPreviewPayload = {}) =>
    post<PurchasePlanPreviewResult>('/purchase-plans/preview', payload),
  toReceipts: (payload: PurchasePlanToReceiptsPayload, idempotencyKey?: string) =>
    post<PurchasePlanToReceiptsResult>(
      '/purchase-plans/to-receipts',
      payload,
      idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
    ),
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
  list: (q: { keyword?: string; status?: string; sales_id?: number; tag_id?: number; wechat_bound?: boolean; credit_source?: string; level_id?: number; audit?: string; page?: number; page_size?: number } = {}) =>
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

export const promotionApi = {
  qrcode: (params: { account_id?: number; refresh?: boolean } = {}) =>
    get<PromotionQrcode>('/promotion/qrcode', { params }),
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
  list: (q: PageQuery & { created_at_from?: string; created_at_to?: string; source?: string; delivery_mode?: string; status?: string; pay_status?: string; return_status?: string; customer_id?: number; sales_id?: number; route_trip_id?: number; freight_shipment_id?: number; freight_line_id?: number; over_credit?: boolean; is_walk_in?: boolean; pool?: boolean; pool_overdue?: boolean; pool_within_hours?: number; has_freight_line?: boolean; delivery_region_id?: number; printed?: boolean; order_by?: string } = {}) => get<PageResult<OrderListItem>>('/orders', { params: q }),
  get: (id: number) => get<OrderListItem>(`/orders/${id}`),
  update: (id: number, payload: OrderUpdatePayload) => put<OrderUpdateResult>(`/orders/${id}`, payload),
  create: (payload: { customer_id: number; items: { product_id: number; quantity: number; unit: string }[]; payment_method: Order['payment_method']; remark?: string }) =>
    post<Order>('/orders', payload),
  audit: (id: string, approved: boolean, reason?: string) => post<Order>(`/orders/${id}/audit`, { approved, reason }),
  updateStatus: (id: string, status: Order['status']) => post<Order>(`/orders/${id}/status`, { status }),
  salesNotes: (orderIds: number[]) => get<SalesNote[]>('/orders/print/sales-notes', { params: { order_ids: orderIds.join(',') } }),
  picking: (q: { route_trip_id?: number; freight_shipment_id?: number; unassigned?: boolean }) => get<PickingResult>('/orders/picking', { params: q }),
  counterCreate: (payload: CounterOrderPayload) =>
    post<CounterOrderResult>('/orders', payload, {
      headers: { 'Idempotency-Key': `counter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    }),
  recordCreate: (payload: RecordOrderPayload) =>
    post<CounterOrderResult>('/orders', payload),
  deliver: (id: number, items?: { order_item_id: number; delivered_quantity: string }[], deliveredAt?: string, cancelReason?: string) =>
    post<CounterOrderResult>(`/orders/${id}/deliver`, { items, delivered_at: deliveredAt, cancel_reason: cancelReason }),
  reschedule: (id: number, payload: { target: 'trip' | 'pool' | 'freight' | 'local' | 'pickup'; trip_id?: number; freight_line_id?: number; ship_date?: string; depart_time?: string; freight_mode?: 'deduct' | 'store_paid' | 'customer_paid'; reason?: string }) =>
    post<OrderResult>(`/orders/${id}/reschedule`, payload),
  batchReschedule: (payload: { order_ids: number[]; target: 'trip' | 'pool' | 'freight' | 'local' | 'pickup'; trip_id?: number; freight_line_id?: number; ship_date?: string; depart_time?: string; freight_mode?: 'deduct' | 'store_paid' | 'customer_paid'; reason?: string }) =>
    post<{ updated_count: number; orders: OrderListItem[]; warnings: ApiWarning[] }>('/orders/batch-reschedule', payload),
  batchFreightHandover: (payload: { orders: { order_id: number; freight_cost?: string | null }[]; total_freight?: string | null }) =>
    post<{ handed_over_count: number; order_ids: number[]; warnings: ApiWarning[] }>('/orders/batch-freight-handover', payload),
  batchDeliver: (payload: BatchDeliverPayload) => post<BatchDeliverResult>('/orders/batch-deliver', payload),
  batchCancel: (payload: BatchCancelPayload) => post<BatchCancelResult>('/orders/batch-cancel', payload),
  updateFreightCost: (id: number, freight_cost: string | null) =>
    put<OrderResult>(`/orders/${id}/freight-cost`, { freight_cost }),
  cancel: (id: number, reason?: string) => post<OrderResult>(`/orders/${id}/cancel`, { reason }),
  counterGet: (id: number) => get<CounterOrder>(`/orders/${id}`),
  recordPrint: (orderIds: number[], docType: 'counter_sale' | 'delivery_note' = 'counter_sale') =>
    post<PrintRecordResult[]>('/orders/print-records', { order_ids: orderIds, doc_type: docType }),
  approvals: (q: OrderApprovalQuery = {}) => get<PageResult<OrderApprovalItem>>('/order-approvals', { params: q }),
  approvalHistory: (id: number) => get<OrderApprovalRecord[]>(`/orders/${id}/approvals`),
  approve: (id: number, comment?: string) => post<CounterOrderResult>(`/orders/${id}/approve`, { comment }),
  reject: (id: number, reason: string) => post<CounterOrderResult>(`/orders/${id}/reject`, { reason }),

  // 送达前改价（orders.md）：管理员提交直接生效，销售提交进入待审批
  createOrderPriceAdjustment: (id: number, payload: OrderPriceAdjustmentPayload) =>
    post<OrderPriceAdjustmentResult>(`/orders/${id}/price-adjustments`, payload),
  listOrderPriceAdjustments: (q: OrderPriceAdjustmentQuery = {}) =>
    get<PageResult<OrderPriceAdjustment>>('/order-price-adjustments', { params: q }),
  approveOrderPriceAdjustment: (id: number, comment?: string | null) =>
    post<OrderPriceAdjustmentResult>(`/order-price-adjustments/${id}/approve`, { comment: comment ?? null }),
  rejectOrderPriceAdjustment: (id: number, comment: string) =>
    post<OrderPriceAdjustmentResult>(`/order-price-adjustments/${id}/reject`, { comment }),
}

export const deliveryApi = {
  upcomingTrips: (customerId: number) => get<RecordUpcomingTrips>(`/customers/${customerId}/upcoming-trips`),
  freightLines: (q: { is_active?: boolean; keyword?: string; town_region_id?: number } = {}) =>
    get<FreightLine[]>('/freight-lines', { params: q }),
  freightLine: (id: number) => get<FreightLine>(`/freight-lines/${id}`),
  createFreightLine: (payload: FreightLinePayload) => post<FreightLineResult>('/freight-lines', payload),
  updateFreightLine: (id: number, payload: Partial<FreightLinePayload>) =>
    put<FreightLineResult>(`/freight-lines/${id}`, payload),
  frequentSkus: (customerId: number) => get<FrequentSku[]>(`/customers/${customerId}/frequent-skus`),
}

// 物流批次与交车（delivery.md §9）
export const freightShipmentApi = {
  list: (q: { date_from?: string; date_to?: string; line_id?: number; status?: string; order_by?: string; page?: number; page_size?: number } = {}) =>
    get<PageResult<FreightShipment>>('/freight-shipments', { params: q, silent: true }),
  get: (id: number) => get<FreightShipmentDetail>(`/freight-shipments/${id}`, { silent: true }),
  allocate: (id: number, payload: { total_freight: string; order_ids?: number[] }) =>
    post<{ order_id: number; freight_cost: string }[]>(`/freight-shipments/${id}/allocate-freight`, payload),
  handOver: (id: number, payload: FreightHandoverPayload, key: string) =>
    post<FreightHandoverResult>(`/freight-shipments/${id}/hand-over`, payload, { headers: { 'Idempotency-Key': key } }),
}

// 线路配送：出车趟次、常用路线、县城沿线（delivery.md §2–§5）
export const routeTripApi = {
  list: (q: { status?: string; date_from?: string; date_to?: string; owner_id?: number; keyword?: string; order_by?: string; page?: number; page_size?: number } = {}) =>
    get<PageResult<RouteTrip>>('/route-trips', { params: q, silent: true }),
  get: (id: number) => get<RouteTrip>(`/route-trips/${id}`, { silent: true }),
  draft: (payload: RouteTripDraftRequest) => post<RouteTripDraft>('/route-trips/draft', payload, { silent: true }),
  create: (payload: RouteTripSavePayload) => post<RouteTripSaveResult>('/route-trips', payload),
  update: (id: number, payload: RouteTripSavePayload) => put<RouteTripSaveResult>(`/route-trips/${id}`, payload),
  cancel: (id: number) => post<RouteTripCancelResult>(`/route-trips/${id}/cancel`),
  orders: (id: number) => get<RouteTripOrder[]>(`/route-trips/${id}/orders`, { silent: true }),
  callList: (id: number) => get<CallListCustomer[]>(`/route-trips/${id}/call-list`, { silent: true }),
  markCall: (id: number, customerId: number, call_result: Exclude<CallResult, 'ordered'>) =>
    put<CallListCustomer>(`/route-trips/${id}/calls/${customerId}`, { call_result }),
  orderSequence: (id: number, order_ids: number[]) =>
    put<RouteTripOrder[]>(`/route-trips/${id}/order-sequence`, { order_ids }),
  depart: (id: number) => post<RouteTripActionResult>(`/route-trips/${id}/depart`),
  finish: (id: number) => post<RouteTripActionResult>(`/route-trips/${id}/finish`),
  templates: (q: { is_active?: boolean } = {}) => get<RouteTemplate[]>('/route-templates', { params: q, silent: true }),
  template: (id: number) => get<RouteTemplate>(`/route-templates/${id}`, { silent: true }),
  createTemplate: (payload: RouteTemplateSavePayload) => post<RouteTemplate>('/route-templates', payload),
  updateTemplate: (id: number, payload: Partial<RouteTemplateSavePayload>) =>
    put<RouteTemplate>(`/route-templates/${id}`, payload),
  deleteTemplate: (id: number) => del<void>(`/route-templates/${id}`),
  countyCorridors: () => get<CountyCorridorSummary[]>('/county-corridors', { silent: true }),
  countyCorridor: (countyId: number) => get<CountyCorridor>(`/county-corridors/${countyId}`, { silent: true }),
  saveCountyCorridor: (countyId: number, payload: CountyCorridorSavePayload) =>
    put<CountyCorridor>(`/county-corridors/${countyId}`, payload),
  saveAsTemplate: (id: number, payload: { name: string; remark?: string }) =>
    post<RouteTemplate>(`/route-trips/${id}/save-as-template`, payload),
}

// Prices
export const priceApi = {
  quote: (payload: { customer_id?: number | null; items: { sku_id: number; quantity: number | string }[] }) =>
    post<PriceQuoteResponse>('/prices/quote', payload),
  // 客户成交价查询（pricing.md §7）：只传客户返回该客户全部规格，再传 spu_id / sku_id 精确到一行
  customerPrices: (q: {
    customer_id: number
    spu_id?: number
    sku_id?: number
    keyword?: string
    page?: number
    page_size?: number
  }) => get<PageResult<CustomerPriceRow>>('/prices/customer-prices', { params: q }),
  list: (q: PageQuery = {}) => get<PageResult<PriceStrategy>>('/prices/strategies', { params: q }),
  all: () => get<PriceStrategy[]>('/prices/strategies/all'),
  create: (payload: Omit<PriceStrategy, 'id' | 'created_at'>) => post<PriceStrategy>('/prices/strategies', payload),
  update: (id: number, payload: Partial<PriceStrategy>) => put<PriceStrategy>(`/prices/strategies/${id}`, payload),
  remove: (id: number) => del<void>(`/prices/strategies/${id}`),
}

// Finance
export const financeApi = {
  // 客户账期（finance.md §3，仅管理员）
  accounts: (q: {
    keyword?: string
    sales_id?: number
    term_type?: 'days' | 'monthly'
    overdue_only?: boolean
    has_balance?: boolean
    bucket?: 'fresh' | 'o1' | 'o2' | 'o3'
    sort?: 'overdue' | 'balance' | 'max_overdue_days' | 'last_payment'
    page?: number
    page_size?: number
  } = {}) => get<PageResult<AccountRow>>('/finance/accounts', { params: q }),
  accountSummary: () => get<AccountSummary>('/finance/accounts/summary'),
  customerBills: (customerId: number) =>
    get<BillsResponse>(`/finance/customers/${customerId}/bills`),
  createPayment: (payload: PaymentPayload) =>
    post<PaymentResult>('/finance/payments', payload, {
      headers: { 'Idempotency-Key': `${Date.now()}-${Math.random().toString(36).slice(2, 10)}` },
    }),
  payments: (q: {
    customer_id?: number
    order_id?: number
    keyword?: string
    channel?: 'offline' | 'wx_miniprogram'
    method?: string
    kind?: string
    date_from?: string
    date_to?: string
    page?: number
    page_size?: number
  } = {}) => get<PageResult<PaymentRecordItem>>('/finance/payments', { params: q }),
  ledger: (customerId: number, q: { date_from?: string; date_to?: string; type?: string; page?: number; page_size?: number } = {}) =>
    get<PageResult<LedgerEntry>>(`/customers/${customerId}/ledger`, { params: q }),
  // 销售提成（finance.md §9，仅管理员）
  commissions: (q: { month: string; status?: string; sales_id?: number; keyword?: string; page?: number; page_size?: number }) =>
    get<PageResult<CommissionRow>>('/finance/commissions', { params: q }),
  commissionSummary: (month: string) =>
    get<CommissionSummary>('/finance/commissions/summary', { params: { month } }),
  settleCommissions: (payload: { order_ids: number[]; settle_date: string; remark?: string }) =>
    post<CommissionSettleResult>('/finance/commissions/settle', payload),
  commissionSettlements: (q: { month?: string; sales_id?: number; page?: number; page_size?: number } = {}) =>
    get<PageResult<CommissionSettlement>>('/finance/commission-settlements', { params: q }),
  commissionSettlement: (no: string) =>
    get<CommissionSettlementDetail>(`/finance/commission-settlements/${no}`),
  revokeCommissionSettlement: (no: string, reason?: string) =>
    post<CommissionRevokeResult>(`/finance/commission-settlements/${no}/revoke`, { reason }),

  // 经营成本与月度利润（finance.md §10，仅管理员）
  expenses: (q: { month: string; category_id?: number; keyword?: string; page?: number; page_size?: number }) =>
    get<PageResult<OperatingExpense>>('/finance/operating-expenses', { params: q }),
  expenseCategories: () => get<{ items: ExpenseCategory[] }>('/finance/expense-categories'),
  createExpense: (payload: { expense_date: string; category_id: number; amount: string; remark?: string }) =>
    post<OperatingExpense>('/finance/operating-expenses', payload),
  updateExpense: (
    id: number,
    payload: { expense_date?: string; category_id?: number; amount?: string; remark?: string },
  ) => put<OperatingExpense>(`/finance/operating-expenses/${id}`, payload),
  deleteExpense: (id: number) => del<void>(`/finance/operating-expenses/${id}`),
  monthlyProfit: (month: string) =>
    get<MonthlyProfitReport>('/finance/monthly-profit', { params: { month } }),

  // 提成设置（finance.md §9.2，仅管理员）
  commissionSettingSales: () =>
    get<{ items: CommissionSettingSales[] }>('/finance/commission-settings/sales'),
  commissionSettingSkus: (
    salesId: number,
    q: { keyword?: string; category_id?: number; status?: string; page?: number; page_size?: number } = {},
  ) => get<PageResult<CommissionSettingSpu>>(`/finance/commission-settings/sales/${salesId}/skus`, { params: q }),
  saveCommissionSettings: (salesId: number, items: { sku_id: number; rate: string | null }[]) =>
    put<CommissionSettingSaveResult>(`/finance/commission-settings/sales/${salesId}`, { items }),
  commissionSettingChanges: (q: { sales_id?: number; page?: number; page_size?: number } = {}) =>
    get<PageResult<CommissionSettingChange>>('/finance/commission-settings/changes', { params: q }),
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
  list: (q: { parent_id?: number; level?: number; keyword?: string; limit?: number; is_active?: boolean } = {}) =>
    get<RegionNode[]>('/regions', { params: q }),
  get: (id: number) => get<RegionNode>(`/regions/${id}`),
}

export const customerTagApi = {
  list: (q: { is_active?: boolean } = {}) => get<CustomerTag[]>('/customer-tags', { params: q }),
  create: (payload: CustomerTagPayload) => post<CustomerTag>('/customer-tags', payload),
  update: (id: number, payload: Partial<CustomerTagPayload>) => put<CustomerTag>(`/customer-tags/${id}`, payload),
  remove: (id: number) => del<void>(`/customer-tags/${id}`),
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

export const uploadApi = {
  image: (file: File | Blob) => {
    const fd = new FormData()
    fd.append('file', file)
    return post<UploadImageResponse>('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

// Audit Logs
export const auditLogApi = {
  list: (q: PageQuery & {
    target_type?: string
    action?: string
    user_id?: number
    user_role?: string
    keyword?: string
    request_id?: string
    date_from?: string
    date_to?: string
    sort?: 'asc' | 'desc'
  } = {}) => get<PageResult<AuditLog>>('/audit-logs', { params: q }),
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

// 系统参数（system.md）：打印中心读店名 / 电话 / 地址
export const systemSettingApi = {
  list: () => get<SystemSettingItem[]>('/system/settings', { silent: true }),
}


// 优惠券（coupons.md）
export const couponApi = {
  listTemplates: (params: { coupon_type?: string; status?: string; keyword?: string; page?: number; page_size?: number } = {}) =>
    get<PageResult<CouponTemplate>>('/coupons/templates', { params }),
  createTemplate: (payload: CouponTemplatePayload) => post<CouponTemplate>('/coupons/templates', payload),
  updateTemplate: (id: number, payload: CouponTemplatePayload) => put<CouponTemplate>(`/coupons/templates/${id}`, payload),
  updateTemplateStatus: (id: number, status: 'active' | 'disabled') =>
    patch<CouponTemplate>(`/coupons/templates/${id}/status`, { status }),
  issue: (payload: CouponIssuePayload) =>
    post<{ issued_customer_count: number; issued_coupon_count: number }>('/coupons/issue', payload),
  listRecords: (params: { customer_id?: number; template_id?: number; coupon_type?: string; status?: string; keyword?: string; page?: number; page_size?: number } = {}) =>
    get<CustomerCouponRecordListResult>('/coupons/records', { params }),
  voidRecord: (id: number, reason: string) =>
    post<CustomerCouponRecord>(`/coupons/records/${id}/void`, { reason }),
  customerAvailable: (customerId: number, orderAmount = '0.00') =>
    get<AvailableCouponListResult>('/coupons/customer-available', {
      params: { customer_id: customerId, order_amount: orderAmount },
      silent: true,
    }),
  getReferralConfig: () => get<ReferralConfig>('/coupons/referral-config'),
  updateReferralConfig: (payload: ReferralConfigUpdatePayload) =>
    put<ReferralConfig>('/coupons/referral-config', payload),
  listReferralRecords: (params: { status?: string; keyword?: string; page?: number; page_size?: number } = {}) =>
    get<ReferralRewardListResult>('/coupons/referral-records', { params }),
}
