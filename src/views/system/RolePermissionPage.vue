<template>
  <div class="page-container">
    <n-tabs type="line" animated>
      <n-tab-pane name="roles" tab="角色列表">
        <div class="card-section">
          <div class="page-header"><h2 class="page-title">角色列表</h2><n-button type="primary" @click="openRoleCreate">新建角色</n-button></div>
          <n-alert type="info" :bordered="false" style="margin-bottom: 16px">权限按“模块 / 功能 / 权限点”的颗粒度配置，可为角色分配查看/新建/编辑/删除等权限点。</n-alert>
          <n-data-table :columns="roleColumns" :data="roles" :loading="rolesLoading" :bordered="false" size="small" />
        </div>
      </n-tab-pane>
      <n-tab-pane name="permissions" tab="功能权限">
        <div class="card-section">
          <div class="page-header"><h2 class="page-title">功能权限</h2><n-button type="primary" @click="openPermissionCreate(null)">新建一级功能</n-button></div>
          <n-alert type="warning" :bordered="false" style="margin-bottom: 16px">模块节点下可挂接功能/权限点；删除有子节点的功能前需先删除其子节点。</n-alert>
          <n-tree :data="featureTree" key-field="id" label-field="name" children-field="children" default-expand-all block-line :render-label="renderPermissionLabel" />
        </div>
      </n-tab-pane>
    </n-tabs>

    <n-modal v-model:show="roleModalVisible" :title="roleForm.id ? '编辑角色' : '新建角色'" preset="card" style="width: 720px">
      <n-form :model="roleForm" label-placement="left" label-width="100">
        <n-form-item label="角色名称"><n-input v-model:value="roleForm.name" /></n-form-item>
        <n-form-item label="角色编码"><n-input v-model:value="roleForm.code" placeholder="如 sales_manager" :disabled="!!roleForm.id" /></n-form-item>
        <n-form-item label="排序"><n-input-number v-model:value="roleForm.sort_order" :min="0" /></n-form-item>
        <n-form-item label="登录端">
          <n-radio-group v-model:value="roleForm.platform">
            <n-radio-button value="web">Web 管理端</n-radio-button>
            <n-radio-button value="sales">销售端</n-radio-button>
          </n-radio-group>
        </n-form-item>
        <n-form-item label="描述"><n-input v-model:value="roleForm.description" type="textarea" :rows="2" /></n-form-item>
        <n-form-item label="启用"><n-switch v-model:value="roleForm.is_active" /></n-form-item>
        <n-form-item label="权限控制">
          <div class="permission-tree-box">
            <n-tree
              :data="featureTree"
              key-field="id"
              label-field="name"
              children-field="children"
              checkable
              cascade
              default-expand-all
              :checked-keys="roleForm.feature_ids || []"
              @update:checked-keys="onRoleFeatureChange"
            />
          </div>
        </n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="roleModalVisible = false">取消</n-button>
        <n-button type="primary" :loading="roleSaving" @click="onRoleSave">保存</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="permissionModalVisible" :title="permissionForm.id ? '编辑功能' : '新建功能'" preset="card" style="width: 520px">
      <n-form :model="permissionForm" label-placement="left" label-width="100">
        <n-form-item v-if="permissionForm.parent_name" label="父功能"><n-tag>{{ permissionForm.parent_name }}</n-tag></n-form-item>
        <n-form-item label="功能名称"><n-input v-model:value="permissionForm.name" /></n-form-item>
        <n-form-item label="功能编码"><n-input v-model:value="permissionForm.code" placeholder="如 product:create" /></n-form-item>
        <n-form-item label="功能类型">
          <n-radio-group v-model:value="permissionForm.type">
            <n-radio-button value="module">模块</n-radio-button>
            <n-radio-button value="function">功能</n-radio-button>
            <n-radio-button value="permission">权限点</n-radio-button>
          </n-radio-group>
        </n-form-item>
        <n-form-item label="排序"><n-input-number v-model:value="permissionForm.sort_order" :min="0" /></n-form-item>
        <n-form-item label="启用"><n-switch v-model:value="permissionForm.is_active" /></n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="permissionModalVisible = false">取消</n-button>
        <n-button type="primary" :loading="permissionSaving" @click="onPermissionSave">保存</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="assignVisible" :title="`权限配置 · ${assignRole?.name || ''}`" preset="card" style="width: 680px">
      <n-alert type="info" :bordered="false" style="margin-bottom: 12px">勾选功能树即可分配模块/功能/权限点，父级勾选会级联其子级。</n-alert>
      <div class="permission-tree-box">
        <n-tree
          :data="featureTree"
          key-field="id"
          label-field="name"
          children-field="children"
          checkable
          cascade
          default-expand-all
          :checked-keys="assignKeys"
          @update:checked-keys="onAssignKeysChange"
        />
      </div>
      <template #footer>
        <n-button @click="assignVisible = false">取消</n-button>
        <n-button type="primary" :loading="assignSaving" @click="onAssignSave">保存权限</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, reactive, onMounted, computed } from 'vue'
import { NButton, NTag, NSpace, NPopconfirm, useMessage, type DataTableColumns } from 'naive-ui'
import { roleApi, featureApi } from '@/api'
import type { RoleConfig, FeatureNode } from '@/types'

const message = useMessage()
const roles = ref<RoleConfig[]>([])
const featureTree = ref<FeatureNode[]>([])
const rolesLoading = ref(false)
const roleModalVisible = ref(false)
const roleSaving = ref(false)
const roleForm = reactive<any>({ id: 0, name: '', code: '', description: '', sort_order: 0, platform: 'web', is_active: true, feature_ids: [] })

const permissionModalVisible = ref(false)
const permissionSaving = ref(false)
const permissionForm = reactive<any>({ id: 0, parent_id: null, parent_name: '', name: '', code: '', type: 'module', sort_order: 0, is_active: true })

const assignVisible = ref(false)
const assignSaving = ref(false)
const assignRole = ref<RoleConfig | null>(null)
const assignKeys = ref<(string | number)[]>([])

const roleColumns = computed<DataTableColumns<RoleConfig>>(() => [
  { title: 'ID', key: 'id', width: 60 },
  { title: '角色名称', key: 'name', width: 130, render: (r) => h('div', [r.name, r.is_system ? h(NTag, { size: 'tiny', bordered: false, style: 'margin-left:4px' }, { default: () => '内置' }) : null]) },
  { title: '编码', key: 'code', width: 120 },
  { title: '排序', key: 'sort_order', width: 60 },
  { title: '登录端', key: 'platform', width: 110, render: (r) => h(NTag, { size: 'small', type: r.platform === 'web' ? 'primary' : 'warning' }, { default: () => r.platform === 'web' ? 'Web 管理端' : '销售端' }) },
  { title: '描述', key: 'description', ellipsis: { tooltip: true } },
  { title: '权限点', key: 'feature_ids', width: 80, render: (r) => `${r.feature_ids.length}` },
  { title: '状态', key: 'is_active', width: 70, render: (r) => h(NTag, { size: 'small', type: r.is_active ? 'success' : 'error' }, { default: () => r.is_active ? '启用' : '禁用' }) },
  { title: '操作', key: 'actions', width: 210, render: (r) => h('div', [
    h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openRoleEdit(r) }, { default: () => '编辑' }),
    h(NButton, { size: 'small', text: true, type: 'primary', style: 'margin-left:8px', onClick: () => openAssign(r) }, { default: () => '权限配置' }),
    r.is_system ? null : h(NPopconfirm, { onPositiveClick: () => onRoleDelete(r) }, {
      default: () => '确认删除?',
      trigger: () => h(NButton, { size: 'small', text: true, type: 'error', style: 'margin-left:8px' }, { default: () => '删除' }),
    }),
  ]) },
])

async function reloadRoles() {
  rolesLoading.value = true
  try { roles.value = await roleApi.list() } finally { rolesLoading.value = false }
}

async function loadPermissions() {
  featureTree.value = await featureApi.tree()
}

function openRoleCreate() {
  Object.assign(roleForm, { id: 0, name: '', code: '', description: '', sort_order: roles.value.length + 1, platform: 'web', is_active: true, feature_ids: [] })
  roleModalVisible.value = true
}

function onRoleFeatureChange(keys: Array<string | number>) {
  roleForm.feature_ids = keys
}

function openRoleEdit(r: RoleConfig) {
  Object.assign(roleForm, JSON.parse(JSON.stringify(r)))
  roleForm.feature_ids = [...r.feature_ids]
  roleModalVisible.value = true
}

async function onRoleSave() {
  roleSaving.value = true
  try {
    const base = { name: roleForm.name, description: roleForm.description, sort_order: roleForm.sort_order || 0, platform: roleForm.platform || 'web', is_active: roleForm.is_active }
    const feature_ids = (roleForm.feature_ids || []).map(Number)
    if (roleForm.id) { await roleApi.update(roleForm.id, { ...base, feature_ids }); message.success('已更新') }
    else { await roleApi.create({ ...base, code: roleForm.code, feature_ids }); message.success('已创建') }
    roleModalVisible.value = false
    reloadRoles()
  } finally { roleSaving.value = false }
}

async function onRoleDelete(r: RoleConfig) {
  await roleApi.remove(r.id)
  message.success('已删除')
  reloadRoles()
}

async function openAssign(r: RoleConfig) {
  assignRole.value = r
  assignKeys.value = [...r.feature_ids]
  if (!featureTree.value.length) await loadPermissions()
  assignVisible.value = true
}

function onAssignKeysChange(keys: Array<string | number>) {
  assignKeys.value = keys
}

async function onAssignSave() {
  if (!assignRole.value) return
  assignSaving.value = true
  try {
    await roleApi.setFeatures(assignRole.value.id, assignKeys.value.map(Number))
    message.success('权限已更新')
    assignVisible.value = false
    reloadRoles()
  } finally { assignSaving.value = false }
}

function openPermissionCreate(parent: FeatureNode | null) {
  const type = !parent ? 'module' : parent.type === 'module' ? 'function' : 'permission'
  Object.assign(permissionForm, { id: 0, parent_id: parent?.id || null, parent_name: parent?.name || '', name: '', code: '', type, sort_order: 0, is_active: true })
  permissionModalVisible.value = true
}

function openPermissionEdit(node: FeatureNode) {
  Object.assign(permissionForm, { ...node, parent_name: '' })
  permissionModalVisible.value = true
}

async function onPermissionSave() {
  permissionSaving.value = true
  try {
    const payload = {
      name: permissionForm.name,
      code: permissionForm.code,
      type: permissionForm.type,
      parent_id: permissionForm.parent_id,
      sort_order: permissionForm.sort_order,
      is_active: permissionForm.is_active,
    }
    if (permissionForm.id) { await featureApi.update(permissionForm.id, payload); message.success('已更新') }
    else { await featureApi.create(payload); message.success('已创建') }
    permissionModalVisible.value = false
    loadPermissions()
  } finally { permissionSaving.value = false }
}

async function onPermissionDelete(node: FeatureNode) {
  await featureApi.remove(node.id)
  message.success('已删除')
  loadPermissions()
}

function typeLabel(type: string) {
  const m: Record<string, string> = { module: '模块', function: '功能', permission: '权限点' }
  return m[type] || type
}

function renderPermissionLabel({ option }: { option: any }) {
  return h('span', { style: 'display:flex;align-items:center;gap:4px;flex:1;justify-content:space-between;' }, [
    h('span', [
      option.name,
      h(NTag, { size: 'tiny', type: option.type === 'module' ? 'primary' : option.type === 'function' ? 'warning' : 'default', style: 'margin-left:4px' }, { default: () => typeLabel(option.type) }),
      !option.is_active ? h(NTag, { size: 'tiny', type: 'error', style: 'margin-left:4px' }, { default: () => '禁用' }) : null,
    ]),
    h(NSpace, { size: 'small' }, { default: () => [
      h(NButton, { size: 'tiny', text: true, type: 'primary', onClick: (e: Event) => { e.stopPropagation(); openPermissionCreate(option) } }, { default: () => '添加子节点' }),
      h(NButton, { size: 'tiny', text: true, type: 'primary', onClick: (e: Event) => { e.stopPropagation(); openPermissionEdit(option) } }, { default: () => '编辑' }),
      h(NPopconfirm, { onPositiveClick: () => onPermissionDelete(option) }, {
        default: () => '确认删除?',
        trigger: () => h(NButton, { size: 'tiny', text: true, type: 'error', onClick: (e: Event) => e.stopPropagation() }, { default: () => '删除' }),
      }),
    ] }),
  ])
}

onMounted(() => { reloadRoles(); loadPermissions() })
</script>

<style scoped>
.permission-tree-box {
  max-height: 480px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
}
</style>
