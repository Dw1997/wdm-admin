<template>
  <n-layout has-sider :style="{ height: '100vh', '--wdm-sider-width': collapsed ? '64px' : '220px' }">
    <n-layout-sider
      bordered
      collapse-mode="width"
      :collapsed-width="64"
      :width="220"
      :collapsed="collapsed"
      show-trigger="bar"
      :native-scrollbar="false"
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <div class="logo" :class="{ collapsed }">
        <span class="logo-mark">副</span>
        <span v-if="!collapsed" class="logo-text">副食批发 · 管理端</span>
      </div>
      <n-menu
        :value="activeKey"
        :collapsed="collapsed"
        :collapsed-width="64"
        :collapsed-icon-size="18"
        :options="menuOptions"
        :node-props="menuNodeProps"
      />
    </n-layout-sider>

    <n-layout content-class="main-scroll">
      <n-layout-header bordered class="header">
        <div class="header-left">
          <n-breadcrumb>
            <n-breadcrumb-item @click="$router.push('/dashboard')">首页</n-breadcrumb-item>
            <n-breadcrumb-item v-for="item in breadcrumbItems" :key="item">{{ item }}</n-breadcrumb-item>
          </n-breadcrumb>
        </div>
        <div class="header-right">
          <n-select
            ref="searchSelectRef"
            v-model:value="searchValue"
            :options="searchOptions"
            remote
            filterable
            clearable
            size="small"
            :loading="searchLoading"
            :consistent-menu-width="false"
            :menu-props="{ style: { width: '380px' } }"
            :render-label="renderSearchLabel"
            :placeholder="searchPlaceholder"
            style="width: 260px"
            @search="onSearchInput"
            @update:value="onSearchSelect"
          />
          <n-button quaternary circle :title="app.isDark ? '切换为浅色' : '切换为深色'" @click="app.toggleTheme()">
            <template #icon><n-icon :component="app.isDark ? Sun : Moon" /></template>
          </n-button>
          <n-button quaternary circle @click="$router.push('/system/audit-logs')">
            <template #icon><n-icon :component="Bell" /></template>
          </n-button>
          <n-dropdown :options="userOptions" @select="onUserAction">
            <div class="user-info">
              <n-avatar round size="small" style="background: var(--primary); color: #fff">{{ auth.userInitial }}</n-avatar>
              <span class="user-name">{{ auth.user?.real_name || auth.user?.username || '管理员' }}</span>
              <n-icon :component="ChevronDown" size="14" />
            </div>
          </n-dropdown>
        </div>
      </n-layout-header>
      <div class="tab-bar">
        <n-tabs
          v-model:value="tabStore.activeKey"
          type="card"
          size="small"
          closable
          @close="onTabClose"
          @update:value="onTabSelect"
        >
          <n-tab-pane v-for="tab in tabStore.tabs" :key="tab.key" :name="tab.key" :closable="tab.closable">
            <template #tab>{{ tab.label }}</template>
          </n-tab-pane>
        </n-tabs>
      </div>
      <n-layout-content
        class="content"
        :class="{ 'full-height-content': route.name === 'sales-dashboard' || route.name === 'sales-commission-settings' || route.name === 'finance-credit-settle' || route.name === 'customers-list' || route.name === 'customers-credit' || route.name === 'order-center-list' }"
        :native-scrollbar="false"
      >
        <router-view v-slot="{ Component, route }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.fullPath" />
          </transition>
        </router-view>
      </n-layout-content>
    </n-layout>

  </n-layout>

  <n-modal v-model:show="passwordVisible" title="修改密码" preset="card" style="width: 460px">
    <n-form label-placement="left" label-width="110">
      <n-form-item label="原密码"><n-input v-model:value="oldPassword" type="password" show-password-on="click" /></n-form-item>
      <n-form-item label="新密码"><n-input v-model:value="newPassword" type="password" show-password-on="click" /></n-form-item>
      <n-form-item label="确认新密码"><n-input v-model:value="confirmPassword" type="password" show-password-on="click" @keyup.enter="onPasswordSave" /></n-form-item>
    </n-form>
    <template #footer>
      <n-button @click="passwordVisible = false">取消</n-button>
      <n-button type="primary" :loading="passwordSaving" @click="onPasswordSave">确认修改</n-button>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { h, ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useMessage, useDialog, type MenuGroupOption, type MenuOption, type SelectInst, type SelectOption, type SelectRenderLabel } from 'naive-ui'
import { NIcon, NTag } from 'naive-ui'
import {
  Dashboard, ShoppingCart, Tag, Users, BuildingCommunity,
  ClipboardList, Cash, Settings, Bell, ChevronDown, Power, UserCircle, Lock, Truck,
  Plus, Package, Tags, UserCheck, Medal, MapPin, TrendingUp, Printer, Coin, Wallet, ShieldCheck, FileSearch, ChartLine, BuildingFactory, ClipboardPlus, ReceiptRefund, FileInvoice, Route, Sun, Moon,
} from '@vicons/tabler'
import { accountApi, globalSearchApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useTabsStore } from '@/stores/tabs'
import { confirmAction } from '@/utils/confirm'
import { buildFeatureOptionGroups } from '@/config/globalSearch'
import { ORDER_LIST_STATUS, ROUTE_TRIP_STATUS, vendorStatusMeta } from '@/utils/dict'
import { formatDate, formatMoney, formatPhone } from '@/utils/format'
import type { AdminCustomer, OrderListItem, ProductSPU, RouteTrip, Vendor } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const app = useAppStore()
const tabStore = useTabsStore()
const message = useMessage()
const dialog = useDialog()

const collapsed = ref(false)
const searchValue = ref<string | null>(null)
const searchSelectRef = ref<SelectInst | null>(null)
const passwordVisible = ref(false)
const passwordSaving = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
let orderTabSequence = 0

function renderIcon(icon: any) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

const isAdmin = computed(() => !auth.user || auth.user.role === 'admin')

const menuOptions = computed(() => [
  { label: '数据看板', key: '/dashboard', icon: renderIcon(Dashboard) },
  {
    label: '订单中心', key: 'order-center', icon: renderIcon(ClipboardPlus), children: [
      { label: '门店零售', key: '/order-center/counter', icon: renderIcon(ShoppingCart) },
      { label: '录单', key: '/order-center/create', icon: renderIcon(Plus) },
      { label: '订单列表', key: '/order-center/list', icon: renderIcon(ClipboardList) },
      ...(isAdmin.value ? [{ label: '订单审批', key: '/order-center/approvals', icon: renderIcon(ShieldCheck) }] : []),
      { label: '退货单', key: '/order-center/refund', icon: renderIcon(ReceiptRefund) },
      // 打印中心只有管理员可用（print.documents）
      ...(isAdmin.value ? [{ label: '打印中心', key: '/order-center/print', icon: renderIcon(Printer) }] : []),
    ],
  },
  {
    label: '商品中心', key: 'spus', icon: renderIcon(ShoppingCart), children: [
      { label: '新建商品', key: '/spus/create', icon: renderIcon(Plus) },
      { label: '商品管理', key: '/spus/list', icon: renderIcon(Package) },
      { label: '分类管理', key: '/spus/categories', icon: renderIcon(Tags) },
    ],
  },
  {
    label: '价格体系', key: 'prices', icon: renderIcon(Tag), children: [
      { label: '建议价格', key: '/prices/suggested', icon: renderIcon(ChartLine) },
      { label: '等级价格', key: '/prices/levels', icon: renderIcon(Medal) },
      { label: '专属价格', key: '/prices/exclusive', icon: renderIcon(Lock) },
      { label: '价格查询', key: '/prices/query', icon: renderIcon(FileSearch) },
    ],
  },
  {
    label: '进货管理', key: 'inventory', icon: renderIcon(BuildingFactory), children: [
      { label: '采购清单', key: '/inventory/purchase-plans', icon: renderIcon(FileInvoice) },
      { label: '采购入库', key: '/inventory/purchases', icon: renderIcon(ClipboardList) },
      { label: '库存查询', key: '/inventory/stocks', icon: renderIcon(Package) },
      { label: '供应商管理', key: '/suppliers/list', icon: renderIcon(BuildingCommunity) },
    ],
  },
  {
    label: '客户管理', key: 'customers', icon: renderIcon(Users), children: [
      { label: '客户列表', key: '/customers/list', icon: renderIcon(Users) },
      { label: '客户额度', key: '/customers/credit', icon: renderIcon(Wallet) },
      { label: '客户审核', key: '/customers/audit', icon: renderIcon(UserCheck) },
      { label: '客户标签', key: '/customers/tags', icon: renderIcon(Tags) },
      { label: '优惠券管理', key: '/customers/coupons', icon: renderIcon(Medal) },
    ],
  },
  {
    label: '配送管理', key: 'delivery', icon: renderIcon(Truck), children: [
      { label: '安排出车', key: '/delivery/trips', icon: renderIcon(Truck) },
      { label: '待送货订单', key: '/delivery/pool', icon: renderIcon(ClipboardList) },
      { label: '路线设置', key: '/delivery/places', icon: renderIcon(MapPin) },
      { label: '物流路线', key: '/delivery/freight-lines', icon: renderIcon(Route) },
    ],
  },
  {
    label: '销售管理', key: 'sales', icon: renderIcon(BuildingCommunity), children: [
      { label: '销售看板', key: '/sales/dashboard', icon: renderIcon(TrendingUp) },
      { label: '销售列表', key: '/sales/list', icon: renderIcon(UserCircle) },
      { label: '提成设置', key: '/sales/commission-settings', icon: renderIcon(ChartLine) },
    ],
  },
  {
    label: '财务结算', key: 'finance', icon: renderIcon(Cash), children: [
      { label: '销售提成', key: '/finance/commissions', icon: renderIcon(Coin) },
      { label: '客户账期', key: '/finance/credit', icon: renderIcon(Wallet) },
      { label: '支付记录', key: '/finance/payments', icon: renderIcon(Cash) },
      { label: '供应商往来', key: '/suppliers/transactions', icon: renderIcon(BuildingFactory) },
      { label: '成本中心', key: '/finance/cost-center', icon: renderIcon(FileInvoice) },
    ],
  },
  {
    label: '系统管理', key: 'system', icon: renderIcon(Settings), children: [
      { label: '账户管理', key: '/system/accounts', icon: renderIcon(UserCircle) },
      { label: '角色管理', key: '/system/roles', icon: renderIcon(ShieldCheck) },
      { label: '操作审计', key: '/system/audit-logs', icon: renderIcon(FileSearch) },
    ],
  },
])

type SearchTagType = 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'

interface SearchLeafOption extends SelectOption {
  title: string
  subtitle?: string
  tagText?: string
  tagType?: SearchTagType
  to?: RouteLocationRaw
}

interface SearchOptionGroup {
  type: 'group'
  key: string
  label: string
  children: SearchLeafOption[]
  [k: string]: unknown
}

const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)
const searchPlaceholder = `搜索功能/单号/客户/商品 (${isMac ? '⌘K' : 'Ctrl+K'})`

const searchQuery = ref('')
const searchLoading = ref(false)
const remoteGroups = ref<SearchOptionGroup[]>([])
let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchController: AbortController | null = null

const featureGroups = computed<SearchOptionGroup[]>(() =>
  buildFeatureOptionGroups(isAdmin.value, searchQuery.value).map((group): SearchOptionGroup => ({
    type: 'group',
    key: group.key,
    label: group.label,
    children: group.children.map((child): SearchLeafOption => ({
      value: child.value,
      label: child.label,
      title: child.label,
      subtitle: child.description,
    })),
  })),
)

const searchOptions = computed<SearchOptionGroup[]>(() => {
  const query = searchQuery.value.trim()
  if (!query) return featureGroups.value
  // 单号 / 手机号等纯数字检索：无系统功能命中时让业务数据排在最前
  const numericQuery = /^[\d\s-]+$/.test(query)
  if (numericQuery && featureGroups.value.length === 0) return remoteGroups.value
  return [...featureGroups.value, ...remoteGroups.value]
})

function settledItems<T>(result: PromiseSettledResult<T[]>): T[] {
  return result.status === 'fulfilled' ? result.value : []
}

function buildOrderGroup(items: OrderListItem[]): SearchOptionGroup | null {
  if (!items.length) return null
  return {
    type: 'group',
    key: 'biz:orders',
    label: '订单',
    children: items.map((order) => {
      const status = ORDER_LIST_STATUS[order.status]
      return {
        value: `order:${order.id}`,
        label: order.order_no,
        title: order.order_no,
        subtitle: `${order.customer_name} · ${formatMoney(order.total_amount)}`,
        tagText: status.label,
        tagType: status.type,
        to: `/order-center/detail/${order.id}`,
      }
    }),
  }
}

function buildCustomerGroup(items: AdminCustomer[]): SearchOptionGroup | null {
  if (!items.length) return null
  return {
    type: 'group',
    key: 'biz:customers',
    label: '客户',
    children: items.map((customer) => ({
      value: `customer:${customer.id}`,
      label: customer.name,
      title: customer.name,
      subtitle: [formatPhone(customer.phone ?? undefined), customer.tag_name, customer.sales_name].filter(Boolean).join(' · '),
      to: { path: '/customers/list', query: { keyword: customer.name } },
    })),
  }
}

function buildProductGroup(items: ProductSPU[]): SearchOptionGroup | null {
  if (!items.length) return null
  return {
    type: 'group',
    key: 'biz:products',
    label: '商品',
    children: items.map((product) => ({
      value: `product:${product.id}`,
      label: product.name,
      title: product.name,
      subtitle: [product.code, product.sku_count ? `${product.sku_count} SKU` : ''].filter(Boolean).join(' · '),
      to: `/spus/edit/${product.id}`,
    })),
  }
}

function buildVendorGroup(items: Vendor[]): SearchOptionGroup | null {
  if (!items.length) return null
  return {
    type: 'group',
    key: 'biz:vendors',
    label: '供应商',
    children: items.map((vendor) => {
      const status = vendorStatusMeta(vendor.status)
      return {
        value: `vendor:${vendor.id}`,
        label: vendor.name,
        title: vendor.name,
        subtitle: [formatPhone(vendor.phone ?? undefined), vendor.contact_name, vendor.contact_phone].filter(Boolean).join(' · '),
        tagText: status.label,
        tagType: status.type,
        to: { path: '/suppliers/list', query: { keyword: vendor.name } },
      }
    }),
  }
}

function buildTripGroup(items: RouteTrip[]): SearchOptionGroup | null {
  if (!items.length) return null
  return {
    type: 'group',
    key: 'biz:trips',
    label: '出车趟次',
    children: items.map((trip) => {
      const status = ROUTE_TRIP_STATUS[trip.status]
      return {
        value: `trip:${trip.id}`,
        label: trip.name || trip.trip_date,
        title: trip.name || trip.trip_date,
        subtitle: `${formatDate(trip.trip_date, 'YYYY-MM-DD')} · ${status.label}`,
        tagText: trip.owner_name,
        tagType: 'info',
        to: `/delivery/trips/${trip.id}`,
      }
    }),
  }
}

function cancelRemoteSearch() {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  if (searchController) {
    searchController.abort()
    searchController = null
  }
  searchLoading.value = false
}

async function runRemoteSearch(query: string) {
  if (searchController) searchController.abort()
  const controller = new AbortController()
  searchController = controller
  searchLoading.value = true
  const { signal } = controller
  const [orders, customers, products, vendors, trips] = await Promise.allSettled([
    globalSearchApi.orders(query, signal),
    globalSearchApi.customers(query, signal),
    globalSearchApi.products(query, signal),
    globalSearchApi.vendors(query, signal),
    globalSearchApi.trips(query, signal),
  ])
  if (signal.aborted || searchQuery.value.trim() !== query) return
  searchController = null
  remoteGroups.value = [
    buildOrderGroup(settledItems(orders)),
    buildCustomerGroup(settledItems(customers)),
    buildProductGroup(settledItems(products)),
    buildVendorGroup(settledItems(vendors)),
    buildTripGroup(settledItems(trips)),
  ].filter((group): group is SearchOptionGroup => group !== null)
  searchLoading.value = false
}

function onSearchInput(query: string) {
  searchQuery.value = query
  const trimmed = query.trim()
  remoteGroups.value = []
  if (!trimmed) {
    cancelRemoteSearch()
    return
  }
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    void runRemoteSearch(trimmed)
  }, 280)
}

function resetSearch() {
  searchValue.value = null
  searchQuery.value = ''
  remoteGroups.value = []
  cancelRemoteSearch()
}

function findSearchTarget(value: string): RouteLocationRaw | null {
  for (const group of remoteGroups.value) {
    const hit = group.children.find((option) => option.value === value)
    if (hit?.to) return hit.to
  }
  return null
}

const renderSearchLabel: SelectRenderLabel = (option) => {
  if (option.type === 'group') {
    return typeof option.label === 'string' ? option.label : null
  }
  const leaf = option as unknown as Partial<SearchLeafOption>
  const title = String(leaf.title ?? leaf.label ?? '')
  const tag = leaf.tagText
    ? h(NTag, { size: 'tiny', type: leaf.tagType ?? 'default', bordered: false }, { default: () => leaf.tagText })
    : null
  return h('div', { style: 'display: flex; flex-direction: column; gap: 2px; width: 100%; min-width: 0; padding: 2px 0' }, [
    h('div', { style: 'display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0' }, [
      h('span', { style: 'font-size: 13px; color: var(--text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap' }, title),
      tag,
    ]),
    leaf.subtitle
      ? h('span', { style: 'font-size: 12px; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap' }, leaf.subtitle)
      : null,
  ])
}

function onSearchSelect(value: string | number | null) {
  if (value == null || value === '') {
    resetSearch()
    return
  }
  const key = String(value)
  if (key === 'action:change-password') {
    openPasswordModal()
  } else if (key === 'action:toggle-theme') {
    app.toggleTheme()
  } else if (key.startsWith('/')) {
    onMenuSelect(key)
  } else {
    const target = findSearchTarget(key)
    if (target) router.push(target)
  }
  resetSearch()
  searchSelectRef.value?.blur()
}

function onSearchShortcut(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchSelectRef.value?.focus()
  }
}

const activeKey = computed(() => {
  const p = route.path
  if (p.startsWith('/spus')) {
    if (p === '/spus') return '/spus/list'
    if (p.startsWith('/spus/edit')) return '/spus/list'
    return p
  }
  if (p.startsWith('/prices')) return p === '/prices' ? '/prices/suggested' : p
  if (p.startsWith('/suppliers')) return p === '/suppliers' ? '/suppliers/list' : p
  if (p.startsWith('/customers')) return p === '/customers' ? '/customers/list' : p
  if (p.startsWith('/delivery/trips')) return '/delivery/trips'
  if (p.startsWith('/delivery')) return p === '/delivery' ? '/delivery/trips' : p
  if (p.startsWith('/sales')) return p === '/sales' ? '/sales/list' : p
  if (p.startsWith('/order-center')) return p === '/order-center' ? '/order-center/list' : p
  if (p.startsWith('/finance/credit')) return '/finance/credit'
  if (p.startsWith('/finance')) return p === '/finance' ? '/finance/credit' : p
  if (p.startsWith('/system')) return p === '/system' ? '/system/audit-logs' : p
  return p
})

const breadcrumbItems = computed(() => {
  const titles = route.matched.filter((r) => r.meta?.title).map((r) => String(r.meta.title))
  return titles.filter((t, i) => t !== titles[i - 1])
})

const userOptions = [
  { label: '个人信息', key: 'profile', icon: renderIcon(UserCircle) },
  { label: '修改密码', key: 'password', icon: renderIcon(Lock) },
  { type: 'divider', key: 'd1' },
  { label: '退出登录', key: 'logout', icon: renderIcon(Power) },
]

function onMenuSelect(key: string) {
  // 录单和门店零售每次点击都在应用内新开标签页
  if (key === '/order-center/create' || key === '/order-center/counter') {
    const tabId = `${Date.now()}-${++orderTabSequence}`
    router.push({ path: key, query: { t: tabId } })
    return
  }
  if (key.startsWith('/')) router.push(key)
}

function menuNodeProps(option: MenuOption | MenuGroupOption) {
  if (option.children?.length || option.key == null) return {}
  return { onClick: () => onMenuSelect(String(option.key)) } as any
}

function onTabSelect(key: string) {
  const tab = tabStore.tabs.find((t) => t.key === key)
  if (tab && tab.path !== route.path) router.push(tab.path)
}

function onTabClose(key: string) {
  tabStore.close(key)
  const active = tabStore.tabs.find((t) => t.key === tabStore.activeKey)
  if (active) router.push(active.path)
}


async function onUserAction(key: string) {
  if (key === 'logout') {
    confirmAction(dialog, {
      title: '退出登录', content: '确认退出当前账号？',
      confirmText: '确认', cancelText: '取消',
      danger: true,
      onConfirm: async () => {
        await auth.logout()
        message.success('已退出登录')
        router.replace('/login')
      },
    })
  } else if (key === 'profile') {
    message.info('个人信息功能开发中')
  } else if (key === 'password') {
    openPasswordModal()
  }
}

function openPasswordModal() {
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordVisible.value = true
}

async function onPasswordSave() {
  if (!auth.user?.id) {
    message.error('无法获取当前账户')
    return
  }
  if (!oldPassword.value) {
    message.warning('请输入原密码')
    return
  }
  if (!newPassword.value || newPassword.value.length < 6) {
    message.warning('新密码至少 6 位')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    message.warning('两次输入的密码不一致')
    return
  }
  passwordSaving.value = true
  try {
    await accountApi.updatePassword(auth.user.id, newPassword.value, oldPassword.value)
    message.success('密码已修改')
    passwordVisible.value = false
  } finally {
    passwordSaving.value = false
  }
}

onMounted(() => {
  if (!auth.user) auth.fetchMe()
  window.addEventListener('keydown', onSearchShortcut)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onSearchShortcut)
  cancelRemoteSearch()
})

watch(() => route.fullPath, () => tabStore.open(route), { immediate: true })
</script>

<style scoped>
.logo {
  height: 60px; display: flex; align-items: center; padding: 0 18px;
  color: var(--text-1); font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden;
}
.logo.collapsed { padding: 0; justify-content: center; }
.logo-mark {
  width: 32px; height: 32px; border-radius: 9px;
  background: linear-gradient(135deg, #4f46e5, #818cf8); color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 16px; margin-right: 10px; flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(79, 70, 229, 0.35);
}
.logo.collapsed .logo-mark { margin-right: 0; }
.header {
  height: 56px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; background: var(--bg-card);
}
.header-left, .header-right { display: flex; align-items: center; gap: 12px; }
.tab-bar { padding: 8px 20px 0; background: var(--bg-card); border-bottom: 1px solid var(--border); }
/* 标签页：平铺风格，激活项用主色淡底 + 主色文字 */
.tab-bar :deep(.n-tabs-tab) { border-radius: 8px 8px 0 0; }
.tab-bar :deep(.n-tabs-tab--active) {
  background-color: var(--primary-soft) !important;
  border-color: transparent !important;
}
.tab-bar :deep(.n-tabs-tab--active .n-tabs-tab__label) { color: var(--primary) !important; font-weight: 600; }
.tab-bar :deep(.n-tabs-tab--active .n-base-close) { --n-close-icon-color: var(--primary); }
.user-info { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.user-name { font-size: 14px; }
:deep(.main-scroll) { display: flex; flex-direction: column; overflow: hidden; }
.header, .tab-bar { flex-shrink: 0; }
.content { flex: 1; min-height: 0; padding: 0; background: var(--bg-page); }
.full-height-content :deep(.n-scrollbar-content) { height: 100%; min-height: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
