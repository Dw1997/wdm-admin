// src/api/mock/adapter.ts - Axios mock adapter that routes to in-memory services.
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import dayjs from 'dayjs'
import { regionTree } from './db2'
import {
  authService,
  productService,
  customerService,
  salesService,
  orderService,
  priceStrategyService,
  financeService,
  dashboardService,
} from './services'
import {
  categoryService,
  levelService,
  spuService,
  auditLogService,
  roleService,
  featureService,
  accountService,
  adminCustomerService,
  warehouseService,
  levelPriceService,
  customerSkuPriceService,
  priceBookService,
} from './services2'

type Handler = (config: InternalAxiosRequestConfig) => Promise<unknown> | unknown

function extractId(c: InternalAxiosRequestConfig): string {
  return (c.url || '').split('?')[0].split('/').pop() || ''
}

const routes: { method: string; pattern: RegExp; handler: Handler }[] = []

function route(method: string, path: string, handler: Handler) {
  // Convert /products/:id to regex
  const pattern = new RegExp('^' + path.replace(/:[a-zA-Z_]+/g, '([^/]+)') + '$')
  routes.push({ method: method.toUpperCase(), pattern, handler })
}

function params(config: InternalAxiosRequestConfig): Record<string, string> {
  const result: Record<string, string> = {}
  const re = /[?&]([^=&]+)=([^&]*)/g
  const url = config.url || ''
  let m: RegExpExecArray | null
  while ((m = re.exec(url)) !== null) {
    result[decodeURIComponent(m[1])] = decodeURIComponent(m[2])
  }
  if (config.params) {
    Object.entries(config.params as Record<string, string>).forEach(([k, v]) => {
      if (v !== undefined && v !== null) result[k] = String(v)
    })
  }
  return result
}

function buildResponse<T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse<T> {
  return {
    data: { code: 200, message: 'success', data },
    status,
    statusText: status === 200 ? 'OK' : 'Created',
    headers: {},
    config,
  } as AxiosResponse<T>
}

function makeError(config: InternalAxiosRequestConfig, status: number, message: string) {
  const err: any = new Error(message)
  err.config = config
  err.response = { status, data: { code: status, message, data: null }, headers: {}, statusText: message, config }
  return err
}

// -------- Auth --------
route('POST', '/auth/login', async (c) => {
  const body = JSON.parse(c.data || '{}')
  return authService.login(body.username, body.password)
})
route('POST', '/auth/refresh', () => ({ access_token: 'mock-refreshed', token_type: 'bearer', expires_in: 3600 }))
route('POST', '/auth/logout', () => null)
route('GET', '/auth/me', () => authService.me())

// -------- Products --------
route('GET', '/products', (c) => {
  return productService.list(params(c) as any)
})
route('GET', '/products/summary', () => productService.summary())
route('POST', '/products', (c) => productService.create(JSON.parse(c.data || '{}')))
route('GET', '/products/:id', (c) => productService.get(Number(c.url!.split('/').pop())))
route('PUT', '/products/:id', (c) => {
  const id = Number(c.url!.split('/').slice(-2, -1)[0])
  return productService.update(id, JSON.parse(c.data || '{}'))
})
route('DELETE', '/products/:id', (c) => {
  const id = Number(c.url!.split('/').pop())
  return productService.remove(id)
})
route('GET', '/products/:id/price', (c) => {
  const p = params(c)
  const productId = Number(c.url!.match(/\/products\/(\d+)\/price/)![1])
  return productService.getPrice(productId, Number(p.customer_id), p.unit)
})

// -------- Customers --------
route('GET', '/customers', (c) => adminCustomerService.list(params(c) as any))
route('GET', '/customers/all', () => adminCustomerService.list({ page_size: 100 }))
route('POST', '/customers/register', (c) => adminCustomerService.register(JSON.parse(c.data || '{}')))
route('GET', '/customers/:id', (c) => adminCustomerService.get(Number(extractId(c))))
route('PUT', '/customers/:id', (c) => {
  const id = Number(extractId(c))
  return adminCustomerService.update(id, JSON.parse(c.data || '{}'))
})
route('PUT', '/customers/:id/level', (c) => {
  const id = Number(extractId(c))
  const body = JSON.parse(c.data || '{}')
  return adminCustomerService.assignLevel(id, Number(body.level_id))
})
route('DELETE', '/customers/:id', (c) => {
  return adminCustomerService.remove(Number(extractId(c)))
})

// -------- Sales --------
route('GET', '/sales', (c) => salesService.list(params(c) as any))
route('GET', '/sales/all', () => salesService.all())
route('GET', '/sales/ranking', (c) => {
  const p = params(c)
  return salesService.ranking(p.period_start || dayjs().subtract(30, 'day').format('YYYY-MM-DD'), p.period_end || dayjs().format('YYYY-MM-DD'))
})
route('GET', '/sales/:id', (c) => salesService.get(Number(c.url!.split('/').pop())))
route('POST', '/sales', (c) => salesService.create(JSON.parse(c.data || '{}')))
route('PUT', '/sales/:id', (c) => {
  const id = Number(c.url!.split('/').slice(-2, -1)[0])
  return salesService.update(id, JSON.parse(c.data || '{}'))
})
route('GET', '/sales/:id/performance', (c) => {
  const id = Number(c.url!.split('/').slice(-2, -1)[0])
  const p = params(c)
  return salesService.performance(id, p.period_start || dayjs().subtract(30, 'day').format('YYYY-MM-DD'), p.period_end || dayjs().format('YYYY-MM-DD'))
})

// -------- Orders --------
route('GET', '/orders', (c) => orderService.list(params(c) as any))
route('POST', '/orders', (c) => orderService.create(JSON.parse(c.data || '{}')))
route('GET', '/orders/picking', (c) => orderService.pickingList(params(c) as any))
route('GET', '/orders/:id', (c) => orderService.get(c.url!.split('/').pop()!))
route('POST', '/orders/:id/audit', (c) => {
  const id = c.url!.split('/').slice(-2, -1)[0]
  const body = JSON.parse(c.data || '{}')
  return orderService.audit(id, body.approved, body.reason)
})
route('POST', '/orders/:id/status', (c) => {
  const id = c.url!.split('/').slice(-2, -1)[0]
  const body = JSON.parse(c.data || '{}')
  return orderService.updateStatus(id, body.status)
})

// -------- Prices --------
route('GET', '/prices/strategies', (c) => priceStrategyService.list(params(c) as any))
route('GET', '/prices/strategies/all', () => priceStrategyService.all())
route('POST', '/prices/strategies', (c) => priceStrategyService.create(JSON.parse(c.data || '{}')))
route('PUT', '/prices/strategies/:id', (c) => {
  const id = Number(c.url!.split('/').pop())
  return priceStrategyService.update(id, JSON.parse(c.data || '{}'))
})
route('DELETE', '/prices/strategies/:id', (c) => {
  const id = Number(c.url!.split('/').pop())
  return priceStrategyService.remove(id)
})

// -------- Finance --------
route('GET', '/finance/payments', (c) => financeService.listPayments(params(c) as any))
route('GET', '/finance/credit/:id', (c) => financeService.getCredit(Number(c.url!.split('/').pop())))
route('GET', '/finance/statements/:id', (c) => {
  const id = Number(c.url!.split('/').slice(-2, -1)[0])
  const p = params(c)
  return financeService.getStatement(
    id,
    p.period_start || dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    p.period_end || dayjs().format('YYYY-MM-DD'),
  )
})
route('GET', '/finance/commissions', (c) => financeService.listCommissions(params(c) as any))
route('POST', '/finance/commissions/settle', (c) => {
  const body = JSON.parse(c.data || '{}')
  return financeService.settleCommissions(body.ids || [])
})

// -------- Dashboard --------
route('GET', '/dashboard/kpi', (c) => {
  const p = params(c)
  return dashboardService.kpi(p.period_start || dayjs().subtract(30, 'day').format('YYYY-MM-DD'), p.period_end || dayjs().format('YYYY-MM-DD'))
})
route('GET', '/dashboard/products/top', (c) => {
  const p = params(c)
  return dashboardService.topProducts(
    p.period_start || dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    p.period_end || dayjs().format('YYYY-MM-DD'),
    Number(p.limit || 10),
  )
})
route('GET', '/dashboard/customers/top', (c) => {
  const p = params(c)
  return dashboardService.topCustomers(
    p.period_start || dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    p.period_end || dayjs().format('YYYY-MM-DD'),
    Number(p.limit || 10),
  )
})
route('GET', '/dashboard/sales/trend', (c) => {
  const p = params(c)
  return dashboardService.salesTrend(
    p.period_start || dayjs().subtract(14, 'day').format('YYYY-MM-DD'),
    p.period_end || dayjs().format('YYYY-MM-DD'),
  )
})
route('GET', '/dashboard/alerts', () => dashboardService.alerts())

// -------- Categories (4-level tree) --------
route('GET', '/categories/tree', () => categoryService.tree())
route('GET', '/regions/tree', () => regionTree)
route('GET', '/categories', (c) => categoryService.list(params(c).parent_id ? Number(params(c).parent_id) : undefined))
route('POST', '/categories', (c) => categoryService.create(JSON.parse(c.data || '{}')))
route('PUT', '/categories/:id', (c) => categoryService.update(Number(extractId(c)), JSON.parse(c.data || '{}')))
route('DELETE', '/categories/:id', (c) => categoryService.remove(Number(extractId(c))))

// -------- Customer Levels --------
route('GET', '/customer-levels', () => levelService.list())
route('POST', '/customer-levels', (c) => levelService.create(JSON.parse(c.data || '{}')))
route('GET', '/customer-levels/:id/price-preview', (c) => {
  const id = Number((c.url || '').split('?')[0].split('/').slice(-2, -1)[0])
  return levelService.preview(id, params(c).suggested_price || '0')
})
route('GET', '/customer-levels/:id', (c) => levelService.get(Number(extractId(c))))
route('PUT', '/customer-levels/:id', (c) => levelService.update(Number(extractId(c)), JSON.parse(c.data || '{}')))
route('DELETE', '/customer-levels/:id', (c) => levelService.remove(Number(extractId(c))))

// -------- SPU/SKU --------
route('GET', '/spus', (c) => spuService.list({ keyword: params(c).keyword, category_id: params(c).category_id ? Number(params(c).category_id) : undefined }))
route('GET', '/spus/:id', (c) => spuService.get(Number(extractId(c))))
route('POST', '/spus', (c) => spuService.create(JSON.parse(c.data || '{}')))
route('PUT', '/spus/:id', (c) => spuService.update(Number(extractId(c)), JSON.parse(c.data || '{}')))
route('DELETE', '/spus/:id', (c) => spuService.remove(Number(extractId(c))))
route('GET', '/spus/:id/skus', (c) => spuService.listSKUs(Number((c.url!.split('/').filter(Boolean))[2])))
route('POST', '/spus/:id/skus', (c) => {
  const spuId = Number((c.url!.split('/').filter(Boolean))[2])
  return spuService.createSKU(spuId, JSON.parse(c.data || '{}'))
})
route('POST', '/spus/:id/skus/generate', (c) => {
  const spuId = Number((c.url!.split('/').filter(Boolean))[2])
  return spuService.generateSKUs(spuId, JSON.parse(c.data || '{}'))
})
route('GET', '/skus', (c) => spuService.listSkus(params(c) as any))
route('PUT', '/skus/:id', (c) => spuService.updateSKU(Number(extractId(c)), JSON.parse(c.data || '{}')))
route('DELETE', '/skus/:id', (c) => spuService.deleteSKU(Number(extractId(c))))

// -------- Upload --------
route('POST', '/upload/image', () => ({ url: `/uploads/mock-${Date.now()}.png` }))

// -------- Audit Logs --------
route('GET', '/audit-logs', (c) => auditLogService.list({ target_type: params(c).target_type, action: params(c).action, limit: params(c).limit ? Number(params(c).limit) : undefined }))

// -------- System Roles & Features --------
route('GET', '/system/roles', () => roleService.list())
route('POST', '/system/roles', (c) => roleService.create(JSON.parse(c.data || '{}')))
route('PUT', '/system/roles/:id', (c) => roleService.update(Number(extractId(c)), JSON.parse(c.data || '{}')))
route('DELETE', '/system/roles/:id', (c) => roleService.remove(Number(extractId(c))))
route('PUT', '/system/roles/:id/permissions', (c) => {
  const id = Number(c.url!.split('/').slice(-2, -1)[0])
  const body = JSON.parse(c.data || '{}')
  return roleService.setFeatures(id, body.feature_ids || [])
})
route('GET', '/system/features/tree', () => featureService.tree())
route('POST', '/system/features', (c) => featureService.create(JSON.parse(c.data || '{}')))
route('PUT', '/system/features/:id', (c) => featureService.update(Number(extractId(c)), JSON.parse(c.data || '{}')))
route('DELETE', '/system/features/:id', (c) => featureService.remove(Number(extractId(c))))
route('GET', '/system/accounts', (c) => accountService.list(params(c).keyword))
route('POST', '/system/accounts', (c) => accountService.create(JSON.parse(c.data || '{}')))
route('GET', '/system/accounts/:id', (c) => accountService.get(Number(extractId(c))))
route('PUT', '/system/accounts/:id', (c) => accountService.update(Number(extractId(c)), JSON.parse(c.data || '{}')))
route('PUT', '/system/accounts/:id/password', (c) => {
  const id = Number(c.url!.split('/').slice(-2, -1)[0])
  const body = JSON.parse(c.data || '{}')
  return accountService.updatePassword(id, body.new_password)
})
route('DELETE', '/system/accounts/:id', (c) => accountService.remove(Number(extractId(c))))

// -------- Warehouses / Logistics --------
route('GET', '/warehouses', () => warehouseService.list())
route('POST', '/warehouses', (c) => warehouseService.create(JSON.parse(c.data || '{}')))
route('PUT', '/warehouses/:id', (c) => warehouseService.update(Number(extractId(c)), JSON.parse(c.data || '{}')))
route('DELETE', '/warehouses/:id', (c) => warehouseService.remove(Number(extractId(c))))
route('GET', '/warehouse-zones', () => warehouseService.listZones())
route('POST', '/warehouse-zones', (c) => warehouseService.createZone(JSON.parse(c.data || '{}')))
route('PUT', '/warehouse-zones/:id', (c) => warehouseService.updateZone(Number(extractId(c)), JSON.parse(c.data || '{}')))
route('DELETE', '/warehouse-zones/:id', (c) => warehouseService.removeZone(Number(extractId(c))))

// -------- Price Center: Level Prices --------
route('GET', '/level-prices', (c) => {
  const p = params(c)
  return levelPriceService.list({
    level_id: p.level_id ? Number(p.level_id) : undefined,
    sku_id: p.sku_id ? Number(p.sku_id) : undefined,
  })
})
route('GET', '/level-prices/:id/preview', (c) => {
  const p = params(c)
  return levelPriceService.preview(Number(c.url!.split('/').slice(-2, -1)[0]), {
    sku_id: p.sku_id ? Number(p.sku_id) : undefined,
    suggested_price: p.suggested_price,
  })
})
route('PUT', '/level-prices/:id', (c) => levelPriceService.upsert(Number(extractId(c)), JSON.parse(c.data || '{}')))
route('DELETE', '/level-prices/:id', (c) => {
  const skuId = params(c).sku_id
  return levelPriceService.remove(Number(extractId(c)), skuId ? Number(skuId) : undefined)
})
route('GET', '/level-prices/:id', (c) => levelPriceService.getDefault(Number(extractId(c))))

// -------- Price Center: Customer SKU Prices --------
route('GET', '/customer-sku-prices', (c) => {
  const p = params(c)
  return customerSkuPriceService.list({
    customer_id: p.customer_id ? Number(p.customer_id) : undefined,
    sku_id: p.sku_id ? Number(p.sku_id) : undefined,
  })
})
route('GET', '/customer-sku-prices/:c/:s/preview', (c) => {
  const segs = (c.url || '').split('/').filter(Boolean)
  return customerSkuPriceService.preview(Number(segs[segs.length - 3]), Number(segs[segs.length - 2]))
})
route('PUT', '/customer-sku-prices/:c/:s', (c) => {
  const segs = (c.url || '').split('/').filter(Boolean)
  return customerSkuPriceService.upsert(Number(segs[segs.length - 2]), Number(segs[segs.length - 1]), JSON.parse(c.data || '{}'))
})
route('DELETE', '/customer-sku-prices/:c/:s', (c) => {
  const segs = (c.url || '').split('/').filter(Boolean)
  return customerSkuPriceService.remove(Number(segs[segs.length - 2]), Number(segs[segs.length - 1]))
})

// -------- Price Center: Price Books --------
route('GET', '/price-books', (c) => {
  const p = params(c)
  return priceBookService.list({
    keyword: p.keyword,
    page: p.page ? Number(p.page) : undefined,
    page_size: p.page_size ? Number(p.page_size) : undefined,
  })
})
route('POST', '/price-books', (c) => priceBookService.create(JSON.parse(c.data || '{}')))
route('GET', '/price-books/:id', (c) => priceBookService.get(Number(extractId(c))))
route('PUT', '/price-books/:id', (c) => priceBookService.update(Number(extractId(c)), JSON.parse(c.data || '{}')))
route('DELETE', '/price-books/:id', (c) => priceBookService.remove(Number(extractId(c))))
route('GET', '/price-book-items', (c) => {
  const p = params(c)
  return priceBookService.listItems({
    keyword: p.keyword,
    page: p.page ? Number(p.page) : undefined,
    page_size: p.page_size ? Number(p.page_size) : undefined,
  })
})
route('POST', '/price-book-items', (c) => priceBookService.createItem(JSON.parse(c.data || '{}')))
route('PUT', '/price-book-items/:id', (c) => priceBookService.updateItem(Number(extractId(c)), JSON.parse(c.data || '{}')))
route('DELETE', '/price-book-items/:id', (c) => priceBookService.removeItem(Number(extractId(c))))

// -------- Adapter --------
export const mockAdapter: AxiosAdapter = (config) => {
  const method = (config.method || 'GET').toUpperCase()
  const rawUrl = (config.url || '').split('?')[0]
  for (const r of routes) {
    if (r.method === method && r.pattern.test(rawUrl)) {
      try {
        const result = r.handler(config)
        return Promise.resolve(buildResponse(config, result))
      } catch (e: any) {
        if (e && e.response) return Promise.reject(e)
        return Promise.reject(makeError(config, e?.response?.status ?? 500, e?.message || 'Server Error'))
      }
    }
  }
  return Promise.reject(makeError(config, 404, `Mock route not found: ${method} ${rawUrl}`))
}
