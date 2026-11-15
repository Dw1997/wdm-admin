<script setup lang="ts">
import type { ReturnTerms } from '@/types'
import { returnFreightLabels, returnRefundLabels } from '@/utils/dict'

defineProps<{ walkIn: boolean }>()
const terms = defineModel<ReturnTerms>({ required: true })
</script>

<template>
  <n-grid :cols="3" :x-gap="16">
    <n-form-item-gi label="退货运费方式">
      <n-select v-model:value="terms.return_freight_mode" :options="Object.entries(returnFreightLabels).map(([value, label]) => ({ value, label }))" />
    </n-form-item-gi>
    <n-form-item-gi v-if="['deduct', 'store_paid'].includes(terms.return_freight_mode)" label="退货运费（元）">
      <n-input v-model:value="terms.freight_cost" placeholder="请输入金额" />
    </n-form-item-gi>
    <n-form-item-gi label="款项处理方式">
      <n-select v-model:value="terms.refund_method" :options="Object.entries(returnRefundLabels).filter(([value]) => !walkIn || value !== 'credit').map(([value, label]) => ({ value, label }))" />
    </n-form-item-gi>
  </n-grid>
</template>
