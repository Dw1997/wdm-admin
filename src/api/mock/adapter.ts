// src/api/mock/adapter.ts - Axios mock adapter that routes to in-memory services.
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import dayjs from 'dayjs'
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
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Created',
    headers: {},
    config,
  } as AxiosResponse<T>
}

function makeError(config: InternalAxiosRequestConfig, status: number, message: string) {
  const err: any = new Error(message)
  err.config = config
  err.response = { status, data: { detail: message }, headers: {}, statusText: message, config }
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
route('GET', '/customers', (c) => customerService.list(params(c) as any))
route('POST', '/customers', (c) => customerService.create(JSON.parse(c.data || '{}')))
route('GET', '/customers/:id', (c) => customerService.get(Number(c.url!.split('/').pop())))
route('PUT', '/customers/:id', (c) => {
  const id = Number(c.url!.split('/').slice(-2, -1)[0])
  return customerService.update(id, JSON.parse(c.data || '{}'))
})
route('POST', '/customers/:id/audit', (c) => {
  const id = Number(c.url!.split('/').slice(-2, -1)[0])
  const body = JSON.parse(c.data || '{}')
  return customerService.audit(id, body.approved, body.sales_id)
})
route('DELETE', '/customers/:id', (c) => {
  const id = Number(c.url!.split('/').pop())
  return customerService.remove(id)
})

// -------- Sales --------
route('GET', '/sales', (c) => salesService.list(params(c) as any))
route('GET', '/sales/all', () => salesService.all())
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
route('GET', '/categories', (c) => categoryService.list(params(c).parent_id ? Number(params(c).parent_id) : undefined))
route('POST', '/categories', (c) => categoryService.create(JSON.parse(c.data || '{}')))
route('PUT', '/categories/:id', (c) => categoryService.update(Number(extractId(c)), JSON.parse(c.data || '{}')))
route('DELETE', '/categories/:id', (c) => categoryService.remove(Number(extractId(c))))

// -------- Customer Levels --------
route('GET', '/customer-levels', () => levelService.list())
route('POST', '/customer-levels', (c) => levelService.create(JSON.parse(c.data || '{}')))
route('PUT', '/customer-levels/:id', (c) => levelService.update(Number(extractId(c)), JSON.parse(c.data || '{}')))
route('DELETE', '/customer-levels/:id', (c) => levelService.remove(Number(extractId(c))))

// -------- SPU/SKU --------
route('GET', '/products/spus', (c) => spuService.list({ keyword: params(c).keyword, category_id: params(c).category_id ? Number(params(c).category_id) : undefined }))
route('GET', '/products/spus/all', () => spuService.list({}))
route('GET', '/products/spus/:id', (c) => spuService.get(Number(extractId(c))))
route('POST', '/products/spus', (c) => spuService.create(JSON.parse(c.data || '{}')))
route('PUT', '/products/spus/:id', (c) => spuService.update(Number(extractId(c)), JSON.parse(c.data || '{}')))
route('DELETE', '/products/spus/:id', (c) => spuService.remove(Number(extractId(c))))
route('PUT', '/products/skus/:id', (c) => spuService.updateSKU(Number(extractId(c)), JSON.parse(c.data || '{}')))

// -------- Audit Logs --------
route('GET', '/audit-logs', (c) => auditLogService.list({ target_type: params(c).target_type, action: params(c).action, limit: params(c).limit ? Number(params(c).limit) : undefined }))

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
