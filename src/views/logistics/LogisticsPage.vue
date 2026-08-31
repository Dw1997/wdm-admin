<template>
  <div class="page-container">
    <n-tabs type="line" animated>
      <n-tab-pane name="warehouses" tab="仓库">
        <div class="card-section">
          <div class="page-header"><h2 class="page-title">仓库管理</h2><n-button type="primary" @click="openWarehouseCreate">新建仓库</n-button></div>
          <n-data-table :columns="warehouseColumns" :data="warehouses" :loading="loading" :bordered="false" size="small" :row-key="(r:any)=>r.id" />
        </div>
      </n-tab-pane>
      <n-tab-pane name="zones" tab="库区">
        <div class="card-section">
          <div class="page-header"><h2 class="page-title">库区管理</h2><n-button type="primary" @click="openZoneCreate">新建库区</n-button></div>
          <n-data-table :columns="zoneColumns" :data="zones" :loading="loading" :bordered="false" size="small" :row-key="(r:any)=>r.id" />
        </div>
      </n-tab-pane>
    </n-tabs>

    <n-modal v-model:show="warehouseModalVisible" :title="warehouseForm.id ? '编辑仓库' : '新建仓库'" preset="card" style="width: 460px">
      <n-form :model="warehouseForm" label-placement="left" label-width="100">
        <n-form-item label="仓库名称"><n-input v-model:value="warehouseForm.name" /></n-form-item>
        <n-form-item label="仓库类型">
          <n-select v-model:value="warehouseForm.type" :options="warehouseTypeOpts" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="warehouseModalVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="onWarehouseSave">保存</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="zoneModalVisible" :title="zoneForm.id ? '编辑库区' : '新建库区'" preset="card" style="width: 460px">
      <n-form :model="zoneForm" label-placement="left" label-width="100">
        <n-form-item label="所属仓库"><n-select v-model:value="zoneForm.warehouse_id" :options="warehouseOpts" /></n-form-item>
        <n-form-item label="库区名称"><n-input v-model:value="zoneForm.name" /></n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="zoneModalVisible = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="onZoneSave">保存</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, reactive, computed, onMounted } from 'vue'
import { NButton, NTag, NPopconfirm, useMessage, type DataTableColumns, type SelectOption } from 'naive-ui'
import { warehouseApi } from '@/api'
import type { Warehouse, WarehouseZone } from '@/types'

const message = useMessage()
const warehouses = ref<Warehouse[]>([])
const zones = ref<WarehouseZone[]>([])
const loading = ref(false)
const saving = ref(false)
const warehouseModalVisible = ref(false)
const zoneModalVisible = ref(false)
const warehouseForm = reactive<any>({ id: 0, name: '', type: 'main' })
const zoneForm = reactive<any>({ id: 0, warehouse_id: null, name: '' })

const warehouseTypeOpts = [{ label: '主仓', value: 'main' }, { label: '退货仓', value: 'return' }, { label: '虚拟仓', value: 'virtual' }]
const warehouseOpts = computed<SelectOption[]>(() => warehouses.value.map((w) => ({ label: w.name, value: w.id })))

const warehouseColumns = computed<DataTableColumns<Warehouse>>(() => [
  { title: 'ID', key: 'id', width: 60 },
  { title: '仓库名称', key: 'name', width: 180 },
  { title: '类型', key: 'type', width: 120, render: (r) => h(NTag, { size: 'small', type: r.type === 'main' ? 'primary' : r.type === 'return' ? 'warning' : 'default' }, { default: () => r.type === 'main' ? '主仓' : r.type === 'return' ? '退货仓' : '虚拟仓' }) },
  { title: '操作', key: 'actions', width: 120, render: (r) => h('div', [
    h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openWarehouseEdit(r) }, { default: () => '编辑' }),
    h(NPopconfirm, { onPositiveClick: () => onWarehouseDelete(r) }, {
      default: () => '确认删除?',
      trigger: () => h(NButton, { size: 'small', text: true, type: 'error', style: 'margin-left:8px' }, { default: () => '删除' }),
    }),
  ]) },
])

const zoneColumns = computed<DataTableColumns<WarehouseZone>>(() => [
  { title: 'ID', key: 'id', width: 60 },
  { title: '所属仓库', key: 'warehouse_id', width: 160, render: (r) => warehouseName(r.warehouse_id) },
  { title: '库区名称', key: 'name' },
  { title: '操作', key: 'actions', width: 120, render: (r) => h('div', [
    h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openZoneEdit(r) }, { default: () => '编辑' }),
    h(NPopconfirm, { onPositiveClick: () => onZoneDelete(r) }, {
      default: () => '确认删除?',
      trigger: () => h(NButton, { size: 'small', text: true, type: 'error', style: 'margin-left:8px' }, { default: () => '删除' }),
    }),
  ]) },
])

function warehouseName(id: number) {
  return warehouses.value.find((w) => w.id === id)?.name || String(id)
}

async function reload() {
  loading.value = true
  try {
    warehouses.value = await warehouseApi.list()
    zones.value = await warehouseApi.zones()
  } finally { loading.value = false }
}

function openWarehouseCreate() {
  Object.assign(warehouseForm, { id: 0, name: '', type: 'main' })
  warehouseModalVisible.value = true
}

function openWarehouseEdit(r: Warehouse) {
  Object.assign(warehouseForm, JSON.parse(JSON.stringify(r)))
  warehouseModalVisible.value = true
}

async function onWarehouseSave() {
  if (!warehouseForm.name) {
    message.warning('请填写仓库名称')
    return
  }
  saving.value = true
  try {
    if (warehouseForm.id) { await warehouseApi.update(warehouseForm.id, { name: warehouseForm.name, type: warehouseForm.type }); message.success('已更新') }
    else { await warehouseApi.create({ name: warehouseForm.name, type: warehouseForm.type }); message.success('已创建') }
    warehouseModalVisible.value = false
    reload()
  } finally { saving.value = false }
}

async function onWarehouseDelete(r: Warehouse) {
  await warehouseApi.remove(r.id)
  message.success('已删除')
  reload()
}

function openZoneCreate() {
  Object.assign(zoneForm, { id: 0, warehouse_id: warehouses.value[0]?.id ?? null, name: '' })
  zoneModalVisible.value = true
}

function openZoneEdit(r: WarehouseZone) {
  Object.assign(zoneForm, JSON.parse(JSON.stringify(r)))
  zoneModalVisible.value = true
}

async function onZoneSave() {
  if (!zoneForm.warehouse_id || !zoneForm.name) {
    message.warning('请选择仓库并填写库区名称')
    return
  }
  saving.value = true
  try {
    if (zoneForm.id) { await warehouseApi.updateZone(zoneForm.id, { name: zoneForm.name }); message.success('已更新') }
    else { await warehouseApi.createZone({ warehouse_id: zoneForm.warehouse_id, name: zoneForm.name }); message.success('已创建') }
    zoneModalVisible.value = false
    reload()
  } finally { saving.value = false }
}

async function onZoneDelete(r: WarehouseZone) {
  await warehouseApi.removeZone(r.id)
  message.success('已删除')
  reload()
}

onMounted(reload)
</script>
