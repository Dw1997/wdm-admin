// src/api/mock/services2.ts - Services for Category, Level, SPU/SKU, AuditLog.
import dayjs from 'dayjs'
import {
  categories, levels, levelPriceRules, spus, skus, auditLogs, roles, features, accounts, adminCustomers, warehouses, warehouseZones, counters2, findCategory,
} from './db2'
import type {
  Category,
  LevelConfig,
  LevelCreatePayload,
  LevelUpdatePayload,
  LevelPricePreview,
  ProductSPU,
  ProductSKU,
  SkuAttribute,
  AuditLog,
  RoleConfig,
  FeatureNode,
  SystemAccount,
  AccountCreatePayload,
  AccountUpdatePayload,
  AdminCustomer,
  CustomerRegisterPayload,
  CustomerUpdatePayload,
  Warehouse,
  WarehouseCreatePayload,
  WarehouseUpdatePayload,
  WarehouseZone,
  WarehouseZoneCreatePayload,
  WarehouseZoneUpdatePayload,
} from '@/types'

const delay = (ms = 200) => new Promise<void>((r) => setTimeout(r, ms))

/** Cartesian product of attribute values: 颜色×重量 -> [{颜色,x,重量,y}, ...]. */
function cartesian(attrs: SkuAttribute[]): Record<string, string>[] {
  if (!attrs.length) return [{}]
  return attrs.reduce((acc: Record<string, string>[], a) => {
    const next: Record<string, string>[] = []
    for (const combo of acc) {
      for (const value of a.values) next.push({ ...combo, [a.name]: value })
    }
    return next
  }, [{}])
}

// ===========================================================================
// Category Service
// ===========================================================================
export const categoryService = {
  async tree(): Promise<Category[]> {
    await delay()
    return JSON.parse(JSON.stringify(categories))
  },
  async list(parentId?: number): Promise<Category[]> {
    await delay()
    if (parentId === undefined) {
      // Flatten all
      const flat: Category[] = []
      const walk = (nodes: Category[]) => {
        for (const n of nodes) {
          flat.push({ ...n, children: undefined })
          if (n.children) walk(n.children)
        }
      }
      walk(categories)
      return flat
    }
    const parent = findCategory(parentId)
    return parent?.children || []
  },
  async create(payload: { name: string; parent_id: number | null; sort_order: number; icon?: string; description?: string; is_active: boolean }): Promise<Category> {
    await delay()
    let level = 1
    let parentChildren: Category[] = categories
    if (payload.parent_id) {
      const parent = findCategory(payload.parent_id)
      if (!parent) throw new Error('父分类不存在')
      level = parent.level + 1
      parent.children = parent.children || []
      parentChildren = parent.children
    }
    const newCat: Category = {
      id: counters2.category++,
      name: payload.name,
      parent_id: payload.parent_id,
      level,
      sort_order: payload.sort_order,
      icon: payload.icon,
      description: payload.description,
      is_active: payload.is_active,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      children: [],
    }
    parentChildren.push(newCat)
    return JSON.parse(JSON.stringify(newCat))
  },
  async update(id: number, payload: Partial<Category>): Promise<Category> {
    await delay()
    const cat = findCategory(id)
    if (!cat) throw new Error('分类不存在')
    Object.assign(cat, payload)
    return JSON.parse(JSON.stringify(cat))
  },
  async remove(id: number): Promise<void> {
    await delay()
    // Remove from parent's children
    const _remove = (nodes: Category[]): boolean => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === id) {
          nodes.splice(i, 1)
          return true
        }
        if (nodes[i].children && _remove(nodes[i].children!)) return true
      }
      return false
    }
    _remove(categories)
  },
}

// ===========================================================================
// Level Service
// ===========================================================================
export const levelService = {
  async list(): Promise<LevelConfig[]> {
    await delay()
    return [...levels]
  },
  async get(id: number): Promise<LevelConfig> {
    await delay()
    const level = levels.find((l) => l.id === id)
    if (!level) throw new Error('等级不存在')
    return level
  },
  async create(payload: LevelCreatePayload): Promise<LevelConfig> {
    await delay()
    const newLevel: LevelConfig = {
      id: counters2.level++,
      level_id: payload.level_id,
      nickname: payload.nickname,
      type: payload.type,
      is_system: true,
      created_by: null,
      description: payload.description || '',
      is_active: payload.is_active ?? true,
      customer_count: 0,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }
    levels.push(newLevel)
    return newLevel
  },
  async update(id: number, payload: LevelUpdatePayload): Promise<LevelConfig> {
    await delay()
    const idx = levels.findIndex((l) => l.id === id)
    if (idx < 0) throw new Error('等级不存在')
    levels[idx] = {
      ...levels[idx],
      ...payload,
      description: payload.description === undefined
        ? levels[idx].description
        : payload.description ?? undefined,
    }
    return levels[idx]
  },
  async remove(id: number): Promise<void> {
    await delay()
    const idx = levels.findIndex((l) => l.id === id)
    if (idx >= 0) levels.splice(idx, 1)
  },
  async preview(id: number, suggestedPrice: number | string): Promise<LevelPricePreview> {
    await delay()
    const level = levels.find((l) => l.id === id)
    if (!level) throw new Error('等级不存在')
    const suggested = Number(suggestedPrice)
    const rule = levelPriceRules[level.id] || { price_adjustment_type: 'percent' as const, price_adjustment: 0 }
    const adjustment = Number(rule.price_adjustment)
    const raw = rule.price_adjustment_type === 'amount'
      ? suggested + adjustment
      : suggested * (1 + adjustment / 100)
    const levelPrice = Math.max(raw, 0)
    return {
      level_id: level.id,
      nickname: level.nickname,
      price_adjustment_type: rule.price_adjustment_type,
      price_adjustment: String(rule.price_adjustment),
      suggested_price: suggested.toFixed(2),
      level_price: levelPrice.toFixed(2),
    }
  },
}

// ===========================================================================
// SPU/SKU Service
// ===========================================================================
export const spuService = {
  async list(q: { keyword?: string; category_id?: number } = {}): Promise<ProductSPU[]> {
    await delay()
    let result = [...spus]
    if (q.keyword) {
      const k = q.keyword.toLowerCase()
      result = result.filter((s) => s.name.toLowerCase().includes(k) || s.code.toLowerCase().includes(k))
    }
    if (q.category_id) {
      result = result.filter((s) => s.category_id === q.category_id)
    }
    return result
  },
  async get(id: number): Promise<ProductSPU | null> {
    await delay(50)
    return spus.find((s) => s.id === id) ?? null
  },
  async create(payload: any): Promise<ProductSPU> {
    await delay()
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const newSpu: ProductSPU = {
      ...payload,
      id: counters2.spu++,
      status: payload.status ?? 1,
      is_miniprogram: !!payload.is_miniprogram,
      created_at: now,
      updated_at: now,
    }
    spus.unshift(newSpu)
    return newSpu
  },
  async update(id: number, payload: any): Promise<ProductSPU> {
    await delay()
    const idx = spus.findIndex((s) => s.id === id)
    if (idx < 0) throw new Error('商品不存在')
    spus[idx] = { ...spus[idx], ...payload }
    return spus[idx]
  },
  async remove(id: number): Promise<void> {
    await delay()
    const idx = spus.findIndex((s) => s.id === id)
    if (idx >= 0) spus.splice(idx, 1)
  },
  async updateSKU(skuId: number, payload: any): Promise<ProductSKU> {
    await delay(50)
    const idx = skus.findIndex((s) => s.id === skuId)
    if (idx < 0) throw new Error('SKU不存在')
    skus[idx] = { ...skus[idx], ...payload, updated_at: dayjs().format('YYYY-MM-DD HH:mm:ss') }
    return skus[idx]
  },
  async listSKUs(spuId: number): Promise<ProductSKU[]> {
    await delay(50)
    return skus.filter((s) => s.spu_id === spuId)
  },
  async listSkus(q: { page?: number; page_size?: number } = {}): Promise<ProductSKU[]> {
    await delay()
    const page = Math.max(Number(q.page || 1), 1)
    const pageSize = Math.min(Math.max(Number(q.page_size || 100), 1), 100)
    return skus.slice((page - 1) * pageSize, page * pageSize)
  },
  async createSKU(spuId: number, payload: any): Promise<ProductSKU> {
    await delay(50)
    const sku: ProductSKU = {
      id: counters2.sku++,
      spu_id: spuId,
      cost_price: Number(payload.cost_price) || 0,
      price_method: payload.price_method || 'percent',
      price_value: Number(payload.price_value) || 0,
      barcode: payload.barcode ?? null,
      specs: payload.specs || {},
      remark: payload.remark ?? null,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      updated_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }
    skus.push(sku)
    return sku
  },
  async deleteSKU(skuId: number): Promise<void> {
    await delay(50)
    const idx = skus.findIndex((s) => s.id === skuId)
    if (idx >= 0) skus.splice(idx, 1)
  },
  async generateSKUs(spuId: number, payload: { attributes?: SkuAttribute[]; overwrite?: boolean }): Promise<ProductSKU[]> {
    await delay(100)
    if (!spus.some((s) => s.id === spuId)) throw new Error('商品不存在')
    const attrs = (payload.attributes || []).filter((a) => a.name?.trim() && a.values?.length)
    const specsList = cartesian(attrs)
    if (payload.overwrite !== false) {
      for (let i = skus.length - 1; i >= 0; i--) {
        if (skus[i].spu_id === spuId) skus.splice(i, 1)
      }
    }
    for (const specs of specsList) {
      skus.push({
        id: counters2.sku++,
        spu_id: spuId,
        cost_price: 0,
        price_method: 'percent',
        price_value: 0,
        specs,
        created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        updated_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      })
    }
    return skus.filter((s) => s.spu_id === spuId)
  },
}

// ===========================================================================
// Audit Log Service
// ===========================================================================
export const auditLogService = {
  async list(q: { target_type?: string; action?: string; limit?: number } = {}): Promise<AuditLog[]> {
    await delay()
    let result = [...auditLogs].sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf())
    if (q.target_type) result = result.filter((l) => l.target_type === q.target_type)
    if (q.action) result = result.filter((l) => l.action === q.action)
    return result.slice(0, q.limit || 100)
  },
}

// ===========================================================================
// Role Service
// ===========================================================================
export const roleService = {
  async list(): Promise<RoleConfig[]> {
    await delay()
    return JSON.parse(JSON.stringify(roles))
  },
  async create(payload: Omit<RoleConfig, 'id' | 'created_at' | 'updated_at' | 'is_system'>): Promise<RoleConfig> {
    await delay()
    const newRole: RoleConfig = {
      ...payload,
      id: counters2.role++,
      is_system: false,
      platform: payload.platform || 'web',
      feature_ids: payload.feature_ids || [],
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }
    roles.push(newRole)
    return JSON.parse(JSON.stringify(newRole))
  },
  async update(id: number, payload: Partial<RoleConfig>): Promise<RoleConfig> {
    await delay()
    const idx = roles.findIndex((r) => r.id === id)
    if (idx < 0) throw new Error('角色不存在')
    roles[idx] = { ...roles[idx], ...payload }
    return JSON.parse(JSON.stringify(roles[idx]))
  },
  async remove(id: number): Promise<void> {
    await delay()
    const idx = roles.findIndex((r) => r.id === id)
    if (idx < 0) return
    if (roles[idx].is_system) throw new Error('内置角色不可删除')
    roles.splice(idx, 1)
  },
  async setFeatures(id: number, featureIds: number[]): Promise<RoleConfig> {
    await delay()
    const idx = roles.findIndex((r) => r.id === id)
    if (idx < 0) throw new Error('角色不存在')
    roles[idx].feature_ids = featureIds
    return JSON.parse(JSON.stringify(roles[idx]))
  },
}

// ===========================================================================
// Account Service
// ===========================================================================
export const accountService = {
  async list(keyword?: string): Promise<SystemAccount[]> {
    await delay()
    let result = [...accounts]
    if (keyword) {
      const k = keyword.toLowerCase()
      result = result.filter((a) => a.username.toLowerCase().includes(k) || (a.real_name || '').toLowerCase().includes(k))
    }
    return JSON.parse(JSON.stringify(result))
  },
  async get(id: number): Promise<SystemAccount | null> {
    await delay(50)
    const account = accounts.find((a) => a.id === id)
    return account ? JSON.parse(JSON.stringify(account)) : null
  },
  async create(payload: AccountCreatePayload): Promise<SystemAccount> {
    await delay()
    const role = roles.find((r) => r.id === payload.role_id)
    if (!role) throw new Error('角色不存在')
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const account: SystemAccount = {
      id: counters2.account++,
      username: payload.username,
      real_name: payload.real_name,
      role_id: role.id,
      role_code: role.code,
      role_name: role.name,
      platform: role.platform,
      is_active: payload.is_active,
      last_login_at: null,
      created_at: now,
      updated_at: now,
    }
    accounts.unshift(account)
    return JSON.parse(JSON.stringify(account))
  },
  async update(id: number, payload: AccountUpdatePayload): Promise<SystemAccount> {
    await delay()
    const idx = accounts.findIndex((a) => a.id === id)
    if (idx < 0) throw new Error('账户不存在')
    if (payload.role_id !== undefined && payload.role_id !== null) {
      const role = roles.find((r) => r.id === payload.role_id)
      if (!role) throw new Error('角色不存在')
      accounts[idx].role_id = role.id
      accounts[idx].role_code = role.code
      accounts[idx].role_name = role.name
      accounts[idx].platform = role.platform
    }
    if (payload.real_name !== undefined) accounts[idx].real_name = payload.real_name
    if (payload.is_active !== undefined && payload.is_active !== null) accounts[idx].is_active = payload.is_active
    accounts[idx].updated_at = dayjs().format('YYYY-MM-DD HH:mm:ss')
    return JSON.parse(JSON.stringify(accounts[idx]))
  },
  async remove(id: number): Promise<void> {
    await delay()
    const idx = accounts.findIndex((a) => a.id === id)
    if (idx >= 0) accounts.splice(idx, 1)
  },
  async updatePassword(id: number, newPassword: string): Promise<void> {
    await delay(50)
    if (!accounts.some((a) => a.id === id)) throw new Error('账户不存在')
  },
}

// ===========================================================================
// Admin Customer Service
// ===========================================================================
export const adminCustomerService = {
  async list(q: { keyword?: string; status?: string; page?: number; page_size?: number } = {}): Promise<AdminCustomer[]> {
    await delay()
    let result = [...adminCustomers]
    if (q.keyword) {
      const k = q.keyword.toLowerCase()
      result = result.filter((c) => c.name.toLowerCase().includes(k) || c.phone.includes(k) || (c.contact_name || '').toLowerCase().includes(k))
    }
    if (q.status) result = result.filter((c) => c.status === q.status)
    const page = Math.max(Number(q.page || 1), 1)
    const pageSize = Math.min(Math.max(Number(q.page_size || 20), 1), 100)
    return JSON.parse(JSON.stringify(result.slice((page - 1) * pageSize, page * pageSize)))
  },
  async get(id: number): Promise<AdminCustomer | null> {
    await delay(50)
    const customer = adminCustomers.find((c) => c.id === id)
    return customer ? JSON.parse(JSON.stringify(customer)) : null
  },
  async register(payload: CustomerRegisterPayload): Promise<AdminCustomer> {
    await delay()
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const customer: AdminCustomer = {
      id: counters2.adminCustomer++,
      name: payload.name,
      phone: payload.phone,
      contact_name: payload.name,
      contact_phone: payload.phone,
      unionid: payload.unionid,
      openid: payload.openid,
      channel_type: 'sales',
      credit_limit: 0,
      status: 'pending',
      invite_code: payload.invite_code,
      address: payload.address,
      province: payload.province,
      city: payload.city,
      district: payload.district,
      town: payload.town,
      detail_address: payload.detail_address,
      created_at: now,
      updated_at: now,
    }
    adminCustomers.unshift(customer)
    return JSON.parse(JSON.stringify(customer))
  },
  async update(id: number, payload: CustomerUpdatePayload): Promise<AdminCustomer> {
    await delay()
    const idx = adminCustomers.findIndex((c) => c.id === id)
    if (idx < 0) throw new Error('客户不存在')
    adminCustomers[idx] = { ...adminCustomers[idx], ...payload, updated_at: dayjs().format('YYYY-MM-DD HH:mm:ss') }
    return JSON.parse(JSON.stringify(adminCustomers[idx]))
  },
  async remove(id: number): Promise<void> {
    await delay()
    const idx = adminCustomers.findIndex((c) => c.id === id)
    if (idx >= 0) adminCustomers.splice(idx, 1)
  },
  async assignLevel(id: number, levelId: number): Promise<AdminCustomer> {
    await delay()
    const idx = adminCustomers.findIndex((c) => c.id === id)
    if (idx < 0) throw new Error('客户不存在')
    const level = levels.find((l) => l.id === levelId)
    if (!level) throw new Error('客户等级不存在')
    adminCustomers[idx].level_id = level.id
    adminCustomers[idx].level_code = level.level_id
    adminCustomers[idx].level_nickname = level.nickname
    adminCustomers[idx].updated_at = dayjs().format('YYYY-MM-DD HH:mm:ss')
    return JSON.parse(JSON.stringify(adminCustomers[idx]))
  },
}

// ===========================================================================
// Warehouse / Logistics Service
// ===========================================================================
export const warehouseService = {
  async list(): Promise<Warehouse[]> {
    await delay()
    return JSON.parse(JSON.stringify(warehouses))
  },
  async create(payload: WarehouseCreatePayload): Promise<Warehouse> {
    await delay()
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const item: Warehouse = { id: counters2.warehouse++, ...payload, created_at: now, updated_at: now }
    warehouses.push(item)
    return JSON.parse(JSON.stringify(item))
  },
  async update(id: number, payload: WarehouseUpdatePayload): Promise<Warehouse> {
    await delay()
    const idx = warehouses.findIndex((w) => w.id === id)
    if (idx < 0) throw new Error('仓库不存在')
    warehouses[idx] = { ...warehouses[idx], ...payload, updated_at: dayjs().format('YYYY-MM-DD HH:mm:ss') }
    return JSON.parse(JSON.stringify(warehouses[idx]))
  },
  async remove(id: number): Promise<void> {
    await delay()
    const idx = warehouses.findIndex((w) => w.id === id)
    if (idx >= 0) warehouses.splice(idx, 1)
  },
  async listZones(): Promise<WarehouseZone[]> {
    await delay()
    return JSON.parse(JSON.stringify(warehouseZones))
  },
  async createZone(payload: WarehouseZoneCreatePayload): Promise<WarehouseZone> {
    await delay()
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const item: WarehouseZone = { id: counters2.warehouseZone++, ...payload, created_at: now, updated_at: now }
    warehouseZones.push(item)
    return JSON.parse(JSON.stringify(item))
  },
  async updateZone(id: number, payload: WarehouseZoneUpdatePayload): Promise<WarehouseZone> {
    await delay()
    const idx = warehouseZones.findIndex((z) => z.id === id)
    if (idx < 0) throw new Error('库区不存在')
    warehouseZones[idx] = { ...warehouseZones[idx], ...payload, updated_at: dayjs().format('YYYY-MM-DD HH:mm:ss') }
    return JSON.parse(JSON.stringify(warehouseZones[idx]))
  },
  async removeZone(id: number): Promise<void> {
    await delay()
    const idx = warehouseZones.findIndex((z) => z.id === id)
    if (idx >= 0) warehouseZones.splice(idx, 1)
  },
}

// ===========================================================================
// Feature Service
// ===========================================================================
function findFeature(id: number): FeatureNode | undefined {
  const walk = (nodes: FeatureNode[]): FeatureNode | undefined => {
    for (const n of nodes) {
      if (n.id === id) return n
      const found = n.children ? walk(n.children) : undefined
      if (found) return found
    }
    return undefined
  }
  return walk(features)
}

export const featureService = {
  async tree(): Promise<FeatureNode[]> {
    await delay()
    return JSON.parse(JSON.stringify(features))
  },
  async create(payload: Omit<FeatureNode, 'id' | 'created_at' | 'updated_at' | 'children'>): Promise<FeatureNode> {
    await delay()
    let parentChildren: FeatureNode[] = features
    if (payload.parent_id) {
      const parent = findFeature(payload.parent_id)
      if (!parent) throw new Error('父功能不存在')
      parent.children = parent.children || []
      parentChildren = parent.children
    }
    const node: FeatureNode = {
      ...payload,
      id: counters2.feature++,
      children: [],
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }
    parentChildren.push(node)
    return JSON.parse(JSON.stringify(node))
  },
  async update(id: number, payload: Partial<FeatureNode>): Promise<FeatureNode> {
    await delay()
    const node = findFeature(id)
    if (!node) throw new Error('功能不存在')
    Object.assign(node, payload)
    return JSON.parse(JSON.stringify(node))
  },
  async remove(id: number): Promise<void> {
    await delay()
    const node = findFeature(id)
    if (!node) throw new Error('功能不存在')
    if (node.children && node.children.length) throw new Error('请先删除子权限点')
    const removeNode = (nodes: FeatureNode[]): boolean => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === id) {
          nodes.splice(i, 1)
          return true
        }
        if (nodes[i].children && removeNode(nodes[i].children!)) return true
      }
      return false
    }
    removeNode(features)
  },
}
