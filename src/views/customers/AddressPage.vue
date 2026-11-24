<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">客户地址</h2>
        <n-button type="primary" @click="reload">刷新</n-button>
      </div>
      <div class="filter-bar">
        <n-input v-model:value="keyword" placeholder="搜索客户名称 / 手机号" clearable style="width: 240px" @keyup.enter="reload" />
        <n-button type="primary" size="small" @click="reload">查询</n-button>
      </div>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" :row-key="(r:any)=>r.id" />
    </div>

    <n-modal v-model:show="editVisible" title="编辑收货地址" preset="card" style="width: 600px">
      <n-form label-placement="left" label-width="100">
        <n-form-item label="客户"><span>{{ form.name }}</span></n-form-item>
        <n-form-item label="收货地点">
          <RegionPicker
            v-model:value="form.delivery_region_id"
            :fallback-label="[form.province, form.city, form.district, form.town].filter(Boolean).join(' / ')"
            @change="onRegionChange"
          />
        </n-form-item>
        <n-form-item label="详细地址">
          <n-input v-model:value="form.detail_address" placeholder="街道 / 门牌 / 摊位号" maxlength="255" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="editVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="onSave">保存</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, reactive, computed, onMounted } from 'vue'
import { NButton, NPopconfirm, useMessage, type DataTableColumns } from 'naive-ui'
import { adminCustomerApi } from '@/api'
import type { AdminCustomer, RegionSelection } from '@/types'
import RegionPicker from '@/components/RegionPicker.vue'

const message = useMessage()
const list = ref<AdminCustomer[]>([])
const keyword = ref('')
const loading = ref(false)
const saving = ref(false)
const editVisible = ref(false)
const form = reactive<{
  id: number
  name: string
  delivery_region_id: number | null
  province: string
  city: string
  district: string
  town: string
  detail_address: string
}>({
  id: 0,
  name: '',
  delivery_region_id: null,
  province: '',
  city: '',
  district: '',
  town: '',
  detail_address: '',
})

const columns = computed<DataTableColumns<AdminCustomer>>(() => [
  { title: 'ID', key: 'id', width: 60 },
  { title: '客户名称', key: 'name', width: 140 },
  { title: '手机号', key: 'phone', width: 140 },
  { title: '收货地点', key: 'region', width: 220, ellipsis: { tooltip: true }, render: (r) => [r.province, r.city, r.district, r.town].filter(Boolean).join(' / ') || h('span', { style: 'color:var(--text-3)' }, '未设置') },
  { title: '收货地址', key: 'address', ellipsis: { tooltip: true }, render: (r) => r.address || r.detail_address || h('span', { style: 'color:var(--text-3)' }, '未填写') },
  { title: '操作', key: 'actions', width: 150, render: (r) => h('div', [
    h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openEdit(r) }, { default: () => '编辑地址' }),
    (r.address || r.delivery_region_id) ? h(NPopconfirm, { onPositiveClick: () => onClear(r) }, {
      default: () => '确认清除该地址?',
      trigger: () => h(NButton, { size: 'small', text: true, type: 'error', style: 'margin-left:8px' }, { default: () => '清除' }),
    }) : null,
  ]) },
])

async function reload() {
  loading.value = true
  try { list.value = await adminCustomerApi.list({ keyword: keyword.value || undefined, page_size: 100 }) } finally { loading.value = false }
}

function openEdit(r: AdminCustomer) {
  Object.assign(form, {
    id: r.id,
    name: r.name,
    delivery_region_id: r.delivery_region_id ?? null,
    province: r.province || '',
    city: r.city || '',
    district: r.district || '',
    town: r.town || '',
    detail_address: r.detail_address || r.address || '',
  })
  editVisible.value = true
}

function onRegionChange(sel: RegionSelection | null) {
  form.province = sel?.province || ''
  form.city = sel?.city || ''
  form.district = sel?.district || ''
  form.town = sel?.town || ''
}

async function onSave() {
  saving.value = true
  try {
    const detail = form.detail_address.trim()
    const composed = [form.province, form.city, form.district, form.town, detail].filter(Boolean).join('')
    await adminCustomerApi.update(form.id, {
      delivery_region_id: form.delivery_region_id,
      province: form.province || null,
      city: form.city || null,
      district: form.district || null,
      town: form.town || null,
      detail_address: detail || null,
      address: composed || null,
    })
    message.success('地址已更新')
    editVisible.value = false
    reload()
  } finally { saving.value = false }
}

async function onClear(r: AdminCustomer) {
  await adminCustomerApi.update(r.id, {
    delivery_region_id: null,
    province: null,
    city: null,
    district: null,
    town: null,
    detail_address: null,
    address: null,
  })
  message.success('地址已清除')
  reload()
}

onMounted(reload)
</script>
