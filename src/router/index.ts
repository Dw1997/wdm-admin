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
        path: 'list',
        name: 'products-list',
        component: () => import('@/views/products/ProductListPage.vue'),
        meta: { title: '商品管理' },
      },
      {
        path: 'spu',
        name: 'products-spu',
        component: () => import('@/views/products/SPUPage.vue'),
        meta: { title: 'SPU/SKU' },
      },
      {
        path: 'categories',
        name: 'products-categories',
        component: () => import('@/views/products/CategoryPage.vue'),
        meta: { title: '分类管理' },
      },
      {
        path: 'batches',
        name: 'products-batches',
        component: () => import('@/views/products/ProductBatchPage.vue'),
        meta: { title: '批次与效期' },
      },
    ],
  },
  {
    path: '/prices',
    component: Layout,
    redirect: '/prices/strategies',
    meta: { title: '价格体系', icon: 'PriceTag' },
    children: [
      {
        path: 'strategies',
        name: 'prices-strategies',
        component: () => import('@/views/prices/PriceStrategyPage.vue'),
        meta: { title: '价格策略' },
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
        path: 'levels',
        name: 'customers-levels',
        component: () => import('@/views/customers/LevelPage.vue'),
        meta: { title: '客户等级' },
      },
      {
        path: 'audit',
        name: 'customers-audit',
        component: () => import('@/views/customers/CustomerAuditPage.vue'),
        meta: { title: '客户审核' },
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
    path: '/orders',
    component: Layout,
    redirect: '/orders/list',
    meta: { title: '订单履约', icon: 'List' },
    children: [
      {
        path: 'list',
        name: 'orders-list',
        component: () => import('@/views/orders/OrderListPage.vue'),
        meta: { title: '订单列表' },
      },
      {
        path: 'picking',
        name: 'orders-picking',
        component: () => import('@/views/orders/PickingListPage.vue'),
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
    ],
  },
  {
    path: '/system',
    component: Layout,
    redirect: '/system/audit-logs',
    meta: { title: '系统管理', icon: 'Setting' },
    children: [
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
