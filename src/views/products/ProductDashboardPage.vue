<template>
  <div class="page-container product-dashboard">
    <div class="card-section">
      <div class="page-header">
        <div>
          <h2 class="page-title">商品看板</h2>
          <p class="scope-note">按下单日期统计，退货不回减</p>
        </div>
        <n-button size="small" :loading="loading" @click="loadRanking">刷新</n-button>
      </div>

      <div class="ranking-header">
        <div>
          <h3>商品销售额排行</h3>
          <span class="text-muted">全店销售额前 50 个商品</span>
        </div>
        <n-radio-group :value="days" size="small" @update:value="changeDays">
          <n-radio-button :value="7">近 7 天</n-radio-button>
          <n-radio-button :value="30">近 30 天</n-radio-button>
        </n-radio-group>
      </div>

      <n-alert v-if="error" type="error" :bordered="false" class="error-alert">
        商品销售数据加载失败：{{ error }}
        <n-button text type="primary" @click="loadRanking">重试</n-button>
      </n-alert>

      <n-spin :show="loading">
        <div v-if="loading" class="loading-state" />
        <ol v-else-if="rows.length" class="ranking-list">
          <li v-for="(row, index) in rows" :key="row.spu_id" class="ranking-row">
            <span class="rank">{{ index + 1 }}</span>
            <span class="name" :title="row.spu_name">{{ row.spu_name }}</span>
            <span class="amount">{{ formatMoney(row.amount) }}</span>
            <span class="bar-track" aria-hidden="true">
              <span class="bar-fill" :style="{ width: barWidth(row.amount) }" />
            </span>
          </li>
        </ol>
        <div v-else-if="!error" class="empty-state">该时段暂无商品销售数据</div>
      </n-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { dashboardApi } from '@/api'
import { formatMoney } from '@/utils/format'
import type { DashboardDays, ProductRanking } from '@/types'

const days = ref<DashboardDays>(30)
const rows = ref<ProductRanking[]>([])
const loading = ref(false)
const error = ref('')
let requestId = 0

function barWidth(amount: string): string {
  const first = Number(rows.value[0]?.amount ?? 0)
  return first > 0 ? `${Math.max(0, Number(amount) / first * 100)}%` : '0%'
}

function changeDays(value: DashboardDays): void {
  days.value = value
  loadRanking()
}

async function loadRanking(): Promise<void> {
  const current = ++requestId
  const selectedDays = days.value
  loading.value = true
  error.value = ''
  rows.value = []
  try {
    const result = await dashboardApi.topProducts(selectedDays, 50)
    if (current === requestId) rows.value = result
  } catch (e) {
    if (current === requestId) error.value = e instanceof Error ? e.message : '请稍后重试'
  } finally {
    if (current === requestId) loading.value = false
  }
}

onMounted(loadRanking)
</script>

<style scoped>
.scope-note { margin: 4px 0 0; color: var(--text-3); font-size: 12px; }
.ranking-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.ranking-header h3 { margin: 0 0 3px; font-size: 16px; }
.ranking-header .text-muted { font-size: 12px; }
.error-alert { margin-bottom: 14px; }
.ranking-list { list-style: none; margin: 0; padding: 0; }
.ranking-row { display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; gap: 5px 12px; align-items: center; padding: 11px 0; border-top: 1px solid var(--border); }
.rank { color: var(--text-3); font-weight: 600; text-align: center; }
.name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.amount { font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
.bar-track { grid-column: 2 / 4; height: 5px; border-radius: 4px; background: var(--bg-subtle); overflow: hidden; }
.bar-fill { display: block; height: 100%; border-radius: 4px; background: #2563eb; }
.loading-state { height: 128px; }
.empty-state { padding: 56px 0; color: var(--text-3); text-align: center; }
@media (max-width: 480px) {
  .ranking-row { grid-template-columns: 28px minmax(0, 1fr) auto; gap: 5px 8px; }
  .amount { font-size: 12px; }
}
</style>
