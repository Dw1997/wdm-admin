<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">客户等级管理</h2>
        <div class="header-actions">
          <n-select v-model:value="sourceFilter" style="width: 160px" :options="sourceOpts" />
          <n-button type="primary" @click="openCreate">新建等级</n-button>
        </div>
      </div>
      <n-alert type="info" :bordered="false" style="margin-bottom: 16px">
        客户等级只维护基础信息；价格调整规则在价格体系模块中独立配置。
      </n-alert>
      <n-data-table :columns="columns" :data="filteredList" :loading="loading" :bordered="false" size="small" />
    </div>

    <n-modal v-model:show="editVisible" :title="form.id ? '编辑等级' : '新建等级'" preset="card" style="width: 560px">
      <n-form :model="form" label-placement="left" label-width="120">
        <n-form-item label="等级名称" required>
          <n-input v-model:value="form.nickname" placeholder="请输入等级显示名称" />
        </n-form-item>
        <n-form-item label="编码" required>
          <n-input v-model:value="form.level_id" placeholder="等级业务编码，如 vip（仅支持字母/数字/下划线/中划线）" />
        </n-form-item>
        <n-form-item label="客户类型">
          <n-radio-group v-model:value="form.type">
            <n-radio-button value="retail">零售</n-radio-button>
            <n-radio-button value="wholesale">批发</n-radio-button>
          </n-radio-group>
        </n-form-item>
        <n-form-item label="描述">
          <n-input v-model:value="form.description" type="textarea" :rows="2" placeholder="选填" />
        </n-form-item>
        <n-form-item label="启用">
          <n-switch v-model:value="form.is_active" />
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
import { NButton, NTag, NPopconfirm, useMessage, type DataTableColumns } from 'naive-ui'
import { levelApi } from '@/api'
import { CUSTOMER_LEVEL_TYPE } from '@/utils/dict'
import type { LevelConfig } from '@/types'

const message = useMessage()
const list = ref<LevelConfig[]>([])
const sourceFilter = ref('')
const sourceOpts = [
  { label: '全部来源', value: '' },
  { label: '系统管理员创建', value: 'system' },
  { label: '销售创建', value: 'sales' },
]
const loading = ref(false)
const saving = ref(false)
const editVisible = ref(false)
const form = reactive<any>({
  id: 0,
  level_id: '',
  nickname: '',
  type: 'wholesale',
  description: '',
  is_active: true,
})

const filteredList = computed(() => {
  if (!sourceFilter.value) return list.value
  return list.value.filter((l) => sourceFilter.value === 'system' ? l.is_system : !l.is_system)
})

const columns = computed<DataTableColumns<LevelConfig>>(() => [
  { title: '等级名称', key: 'nickname', width: '16%', ellipsis: { tooltip: true } },
  { title: '业务编码', key: 'level_id', width: '14%', ellipsis: { tooltip: true } },
  {
    title: '客户类型', key: 'type', width: '10%',
    render: (r) => h(NTag, { size: 'small', type: CUSTOMER_LEVEL_TYPE[r.type]?.type || 'default' }, { default: () => CUSTOMER_LEVEL_TYPE[r.type]?.label || r.type }),
  },
  {
    title: '来源', key: 'source', width: '12%',
    render: (r) => h(NTag, { size: 'small', type: r.is_system ? 'primary' : 'warning' }, { default: () => (r.is_system ? '系统管理员' : '销售') }),
  },
  { title: '客户数', key: 'customer_count', width: '8%', render: (r) => r.customer_count ?? 0 },
  { title: '描述', key: 'description', ellipsis: { tooltip: true }, render: (r) => r.description || '—' },
  {
    title: '状态', key: 'is_active', width: '8%',
    render: (r) => h(NTag, { size: 'small', type: r.is_active ? 'success' : 'error' }, { default: () => (r.is_active ? '启用' : '禁用') }),
  },
  {
    title: '操作', key: 'actions', width: '10%',
    render: (r) => h('div', [
      h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openEdit(r) }, { default: () => '编辑' }),
      h(NPopconfirm, { onPositiveClick: () => onDelete(r) }, {
        default: () => '确认删除该等级？',
        trigger: () => h(NButton, { size: 'small', text: true, type: 'error', style: 'margin-left:8px' }, { default: () => '删除' }),
      }),
    ]),
  },
])

async function reload() {
  loading.value = true
  try {
    list.value = await levelApi.list()
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(form, {
    id: 0,
    level_id: '',
    nickname: '',
    type: 'wholesale',
    description: '',
    is_active: true,
  })
  editVisible.value = true
}

function openEdit(row: LevelConfig) {
  Object.assign(form, {
    id: row.id,
    level_id: row.level_id,
    nickname: row.nickname,
    type: row.type,
    description: row.description || '',
    is_active: row.is_active,
  })
  editVisible.value = true
}

async function onSave() {
  const nickname = String(form.nickname || '').trim()
  const levelId = String(form.level_id || '').trim()
  if (!nickname || !levelId) {
    message.warning('请填写等级显示名称和业务编码')
    return
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(levelId)) {
    message.warning('业务编码仅支持字母、数字、下划线和中划线')
    return
  }
  const payload = {
    level_id: levelId,
    nickname,
    type: form.type,
    description: form.description || null,
    is_active: form.is_active,
  }

  saving.value = true
  try {
    if (form.id) {
      await levelApi.update(form.id, payload)
      message.success('已更新')
    } else {
      await levelApi.create(payload)
      message.success('已创建')
    }
    editVisible.value = false
    reload()
  } finally {
    saving.value = false
  }
}

async function onDelete(row: LevelConfig) {
  await levelApi.remove(row.id)
  message.success('已删除')
  reload()
}

onMounted(reload)
</script>

<style scoped>
.header-actions { display: flex; align-items: center; gap: 8px; }
</style>
