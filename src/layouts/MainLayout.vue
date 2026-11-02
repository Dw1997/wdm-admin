<template>
  <n-layout has-sider style="height: 100vh">
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
      :inverted="true"
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
        :inverted="true"
        @update:value="onMenuSelect"
      />
    </n-layout-sider>

    <n-layout>
      <n-layout-header bordered class="header">
        <div class="header-left">
          <n-breadcrumb>
            <n-breadcrumb-item @click="$router.push('/dashboard')">首页</n-breadcrumb-item>
            <n-breadcrumb-item v-for="item in breadcrumbItems" :key="item">{{ item }}</n-breadcrumb-item>
          </n-breadcrumb>
        </div>
        <div class="header-right">
          <n-select
            v-model:value="searchValue"
            :options="searchOptions"
            filterable
            clearable
            size="small"
            placeholder="搜索功能"
            style="width: 220px"
            @update:value="onSearchSelect"
          />
          <n-button quaternary circle @click="$router.push('/system/audit-logs')">
            <template #icon><n-icon :component="Bell" /></template>
          </n-button>
          <n-dropdown :options="userOptions" @select="onUserAction">
            <div class="user-info">
              <n-avatar round size="small" style="background: #dc2626">{{ auth.userInitial }}</n-avatar>
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
      <n-layout-content class="content" :native-scrollbar="false">
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
import { h, ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage, useDialog } from 'naive-ui'
import { NIcon } from 'naive-ui'
import {
  Dashboard, ShoppingCart, Tag, Users, BuildingCommunity,
  ClipboardList, Cash, Settings, Bell, ChevronDown, Power, UserCircle, Lock, Truck,
  Plus, Package, Tags, UserCheck, Medal, MapPin, TrendingUp, Printer, Coin, Wallet, ShieldCheck, FileSearch, ChartLine, BuildingFactory, ClipboardPlus, ReceiptRefund, FileInvoice,
} from '@vicons/tabler'
import { accountApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useTabsStore } from '@/stores/tabs'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const tabStore = useTabsStore()
const message = useMessage()
const dialog = useDialog()

const collapsed = ref(false)
const searchValue = ref<string | null>(null)
const passwordVisible = ref(false)
const passwordSaving = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

function renderIcon(icon: any) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

const menuOptions = [
  { label: '数据看板', key: '/dashboard', icon: renderIcon(Dashboard) },
  {
    label: '订单中心', key: 'order-center', icon: renderIcon(ClipboardPlus), children: [
      { label: '创建订单', key: '/order-center/create', icon: renderIcon(Plus) },
      { label: '订单列表', key: '/order-center/list', icon: renderIcon(ClipboardList) },
      { label: '退款订单', key: '/order-center/refund', icon: renderIcon(ReceiptRefund) },
      { label: '分拣打印', key: '/order-center/picking', icon: renderIcon(Printer) },
    ],
  },
  {
    label: '商品中心', key: 'products', icon: renderIcon(ShoppingCart), children: [
      { label: '新建商品', key: '/products/create', icon: renderIcon(Plus) },
      { label: '商品管理', key: '/products/list', icon: renderIcon(Package) },
      { label: '分类管理', key: '/products/categories', icon: renderIcon(Tags) },
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
    label: '供应商', key: 'suppliers', icon: renderIcon(BuildingFactory), children: [
      { label: '供应商看板', key: '/suppliers/dashboard', icon: renderIcon(TrendingUp) },
      { label: '供应商列表', key: '/suppliers/list', icon: renderIcon(Package) },
      { label: '供应商往来', key: '/suppliers/transactions', icon: renderIcon(Wallet) },
    ],
  },
  {
    label: '客户管理', key: 'customers', icon: renderIcon(Users), children: [
      { label: '新建客户', key: '/customers/create', icon: renderIcon(Plus) },
      { label: '客户列表', key: '/customers/list', icon: renderIcon(Users) },
      { label: '客户额度', key: '/customers/credit', icon: renderIcon(Wallet) },
      { label: '客户审核', key: '/customers/audit', icon: renderIcon(UserCheck) },
      { label: '客户等级', key: '/customers/levels', icon: renderIcon(Medal) },
      { label: '客户地址', key: '/customers/addresses', icon: renderIcon(MapPin) },
    ],
  },
  {
    label: '物流管理', key: 'logistics', icon: renderIcon(Truck), children: [
      { label: '新建物流', key: '/logistics/create', icon: renderIcon(Plus) },
      { label: '物流列表', key: '/logistics/list', icon: renderIcon(ClipboardList) },
    ],
  },
  {
    label: '销售管理', key: 'sales', icon: renderIcon(BuildingCommunity), children: [
      { label: '销售列表', key: '/sales/list', icon: renderIcon(UserCircle) },
      { label: '业绩排行', key: '/sales/performance', icon: renderIcon(TrendingUp) },
    ],
  },
  {
    label: '财务结算', key: 'finance', icon: renderIcon(Cash), children: [
      { label: '收支流水', key: '/finance/payments', icon: renderIcon(Cash) },
      { label: '销售提成', key: '/finance/commissions', icon: renderIcon(Coin) },
      { label: '客户账期', key: '/finance/credit', icon: renderIcon(Wallet) },
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
]

const searchOptions = computed(() => {
  const options: { label: string; value: string }[] = []
  const walk = (items: { label: string; key: string; children?: unknown[] }[]) => {
    for (const item of items) {
      if (item.children?.length) {
        walk(item.children as { label: string; key: string; children?: unknown[] }[])
      } else if (item.key && item.key.startsWith('/')) {
        options.push({ label: item.label, value: item.key })
      }
    }
  }
  walk(menuOptions)
  return options
})

function onSearchSelect(key: string | number | null) {
  if (typeof key === 'string' && key.startsWith('/')) {
    router.push(key)
    searchValue.value = null
  }
}

const activeKey = computed(() => {
  const p = route.path
  if (p.startsWith('/products')) {
    if (p === '/products') return '/products/list'
    if (p.startsWith('/products/edit')) return '/products/list'
    return p
  }
  if (p.startsWith('/prices')) return p === '/prices' ? '/prices/suggested' : p
  if (p.startsWith('/suppliers')) return p === '/suppliers' ? '/suppliers/list' : p
  if (p.startsWith('/customers')) return p === '/customers' ? '/customers/list' : p
  if (p.startsWith('/logistics')) return p === '/logistics' ? '/logistics/list' : p
  if (p.startsWith('/sales')) return p === '/sales' ? '/sales/list' : p
  if (p.startsWith('/order-center')) return p === '/order-center' ? '/order-center/list' : p
  if (p.startsWith('/finance')) return p === '/finance' ? '/finance/payments' : p
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
  if (key.startsWith('/')) router.push(key)
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
    dialog.warning({
      title: '退出登录', content: '确认退出当前账号？',
      positiveText: '确认', negativeText: '取消',
      onPositiveClick: async () => {
        await auth.logout()
        message.success('已退出登录')
        router.push('/login')
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
})

watch(() => route.fullPath, () => tabStore.open(route), { immediate: true })
</script>

<style scoped>
.logo {
  height: 56px; display: flex; align-items: center; padding: 0 16px;
  color: #fff; font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden;
}
.logo.collapsed { padding: 0; justify-content: center; }
.logo-mark {
  width: 32px; height: 32px; border-radius: 6px; background: #dc2626;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 16px; margin-right: 10px; flex-shrink: 0;
}
.logo.collapsed .logo-mark { margin-right: 0; }
.header {
  height: 56px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; background: #fff;
}
.header-left, .header-right { display: flex; align-items: center; gap: 12px; }
.tab-bar { padding: 0 16px; background: #fff; border-bottom: 1px solid #e5e7eb; }
.tab-bar :deep(.n-tabs-tab--active) {
  background-color: var(--layout-bg, #f5f5f7) !important;
}
.user-info { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.user-name { font-size: 14px; }
.content { padding: 0; background: var(--layout-bg, #f5f5f7); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
