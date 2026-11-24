<template>
  <div class="page-container order-detail-page">
    <div class="detail-topbar">
      <div class="topbar-left">
        <n-button quaternary size="small" @click="router.push('/order-center/list')">← 返回订单列表</n-button>
        <template v-if="order">
          <h2 class="order-no">{{ order.order_no }}</h2>
          <n-tag :type="stateColors[order.status] || 'default'" size="small">{{ labelOf(statusOptions, order.status) }}</n-tag>
          <n-tag :type="payColors[order.pay_status] || 'warning'" size="small">{{ labelOf(payOptions, order.pay_status) }}</n-tag>
          <n-tag v-if="order.over_credit" type="error" size="small" :bordered="false">超额度</n-tag>
          <span class="muted">下单于 {{ formatDate(order.created_at) }}</span>
        </template>
      </div>
      <div v-if="order" class="topbar-actions">
        <n-button v-if="order.status === 'pending_approval'" type="warning" @click="approvalVisible = true">审批</n-button>
        <n-tooltip v-if="canDeliver" :disabled="!hasPendingAdjustment">
          <template #trigger>
            <span><n-button :disabled="hasPendingAdjustment" @click="deliverVisible = true">确认送达</n-button></span>
          </template>
          该订单有送达前改价待审批，同意或驳回后才能送达
        </n-tooltip>
        <n-button
          v-if="canAdjustPrice"
          :disabled="hasPendingAdjustment"
          :title="hasPendingAdjustment ? '改价审批中，请先处理审批' : undefined"
          @click="openPriceAdjust"
        >现场改价</n-button>
        <n-button v-if="canEditOrder && !editing" type="primary" @click="enterEdit">编辑订单</n-button>
        <n-button v-if="editing" @click="exitEdit">退出编辑</n-button>
      </div>
    </div>

    <n-spin :show="loading" class="detail-spin">
      <template v-if="order">
        <n-alert v-if="pendingAdjustment" type="warning" :bordered="false" class="pending-adjust-alert">
          <template #header>送达前改价待审批</template>
          <div class="pending-adjust-body">
            申请人 {{ pendingAdjustment.applicant_name || '—' }}（{{ formatDate(pendingAdjustment.created_at) }}）申请对
            {{ pendingAdjustment.items_count }} 个商品改价，原因：{{ pendingAdjustment.reason || '—' }}；金额变化
            <strong class="danger">{{ diffText(pendingAdjustment.total_diff_amount) }}</strong>。处理完成前不能送达。
          </div>
          <template #action>
            <n-space>
              <n-button size="small" type="primary" @click="openAdjustApprove">同意改价</n-button>
              <n-button size="small" type="error" secondary @click="openAdjustReject">驳回</n-button>
            </n-space>
          </template>
        </n-alert>

        <OrderEditForm
          v-if="editing"
          :key="`${order.id}-${order.version}`"
          :order="order"
          @cancel="exitEdit"
          @saved="onSaved"
        />

        <div v-else class="detail-sections">
          <!-- 订单信息 -->
          <n-card title="订单信息" size="small">
            <n-descriptions :column="4" bordered size="small">
              <n-descriptions-item label="客户">
                {{ order.customer_name }} {{ order.customer_phone || '' }}
                <n-tag v-if="order.is_walk_in" size="tiny" :bordered="false">散客</n-tag>
              </n-descriptions-item>
              <n-descriptions-item label="归属销售">{{ order.sales_name || '店家' }}</n-descriptions-item>
              <n-descriptions-item label="订单来源">{{ labelOf(sourceOptions, order.source) }}</n-descriptions-item>
              <n-descriptions-item label="送货方式">{{ labelOf(deliveryOptions, order.delivery_mode) }}</n-descriptions-item>

              <n-descriptions-item v-if="order.delivery_mode === 'route'" label="出车趟次">
                {{ order.route_trip_id ? `${order.route_trip_name || `#${order.route_trip_id}`}${order.route_trip_date ? `（${order.route_trip_date}）` : ''}` : '待排车' }}
              </n-descriptions-item>
              <n-descriptions-item v-if="order.delivery_mode === 'freight'" label="物流线路 / 批次">
                {{ order.freight_line_name || '待安排' }}
                <template v-if="order.freight_ship_date"> · {{ order.freight_ship_date }}</template>
                <template v-if="order.freight_depart_time"> {{ order.freight_depart_time }}</template>
              </n-descriptions-item>
              <n-descriptions-item v-if="order.delivery_mode === 'freight'" label="运费承担 / 运费">
                {{ freightModeLabel(order.freight_mode) }} · ¥{{ money(order.freight_cost) }}
              </n-descriptions-item>
              <n-descriptions-item label="送达时间">{{ order.delivered_at ? formatDate(order.delivered_at) : '未送达' }}</n-descriptions-item>
              <n-descriptions-item label="到期日">{{ order.due_date || '—' }}</n-descriptions-item>
              <n-descriptions-item label="创建人">{{ order.created_by_name || '—' }}</n-descriptions-item>
              <n-descriptions-item label="备注" :span="2">{{ order.remark || '—' }}</n-descriptions-item>
              <n-descriptions-item v-if="order.dispatch_note" label="调度备注" :span="4">{{ order.dispatch_note }}</n-descriptions-item>
              <n-descriptions-item v-if="order.reject_reason" label="驳回原因" :span="4">
                <span class="danger">{{ order.reject_reason }}</span>
              </n-descriptions-item>
            </n-descriptions>
          </n-card>

          <!-- 商品明细 -->
          <n-card title="商品明细" size="small">
            <template #header-extra>
              <n-button v-if="canEditOrder" text type="primary" size="small" @click="enterEdit">修改商品 / 改价</n-button>
            </template>
            <n-data-table :columns="itemColumns" :data="order.items" :bordered="false" size="small" :row-key="(r) => r.id" />
          </n-card>

          <!-- 付款信息与登记付款 -->
          <n-card title="付款信息" size="small">
            <div class="pay-summary">
              <div class="stat-item">
                <span class="stat-label">{{ order.delivered_amount != null ? '实送金额' : '订单金额' }}</span>
                <strong class="stat-value">¥{{ money(order.delivered_amount ?? order.total_amount) }}</strong>
              </div>
              <div class="stat-item">
                <span class="stat-label">已收金额</span>
                <strong class="stat-value success">¥{{ money(order.paid_amount) }}</strong>
              </div>
              <div class="stat-item">
                <span class="stat-label">抹零减免</span>
                <strong class="stat-value">¥{{ money(order.discount_amount) }}</strong>
              </div>
              <div v-if="Number(order.coupon_amount || 0) > 0" class="stat-item">
                <span class="stat-label">优惠券抵扣{{ order.coupon_name ? `（${order.coupon_name}）` : '' }}</span>
                <strong class="stat-value danger">−¥{{ money(order.coupon_amount) }}</strong>
              </div>
              <div v-if="Number(order.returned_amount || 0) > 0 || Number(order.return_settled_amount || 0) > 0" class="stat-item">
                <span class="stat-label">退货冲抵</span>
                <strong class="stat-value">¥{{ money(Number(order.returned_amount || 0) + Number(order.return_settled_amount || 0)) }}</strong>
              </div>
              <div class="stat-item">
                <span class="stat-label">剩余应收</span>
                <strong class="stat-value" :class="{ danger: Number(order.unpaid_amount) > 0 }">¥{{ money(order.unpaid_amount) }}</strong>
              </div>
            </div>

            <div v-if="canRecordPayment" class="payment-form-box">
              <div class="payment-form-head">
                <span class="form-title">登记付款</span>
                <span v-if="order.status !== 'delivered'" class="hint">当前订单尚未送达，登记的付款将作为预收款记录，送达时自动衔接。</span>
              </div>
              <div class="payment-form-grid">
                <label class="field">
                  <span>付款金额（元）</span>
                  <n-input v-model:value="payForm.amount" placeholder="请输入实收金额" />
                </label>
                <label class="field">
                  <span>收款方式</span>
                  <n-select v-model:value="payForm.method" :options="paymentMethods" />
                </label>
                <label class="field">
                  <span>抹零金额（选填）</span>
                  <n-input v-model:value="payForm.rounding_amount" placeholder="0.00" />
                </label>
                <label class="field">
                  <span>收款时间（选填）</span>
                  <n-date-picker
                    v-model:formatted-value="payForm.paid_at"
                    type="datetime"
                    value-format="yyyy-MM-dd HH:mm:ss"
                    clearable
                    placeholder="默认当前时间"
                  />
                </label>
                <label class="field remark-field">
                  <span>收款备注（选填）</span>
                  <n-input v-model:value="payForm.remark" placeholder="如：微信转账尾号 8821" />
                </label>
                <div class="field-btn">
                  <n-button type="primary" :loading="paySaving" @click="submitPayment">确认收款</n-button>
                </div>
              </div>
            </div>

            <template v-if="order.payments && order.payments.length > 0">
              <h4 class="sub-title">收款记录</h4>
              <n-data-table :columns="paymentColumns" :data="order.payments" :bordered="false" size="small" />
            </template>

            <template v-if="order.return_settlements && order.return_settlements.length > 0">
              <h4 class="sub-title">退货挂账平单记录</h4>
              <n-data-table :columns="settlementColumns" :data="order.return_settlements" :bordered="false" size="small" />
            </template>
          </n-card>

          <!-- 利润构成（仅管理员） -->
          <n-card v-if="order.profit != null" title="利润构成" size="small">
            <div class="profit-grid">
              <div class="stat-item">
                <span class="stat-label">销售额</span>
                <strong class="stat-value">¥{{ money(salesAmount) }}</strong>
              </div>
              <div class="stat-item">
                <span class="stat-label">商品成本</span>
                <strong class="stat-value">¥{{ money(order.goods_cost) }}</strong>
              </div>
              <div class="stat-item">
                <span class="stat-label">发货运费</span>
                <strong class="stat-value">¥{{ money(order.freight_cost) }}</strong>
              </div>
              <div class="stat-item">
                <span class="stat-label">退货运费</span>
                <strong class="stat-value">¥{{ money(order.return_freight_cost) }}</strong>
              </div>
              <div class="stat-item">
                <span class="stat-label">抹零减免</span>
                <strong class="stat-value">¥{{ money(order.discount_amount) }}</strong>
              </div>
              <div v-if="Number(order.coupon_amount || 0) > 0" class="stat-item">
                <span class="stat-label">优惠券抵扣{{ order.coupon_name ? `（${order.coupon_name}）` : '' }}</span>
                <strong class="stat-value danger">−¥{{ money(order.coupon_amount) }}</strong>
              </div>
              <div v-if="order.commission_amount != null" class="stat-item">
                <span class="stat-label">订单提成</span>
                <strong class="stat-value warning">¥{{ money(order.commission_amount) }}</strong>
              </div>
              <div class="stat-item">
                <span class="stat-label">订单利润</span>
                <strong class="stat-value danger">¥{{ money(order.profit) }}</strong>
              </div>
            </div>
          </n-card>

          <!-- 审批记录 -->
          <n-card
            v-if="approvalHistory.length > 0 || order.status === 'pending_approval' || order.status === 'rejected'"
            title="审批记录"
            size="small"
          >
            <n-data-table :columns="historyColumns" :data="approvalHistory" :bordered="false" size="small" />
          </n-card>
        </div>
      </template>
      <n-empty v-else-if="!loading" description="订单不存在或无权查看" />
    </n-spin>

    <OrderDeliverModal v-model:show="deliverVisible" :order="order" @success="afterAction" />
    <OrderApprovalModal v-model:show="approvalVisible" :order-id="order?.id ?? null" @success="afterAction" />

    <n-modal v-model:show="purchaseVisible" preset="card" :title="purchaseItem?.purchase_receipt_id ? '更正拿货' : '确认拿货'" style="width: 520px; max-width: 95vw">
      <div v-if="purchaseItem" class="purchase-form">
        <label>商品<n-input :value="`${purchaseItem.spu_name} ${purchaseItem.sku_spec}`" readonly /></label>
        <label>本次拿货供应商<n-select v-model:value="purchaseSupplierId" :options="supplierOptions" :disabled="!purchaseItem.purchase_receipt_id" filterable /></label>
        <label>实际进价<n-input v-model:value="purchaseCost" placeholder="每个销售规格的进价，最多 4 位小数" /></label>
        <template v-if="!purchaseItem.purchase_receipt_id && purchaseSupplierId > 0">
          <label>本次已付款<n-input v-model:value="purchasePaid" placeholder="留空表示尚未付款" /></label>
          <label v-if="purchasePaid">付款方式<n-select v-model:value="purchaseMethod" :options="paymentMethods" /></label>
        </template>
        <label v-if="purchaseItem.purchase_receipt_id">更正原因<n-input v-model:value="purchaseReason" placeholder="必填" /></label>
        <div class="purchase-actions">
          <n-button @click="purchaseVisible = false">取消</n-button>
          <n-button type="primary" :loading="purchaseSaving" @click="savePurchase">保存</n-button>
        </div>
      </div>
    </n-modal>

    <!-- 现场改价弹窗 -->
    <n-modal v-model:show="priceAdjustVisible" preset="card" title="现场改价" style="width: 760px; max-width: 95vw">
      <template v-if="order">
        <p class="modal-note">修改需要调整的单价，未修改的行不会提交；管理员提交后立即生效。</p>
        <n-data-table :columns="priceAdjustColumns" :data="priceAdjustRows" :bordered="false" size="small" />
        <label class="field-label" style="margin-top: 14px">
          <span>改价原因（选填）</span>
          <n-input
            v-model:value="priceAdjustReason"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            maxlength="200"
            show-count
            placeholder="例如：临期让价 / 客户现场议价"
          />
        </label>
      </template>
      <template #footer>
        <n-button @click="priceAdjustVisible = false">取消</n-button>
        <n-button type="primary" :loading="priceAdjustSaving" @click="submitPriceAdjust">提交改价</n-button>
      </template>
    </n-modal>

    <!-- 同意改价弹窗 -->
    <n-modal v-model:show="adjustApproveVisible" preset="card" title="同意送达前改价" style="width: 520px; max-width: 95vw">
      <div v-if="pendingAdjustment" class="adjust-modal-form">
        <div class="summary-box">
          <div><strong>{{ order?.order_no }}</strong> · {{ order?.customer_name }}</div>
          <div class="summary-sub">
            申请人：{{ pendingAdjustment.applicant_name || '—' }} · 金额变化
            <strong class="danger">{{ diffText(pendingAdjustment.total_diff_amount) }}</strong>
          </div>
        </div>
        <label class="field-label">
          <span>审批意见（选填）</span>
          <n-input
            v-model:value="adjustApproveComment"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            maxlength="200"
            show-count
            placeholder="例如：客户要求按新价格执行"
          />
        </label>
      </div>
      <template #footer>
        <n-button @click="adjustApproveVisible = false">取消</n-button>
        <n-button type="primary" :loading="adjustSubmitting" @click="confirmAdjustApprove">确认同意改价</n-button>
      </template>
    </n-modal>

    <!-- 驳回改价弹窗 -->
    <n-modal v-model:show="adjustRejectVisible" preset="card" title="驳回送达前改价" style="width: 520px; max-width: 95vw">
      <div v-if="pendingAdjustment" class="adjust-modal-form">
        <div class="summary-box warn">
          <div><strong>{{ order?.order_no }}</strong> · {{ order?.customer_name }}</div>
          <div class="summary-sub">申请人：{{ pendingAdjustment.applicant_name || '—' }} · 申请原因：{{ pendingAdjustment.reason || '—' }}</div>
        </div>
        <label class="field-label">
          <span>驳回原因（必填）</span>
          <n-input
            v-model:value="adjustRejectComment"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 5 }"
            maxlength="200"
            show-count
            placeholder="请填写驳回原因，申请人将看到该原因"
          />
        </label>
      </div>
      <template #footer>
        <n-button @click="adjustRejectVisible = false">取消</n-button>
        <n-button type="error" :loading="adjustSubmitting" @click="confirmAdjustReject">确认驳回</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NInput, NTag, useMessage, type DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import { fetchAllPages, financeApi, orderApi, purchaseApi, vendorApi } from '@/api'
import type { OrderApprovalRecord, OrderListItem, OrderPaymentRecord, OrderReturnSettlementRecord } from '@/types'
import { formatDate } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import OrderDeliverModal from '@/components/OrderDeliverModal.vue'
import OrderApprovalModal from '@/components/OrderApprovalModal.vue'
import OrderEditForm from './OrderEditForm.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const message = useMessage()

const loading = ref(true)
const order = ref<OrderListItem | null>(null)
const approvalHistory = ref<OrderApprovalRecord[]>([])
const editing = ref(false)
const deliverVisible = ref(false)
const approvalVisible = ref(false)

const purchaseVisible = ref(false)
const purchaseSaving = ref(false)
const purchaseItem = ref<OrderListItem['items'][number] | null>(null)
const purchaseSupplierId = ref(0)
const purchaseCost = ref('')
const purchasePaid = ref('')
const purchaseMethod = ref<'wechat' | 'alipay' | 'cash' | 'other'>('cash')
const purchaseReason = ref('')
const purchaseVersion = ref(0)
const pendingReceipts = new Map<number, { id: number; version: number; unitCost: string }>()
const suppliers = ref<{ id: number; name: string }[]>([])
const supplierOptions = computed(() => [{ label: '自己进货', value: 0 }, ...suppliers.value.map(v => ({ label: v.name, value: v.id }))])

interface PriceAdjustRow {
  order_item_id: number
  name: string
  unit: string
  quantity: number
  currentPrice: number
  newPrice: string
}

const priceAdjustVisible = ref(false)
const priceAdjustRows = ref<PriceAdjustRow[]>([])
const priceAdjustReason = ref('')
const priceAdjustSaving = ref(false)
const adjustApproveVisible = ref(false)
const adjustRejectVisible = ref(false)
const adjustApproveComment = ref('')
const adjustRejectComment = ref('')
const adjustSubmitting = ref(false)

const paySaving = ref(false)
const payForm = reactive<{
  amount: string
  rounding_amount: string
  method: 'wechat' | 'alipay' | 'cash' | 'other'
  paid_at: string | null
  remark: string
}>({
  amount: '',
  rounding_amount: '',
  method: 'wechat',
  paid_at: null,
  remark: '',
})

const paymentMethods = [
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '现金', value: 'cash' },
  { label: '其他', value: 'other' },
]
const sourceOptions = [
  { label: '线路询单', value: 'route_call' },
  { label: '客户来电', value: 'phone_in' },
  { label: '小程序', value: 'miniprogram' },
  { label: '门店零售', value: 'counter' },
]
const deliveryOptions = [
  { label: '开车自送', value: 'route' },
  { label: '发物流', value: 'freight' },
  { label: '城区自送', value: 'local' },
  { label: '现场提货', value: 'pickup' },
]
const statusOptions = [
  { label: '待审批', value: 'pending_approval' },
  { label: '待配送', value: 'pending' },
  { label: '配送中', value: 'delivering' },
  { label: '已送达', value: 'delivered' },
  { label: '已取消', value: 'cancelled' },
  { label: '已驳回', value: 'rejected' },
]
const payOptions = [
  { label: '未付款', value: 'unpaid' },
  { label: '部分付款', value: 'partial' },
  { label: '已付清', value: 'paid' },
]
const stateColors: Record<string, 'warning' | 'info' | 'success' | 'error' | 'default'> = {
  pending_approval: 'warning',
  pending: 'info',
  delivering: 'info',
  delivered: 'success',
  cancelled: 'default',
  rejected: 'error',
}
const payColors: Record<string, 'warning' | 'info' | 'success'> = {
  unpaid: 'warning',
  partial: 'info',
  paid: 'success',
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
const diffText = (v: number | string | null | undefined) => {
  const n = Number(v || 0)
  return n === 0 ? '无变化' : `${n > 0 ? '+' : '−'}¥${Math.abs(n).toFixed(2)}`
}
const labelOf = (options: { label: string; value: string }[], value: string) => options.find(o => o.value === value)?.label || value
const freightModeLabel = (mode?: string) => ({ deduct: '包邮·客户垫付抵扣', store_paid: '包邮·本店直接付', customer_paid: '不包邮·客户自付', none: '无' }[mode || 'none'] || mode || '—')

const canEdit = computed(() => auth.user?.role === 'admin' || auth.user?.permissions?.includes('order.edit') || auth.user?.permissions?.includes('*'))
const canEditOrder = computed(() => Boolean(order.value && canEdit.value && !['cancelled', 'rejected'].includes(order.value.status) && order.value.pay_status !== 'paid'))
const canDeliver = computed(() => Boolean(order.value && ['pending', 'delivering'].includes(order.value.status)))
const pendingAdjustment = computed(() => order.value?.pending_price_adjustment || null)
const hasPendingAdjustment = computed(() => Boolean(pendingAdjustment.value))
const canAdjustPrice = computed(() => Boolean(order.value && ['pending', 'delivering'].includes(order.value.status)))
const canRecordPayment = computed(() => Boolean(
  order.value
  && !order.value.is_walk_in
  && !['cancelled', 'rejected'].includes(order.value.status)
  && Number(order.value.unpaid_amount || 0) > 0
))
const salesAmount = computed(() => {
  if (!order.value) return 0
  const base = order.value.delivered_amount != null ? Number(order.value.delivered_amount) : Number(order.value.total_amount)
  return Math.max(0, base - Number(order.value.returned_amount || 0))
})

const itemColumns = computed<DataTableColumns<OrderListItem['items'][number]>>(() => {
  const cols: DataTableColumns<OrderListItem['items'][number]> = [
    { title: '商品', key: 'spu_name', minWidth: 150 },
    { title: '规格', key: 'sku_spec', width: 120 },
    { title: '下单数量', key: 'quantity', width: 95, render: r => `${r.quantity}${r.unit || ''}` },
  ]
  if (order.value?.status === 'delivered') {
    cols.push({ title: '实送数量', key: 'delivered_quantity', width: 95, render: r => `${r.delivered_quantity ?? r.quantity}${r.unit || ''}` })
  }
  if (order.value && order.value.return_status !== 'none') {
    cols.push({ title: '已退', key: 'returned_quantity', width: 85, render: r => Number(r.returned_quantity || 0) > 0 ? `${r.returned_quantity}${r.unit || ''}` : '—' })
  }
  cols.push(
    {
      title: '售价',
      key: 'unit_price',
      width: 150,
      render: r => {
        const original = r.original_unit_price
        const changed = original != null && original !== '' && Number(original) !== Number(r.unit_price)
        return h('div', { class: 'price-view' }, [
          ...(changed
            ? [h('span', { class: 'price-orig' }, `¥${money(original)}`), h('span', { class: 'price-arrow' }, '→')]
            : []),
          h('span', { class: changed ? 'price-new' : '' }, `¥${money(r.unit_price)}`),
          ...(r.price_source === 'manual' ? [h(NTag, { size: 'tiny', type: 'warning', bordered: false }, { default: () => '手改' })] : []),
        ])
      },
    },
    { title: '拿货供应商', key: 'supplier_name', width: 130, render: r => r.supplier_name || '自己进货' },
    { title: '成本', key: 'cost_price', width: 140, render: r => `¥${money(r.cost_price)}（${r.cost_status === 'actual' ? '实际' : '估计'}）` },
    { title: '金额', key: 'amount', width: 105, render: r => `¥${money(r.amount)}` },
    {
      title: 'SKU 利润',
      key: 'sku_profit',
      width: 105,
      render: r => {
        const qty = Number(r.delivered_quantity ?? r.quantity) || 0
        const profit = qty * ((Number(r.unit_price) || 0) - (Number(r.cost_price) || 0))
        return h('span', { class: 'profit-txt' }, `¥${profit.toFixed(2)}`)
      },
    },
    {
      title: 'SKU 提成',
      key: 'commission_amount',
      width: 145,
      render: r => {
        if (r.commission_amount == null) return '—'
        const rateText = r.commission_rate != null ? `（${(Number(r.commission_rate) * 100).toFixed(2)}%）` : ''
        return h('span', { class: 'commission-txt' }, `¥${money(r.commission_amount)}${rateText}`)
      },
    },
    {
      title: '拿货',
      key: 'purchase',
      width: 95,
      render: r => r.purchase_receipt_id || !['cancelled', 'rejected'].includes(order.value?.status || '')
        ? h(NButton, { text: true, type: 'primary', size: 'small', onClick: () => openPurchase(r) }, { default: () => r.purchase_receipt_id ? '更正拿货' : '确认拿货' })
        : '—',
    },
  )
  return cols
})

const priceAdjustColumns: DataTableColumns<PriceAdjustRow> = [
  { title: '商品', key: 'name' },
  { title: '数量', key: 'quantity', width: 100, render: r => `${r.quantity}${r.unit}` },
  { title: '当前单价', key: 'currentPrice', width: 110, render: r => `¥${money(r.currentPrice)}` },
  {
    title: '新单价',
    key: 'newPrice',
    width: 170,
    render: (r) =>
      h(NInput, {
        value: r.newPrice,
        size: 'small',
        placeholder: money(r.currentPrice),
        onUpdateValue: (value: string) => {
          r.newPrice = value
        },
      }),
  },
]

const paymentColumns: DataTableColumns<OrderPaymentRecord> = [
  { title: '收款时间', key: 'paid_at', width: 165, render: r => formatDate(r.paid_at) },
  {
    title: '渠道',
    key: 'channel',
    width: 120,
    render: r => r.channel === 'wx_miniprogram'
      ? h(NTag, { type: 'success', size: 'small', bordered: false }, { default: () => '小程序微信支付' })
      : h(NTag, { type: 'default', size: 'small', bordered: false }, { default: () => '线下登记' }),
  },
  { title: '收款方式', key: 'method', width: 90, render: r => labelOf(paymentMethods, r.method) },
  { title: '本单核销金额', key: 'amount', width: 120, render: r => `¥${money(r.amount)}` },
  { title: '抹零', key: 'rounding_amount', width: 90, render: r => Number(r.rounding_amount || 0) > 0 ? `¥${money(r.rounding_amount)}` : '—' },
  { title: '微信交易单号', key: 'wx_transaction_id', width: 185, ellipsis: { tooltip: true }, render: r => r.wx_transaction_id || '—' },
  { title: '操作人', key: 'operator_name', render: r => r.operator_name || '—' },
]

const settlementColumns: DataTableColumns<OrderReturnSettlementRecord> = [
  { title: '平单时间', key: 'created_at', width: 165, render: r => formatDate(r.created_at) },
  { title: '来源退货单', key: 'return_no', width: 160 },
  { title: '抵扣金额', key: 'amount', render: r => `¥${money(r.amount)}` },
]

const historyColumns: DataTableColumns<OrderApprovalRecord> = [
  { title: '时间', key: 'created_at', width: 165, render: r => formatDate(r.created_at) },
  {
    title: '动作',
    key: 'action',
    width: 100,
    render: r => {
      const meta = ACTION_LABELS[r.action] || { label: r.action, type: 'default' as const }
      return h(NTag, { type: meta.type, size: 'small' }, { default: () => meta.label })
    },
  },
  { title: '操作人', key: 'operator_name', width: 110, render: r => r.operator_name || '系统' },
  { title: '当时金额', key: 'order_amount', width: 110, render: r => `¥${money(r.order_amount)}` },
  { title: '说明 / 意见', key: 'comment', render: r => r.comment || '—' },
]

function syncPaymentDefaults(target: OrderListItem) {
  payForm.amount = Number(target.unpaid_amount || 0) > 0 ? money(target.unpaid_amount) : ''
  payForm.rounding_amount = ''
  payForm.paid_at = null
  payForm.remark = ''
}

async function load(applyQueryEdit = false) {
  const id = Number(route.params.id)
  if (!id) return
  loading.value = true
  try {
    const [detail, history] = await Promise.all([
      orderApi.get(id),
      orderApi.approvalHistory(id).catch(() => []),
    ])
    order.value = detail
    approvalHistory.value = history
    syncPaymentDefaults(detail)
    if (applyQueryEdit && route.query.edit === '1') {
      if (canEditOrder.value) {
        editing.value = true
      } else {
        message.warning('当前订单状态不可编辑')
        editing.value = false
      }
    }
  } finally {
    loading.value = false
  }
}

function enterEdit() {
  if (!canEditOrder.value) return
  editing.value = true
}

function exitEdit() {
  editing.value = false
  if (route.query.edit) {
    void router.replace({ path: `/order-center/detail/${route.params.id}` })
  }
}

async function onSaved() {
  editing.value = false
  if (route.query.edit) {
    void router.replace({ path: `/order-center/detail/${route.params.id}` })
  }
  await load()
}

async function afterAction() {
  await load()
}

function openPriceAdjust() {
  if (!order.value) return
  priceAdjustRows.value = order.value.items.map((item) => ({
    order_item_id: item.id,
    name: `${item.spu_name} ${item.sku_spec || ''}`.trim(),
    unit: item.unit,
    quantity: Number(item.quantity),
    currentPrice: Number(item.unit_price),
    newPrice: money(item.unit_price),
  }))
  priceAdjustReason.value = ''
  priceAdjustVisible.value = true
}

async function submitPriceAdjust() {
  if (!order.value) return
  const items: { order_item_id: number; new_unit_price: string }[] = []
  for (const row of priceAdjustRows.value) {
    const raw = row.newPrice.trim()
    if (!/^\d+(?:\.\d{1,4})?$/.test(raw)) {
      message.warning(`请填写有效的单价：${row.name}`)
      return
    }
    if (Number(raw) !== row.currentPrice) {
      items.push({ order_item_id: row.order_item_id, new_unit_price: raw })
    }
  }
  if (!items.length) {
    message.warning('没有需要提交的改价行')
    return
  }
  priceAdjustSaving.value = true
  try {
    await orderApi.createOrderPriceAdjustment(order.value.id, {
      items,
      reason: priceAdjustReason.value.trim() || undefined,
    })
    message.success('改价已生效')
    priceAdjustVisible.value = false
    await load()
  } finally {
    priceAdjustSaving.value = false
  }
}

function openAdjustApprove() {
  adjustApproveComment.value = ''
  adjustApproveVisible.value = true
}

function openAdjustReject() {
  adjustRejectComment.value = ''
  adjustRejectVisible.value = true
}

async function confirmAdjustApprove() {
  if (!pendingAdjustment.value) return
  adjustSubmitting.value = true
  try {
    await orderApi.approveOrderPriceAdjustment(pendingAdjustment.value.id, adjustApproveComment.value.trim() || null)
    message.success('改价已同意')
    adjustApproveVisible.value = false
    await load()
  } finally {
    adjustSubmitting.value = false
  }
}

async function confirmAdjustReject() {
  if (!pendingAdjustment.value) return
  const comment = adjustRejectComment.value.trim()
  if (!comment) {
    message.warning('请填写驳回原因')
    return
  }
  adjustSubmitting.value = true
  try {
    await orderApi.rejectOrderPriceAdjustment(pendingAdjustment.value.id, comment)
    message.success('改价已驳回')
    adjustRejectVisible.value = false
    await load()
  } finally {
    adjustSubmitting.value = false
  }
}

async function submitPayment() {
  if (!order.value) return
  const amountVal = payForm.amount.trim()
  const roundingVal = payForm.rounding_amount.trim() || '0'
  if (!/^\d+(?:\.\d{1,2})?$/.test(amountVal) || Number(amountVal) <= 0) {
    message.warning('请填写有效的付款金额（大于 0，最多 2 位小数）')
    return
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(roundingVal) || Number(roundingVal) < 0) {
    message.warning('请填写有效的抹零金额（最多 2 位小数）')
    return
  }
  const allocAmount = Number(amountVal) + Number(roundingVal)
  const unpaid = Number(order.value.unpaid_amount || 0)
  if (allocAmount > unpaid + 0.0001) {
    message.warning(`实收 + 抹零（¥${allocAmount.toFixed(2)}）不能超过本单剩余应收（¥${unpaid.toFixed(2)}）`)
    return
  }
  paySaving.value = true
  try {
    await financeApi.createPayment({
      customer_id: order.value.customer_id,
      amount: Number(amountVal).toFixed(2),
      rounding_amount: Number(roundingVal) > 0 ? Number(roundingVal).toFixed(2) : undefined,
      method: payForm.method,
      paid_at: payForm.paid_at ? dayjs(payForm.paid_at).toISOString() : undefined,
      allocations: [{ order_id: order.value.id, amount: allocAmount.toFixed(2) }],
      remark: payForm.remark.trim() || undefined,
    })
    message.success('收款已登记')
    await load()
  } finally {
    paySaving.value = false
  }
}

async function openPurchase(row: OrderListItem['items'][number]) {
  purchaseItem.value = row
  purchaseSupplierId.value = row.supplier_id || 0
  purchaseCost.value = String(row.cost_price || '0')
  purchasePaid.value = ''
  purchaseReason.value = ''
  if (row.purchase_receipt_id) {
    const receipt = await purchaseApi.get(row.purchase_receipt_id)
    purchaseVersion.value = receipt.version
    purchaseCost.value = receipt.items[0]?.unit_cost || purchaseCost.value
  } else {
    purchaseVersion.value = pendingReceipts.get(row.id)?.version || 0
  }
  purchaseVisible.value = true
}

async function savePurchase() {
  if (!order.value || !purchaseItem.value) return
  if (!/^\d+(?:\.\d{1,4})?$/.test(purchaseCost.value)) {
    message.warning('请填写有效实际进价')
    return
  }
  if (purchasePaid.value && (!/^\d+(?:\.\d{1,2})?$/.test(purchasePaid.value) || Number(purchasePaid.value) <= 0)) {
    message.warning('请填写有效付款金额')
    return
  }
  if (purchaseItem.value.purchase_receipt_id && !purchaseReason.value.trim()) {
    message.warning('请填写更正原因')
    return
  }
  purchaseSaving.value = true
  try {
    if (purchaseItem.value.purchase_receipt_id) {
      await purchaseApi.update(purchaseItem.value.purchase_receipt_id, {
        version: purchaseVersion.value,
        vendor_id: purchaseSupplierId.value,
        unit_cost: purchaseCost.value,
        reason: purchaseReason.value.trim(),
      })
    } else {
      if (purchaseSupplierId.value !== (purchaseItem.value.supplier_id || 0)) {
        message.warning('请先进入编辑态修改拿货供应商')
        return
      }
      const cached = pendingReceipts.get(purchaseItem.value.id)
      const receipt = cached || await purchaseApi.create({
        source_type: 'order',
        vendor_id: purchaseSupplierId.value,
        items: [{ order_item_id: purchaseItem.value.id, sku_id: purchaseItem.value.sku_id, quantity: String(purchaseItem.value.quantity), unit_cost: purchaseCost.value }],
      })
      pendingReceipts.set(purchaseItem.value.id, { id: receipt.id, version: receipt.version, unitCost: cached?.unitCost || purchaseCost.value })
      let version = receipt.version
      if (cached && cached.unitCost !== purchaseCost.value) {
        const changed = await purchaseApi.update(receipt.id, { version, unit_cost: purchaseCost.value })
        version = changed.purchase_receipt.version
        pendingReceipts.set(purchaseItem.value.id, { id: receipt.id, version, unitCost: purchaseCost.value })
      }
      await purchaseApi.confirm(receipt.id, version, purchasePaid.value ? { method: purchaseMethod.value, amount: purchasePaid.value } : undefined)
      pendingReceipts.delete(purchaseItem.value.id)
    }
    purchaseVisible.value = false
    message.success('拿货记录已保存')
    await load()
  } finally {
    purchaseSaving.value = false
  }
}

watch(() => route.params.id, () => {
  editing.value = false
  void load(true)
})

onMounted(() => {
  void load(true)
  void fetchAllPages(p => vendorApi.list({ page: p, page_size: 20 })).then(v => { suppliers.value = v }).catch(() => {})
})
</script>

<style scoped>
.order-detail-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100%;
  box-sizing: border-box;
}
.detail-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #eef0f3;
}
.topbar-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.order-no {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.detail-spin {
  flex: 1;
}
.detail-sections {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.muted {
  font-size: 12px;
  color: #64748b;
}
.danger {
  color: #dc2626;
  font-weight: 600;
}
.success {
  color: #15803d;
}
.warning,
.commission-txt {
  color: #ea580c;
  font-weight: 600;
}
.profit-txt {
  color: #dc2626;
  font-weight: 600;
}
.price-view {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.price-orig {
  color: #94a3b8;
  text-decoration: line-through;
}
.price-arrow {
  color: #94a3b8;
}
.price-new {
  font-weight: 600;
}
.pending-adjust-alert {
  margin-bottom: 14px;
}
.pending-adjust-body {
  font-size: 13px;
  line-height: 1.6;
}
.modal-note {
  margin: 0 0 12px;
  color: #64748b;
  font-size: 13px;
}
.adjust-modal-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.summary-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.6;
}
.summary-box.warn {
  background: #fff7ed;
  border-color: #fed7aa;
}
.summary-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}
.field-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}
.pay-summary,
.profit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}
.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}
.stat-label {
  font-size: 12px;
  color: #64748b;
}
.stat-value {
  font-size: 16px;
  font-weight: 600;
}
.payment-form-box {
  margin-top: 14px;
  padding: 14px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
}
.payment-form-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}
.form-title {
  font-size: 14px;
  font-weight: 600;
  color: #92400e;
}
.hint {
  font-size: 12px;
  color: #78716c;
}
.payment-form-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(130px, 1fr));
  gap: 12px;
  align-items: end;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  color: #475569;
}
.remark-field {
  grid-column: span 1;
}
.field-btn {
  display: flex;
  justify-content: flex-end;
}
.sub-title {
  margin: 16px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}
.purchase-form {
  display: grid;
  gap: 12px;
}
.purchase-form label {
  display: grid;
  gap: 5px;
}
.purchase-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
@media (max-width: 1100px) {
  .payment-form-grid {
    grid-template-columns: repeat(3, minmax(130px, 1fr));
  }
}
@media (max-width: 640px) {
  .payment-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
