<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">客户列表</h2>
        <n-button type="primary" @click="openCreate">新增客户</n-button>
      </div>
      <div class="filter-bar">
        <n-input v-model:value="keyword" placeholder="客户名称 / 手机号" clearable style="width: 240px" @keyup.enter="reload" />
        <n-select v-model:value="status" placeholder="状态" clearable style="width: 140px" :options="statusOpts" @update:value="reload" />
        <n-button type="primary" size="small" @click="reload">查询</n-button>
      </div>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" :row-key="(r:any)=>r.id" />
    </div>

    <n-modal v-model:show="createVisible" title="新增客户" preset="card" style="width: 680px">
      <n-form :model="createForm" label-placement="left" label-width="110">
        <n-grid :cols="2" :x-gap="16">
          <n-gi><n-form-item label="客户名称"><n-input v-model:value="createForm.name" /></n-form-item></n-gi>
          <n-gi><n-form-item label="手机号"><n-input v-model:value="createForm.phone" maxlength="11" /></n-form-item></n-gi>
        </n-grid>
        <n-grid :cols="2" :x-gap="16">
          <n-gi><n-form-item label="UnionID"><n-input v-model:value="createForm.unionid" /></n-form-item></n-gi>
          <n-gi><n-form-item label="OpenID"><n-input v-model:value="createForm.openid" /></n-form-item></n-gi>
        </n-grid>
        <n-form-item label="邀请码"><n-input v-model:value="createForm.invite_code" /></n-form-item>
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
          <n-gi><n-form-item label="UnionID"><n-input v-model:value="form.unionid" /></n-form-item></n-gi>
          <n-gi><n-form-item label="OpenID"><n-input v-model:value="form.openid" /></n-form-item></n-gi>
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
          <n-gi><n-form-item label="信用额度"><n-input-number v-model:value="form.credit_limit" :min="0" :step="1000" /></n-form-item></n-gi>
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
import { adminCustomerApi, levelApi, regionApi } from '@/api'
import type { AdminCustomer, LevelConfig, RegionNode } from '@/types'

const message = useMessage()
const list = ref<AdminCustomer[]>([])
const levels = ref<LevelConfig[]>([])
const regionOptions = ref<RegionNode[]>([])
const keyword = ref('')
const status = ref('')
const loading = ref(false)
const saving = ref(false)
const createVisible = ref(false)
const editVisible = ref(false)
const levelVisible = ref(false)
const levelTarget = ref<AdminCustomer | null>(null)
const createForm = reactive<any>({ name: '', phone: '', unionid: '', openid: '', invite_code: '', region_path: [], province: '', city: '', district: '', town: '', detail_address: '', address: '' })
const form = reactive<any>({ id: 0, name: '', phone: '', unionid: '', openid: '', contact_name: '', contact_phone: '', channel_type: 'sales', status: 'active', credit_limit: 0, invite_code: '', region_path: [], province: '', city: '', district: '', town: '', detail_address: '', address: '' })
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
const channelOpts = [{ label: '销售', value: 'sales' }, { label: '自用', value: 'self_use' }]
const levelOpts = computed<SelectOption[]>(() => levels.value.map((l) => ({ label: `${l.nickname} (${l.level_id})`, value: l.id, disabled: !l.is_active })))

const columns = computed<DataTableColumns<AdminCustomer>>(() => [
  { title: 'ID', key: 'id', width: 60 },
  { title: '客户名称', key: 'name', width: 130, ellipsis: { tooltip: true } },
  { title: '联系人', key: 'contact_name', width: 100, render: (r) => r.contact_name || '—' },
  { title: '手机号', key: 'phone', width: 130 },
  { title: '渠道', key: 'channel_type', width: 80, render: (r) => h(NTag, { size: 'small', type: r.channel_type === 'sales' ? 'primary' : 'default' }, { default: () => r.channel_type === 'sales' ? '销售' : '自用' }) },
  { title: '等级', key: 'level_nickname', width: 110, render: (r) => r.level_nickname || '—' },
  { title: '状态', key: 'status', width: 100, render: (r) => h(NTag, { size: 'small', type: statusType(r.status) }, { default: () => statusLabel(r.status) }) },
  { title: '操作', key: 'actions', width: 190, render: (r) => h('div', [
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

async function reload() {
  loading.value = true
  try { list.value = await adminCustomerApi.list({ keyword: keyword.value || undefined, status: status.value || undefined, page_size: 100 }) } finally { loading.value = false }
}

async function loadLevels() {
  levels.value = await levelApi.list()
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

function applyRegion(target: any) {
  const names = (target.region_path || []).map((id: number) => findRegionName(regionOptions.value, id)).filter(Boolean)
  target.province = names[0] || ''
  target.city = names[1] || ''
  target.district = names[2] || ''
}

function regionPathByNames(nodes: RegionNode[], province: string, city?: string, district?: string): number[] {
  for (const p of nodes) {
    if (p.name === province) {
      if (!city) return [p.id]
      for (const c of p.children || []) {
        if (c.name === city) {
          if (!district) return [p.id, c.id]
          for (const d of c.children || []) {
            if (d.name === district) return [p.id, c.id, d.id]
          }
          return [p.id, c.id]
        }
      }
      return [p.id]
    }
  }
  return []
}

function openCreate() {
  Object.assign(createForm, { name: '', phone: '', unionid: '', openid: '', invite_code: '', region_path: [], province: '', city: '', district: '', town: '', detail_address: '', address: '' })
  createVisible.value = true
}

async function onCreate() {
  if (!createForm.name || !createForm.phone || !createForm.unionid) {
    message.warning('请填写客户名称、手机号和 UnionID')
    return
  }
  saving.value = true
  try {
    await adminCustomerApi.register({
      name: createForm.name,
      phone: createForm.phone,
      unionid: createForm.unionid,
      openid: createForm.openid || null,
      invite_code: createForm.invite_code || null,
      province: createForm.province || null,
      city: createForm.city || null,
      district: createForm.district || null,
      town: createForm.town || null,
      detail_address: createForm.detail_address || null,
      address: createForm.address || null,
    })
    message.success('已创建，等待审核')
    createVisible.value = false
    reload()
  } finally { saving.value = false }
}

function openEdit(r: AdminCustomer) {
  Object.assign(form, JSON.parse(JSON.stringify(r)))
  form.region_path = regionPathByNames(regionOptions.value, form.province || '', form.city || '', form.district || '')
  editVisible.value = true
}

async function onSave() {
  saving.value = true
  try {
    await adminCustomerApi.update(form.id, {
      name: form.name,
      phone: form.phone,
      unionid: form.unionid,
      openid: form.openid || null,
      contact_name: form.contact_name || null,
      contact_phone: form.contact_phone || null,
      channel_type: form.channel_type,
      status: form.status,
      credit_limit: Number(form.credit_limit) || 0,
      invite_code: form.invite_code || null,
      province: form.province || null,
      city: form.city || null,
      district: form.district || null,
      town: form.town || null,
      detail_address: form.detail_address || null,
      address: form.address || null,
    })
    message.success('已更新')
    editVisible.value = false
    reload()
  } finally { saving.value = false }
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

onMounted(() => { loadLevels(); loadRegions(); reload() })
</script>
