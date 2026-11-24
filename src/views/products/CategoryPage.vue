<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">分类管理</h2><n-button type="primary" @click="openCreate(null)">新建分类</n-button></div>
      <n-alert type="info" :bordered="false" style="margin-bottom: 16px">无级分类：未指定上级即为一级分类，任意分类下都可继续添加子分类。</n-alert>
      <div class="filter-bar">
        <n-input v-model:value="keyword" placeholder="搜索分类名称" clearable style="width: 260px">
          <template #prefix><n-icon :component="Search" /></template>
        </n-input>
      </div>
      <n-tree :data="treeData" key-field="id" label-field="name" children-field="children" block-line expand-on-click
        :pattern="pattern" :render-label="renderLabel" />
    </div>
    <n-modal v-model:show="editVisible" :title="form.id ? '编辑分类' : '新建分类'" preset="card" style="width: 500px">
      <n-form :model="form" label-placement="left" label-width="100">
        <n-form-item label="上级分类">
          <n-tree-select
            v-model:value="form.parent_id"
            :options="treeData"
            key-field="id"
            label-field="name"
            children-field="children"
            clearable
            default-expand-all
            placeholder="不选择则为一级分类"
          />
        </n-form-item>
        <n-form-item label="分类名称"><n-input v-model:value="form.name" /></n-form-item>
        <n-form-item label="图标（400×400）">
          <n-upload
            v-model:file-list="iconFileList"
            :max="1"
            list-type="image-card"
            accept="image/*"
            :custom-request="uploadIcon"
            @remove="onIconRemove"
          />
          <span class="form-tip">本地上传 400×400 图片，后续用于小程序展示</span>
        </n-form-item>
        <n-form-item label="排序"><n-input-number v-model:value="form.sort_order" :min="0" /></n-form-item>
        <n-form-item label="描述"><n-input v-model:value="form.description" type="textarea" :rows="2" /></n-form-item>
        <n-form-item label="启用"><n-switch v-model:value="form.is_active" /></n-form-item>
      </n-form>
      <template #footer><n-button @click="editVisible=false">取消</n-button><n-button type="primary" :loading="saving" @click="onSave">保存</n-button></template>
    </n-modal>
  </div>
</template>
<script setup lang="ts">
import { h, ref, reactive, computed, onMounted } from 'vue'
import { NTag, useMessage, type UploadFileInfo } from 'naive-ui'
import { Search } from '@vicons/tabler'
import { categoryApi, uploadApi } from '@/api'
import type { Category } from '@/types'
import { actionBar, actionIcon } from '@/components/tableActions'

const treeData = ref<Category[]>([])
const keyword = ref('')
const pattern = computed(() => keyword.value.trim() || undefined)
const iconFileList = ref<UploadFileInfo[]>([])
const editVisible = ref(false); const saving = ref(false); const message = useMessage()
const form = reactive<any>({ id: 0, name: '', parent_id: null, sort_order: 0, icon: '', description: '', is_active: true })

const levelTagType = (level: number): 'primary' | 'default' => (level === 1 ? 'primary' : 'default')

function renderLabel({ option }: { option: any }) {
  return h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex:1;min-width:0;' }, [
    h('div', { style: 'display:flex;align-items:center;gap:8px;min-width:0;' }, [
      option.icon ? renderIcon(option.icon) : null,
      h('span', { style: 'font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, option.name),
      h(NTag, { size: 'small', bordered: false, type: levelTagType(option.level), style: 'flex-shrink:0' }, { default: () => `L${option.level}` }),
      !option.is_active ? h(NTag, { size: 'small', type: 'error', bordered: false, style: 'flex-shrink:0' }, { default: () => '已禁用' }) : null,
      option.children?.length ? h('span', { style: 'font-size:12px;color:var(--text-3);flex-shrink:0' }, `${option.children.length} 个子分类`) : null,
    ]),
    actionBar([
      actionIcon({ icon: 'add', label: '添加子分类', size: 16, stopPropagation: true, onClick: () => openCreate(option) }),
      actionIcon({ icon: 'edit', label: '编辑', size: 16, stopPropagation: true, onClick: () => openEdit(option) }),
      actionIcon({ icon: 'delete', label: '删除', size: 16, stopPropagation: true, confirm: '确认删除?', onClick: () => onDelete(option) }),
    ], { stopPropagation: true, gap: 8 }),
  ])
}

function renderIcon(icon: string) {
  if (icon.startsWith('http') || icon.startsWith('/uploads')) {
    return h('img', { src: icon, style: 'width:20px;height:20px;object-fit:cover;border-radius:4px;margin-right:4px' })
  }
  return h('span', { style: 'margin-right:4px' }, icon)
}

async function loadTree() { treeData.value = await categoryApi.tree() }
function openCreate(parent: Category | null) {
  Object.assign(form, { id: 0, name: '', parent_id: parent?.id || null, sort_order: 0, icon: '', description: '', is_active: true })
  iconFileList.value = []
  editVisible.value = true
}
function openEdit(node: Category) {
  Object.assign(form, JSON.parse(JSON.stringify(node)))
  iconFileList.value = form.icon ? [{ id: 'icon', name: 'icon', status: 'finished', url: form.icon }] : []
  editVisible.value = true
}

function validateSquare400(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img.width === 400 && img.height === 400)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(false)
    }
    img.src = url
  })
}

async function uploadIcon(options: any) {
  const file = options.file as UploadFileInfo
  if (!file.file) return
  const ok = await validateSquare400(file.file as File)
  if (!ok) {
    file.status = 'error'
    options.onError?.()
    message.warning('请上传 400×400 的图片')
    return
  }
  try {
    const res = await uploadApi.image(file.file as File)
    file.url = res.url
    file.status = 'finished'
    options.onFinish?.()
    form.icon = res.url
  } catch {
    file.status = 'error'
    options.onError?.()
  }
}

function onIconRemove(options: any) {
  form.icon = ''
  iconFileList.value = []
}
async function onSave() {
  saving.value = true
  try {
    const payload = { name: form.name, parent_id: form.parent_id || null, sort_order: form.sort_order || 0, icon: form.icon || '', description: form.description || '', is_active: form.is_active }
    if (form.id) { await categoryApi.update(form.id, payload); message.success('已更新') }
    else { await categoryApi.create(payload); message.success('已创建') }
    editVisible.value = false; loadTree()
  } finally { saving.value = false }
}
async function onDelete(node: Category) { await categoryApi.remove(node.id); message.success('已删除'); loadTree() }
onMounted(loadTree)
</script>

<style scoped>
.form-tip { margin-left: 8px; font-size: 12px; color: var(--text-3); }
:deep(.n-tree-node) { display: flex; align-items: center; height: 40px; border-radius: 8px; }
:deep(.n-tree-node-content) { height: 100%; align-items: center; }
:deep(.n-tree-node-content__text) { display: flex; flex: 1; align-items: center; min-width: 0; }
/* 搜索命中行：整行背景高亮，去掉默认的下划线 */
:deep(.n-tree-node--highlight) { background-color: var(--primary-soft); }
:deep(.n-tree-node--highlight .n-tree-node-content__text) { border-bottom: none; }
</style>
