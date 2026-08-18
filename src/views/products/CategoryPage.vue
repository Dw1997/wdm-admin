<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">分类管理</h2><n-button type="primary" @click="openCreate(null)">新建一级分类</n-button></div>
      <n-alert type="info" :bordered="false" style="margin-bottom: 16px">最多4级分类：一级 → 二级 → 三级 → 四级（叶子节点）</n-alert>
      <n-tree :data="treeData" key-field="id" label-field="name" children-field="children" default-expand-all block-line
        :render-label="renderLabel" />
    </div>
    <n-modal v-model:show="editVisible" :title="form.id ? '编辑分类' : '新建分类'" preset="card" style="width: 500px">
      <n-form :model="form" label-placement="left" label-width="100">
        <n-form-item v-if="form.parent_name" label="父分类"><n-tag>{{ form.parent_name }}</n-tag></n-form-item>
        <n-form-item label="分类名称"><n-input v-model:value="form.name" /></n-form-item>
        <n-form-item label="图标"><n-input v-model:value="form.icon" placeholder="emoji" /></n-form-item>
        <n-form-item label="排序"><n-input-number v-model:value="form.sort_order" :min="0" /></n-form-item>
        <n-form-item label="描述"><n-input v-model:value="form.description" type="textarea" :rows="2" /></n-form-item>
        <n-form-item label="启用"><n-switch v-model:value="form.is_active" /></n-form-item>
      </n-form>
      <template #footer><n-button @click="editVisible=false">取消</n-button><n-button type="primary" :loading="saving" @click="onSave">保存</n-button></template>
    </n-modal>
  </div>
</template>
<script setup lang="ts">
import { h, ref, reactive, onMounted } from 'vue'
import { NButton, NTag, NSpace, NPopconfirm, useMessage } from 'naive-ui'
import { categoryApi } from '@/api'
import type { Category } from '@/types'

const treeData = ref<Category[]>([])
const editVisible = ref(false); const saving = ref(false); const message = useMessage()
const form = reactive<any>({ id: 0, name: '', parent_id: null, parent_name: '', sort_order: 0, icon: '', description: '', is_active: true })

function renderLabel({ option }: { option: Category }) {
  return h('span', { style: 'display:flex;align-items:center;gap:4px;flex:1;justify-content:space-between;' }, [
    h('span', [option.icon ? h('span', { style: 'margin-right:4px' }, option.icon) : null, option.name,
      h(NTag, { size: 'tiny', bordered: false, style: 'margin-left:4px' }, { default: () => `L${option.level}` }),
      !option.is_active ? h(NTag, { size: 'tiny', type: 'error', style: 'margin-left:4px' }, { default: () => '禁用' }) : null,
    ]),
    h(NSpace, { size: 'small' }, { default: () => [
      option.level < 4 ? h(NButton, { size: 'tiny', text: true, type: 'primary', onClick: (e: Event) => { e.stopPropagation(); openCreate(option) } }, { default: () => '添加子分类' }) : null,
      h(NButton, { size: 'tiny', text: true, type: 'primary', onClick: (e: Event) => { e.stopPropagation(); openEdit(option) } }, { default: () => '编辑' }),
      h(NPopconfirm, { onPositiveClick: () => onDelete(option) }, { default: () => '确认删除?', trigger: () => h(NButton, { size: 'tiny', text: true, type: 'error', onClick: (e: Event) => e.stopPropagation() }, { default: () => '删除' }) }),
    ] }),
  ])
}
async function loadTree() { treeData.value = await categoryApi.tree() }
function openCreate(parent: Category | null) { Object.assign(form, { id: 0, name: '', parent_id: parent?.id || null, parent_name: parent?.name || '', sort_order: 0, icon: '', description: '', is_active: true }); editVisible.value = true }
function openEdit(node: Category) { Object.assign(form, { ...node, parent_name: '' }); editVisible.value = true }
async function onSave() {
  saving.value = true
  try {
    if (form.id) { await categoryApi.update(form.id, form); message.success('已更新') }
    else { await categoryApi.create(form); message.success('已创建') }
    editVisible.value = false; loadTree()
  } finally { saving.value = false }
}
async function onDelete(node: Category) { await categoryApi.remove(node.id); message.success('已删除'); loadTree() }
onMounted(loadTree)
</script>
