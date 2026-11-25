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
    path: '/spus',
    component: Layout,
    redirect: '/spus/list',
    meta: { title: '商品中心', icon: 'Goods' },
    children: [
      {
        path: 'create',
        name: 'spus-create',
        component: () => import('@/views/products/ProductCreatePage.vue'),
        meta: { title: '新建商品' },
      },
      {
        path: 'edit/:id',
        name: 'spus-edit',
        component: () => import('@/views/products/ProductCreatePage.vue'),
        meta: { title: '编辑商品' },
      },
      {
        path: 'list',
        name: 'spus-list',
        component: () => import('@/views/products/ProductListPage.vue'),
        meta: { title: '商品管理' },
      },
      {
        path: 'categories',
        name: 'spus-categories',
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
    meta: { title: '进货管理', icon: 'BuildingFactory' },
    children: [
      {
        path: 'list',
        name: 'suppliers-list',
        component: () => import('@/views/suppliers/VendorListPage.vue'),
        meta: { title: '供应商管理' },
      },
      {
        path: 'transactions',
        name: 'suppliers-transactions',
        component: () => import('@/views/suppliers/VendorTransactionsPage.vue'),
        meta: { title: '供应商往来' },
      },
    ],
  },
  {
    path: '/inventory',
    component: Layout,
    redirect: '/inventory/purchases',
    meta: { title: '进货管理' },
    children: [
      {
        path: 'purchase-plans',
        name: 'inventory-purchase-plans',
        component: () => import('@/views/inventory/PurchasePlanPage.vue'),
        meta: { title: '采购清单' },
      },
      {
        path: 'purchases',
        name: 'inventory-purchases',
        component: () => import('@/views/inventory/PurchaseReceiptsPage.vue'),
        meta: { title: '采购入库' },
      },
      {
        path: 'stocks',
        name: 'inventory-stocks',
        component: () => import('@/views/inventory/StockListPage.vue'),
        meta: { title: '库存查询' },
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
      // 新建客户不挂菜单，从客户列表页进入
      {
        path: 'create',
        name: 'customers-create',
        component: () => import('@/views/common/PlaceholderPage.vue'),
        meta: { title: '新建客户' },
      },
      {
        path: 'credit',
        name: 'customers-credit',
        component: () => import('@/views/customers/CustomerCreditPage.vue'),
        meta: { title: '客户额度' },
      },
      {
        path: 'audit',
        name: 'customers-audit',
        component: () => import('@/views/customers/CustomerAuditPage.vue'),
        meta: { title: '客户审核' },
      },
      {
        path: 'tags',
        name: 'customers-tags',
        component: () => import('@/views/customers/CustomerTagPage.vue'),
        meta: { title: '客户标签' },
      },
      {
        path: 'coupons',
        name: 'customers-coupons',
        component: () => import('@/views/customers/CouponManagePage.vue'),
        meta: { title: '优惠券管理' },
      },
    ],
  },
  {
    path: '/delivery',
    component: Layout,
    redirect: '/delivery/trips',
    meta: { title: '配送管理', icon: 'Truck' },
    children: [
      {
        path: 'trips',
        name: 'delivery-trips',
        component: () => import('@/views/delivery/TripListPage.vue'),
        meta: { title: '安排出车' },
      },
      {
        path: 'trips/new',
        name: 'delivery-trip-new',
        component: () => import('@/views/delivery/TripFormPage.vue'),
        meta: { title: '安排出车' },
      },
      {
        path: 'trips/:id/edit',
        name: 'delivery-trip-edit',
        component: () => import('@/views/delivery/TripFormPage.vue'),
        meta: { title: '修改出车' },
      },
      {
        path: 'trips/:id',
        name: 'delivery-trip-detail',
        component: () => import('@/views/delivery/TripDetailPage.vue'),
        meta: { title: '出车详情' },
      },
      {
        path: 'pool',
        name: 'delivery-pool',
        component: () => import('@/views/delivery/PoolOrdersPage.vue'),
        meta: { title: '待送货订单' },
      },
      {
        path: 'places',
        name: 'delivery-places',
        component: () => import('@/views/delivery/PlaceSettingsPage.vue'),
        meta: { title: '路线设置' },
      },
      {
        path: 'freight-lines',
        name: 'delivery-freight-lines',
        component: () => import('@/views/delivery/FreightLinePage.vue'),
        meta: { title: '物流路线' },
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
        path: 'dashboard',
        name: 'sales-dashboard',
        component: () => import('@/views/sales/SalesDashboardPage.vue'),
        meta: { title: '销售看板' },
      },
      {
        path: 'list',
        name: 'sales-list',
        component: () => import('@/views/sales/SalesListPage.vue'),
        meta: { title: '销售列表' },
      },
      {
        path: 'commission-settings',
        name: 'sales-commission-settings',
        component: () => import('@/views/sales/CommissionSettingPage.vue'),
        meta: { title: '提成设置' },
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
        path: 'counter',
        name: 'order-center-counter',
        component: () => import('@/views/orders/CounterSalePage.vue'),
        meta: { title: '门店零售' },
      },
      {
        path: 'create',
        name: 'order-center-create',
        component: () => import('@/views/orders/RecordOrderPage.vue'),
        meta: { title: '录单' },
      },
      {
        path: 'list',
        name: 'order-center-list',
        component: () => import('@/views/orders/OrderListPage.vue'),
        meta: { title: '订单列表' },
      },
      {
        path: 'approvals',
        name: 'order-center-approvals',
        component: () => import('@/views/orders/OrderApprovalPage.vue'),
        meta: { title: '订单审批' },
      },
      {
        path: 'detail/:id',
        name: 'order-center-detail',
        component: () => import('@/views/orders/OrderDetailPage.vue'),
        meta: { title: '订单详情' },
      },
      {
        path: 'refund',
        name: 'order-center-refund',
        component: () => import('@/views/orders/ReturnListPage.vue'),
        meta: { title: '退货单' },
      },
      {
        path: 'refund/new',
        name: 'order-center-refund-new',
        component: () => import('@/views/orders/ReturnCreatePage.vue'),
        meta: { title: '新建退货单' },
      },
      {
        path: 'print',
        name: 'order-center-print',
        component: () => import('@/views/orders/PrintCenterPage.vue'),
        meta: { title: '打印中心' },
      },
    ],
  },
  {
    path: '/finance',
    component: Layout,
    redirect: '/finance/credit',
    meta: { title: '财务结算', icon: 'Money' },
    children: [
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
        path: 'credit/:customerId',
        name: 'finance-credit-settle',
        component: () => import('@/views/finance/CreditSettlePage.vue'),
        props: (route) => ({ customerId: Number(route.params.customerId) }),
        meta: { title: '平账' },
      },
      {
        path: 'payments',
        name: 'finance-payments',
        component: () => import('@/views/finance/PaymentRecordsPage.vue'),
        meta: { title: '支付记录' },
      },
      {
        path: 'cost-center',
        name: 'finance-cost-center',
        component: () => import('@/views/finance/CostCenterPage.vue'),
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
