// src/api/mock/services2.ts - Services for Category, Level, SPU/SKU, AuditLog.
import dayjs from 'dayjs'
import {
  categories, levels, spus, auditLogs, counters2, findCategory,
} from './db2'
import type { Category, LevelConfig, ProductSPU, AuditLog } from '@/types'

const delay = (ms = 200) => new Promise<void>((r) => setTimeout(r, ms))

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
      if (level > 4) throw new Error('分类最多4级')
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
  async create(payload: Omit<LevelConfig, 'id' | 'created_at'>): Promise<LevelConfig> {
    await delay()
    const newLevel: LevelConfig = {
      ...payload,
      id: counters2.level++,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }
    levels.push(newLevel)
    return newLevel
  },
  async update(id: number, payload: Partial<LevelConfig>): Promise<LevelConfig> {
    await delay()
    const idx = levels.findIndex((l) => l.id === id)
    if (idx < 0) throw new Error('等级不存在')
    levels[idx] = { ...levels[idx], ...payload }
    return levels[idx]
  },
  async remove(id: number): Promise<void> {
    await delay()
    const idx = levels.findIndex((l) => l.id === id)
    if (idx >= 0) levels.splice(idx, 1)
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
      result = result.filter((s) => s.name.toLowerCase().includes(k) || s.spu_code.toLowerCase().includes(k))
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
    const newSpu: ProductSPU = {
      ...payload,
      id: counters2.spu++,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      skus: (payload.skus || []).map((sku: any, i: number) => ({
        ...sku,
        id: counters2.sku++,
        spu_id: counters2.spu - 1,
        level_prices: sku.level_prices || [],
      })),
    }
    spus.push(newSpu)
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
  async updateSKU(skuId: number, payload: any): Promise<void> {
    await delay(50)
    for (const spu of spus) {
      const sku = spu.skus.find((s) => s.id === skuId)
      if (sku) {
        Object.assign(sku, payload)
        return
      }
    }
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
