<template>
  <n-config-provider :theme-overrides="themeOverrides">
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
import type { GlobalThemeOverrides } from 'naive-ui'

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#dc2626',
    primaryColorHover: '#ef4444',
    primaryColorPressed: '#b91c1c',
    primaryColorSuppl: '#dc2626',
    borderRadius: '6px',
    borderRadiusSmall: '4px',
  },
  Button: { textColorPrimary: '#fff' },
  Menu: {
    itemColorActive: 'rgba(220,38,38,0.1)',
    itemColorActiveHover: 'rgba(220,38,38,0.15)',
    itemColorActiveCollapsed: 'rgba(220,38,38,0.1)',
    itemTextColorActive: '#dc2626',
    itemTextColorActiveHover: '#dc2626',
    itemIconColorActive: '#dc2626',
    itemIconColorActiveHover: '#dc2626',
  },
}
</script>
