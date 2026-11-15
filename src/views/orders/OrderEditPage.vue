<template>
  <div class="page-container edit-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">编辑订单</h2>
        <span v-if="order" class="subtitle">{{ order.order_no }} · 待配送</span>
      </div>
      <n-button @click="router.push('/order-center/list')">返回订单列表</n-button>
    </div>
    <n-spin :show="loading">
      <template v-if="order">
        <OrderEditForm :order="order" @cancel="router.push('/order-center/list')" @saved="onSaved" />
      </template>
      <n-empty v-else-if="!loading" description="订单不存在或无法编辑" />
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { orderApi } from '@/api'
import type { OrderListItem } from '@/types'
import OrderEditForm from './OrderEditForm.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const order = ref<OrderListItem | null>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const result = await orderApi.get(Number(route.params.id))
    if (result.status !== 'pending') {
      message.warning('只有待配送订单可以编辑')
      router.replace('/order-center/list')
      return
    }
    order.value = result
  } catch { /* 请求层提示 */ }
  finally { loading.value = false }
}
function onSaved() { router.push('/order-center/list') }
onMounted(load)
</script>

<style scoped>
.edit-page{display:flex;flex-direction:column;gap:16px;min-height:100%;box-sizing:border-box}.edit-page :deep(.n-spin-container),.edit-page :deep(.n-spin-content){display:flex;flex:1;flex-direction:column}.edit-page :deep(.order-edit){flex:1}.page-header{display:flex;align-items:center;justify-content:space-between}.subtitle{font-size:12px;color:#8b95a5}
</style>
