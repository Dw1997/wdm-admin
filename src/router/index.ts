// src/router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const Layout = () => import('@/layouts/MainLayout.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/LoginPage.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/dashboard/DashboardPage.vue'),
        meta: { title: '数据看板', icon: 'DataAnalysis' },
      },
    ],
  },
  {
    path: '/products',
    component: Layout,
    redirect: '/products/list',
    meta: { title: '商品中心', icon: 'Goods' },
    children: [
      {
        path: 'create',
        name: 'products-create',
        component: () => import('@/views/products/ProductCreatePage.vue'),
        meta: { title: '新建商品' },
      },
      {
        path: 'edit/:id',
        name: 'products-edit',
        component: () => import('@/views/products/ProductCreatePage.vue'),
        meta: { title: '编辑商品' },
      },
      {
        path: 'list',
        name: 'products-list',
        component: () => import('@/views/products/ProductListPage.vue'),
        meta: { title: '商品管理' },
      },
      {
        path: 'categories',
        name: 'products-categories',
        component: () => import('@/views/products/CategoryPage.vue'),
        meta: { title: '分类管理' },
      },
    ],
  },
  {
    path: '/prices',
    component: Layout,
    redirect: '/prices/suggested',
    meta: { title: '价格体系', icon: 'PriceTag' },
    children: [
      {
        path: 'suggested',
        name: 'prices-suggested',
        component: () => import('@/views/prices/SuggestedPricePage.vue'),
        meta: { title: '建议价格' },
      },
      {
        path: 'levels',
        name: 'prices-levels',
        component: () => import('@/views/prices/PriceLevelPage.vue'),
        meta: { title: '等级价格' },
      },
      {
        path: 'exclusive',
        name: 'prices-exclusive',
        component: () => import('@/views/prices/CustomerSkuPricePage.vue'),
        meta: { title: '专属价格' },
      },
      {
        path: 'query',
        name: 'prices-query',
        component: () => import('@/views/prices/PriceQueryPage.vue'),
        meta: { title: '价格查询' },
      },
    ],
  },
  {
    path: '/suppliers',
    component: Layout,
    redirect: '/suppliers/list',
    meta: { title: '供应商', icon: 'BuildingFactory' },
    children: [
      {
        path: 'create',
        name: 'suppliers-create',
        component: () => import('@/views/common/PlaceholderPage.vue'),
        meta: { title: '新建供应商' },
      },
      {
        path: 'list',
        name: 'suppliers-list',
        component: () => import('@/views/common/PlaceholderPage.vue'),
        meta: { title: '供应商列表' },
      },
      {
        path: 'debt',
        name: 'suppliers-debt',
        component: () => import('@/views/common/PlaceholderPage.vue'),
        meta: { title: '供应商欠款' },
      },
    ],
  },
  {
    path: '/customers',
    component: Layout,
    redirect: '/customers/list',
    meta: { title: '客户管理', icon: 'User' },
    children: [
      {
        path: 'list',
        name: 'customers-list',
        component: () => import('@/views/customers/CustomerListPage.vue'),
        meta: { title: '客户列表' },
      },
      {
        path: 'create',
        name: 'customers-create',
        component: () => import('@/views/common/PlaceholderPage.vue'),
        meta: { title: '新建客户' },
      },
      {
        path: 'credit',
        name: 'customers-credit',
        component: () => import('@/views/common/PlaceholderPage.vue'),
        meta: { title: '客户额度' },
      },
      {
        path: 'audit',
        name: 'customers-audit',
        component: () => import('@/views/customers/CustomerAuditPage.vue'),
        meta: { title: '客户审核' },
      },
      {
        path: 'levels',
        name: 'customers-levels',
        component: () => import('@/views/customers/CustomerLevelPage.vue'),
        meta: { title: '客户等级' },
      },
      {
        path: 'addresses',
        name: 'customers-addresses',
        component: () => import('@/views/customers/AddressPage.vue'),
        meta: { title: '客户地址' },
      },
    ],
  },
  {
    path: '/logistics',
    component: Layout,
    redirect: '/logistics/list',
    meta: { title: '物流管理', icon: 'Truck' },
    children: [
      {
        path: 'create',
        name: 'logistics-create',
        component: () => import('@/views/logistics/LogisticsPlaceholderPage.vue'),
        meta: { title: '新建物流' },
      },
      {
        path: 'list',
        name: 'logistics-list',
        component: () => import('@/views/logistics/LogisticsPlaceholderPage.vue'),
        meta: { title: '物流列表' },
      },
    ],
  },
  {
    path: '/sales',
    component: Layout,
    redirect: '/sales/list',
    meta: { title: '销售管理', icon: 'Avatar' },
    children: [
      {
        path: 'list',
        name: 'sales-list',
        component: () => import('@/views/sales/SalesListPage.vue'),
        meta: { title: '销售列表' },
      },
      {
        path: 'performance',
        name: 'sales-performance',
        component: () => import('@/views/sales/SalesPerformancePage.vue'),
        meta: { title: '业绩排行' },
      },
    ],
  },
  {
    path: '/order-center',
    component: Layout,
    redirect: '/order-center/list',
    meta: { title: '订单中心', icon: 'ClipboardPlus' },
    children: [
      {
        path: 'create',
        name: 'order-center-create',
        component: () => import('@/views/common/PlaceholderPage.vue'),
        meta: { title: '创建订单' },
      },
      {
        path: 'list',
        name: 'order-center-list',
        component: () => import('@/views/common/PlaceholderPage.vue'),
        meta: { title: '订单列表' },
      },
      {
        path: 'refund',
        name: 'order-center-refund',
        component: () => import('@/views/common/PlaceholderPage.vue'),
        meta: { title: '退款订单' },
      },
      {
        path: 'create-refund',
        name: 'order-center-create-refund',
        component: () => import('@/views/common/PlaceholderPage.vue'),
        meta: { title: '创建退款订单' },
      },
      {
        path: 'picking',
        name: 'order-center-picking',
        component: () => import('@/views/common/PlaceholderPage.vue'),
        meta: { title: '分拣打印' },
      },
    ],
  },
  {
    path: '/finance',
    component: Layout,
    redirect: '/finance/payments',
    meta: { title: '财务结算', icon: 'Money' },
    children: [
      {
        path: 'payments',
        name: 'finance-payments',
        component: () => import('@/views/finance/PaymentListPage.vue'),
        meta: { title: '收支流水' },
      },
      {
        path: 'commissions',
        name: 'finance-commissions',
        component: () => import('@/views/finance/CommissionPage.vue'),
        meta: { title: '销售提成' },
      },
      {
        path: 'credit',
        name: 'finance-credit',
        component: () => import('@/views/finance/CreditPage.vue'),
        meta: { title: '客户账期' },
      },
      {
        path: 'cost-center',
        name: 'finance-cost-center',
        component: () => import('@/views/common/PlaceholderPage.vue'),
        meta: { title: '成本中心' },
      },
    ],
  },
  {
    path: '/system',
    component: Layout,
    redirect: '/system/audit-logs',
    meta: { title: '系统管理', icon: 'Setting' },
    children: [
      {
        path: 'accounts',
        name: 'system-accounts',
        component: () => import('@/views/system/AccountPage.vue'),
        meta: { title: '账户管理' },
      },
      {
        path: 'roles',
        name: 'system-roles',
        component: () => import('@/views/system/RolePermissionPage.vue'),
        meta: { title: '角色管理' },
      },
      {
        path: 'audit-logs',
        name: 'system-audit-logs',
        component: () => import('@/views/system/AuditLogPage.vue'),
        meta: { title: '操作审计' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()
  document.title = `${to.meta.title || '管理端'} · 副食批发平台`
  if (to.meta.public) return next()
  if (!auth.isLoggedIn) return next({ name: 'login', query: { redirect: to.fullPath } })
  next()
})
