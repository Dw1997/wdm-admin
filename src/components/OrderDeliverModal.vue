<template>
  <n-modal
    :show="show"
    preset="card"
    title="确认送达"
    style="width: 680px; max-width: 95vw"
    @update:show="emit('update:show', $event)"
  >
    <template v-if="order">
      <p class="modal-note">实送数量默认等于下单数量，可以改小，不能超过下单数量。</p>
      <n-data-table :columns="columns" :data="rows" :bordered="false" size="small" />
      <div class="deliver-time">
        <span>送达时间</span>
        <n-date-picker
          v-model:formatted-value="deliveredAt"
          type="datetime"
          value-format="yyyy-MM-dd HH:mm"
          clearable
        />
        <span class="hint">默认当前；补录可选更早时间，不能晚于当前</span>
      </div>
      <p v-if="order.route_trip_id || order.freight_shipment_id" class="hint">
        本单挂在{{ order.route_trip_id ? '出车趟次' : '物流批次' }}上，送达后不再计入该{{ order.route_trip_id ? '趟' : '批次' }}的待处理订单。
      </p>
    </template>
    <template #footer>
      <n-button @click="emit('update:show', false)">取消</n-button>
      <n-button type="primary" :loading="saving" @click="save">确认送达</n-button>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { h, ref, watch } from 'vue'
import { NButton, NInput, useMessage, type DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import { orderApi } from '@/api'
import type { OrderListItem } from '@/types'

interface DeliverRow {
  order_item_id: number
  name: string
  unit: string
  ordered: number
  delivered: number | null
}

const props = defineProps<{ show: boolean; order: OrderListItem | null }>()
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'success', order: OrderListItem): void
}>()

const message = useMessage()
const saving = ref(false)
const rows = ref<DeliverRow[]>([])
const deliveredAt = ref<string | null>(null)

const columns: DataTableColumns<DeliverRow> = [
  { title: '商品', key: 'name' },
  { title: '单位', key: 'unit', width: 70 },
  { title: '下单数量', key: 'ordered', width: 90 },
  {
    title: '实送数量', key: 'delivered', width: 140,
    render: (row) => h(NInput, {
      value: row.delivered == null ? '' : String(row.delivered),
      size: 'small',
      onUpdateValue: (value: string) => {
        const parsed = Number(value)
        row.delivered = Number.isFinite(parsed) ? parsed : null
      },
    }),
  },
]

watch(
  () => [props.show, props.order] as const,
  ([show, order]) => {
    if (!show || !order) return
    rows.value = order.items.map((item) => ({
      order_item_id: item.id,
      name: `${item.spu_name} ${item.sku_spec || ''}`.trim(),
      unit: item.unit,
      ordered: Number(item.quantity),
      delivered: Number(item.delivered_quantity ?? item.quantity),
    }))
    deliveredAt.value = dayjs().format('YYYY-MM-DD HH:mm')
  },
  { immediate: true },
)

async function save() {
  if (!props.order) return
  if (rows.value.some((row) => row.delivered == null || row.delivered < 0 || row.delivered > row.ordered)) {
    message.warning('实送数量必须大于等于 0，且不超过下单数量')
    return
  }
  const at = deliveredAt.value ? dayjs(deliveredAt.value) : null
  if (at && at.isAfter(dayjs())) {
    message.warning('送达时间不能晚于当前时间')
    return
  }
  saving.value = true
  try {
    const result = await orderApi.deliver(
      props.order.id,
      rows.value.map((row) => ({
        order_item_id: row.order_item_id,
        delivered_quantity: String(row.delivered),
      })),
      at ? at.toISOString() : undefined,
    )
    for (const warning of result.warnings) message.warning(warning.message)
    message.success('已送达')
    emit('update:show', false)
    emit('success', result.order as unknown as OrderListItem)
  } catch {
    /* 请求层提示 */
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.modal-note { margin: 0 0 12px; color: var(--text-2); font-size: 13px; }
.deliver-time { display: flex; align-items: center; gap: 10px; margin-top: 16px; font-size: 13px; }
.hint { color: #8b95a5; font-size: 12px; }
</style>
