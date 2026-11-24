<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">客户标签</h2>
        <n-button type="primary" @click="openCreate">新建标签</n-button>
      </div>
      <n-alert type="info" :bordered="false" style="margin-bottom: 16px">
        客户标签用于客户业态分类与筛选，可指定一个「价格体系 → 等级价格」中的等级作为适用等级价格（不选则默认适用「默认售价」）。点击等级标签可直接进入该等级设置 SKU 价格。
      </n-alert>
      <n-data-table
        :columns="columns"
        :data="tags"
        :loading="loading"
        :bordered="false"
        size="small"
        :row-key="(r: CustomerTag) => r.id"
      />
    </div>

    <n-modal v-model:show="editVisible" :title="form.id ? '编辑标签' : '新建标签'" preset="card" style="width: 500px">
      <n-form :model="form" label-placement="left" label-width="105">
        <n-form-item label="标签名称" required>
          <n-input v-model:value="form.name" placeholder="如：批发商、店铺餐饮、食堂" @keyup.enter="onSave" />
        </n-form-item>
        <n-form-item label="适用等级价格">
          <n-select
            v-model:value="form.level_id"
            clearable
            filterable
            :options="levelOpts"
            placeholder="不选则默认使用「默认售价」"
          />
        </n-form-item>
        <n-form-item label="排序">
          <n-input-number v-model:value="form.sort_order" :min="0" :step="10" style="width: 160px" />
          <span style="margin-left: 8px; color: var(--text-3); font-size: 12px">数字越小越靠前</span>
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
import { useRouter } from 'vue-router'
import {
  NButton, NTag, NSwitch, NPopconfirm, useMessage,
  type DataTableColumns, type SelectOption,
} from 'naive-ui'
import { customerTagApi, levelApi } from '@/api'
import { formatDate } from '@/utils/format'
import type { CustomerTag, LevelStats } from '@/types'
import { actionBar, actionIcon } from '@/components/tableActions'

const router = useRouter()
const message = useMessage()

const loading = ref(false)
const saving = ref(false)
const tags = ref<CustomerTag[]>([])
const levels = ref<LevelStats[]>([])
const editVisible = ref(false)

const form = reactive<{
  id: number
  name: string
  level_id: number | null
  sort_order: number
  is_active: boolean
}>({
  id: 0,
  name: '',
  level_id: null,
  sort_order: 0,
  is_active: true,
})

const levelMap = computed(() => new Map(levels.value.map((lv) => [lv.id, lv])))
const defaultRetailLevel = computed(() => levels.value.find((lv) => lv.level_id === 'default_retail') || null)

const levelOpts = computed<SelectOption[]>(() =>
  levels.value
    .filter((lv) => lv.level_id !== 'walk_in')
    .map((lv) => ({
      label: `${lv.nickname}${lv.is_active === false ? '（已禁用）' : ''}`,
      value: lv.id,
      disabled: lv.is_active === false,
    })),
)

function goToLevel(levelId: number | null | undefined) {
  if (!levelId) return
  router.push({ path: '/prices/levels', query: { levelId: String(levelId) } })
}

const columns = computed<DataTableColumns<CustomerTag>>(() => [
  { title: '标签名称', key: 'name', width: 160, ellipsis: { tooltip: true } },
  {
    title: '适用的等级价格',
    key: 'applicable_level',
    minWidth: 240,
    render: (r) => {
      if (r.level_id != null) {
        const lv = levelMap.value.get(r.level_id)
        const label = lv
          ? `${lv.nickname}${lv.is_active === false ? '（已禁用）' : ''}`
          : (r.level_nickname || `等级 #${r.level_id}`)
        const type = lv && lv.is_active === false ? 'default' : 'primary'
        return h(
          NTag,
          {
            size: 'small',
            type,
            bordered: false,
            style: 'cursor:pointer',
            onClick: () => goToLevel(r.level_id),
          },
          { default: () => label },
        )
      }
      const fallback = defaultRetailLevel.value
      return h(
        NTag,
        {
          size: 'small',
          type: 'info',
          bordered: false,
          style: fallback ? 'cursor:pointer' : undefined,
          onClick: fallback ? () => goToLevel(fallback.id) : undefined,
        },
        { default: () => `${fallback?.nickname || '默认售价'}（默认）` },
      )
    },
  },
  {
    title: '客户数',
    key: 'customer_count',
    width: 90,
    render: (r) => r.customer_count ?? 0,
  },
  { title: '排序', key: 'sort_order', width: 80 },
  {
    title: '启用',
    key: 'is_active',
    width: 90,
    render: (r) =>
      h(NSwitch, {
        value: r.is_active,
        size: 'small',
        'onUpdate:value': (v: boolean) => onToggle(r, v),
      }),
  },
  {
    title: '创建时间',
    key: 'created_at',
    width: 160,
    render: (r) => (r.created_at ? formatDate(r.created_at) : '—'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 90,
    render: (r) =>
      actionBar([
        actionIcon({ icon: 'edit', label: '编辑', onClick: () => openEdit(r) }),
        actionIcon({
          icon: 'delete',
          label: '删除',
          confirm: '确认删除该标签？（若有客户正在使用将无法删除，可改为停用）',
          onClick: () => onDelete(r),
        }),
      ]),
  },
])

async function reload() {
  loading.value = true
  try {
    ;[tags.value, levels.value] = await Promise.all([
      customerTagApi.list(),
      levelApi.stats(),
    ])
  } finally {
    loading.value = false
  }
}

function openCreate() {
  const maxSort = tags.value.reduce((acc, t) => Math.max(acc, t.sort_order || 0), 0)
  Object.assign(form, {
    id: 0,
    name: '',
    level_id: null,
    sort_order: maxSort + 10,
    is_active: true,
  })
  editVisible.value = true
}

function openEdit(row: CustomerTag) {
  Object.assign(form, {
    id: row.id,
    name: row.name,
    level_id: row.level_id ?? null,
    sort_order: row.sort_order ?? 0,
    is_active: row.is_active,
  })
  editVisible.value = true
}

async function onSave() {
  const name = form.name.trim()
  if (!name) {
    message.warning('请输入标签名称')
    return
  }
  saving.value = true
  try {
    const payload = {
      name,
      level_id: form.level_id ?? null,
      sort_order: form.sort_order ?? 0,
      is_active: form.is_active,
    }
    if (form.id) {
      await customerTagApi.update(form.id, payload)
      message.success('标签已更新')
    } else {
      await customerTagApi.create(payload)
      message.success('标签已新建')
    }
    editVisible.value = false
    await reload()
  } finally {
    saving.value = false
  }
}

async function onToggle(row: CustomerTag, active: boolean) {
  await customerTagApi.update(row.id, { is_active: active })
  message.success(active ? '已启用' : '已停用')
  await reload()
}

async function onDelete(row: CustomerTag) {
  await customerTagApi.remove(row.id)
  message.success('标签已删除')
  await reload()
}

onMounted(reload)
</script>
