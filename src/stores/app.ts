// src/stores/app.ts - UI-side store: sidebar collapse, etc.
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref<boolean>(localStorage.getItem('wdm_sidebar_collapsed') === 'true')

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem('wdm_sidebar_collapsed', String(sidebarCollapsed.value))
  }

  /* 主题：未手动选择时跟随系统；手动切换后记住 */
  const stored = localStorage.getItem('wdm_theme')
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)')
  const osDark = ref(systemDark.matches)
  systemDark.addEventListener('change', (e) => { osDark.value = e.matches })
  const themeMode = ref<'light' | 'dark' | null>(stored === 'light' || stored === 'dark' ? stored : null)
  const isDark = computed(() => (themeMode.value ? themeMode.value === 'dark' : osDark.value))

  function toggleTheme() {
    themeMode.value = isDark.value ? 'light' : 'dark'
    localStorage.setItem('wdm_theme', themeMode.value)
  }

  return { sidebarCollapsed, toggleSidebar, isDark, toggleTheme }
})
