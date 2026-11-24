<template>
  <div class="payment-records-page">
    <n-card title="支付记录" size="small">
      <template #header-extra>
        <n-space>
          <n-button size="small" @click="loadData">刷新</n-button>
        </n-space>
      </template>

      <div class="filter-bar">
        <n-input
          v-model:value="filters.keyword"
          placeholder="搜索客户名 / 订单号 / 微信交易单号"
          clearable
          style="width: 260px"
          @keyup.enter="onSearch"
        />
        <n-select
          v-model:value="filters.channel"
          :options="channelOptions"
          placeholder="全部渠道"
          clearable
          style="width: 160px"
          @update:value="onSearch"
        />
        <n-select
          v-model:value="filters.method"
          :options="methodOptions"
          placeholder="全部方式"
          clearable
          style="width: 140px"
          @update:value="onSearch"
        />
        <n-date-picker
          v-model:formatted-value="filters.dateRange"
          type="daterange"
          value-format="yyyy-MM-dd"
          clearable
          style="width: 260px"
          @update:formatted-value="onSearch"
        />
        <n-button type="primary" @click="onSearch">查询</n-button>
        <n-button @click="onReset">重置</n-button>
      </div>

      <n-data-table
        remote
        :loading="loading"
        :columns="columns"
        :data="rows"
        :pagination="pagination"
        :bordered="false"
        size="small"
        @update:page="onPageChange"
        @update:page-size="onPageSizeChange"
      />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NSpace, NTag, useMessage, type DataTableColumns } from 'naive-ui'
import { financeApi } from '@/api'
import type { PaymentRecordItem } from '@/types'
import { PAYMENT_METHOD } from '@/utils/dict'

const router = useRouter()
const message = useMessage()

const loading = ref(false)
const rows = ref<PaymentRecordItem[]>([])

const filters = reactive<{
  keyword: string
  channel: 'offline' | 'wx_miniprogram' | null
  method: string | null
  dateRange: [string, string] | null
}>({
  keyword: '',
  channel: null,
  method: null,
  dateRange: null,
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [20, 50, 100],
})

const channelOptions = [
  { label: '小程序微信支付', value: 'wx_miniprogram' },
  { label: '线下登记收款', value: 'offline' },
]

const methodOptions = [
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '现金', value: 'cash' },
  { label: '其他', value: 'other' },
]

function money(val: number | string | null | undefined): string {
  return Number(val || 0).toFixed(2)
}

function formatDate(val?: string | null): string {
  if (!val) return '—'
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return val
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const columns: DataTableColumns<PaymentRecordItem> = [
  { title: '支付时间', key: 'paid_at', width: 155, render: (r) => formatDate(r.paid_at) },
  { title: '客户', key: 'customer_name', width: 150, ellipsis: { tooltip: true } },
  {
    title: '来源渠道',
    key: 'channel',
    width: 130,
    render: (r) =>
      r.channel === 'wx_miniprogram'
        ? h(NTag, { type: 'success', size: 'small', bordered: false }, { default: () => '小程序微信支付' })
        : h(NTag, { type: 'default', size: 'small', bordered: false }, { default: () => '线下登记' }),
  },
  {
    title: '方式',
    key: 'method',
    width: 85,
    render: (r) => PAYMENT_METHOD[r.method as keyof typeof PAYMENT_METHOD] || r.method,
  },
  {
    title: '实收金额',
    key: 'amount',
    width: 110,
    render: (r) => h('strong', { style: 'color:#15803d' }, `¥${money(r.amount)}`),
  },
  {
    title: '抹零',
    key: 'rounding_amount',
    width: 85,
    render: (r) => (Number(r.rounding_amount || 0) > 0 ? `¥${money(r.rounding_amount)}` : '—'),
  },
  {
    title: '核销订单',
    key: 'allocations',
    minWidth: 210,
    render: (r) => {
      if (!r.allocations || !r.allocations.length) return '—'
      return h(
        NSpace,
        { size: [6, 4], wrap: true },
        {
          default: () =>
            r.allocations.map((a) =>
              h(
                NButton,
                {
                  text: true,
                  type: 'primary',
                  size: 'tiny',
                  onClick: () => router.push(`/order-center/detail/${a.order_id}`),
                },
                { default: () => `${a.order_no} (¥${money(a.amount)})` },
              ),
            ),
        },
      )
    },
  },
  {
    title: '微信交易单号',
    key: 'wx_transaction_id',
    width: 210,
    ellipsis: { tooltip: true },
    render: (r) => r.wx_transaction_id || '—',
  },
  {
    title: '操作人',
    key: 'operator_name',
    width: 120,
    render: (r) => r.operator_name || '—',
  },
  {
    title: '备注',
    key: 'remark',
    minWidth: 150,
    ellipsis: { tooltip: true },
    render: (r) => r.remark || '—',
  },
]

async function loadData() {
  loading.value = true
  try {
    const res = await financeApi.payments({
      keyword: filters.keyword.trim() || undefined,
      channel: filters.channel || undefined,
      method: filters.method || undefined,
      date_from: filters.dateRange?.[0] || undefined,
      date_to: filters.dateRange?.[1] || undefined,
      page: pagination.page,
      page_size: pagination.pageSize,
    })
    rows.value = res.items || []
    pagination.itemCount = res.total || 0
  } catch (err: any) {
    message.error(err?.message || '加载支付记录失败')
  } finally {
    loading.value = false
  }
}

function onSearch() {
  pagination.page = 1
  loadData()
}

function onReset() {
  filters.keyword = ''
  filters.channel = null
  filters.method = null
  filters.dateRange = null
  pagination.page = 1
  loadData()
}

function onPageChange(p: number) {
  pagination.page = p
  loadData()
}

function onPageSizeChange(ps: number) {
  pagination.pageSize = ps
  pagination.page = 1
  loadData()
}

onMounted(loadData)
</script>

<style scoped>
.payment-records-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}
</style>
