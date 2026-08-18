<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">客户等级管理</h2><n-button type="primary" @click="openCreate">新建等级</n-button></div>
      <n-alert type="info" :bordered="false" style="margin-bottom: 16px">等级售价 = 默认售价 × (1 + 售价调整%)，如黄金 -10% = 默认价打9折</n-alert>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" />
    </div>
    <n-modal v-model:show="editVisible" :title="form.id ? '编辑等级' : '新建等级'" preset="card" style="width: 500px">
      <n-form :model="form" label-placement="left" label-width="100">
        <n-form-item label="等级名称"><n-input v-model:value="form.name" /></n-form-item>
        <n-form-item label="编码"><n-input v-model:value="form.code" /></n-form-item>
        <n-form-item label="类型"><n-radio-group v-model:value="form.type"><n-radio-button value="retail">零售</n-radio-button><n-radio-button value="wholesale">批发</n-radio-button></n-radio-group></n-form-item>
        <n-form-item label="售价调整(%)"><n-input-number v-model:value="form.price_adjustment" :step="5" /><span style="margin-left:8px;font-size:12px;color:#909399">负数=降价</span></n-form-item>
        <n-form-item label="排序"><n-input-number v-model:value="form.sort_order" :min="0" /></n-form-item>
        <n-form-item label="描述"><n-input v-model:value="form.description" type="textarea" :rows="2" /></n-form-item>
        <n-form-item label="启用"><n-switch v-model:value="form.is_active" /></n-form-item>
      </n-form>
      <template #footer><n-button @click="editVisible=false">取消</n-button><n-button type="primary" :loading="saving" @click="onSave">保存</n-button></template>
    </n-modal>
  </div>
</template>
<script setup lang="ts">
import { h, ref, reactive, onMounted, computed } from 'vue'
import { NButton, NTag, NPopconfirm, useMessage, type DataTableColumns } from 'naive-ui'
import { levelApi } from '@/api'
import type { LevelConfig } from '@/types'

const list = ref<LevelConfig[]>([]); const loading = ref(false); const editVisible = ref(false); const saving = ref(false); const message = useMessage()
const form = reactive<any>({ id: 0, name: '', code: '', type: 'wholesale', price_adjustment: 0, description: '', sort_order: 0, is_active: true })

const columns = computed<DataTableColumns<LevelConfig>>(() => [
  { title: '排序', key: 'sort_order', width: 60 },
  { title: '等级名称', key: 'name', width: 120 },
  { title: '编码', key: 'code', width: 100 },
  { title: '类型', key: 'type', width: 80, render: (r) => h(NTag, { size: 'small', type: r.type === 'wholesale' ? 'primary' : 'default' }, { default: () => r.type === 'wholesale' ? '批发' : '零售' }) },
  { title: '售价调整', key: 'price_adjustment', width: 100, render: (r) => `${r.price_adjustment > 0 ? '+' : ''}${r.price_adjustment}%` },
  { title: '描述', key: 'description', ellipsis: { tooltip: true } },
  { title: '状态', key: 'is_active', width: 60, render: (r) => h(NTag, { size: 'small', type: r.is_active ? 'success' : 'error' }, { default: () => r.is_active ? '启用' : '禁用' }) },
  { title: '操作', key: 'actions', width: 120, render: (r) => h('div', [h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openEdit(r) }, { default: () => '编辑' }), h(NPopconfirm, { onPositiveClick: () => onDelete(r) }, { default: () => '确认?', trigger: () => h(NButton, { size: 'small', text: true, type: 'error', style: 'margin-left:8px' }, { default: () => '删除' }) })]) },
])

async function reload() { loading.value = true; try { list.value = await levelApi.list() } finally { loading.value = false } }
function openCreate() { Object.assign(form, { id: 0, name: '', code: '', type: 'wholesale', price_adjustment: 0, description: '', sort_order: list.value.length + 1, is_active: true }); editVisible.value = true }
function openEdit(r: LevelConfig) { Object.assign(form, JSON.parse(JSON.stringify(r))); editVisible.value = true }
async function onSave() { saving.value = true; try { if (form.id) { await levelApi.update(form.id, form); message.success('已更新') } else { await levelApi.create(form); message.success('已创建') } editVisible.value = false; reload() } finally { saving.value = false } }
async function onDelete(r: LevelConfig) { await levelApi.remove(r.id); message.success('已删除'); reload() }
onMounted(reload)
</script>
