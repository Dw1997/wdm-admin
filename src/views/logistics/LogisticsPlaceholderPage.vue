<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">{{ title }}</h2>
      </div>
      <n-alert type="info" :bordered="false">
        页面已挂载菜单，功能后续实现。
      </n-alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => String(route.meta?.title || '物流管理'))
</script>
