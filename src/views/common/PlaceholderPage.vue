<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">{{ title }}</h2>
      </div>
      <n-alert type="info" :bordered="false">
        页面已挂载菜单，等待确认对应接口字段后再实现具体功能。
      </n-alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => String(route.meta?.title || '功能页面'))
</script>
