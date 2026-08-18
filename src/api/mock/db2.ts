// src/api/mock/db2.ts - Mock data for Category, Level, SPU/SKU, AuditLog.
import dayjs from 'dayjs'
import type { Category, LevelConfig, ProductSPU, AuditLog } from '@/types'

const now = () => dayjs().format('YYYY-MM-DD HH:mm:ss')

// ---------------------------------------------------------------------------
// Categories — 4-level tree
// ---------------------------------------------------------------------------
export const categories: Category[] = [
  {
    id: 1, name: '食品', parent_id: null, level: 1, sort_order: 1, icon: '🍟',
    is_active: true, created_at: now(),
    children: [
      {
        id: 2, name: '膨化食品', parent_id: 1, level: 2, sort_order: 1, icon: '🥔',
        is_active: true, created_at: now(),
        children: [
          {
            id: 5, name: '薯片', parent_id: 2, level: 3, sort_order: 1,
            is_active: true, created_at: now(), children: [
              { id: 9, name: '原味薯片', parent_id: 5, level: 4, sort_order: 1, is_active: true, created_at: now(), children: [] },
              { id: 10, name: '番茄味薯片', parent_id: 5, level: 4, sort_order: 2, is_active: true, created_at: now(), children: [] },
            ],
          },
          { id: 6, name: '虾条', parent_id: 2, level: 3, sort_order: 2, is_active: true, created_at: now(), children: [] },
        ],
      },
      {
        id: 3, name: '饼干糕点', parent_id: 1, level: 2, sort_order: 2, icon: '🍪',
        is_active: true, created_at: now(),
        children: [
          { id: 7, name: '夹心饼干', parent_id: 3, level: 3, sort_order: 1, is_active: true, created_at: now(), children: [] },
          { id: 8, name: '威化饼干', parent_id: 3, level: 3, sort_order: 2, is_active: true, created_at: now(), children: [] },
        ],
      },
    ],
  },
  {
    id: 11, name: '饮料', parent_id: null, level: 1, sort_order: 2, icon: '🥤',
    is_active: true, created_at: now(),
    children: [
      { id: 12, name: '碳酸饮料', parent_id: 11, level: 2, sort_order: 1, is_active: true, created_at: now(), children: [] },
      { id: 13, name: '果汁饮料', parent_id: 11, level: 2, sort_order: 2, is_active: true, created_at: now(), children: [] },
      { id: 14, name: '乳制品', parent_id: 11, level: 2, sort_order: 3, is_active: true, created_at: now(), children: [] },
    ],
  },
  {
    id: 15, name: '调味品', parent_id: null, level: 1, sort_order: 3, icon: '🫙',
    is_active: true, created_at: now(),
    children: [
      { id: 16, name: '酱料', parent_id: 15, level: 2, sort_order: 1, is_active: true, created_at: now(), children: [] },
      { id: 17, name: '香辛料', parent_id: 15, level: 2, sort_order: 2, is_active: true, created_at: now(), children: [] },
    ],
  },
  {
    id: 18, name: '肉制品', parent_id: null, level: 1, sort_order: 4, icon: '🌭',
    is_active: true, created_at: now(),
    children: [
      { id: 19, name: '火腿肠', parent_id: 18, level: 2, sort_order: 1, is_active: true, created_at: now(), children: [] },
      { id: 20, name: '罐头', parent_id: 18, level: 2, sort_order: 2, is_active: true, created_at: now(), children: [] },
    ],
  },
]

// Flat lookup helper
export function findCategory(id: number): Category | undefined {
  for (const root of categories) {
    const found = _findInTree(root, id)
    if (found) return found
  }
  return undefined
}
function _findInTree(node: Category, id: number): Category | undefined {
  if (node.id === id) return node
  for (const child of (node.children || [])) {
    const found = _findInTree(child, id)
    if (found) return found
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Customer Levels
// ---------------------------------------------------------------------------
export const levels: LevelConfig[] = [
  { id: 1, name: '零售客户', code: 'retail', type: 'retail', price_adjustment: 0, description: '按默认价销售', sort_order: 1, is_active: true, created_at: now() },
  { id: 2, name: '青铜批发', code: 'bronze', type: 'wholesale', price_adjustment: 0, description: '默认批发价', sort_order: 2, is_active: true, created_at: now() },
  { id: 3, name: '白银批发', code: 'silver', type: 'wholesale', price_adjustment: -5, description: '默认价 -5%', sort_order: 3, is_active: true, created_at: now() },
  { id: 4, name: '黄金批发', code: 'gold', type: 'wholesale', price_adjustment: -10, description: '默认价 -10%', sort_order: 4, is_active: true, created_at: now() },
  { id: 5, name: 'VIP批发', code: 'vip', type: 'wholesale', price_adjustment: -15, description: '默认价 -15%', sort_order: 5, is_active: true, created_at: now() },
]

// ---------------------------------------------------------------------------
// Product SPU/SKU
// ---------------------------------------------------------------------------
export const spus: ProductSPU[] = [
  {
    id: 1, name: '乐事薯片（原味）70g', spu_code: 'SPU-001',
    category_id: 9, category_name: '原味薯片', brand: '乐事', spec: '70g/包',
    description: '经典原味，酥脆可口', cover: '',
    status: 'on_sale', is_hot: true, sort_order: 1, created_at: now(),
    skus: [
      { id: 1, spu_id: 1, sku_code: 'SNK-001-P', unit: '包', conversion_ratio: 1, is_base: true, cost_price: 2.8, default_price: 3.5, min_price: 3.0, stock: 480, is_active: true, level_prices: [
        { level_id: 3, level_name: '白银批发', price: 3.3 },
        { level_id: 4, level_name: '黄金批发', price: 3.0 },
        { level_id: 5, level_name: 'VIP批发', price: 2.8 },
      ]},
      { id: 2, spu_id: 1, sku_code: 'SNK-001-X', unit: '箱', conversion_ratio: 24, is_base: false, cost_price: 67.2, default_price: 75.6, min_price: 65, stock: 20, is_active: true, level_prices: [
        { level_id: 4, level_name: '黄金批发', price: 68.0 },
        { level_id: 5, level_name: 'VIP批发', price: 64.0 },
      ]},
    ],
  },
  {
    id: 2, name: '农夫山泉 550ml', spu_code: 'SPU-002',
    category_id: 12, category_name: '碳酸饮料', brand: '农夫山泉', spec: '550ml/瓶',
    description: '天然矿泉水', cover: '',
    status: 'on_sale', is_hot: true, sort_order: 2, created_at: now(),
    skus: [
      { id: 3, spu_id: 2, sku_code: 'SNK-002-P', unit: '瓶', conversion_ratio: 1, is_base: true, cost_price: 1.5, default_price: 2.5, min_price: 2.0, stock: 1200, is_active: true, level_prices: [
        { level_id: 4, level_name: '黄金批发', price: 2.25 },
      ]},
      { id: 4, spu_id: 2, sku_code: 'SNK-002-X', unit: '箱', conversion_ratio: 24, is_base: false, cost_price: 36.0, default_price: 54.0, min_price: 48, stock: 50, is_active: true, level_prices: [] },
    ],
  },
  {
    id: 3, name: '双汇火腿肠 30g', spu_code: 'SPU-003',
    category_id: 19, category_name: '火腿肠', brand: '双汇', spec: '30g/根',
    description: '高蛋白火腿肠', cover: '',
    status: 'on_sale', is_hot: false, sort_order: 3, created_at: now(),
    skus: [
      { id: 5, spu_id: 3, sku_code: 'SNK-003-G', unit: '根', conversion_ratio: 1, is_base: true, cost_price: 1.2, default_price: 1.5, min_price: 1.3, stock: 320, is_active: true, level_prices: [] },
      { id: 6, spu_id: 3, sku_code: 'SNK-003-B', unit: '包', conversion_ratio: 8, is_base: false, cost_price: 9.6, default_price: 11.2, min_price: 10, stock: 40, is_active: true, level_prices: [] },
      { id: 7, spu_id: 3, sku_code: 'SNK-003-X', unit: '箱', conversion_ratio: 80, is_base: false, cost_price: 96.0, default_price: 108.0, min_price: 100, stock: 4, is_active: true, level_prices: [] },
    ],
  },
  {
    id: 4, name: '老干妈风味豆豉 280g', spu_code: 'SPU-004',
    category_id: 16, category_name: '酱料', brand: '老干妈', spec: '280g/瓶',
    description: '经典风味豆豉', cover: '',
    status: 'on_sale', is_hot: false, sort_order: 4, created_at: now(),
    skus: [
      { id: 8, spu_id: 4, sku_code: 'SNK-004-P', unit: '瓶', conversion_ratio: 1, is_base: true, cost_price: 9.5, default_price: 13.0, min_price: 11.0, stock: 180, is_active: true, level_prices: [
        { level_id: 5, level_name: 'VIP批发', price: 11.0 },
      ]},
      { id: 9, spu_id: 4, sku_code: 'SNK-004-X', unit: '箱', conversion_ratio: 12, is_base: false, cost_price: 114.0, default_price: 144.0, min_price: 130, stock: 15, is_active: true, level_prices: [] },
    ],
  },
]

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------
export const auditLogs: AuditLog[] = [
  { id: 1, user_id: 0, user_name: '系统管理员', user_role: 'admin', action: 'create', target_type: 'category', target_id: '1', target_name: '食品', created_at: dayjs().subtract(2, 'hour').format('YYYY-MM-DD HH:mm:ss'), ip_address: '127.0.0.1' },
  { id: 2, user_id: 1, user_name: '张推广', user_role: 'sales', action: 'update', target_type: 'price', target_id: 'SKU-001', target_name: '乐事薯片（原味）70g 包', before_value: '{"default_price": 3.8}', after_value: '{"default_price": 3.5}', created_at: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'), remark: '客户反馈价格偏高，申请降价', ip_address: '192.168.1.101' },
  { id: 3, user_id: 1, user_name: '张推广', user_role: 'sales', action: 'update', target_type: 'order', target_id: 'ORD000001', target_name: '陈记副食', before_value: '{"status": "pending_audit"}', after_value: '{"status": "paid"}', created_at: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'), ip_address: '192.168.1.101' },
  { id: 4, user_id: 0, user_name: '系统管理员', user_role: 'admin', action: 'create', target_type: 'level', target_id: '5', target_name: 'VIP批发', after_value: '{"price_adjustment": -15}', created_at: dayjs().subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'), ip_address: '127.0.0.1' },
  { id: 5, user_id: 1, user_name: '张推广', user_role: 'sales', action: 'update', target_type: 'price', target_id: 'SKU-003', target_name: '双汇火腿肠 箱', before_value: '{"price": 115}', after_value: '{"price": 108}', created_at: dayjs().subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'), remark: '量大从优', ip_address: '192.168.1.101' },
  { id: 6, user_id: 0, user_name: '系统管理员', user_role: 'admin', action: 'update', target_type: 'product', target_id: 'SPU-002', target_name: '农夫山泉 550ml', before_value: '{"status": "draft"}', after_value: '{"status": "on_sale"}', created_at: dayjs().subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss'), ip_address: '127.0.0.1' },
  { id: 7, user_id: 2, user_name: '李销售', user_role: 'sales', action: 'update', target_type: 'customer', target_id: '3', target_name: '赵氏百货', before_value: '{"level": "gold"}', after_value: '{"level": "vip"}', created_at: dayjs().subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss'), remark: '客户升级', ip_address: '192.168.1.102' },
  { id: 8, user_id: 0, user_name: '系统管理员', user_role: 'admin', action: 'delete', target_type: 'category', target_id: '99', target_name: '已删除分类', before_value: '{"name": "过期食品"}', created_at: dayjs().subtract(15, 'day').format('YYYY-MM-DD HH:mm:ss'), ip_address: '127.0.0.1' },
]

// ID counters
export const counters2 = {
  category: 21,
  level: 6,
  spu: 5,
  sku: 10,
  auditLog: 9,
}
