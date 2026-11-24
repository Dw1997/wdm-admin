<template>
  <n-modal
    :show="show"
    preset="card"
    title="订单审批"
    style="width: 780px; max-width: 95vw"
    @update:show="emit('update:show', $event)"
  >
    <n-spin :show="loading">
      <template v-if="detail">
        <div class="approval-header">
          <div class="approval-title">
            <strong>{{ detail.order_no }}</strong>
            <n-tag type="warning" size="small">待审批</n-tag>
            <n-tag size="small">{{ sourceLabel(detail.source) }}</n-tag>
            <n-tag size="small" :bordered="false">{{ deliveryLabel(detail.delivery_mode) }}</n-tag>
          </div>
          <span class="muted">下单时间：{{ formatDate(detail.created_at) }}</span>
        </div>

        <n-descriptions :column="3" bordered size="small" class="info-desc">
          <n-descriptions-item label="客户">{{ detail.customer_name }} {{ detail.customer_phone || '' }}</n-descriptions-item>
          <n-descriptions-item label="归属销售">{{ detail.sales_name || '店家' }}</n-descriptions-item>
          <n-descriptions-item label="本单金额">
            <strong class="amount-text">¥{{ money(detail.total_amount) }}</strong>
          </n-descriptions-item>
          <n-descriptions-item label="当前欠款">
            {{ account ? `¥${money(account.ar_balance)}` : '—' }}
          </n-descriptions-item>
          <n-descriptions-item label="生效额度">
            {{ account ? (account.effective_credit !== null && account.effective_credit !== '' ? `¥${money(account.effective_credit)}` : '不限额') : '—' }}
          </n-descriptions-item>
          <n-descriptions-item label="逾期金额">
            <span :class="{ danger: account && Number(account.overdue_amount) > 0 }">
              {{ account ? `¥${money(account.overdue_amount)}` : '—' }}
            </span>
          </n-descriptions-item>
          <n-descriptions-item label="备注" :span="3">{{ detail.remark || '—' }}</n-descriptions-item>
        </n-descriptions>

        <h4 class="section-title">商品明细</h4>
        <n-data-table :columns="itemColumns" :data="detail.items" :bordered="false" size="small" :max-height="220" />

        <template v-if="history.length > 0">
          <h4 class="section-title">审批记录</h4>
          <n-data-table :columns="historyColumns" :data="history" :bordered="false" size="small" :max-height="160" />
        </template>

        <div class="opinion-box">
          <label class="field-label">
            <span>审批意见 / 驳回原因（同意选填，驳回必填）</span>
            <n-input
              v-model:value="comment"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              maxlength="200"
              show-count
              placeholder="例如：老客户信用良好，先发货月底结清；驳回时请写明原因"
            />
          </label>
        </div>
      </template>
      <n-empty v-else-if="!loading" description="未能加载订单信息" />
    </n-spin>

    <template #footer>
      <div class="modal-footer">
        <n-button @click="emit('update:show', false)">取消</n-button>
        <n-button
          v-if="detail && detail.status === 'pending_approval'"
          type="error"
          secondary
          :loading="submitting === 'reject'"
          :disabled="submitting !== null"
          @click="handleReject"
        >
          驳回
        </n-button>
        <n-button
          v-if="detail && detail.status === 'pending_approval'"
          type="primary"
          :loading="submitting === 'approve'"
          :disabled="submitting !== null"
          @click="handleApprove"
        >
          同意审批
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { h, ref, watch } from 'vue'
import { NTag, useMessage, type DataTableColumns } from 'naive-ui'
import { adminCustomerApi, orderApi } from '@/api'
import type { CustomerAccount, OrderApprovalRecord, OrderListItem } from '@/types'
import { ORDER_SOURCE } from '@/utils/dict'
import { formatDate } from '@/utils/format'

const props = defineProps<{ show: boolean; orderId: number | null }>()
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'success'): void
}>()

const message = useMessage()
const loading = ref(false)
const submitting = ref<'approve' | 'reject' | null>(null)
const detail = ref<OrderListItem | null>(null)
const account = ref<CustomerAccount | null>(null)
const history = ref<OrderApprovalRecord[]>([])
const comment = ref('')

const DELIVERY_LABELS: Record<string, string> = {
  route: '开车自送',
  freight: '发物流',
  local: '城区自送',
  pickup: '现场提货',
}

const ACTION_LABELS: Record<string, { label: string; type: 'default' | 'info' | 'success' | 'error' | 'warning' }> = {
  submit: { label: '提交审批', type: 'warning' },
  approve: { label: '同意', type: 'success' },
  reject: { label: '驳回', type: 'error' },
  auto_pass: { label: '自动通过', type: 'info' },
  auto_approve: { label: '自动通过', type: 'info' },
  customer_cancel: { label: '客户取消', type: 'default' },
}

const money = (v: number | string | null | undefined) => Number(v || 0).toFixed(2)
const sourceLabel = (src: string) => ORDER_SOURCE[src as keyof typeof ORDER_SOURCE] || src
const deliveryLabel = (mode: string) => DELIVERY_LABELS[mode] || mode

const itemColumns: DataTableColumns<OrderListItem['items'][number]> = [
  { title: '商品', key: 'spu_name' },
  { title: '规格', key: 'sku_spec' },
  { title: '数量', key: 'quantity', width: 90, render: (r) => `${r.quantity}${r.unit || ''}` },
  { title: '售价', key: 'unit_price', width: 100, render: (r) => `¥${money(r.unit_price)}` },
  { title: '金额', key: 'amount', width: 110, render: (r) => `¥${money(r.amount)}` },
]

const historyColumns: DataTableColumns<OrderApprovalRecord> = [
  { title: '时间', key: 'created_at', width: 160, render: (r) => formatDate(r.created_at) },
  {
    title: '动作',
    key: 'action',
    width: 96,
    render: (r) => {
      const meta = ACTION_LABELS[r.action] || { label: r.action, type: 'default' as const }
      return h(NTag, { type: meta.type, size: 'small' }, { default: () => meta.label })
    },
  },
  { title: '操作人', key: 'operator_name', width: 100, render: (r) => r.operator_name || '系统' },
  { title: '当时金额', key: 'order_amount', width: 105, render: (r) => `¥${money(r.order_amount)}` },
  { title: '说明 / 意见', key: 'comment', render: (r) => r.comment || '—' },
]

async function loadData(orderId: number) {
  loading.value = true
  detail.value = null
  account.value = null
  history.value = []
  comment.value = ''
  try {
    const [order, approvals] = await Promise.all([
      orderApi.get(orderId),
      orderApi.approvalHistory(orderId).catch(() => []),
    ])
    detail.value = order
    history.value = approvals
    if (!order.is_walk_in) {
      account.value = await adminCustomerApi.account(order.customer_id).catch(() => null)
    }
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.show, props.orderId] as const,
  ([show, orderId]) => {
    if (show && orderId) {
      void loadData(orderId)
    }
  },
)

async function handleApprove() {
  if (!detail.value) return
  submitting.value = 'approve'
  try {
    await orderApi.approve(detail.value.id, comment.value.trim() || undefined)
    message.success(`订单 ${detail.value.order_no} 已同意，进入待配送`)
    emit('update:show', false)
    emit('success')
  } finally {
    submitting.value = null
  }
}

async function handleReject() {
  if (!detail.value) return
  const reason = comment.value.trim()
  if (!reason) {
    message.warning('驳回订单必须填写原因')
    return
  }
  submitting.value = 'reject'
  try {
    await orderApi.reject(detail.value.id, reason)
    message.success(`订单 ${detail.value.order_no} 已驳回`)
    emit('update:show', false)
    emit('success')
  } finally {
    submitting.value = null
  }
}
</script>

<style scoped>
.approval-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.approval-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
}
.muted {
  font-size: 12px;
  color: #64748b;
}
.info-desc {
  margin-bottom: 12px;
}
.amount-text {
  color: #dc2626;
}
.danger {
  color: #dc2626;
  font-weight: 600;
}
.section-title {
  margin: 14px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}
.opinion-box {
  margin-top: 14px;
}
.field-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #475569;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
