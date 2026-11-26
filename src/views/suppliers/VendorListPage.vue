<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">供应商列表</h2>
        <n-button type="primary" @click="openForm(null)">新建供应商</n-button>
      </div>

      <n-space style="margin-bottom: 16px" :size="12">
        <n-input
          v-model:value="filters.keyword"
          clearable
          placeholder="名称 / 手机号 / 联系人 / 联系电话"
          style="width: 280px"
          @keyup.enter="onSearch"
          @clear="onSearch"
        />
        <n-select
          v-model:value="filters.type"
          multiple
          clearable
          :options="typeOpts"
          placeholder="类型"
          style="width: 200px"
          @update:value="onSearch"
        />
        <n-select
          v-model:value="filters.status"
          multiple
          clearable
          :options="statusOpts"
          placeholder="状态"
          style="width: 200px"
          @update:value="onSearch"
        />
        <n-button type="primary" @click="onSearch">查询</n-button>
        <n-button @click="onReset">重置</n-button>
      </n-space>

      <n-data-table
        remote
        :columns="columns"
        :data="rows"
        :loading="loading"
        :bordered="false"
        size="small"
        :scroll-x="1100"
        :pagination="pagination"
      />
    </div>

    <VendorFormModal v-model:show="formVisible" :vendor-id="editingId" @saved="load" />
  </div>
</template>

<script setup lang="ts">
import { h, ref, reactive, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { NButton, NTag, useMessage, type DataTableColumns } from 'naive-ui'
import { vendorApi } from '@/api'
import { VENDOR_STATUS_OPTIONS, VENDOR_TYPE_OPTIONS, vendorStatusMeta, vendorTypeLabel } from '@/utils/dict'
import { formatDate } from '@/utils/format'
import type { PageResult, Vendor } from '@/types'
import VendorFormModal from './VendorFormModal.vue'
import { actionBar, actionIcon } from '@/components/tableActions'

const message = useMessage()
const route = useRoute()

const loading = ref(false)
const rows = ref<Vendor[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive<{ keyword: string; type: string[]; status: string[] }>({
  keyword: typeof route.query.keyword === 'string' ? route.query.keyword : '',
  type: [],
  status: [],
})

const typeOpts = VENDOR_TYPE_OPTIONS
const statusOpts = VENDOR_STATUS_OPTIONS

const pagination = computed(() => ({
  page: page.value,
  pageSize: pageSize.value,
  itemCount: total.value,
  showSizePicker: true,
  pageSizes: [20, 50, 100],
  prefix: ({ itemCount }: { itemCount?: number }) => `共 ${itemCount ?? 0} 条`,
  onUpdatePage: (p: number) => { page.value = p; load() },
  onUpdatePageSize: (s: number) => { pageSize.value = s; page.value = 1; load() },
}))

function address(r: Vendor) {
  return [r.province, r.city, r.district, r.town, r.detail_address].filter(Boolean).join('') || '—'
}

const columns = computed<DataTableColumns<Vendor>>(() => [
  {
    title: '名称', key: 'name', width: 180, ellipsis: { tooltip: true },
    render: (r) => h(NButton, { text: true, type: 'primary', onClick: () => openEdit(r) }, { default: () => r.name }),
  },
  { title: '类型', key: 'type', width: 100, render: (r) => h(NTag, { size: 'small' }, { default: () => vendorTypeLabel(r.type) }) },
  { title: '手机号', key: 'phone', width: 130, render: (r) => r.phone || '—' },
  { title: '联系人', key: 'contact_name', width: 100, render: (r) => r.contact_name || '—' },
  { title: '联系电话', key: 'contact_phone', width: 130, render: (r) => r.contact_phone || '—' },
  { title: '地址', key: 'address', minWidth: 220, ellipsis: { tooltip: true }, render: (r) => address(r) },
  {
    title: '状态', key: 'status', width: 100,
    render: (r) => {
      const m = vendorStatusMeta(r.status)
      return h(NTag, { size: 'small', type: m.type }, { default: () => m.label })
    },
  },
  { title: '创建时间', key: 'created_at', width: 160, render: (r) => formatDate(r.created_at) || '—' },
  {
    title: '操作', key: 'actions', width: 90, fixed: 'right',
    render: (r) => actionBar([
      actionIcon({ icon: 'edit', label: '编辑', onClick: () => openEdit(r) }),
      actionIcon({
        icon: 'delete',
        label: '删除',
        confirm: '删除后列表不再显示该供应商，已有的采购和往来记录不受影响。确认删除？',
        onClick: () => onDelete(r),
      }),
    ]),
  },
])

const formVisible = ref(false)
const editingId = ref<number | null>(null)

function openForm(id: number | null) {
  editingId.value = id
  formVisible.value = true
}

function openEdit(r: Vendor) {
  openForm(r.id)
}

async function load() {
  loading.value = true
  try {
    const v = await vendorApi.list({
      keyword: filters.keyword.trim() || undefined,
      type: filters.type.length ? filters.type.join(',') : undefined,
      status: filters.status.length ? filters.status.join(',') : undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    const res: PageResult<Vendor> = Array.isArray(v) ? { items: v, total: v.length, page: 1, page_size: v.length } : v
    rows.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function onSearch() {
  page.value = 1
  load()
}

// 顶部全局搜索跳转或在本页再次选择供应商时，同步路由 keyword 到筛选框
watch(
  () => route.query.keyword,
  () => {
    const next = typeof route.query.keyword === 'string' ? route.query.keyword : ''
    if (next === filters.keyword) return
    filters.keyword = next
    onSearch()
  },
)

function onReset() {
  filters.keyword = ''
  filters.type = []
  filters.status = []
  onSearch()
}

async function onDelete(r: Vendor) {
  await vendorApi.remove(r.id)
  message.success('已删除')
  // 删到当前页最后一条时回退一页
  if (rows.value.length === 1 && page.value > 1) page.value -= 1
  load()
}

onMounted(load)
</script>
