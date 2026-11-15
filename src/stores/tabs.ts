import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RouteLocationNormalized } from 'vue-router'

export interface TabItem {
  key: string
  label: string
  path: string
  closable: boolean
}

const MULTI_TAB_ROUTES = ['/order-center/create', '/order-center/counter']

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<TabItem[]>([
    { key: '/dashboard', label: '数据看板', path: '/dashboard', closable: false },
  ])
  const activeKey = ref('/dashboard')

  function open(route: RouteLocationNormalized) {
    const basePath = route.path
    const path = route.fullPath
    const label = String(route.meta?.title || route.name || '页面')
    if (path === '/dashboard') {
      activeKey.value = '/dashboard'
      return
    }
    if (MULTI_TAB_ROUTES.includes(basePath)) {
      const existing = tabs.value.find((t) => t.path === path)
      if (existing) {
        activeKey.value = existing.key
        return
      }
      const key = path
      tabs.value.push({ key, label, path, closable: true })
      activeKey.value = key
      return
    }
    const existing = tabs.value.find((t) => t.path === path && t.closable)
    if (existing) {
      existing.label = label
      activeKey.value = existing.key
      return
    }
    tabs.value.push({ key: path, label, path, closable: true })
    activeKey.value = path
  }

  function close(key: string) {
    const idx = tabs.value.findIndex((t) => t.key === key)
    if (idx < 0 || !tabs.value[idx].closable) return
    tabs.value.splice(idx, 1)
    if (activeKey.value === key) {
      const next = tabs.value[Math.min(idx, tabs.value.length - 1)]
      activeKey.value = next?.key || '/dashboard'
    }
  }

  return { tabs, activeKey, open, close }
})
