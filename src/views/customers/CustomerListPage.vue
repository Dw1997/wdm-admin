<template>
  <div class="page-container customer-list-page">
    <div class="card-section filter-card">
      <div class="page-header">
        <h2 class="page-title">客户列表</h2>
        <div style="display: flex; gap: 8px">
          <n-button @click="$router.push('/customers/tags')">客户标签</n-button>
          <n-button type="primary" @click="openCreate">新建客户</n-button>
        </div>
      </div>
      <div class="filter-bar">
        <n-input v-model:value="keyword" placeholder="客户名称 / 手机号" clearable style="width: 220px" @keyup.enter="search" />
        <n-select v-model:value="tagFilter" placeholder="客户标签" clearable filterable style="width: 150px" :options="tagOpts" @update:value="search" />
        <n-select v-model:value="status" placeholder="状态" clearable style="width: 130px" :options="statusOpts" @update:value="search" />
        <n-select v-model:value="salesFilter" placeholder="归属销售" clearable filterable style="width: 150px" :options="salesOpts" @update:value="search" />
        <n-select v-model:value="wechatFilter" placeholder="微信绑定" clearable style="width: 120px" :options="wechatOpts" @update:value="search" />
        <n-button type="primary" size="small" @click="search">查询</n-button>
      </div>
      <div v-if="checkedRowKeys.length" class="batch-bar">
        <span class="batch-count">已勾选 <strong>{{ checkedRowKeys.length }}</strong> 位客户</span>
        <n-button size="small" type="primary" secondary @click="openBatchTag">批量设置标签</n-button>
        <n-button size="small" type="primary" secondary @click="openBatchLevel">批量设置等级价格</n-button>
        <n-button size="small" text @click="checkedRowKeys = []">取消勾选</n-button>
      </div>
    </div>

    <div class="card-section table-card">
      <n-data-table
        class="customer-table"
        flex-height
        v-model:checked-row-keys="checkedRowKeys"
        :columns="columns"
        :data="pagedList"
        :loading="loading"
        :bordered="false"
        size="small"
        :scroll-x="1300"
        :row-key="(r:any)=>r.id"
      />
    </div>

    <div class="pagination-footer">
      <span class="result-count">共 {{ list.length }} 位客户</span>
      <n-pagination v-model:page="page" :item-count="list.length" :page-size="pageSize" />
    </div>

    <n-modal v-model:show="createVisible" title="新建客户" preset="card" style="width: 680px">
      <n-alert type="info" :bordered="false" style="margin-bottom: 12px">
        手机号是客户之后微信登录时匹配档案的依据，请务必填写准确。内部新建客户直接生效无需审核；客户标签可不填，等级价格不选默认使用「默认售价」，标签与等级价格互相独立。
      </n-alert>
      <n-form :model="createForm" label-placement="left" label-width="110">
        <n-grid :cols="2" :x-gap="16">
          <n-gi><n-form-item label="客户名称" required><n-input v-model:value="createForm.name" /></n-form-item></n-gi>
          <n-gi><n-form-item label="手机号" required><n-input v-model:value="createForm.phone" maxlength="11" /></n-form-item></n-gi>
        </n-grid>
        <n-grid :cols="2" :x-gap="16">
          <n-gi><n-form-item label="联系人"><n-input v-model:value="createForm.contact_name" placeholder="默认同客户名称" /></n-form-item></n-gi>
          <n-gi><n-form-item label="联系电话"><n-input v-model:value="createForm.contact_phone" placeholder="默认同手机号" /></n-form-item></n-gi>
        </n-grid>
        <n-grid :cols="2" :x-gap="16">
          <n-gi>
            <n-form-item label="客户标签">
              <n-select v-model:value="createForm.tag_id" clearable filterable :options="activeTagOpts" placeholder="选填，单选（与等级价格无关）" />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="等级价格">
              <n-select v-model:value="createForm.level_id" clearable :options="levelOpts" placeholder="不选默认按「默认售价」计价" />
            </n-form-item>
          </n-gi>
        </n-grid>
        <n-grid :cols="2" :x-gap="16">
          <n-gi>
            <n-form-item label="归属销售">
              <n-select v-model:value="createForm.sales_id" filterable :options="salesOpts" placeholder="默认归自己（自来客）" />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="关联供应商">
              <n-select v-model:value="createForm.vendor_id" clearable filterable :options="vendorOpts" placeholder="既是供应商又是客户时关联（用于抵账）" />
            </n-form-item>
          </n-gi>
        </n-grid>
        <n-form-item label="介绍人 / 拉新老客">
          <n-select
            v-model:value="createForm.referrer_customer_id"
            clearable
            filterable
            :options="referrerOpts"
            placeholder="选填，填写后该客户首单送达自动给介绍人发拉新券"
          />
        </n-form-item>
        <n-form-item label="收货地点">
          <RegionPicker
            v-model:value="createForm.delivery_region_id"
            @change="(sel) => onDeliveryRegionChange(createForm, sel)"
          />
        </n-form-item>
        <n-form-item label="详细地址"><n-input v-model:value="createForm.detail_address" placeholder="街道 / 门牌 / 摊位号" /></n-form-item>
        <n-grid :cols="2" :x-gap="16">
          <n-gi><n-form-item label="默认配送"><n-select v-model:value="createForm.default_delivery_mode" :options="deliveryModeOpts" @update:value="() => onDeliveryModeChange(createForm)" /></n-form-item></n-gi>
          <n-gi v-if="createForm.default_delivery_mode !== 'local'"><n-form-item label="默认物流线路"><n-select v-model:value="createForm.freight_line_id" :options="createLineOpts" clearable :disabled="!createForm.delivery_region_id" placeholder="不设则按收货地点自动匹配" /></n-form-item></n-gi>
          <n-gi v-if="createForm.default_delivery_mode !== 'local'"><n-form-item label="默认运费方式"><n-select v-model:value="createForm.default_freight_mode" :options="freightModeOpts" /></n-form-item></n-gi>
        </n-grid>
      </n-form>
      <template #footer>
        <n-button @click="createVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="onCreate">保存</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="editVisible" title="编辑客户" preset="card" style="width: 720px">
      <n-form :model="form" label-placement="left" label-width="110">
        <n-grid :cols="2" :x-gap="16">
          <n-gi><n-form-item label="客户名称"><n-input v-model:value="form.name" /></n-form-item></n-gi>
          <n-gi><n-form-item label="手机号"><n-input v-model:value="form.phone" maxlength="11" /></n-form-item></n-gi>
        </n-grid>
        <n-grid :cols="2" :x-gap="16">
          <n-gi>
            <n-form-item label="微信绑定">
              <n-tag size="small" :type="form.wechat_bound ? 'success' : 'default'">{{ form.wechat_bound ? '已绑定' : '未绑定' }}</n-tag>
              <span v-if="form.wechat_bound_at" style="margin-left: 8px; color: #999">{{ form.wechat_bound_at.slice(0, 16).replace('T', ' ') }}</span>
              <n-popconfirm v-if="form.wechat_bound" @positive-click="onUnbind">
                <template #trigger>
                  <n-button size="small" text type="error" style="margin-left: 12px">解绑微信</n-button>
                </template>
                解绑后客户需要重新登录并绑定手机号，原登录立即失效。确认解绑？
              </n-popconfirm>
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="归属销售">
              <span>{{ form.sales_name ? (form.sales_is_admin ? `管理员·${form.sales_name}` : form.sales_name) : '—' }}</span>
            </n-form-item>
          </n-gi>
        </n-grid>
        <n-grid :cols="2" :x-gap="16">
          <n-gi><n-form-item label="联系人"><n-input v-model:value="form.contact_name" /></n-form-item></n-gi>
          <n-gi><n-form-item label="联系电话"><n-input v-model:value="form.contact_phone" /></n-form-item></n-gi>
        </n-grid>
        <n-grid :cols="2" :x-gap="16">
          <n-gi><n-form-item label="客户标签"><n-select v-model:value="form.tag_id" clearable filterable :options="tagOpts" placeholder="选填，单选" /></n-form-item></n-gi>
          <n-gi><n-form-item label="状态"><n-select v-model:value="form.status" :options="statusOpts" /></n-form-item></n-gi>
        </n-grid>
        <n-grid :cols="2" :x-gap="16">
          <n-gi><n-form-item label="生效额度"><span>¥{{ Number(form.effective_credit_limit || 0).toLocaleString() }}</span><span style="margin-left: 8px; color: #999">在「客户额度」页设置</span></n-form-item></n-gi>
          <n-gi><n-form-item label="关联供应商"><n-select v-model:value="form.vendor_id" clearable filterable :options="vendorOpts" placeholder="选填，用于两本账抵账" /></n-form-item></n-gi>
        </n-grid>
        <n-grid :cols="2" :x-gap="16">
          <n-gi><n-form-item label="邀请码"><n-input v-model:value="form.invite_code" /></n-form-item></n-gi>
        </n-grid>
        <n-form-item label="收货地点">
          <RegionPicker
            v-model:value="form.delivery_region_id"
            :fallback-label="[form.province, form.city, form.district, form.town].filter(Boolean).join(' / ')"
            @change="(sel) => onDeliveryRegionChange(form, sel)"
          />
        </n-form-item>
        <n-form-item label="详细地址"><n-input v-model:value="form.detail_address" placeholder="街道 / 门牌 / 摊位号" /></n-form-item>
        <n-grid :cols="2" :x-gap="16">
          <n-gi><n-form-item label="默认配送"><n-select v-model:value="form.default_delivery_mode" :options="deliveryModeOpts" @update:value="() => onDeliveryModeChange(form)" /></n-form-item></n-gi>
          <n-gi v-if="form.default_delivery_mode !== 'local'"><n-form-item label="默认物流线路"><n-select v-model:value="form.freight_line_id" :options="editLineOpts" clearable :disabled="!form.delivery_region_id" placeholder="不设则按收货地点自动匹配" /></n-form-item></n-gi>
          <n-gi v-if="form.default_delivery_mode !== 'local'"><n-form-item label="默认运费方式"><n-select v-model:value="form.default_freight_mode" :options="freightModeOpts" /></n-form-item></n-gi>
        </n-grid>
      </n-form>
      <template #footer>
        <n-button @click="editVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="onSave">保存</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="levelVisible" title="设置等级价格" preset="card" style="width: 420px">
      <n-form label-placement="left" label-width="100">
        <n-form-item label="客户"><span>{{ levelTarget?.name }}</span></n-form-item>
        <n-form-item label="等级价格"><n-select v-model:value="levelForm.level_id" :options="levelOpts" placeholder="请选择等级价格" /></n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="levelVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="onAssignLevel">保存</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="batchTagVisible" title="批量设置客户标签" preset="card" style="width: 440px">
      <n-form label-placement="left" label-width="90">
        <n-form-item label="已选客户"><span>共 {{ checkedRowKeys.length }} 位</span></n-form-item>
        <n-form-item label="客户标签">
          <n-select v-model:value="batchTagId" clearable filterable :options="activeTagOpts" placeholder="选择标签（留空表示清空所选客户标签）" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="batchTagVisible = false">取消</n-button>
        <n-button type="primary" :loading="batchSaving" @click="onBatchAssignTag">确定</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="batchLevelVisible" title="批量设置等级价格" preset="card" style="width: 440px">
      <n-form label-placement="left" label-width="90">
        <n-form-item label="已选客户"><span>共 {{ checkedRowKeys.length }} 位</span></n-form-item>
        <n-form-item label="等级价格" required>
          <n-select v-model:value="batchLevelId" :options="levelOpts" placeholder="请选择等级价格" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="batchLevelVisible = false">取消</n-button>
        <n-button type="primary" :loading="batchSaving" @click="onBatchAssignLevel">确定</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, reactive, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { NButton, NTag, useMessage, type DataTableColumns, type SelectOption } from 'naive-ui'
import { adminCustomerApi, customerTagApi, deliveryApi, levelApi, vendorApi, fetchAllPages, PAGE_SIZE } from '@/api'
import type { AdminCustomer, CustomerTag, LevelConfig, RecordFreightLine, RegionSelection, SalesOption, Vendor } from '@/types'
import { useAuthStore } from '@/stores/auth'
import RegionPicker from '@/components/RegionPicker.vue'
import { actionBar, actionIcon } from '@/components/tableActions'

const message = useMessage()
const route = useRoute()
const auth = useAuthStore()
const list = ref<AdminCustomer[]>([])
const levels = ref<LevelConfig[]>([])
const tags = ref<CustomerTag[]>([])
const freightLines = ref<RecordFreightLine[]>([])
const keyword = ref(typeof route.query.keyword === 'string' ? route.query.keyword : '')
const tagFilter = ref<number | null>(null)
const status = ref<string | null>(null)
const salesFilter = ref<number | null>(null)
const wechatFilter = ref<string | null>(null)
const salesList = ref<SalesOption[]>([])
const vendorList = ref<Vendor[]>([])
const vendorOpts = computed<SelectOption[]>(() => vendorList.value.map((v) => ({ label: v.name, value: v.id })))
const page = ref(1)
const pageSize = PAGE_SIZE
const loading = ref(false)
const saving = ref(false)
const batchSaving = ref(false)
const checkedRowKeys = ref<number[]>([])
const createVisible = ref(false)
const editVisible = ref(false)
const levelVisible = ref(false)
const batchTagVisible = ref(false)
const batchLevelVisible = ref(false)
const batchTagId = ref<number | null>(null)
const batchLevelId = ref<number | null>(null)
const levelTarget = ref<AdminCustomer | null>(null)
const createForm = reactive<any>({ name: '', phone: '', contact_name: '', contact_phone: '', tag_id: null, vendor_id: null, sales_id: null, referrer_customer_id: null, level_id: null, region_path: null, province: '', city: '', district: '', town: '', detail_address: '', address: '', default_delivery_mode: 'route', delivery_region_id: null, freight_line_id: null, default_freight_mode: 'deduct' })
const form = reactive<any>({ id: 0, name: '', phone: '', wechat_bound: false, wechat_bound_at: null, sales_name: null, sales_is_admin: false, contact_name: '', contact_phone: '', tag_id: null, vendor_id: null, status: 'active', credit_limit: 0, invite_code: '', region_path: null, province: '', city: '', district: '', town: '', detail_address: '', address: '', default_delivery_mode: 'route', delivery_region_id: null, freight_line_id: null, default_freight_mode: 'deduct' })
const levelForm = reactive<any>({ level_id: null })

const statusOpts = [
  { label: '待审核', value: 'pending' },
  { label: '正常', value: 'active' },
  { label: '禁止下单', value: 'order_disabled' },
  { label: '禁止登录', value: 'login_disabled' },
]
const salesOpts = computed<SelectOption[]>(() => salesList.value.map((o) => ({ label: o.is_admin ? `管理员·${o.name}` : o.name, value: o.id })))
const referrerOpts = computed<SelectOption[]>(() =>
  list.value
    .filter((c) => c.status === 'active' && !c.is_system)
    .map((c) => ({ label: `${c.name}${c.phone ? `（${c.phone}）` : ''}`, value: c.id })),
)
const wechatOpts = [{ label: '已绑定', value: 'true' }, { label: '未绑定', value: 'false' }]
const tagOpts = computed<SelectOption[]>(() => tags.value.map((t) => ({ label: t.is_active ? t.name : `${t.name}（已停用）`, value: t.id })))
const activeTagOpts = computed<SelectOption[]>(() => tags.value.filter((t) => t.is_active).map((t) => ({ label: t.name, value: t.id })))
const deliveryModeOpts = [{ label: '开车自送', value: 'route' }, { label: '发物流', value: 'freight' }, { label: '城区自送', value: 'local' }]
const freightModeOpts = [{ label: '从货款扣', value: 'deduct' }, { label: '店家承担', value: 'store_paid' }, { label: '客户到付', value: 'customer_paid' }]
const lineOptionsFor = (regionId: number | null | undefined) =>
  freightLines.value
    .filter((line) => line.is_active && (regionId == null || line.stops.some((stop) => stop.town_region_id === regionId)))
    .map((line) => ({ label: line.name, value: line.id }))
const createLineOpts = computed(() => lineOptionsFor(createForm.delivery_region_id))
const editLineOpts = computed(() => lineOptionsFor(form.delivery_region_id))

function onDeliveryRegionChange(target: any, sel: RegionSelection | null) {
  target.province = sel?.province || ''
  target.city = sel?.city || ''
  target.district = sel?.district || ''
  target.town = sel?.town || ''
  if (!target.freight_line_id) return
  const line = freightLines.value.find((item) => item.id === target.freight_line_id)
  if (!line || !line.stops.some((stop) => stop.town_region_id === target.delivery_region_id)) {
    target.freight_line_id = null
  }
}

function onDeliveryModeChange(target: any) {
  if (target.default_delivery_mode === 'local') {
    target.freight_line_id = null
  }
}

function composeAddress(target: any): string | null {
  const parts = [target.province, target.city, target.district, target.town, target.detail_address]
    .map((s) => (s || '').trim())
    .filter(Boolean)
  return parts.length ? parts.join('') : null
}
const levelOpts = computed<SelectOption[]>(() =>
  levels.value
    .filter((l) => l.level_id !== 'walk_in')
    .map((l) => ({ label: `${l.nickname} (${l.level_id})`, value: l.id, disabled: !l.is_active }))
)

const columns = computed<DataTableColumns<AdminCustomer>>(() => [
  { type: 'selection', disabled: (r) => !!r.is_system },
  { title: 'ID', key: 'id', width: 60 },
  { title: '客户名称', key: 'name', width: 130, ellipsis: { tooltip: true } },
  { title: '联系人', key: 'contact_name', width: 100, render: (r) => r.contact_name || '—' },
  { title: '手机号', key: 'phone', width: 130 },
  {
    title: '属地',
    key: 'delivery_region',
    width: 120,
    ellipsis: { tooltip: true },
    render: (r) => r.town || r.district || r.city || r.province || '—',
  },
  { title: '客户标签', key: 'tag_name', width: 110, render: (r) => r.tag_name ? h(NTag, { size: 'small', bordered: false }, { default: () => r.tag_name }) : '—' },
  { title: '归属销售', key: 'sales_name', width: 110, render: (r) => r.sales_name ? (r.sales_is_admin ? `管理员·${r.sales_name}` : r.sales_name) : '—' },
  { title: '介绍人', key: 'referrer_customer_name', width: 110, render: (r) => r.referrer_customer_name || '—' },
  { title: '微信', key: 'wechat_bound', width: 80, render: (r) => h(NTag, { size: 'small', type: r.wechat_bound ? 'success' : 'default' }, { default: () => r.wechat_bound ? '已绑定' : '未绑定' }) },
  { title: '等级价格', key: 'level_nickname', width: 120, ellipsis: { tooltip: true }, render: (r) => r.level_nickname || '—' },
  { title: '状态', key: 'status', width: 100, render: (r) => h(NTag, { size: 'small', type: statusType(r.status) }, { default: () => statusLabel(r.status) }) },
  { title: '操作', key: 'actions', width: 175, fixed: 'right', render: (r) => actionBar([
    actionIcon({ icon: 'edit', label: '编辑', onClick: () => openEdit(r) }),
    h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openLevel(r) }, { default: () => '设置等级价格' }),
    actionIcon({ icon: 'delete', label: '删除', confirm: '确认删除?', onClick: () => onDelete(r) }),
  ]) },
])

function statusLabel(s: string) {
  const m: Record<string, string> = { pending: '待审核', active: '正常', order_disabled: '禁止下单', login_disabled: '禁止登录' }
  return m[s] || s
}

function statusType(s: string) {
  if (s === 'active') return 'success'
  if (s === 'pending') return 'warning'
  if (s === 'order_disabled') return 'warning'
  return 'error'
}

/** 筛选条件变化：回到第一页再查询 */
function search() {
  page.value = 1
  reload()
}

// 顶部全局搜索跳转或在本页再次选择客户时，同步路由 keyword 到筛选框
watch(
  () => route.query.keyword,
  () => {
    const next = typeof route.query.keyword === 'string' ? route.query.keyword : ''
    if (next === keyword.value) return
    keyword.value = next
    search()
  },
)

/** /customers 返回裸数组无 total（Apifox CustomerResponse[]），统一 page_size=20 逐页拉全量后前端分页 */
async function reload() {
  loading.value = true
  try {
    list.value = await fetchAllPages((p) =>
      adminCustomerApi.list({
        keyword: keyword.value || undefined,
        tag_id: tagFilter.value ?? undefined,
        status: status.value || undefined,
        sales_id: salesFilter.value ?? undefined,
        wechat_bound: wechatFilter.value == null ? undefined : wechatFilter.value === 'true',
        page: p,
        page_size: pageSize,
      }),
    )
    const validIds = new Set(list.value.map((c) => c.id))
    checkedRowKeys.value = checkedRowKeys.value.filter((id) => validIds.has(id))
  } finally { loading.value = false }
}

const pagedList = computed(() => list.value.slice((page.value - 1) * pageSize, page.value * pageSize))

async function loadLevels() {
  levels.value = await levelApi.list()
}

async function loadTags() {
  tags.value = await customerTagApi.list()
}

async function loadSales() {
  salesList.value = await adminCustomerApi.salesOptions()
}

function openCreate() {
  Object.assign(createForm, { name: '', phone: '', contact_name: '', contact_phone: '', tag_id: null, vendor_id: null, sales_id: null, referrer_customer_id: null, level_id: null, region_path: null, province: '', city: '', district: '', town: '', detail_address: '', address: '', default_delivery_mode: 'route', delivery_region_id: null, freight_line_id: null, default_freight_mode: 'deduct' })
  // 默认归当前登录账号（自来客）；账号不在可选列表里时留空，由后端按当前账号处理
  const me = auth.user?.id
  if (me != null && salesList.value.some((o) => o.id === me)) createForm.sales_id = me
  createVisible.value = true
}

async function onCreate() {
  if (!createForm.name || !/^1[3-9]\d{9}$/.test(createForm.phone || '')) {
    message.warning('请填写客户名称和正确的 11 位手机号')
    return
  }
  saving.value = true
  try {
    const res = await adminCustomerApi.create({
      name: createForm.name,
      phone: createForm.phone,
      contact_name: createForm.contact_name || null,
      contact_phone: createForm.contact_phone || null,
      tag_id: createForm.tag_id ?? null,
      vendor_id: createForm.vendor_id ?? null,
      sales_id: createForm.sales_id ?? null,
      referrer_customer_id: createForm.referrer_customer_id ?? null,
      level_id: createForm.level_id ?? null,
      province: createForm.province || null,
      city: createForm.city || null,
      district: createForm.district || null,
      town: createForm.town || null,
      detail_address: createForm.detail_address || null,
      address: composeAddress(createForm),
      default_delivery_mode: createForm.default_delivery_mode,
      delivery_region_id: createForm.delivery_region_id,
      freight_line_id: createForm.default_delivery_mode === 'local' ? null : createForm.freight_line_id,
      default_freight_mode: createForm.default_delivery_mode === 'local' ? 'deduct' : createForm.default_freight_mode,
    })
    message.success('已创建并生效')
    for (const warning of res.warnings || []) message.warning(warning.message)
    createVisible.value = false
    reload()
  } finally { saving.value = false }
}

function openEdit(r: AdminCustomer) {
  Object.assign(form, JSON.parse(JSON.stringify(r)))
  const line = freightLines.value.find((item) => item.id === form.freight_line_id)
  if (line && !line.stops.some((stop) => stop.town_region_id === form.delivery_region_id)) form.freight_line_id = null
  editVisible.value = true
}

async function onSave() {
  saving.value = true
  try {
    const res = await adminCustomerApi.update(form.id, {
      name: form.name,
      phone: form.phone,
      contact_name: form.contact_name || null,
      contact_phone: form.contact_phone || null,
      tag_id: form.tag_id ?? null,
      vendor_id: form.vendor_id ?? null,
      status: form.status,
      invite_code: form.invite_code || null,
      province: form.province || null,
      city: form.city || null,
      district: form.district || null,
      town: form.town || null,
      detail_address: form.detail_address || null,
      address: composeAddress(form),
      default_delivery_mode: form.default_delivery_mode,
      delivery_region_id: form.delivery_region_id,
      freight_line_id: form.default_delivery_mode === 'local' ? null : form.freight_line_id,
      default_freight_mode: form.default_delivery_mode === 'local' ? 'deduct' : form.default_freight_mode,
    })
    for (const warning of res.warnings || []) message.warning(warning.message)
    message.success('已更新')
    editVisible.value = false
    reload()
  } finally { saving.value = false }
}

async function onUnbind() {
  const res = await adminCustomerApi.unbindWechat(form.id)
  form.wechat_bound = res.customer.wechat_bound
  form.wechat_bound_at = res.customer.wechat_bound_at
  message.success('已解绑微信')
  reload()
}

async function onDelete(r: AdminCustomer) {
  await adminCustomerApi.remove(r.id)
  message.success('已删除')
  reload()
}

function openLevel(r: AdminCustomer) {
  levelTarget.value = r
  levelForm.level_id = r.level_id || null
  levelVisible.value = true
}

async function onAssignLevel() {
  if (!levelTarget.value || !levelForm.level_id) {
    message.warning('请选择等级价格')
    return
  }
  saving.value = true
  try {
    await adminCustomerApi.assignLevel(levelTarget.value.id, levelForm.level_id)
    message.success('等级价格已更新')
    levelVisible.value = false
    reload()
  } finally { saving.value = false }
}

function openBatchTag() {
  if (!checkedRowKeys.value.length) return
  batchTagId.value = null
  batchTagVisible.value = true
}

function openBatchLevel() {
  if (!checkedRowKeys.value.length) return
  batchLevelId.value = null
  batchLevelVisible.value = true
}

async function runBatch(ids: number[], task: (id: number) => Promise<unknown>): Promise<{ ok: number; failedIds: number[] }> {
  let ok = 0
  const failedIds: number[] = []
  const chunkSize = 5
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const results = await Promise.allSettled(chunk.map((id) => task(id)))
    results.forEach((res, idx) => {
      if (res.status === 'fulfilled') ok += 1
      else failedIds.push(chunk[idx])
    })
  }
  return { ok, failedIds }
}

async function onBatchAssignTag() {
  if (!checkedRowKeys.value.length) return
  batchSaving.value = true
  try {
    const ids = [...checkedRowKeys.value]
    const { ok, failedIds } = await runBatch(ids, (id) => adminCustomerApi.update(id, { tag_id: batchTagId.value ?? null }))
    if (failedIds.length === 0) {
      message.success(`已批量${batchTagId.value == null ? '清空' : '设置'} ${ok} 位客户的标签`)
      batchTagVisible.value = false
      checkedRowKeys.value = []
    } else {
      message.warning(`成功 ${ok} 位，失败 ${failedIds.length} 位`)
      checkedRowKeys.value = failedIds
    }
    reload()
  } finally { batchSaving.value = false }
}

async function onBatchAssignLevel() {
  if (!checkedRowKeys.value.length) return
  if (!batchLevelId.value) {
    message.warning('请选择等级价格')
    return
  }
  const targetLevelId = batchLevelId.value
  batchSaving.value = true
  try {
    const ids = [...checkedRowKeys.value]
    const { ok, failedIds } = await runBatch(ids, (id) => adminCustomerApi.assignLevel(id, targetLevelId))
    if (failedIds.length === 0) {
      message.success(`已批量设置 ${ok} 位客户的等级价格`)
      batchLevelVisible.value = false
      checkedRowKeys.value = []
    } else {
      message.warning(`成功 ${ok} 位，失败 ${failedIds.length} 位`)
      checkedRowKeys.value = failedIds
    }
    reload()
  } finally { batchSaving.value = false }
}

onMounted(() => { loadLevels(); loadTags(); loadSales(); reload(); deliveryApi.freightLines({ is_active: true }).then(lines => { freightLines.value = lines }); fetchAllPages<Vendor>((p) => vendorApi.list({ page: p, page_size: PAGE_SIZE })).then((vs) => { vendorList.value = vs }).catch(() => {}) })
</script>

<style scoped>
.customer-list-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.filter-card {
  flex-shrink: 0;
  z-index: 10;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.06);
}

.filter-card .page-header {
  margin-bottom: 12px;
}

.filter-card .filter-bar {
  margin-bottom: 0;
}

.batch-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}

.batch-count {
  font-size: 13px;
  color: var(--text-2);
  margin-right: 4px;
}

.table-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.customer-table {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.pagination-footer {
  flex-shrink: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 -2px 10px rgba(15, 23, 42, 0.06);
}

.result-count {
  font-size: 12px;
  color: var(--text-3);
}
</style>
