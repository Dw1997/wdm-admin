// src/api/mock/db2.ts - Mock data for Category, Level, SPU/SKU, AuditLog.
import dayjs from 'dayjs'
import type {
  Category,
  LevelConfig,
  ProductSPU,
  ProductSKU,
  AuditLog,
  RoleConfig,
  FeatureNode,
  SystemAccount,
  AdminCustomer,
  Warehouse,
  WarehouseZone,
  RegionNode,
} from '@/types'

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

// ---------------------------------------------------------------------------
// Administrative regions (province / city / district)
// ---------------------------------------------------------------------------
export const regionTree: RegionNode[] = [
  {
    id: 1, name: '浙江省', parent_id: null, level: 1, sort_order: 1,
    children: [
      {
        id: 2, name: '杭州市', parent_id: 1, level: 2, sort_order: 1,
        children: [
          { id: 3, name: '余杭区', parent_id: 2, level: 3, sort_order: 1, children: [] },
          { id: 4, name: '西湖区', parent_id: 2, level: 3, sort_order: 2, children: [] },
          { id: 5, name: '拱墅区', parent_id: 2, level: 3, sort_order: 3, children: [] },
        ],
      },
      { id: 6, name: '宁波市', parent_id: 1, level: 2, sort_order: 2, children: [] },
    ],
  },
  { id: 7, name: '江苏省', parent_id: null, level: 1, sort_order: 2, children: [] },
]
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
  { id: 1, level_id: 'retail', nickname: '零售客户', type: 'retail', is_system: true, created_by: null, description: '按默认价销售', is_active: true, customer_count: 12, created_at: now() },
  { id: 2, level_id: 'bronze', nickname: '青铜批发', type: 'wholesale', is_system: true, created_by: null, description: '默认批发价', is_active: true, customer_count: 8, created_at: now() },
  { id: 3, level_id: 'silver', nickname: '白银批发', type: 'wholesale', is_system: true, created_by: null, description: '默认价 -5%', is_active: true, customer_count: 6, created_at: now() },
  { id: 4, level_id: 'gold', nickname: '黄金批发', type: 'wholesale', is_system: true, created_by: null, description: '默认价 -10%', is_active: true, customer_count: 3, created_at: now() },
  { id: 5, level_id: 'vip', nickname: 'VIP批发', type: 'wholesale', is_system: true, created_by: null, description: '默认价 -15%', is_active: true, customer_count: 2, created_at: now() },
  { id: 6, level_id: 'sales_vip', nickname: '张销售专属', type: 'wholesale', is_system: false, created_by: 2, description: '销售自建等级', is_active: true, customer_count: 1, created_at: now() },
]

export const levelPriceRules: Record<number, { price_adjustment_type: 'percent' | 'amount'; price_adjustment: number }> = {
  1: { price_adjustment_type: 'percent', price_adjustment: 0 },
  2: { price_adjustment_type: 'percent', price_adjustment: 0 },
  3: { price_adjustment_type: 'percent', price_adjustment: -5 },
  4: { price_adjustment_type: 'percent', price_adjustment: -10 },
  5: { price_adjustment_type: 'percent', price_adjustment: -15 },
  6: { price_adjustment_type: 'amount', price_adjustment: -2 },
}

// ---------------------------------------------------------------------------
// Product SPU/SKU
// ---------------------------------------------------------------------------
export const spus: ProductSPU[] = [
  {
    id: 1, code: 'SPU-001', name: '乐事薯片（原味）70g',
    category_id: 9, brand: '乐事', shelf_life_days: 240,
    description: '经典原味，酥脆可口',
    status: 1, is_miniprogram: true, supplier_id: 0, created_at: now(),
    main_images: [''], detail_images: [],
    sku_attributes: [{ name: '规格', values: ['70g'] }],
  },
  {
    id: 2, code: 'SPU-002', name: '农夫山泉 550ml',
    category_id: 12, brand: '农夫山泉', shelf_life_days: 365,
    description: '天然矿泉水',
    status: 1, is_miniprogram: true, supplier_id: 0, created_at: now(),
    main_images: [''], detail_images: [],
    sku_attributes: [{ name: '规格', values: ['550ml'] }],
  },
  {
    id: 3, code: 'SPU-003', name: '双汇火腿肠 30g',
    category_id: 19, brand: '双汇', shelf_life_days: 90,
    description: '高蛋白火腿肠',
    status: 1, is_miniprogram: false, supplier_id: 0, created_at: now(),
    main_images: [''], detail_images: [],
    sku_attributes: [{ name: '规格', values: ['30g'] }],
  },
  {
    id: 4, code: 'SPU-004', name: '老干妈风味豆豉 280g',
    category_id: 16, brand: '老干妈', shelf_life_days: 120,
    description: '经典风味豆豉',
    status: 1, is_miniprogram: false, supplier_id: 0, created_at: now(),
    main_images: [''], detail_images: [],
    sku_attributes: [{ name: '规格', values: ['280g'] }],
  },
]

export const skus: ProductSKU[] = [
  { id: 1, spu_id: 1, cost_price: 2.8, price_method: 'percent', price_value: 25, specs: { 规格: '70g' }, barcode: '6901', remark: '70g/包' },
  { id: 2, spu_id: 2, cost_price: 1.5, price_method: 'percent', price_value: 66.7, specs: { 规格: '550ml' }, barcode: '6902', remark: '550ml/瓶' },
  { id: 3, spu_id: 3, cost_price: 1.2, price_method: 'percent', price_value: 25, specs: { 规格: '30g' }, barcode: '6903', remark: '30g/根' },
  { id: 4, spu_id: 4, cost_price: 9.5, price_method: 'percent', price_value: 36.8, specs: { 规格: '280g' }, barcode: '6904', remark: '280g/瓶' },
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

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
export const roles: RoleConfig[] = [
  {
    id: 1, code: 'admin', name: '超级管理员', description: '拥有全部功能权限', is_system: true, sort_order: 1, is_active: true, platform: 'web',
    feature_ids: Array.from({ length: 39 }, (_, i) => i + 1), created_at: now(),
  },
  {
    id: 2, code: 'sales_manager', name: '销售主管', description: '管理销售、客户与订单', is_system: false, sort_order: 2, is_active: true, platform: 'web',
    feature_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 37, 38, 39], created_at: now(),
  },
  {
    id: 3, code: 'sales', name: '普通销售', description: '仅处理名下客户与订单', is_system: true, sort_order: 3, is_active: true, platform: 'sales',
    feature_ids: [1, 2, 3, 4, 5, 15, 16, 17, 18, 20, 28, 29, 30, 31, 32], created_at: now(),
  },
  {
    id: 4, code: 'finance', name: '财务专员', description: '财务结算与订单查询', is_system: false, sort_order: 4, is_active: true, platform: 'web',
    feature_ids: [1, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39], created_at: now(),
  },
]

// ---------------------------------------------------------------------------
// Feature tree (module -> function/permission granularity)
// ---------------------------------------------------------------------------
export const features: FeatureNode[] = [
  { id: 1, parent_id: null, code: 'dashboard', name: '数据看板', type: 'module', sort_order: 1, is_active: true, created_at: now(), children: [] },
  {
    id: 2, parent_id: null, code: 'product', name: '商品中心', type: 'module', sort_order: 2, is_active: true, created_at: now(),
    children: [
      { id: 3, parent_id: 2, code: 'product:list', name: '商品查看', type: 'permission', sort_order: 1, is_active: true, created_at: now() },
      { id: 4, parent_id: 2, code: 'product:create', name: '新建商品', type: 'permission', sort_order: 2, is_active: true, created_at: now() },
      { id: 5, parent_id: 2, code: 'product:update', name: '编辑商品', type: 'permission', sort_order: 3, is_active: true, created_at: now() },
      { id: 6, parent_id: 2, code: 'product:delete', name: '删除商品', type: 'permission', sort_order: 4, is_active: true, created_at: now() },
      { id: 7, parent_id: 2, code: 'product:spu', name: 'SPU/SKU管理', type: 'permission', sort_order: 5, is_active: true, created_at: now() },
      { id: 8, parent_id: 2, code: 'product:category', name: '分类管理', type: 'permission', sort_order: 6, is_active: true, created_at: now() },
    ],
  },
  {
    id: 10, parent_id: null, code: 'price', name: '价格体系', type: 'module', sort_order: 3, is_active: true, created_at: now(),
    children: [
      { id: 11, parent_id: 10, code: 'price:list', name: '策略查看', type: 'permission', sort_order: 1, is_active: true, created_at: now() },
      { id: 12, parent_id: 10, code: 'price:create', name: '新建策略', type: 'permission', sort_order: 2, is_active: true, created_at: now() },
      { id: 13, parent_id: 10, code: 'price:update', name: '编辑策略', type: 'permission', sort_order: 3, is_active: true, created_at: now() },
      { id: 14, parent_id: 10, code: 'price:delete', name: '删除策略', type: 'permission', sort_order: 4, is_active: true, created_at: now() },
    ],
  },
  {
    id: 15, parent_id: null, code: 'customer', name: '客户管理', type: 'module', sort_order: 4, is_active: true, created_at: now(),
    children: [
      { id: 16, parent_id: 15, code: 'customer:list', name: '客户查看', type: 'permission', sort_order: 1, is_active: true, created_at: now() },
      { id: 17, parent_id: 15, code: 'customer:create', name: '新建客户', type: 'permission', sort_order: 2, is_active: true, created_at: now() },
      { id: 18, parent_id: 15, code: 'customer:update', name: '编辑客户', type: 'permission', sort_order: 3, is_active: true, created_at: now() },
      { id: 19, parent_id: 15, code: 'customer:delete', name: '删除客户', type: 'permission', sort_order: 4, is_active: true, created_at: now() },
      { id: 20, parent_id: 15, code: 'customer:audit', name: '客户审核', type: 'permission', sort_order: 5, is_active: true, created_at: now() },
      { id: 21, parent_id: 15, code: 'customer:level', name: '客户等级', type: 'permission', sort_order: 6, is_active: true, created_at: now() },
    ],
  },
  {
    id: 22, parent_id: null, code: 'sales', name: '销售管理', type: 'module', sort_order: 5, is_active: true, created_at: now(),
    children: [
      { id: 23, parent_id: 22, code: 'sales:list', name: '销售查看', type: 'permission', sort_order: 1, is_active: true, created_at: now() },
      { id: 24, parent_id: 22, code: 'sales:create', name: '新建销售', type: 'permission', sort_order: 2, is_active: true, created_at: now() },
      { id: 25, parent_id: 22, code: 'sales:update', name: '编辑销售', type: 'permission', sort_order: 3, is_active: true, created_at: now() },
      { id: 26, parent_id: 22, code: 'sales:delete', name: '删除销售', type: 'permission', sort_order: 4, is_active: true, created_at: now() },
      { id: 27, parent_id: 22, code: 'sales:performance', name: '业绩查看', type: 'permission', sort_order: 5, is_active: true, created_at: now() },
    ],
  },
  {
    id: 28, parent_id: null, code: 'order', name: '订单履约', type: 'module', sort_order: 6, is_active: true, created_at: now(),
    children: [
      { id: 29, parent_id: 28, code: 'order:list', name: '订单查看', type: 'permission', sort_order: 1, is_active: true, created_at: now() },
      { id: 30, parent_id: 28, code: 'order:audit', name: '订单审核', type: 'permission', sort_order: 2, is_active: true, created_at: now() },
      { id: 31, parent_id: 28, code: 'order:status', name: '状态更新', type: 'permission', sort_order: 3, is_active: true, created_at: now() },
      { id: 32, parent_id: 28, code: 'order:picking', name: '分拣打印', type: 'permission', sort_order: 4, is_active: true, created_at: now() },
    ],
  },
  {
    id: 33, parent_id: null, code: 'finance', name: '财务结算', type: 'module', sort_order: 7, is_active: true, created_at: now(),
    children: [
      { id: 34, parent_id: 33, code: 'finance:payment', name: '收支查看', type: 'permission', sort_order: 1, is_active: true, created_at: now() },
      { id: 35, parent_id: 33, code: 'finance:settle', name: '佣金结算', type: 'permission', sort_order: 2, is_active: true, created_at: now() },
      { id: 36, parent_id: 33, code: 'finance:credit', name: '账期管理', type: 'permission', sort_order: 3, is_active: true, created_at: now() },
    ],
  },
  {
    id: 37, parent_id: null, code: 'system', name: '系统管理', type: 'module', sort_order: 8, is_active: true, created_at: now(),
    children: [
      { id: 38, parent_id: 37, code: 'system:audit', name: '操作审计', type: 'permission', sort_order: 1, is_active: true, created_at: now() },
      { id: 39, parent_id: 37, code: 'system:role', name: '角色权限管理', type: 'permission', sort_order: 2, is_active: true, created_at: now() },
    ],
  },
]

// ---------------------------------------------------------------------------
// System accounts
// ---------------------------------------------------------------------------
export const accounts: SystemAccount[] = [
  {
    id: 1, username: 'admin', real_name: '系统管理员', role_id: 1, role_code: 'admin', role_name: '超级管理员', platform: 'web',
    is_active: true, last_login_at: dayjs().subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss'), created_at: now(), updated_at: now(),
  },
  {
    id: 2, username: 'sales01', real_name: '张销售', role_id: 3, role_code: 'sales', role_name: '普通销售', platform: 'sales',
    is_active: true, last_login_at: dayjs().subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'), created_at: now(), updated_at: now(),
  },
  {
    id: 3, username: 'finance01', real_name: '李财务', role_id: 4, role_code: 'finance', role_name: '财务专员', platform: 'web',
    is_active: false, last_login_at: null, created_at: now(), updated_at: now(),
  },
]

// ---------------------------------------------------------------------------
// Admin customers
// ---------------------------------------------------------------------------
export const adminCustomers: AdminCustomer[] = [
  {
    id: 1, name: '陈记副食', channel_type: 'sales', credit_limit: 50000,
    contact_name: '陈老板', contact_phone: '13900139001', unionid: 'u_001', openid: 'o_001', phone: '13900139001',
    level_id: 2, level_code: 'bronze', level_nickname: '青铜批发', status: 'active',
    sales_id: 1, invite_code: 'C001', address: '浙江省杭州市余杭区良渚街道1号', province: '浙江省', city: '杭州市', district: '余杭区', town: '良渚街道', detail_address: '1号', created_at: now(), updated_at: now(),
  },
  {
    id: 2, name: '赵氏百货', channel_type: 'self_use', credit_limit: 0,
    contact_name: '赵老板', contact_phone: '13900139002', unionid: 'u_002', openid: 'o_002', phone: '13900139002',
    level_id: 3, level_code: 'silver', level_nickname: '白银批发', status: 'active',
    sales_id: 1, invite_code: 'C002', address: '浙江省杭州市西湖区文三路2号', province: '浙江省', city: '杭州市', district: '西湖区', town: '文三路', detail_address: '2号', created_at: now(), updated_at: now(),
  },
  {
    id: 3, name: '王氏便利', channel_type: 'self_use', credit_limit: 0,
    contact_name: '王老板', contact_phone: '13900139003', unionid: 'u_003', openid: 'o_003', phone: '13900139003',
    level_id: null, level_code: null, level_nickname: null, status: 'pending',
    sales_id: null, invite_code: 'C003', address: '浙江省杭州市拱墅区莫干山路3号', province: '浙江省', city: '杭州市', district: '拱墅区', town: '莫干山路', detail_address: '3号', created_at: now(), updated_at: now(),
  },
]

// ---------------------------------------------------------------------------
// Warehouses / logistics
// ---------------------------------------------------------------------------
export const warehouses: Warehouse[] = [
  { id: 1, name: '杭州总仓', type: 'main', created_at: now(), updated_at: now() },
  { id: 2, name: '退货仓', type: 'return', created_at: now(), updated_at: now() },
  { id: 3, name: '虚拟仓', type: 'virtual', created_at: now(), updated_at: now() },
]

export const warehouseZones: WarehouseZone[] = [
  { id: 1, warehouse_id: 1, name: 'A区', created_at: now(), updated_at: now() },
  { id: 2, warehouse_id: 1, name: 'B区', created_at: now(), updated_at: now() },
  { id: 3, warehouse_id: 2, name: '退货暂存区', created_at: now(), updated_at: now() },
]

// ID counters
export const counters2 = {
  category: 21,
  level: 7,
  spu: 5,
  sku: 10,
  auditLog: 9,
  role: 5,
  feature: 40,
  account: 4,
  adminCustomer: 4,
  warehouse: 4,
  warehouseZone: 4,
}
