// src/api/mock/db.ts - In-memory mock database with seed data.
import dayjs from 'dayjs'
import type {
  Product,
  Customer,
  Sales,
  Order,
  PriceStrategy,
  Payment,
  Commission,
} from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const now = () => dayjs().format('YYYY-MM-DD HH:mm:ss')
const today = () => dayjs().format('YYYY-MM-DD')
const dateOffset = (d: number) => dayjs().add(d, 'day').format('YYYY-MM-DD')

// ---------------------------------------------------------------------------
// Products (with multi-unit + batch)
// ---------------------------------------------------------------------------
export const products: Product[] = [
  {
    id: 1,
    sku: 'SNK-001',
    name: '乐事薯片（原味）70g',
    category: '膨化食品',
    brand: '乐事',
    spec: '70g/包',
    base_unit: '包',
    units: [
      { name: '包', ratio: 1, base_unit: '包' },
      { name: '箱', ratio: 24, base_unit: '包' },
    ],
    status: 'on_sale',
    stock: 480,
    safety_stock: 100,
    expiry_warning_days: 30,
    batches: [
      { batch_no: 'B20260110-01', production_date: '2026-01-10', expiry_date: '2026-09-10', quantity: 280, cost_price: 2.8 },
      { batch_no: 'B20260305-02', production_date: '2026-03-05', expiry_date: '2026-11-05', quantity: 200, cost_price: 2.9 },
    ],
    cover: '',
    description: '经典原味，酥脆可口',
    created_at: '2026-01-15 10:00:00',
    updated_at: now(),
  },
  {
    id: 2,
    sku: 'SNK-002',
    name: '农夫山泉 550ml',
    category: '饮料',
    brand: '农夫山泉',
    spec: '550ml/瓶',
    base_unit: '瓶',
    units: [
      { name: '瓶', ratio: 1, base_unit: '瓶' },
      { name: '箱', ratio: 24, base_unit: '瓶' },
    ],
    status: 'on_sale',
    stock: 1200,
    safety_stock: 200,
    expiry_warning_days: 180,
    batches: [
      { batch_no: 'B20260412-01', production_date: '2026-04-12', expiry_date: '2027-04-12', quantity: 800, cost_price: 1.5 },
      { batch_no: 'B20260520-01', production_date: '2026-05-20', expiry_date: '2027-05-20', quantity: 400, cost_price: 1.55 },
    ],
    created_at: '2026-02-20 09:00:00',
    updated_at: now(),
  },
  {
    id: 3,
    sku: 'SNK-003',
    name: '康师傅红烧牛肉面 5包/袋',
    category: '方便食品',
    brand: '康师傅',
    spec: '5包/袋',
    base_unit: '包',
    units: [
      { name: '包', ratio: 1, base_unit: '包' },
      { name: '袋', ratio: 5, base_unit: '包' },
      { name: '箱', ratio: 30, base_unit: '包' },
    ],
    status: 'on_sale',
    stock: 60,
    safety_stock: 80,
    expiry_warning_days: 90,
    batches: [
      { batch_no: 'B20260501-01', production_date: '2026-05-01', expiry_date: '2026-09-15', quantity: 60, cost_price: 2.2 },
    ],
    created_at: '2026-03-10 14:00:00',
    updated_at: now(),
  },
  {
    id: 4,
    sku: 'SNK-004',
    name: '双汇火腿肠 30g',
    category: '肉制品',
    brand: '双汇',
    spec: '30g/根',
    base_unit: '根',
    units: [
      { name: '根', ratio: 1, base_unit: '根' },
      { name: '包', ratio: 8, base_unit: '根' },
      { name: '箱', ratio: 80, base_unit: '根' },
    ],
    status: 'on_sale',
    stock: 320,
    safety_stock: 50,
    expiry_warning_days: 60,
    batches: [
      { batch_no: 'B20260615-01', production_date: '2026-06-15', expiry_date: '2026-09-15', quantity: 320, cost_price: 1.2 },
    ],
    created_at: '2026-04-01 10:00:00',
    updated_at: now(),
  },
  {
    id: 5,
    sku: 'SNK-005',
    name: '老干妈风味豆豉 280g',
    category: '调味品',
    brand: '老干妈',
    spec: '280g/瓶',
    base_unit: '瓶',
    units: [
      { name: '瓶', ratio: 1, base_unit: '瓶' },
      { name: '箱', ratio: 12, base_unit: '瓶' },
    ],
    status: 'on_sale',
    stock: 180,
    safety_stock: 40,
    expiry_warning_days: 120,
    batches: [
      { batch_no: 'B20260420-01', production_date: '2026-04-20', expiry_date: '2027-04-20', quantity: 180, cost_price: 9.5 },
    ],
    created_at: '2026-05-01 09:00:00',
    updated_at: now(),
  },
  {
    id: 6,
    sku: 'SNK-006',
    name: '旺仔牛奶 245ml',
    category: '饮料',
    brand: '旺仔',
    spec: '245ml/罐',
    base_unit: '罐',
    units: [
      { name: '罐', ratio: 1, base_unit: '罐' },
      { name: '箱', ratio: 24, base_unit: '罐' },
    ],
    status: 'on_sale',
    stock: 240,
    safety_stock: 60,
    expiry_warning_days: 180,
    batches: [
      { batch_no: 'B20260510-01', production_date: '2026-05-10', expiry_date: '2027-05-10', quantity: 240, cost_price: 3.2 },
    ],
    created_at: '2026-05-15 10:00:00',
    updated_at: now(),
  },
  {
    id: 7,
    sku: 'SNK-007',
    name: '洽洽香瓜子 160g',
    category: '坚果炒货',
    brand: '洽洽',
    spec: '160g/袋',
    base_unit: '袋',
    units: [
      { name: '袋', ratio: 1, base_unit: '袋' },
      { name: '箱', ratio: 20, base_unit: '袋' },
    ],
    status: 'on_sale',
    stock: 25,
    safety_stock: 30,
    expiry_warning_days: 90,
    batches: [
      { batch_no: 'B20260601-01', production_date: '2026-06-01', expiry_date: '2026-10-15', quantity: 25, cost_price: 6.5 },
    ],
    created_at: '2026-06-01 09:00:00',
    updated_at: now(),
  },
  {
    id: 8,
    sku: 'SNK-008',
    name: '奥利奥饼干 116g',
    category: '饼干糕点',
    brand: '奥利奥',
    spec: '116g/包',
    base_unit: '包',
    units: [
      { name: '包', ratio: 1, base_unit: '包' },
      { name: '箱', ratio: 24, base_unit: '包' },
    ],
    status: 'on_sale',
    stock: 360,
    safety_stock: 80,
    expiry_warning_days: 180,
    batches: [
      { batch_no: 'B20260401-01', production_date: '2026-04-01', expiry_date: '2026-10-01', quantity: 360, cost_price: 4.8 },
    ],
    created_at: '2026-04-15 10:00:00',
    updated_at: now(),
  },
]

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------
export const sales: Sales[] = [
  {
    id: 1,
    name: '张推广',
    phone: '13800138001',
    invite_code: 'SALE001',
    total_customers: 12,
    active_customers: 10,
    total_gmv: 84500,
    estimated_commission: 4225,
    joined_at: '2025-08-15 09:00:00',
    status: 'active',
    region: '城东区',
  },
  {
    id: 2,
    name: '李销售',
    phone: '13800138002',
    invite_code: 'SALE002',
    total_customers: 8,
    active_customers: 7,
    total_gmv: 62300,
    estimated_commission: 3115,
    joined_at: '2025-10-20 10:00:00',
    status: 'active',
    region: '城西区',
  },
  {
    id: 3,
    name: '王市场',
    phone: '13800138003',
    invite_code: 'SALE003',
    total_customers: 5,
    active_customers: 4,
    total_gmv: 31200,
    estimated_commission: 1560,
    joined_at: '2026-01-10 09:00:00',
    status: 'active',
    region: '城南区',
  },
]

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
export const customers: Customer[] = [
  {
    id: 1,
    name: '陈老板',
    phone: '13900139001',
    address: '城东区解放路 88 号',
    shop_name: '陈记副食',
    status: 'active',
    level: 'gold',
    sales_id: 1,
    sales_name: '张推广',
    credit_limit: 50000,
    used_credit: 12500,
    available_credit: 37500,
    invite_code: 'SALE001',
    registered_at: '2025-09-10 10:00:00',
    last_order_at: '2026-07-15 14:30:00',
  },
  {
    id: 2,
    name: '刘大姐',
    phone: '13900139002',
    address: '城西区中山路 22 号',
    shop_name: '刘姐超市',
    status: 'active',
    level: 'silver',
    sales_id: 1,
    sales_name: '张推广',
    credit_limit: 30000,
    used_credit: 8200,
    available_credit: 21800,
    invite_code: 'SALE001',
    registered_at: '2025-11-05 11:00:00',
    last_order_at: '2026-07-18 09:15:00',
  },
  {
    id: 3,
    name: '赵哥',
    phone: '13900139003',
    address: '城南区胜利街 5 号',
    shop_name: '赵氏百货',
    status: 'active',
    level: 'vip',
    sales_id: 2,
    sales_name: '李销售',
    credit_limit: 100000,
    used_credit: 35000,
    available_credit: 65000,
    invite_code: 'SALE002',
    registered_at: '2025-10-12 09:30:00',
    last_order_at: '2026-07-19 16:20:00',
  },
  {
    id: 4,
    name: '孙总',
    phone: '13900139004',
    address: '城东区和平路 18 号',
    shop_name: '孙氏批发部',
    status: 'pending',
    level: 'bronze',
    credit_limit: 0,
    used_credit: 0,
    available_credit: 0,
    invite_code: 'SALE003',
    registered_at: '2026-07-18 11:00:00',
  },
  {
    id: 5,
    name: '周阿姨',
    phone: '13900139005',
    address: '城北区光明街 33 号',
    shop_name: '周记小卖部',
    status: 'active',
    level: 'bronze',
    sales_id: 3,
    sales_name: '王市场',
    credit_limit: 10000,
    used_credit: 1500,
    available_credit: 8500,
    invite_code: 'SALE003',
    registered_at: '2026-02-20 10:00:00',
    last_order_at: '2026-07-12 15:40:00',
  },
  {
    id: 6,
    name: '吴老板',
    phone: '13900139006',
    address: '城西区民主路 66 号',
    shop_name: '吴氏便利店',
    status: 'active',
    level: 'gold',
    sales_id: 2,
    sales_name: '李销售',
    credit_limit: 60000,
    used_credit: 22000,
    available_credit: 38000,
    invite_code: 'SALE002',
    registered_at: '2025-12-01 09:00:00',
    last_order_at: '2026-07-19 11:00:00',
  },
]

// ---------------------------------------------------------------------------
// Price strategies
// ---------------------------------------------------------------------------
export const priceStrategies: PriceStrategy[] = [
  {
    id: 1,
    product_id: 1,
    product_name: '乐事薯片（原味）70g',
    type: 'tier',
    name: '乐事薯片-等级价',
    rules: [
      { level: 'bronze', unit: '包', unit_price: 3.5 },
      { level: 'silver', unit: '包', unit_price: 3.3 },
      { level: 'gold', unit: '包', unit_price: 3.0 },
      { level: 'vip', unit: '包', unit_price: 2.8 },
    ],
    enabled: true,
    priority: 10,
    created_at: '2026-01-20 10:00:00',
  },
  {
    id: 2,
    product_id: 2,
    product_name: '农夫山泉 550ml',
    type: 'ladder',
    name: '农夫山泉-阶梯价',
    rules: [
      { min_qty: 1, unit: '瓶', unit_price: 2.5 },
      { min_qty: 24, unit: '瓶', unit_price: 2.2 },
      { min_qty: 100, unit: '瓶', unit_price: 2.0 },
    ],
    enabled: true,
    priority: 20,
    created_at: '2026-02-25 10:00:00',
  },
  {
    id: 3,
    product_id: 3,
    product_name: '康师傅红烧牛肉面',
    type: 'customer',
    name: '康师傅-大客户专属',
    rules: [
      { customer_id: 3, customer_name: '赵哥', unit: '包', unit_price: 2.0 },
      { customer_id: 6, customer_name: '吴老板', unit: '包', unit_price: 2.1 },
    ],
    enabled: true,
    priority: 5,
    created_at: '2026-03-15 10:00:00',
  },
  {
    id: 4,
    product_id: 5,
    product_name: '老干妈风味豆豉',
    type: 'flash',
    name: '老干妈-限时特价',
    rules: [{ unit: '瓶', unit_price: 12.0 }],
    starts_at: '2026-07-15 00:00:00',
    ends_at: '2026-07-25 23:59:59',
    enabled: true,
    priority: 1,
    remark: '夏季促销',
    created_at: '2026-07-14 10:00:00',
  },
]

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
function makeOrder(
  id: number,
  customer: Customer,
  status: Order['status'],
  items: Order['items'],
  payment: Order['payment_method'],
  daysAgo: number,
  remark?: string,
): Order {
  const total = items.reduce((s, it) => s + it.subtotal, 0)
  return {
    id: `ORD${String(id).padStart(6, '0')}`,
    customer_id: customer.id,
    customer_name: customer.shop_name || customer.name,
    sales_id: customer.sales_id,
    sales_name: customer.sales_name,
    status,
    payment_method: payment,
    total_amount: total,
    paid_amount: payment === 'online' || status === 'completed' ? total : 0,
    items,
    remark,
    created_at: dayjs().subtract(daysAgo, 'day').format('YYYY-MM-DD HH:mm:ss'),
    audited_at: status !== 'pending_audit' ? dayjs().subtract(daysAgo, 'day').add(1, 'hour').format('YYYY-MM-DD HH:mm:ss') : undefined,
    shipped_at: ['shipped', 'completed'].includes(status) ? dayjs().subtract(daysAgo - 1, 'day').format('YYYY-MM-DD HH:mm:ss') : undefined,
    completed_at: status === 'completed' ? dayjs().subtract(daysAgo - 2, 'day').format('YYYY-MM-DD HH:mm:ss') : undefined,
    delivery_address: customer.address,
  }
}

export const orders: Order[] = [
  makeOrder(1, customers[0], 'pending_audit', [
    { product_id: 1, product_name: '乐事薯片（原味）70g', sku: 'SNK-001', unit: '箱', quantity: 5, unit_price: 65, subtotal: 325 },
    { product_id: 2, product_name: '农夫山泉 550ml', sku: 'SNK-002', unit: '箱', quantity: 10, unit_price: 48, subtotal: 480 },
  ], 'credit', 0),
  makeOrder(2, customers[1], 'paid', [
    { product_id: 3, product_name: '康师傅红烧牛肉面 5包/袋', sku: 'SNK-003', unit: '箱', quantity: 3, unit_price: 78, subtotal: 234 },
  ], 'online', 1),
  makeOrder(3, customers[2], 'picking', [
    { product_id: 4, product_name: '双汇火腿肠 30g', sku: 'SNK-004', unit: '箱', quantity: 8, unit_price: 96, subtotal: 768 },
    { product_id: 8, product_name: '奥利奥饼干 116g', sku: 'SNK-008', unit: '箱', quantity: 5, unit_price: 110, subtotal: 550 },
  ], 'credit', 1),
  makeOrder(4, customers[3], 'pending_audit', [
    { product_id: 5, product_name: '老干妈风味豆豉 280g', sku: 'SNK-005', unit: '瓶', quantity: 12, unit_price: 13, subtotal: 156 },
  ], 'online', 0, '新客户首单'),
  makeOrder(5, customers[4], 'shipped', [
    { product_id: 6, product_name: '旺仔牛奶 245ml', sku: 'SNK-006', unit: '箱', quantity: 4, unit_price: 80, subtotal: 320 },
  ], 'wechat', 2),
  makeOrder(6, customers[5], 'completed', [
    { product_id: 1, product_name: '乐事薯片（原味）70g', sku: 'SNK-001', unit: '箱', quantity: 6, unit_price: 60, subtotal: 360 },
    { product_id: 2, product_name: '农夫山泉 550ml', sku: 'SNK-002', unit: '箱', quantity: 8, unit_price: 46, subtotal: 368 },
    { product_id: 7, product_name: '洽洽香瓜子 160g', sku: 'SNK-007', unit: '袋', quantity: 20, unit_price: 8, subtotal: 160 },
  ], 'credit', 5),
  makeOrder(7, customers[0], 'completed', [
    { product_id: 4, product_name: '双汇火腿肠 30g', sku: 'SNK-004', unit: '箱', quantity: 5, unit_price: 100, subtotal: 500 },
  ], 'online', 8),
  makeOrder(8, customers[2], 'completed', [
    { product_id: 8, product_name: '奥利奥饼干 116g', sku: 'SNK-008', unit: '箱', quantity: 10, unit_price: 105, subtotal: 1050 },
  ], 'credit', 10),
]

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export const payments: Payment[] = [
  { id: 1, order_id: 'ORD000002', customer_id: 2, customer_name: '刘大姐', amount: 234, method: 'wechat', status: 'success', created_at: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss') },
  { id: 2, order_id: 'ORD000005', customer_id: 5, customer_name: '周阿姨', amount: 320, method: 'wechat', status: 'success', created_at: dayjs().subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss') },
  { id: 3, order_id: 'ORD000006', customer_id: 6, customer_name: '吴老板', amount: 888, method: 'bank', status: 'success', created_at: dayjs().subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss') },
  { id: 4, order_id: 'ORD000007', customer_id: 1, customer_name: '陈老板', amount: 500, method: 'wechat', status: 'success', created_at: dayjs().subtract(8, 'day').format('YYYY-MM-DD HH:mm:ss') },
  { id: 5, order_id: 'ORD000008', customer_id: 3, customer_name: '赵哥', amount: 1050, method: 'bank', status: 'success', created_at: dayjs().subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss') },
]

// ---------------------------------------------------------------------------
// Commissions
// ---------------------------------------------------------------------------
export const commissions: Commission[] = [
  { id: 1, sales_id: 1, sales_name: '张推广', order_id: 'ORD000001', customer_id: 1, customer_name: '陈老板', order_amount: 805, commission_rate: 0.05, commission_amount: 40.25, status: 'pending', created_at: today() },
  { id: 2, sales_id: 1, sales_name: '张推广', order_id: 'ORD000007', customer_id: 1, customer_name: '陈老板', order_amount: 500, commission_rate: 0.05, commission_amount: 25, status: 'settled', settled_at: dayjs().subtract(5, 'day').format('YYYY-MM-DD'), created_at: dayjs().subtract(8, 'day').format('YYYY-MM-DD') },
  { id: 3, sales_id: 2, sales_name: '李销售', order_id: 'ORD000003', customer_id: 2, customer_name: '刘大姐', order_amount: 1318, commission_rate: 0.05, commission_amount: 65.9, status: 'pending', created_at: dayjs().subtract(1, 'day').format('YYYY-MM-DD') },
  { id: 4, sales_id: 2, sales_name: '李销售', order_id: 'ORD000008', customer_id: 3, customer_name: '赵哥', order_amount: 1050, commission_rate: 0.05, commission_amount: 52.5, status: 'settled', settled_at: dayjs().subtract(7, 'day').format('YYYY-MM-DD'), created_at: dayjs().subtract(10, 'day').format('YYYY-MM-DD') },
  { id: 5, sales_id: 2, sales_name: '李销售', order_id: 'ORD000006', customer_id: 6, customer_name: '吴老板', order_amount: 888, commission_rate: 0.05, commission_amount: 44.4, status: 'settled', settled_at: dayjs().subtract(2, 'day').format('YYYY-MM-DD'), created_at: dayjs().subtract(5, 'day').format('YYYY-MM-DD') },
]

// IDs that the next created resource will receive.
export const counters = {
  product: products.length + 1,
  customer: customers.length + 1,
  order: orders.length + 1,
  payment: payments.length + 1,
  commission: commissions.length + 1,
  priceStrategy: priceStrategies.length + 1,
  sales: sales.length + 1,
}

// silence unused
void dateOffset
