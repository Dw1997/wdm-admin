// src/api/mock/services.ts - In-memory CRUD services emulating FastAPI backend.
import dayjs from 'dayjs'
import {
  products,
  customers,
  sales,
  orders,
  priceStrategies,
  payments,
  commissions,
  counters,
} from './db'
import type {
  Product,
  ProductSummary,
  PriceResponse,
  Customer,
  Sales,
  SalesPerformance,
  SalesRankingItem,
  Order,
  OrderItem,
  PriceStrategy,
  Payment,
  CreditInfo,
  Statement,
  StatementItem,
  Commission,
  KPIResponse,
  ProductRanking,
  CustomerRanking,
  SalesTrendPoint,
  AlertItem,
  PageQuery,
  PageResult,
} from '@/types'

const delay = (ms = 200) => new Promise<void>((r) => setTimeout(r, ms))

// ===========================================================================
// Auth
// ===========================================================================
export const authService = {
  async login(username: string, password: string) {
    await delay(300)
    if (!username || password.length < 6) {
      const err: any = new Error('用户名或密码错误')
      err.response = { status: 401, data: { detail: '用户名或密码错误' } }
      throw err
    }
    const role = username.startsWith('sales') ? 'sales' : 'admin'
    const userId = role === 'sales' ? 2 : 1
    return {
      access_token: `mock-access-${userId}-${Date.now()}`,
      refresh_token: `mock-refresh-${userId}-${Date.now()}`,
      token_type: 'bearer' as const,
      expires_in: 3600,
    }
  },
  async me() {
    await delay(100)
    return { id: 1, username: 'admin', real_name: '系统管理员', role: 'admin' as const }
  },
  async logout() {
    await delay(50)
    return null
  },
}

// ===========================================================================
// Products
// ===========================================================================
function paginate<T>(items: T[], q: PageQuery): PageResult<T> {
  const page = Number(q.page ?? 1)
  const pageSize = Number(q.page_size ?? 20)
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    page_size: pageSize,
  }
}

export const productService = {
  async list(q: PageQuery = {}): Promise<PageResult<Product>> {
    await delay()
    let result = [...products]
    if (q.keyword) {
      const k = String(q.keyword).toLowerCase()
      result = result.filter(
        (p) => p.name.toLowerCase().includes(k) || p.sku.toLowerCase().includes(k),
      )
    }
    if (q.status) result = result.filter((p) => p.status === q.status)
    if (q.category) result = result.filter((p) => p.category === q.category)
    return paginate(result, q)
  },

  async all(): Promise<Product[]> {
    await delay()
    return [...products]
  },

  async summary(): Promise<ProductSummary[]> {
    await delay()
    return products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, unit: p.base_unit, stock: p.stock }))
  },

  async get(id: number): Promise<Product | null> {
    await delay()
    return products.find((p) => p.id === id) ?? null
  },

  async create(payload: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    await delay()
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const newProduct: Product = {
      ...payload,
      id: counters.product++,
      created_at: now,
      updated_at: now,
    }
    products.unshift(newProduct)
    return newProduct
  },

  async update(id: number, payload: Partial<Product>): Promise<Product> {
    await delay()
    const idx = products.findIndex((p) => p.id === id)
    if (idx < 0) throw new Error('商品不存在')
    products[idx] = { ...products[idx], ...payload, updated_at: dayjs().format('YYYY-MM-DD HH:mm:ss') }
    return products[idx]
  },

  async remove(id: number): Promise<void> {
    await delay()
    const idx = products.findIndex((p) => p.id === id)
    if (idx >= 0) products.splice(idx, 1)
  },

  async getPrice(productId: number, customerId: number, unit = '包'): Promise<PriceResponse> {
    await delay()
    const product = products.find((p) => p.id === productId)
    if (!product) {
      const err: any = new Error('商品不存在')
      err.response = { status: 404 }
      throw err
    }
    // Server-side price resolution: tier > ladder > customer > flash > base.
    const customer = customers.find((c) => c.id === customerId)
    let price = 0
    if (customer) {
      // 1. flash
      const flash = priceStrategies
        .filter((s) => s.type === 'flash' && s.enabled && s.product_id === productId)
        .find((s) => {
          const now = dayjs()
          return (!s.starts_at || now.isAfter(dayjs(s.starts_at))) && (!s.ends_at || now.isBefore(dayjs(s.ends_at)))
        })
      if (flash) price = flash.rules[0].unit_price
      // 2. customer specific
      if (!price) {
        const cs = priceStrategies.find(
          (s) => s.type === 'customer' && s.enabled && s.product_id === productId && s.rules.some((r) => r.customer_id === customerId),
        )
        if (cs) {
          const rule = cs.rules.find((r) => r.customer_id === customerId)!
          price = rule.unit_price
        }
      }
      // 3. tier
      if (!price) {
        const tier = priceStrategies.find(
          (s) => s.type === 'tier' && s.enabled && s.product_id === productId,
        )
        if (tier) {
          const rule = tier.rules.find((r) => r.level === customer.level)
          if (rule) price = rule.unit_price
        }
      }
    }
    if (!price) {
      // base reference
      const ref: Record<string, number> = { 1: 3.5, 2: 2.5, 3: 2.5, 4: 1.5, 5: 13, 6: 3.8, 7: 8, 8: 5 }
      price = ref[productId] ?? 0
    }
    return { product_id: productId, customer_id: customerId, unit, unit_price: Number(price.toFixed(2)), currency: 'CNY' }
  },
}

// ===========================================================================
// Customers
// ===========================================================================
export const customerService = {
  async list(q: PageQuery = {}): Promise<PageResult<Customer>> {
    await delay()
    let result = [...customers]
    if (q.keyword) {
      const k = String(q.keyword).toLowerCase()
      result = result.filter(
        (c) =>
          c.name.includes(k) ||
          c.phone.includes(k) ||
          (c.shop_name && c.shop_name.includes(k)),
      )
    }
    if (q.status) result = result.filter((c) => c.status === q.status)
    if (q.level) result = result.filter((c) => c.level === q.level)
    if (q.sales_id) result = result.filter((c) => c.sales_id === Number(q.sales_id))
    return paginate(result, q)
  },

  async all(): Promise<Customer[]> {
    await delay()
    return [...customers]
  },

  async get(id: number): Promise<Customer | null> {
    await delay()
    return customers.find((c) => c.id === id) ?? null
  },

  async create(payload: Omit<Customer, 'id' | 'registered_at'>): Promise<Customer> {
    await delay()
    const newC: Customer = {
      ...payload,
      id: counters.customer++,
      available_credit: payload.credit_limit - payload.used_credit,
      registered_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }
    customers.unshift(newC)
    return newC
  },

  async update(id: number, payload: Partial<Customer>): Promise<Customer> {
    await delay()
    const idx = customers.findIndex((c) => c.id === id)
    if (idx < 0) throw new Error('客户不存在')
    const merged = { ...customers[idx], ...payload }
    merged.available_credit = merged.credit_limit - merged.used_credit
    customers[idx] = merged
    return customers[idx]
  },

  async audit(id: number, approved: boolean, salesId?: number): Promise<Customer> {
    await delay()
    const idx = customers.findIndex((c) => c.id === id)
    if (idx < 0) throw new Error('客户不存在')
    customers[idx].status = approved ? 'active' : 'disabled'
    if (approved && salesId) {
      const s = sales.find((x) => x.id === salesId)
      if (s) {
        customers[idx].sales_id = s.id
        customers[idx].sales_name = s.name
      }
    }
    return customers[idx]
  },

  async remove(id: number): Promise<void> {
    await delay()
    const idx = customers.findIndex((c) => c.id === id)
    if (idx >= 0) customers.splice(idx, 1)
  },
}

// ===========================================================================
// Sales
// ===========================================================================
export const salesService = {
  async list(q: PageQuery = {}): Promise<PageResult<Sales>> {
    await delay()
    return paginate([...sales], q)
  },
  async all(): Promise<Sales[]> {
    await delay()
    return [...sales]
  },
  async get(id: number): Promise<Sales | null> {
    await delay()
    return sales.find((s) => s.id === id) ?? null
  },
  async create(payload: Omit<Sales, 'id' | 'joined_at' | 'total_customers' | 'active_customers' | 'total_gmv' | 'estimated_commission'>): Promise<Sales> {
    await delay()
    const newS: Sales = {
      ...payload,
      id: counters.sales++,
      total_customers: 0,
      active_customers: 0,
      total_gmv: 0,
      estimated_commission: 0,
      joined_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }
    sales.push(newS)
    return newS
  },
  async update(id: number, payload: Partial<Sales>): Promise<Sales> {
    await delay()
    const idx = sales.findIndex((s) => s.id === id)
    if (idx < 0) throw new Error('销售不存在')
    sales[idx] = { ...sales[idx], ...payload }
    return sales[idx]
  },
  async performance(salesId: number, start: string, end: string): Promise<SalesPerformance> {
    await delay()
    const s = sales.find((x) => x.id === salesId)
    const myOrders = orders.filter((o) => o.sales_id === salesId)
    const filtered = myOrders.filter((o) => {
      const d = dayjs(o.created_at)
      return d.isAfter(dayjs(start).subtract(1, 'day')) && d.isBefore(dayjs(end).add(1, 'day'))
    })
    const gmv = filtered.reduce((sum, o) => sum + o.total_amount, 0)
    const newCustomers = customers.filter(
      (c) => c.sales_id === salesId && dayjs(c.registered_at).isAfter(dayjs(start).subtract(1, 'day')) && dayjs(c.registered_at).isBefore(dayjs(end).add(1, 'day')),
    ).length
    return {
      sales_id: salesId,
      sales_name: s?.name ?? '',
      period_start: start,
      period_end: end,
      order_count: filtered.length,
      gmv,
      estimated_commission: gmv * 0.05,
      new_customers: newCustomers,
    }
  },
  async ranking(start: string, end: string): Promise<SalesRankingItem[]> {
    await delay()
    const inRange = (d: string) => dayjs(d).isAfter(dayjs(start).subtract(1, 'day')) && dayjs(d).isBefore(dayjs(end).add(1, 'day'))
    const rows = sales.map((s) => {
      const myOrders = orders.filter((o) => o.sales_id === s.id && inRange(o.created_at))
      const gmv = myOrders.reduce((sum, o) => sum + o.total_amount, 0)
      const newCustomers = customers.filter(
        (c) => c.sales_id === s.id && inRange(c.registered_at),
      ).length
      return {
        sales_id: s.id,
        sales_name: s.name,
        period_start: start,
        period_end: end,
        order_count: myOrders.length,
        gmv,
        estimated_commission: gmv * 0.05,
        new_customers: newCustomers,
      }
    })
    return rows
      .sort((a, b) => b.gmv - a.gmv)
      .map((r, i) => ({ ...r, ranking: i + 1 }))
  },
}

// ===========================================================================
// Orders
// ===========================================================================
export const orderService = {
  async list(q: PageQuery = {}): Promise<PageResult<Order>> {
    await delay()
    let result = [...orders]
    if (q.keyword) {
      const k = String(q.keyword).toLowerCase()
      result = result.filter(
        (o) => o.id.toLowerCase().includes(k) || o.customer_name.toLowerCase().includes(k),
      )
    }
    if (q.status) result = result.filter((o) => o.status === q.status)
    if (q.customer_id) result = result.filter((o) => o.customer_id === Number(q.customer_id))
    if (q.sales_id) result = result.filter((o) => o.sales_id === Number(q.sales_id))
    if (q.payment_method) result = result.filter((o) => o.payment_method === q.payment_method)
    if (q.start_date && q.end_date) {
      result = result.filter((o) => {
        const d = dayjs(o.created_at)
        return d.isAfter(dayjs(q.start_date as string).subtract(1, 'day')) && d.isBefore(dayjs(q.end_date as string).add(1, 'day'))
      })
    }
    return paginate(
      result.sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()),
      q,
    )
  },
  async get(id: string): Promise<Order | null> {
    await delay()
    return orders.find((o) => o.id === id) ?? null
  },
  async create(payload: {
    customer_id: number
    items: { product_id: number; quantity: number; unit: string }[]
    payment_method: Order['payment_method']
    remark?: string
  }): Promise<Order> {
    await delay()
    const customer = customers.find((c) => c.id === payload.customer_id)
    if (!customer) throw new Error('客户不存在')
    const items: OrderItem[] = []
    for (const it of payload.items) {
      const product = products.find((p) => p.id === it.product_id)
      if (!product) throw new Error(`商品 ${it.product_id} 不存在`)
      const price = await productService.getPrice(it.product_id, customer.id, it.unit)
      items.push({
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        unit: it.unit,
        quantity: it.quantity,
        unit_price: price.unit_price,
        subtotal: Number((price.unit_price * it.quantity).toFixed(2)),
      })
    }
    const total = items.reduce((s, it) => s + it.subtotal, 0)
    const newOrder: Order = {
      id: `ORD${String(counters.order++).padStart(6, '0')}`,
      customer_id: customer.id,
      customer_name: customer.shop_name || customer.name,
      sales_id: customer.sales_id,
      sales_name: customer.sales_name,
      status: 'pending_audit',
      payment_method: payload.payment_method,
      total_amount: total,
      paid_amount: 0,
      items,
      remark: payload.remark,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      delivery_address: customer.address,
    }
    orders.unshift(newOrder)
    return newOrder
  },
  async audit(id: string, approved: boolean, reason?: string): Promise<Order> {
    await delay()
    const idx = orders.findIndex((o) => o.id === id)
    if (idx < 0) throw new Error('订单不存在')
    orders[idx].status = approved ? 'paid' : 'rejected'
    orders[idx].rejection_reason = approved ? undefined : reason
    orders[idx].audited_at = dayjs().format('YYYY-MM-DD HH:mm:ss')
    return orders[idx]
  },
  async updateStatus(id: string, status: Order['status']): Promise<Order> {
    await delay()
    const idx = orders.findIndex((o) => o.id === id)
    if (idx < 0) throw new Error('订单不存在')
    orders[idx].status = status
    if (status === 'shipped') orders[idx].shipped_at = dayjs().format('YYYY-MM-DD HH:mm:ss')
    if (status === 'completed') orders[idx].completed_at = dayjs().format('YYYY-MM-DD HH:mm:ss')
    return orders[idx]
  },
  /** Group all order items across orders (for picking list). */
  async pickingList(q: PageQuery = {}): Promise<{ sku: string; name: string; unit: string; quantity: number; order_ids: string[] }[]> {
    await delay()
    const map = new Map<string, { sku: string; name: string; unit: string; quantity: number; order_ids: Set<string> }>()
    const orderIds = orders
      .filter((o) => ['paid', 'picking'].includes(o.status))
      .filter((o) => !q.start_date || dayjs(o.created_at).isAfter(dayjs(q.start_date as string).subtract(1, 'day')))
    for (const o of orderIds) {
      for (const it of o.items) {
        const key = `${it.sku}-${it.unit}`
        const cur = map.get(key)
        if (cur) {
          cur.quantity += it.quantity
          cur.order_ids.add(o.id)
        } else {
          map.set(key, { sku: it.sku, name: it.product_name, unit: it.unit, quantity: it.quantity, order_ids: new Set([o.id]) })
        }
      }
    }
    return Array.from(map.values()).map((v) => ({ ...v, order_ids: Array.from(v.order_ids) }))
  },
}

// ===========================================================================
// Price strategies
// ===========================================================================
export const priceStrategyService = {
  async list(q: PageQuery = {}): Promise<PageResult<PriceStrategy>> {
    await delay()
    let result = [...priceStrategies]
    if (q.type) result = result.filter((s) => s.type === q.type)
    if (q.product_id) result = result.filter((s) => s.product_id === Number(q.product_id))
    if (q.enabled !== undefined && q.enabled !== '') {
      result = result.filter((s) => s.enabled === (q.enabled === 'true' || q.enabled === true))
    }
    return paginate(result, q)
  },
  async all(): Promise<PriceStrategy[]> {
    await delay()
    return [...priceStrategies]
  },
  async create(payload: Omit<PriceStrategy, 'id' | 'created_at'>): Promise<PriceStrategy> {
    await delay()
    const newS: PriceStrategy = {
      ...payload,
      id: counters.priceStrategy++,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }
    priceStrategies.unshift(newS)
    return newS
  },
  async update(id: number, payload: Partial<PriceStrategy>): Promise<PriceStrategy> {
    await delay()
    const idx = priceStrategies.findIndex((s) => s.id === id)
    if (idx < 0) throw new Error('价格策略不存在')
    priceStrategies[idx] = { ...priceStrategies[idx], ...payload }
    return priceStrategies[idx]
  },
  async remove(id: number): Promise<void> {
    await delay()
    const idx = priceStrategies.findIndex((s) => s.id === id)
    if (idx >= 0) priceStrategies.splice(idx, 1)
  },
}

// ===========================================================================
// Finance
// ===========================================================================
export const financeService = {
  async listPayments(q: PageQuery = {}): Promise<PageResult<Payment>> {
    await delay()
    return paginate([...payments], q)
  },
  async getCredit(customerId: number): Promise<CreditInfo> {
    await delay()
    const c = customers.find((x) => x.id === customerId)
    if (!c) throw new Error('客户不存在')
    return {
      customer_id: customerId,
      credit_limit: c.credit_limit,
      used_credit: c.used_credit,
      available_credit: c.available_credit,
    }
  },
  async getStatement(customerId: number, start: string, end: string): Promise<Statement> {
    await delay()
    const c = customers.find((x) => x.id === customerId)
    if (!c) throw new Error('客户不存在')
    const myOrders = orders.filter(
      (o) => o.customer_id === customerId && dayjs(o.created_at).isAfter(dayjs(start).subtract(1, 'day')) && dayjs(o.created_at).isBefore(dayjs(end).add(1, 'day')),
    )
    const myPayments = payments.filter(
      (p) => p.customer_id === customerId && dayjs(p.created_at).isAfter(dayjs(start).subtract(1, 'day')) && dayjs(p.created_at).isBefore(dayjs(end).add(1, 'day')),
    )
    const items: StatementItem[] = [
      ...myOrders.map((o) => ({ order_id: o.id, occurred_at: o.created_at, amount: o.total_amount, type: 'order' as const, remark: o.remark })),
      ...myPayments.map((p) => ({ order_id: p.order_id, occurred_at: p.created_at, amount: -p.amount, type: 'payment' as const, remark: `收款-${p.method}` })),
    ].sort((a, b) => dayjs(a.occurred_at).valueOf() - dayjs(b.occurred_at).valueOf())
    const totalOrders = myOrders.reduce((s, o) => s + o.total_amount, 0)
    const totalPaid = myPayments.reduce((s, p) => s + p.amount, 0)
    return {
      customer_id: customerId,
      customer_name: c.shop_name || c.name,
      period_start: start,
      period_end: end,
      opening_balance: c.used_credit - totalOrders + totalPaid,
      closing_balance: c.used_credit,
      items,
    }
  },
  async listCommissions(q: PageQuery = {}): Promise<PageResult<Commission>> {
    await delay()
    let result = [...commissions]
    if (q.status) result = result.filter((c) => c.status === q.status)
    if (q.sales_id) result = result.filter((c) => c.sales_id === Number(q.sales_id))
    return paginate(result, q)
  },
  async settleCommissions(ids: number[]): Promise<void> {
    await delay()
    for (const c of commissions) {
      if (ids.includes(c.id) && c.status === 'pending') {
        c.status = 'settled'
        c.settled_at = dayjs().format('YYYY-MM-DD')
      }
    }
  },
}

// ===========================================================================
// Dashboard
// ===========================================================================
export const dashboardService = {
  async kpi(start: string, end: string): Promise<KPIResponse> {
    await delay()
    const periodOrders = orders.filter(
      (o) => dayjs(o.created_at).isAfter(dayjs(start).subtract(1, 'day')) && dayjs(o.created_at).isBefore(dayjs(end).add(1, 'day')),
    )
    const gmv = periodOrders.reduce((s, o) => s + o.total_amount, 0)
    return {
      period_start: start,
      period_end: end,
      gmv,
      order_count: periodOrders.length,
      new_customers: customers.filter(
        (c) => dayjs(c.registered_at).isAfter(dayjs(start).subtract(1, 'day')) && dayjs(c.registered_at).isBefore(dayjs(end).add(1, 'day')),
      ).length,
      active_customers: customers.filter((c) => c.status === 'active').length,
      pending_orders: orders.filter((o) => o.status === 'pending_audit').length,
      low_stock_products: products.filter((p) => p.stock < p.safety_stock).length,
      expiring_batches: products.reduce(
        (s, p) =>
          s +
          p.batches.filter((b) => {
            const days = dayjs(b.expiry_date).diff(dayjs(), 'day')
            return days >= 0 && days <= p.expiry_warning_days
          }).length,
        0,
      ),
    }
  },
  async topProducts(start: string, end: string, limit = 10): Promise<ProductRanking[]> {
    await delay()
    const map = new Map<number, { name: string; qty: number; gmv: number }>()
    for (const o of orders) {
      if (!dayjs(o.created_at).isAfter(dayjs(start).subtract(1, 'day'))) continue
      if (!dayjs(o.created_at).isBefore(dayjs(end).add(1, 'day'))) continue
      for (const it of o.items) {
        const cur = map.get(it.product_id) ?? { name: it.product_name, qty: 0, gmv: 0 }
        cur.qty += it.quantity
        cur.gmv += it.subtotal
        map.set(it.product_id, cur)
      }
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ product_id: id, product_name: v.name, quantity_sold: v.qty, gmv: v.gmv }))
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, limit)
  },
  async topCustomers(start: string, end: string, limit = 10): Promise<CustomerRanking[]> {
    await delay()
    const map = new Map<number, { name: string; gmv: number; count: number }>()
    for (const o of orders) {
      if (!dayjs(o.created_at).isAfter(dayjs(start).subtract(1, 'day'))) continue
      if (!dayjs(o.created_at).isBefore(dayjs(end).add(1, 'day'))) continue
      const cur = map.get(o.customer_id) ?? { name: o.customer_name, gmv: 0, count: 0 }
      cur.gmv += o.total_amount
      cur.count += 1
      map.set(o.customer_id, cur)
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ customer_id: id, customer_name: v.name, gmv: v.gmv, order_count: v.count }))
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, limit)
  },
  async salesTrend(start: string, end: string): Promise<SalesTrendPoint[]> {
    await delay()
    const startD = dayjs(start)
    const endD = dayjs(end)
    const days = endD.diff(startD, 'day') + 1
    const result: SalesTrendPoint[] = []
    for (let i = 0; i < days; i++) {
      const d = startD.add(i, 'day').format('YYYY-MM-DD')
      const dayOrders = orders.filter((o) => dayjs(o.created_at).format('YYYY-MM-DD') === d)
      result.push({
        date: d,
        gmv: dayOrders.reduce((s, o) => s + o.total_amount, 0),
        order_count: dayOrders.length,
      })
    }
    return result
  },
  async alerts(): Promise<AlertItem[]> {
    await delay()
    const list: AlertItem[] = []
    products.forEach((p) => {
      if (p.stock < p.safety_stock) {
        list.push({
          id: list.length + 1,
          type: 'low_stock',
          level: p.stock < p.safety_stock / 2 ? 'danger' : 'warning',
          title: `${p.name} 库存不足`,
          description: `当前库存 ${p.stock}${p.base_unit}，低于安全库存 ${p.safety_stock}${p.base_unit}`,
          created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          link: `/products?id=${p.id}`,
        })
      }
      p.batches.forEach((b) => {
        const days = dayjs(b.expiry_date).diff(dayjs(), 'day')
        if (days >= 0 && days <= p.expiry_warning_days) {
          list.push({
            id: list.length + 1,
            type: 'expiring',
            level: days <= 15 ? 'danger' : 'warning',
            title: `${p.name} 批次 ${b.batch_no} 临期`,
            description: `距离到期还有 ${days} 天 (${b.expiry_date})，库存 ${b.quantity}${p.base_unit}`,
            created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            link: `/products?id=${p.id}`,
          })
        }
      })
    })
    customers
      .filter((c) => c.used_credit > c.credit_limit * 0.8 && c.status === 'active')
      .forEach((c) => {
        list.push({
          id: list.length + 1,
          type: 'overdue_payment',
          level: 'warning',
          title: `${c.shop_name || c.name} 欠款接近上限`,
          description: `已用 ${c.used_credit} / 额度 ${c.credit_limit} (${Math.round((c.used_credit / c.credit_limit) * 100)}%)`,
          created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          link: `/finance/credit?id=${c.id}`,
        })
      })
    return list
  },
}
