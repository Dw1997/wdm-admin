<template>
  <n-config-provider :theme="app.isDark ? darkTheme : null" :theme-overrides="themeOverrides" :locale="zhCN" :date-locale="dateZhCN">
    <n-loading-bar-provider>
      <n-message-provider>
        <n-dialog-provider>
          <n-notification-provider>
            <router-view />
          </n-notification-provider>
        </n-dialog-provider>
      </n-message-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { darkTheme, zhCN, dateZhCN, type GlobalThemeOverrides } from 'naive-ui'
import { useAppStore } from '@/stores/app'

const app = useAppStore()

/* 令牌在 main.css，这里只让 <html> 带上 dark 类 */
watchEffect(() => document.documentElement.classList.toggle('dark', app.isDark))

/* Naive 需要字面颜色（内部会做色彩计算），所以按明暗各给一份，与 main.css 令牌保持一致 */
const themeOverrides = computed<GlobalThemeOverrides>(() => {
  const dark = app.isDark
  const primary = dark ? '#818cf8' : '#4f46e5'
  const soft = dark ? 'rgba(129,140,248,0.16)' : 'rgba(79,70,229,0.10)'
  const card = dark ? '#181b24' : '#ffffff'
  const page = dark ? '#0f1117' : '#f5f6fa'
  const subtle = dark ? '#1e222d' : '#f8f9fc'
  const border = dark ? '#2a2f3d' : '#e8eaf0'
  const text = dark ? '#e8eaf0' : '#1b1f2a'
  const textSecondary = dark ? '#b4bac8' : '#4b5262'
  return {
    common: {
      primaryColor: primary,
      primaryColorHover: dark ? '#a5b4fc' : '#6366f1',
      primaryColorPressed: dark ? '#6366f1' : '#4338ca',
      primaryColorSuppl: primary,
      borderRadius: '8px',
      borderRadiusSmall: '6px',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', Roboto, sans-serif",
    },
    Button: { textColorPrimary: dark ? '#0f1117' : '#fff' },
    Layout: {
      color: page,
      siderColor: card,
      headerColor: card,
      headerBorderColor: border,
      siderBorderColor: border,
    },
    Card: {
      borderRadius: '10px',
      color: card,
      colorModal: card,
      colorPopover: card,
      colorEmbedded: subtle,
      textColor: text,
      titleTextColor: text,
      borderColor: border,
      actionColor: card,
    },
    DataTable: {
      borderColor: border,
      tdColor: card,
      tdTextColor: text,
      thColor: subtle,
      thTextColor: textSecondary,
      thFontWeight: '600',
    },
    Table: {
      borderColor: border,
      tdColor: card,
      tdTextColor: text,
      thColor: subtle,
      thTextColor: textSecondary,
      thFontWeight: '600',
    },
    Menu: {
      borderRadius: '8px',
      itemColorActive: soft,
      itemColorActiveHover: soft,
      itemColorActiveCollapsed: soft,
      itemTextColorActive: primary,
      itemTextColorActiveHover: primary,
      itemIconColorActive: primary,
      itemIconColorActiveHover: primary,
      itemTextColorChildActive: primary,
      itemIconColorChildActive: primary,
      arrowColorChildActive: primary,
    },
    Tabs: { tabBorderRadius: '8px' },
  }
})
</script>
