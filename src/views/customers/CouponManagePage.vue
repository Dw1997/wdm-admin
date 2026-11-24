<template>
  <div class="page-wrap">
    <div class="page-header">
      <div>
        <h2 class="page-title">优惠券管理</h2>
        <div class="page-sub">管理节日优惠券、运费补贴券、差额补贴券、拉新奖励券的模板与发放核销</div>
      </div>
      <n-space>
        <n-button @click="openTemplateModal()">新建模板</n-button>
        <n-button type="primary" @click="openIssueModal()">发放优惠券</n-button>
      </n-space>
    </div>

    <n-tabs v-model:value="activeTab" type="line" animated>
      <n-tab-pane name="records" tab="发放与核销记录">
        <div class="stats-grid">
          <n-card size="small" :bordered="false" class="stat-card">
            <div class="stat-label">累计发放</div>
            <div class="stat-value">{{ recordSummary.total_issued }} <span class="unit">张</span></div>
          </n-card>
          <n-card size="small" :bordered="false" class="stat-card">
            <div class="stat-label">当前可用</div>
            <div class="stat-value text-green">{{ recordSummary.total_unused }} <span class="unit">张</span></div>
          </n-card>
          <n-card size="small" :bordered="false" class="stat-card">
            <div class="stat-label">已使用</div>
            <div class="stat-value text-blue">{{ recordSummary.total_used }} <span class="unit">张</span></div>
          </n-card>
          <n-card size="small" :bordered="false" class="stat-card">
            <div class="stat-label">累计抵扣金额</div>
            <div class="stat-value text-orange">¥{{ Number(recordSummary.total_discount_applied || 0).toFixed(2) }}</div>
          </n-card>
        </div>

        <n-card size="small" class="table-card">
          <div class="filter-bar">
            <n-select
              v-model:value="recordQuery.coupon_type"
              :options="couponTypeOptions"
              clearable
              placeholder="优惠券类型"
              style="width: 150px"
              @update:value="loadRecords(1)"
            />
            <n-select
              v-model:value="recordQuery.status"
              :options="recordStatusOptions"
              clearable
              placeholder="状态"
              style="width: 130px"
              @update:value="loadRecords(1)"
            />
            <n-input
              v-model:value="recordQuery.keyword"
              clearable
              placeholder="搜索客户名 / 手机号 / 券码 / 券名"
              style="width: 260px"
              @keyup.enter="loadRecords(1)"
              @clear="loadRecords(1)"
            />
            <n-button type="primary" secondary @click="loadRecords(1)">查询</n-button>
          </div>

          <n-data-table
            :columns="recordColumns"
            :data="records"
            :loading="recordsLoading"
            :pagination="recordPagination"
            remote
            size="small"
            :scroll-x="1200"
          />
        </n-card>
      </n-tab-pane>

      <n-tab-pane name="templates" tab="优惠券模板">
        <n-card size="small" class="table-card">
          <div class="filter-bar">
            <n-select
              v-model:value="tplQuery.coupon_type"
              :options="couponTypeOptions"
              clearable
              placeholder="优惠券类型"
              style="width: 150px"
              @update:value="loadTemplates(1)"
            />
            <n-select
              v-model:value="tplQuery.status"
              :options="[
                { label: '启用', value: 'active' },
                { label: '停用', value: 'disabled' },
              ]"
              clearable
              placeholder="状态"
              style="width: 120px"
              @update:value="loadTemplates(1)"
            />
            <n-input
              v-model:value="tplQuery.keyword"
              clearable
              placeholder="搜索模板名称"
              style="width: 220px"
              @keyup.enter="loadTemplates(1)"
              @clear="loadTemplates(1)"
            />
            <n-button type="primary" secondary @click="loadTemplates(1)">查询</n-button>
          </div>

          <n-data-table
            :columns="templateColumns"
            :data="templates"
            :loading="templatesLoading"
            :pagination="tplPagination"
            remote
            size="small"
            :scroll-x="1050"
          />
        </n-card>
      </n-tab-pane>

      <n-tab-pane name="referral" tab="拉新奖励设置与记录">
        <n-card size="small" title="拉新首单自动发券规则" class="table-card" style="margin-bottom: 12px">
          <n-form inline label-placement="left" :show-feedback="false" style="flex-wrap: wrap; gap: 12px 16px">
            <n-form-item label="自动发券开关">
              <n-switch v-model:value="referralConfig.enabled" />
            </n-form-item>
            <n-form-item label="拉新券面额(元)">
              <n-input-number v-model:value="referralConfig.reward_amount" :min="0.01" :precision="2" style="width: 120px" />
            </n-form-item>
            <n-form-item label="用券门槛(元)">
              <n-input-number v-model:value="referralConfig.coupon_min_amount" :min="0" :precision="2" style="width: 120px" />
            </n-form-item>
            <n-form-item label="有效天数">
              <n-input-number v-model:value="referralConfig.coupon_valid_days" :min="1" :precision="0" style="width: 100px" />
            </n-form-item>
            <n-form-item label="新客首单最低实送(元)">
              <n-input-number v-model:value="referralConfig.min_order_amount" :min="0" :precision="2" style="width: 120px" />
            </n-form-item>
            <n-form-item>
              <n-button type="primary" :loading="referralConfigSaving" @click="saveReferralConfig">保存配置</n-button>
            </n-form-item>
          </n-form>
          <div style="margin-top: 8px; font-size: 12px; color: #888">
            说明：客户 A 通过小程序分享码或由销售/管理员指定介绍客户 B；B 经审核通过且首笔订单送达完成后，系统自动发放 1 张拉新奖励券给客户 A（每个新客终生仅触发一次）。
          </div>
        </n-card>

        <div class="stats-grid" style="grid-template-columns: repeat(3, minmax(0, 1fr))">
          <n-card size="small" :bordered="false" class="stat-card">
            <div class="stat-label">累计触发次数</div>
            <div class="stat-value">{{ referralSummary.total }} <span class="unit">次</span></div>
          </n-card>
          <n-card size="small" :bordered="false" class="stat-card">
            <div class="stat-label">已自动发券</div>
            <div class="stat-value text-green">{{ referralSummary.issued_count }} <span class="unit">张</span></div>
          </n-card>
          <n-card size="small" :bordered="false" class="stat-card">
            <div class="stat-label">累计发放金额</div>
            <div class="stat-value text-orange">¥{{ Number(referralSummary.issued_amount || 0).toFixed(2) }}</div>
          </n-card>
        </div>

        <n-card size="small" class="table-card">
          <div class="filter-bar">
            <n-select
              v-model:value="referralQuery.status"
              :options="[
                { label: '已发放', value: 'issued' },
                { label: '已跳过', value: 'skipped' },
              ]"
              clearable
              placeholder="状态"
              style="width: 130px"
              @update:value="loadReferralRecords(1)"
            />
            <n-input
              v-model:value="referralQuery.keyword"
              clearable
              placeholder="搜索介绍人 / 新客户 / 订单号 / 券码"
              style="width: 260px"
              @keyup.enter="loadReferralRecords(1)"
              @clear="loadReferralRecords(1)"
            />
            <n-button type="primary" secondary @click="loadReferralRecords(1)">查询</n-button>
          </div>

          <n-data-table
            :columns="referralColumns"
            :data="referralRecords"
            :loading="referralLoading"
            :pagination="referralPagination"
            remote
            size="small"
            :scroll-x="1100"
          />
        </n-card>
      </n-tab-pane>
    </n-tabs>

    <!-- 新建 / 编辑模板弹窗 -->
    <n-modal v-model:show="tplModalVisible" :title="editingTemplateId ? '编辑优惠券模板' : '新建优惠券模板'" preset="card" style="width: 540px">
      <n-form label-placement="left" label-width="100">
        <n-form-item label="模板名称" required>
          <n-input v-model:value="tplForm.name" placeholder="如：端午满500减30、运费补贴15元" maxlength="64" />
        </n-form-item>
        <n-form-item label="优惠券类型" required>
          <n-select v-model:value="tplForm.coupon_type" :options="couponTypeOptions" />
        </n-form-item>
        <n-form-item label="面额（元）" required>
          <n-input-number v-model:value="tplForm.amount" :min="0.01" :precision="2" style="width: 100%" />
        </n-form-item>
        <n-form-item label="使用门槛">
          <n-input-number v-model:value="tplForm.min_order_amount" :min="0" :precision="2" style="width: 100%" placeholder="0 表示无门槛" />
        </n-form-item>
        <n-form-item label="有效期方式" required>
          <n-radio-group v-model:value="tplForm.validity_type">
            <n-radio value="fixed_days">发放后 N 天内有效</n-radio>
            <n-radio value="fixed_range">固定起止日期</n-radio>
          </n-radio-group>
        </n-form-item>
        <n-form-item v-if="tplForm.validity_type === 'fixed_days'" label="有效天数" required>
          <n-input-number v-model:value="tplForm.valid_days" :min="1" :max="3650" :precision="0" style="width: 100%" />
        </n-form-item>
        <n-form-item v-else label="起止日期" required>
          <n-date-picker v-model:value="tplForm.dateRange" type="daterange" style="width: 100%" />
        </n-form-item>
        <n-form-item label="备注">
          <n-input v-model:value="tplForm.remark" type="textarea" :rows="2" maxlength="200" placeholder="选填" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="tplModalVisible = false">取消</n-button>
          <n-button type="primary" :loading="tplSaving" @click="saveTemplate">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 发放优惠券弹窗 -->
    <n-modal v-model:show="issueModalVisible" title="发放优惠券" preset="card" style="width: 600px">
      <n-form label-placement="left" label-width="110">
        <n-form-item label="发券方式">
          <n-radio-group v-model:value="issueForm.mode">
            <n-radio value="template">选用已有模板</n-radio>
            <n-radio value="custom">临时自定义</n-radio>
          </n-radio-group>
        </n-form-item>

        <template v-if="issueForm.mode === 'template'">
          <n-form-item label="选择模板" required>
            <n-select
              v-model:value="issueForm.template_id"
              :options="activeTemplateOptions"
              filterable
              placeholder="请选择启用中的优惠券模板"
            />
          </n-form-item>
        </template>

        <template v-else>
          <n-form-item label="券名称" required>
            <n-input v-model:value="issueForm.name" placeholder="如：中秋回馈券、11月运费补贴" maxlength="64" />
          </n-form-item>
          <n-form-item label="优惠券类型" required>
            <n-select v-model:value="issueForm.coupon_type" :options="couponTypeOptions" />
          </n-form-item>
          <n-form-item label="面额（元）" required>
            <n-input-number v-model:value="issueForm.amount" :min="0.01" :precision="2" style="width: 100%" />
          </n-form-item>
          <n-form-item label="使用门槛">
            <n-input-number v-model:value="issueForm.min_order_amount" :min="0" :precision="2" style="width: 100%" placeholder="0 表示无门槛" />
          </n-form-item>
          <n-form-item label="有效期方式" required>
            <n-radio-group v-model:value="issueForm.validity_type">
              <n-radio value="fixed_days">发放后 N 天内有效</n-radio>
              <n-radio value="fixed_range">固定起止日期</n-radio>
            </n-radio-group>
          </n-form-item>
          <n-form-item v-if="issueForm.validity_type === 'fixed_days'" label="有效天数" required>
            <n-input-number v-model:value="issueForm.valid_days" :min="1" :max="3650" :precision="0" style="width: 100%" />
          </n-form-item>
          <n-form-item v-else label="起止日期" required>
            <n-date-picker v-model:value="issueForm.dateRange" type="daterange" style="width: 100%" />
          </n-form-item>
        </template>

        <n-divider style="margin: 12px 0" />

        <n-form-item label="发放对象" required>
          <n-radio-group v-model:value="issueForm.target_type">
            <n-radio value="customers">指定客户</n-radio>
            <n-radio value="tags">按客户标签</n-radio>
            <n-radio value="levels">按客户等级</n-radio>
          </n-radio-group>
        </n-form-item>

        <n-form-item v-if="issueForm.target_type === 'customers'" label="选择客户" required>
          <n-select
            v-model:value="issueForm.customer_ids"
            multiple
            filterable
            remote
            clearable
            :loading="customerSearching"
            :options="customerOptions"
            placeholder="输入客户名称或手机号搜索"
            @search="searchCustomers"
          />
        </n-form-item>
        <n-form-item v-else-if="issueForm.target_type === 'tags'" label="选择标签" required>
          <n-select
            v-model:value="issueForm.tag_ids"
            multiple
            filterable
            :options="tagOptions"
            placeholder="将向选中标签下的所有启用客户发券"
          />
        </n-form-item>
        <n-form-item v-else label="选择等级" required>
          <n-select
            v-model:value="issueForm.level_ids"
            multiple
            filterable
            :options="levelOptions"
            placeholder="将向选中等级下的所有启用客户发券"
          />
        </n-form-item>

        <n-form-item label="每人发放张数">
          <n-input-number v-model:value="issueForm.quantity_per_customer" :min="1" :max="10" :precision="0" style="width: 160px" />
        </n-form-item>
        <n-form-item label="发放备注">
          <n-input v-model:value="issueForm.issue_remark" placeholder="如：中秋节客户回馈、拉新奖励" maxlength="200" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="issueModalVisible = false">取消</n-button>
          <n-button type="primary" :loading="issuing" @click="submitIssue">确认发放</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 作废弹窗 -->
    <n-modal v-model:show="voidModalVisible" title="作废优惠券" preset="card" style="width: 440px">
      <div v-if="voidTarget" style="margin-bottom: 12px; color: #666">
        将作废客户 <b>{{ voidTarget.customer_name }}</b> 的优惠券 <b>{{ voidTarget.name }}</b>（{{ voidTarget.coupon_code }}），作废后客户不可再使用。
      </div>
      <n-form label-placement="top">
        <n-form-item label="作废原因" required>
          <n-input v-model:value="voidReason" placeholder="请填写作废原因，如：发错客户" maxlength="200" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="voidModalVisible = false">取消</n-button>
          <n-button type="error" :loading="voiding" @click="confirmVoid">确认作废</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NSwitch, NTag, NSpace, useMessage, type DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import { couponApi, customerApi, customerTagApi, levelApi } from '@/api'
import type {
  CouponTemplate,
  CouponType,
  CouponValidityType,
  CustomerCouponRecord,
  ReferralRewardRecord,
} from '@/types'

const router = useRouter()
const message = useMessage()

const activeTab = ref<'records' | 'templates' | 'referral'>('records')

const COUPON_TYPE_MAP: Record<CouponType, { label: string; type: 'success' | 'info' | 'warning' | 'error' }> = {
  festival: { label: '节日优惠券', type: 'error' },
  freight_subsidy: { label: '运费补贴券', type: 'info' },
  diff_subsidy: { label: '差额补贴券', type: 'warning' },
  referral_reward: { label: '拉新奖励券', type: 'success' },
}

const RECORD_STATUS_MAP: Record<string, { label: string; type: 'success' | 'info' | 'default' | 'error' }> = {
  unused: { label: '未使用', type: 'success' },
  used: { label: '已使用', type: 'info' },
  expired: { label: '已过期', type: 'default' },
  voided: { label: '已作废', type: 'error' },
}

const couponTypeOptions = Object.entries(COUPON_TYPE_MAP).map(([value, item]) => ({
  label: item.label,
  value,
}))

const recordStatusOptions = [
  { label: '未使用', value: 'unused' },
  { label: '已使用', value: 'used' },
  { label: '已过期', value: 'expired' },
  { label: '已作废', value: 'voided' },
]

// ---------- 发放与核销记录 ----------
const recordsLoading = ref(false)
const records = ref<CustomerCouponRecord[]>([])
const recordSummary = ref({
  total_issued: 0,
  total_used: 0,
  total_unused: 0,
  total_discount_applied: '0.00',
})
const recordQuery = reactive({
  coupon_type: null as string | null,
  status: null as string | null,
  keyword: '',
  page: 1,
  page_size: 20,
})
const recordTotal = ref(0)

const recordPagination = computed(() => ({
  page: recordQuery.page,
  pageSize: recordQuery.page_size,
  itemCount: recordTotal.value,
  onChange: (p: number) => loadRecords(p),
}))

async function loadRecords(page = recordQuery.page) {
  recordQuery.page = page
  recordsLoading.value = true
  try {
    const res = await couponApi.listRecords({
      coupon_type: recordQuery.coupon_type || undefined,
      status: recordQuery.status || undefined,
      keyword: recordQuery.keyword.trim() || undefined,
      page: recordQuery.page,
      page_size: recordQuery.page_size,
    })
    records.value = res.items
    recordTotal.value = res.total
    recordSummary.value = res.summary
  } finally {
    recordsLoading.value = false
  }
}

const recordColumns: DataTableColumns<CustomerCouponRecord> = [
  { title: '券码', key: 'coupon_code', width: 150 },
  { title: '券名称', key: 'name', width: 160, ellipsis: { tooltip: true } },
  {
    title: '类型',
    key: 'coupon_type',
    width: 110,
    render: row => {
      const info = COUPON_TYPE_MAP[row.coupon_type] || { label: row.coupon_type, type: 'default' }
      return h(NTag, { size: 'small', type: info.type, bordered: false }, () => info.label)
    },
  },
  {
    title: '面额 / 门槛',
    key: 'amount',
    width: 150,
    render: row => {
      const threshold = Number(row.min_order_amount)
      return `¥${Number(row.amount).toFixed(2)} · ${threshold > 0 ? `满¥${threshold.toFixed(0)}` : '无门槛'}`
    },
  },
  {
    title: '客户',
    key: 'customer_name',
    width: 150,
    render: row => `${row.customer_name || '—'}${row.customer_phone ? ` (${row.customer_phone})` : ''}`,
  },
  {
    title: '有效期',
    key: 'valid_to',
    width: 185,
    render: row => `${dayjs(row.valid_from).format('MM-DD')} ~ ${dayjs(row.valid_to).format('YYYY-MM-DD')}`,
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render: row => {
      const info = RECORD_STATUS_MAP[row.status] || { label: row.status, type: 'default' }
      return h(NTag, { size: 'small', type: info.type }, () => info.label)
    },
  },
  {
    title: '核销订单 / 抵扣',
    key: 'order_no',
    width: 165,
    render: row => {
      if (!row.order_id || !row.order_no) return '—'
      return h(
        NButton,
        {
          text: true,
          type: 'primary',
          size: 'small',
          onClick: () => router.push(`/order-center/detail/${row.order_id}`),
        },
        () => `${row.order_no} (-¥${Number(row.discount_applied || 0).toFixed(2)})`,
      )
    },
  },
  { title: '发放备注', key: 'issue_remark', width: 140, ellipsis: { tooltip: true }, render: row => row.issue_remark || '—' },
  {
    title: '发放时间',
    key: 'issued_at',
    width: 145,
    render: row => dayjs(row.issued_at).format('YYYY-MM-DD HH:mm'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 80,
    fixed: 'right',
    render: row =>
      row.status === 'unused'
        ? h(NButton, { text: true, type: 'error', size: 'small', onClick: () => openVoidModal(row) }, () => '作废')
        : '—',
  },
]

// ---------- 优惠券模板 ----------
const templatesLoading = ref(false)
const templates = ref<CouponTemplate[]>([])
const tplQuery = reactive({
  coupon_type: null as string | null,
  status: null as string | null,
  keyword: '',
  page: 1,
  page_size: 20,
})
const tplTotal = ref(0)

const tplPagination = computed(() => ({
  page: tplQuery.page,
  pageSize: tplQuery.page_size,
  itemCount: tplTotal.value,
  onChange: (p: number) => loadTemplates(p),
}))

async function loadTemplates(page = tplQuery.page) {
  tplQuery.page = page
  templatesLoading.value = true
  try {
    const res = await couponApi.listTemplates({
      coupon_type: tplQuery.coupon_type || undefined,
      status: tplQuery.status || undefined,
      keyword: tplQuery.keyword.trim() || undefined,
      page: tplQuery.page,
      page_size: tplQuery.page_size,
    })
    templates.value = res.items
    tplTotal.value = res.total
  } finally {
    templatesLoading.value = false
  }
}

const activeTemplateOptions = computed(() =>
  templates.value
    .filter(t => t.status === 'active')
    .map(t => ({
      label: `${t.name}（¥${Number(t.amount).toFixed(2)}，${Number(t.min_order_amount) > 0 ? `满¥${Number(t.min_order_amount).toFixed(0)}` : '无门槛'}）`,
      value: t.id,
    })),
)

const templateColumns: DataTableColumns<CouponTemplate> = [
  { title: '模板名称', key: 'name', width: 180 },
  {
    title: '类型',
    key: 'coupon_type',
    width: 115,
    render: row => {
      const info = COUPON_TYPE_MAP[row.coupon_type] || { label: row.coupon_type, type: 'default' }
      return h(NTag, { size: 'small', type: info.type, bordered: false }, () => info.label)
    },
  },
  { title: '面额', key: 'amount', width: 95, render: row => `¥${Number(row.amount).toFixed(2)}` },
  {
    title: '使用门槛',
    key: 'min_order_amount',
    width: 110,
    render: row => (Number(row.min_order_amount) > 0 ? `满 ¥${Number(row.min_order_amount).toFixed(2)}` : '无门槛'),
  },
  {
    title: '有效期规则',
    key: 'validity',
    width: 185,
    render: row =>
      row.validity_type === 'fixed_days'
        ? `发放后 ${row.valid_days} 天内有效`
        : `${dayjs(row.valid_from).format('YYYY-MM-DD')} ~ ${dayjs(row.valid_to).format('YYYY-MM-DD')}`,
  },
  { title: '已发 / 已用', key: 'stats', width: 100, render: row => `${row.issued_count} / ${row.used_count}` },
  {
    title: '状态',
    key: 'status',
    width: 85,
    render: row =>
      h(NSwitch, {
        value: row.status === 'active',
        onUpdateValue: async (val: boolean) => {
          await couponApi.updateTemplateStatus(row.id, val ? 'active' : 'disabled')
          message.success(val ? '已启用模板' : '已停用模板')
          loadTemplates()
        },
      }),
  },
  { title: '备注', key: 'remark', ellipsis: { tooltip: true }, render: row => row.remark || '—' },
  {
    title: '操作',
    key: 'actions',
    width: 130,
    fixed: 'right',
    render: row =>
      h(NSpace, { size: 8 }, () => [
        h(NButton, { text: true, type: 'primary', size: 'small', onClick: () => openTemplateModal(row) }, () => '编辑'),
        row.status === 'active'
          ? h(NButton, { text: true, type: 'success', size: 'small', onClick: () => openIssueModal(row.id) }, () => '去发券')
          : null,
      ]),
  },
]

// ---------- 新建 / 编辑模板弹窗 ----------
const tplModalVisible = ref(false)
const tplSaving = ref(false)
const editingTemplateId = ref<number | null>(null)
const tplForm = reactive({
  name: '',
  coupon_type: 'festival' as CouponType,
  amount: 20 as number | null,
  min_order_amount: 0 as number | null,
  validity_type: 'fixed_days' as CouponValidityType,
  valid_days: 30 as number | null,
  dateRange: null as [number, number] | null,
  remark: '',
})

function openTemplateModal(row?: CouponTemplate) {
  if (row) {
    editingTemplateId.value = row.id
    tplForm.name = row.name
    tplForm.coupon_type = row.coupon_type
    tplForm.amount = Number(row.amount)
    tplForm.min_order_amount = Number(row.min_order_amount)
    tplForm.validity_type = row.validity_type
    tplForm.valid_days = row.valid_days ?? 30
    tplForm.dateRange =
      row.valid_from && row.valid_to ? [dayjs(row.valid_from).valueOf(), dayjs(row.valid_to).valueOf()] : null
    tplForm.remark = row.remark || ''
  } else {
    editingTemplateId.value = null
    tplForm.name = ''
    tplForm.coupon_type = 'festival'
    tplForm.amount = 20
    tplForm.min_order_amount = 0
    tplForm.validity_type = 'fixed_days'
    tplForm.valid_days = 30
    tplForm.dateRange = null
    tplForm.remark = ''
  }
  tplModalVisible.value = true
}

async function saveTemplate() {
  if (!tplForm.name.trim()) return message.warning('请填写模板名称')
  if (!tplForm.amount || tplForm.amount <= 0) return message.warning('请填写大于 0 的面额')
  const payload = {
    name: tplForm.name.trim(),
    coupon_type: tplForm.coupon_type,
    amount: Number(tplForm.amount).toFixed(2),
    min_order_amount: Number(tplForm.min_order_amount || 0).toFixed(2),
    validity_type: tplForm.validity_type,
    valid_days: tplForm.validity_type === 'fixed_days' ? tplForm.valid_days || 30 : null,
    valid_from:
      tplForm.validity_type === 'fixed_range' && tplForm.dateRange
        ? dayjs(tplForm.dateRange[0]).startOf('day').toISOString()
        : null,
    valid_to:
      tplForm.validity_type === 'fixed_range' && tplForm.dateRange
        ? dayjs(tplForm.dateRange[1]).endOf('day').toISOString()
        : null,
    remark: tplForm.remark.trim() || null,
  }
  if (payload.validity_type === 'fixed_range' && (!payload.valid_from || !payload.valid_to)) {
    return message.warning('请选择有效期起止日期')
  }
  tplSaving.value = true
  try {
    if (editingTemplateId.value) {
      await couponApi.updateTemplate(editingTemplateId.value, payload)
      message.success('模板已更新')
    } else {
      await couponApi.createTemplate(payload)
      message.success('模板已创建')
    }
    tplModalVisible.value = false
    loadTemplates()
  } finally {
    tplSaving.value = false
  }
}

// ---------- 发放优惠券弹窗 ----------
const issueModalVisible = ref(false)
const issuing = ref(false)
const customerSearching = ref(false)
const customerOptions = ref<{ label: string; value: number }[]>([])
const tagOptions = ref<{ label: string; value: number }[]>([])
const levelOptions = ref<{ label: string; value: number }[]>([])

const issueForm = reactive({
  mode: 'template' as 'template' | 'custom',
  template_id: null as number | null,
  name: '',
  coupon_type: 'festival' as CouponType,
  amount: 20 as number | null,
  min_order_amount: 0 as number | null,
  validity_type: 'fixed_days' as CouponValidityType,
  valid_days: 30 as number | null,
  dateRange: null as [number, number] | null,
  target_type: 'customers' as 'customers' | 'tags' | 'levels',
  customer_ids: [] as number[],
  tag_ids: [] as number[],
  level_ids: [] as number[],
  quantity_per_customer: 1,
  issue_remark: '',
})

async function searchCustomers(query: string) {
  customerSearching.value = true
  try {
    const res = await customerApi.list({ keyword: query || undefined, status: 'active', page: 1, page_size: 30 })
    customerOptions.value = (res.items || [])
      .filter((c: any) => !c.is_system)
      .map((c: any) => ({ label: `${c.name}${c.phone ? ` (${c.phone})` : ''}`, value: c.id }))
  } finally {
    customerSearching.value = false
  }
}

async function openIssueModal(presetTemplateId?: number) {
  if (!templates.value.length) await loadTemplates(1)
  issueForm.mode = presetTemplateId || activeTemplateOptions.value.length ? 'template' : 'custom'
  issueForm.template_id = presetTemplateId ?? (activeTemplateOptions.value[0]?.value ?? null)
  issueForm.name = ''
  issueForm.coupon_type = 'festival'
  issueForm.amount = 20
  issueForm.min_order_amount = 0
  issueForm.validity_type = 'fixed_days'
  issueForm.valid_days = 30
  issueForm.dateRange = null
  issueForm.target_type = 'customers'
  issueForm.customer_ids = []
  issueForm.tag_ids = []
  issueForm.level_ids = []
  issueForm.quantity_per_customer = 1
  issueForm.issue_remark = ''
  issueModalVisible.value = true
  if (!customerOptions.value.length) searchCustomers('')
}

async function submitIssue() {
  if (issueForm.mode === 'template' && !issueForm.template_id) {
    return message.warning('请选择优惠券模板')
  }
  if (issueForm.mode === 'custom') {
    if (!issueForm.name.trim()) return message.warning('请填写券名称')
    if (!issueForm.amount || issueForm.amount <= 0) return message.warning('请填写大于 0 的面额')
    if (issueForm.validity_type === 'fixed_range' && !issueForm.dateRange) {
      return message.warning('请选择有效期起止日期')
    }
  }
  if (issueForm.target_type === 'customers' && !issueForm.customer_ids.length) {
    return message.warning('请至少选择 1 位客户')
  }
  if (issueForm.target_type === 'tags' && !issueForm.tag_ids.length) {
    return message.warning('请至少选择 1 个客户标签')
  }
  if (issueForm.target_type === 'levels' && !issueForm.level_ids.length) {
    return message.warning('请至少选择 1 个客户等级')
  }

  issuing.value = true
  try {
    const res = await couponApi.issue({
      template_id: issueForm.mode === 'template' ? issueForm.template_id : null,
      name: issueForm.mode === 'custom' ? issueForm.name.trim() : null,
      coupon_type: issueForm.mode === 'custom' ? issueForm.coupon_type : null,
      amount: issueForm.mode === 'custom' ? Number(issueForm.amount).toFixed(2) : null,
      min_order_amount: issueForm.mode === 'custom' ? Number(issueForm.min_order_amount || 0).toFixed(2) : '0.00',
      validity_type: issueForm.mode === 'custom' ? issueForm.validity_type : null,
      valid_days: issueForm.mode === 'custom' && issueForm.validity_type === 'fixed_days' ? issueForm.valid_days : null,
      valid_from:
        issueForm.mode === 'custom' && issueForm.validity_type === 'fixed_range' && issueForm.dateRange
          ? dayjs(issueForm.dateRange[0]).startOf('day').toISOString()
          : null,
      valid_to:
        issueForm.mode === 'custom' && issueForm.validity_type === 'fixed_range' && issueForm.dateRange
          ? dayjs(issueForm.dateRange[1]).endOf('day').toISOString()
          : null,
      target_type: issueForm.target_type,
      customer_ids: issueForm.target_type === 'customers' ? issueForm.customer_ids : undefined,
      tag_ids: issueForm.target_type === 'tags' ? issueForm.tag_ids : undefined,
      level_ids: issueForm.target_type === 'levels' ? issueForm.level_ids : undefined,
      quantity_per_customer: issueForm.quantity_per_customer,
      issue_remark: issueForm.issue_remark.trim() || null,
    })
    message.success(`已成功向 ${res.issued_customer_count} 位客户发放 ${res.issued_coupon_count} 张优惠券`)
    issueModalVisible.value = false
    activeTab.value = 'records'
    loadRecords(1)
    loadTemplates()
  } finally {
    issuing.value = false
  }
}

// ---------- 作废 ----------
const voidModalVisible = ref(false)
const voidTarget = ref<CustomerCouponRecord | null>(null)
const voidReason = ref('')
const voiding = ref(false)

function openVoidModal(row: CustomerCouponRecord) {
  voidTarget.value = row
  voidReason.value = ''
  voidModalVisible.value = true
}

async function confirmVoid() {
  if (!voidTarget.value) return
  if (!voidReason.value.trim()) return message.warning('请填写作废原因')
  voiding.value = true
  try {
    await couponApi.voidRecord(voidTarget.value.id, voidReason.value.trim())
    message.success('优惠券已作废')
    voidModalVisible.value = false
    loadRecords()
  } finally {
    voiding.value = false
  }
}

// ---------- 拉新奖励配置与记录 ----------
const referralConfigSaving = ref(false)
const referralConfig = reactive({
  enabled: true,
  reward_amount: 10,
  coupon_min_amount: 0,
  coupon_valid_days: 30,
  min_order_amount: 0,
})
const referralLoading = ref(false)
const referralRecords = ref<ReferralRewardRecord[]>([])
const referralSummary = ref({
  total: 0,
  issued_count: 0,
  skipped_count: 0,
  issued_amount: '0.00',
})
const referralQuery = reactive({
  status: null as string | null,
  keyword: '',
  page: 1,
  page_size: 20,
})
const referralTotal = ref(0)
const referralPagination = computed(() => ({
  page: referralQuery.page,
  pageSize: referralQuery.page_size,
  itemCount: referralTotal.value,
  onChange: (p: number) => loadReferralRecords(p),
}))

const referralColumns: DataTableColumns<ReferralRewardRecord> = [
  {
    title: '介绍人（老客 A）',
    key: 'referrer_customer_name',
    width: 150,
    render: (r) => `${r.referrer_customer_name || '—'}${r.referrer_customer_phone ? ` (${r.referrer_customer_phone})` : ''}`,
  },
  {
    title: '被邀请人（新客 B）',
    key: 'invitee_customer_name',
    width: 150,
    render: (r) => `${r.invitee_customer_name || '—'}${r.invitee_customer_phone ? ` (${r.invitee_customer_phone})` : ''}`,
  },
  {
    title: '触发首单',
    key: 'order_no',
    width: 150,
    render: (r) => r.order_no || '—',
  },
  {
    title: '奖励金额',
    key: 'reward_amount',
    width: 90,
    render: (r) => `¥${Number(r.reward_amount || 0).toFixed(2)}`,
  },
  {
    title: '发放券码',
    key: 'coupon_code',
    width: 150,
    render: (r) => r.coupon_code || '—',
  },
  {
    title: '发券状态',
    key: 'status',
    width: 90,
    render: (r) =>
      h(
        NTag,
        { size: 'small', type: r.status === 'issued' ? 'success' : 'warning' },
        { default: () => (r.status === 'issued' ? '已发放' : '已跳过') },
      ),
  },
  {
    title: '备注/原因',
    key: 'skip_reason',
    width: 160,
    ellipsis: { tooltip: true },
    render: (r) => r.skip_reason || '首单送达自动发券',
  },
  {
    title: '触发时间',
    key: 'triggered_at',
    width: 150,
    render: (r) => (r.triggered_at ? r.triggered_at.slice(0, 16).replace('T', ' ') : '—'),
  },
]

async function loadReferralConfig() {
  try {
    const cfg = await couponApi.getReferralConfig()
    referralConfig.enabled = cfg.enabled
    referralConfig.reward_amount = Number(cfg.reward_amount || 10)
    referralConfig.coupon_min_amount = Number(cfg.coupon_min_amount || 0)
    referralConfig.coupon_valid_days = Number(cfg.coupon_valid_days || 30)
    referralConfig.min_order_amount = Number(cfg.min_order_amount || 0)
  } catch {
    // ignore
  }
}

async function saveReferralConfig() {
  referralConfigSaving.value = true
  try {
    await couponApi.updateReferralConfig({
      enabled: referralConfig.enabled,
      reward_amount: referralConfig.reward_amount,
      coupon_min_amount: referralConfig.coupon_min_amount,
      coupon_valid_days: referralConfig.coupon_valid_days,
      min_order_amount: referralConfig.min_order_amount,
    })
    message.success('拉新奖励配置已保存')
  } finally {
    referralConfigSaving.value = false
  }
}

async function loadReferralRecords(page?: number) {
  if (page) referralQuery.page = page
  referralLoading.value = true
  try {
    const res = await couponApi.listReferralRecords({
      status: referralQuery.status || undefined,
      keyword: referralQuery.keyword.trim() || undefined,
      page: referralQuery.page,
      page_size: referralQuery.page_size,
    })
    referralRecords.value = res.items || []
    referralTotal.value = res.total || 0
    if (res.summary) referralSummary.value = res.summary
  } finally {
    referralLoading.value = false
  }
}

onMounted(async () => {
  loadRecords(1)
  loadTemplates(1)
  loadReferralConfig()
  loadReferralRecords(1)
  try {
    const [tags, levels] = await Promise.all([customerTagApi.list(), levelApi.list()])
    tagOptions.value = (tags || []).map((t: any) => ({ label: t.name, value: t.id }))
    levelOptions.value = (levels || []).map((l: any) => ({ label: l.nickname || l.name, value: l.id }))
  } catch {
    // ignore auxiliary filter preload error
  }
})
</script>

<style scoped>
.page-wrap {
  padding: 16px 20px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.page-sub {
  font-size: 13px;
  color: #666;
  margin-top: 4px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.stat-card {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
}
.stat-label {
  font-size: 12px;
  color: #888;
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  margin-top: 4px;
}
.stat-value .unit {
  font-size: 13px;
  font-weight: 400;
  color: #888;
}
.text-green { color: #18a058; }
.text-blue { color: #2080f0; }
.text-orange { color: #f0a020; }
.table-card {
  border-radius: 8px;
}
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}
</style>
