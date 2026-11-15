<template>
  <div class="page-container">
    <n-card title="供应商往来">
      <n-space align="center">
        <n-select v-model:value="vendorId" :options="options" filterable placeholder="选择供应商" style="width: 260px" @update:value="resetPage" />
        <n-date-picker v-model:value="dateRange" type="daterange" clearable @update:value="resetPage" />
        <n-button :disabled="!vendorId" @click="load">刷新</n-button>
        <n-button type="primary" :disabled="!vendorId" @click="paymentVisible = true">登记付款</n-button>
      </n-space>
      <n-space v-if="account" class="summary">
        <n-statistic label="当前应付" :value="account.payable_balance" prefix="¥" />
        <n-statistic label="累计进货" :value="account.total_purchases" prefix="¥" />
        <n-statistic label="累计付款" :value="account.total_payments" prefix="¥" />
      </n-space>
      <n-data-table :columns="columns" :data="entries" :loading="loading" :bordered="false" />
      <n-pagination v-if="total > 20" v-model:page="page" :page-size="20" :item-count="total" @update:page="load" />
    </n-card>
    <n-modal v-model:show="paymentVisible" preset="card" title="登记供应商付款" style="width: 420px">
      <n-space vertical>
        <n-input v-model:value="amount" placeholder="付款金额" />
        <n-select v-model:value="method" :options="methods" />
        <n-date-picker v-model:value="paymentTime" type="datetime" clearable placeholder="付款时间，默认现在" />
        <n-input v-model:value="remark" placeholder="备注（可选）" />
        <n-button type="primary" :loading="saving" @click="pay">确认付款</n-button>
      </n-space>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, onMounted, ref } from 'vue'
import { NButton, type DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import { fetchAllPages, vendorApi } from '@/api'
import type { VendorAccount, VendorLedgerEntry } from '@/types'

const message = useMessage()
const vendorId = ref<number | null>(null)
const options = ref<{ label: string; value: number }[]>([])
const account = ref<VendorAccount | null>(null)
const dateRange = ref<[number, number] | null>(null)
const entries = ref<VendorLedgerEntry[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const paymentVisible = ref(false)
const saving = ref(false)
const amount = ref('')
const method = ref('cash')
const paymentTime = ref<number | null>(null)
const remark = ref('')
const methods = [{ label: '现金', value: 'cash' }, { label: '微信', value: 'wechat' }, { label: '支付宝', value: 'alipay' }, { label: '其他', value: 'other' }]
const labels: Record<string, string> = { purchase: '进货应付', payment: '付款', correction_reversal: '更正冲回', correction_new: '更正应付' }
const columns: DataTableColumns<VendorLedgerEntry> = [
  { title: '入账时间', key: 'occurred_at', render: row => new Date(row.occurred_at).toLocaleString('zh-CN') },
  { title: '类型', key: 'type', render: row => labels[row.type] || row.type },
  { title: '采购单', key: 'purchase_receipt_id', render: row => row.purchase_receipt_id ? `#${row.purchase_receipt_id}` : '—' },
  { title: '订单', key: 'order_id', render: row => row.order_id ? `#${row.order_id}` : '—' },
  { title: '变动金额', key: 'amount', render: row => `¥${Number(row.amount).toFixed(2)}` },
  { title: '变动后余额', key: 'balance_after', render: row => `¥${Number(row.balance_after).toFixed(2)}` },
  { title: '操作人', key: 'operator_name' },
  { title: '备注', key: 'remark', render: row => row.remark || '—' },
]
function resetPage() { page.value = 1; void load() }
async function load() {
  if (!vendorId.value) { account.value = null; entries.value = []; return }
  loading.value = true
  try {
    const [accountData, pageData] = await Promise.all([vendorApi.account(vendorId.value), vendorApi.ledger(vendorId.value, {
      page: page.value, page_size: 20,
      date_from: dateRange.value ? dayjs(dateRange.value[0]).format('YYYY-MM-DD') : undefined,
      date_to: dateRange.value ? dayjs(dateRange.value[1]).format('YYYY-MM-DD') : undefined,
    })])
    account.value = accountData
    entries.value = pageData.items
    total.value = pageData.total
  } finally { loading.value = false }
}
async function pay() {
  if (!vendorId.value || !/^\d+(?:\.\d{1,2})?$/.test(amount.value) || Number(amount.value) <= 0) { message.warning('请填写有效付款金额'); return }
  saving.value = true
  try {
    await vendorApi.pay({ vendor_id: vendorId.value, amount: amount.value, method: method.value,
      paid_at: paymentTime.value ? new Date(paymentTime.value).toISOString() : undefined, remark: remark.value })
    paymentVisible.value = false
    amount.value = ''; remark.value = ''; paymentTime.value = null
    await load()
    message.success('付款已登记')
  } finally { saving.value = false }
}
onMounted(async () => { options.value = (await fetchAllPages(page => vendorApi.list({ page, page_size: 20 }))).map(v => ({ label: v.name, value: v.id })) })
</script>

<style scoped>
.summary{margin:24px 0}.n-pagination{margin-top:16px;justify-content:flex-end}
</style>
