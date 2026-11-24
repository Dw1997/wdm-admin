<template>
  <div class="page-container">
    <n-card title="库存查询（参考值，不影响销售）">
      <n-space align="center" style="margin-bottom: 16px" wrap>
        <n-input
          v-model:value="keyword"
          placeholder="搜索商品名 / 编码"
          clearable
          style="width: 220px"
          @keyup.enter="resetPage"
        />
        <n-checkbox v-model:checked="negativeOnly" @update:checked="resetPage">只看负库存</n-checkbox>
        <n-checkbox v-model:checked="includeTempPick" @update:checked="resetPage">包含临时拿货商品</n-checkbox>
        <n-button type="primary" @click="resetPage">查询</n-button>
        <n-button @click="load">刷新</n-button>
      </n-space>

      <n-data-table :columns="columns" :data="rows" :loading="loading" :bordered="false" />
      <n-pagination
        v-if="total > 20"
        v-model:page="page"
        :page-size="20"
        :item-count="total"
        style="margin-top: 16px; justify-content: flex-end"
        @update:page="load"
      />
    </n-card>

    <!-- 调整库存弹窗 -->
    <n-modal v-model:show="adjustVisible" preset="card" title="手动调整库存" style="width: 440px">
      <n-form v-if="adjustTarget" label-placement="left" label-width="96">
        <n-form-item label="商品">{{ adjustTarget.spu_name }}（{{ adjustTarget.base_unit }}）</n-form-item>
        <n-form-item label="当前库存">{{ adjustTarget.on_hand }} {{ adjustTarget.base_unit }}</n-form-item>
        <n-form-item label="调整方式">
          <n-radio-group v-model:value="adjustMode">
            <n-radio value="target">设为目标数量</n-radio>
            <n-radio value="delta">按增减量调整</n-radio>
          </n-radio-group>
        </n-form-item>
        <n-form-item :label="adjustMode === 'target' ? '目标库存' : '增减数量'">
          <n-input
            v-model:value="adjustValue"
            :placeholder="adjustMode === 'target' ? '如 50.0' : '正数增加、负数减少，如 -5.0'"
          />
        </n-form-item>
        <n-form-item label="调整原因" required>
          <n-input v-model:value="adjustReason" type="textarea" placeholder="必填，如盘点差异、损耗" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="adjustVisible = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="submitAdjust">确认调整</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 库存流水抽屉 -->
    <n-drawer v-model:show="movementVisible" :width="720">
      <n-drawer-content :title="movementTarget ? `${movementTarget.spu_name} · 库存流水` : '库存流水'">
        <n-data-table :columns="movementColumns" :data="movements" :loading="movementLoading" :bordered="false" />
        <n-pagination
          v-if="movementTotal > 20"
          v-model:page="movementPage"
          :page-size="20"
          :item-count="movementTotal"
          style="margin-top: 16px; justify-content: flex-end"
          @update:page="loadMovements"
        />
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { h, onMounted, ref } from 'vue'
import { NButton, NSpace, NTag, type DataTableColumns } from 'naive-ui'
import { stockApi } from '@/api'
import type { StockMovementRow, StockRow } from '@/types'

const message = useMessage()
const keyword = ref('')
const negativeOnly = ref(false)
const includeTempPick = ref(false)
const rows = ref<StockRow[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)

const adjustVisible = ref(false)
const adjustTarget = ref<StockRow | null>(null)
const adjustMode = ref<'target' | 'delta'>('target')
const adjustValue = ref('')
const adjustReason = ref('')
const saving = ref(false)

const movementVisible = ref(false)
const movementTarget = ref<StockRow | null>(null)
const movements = ref<StockMovementRow[]>([])
const movementTotal = ref(0)
const movementPage = ref(1)
const movementLoading = ref(false)

const movementTypeLabels: Record<string, string> = {
  purchase_in: '采购入库',
  sale_out: '销售送达',
  return_in: '客户退货入库',
  purchase_return: '退回供应商',
  adjust: '手动调整',
  stock_check: '盘点',
}

const columns: DataTableColumns<StockRow> = [
  { title: '商品编码', key: 'spu_code', width: 120 },
  { title: '商品名称', key: 'spu_name', minWidth: 160 },
  {
    title: '默认货源',
    key: 'supply_mode',
    width: 110,
    render: (row) =>
      h(
        NTag,
        { size: 'small', type: row.supply_mode === 'temp_pick' ? 'info' : 'default' },
        { default: () => (row.supply_mode === 'temp_pick' ? '临时拿货' : '店家自己') },
      ),
  },
  {
    title: '现有库存',
    key: 'on_hand',
    width: 130,
    render: (row) => {
      if (row.supply_mode === 'temp_pick') return '不计库存'
      return h(
        'span',
        { style: row.is_negative ? 'color: #dc2626; font-weight: 600' : '' },
        `${row.on_hand} ${row.base_unit}`,
      )
    },
  },
  {
    title: '待配送占用',
    key: 'pending_quantity',
    width: 120,
    render: (row) => (row.supply_mode === 'temp_pick' ? '—' : `${row.pending_quantity} ${row.base_unit}`),
  },
  {
    title: '可用参考量',
    key: 'available_quantity',
    width: 130,
    render: (row) => (row.supply_mode === 'temp_pick' ? '—' : `${row.available_quantity} ${row.base_unit}`),
  },
  {
    title: '最近变动',
    key: 'updated_at',
    width: 170,
    render: (row) => (row.updated_at ? new Date(row.updated_at).toLocaleString('zh-CN') : '—'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          { text: true, type: 'primary', onClick: () => openMovements(row) },
          { default: () => '流水' },
        ),
        row.supply_mode === 'self'
          ? h(
              NButton,
              { text: true, type: 'warning', onClick: () => openAdjust(row) },
              { default: () => '调整' },
            )
          : null,
      ]),
  },
]

const movementColumns: DataTableColumns<StockMovementRow> = [
  {
    title: '时间',
    key: 'occurred_at',
    width: 160,
    render: (row) => new Date(row.occurred_at).toLocaleString('zh-CN'),
  },
  {
    title: '类型',
    key: 'type',
    width: 110,
    render: (row) => movementTypeLabels[row.type] || row.type,
  },
  {
    title: '规格',
    key: 'sku_name',
    render: (row) => row.sku_name || '按 SPU',
  },
  {
    title: '变动量',
    key: 'change',
    width: 100,
    render: (row) => {
      const n = Number(row.change)
      return h(
        'span',
        { style: n >= 0 ? 'color: #16a34a; font-weight: 600' : 'color: #dc2626; font-weight: 600' },
        `${n > 0 ? '+' : ''}${row.change} ${row.base_unit}`,
      )
    },
  },
  { title: '操作人', key: 'operator_name', width: 90, render: (row) => row.operator_name || '—' },
  { title: '备注', key: 'remark', render: (row) => row.remark || '—' },
]

function resetPage() {
  page.value = 1
  void load()
}

async function load() {
  loading.value = true
  try {
    const res = await stockApi.list({
      keyword: keyword.value.trim() || undefined,
      negative_only: negativeOnly.value || undefined,
      include_temp_pick: includeTempPick.value || undefined,
      page: page.value,
      page_size: 20,
    })
    rows.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function openAdjust(row: StockRow) {
  adjustTarget.value = row
  adjustMode.value = 'target'
  adjustValue.value = row.on_hand
  adjustReason.value = ''
  adjustVisible.value = true
}

async function submitAdjust() {
  if (!adjustTarget.value) return
  if (!/^-?\d+(?:\.\d)?$/.test(adjustValue.value.trim()) || !adjustReason.value.trim()) {
    message.warning('请填写有效数量（最多1位小数）和调整原因')
    return
  }
  saving.value = true
  try {
    await stockApi.adjust(adjustTarget.value.spu_id, {
      ...(adjustMode.value === 'target'
        ? { target_quantity: adjustValue.value.trim() }
        : { change: adjustValue.value.trim() }),
      reason: adjustReason.value.trim(),
    })
    adjustVisible.value = false
    message.success('库存已调整')
    await load()
  } finally {
    saving.value = false
  }
}

function openMovements(row: StockRow) {
  movementTarget.value = row
  movementPage.value = 1
  movementVisible.value = true
  void loadMovements()
}

async function loadMovements() {
  if (!movementTarget.value) return
  movementLoading.value = true
  try {
    const res = await stockApi.movements({
      spu_id: movementTarget.value.spu_id,
      page: movementPage.value,
      page_size: 20,
    })
    movements.value = res.items
    movementTotal.value = res.total
  } finally {
    movementLoading.value = false
  }
}

onMounted(() => {
  void load()
})
</script>
