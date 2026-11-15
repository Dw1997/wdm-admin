<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">客户列表</h2>
        <n-button type="primary" @click="openCreate">新建客户</n-button>
      </div>
      <div class="filter-bar">
        <n-input v-model:value="keyword" placeholder="客户名称 / 手机号" clearable style="width: 240px" @keyup.enter="search" />
        <n-select v-model:value="status" placeholder="状态" clearable style="width: 140px" :options="statusOpts" @update:value="search" />
        <n-select v-model:value="salesFilter" placeholder="归属销售" clearable filterable style="width: 160px" :options="salesOpts" @update:value="search" />
        <n-select v-model:value="wechatFilter" placeholder="微信绑定" clearable style="width: 130px" :options="wechatOpts" @update:value="search" />
        <n-button type="primary" size="small" @click="search">查询</n-button>
      </div>
      <n-data-table :columns="columns" :data="pagedList" :loading="loading" :bordered="false" size="small" :scroll-x="1100" :row-key="(r:any)=>r.id" />
      <div class="pagination-bar">
        <n-pagination v-model:page="page" :item-count="list.length" :page-size="pageSize" />
      </div>
    </div>

    <n-modal v-model:show="createVisible" title="新建客户" preset="card" style="width: 680px">
      <n-alert type="info" :bordered="false" style="margin-bottom: 12px">
        手机号是客户之后微信登录时匹配档案的依据，请务必填写准确。保存后默认为待审核，客户微信登录时自动绑定，这里不能填写 UnionID / OpenID。
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
            <n-form-item label="归属销售">
              <n-select v-model:value="createForm.sales_id" filterable :options="salesOpts" placeholder="默认归自己（自来客）" />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="客户等级">
              <n-select v-model:value="createForm.level_id" clearable :options="levelOpts" placeholder="不选则待审核" />
            </n-form-item>
          </n-gi>
        </n-grid>
        <n-form-item label="省/市/区">
          <n-cascader
            v-model:value="createForm.region_path"
            :options="regionCascaderOptions"
            clearable
            placeholder="请选择省市区"
            style="width: 100%"
            @update:value="() => applyRegion(createForm)"
          />
        </n-form-item>
        <n-form-item label="镇/市场"><n-input v-model:value="createForm.town" /></n-form-item>
        <n-form-item label="详细地址"><n-input v-model:value="createForm.detail_address" /></n-form-item>
        <n-form-item label="收货地址"><n-input v-model:value="createForm.address" type="textarea" :rows="2" /></n-form-item>
        <n-grid :cols="2" :x-gap="16">
          <n-gi><n-form-item label="默认配送"><n-select v-model:value="createForm.default_delivery_mode" :options="deliveryModeOpts" /></n-form-item></n-gi>
          <n-gi><n-form-item label="送货地点"><n-cascader v-model:value="createForm.delivery_region_id" :options="regionCascaderOptions" clearable /></n-form-item></n-gi>
          <n-gi><n-form-item label="默认零担线路"><n-select v-model:value="createForm.freight_line_id" :options="freightLineOpts" clearable @update:value="createForm.freight_stop_id = null" /></n-form-item></n-gi>
          <n-gi><n-form-item label="默认下车点"><n-select v-model:value="createForm.freight_stop_id" :options="createStopOpts" clearable /></n-form-item></n-gi>
          <n-gi><n-form-item label="默认运费方式"><n-select v-model:value="createForm.default_freight_mode" :options="freightModeOpts" /></n-form-item></n-gi>
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
          <n-gi><n-form-item label="渠道类型"><n-select v-model:value="form.channel_type" :options="channelOpts" /></n-form-item></n-gi>
          <n-gi><n-form-item label="状态"><n-select v-model:value="form.status" :options="statusOpts" /></n-form-item></n-gi>
        </n-grid>
        <n-grid :cols="2" :x-gap="16">
          <n-gi><n-form-item label="生效额度"><span>¥{{ Number(form.effective_credit_limit || 0).toLocaleString() }}</span><span style="margin-left: 8px; color: #999">在「客户额度」页设置</span></n-form-item></n-gi>
          <n-gi><n-form-item label="邀请码"><n-input v-model:value="form.invite_code" /></n-form-item></n-gi>
        </n-grid>
        <n-form-item label="省/市/区">
          <n-cascader
            v-model:value="form.region_path"
            :options="regionCascaderOptions"
            clearable
            placeholder="请选择省市区"
            style="width: 100%"
            @update:value="() => applyRegion(form)"
          />
        </n-form-item>
        <n-form-item label="镇/市场"><n-input v-model:value="form.town" /></n-form-item>
        <n-form-item label="详细地址"><n-input v-model:value="form.detail_address" /></n-form-item>
        <n-form-item label="收货地址"><n-input v-model:value="form.address" type="textarea" :rows="2" /></n-form-item>
        <n-grid :cols="2" :x-gap="16">
          <n-gi><n-form-item label="默认配送"><n-select v-model:value="form.default_delivery_mode" :options="deliveryModeOpts" /></n-form-item></n-gi>
          <n-gi><n-form-item label="送货地点"><n-cascader v-model:value="form.delivery_region_id" :options="regionCascaderOptions" clearable /></n-form-item></n-gi>
          <n-gi><n-form-item label="默认零担线路"><n-select v-model:value="form.freight_line_id" :options="freightLineOpts" clearable @update:value="form.freight_stop_id = null" /></n-form-item></n-gi>
          <n-gi><n-form-item label="默认下车点"><n-select v-model:value="form.freight_stop_id" :options="editStopOpts" clearable /></n-form-item></n-gi>
          <n-gi><n-form-item label="默认运费方式"><n-select v-model:value="form.default_freight_mode" :options="freightModeOpts" /></n-form-item></n-gi>
        </n-grid>
      </n-form>
      <template #footer>
        <n-button @click="editVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="onSave">保存</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="levelVisible" title="设置客户等级" preset="card" style="width: 420px">
      <n-form label-placement="left" label-width="100">
        <n-form-item label="客户"><span>{{ levelTarget?.name }}</span></n-form-item>
        <n-form-item label="客户等级"><n-select v-model:value="levelForm.level_id" :options="levelOpts" /></n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="levelVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="onAssignLevel">保存</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, reactive, computed, onMounted } from 'vue'
import { NButton, NTag, NPopconfirm, useMessage, type DataTableColumns, type SelectOption } from 'naive-ui'
import { adminCustomerApi, deliveryApi, levelApi, regionApi, fetchAllPages, PAGE_SIZE } from '@/api'
import type { AdminCustomer, LevelConfig, RecordFreightLine, RegionNode, SalesOption } from '@/types'
import { useAuthStore } from '@/stores/auth'

const message = useMessage()
const auth = useAuthStore()
const list = ref<AdminCustomer[]>([])
const levels = ref<LevelConfig[]>([])
const regionOptions = ref<RegionNode[]>([])
const freightLines = ref<RecordFreightLine[]>([])
const keyword = ref('')
const status = ref('')
const salesFilter = ref<number | null>(null)
const wechatFilter = ref<string | null>(null)
const salesList = ref<SalesOption[]>([])
const page = ref(1)
const pageSize = PAGE_SIZE
const loading = ref(false)
const saving = ref(false)
const createVisible = ref(false)
const editVisible = ref(false)
const levelVisible = ref(false)
const levelTarget = ref<AdminCustomer | null>(null)
const createForm = reactive<any>({ name: '', phone: '', contact_name: '', contact_phone: '', sales_id: null, level_id: null, region_path: null, province: '', city: '', district: '', town: '', detail_address: '', address: '', default_delivery_mode: 'route', delivery_region_id: null, freight_line_id: null, freight_stop_id: null, default_freight_mode: 'deduct' })
const form = reactive<any>({ id: 0, name: '', phone: '', wechat_bound: false, wechat_bound_at: null, sales_name: null, sales_is_admin: false, contact_name: '', contact_phone: '', channel_type: 'sales', status: 'active', credit_limit: 0, invite_code: '', region_path: null, province: '', city: '', district: '', town: '', detail_address: '', address: '', default_delivery_mode: 'route', delivery_region_id: null, freight_line_id: null, freight_stop_id: null, default_freight_mode: 'deduct' })
const levelForm = reactive<any>({ level_id: null })

function mapRegion(node: RegionNode): any {
  return {
    label: node.name,
    value: node.id,
    children: node.children?.length ? node.children.map(mapRegion) : undefined,
  }
}

const regionCascaderOptions = computed(() => regionOptions.value.map(mapRegion))

const statusOpts = [
  { label: '待审核', value: 'pending' },
  { label: '正常', value: 'active' },
  { label: '禁止下单', value: 'order_disabled' },
  { label: '禁止登录', value: 'login_disabled' },
]
const salesOpts = computed<SelectOption[]>(() => salesList.value.map((o) => ({ label: o.is_admin ? `管理员·${o.name}` : o.name, value: o.id })))
const wechatOpts = [{ label: '已绑定', value: 'true' }, { label: '未绑定', value: 'false' }]
const channelOpts = [{ label: '销售', value: 'sales' }, { label: '自用', value: 'self_use' }]
const deliveryModeOpts = [{ label: '开车自送', value: 'route' }, { label: '发物流', value: 'freight' }, { label: '自送', value: 'local' }]
const freightModeOpts = [{ label: '从货款扣', value: 'deduct' }, { label: '店家承担', value: 'store_paid' }, { label: '客户到付', value: 'customer_paid' }]
const freightLineOpts = computed(() => freightLines.value.map(line => ({ label: line.name, value: line.id })))
const stopOptions = (lineId: number | null) => freightLines.value.find(line => line.id === lineId)?.stops.map(stop => ({ label: `${stop.town_name} ${stop.drop_point || ''}`, value: stop.id })) || []
const createStopOpts = computed(() => stopOptions(createForm.freight_line_id))
const editStopOpts = computed(() => stopOptions(form.freight_line_id))
const levelOpts = computed<SelectOption[]>(() => levels.value.map((l) => ({ label: `${l.nickname} (${l.level_id})`, value: l.id, disabled: !l.is_active })))

const columns = computed<DataTableColumns<AdminCustomer>>(() => [
  { title: 'ID', key: 'id', width: 60 },
  { title: '客户名称', key: 'name', width: 130, ellipsis: { tooltip: true } },
  { title: '联系人', key: 'contact_name', width: 100, render: (r) => r.contact_name || '—' },
  { title: '手机号', key: 'phone', width: 130 },
  { title: '渠道', key: 'channel_type', width: 80, render: (r) => h(NTag, { size: 'small', type: r.channel_type === 'sales' ? 'primary' : 'default' }, { default: () => r.channel_type === 'sales' ? '销售' : '自用' }) },
  { title: '归属销售', key: 'sales_name', width: 110, render: (r) => r.sales_name ? (r.sales_is_admin ? `管理员·${r.sales_name}` : r.sales_name) : '—' },
  { title: '微信', key: 'wechat_bound', width: 80, render: (r) => h(NTag, { size: 'small', type: r.wechat_bound ? 'success' : 'default' }, { default: () => r.wechat_bound ? '已绑定' : '未绑定' }) },
  { title: '等级', key: 'level_nickname', width: 110, render: (r) => r.level_nickname || '—' },
  { title: '状态', key: 'status', width: 100, render: (r) => h(NTag, { size: 'small', type: statusType(r.status) }, { default: () => statusLabel(r.status) }) },
  { title: '操作', key: 'actions', width: 190, fixed: 'right', render: (r) => h('div', [
    h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openEdit(r) }, { default: () => '编辑' }),
    h(NButton, { size: 'small', text: true, type: 'primary', style: 'margin-left:8px', onClick: () => openLevel(r) }, { default: () => '设置等级' }),
    h(NPopconfirm, { onPositiveClick: () => onDelete(r) }, {
      default: () => '确认删除?',
      trigger: () => h(NButton, { size: 'small', text: true, type: 'error', style: 'margin-left:8px' }, { default: () => '删除' }),
    }),
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

/** /customers 返回裸数组无 total（Apifox CustomerResponse[]），统一 page_size=20 逐页拉全量后前端分页 */
async function reload() {
  loading.value = true
  try {
    list.value = await fetchAllPages((p) =>
      adminCustomerApi.list({
        keyword: keyword.value || undefined,
        status: status.value || undefined,
        sales_id: salesFilter.value ?? undefined,
        wechat_bound: wechatFilter.value == null ? undefined : wechatFilter.value === 'true',
        page: p,
        page_size: pageSize,
      }),
    )
  } finally { loading.value = false }
}

const pagedList = computed(() => list.value.slice((page.value - 1) * pageSize, page.value * pageSize))

async function loadLevels() {
  levels.value = await levelApi.list()
}

async function loadSales() {
  salesList.value = await adminCustomerApi.salesOptions()
}

async function loadRegions() {
  regionOptions.value = await regionApi.tree()
}

function findRegionName(nodes: RegionNode[], id: number): string | null {
  for (const node of nodes) {
    if (node.id === id) return node.name
    const found = node.children ? findRegionName(node.children, id) : null
    if (found) return found
  }
  return null
}

function findRegionPath(nodes: RegionNode[], id: number, path: number[] = []): number[] | null {
  for (const node of nodes) {
    const p = [...path, node.id]
    if (node.id === id) return p
    if (node.children) {
      const found = findRegionPath(node.children, id, p)
      if (found) return found
    }
  }
  return null
}

function applyRegion(target: any) {
  // 单选 n-cascader 的 value 是叶子区域 id（非路径数组），需回溯完整路径取省市区名
  const ids = target.region_path == null ? [] : findRegionPath(regionOptions.value, Number(target.region_path)) || []
  const names = ids.map((id: number) => findRegionName(regionOptions.value, id)).filter(Boolean)
  target.province = names[0] || ''
  target.city = names[1] || ''
  target.district = names[2] || ''
}

function regionIdByNames(nodes: RegionNode[], province: string, city?: string, district?: string): number | null {
  for (const p of nodes) {
    if (p.name === province) {
      if (!city) return p.id
      for (const c of p.children || []) {
        if (c.name === city) {
          if (!district) return c.id
          for (const d of c.children || []) {
            if (d.name === district) return d.id
          }
          return c.id
        }
      }
      return p.id
    }
  }
  return null
}

function openCreate() {
  Object.assign(createForm, { name: '', phone: '', contact_name: '', contact_phone: '', sales_id: null, level_id: null, region_path: null, province: '', city: '', district: '', town: '', detail_address: '', address: '', default_delivery_mode: 'route', delivery_region_id: null, freight_line_id: null, freight_stop_id: null, default_freight_mode: 'deduct' })
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
      sales_id: createForm.sales_id ?? null,
      level_id: createForm.level_id ?? null,
      province: createForm.province || null,
      city: createForm.city || null,
      district: createForm.district || null,
      town: createForm.town || null,
      detail_address: createForm.detail_address || null,
      address: createForm.address || null,
      default_delivery_mode: createForm.default_delivery_mode,
      delivery_region_id: createForm.delivery_region_id,
      freight_line_id: createForm.freight_line_id,
      freight_stop_id: createForm.freight_stop_id,
      default_freight_mode: createForm.default_freight_mode,
    })
    message.success(res.customer.status === 'pending' ? '已创建，等待审核' : '已创建')
    createVisible.value = false
    reload()
  } finally { saving.value = false }
}

function openEdit(r: AdminCustomer) {
  Object.assign(form, JSON.parse(JSON.stringify(r)))
  form.region_path = regionIdByNames(regionOptions.value, form.province || '', form.city || '', form.district || '')
  editVisible.value = true
}

async function onSave() {
  saving.value = true
  try {
    await adminCustomerApi.update(form.id, {
      name: form.name,
      phone: form.phone,
      contact_name: form.contact_name || null,
      contact_phone: form.contact_phone || null,
      channel_type: form.channel_type,
      status: form.status,
      invite_code: form.invite_code || null,
      province: form.province || null,
      city: form.city || null,
      district: form.district || null,
      town: form.town || null,
      detail_address: form.detail_address || null,
      address: form.address || null,
      default_delivery_mode: form.default_delivery_mode,
      delivery_region_id: form.delivery_region_id,
      freight_line_id: form.freight_line_id,
      freight_stop_id: form.freight_stop_id,
      default_freight_mode: form.default_freight_mode,
    })
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
    message.warning('请选择客户等级')
    return
  }
  saving.value = true
  try {
    await adminCustomerApi.assignLevel(levelTarget.value.id, levelForm.level_id)
    message.success('等级已更新')
    levelVisible.value = false
    reload()
  } finally { saving.value = false }
}

onMounted(() => { loadLevels(); loadRegions(); loadSales(); reload(); deliveryApi.freightLines().then(lines => { freightLines.value = lines }) })
</script>
