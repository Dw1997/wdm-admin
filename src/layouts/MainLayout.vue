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
            <n-breadcrumb-item v-if="currentTitle">{{ currentTitle }}</n-breadcrumb-item>
          </n-breadcrumb>
        </div>
        <div class="header-right">
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
      <n-layout-content class="content" :native-scrollbar="false">
        <router-view v-slot="{ Component, route }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.fullPath" />
          </transition>
        </router-view>
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import { h, ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage, useDialog } from 'naive-ui'
import { NIcon } from 'naive-ui'
import {
  Dashboard, ShoppingCart, Tag, Users, BuildingCommunity,
  ClipboardList, Cash, Settings, Bell, ChevronDown, Power, UserCircle,
} from '@vicons/tabler'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()

const collapsed = ref(false)

function renderIcon(icon: any) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

const menuOptions = [
  { label: '数据看板', key: '/dashboard', icon: renderIcon(Dashboard) },
  {
    label: '商品中心', key: 'products', icon: renderIcon(ShoppingCart), children: [
      { label: '商品管理', key: '/products/list' },
      { label: 'SPU/SKU', key: '/products/spu' },
      { label: '分类管理', key: '/products/categories' },
      { label: '批次与效期', key: '/products/batches' },
    ],
  },
  {
    label: '价格体系', key: 'prices', icon: renderIcon(Tag), children: [
      { label: '价格策略', key: '/prices/strategies' },
    ],
  },
  {
    label: '客户管理', key: 'customers', icon: renderIcon(Users), children: [
      { label: '客户列表', key: '/customers/list' },
      { label: '客户等级', key: '/customers/levels' },
      { label: '客户审核', key: '/customers/audit' },
    ],
  },
  {
    label: '销售管理', key: 'sales', icon: renderIcon(BuildingCommunity), children: [
      { label: '销售列表', key: '/sales/list' },
      { label: '业绩排行', key: '/sales/performance' },
    ],
  },
  {
    label: '订单履约', key: 'orders', icon: renderIcon(ClipboardList), children: [
      { label: '订单列表', key: '/orders/list' },
      { label: '分拣打印', key: '/orders/picking' },
    ],
  },
  {
    label: '财务结算', key: 'finance', icon: renderIcon(Cash), children: [
      { label: '收支流水', key: '/finance/payments' },
      { label: '销售提成', key: '/finance/commissions' },
      { label: '客户账期', key: '/finance/credit' },
    ],
  },
  {
    label: '系统管理', key: 'system', icon: renderIcon(Settings), children: [
      { label: '操作审计', key: '/system/audit-logs' },
    ],
  },
]

const activeKey = computed(() => {
  const p = route.path
  if (p.startsWith('/products')) return p === '/products' ? '/products/list' : p
  if (p.startsWith('/prices')) return p === '/prices' ? '/prices/strategies' : p
  if (p.startsWith('/customers')) return p === '/customers' ? '/customers/list' : p
  if (p.startsWith('/sales')) return p === '/sales' ? '/sales/list' : p
  if (p.startsWith('/orders')) return p === '/orders' ? '/orders/list' : p
  if (p.startsWith('/finance')) return p === '/finance' ? '/finance/payments' : p
  if (p.startsWith('/system')) return p === '/system' ? '/system/audit-logs' : p
  return p
})

const currentTitle = computed(() => route.meta?.title ? String(route.meta.title) : '')

const userOptions = [
  { label: '个人信息', key: 'profile', icon: renderIcon(UserCircle) },
  { type: 'divider', key: 'd1' },
  { label: '退出登录', key: 'logout', icon: renderIcon(Power) },
]

function onMenuSelect(key: string) {
  if (key.startsWith('/')) router.push(key)
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
  }
}

onMounted(() => {
  if (!auth.user) auth.fetchMe()
})
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
.user-info { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.user-name { font-size: 14px; }
.content { padding: 0; background: var(--layout-bg, #f5f5f7); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
