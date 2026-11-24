<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">操作审计日志</h2></div>
      <n-alert type="warning" :bordered="false" style="margin-bottom: 16px">全系统关键操作（改价、订单流转、客户变更、收款退货、库存调整、系统设置等）均自动记录，管理员可查看全部日志。</n-alert>
      <div class="filter-bar" style="flex-wrap: wrap">
        <n-input
          v-model:value="keyword"
          placeholder="单号 / 名称 / 备注 / 操作人"
          clearable
          style="width: 210px"
          @keyup.enter="resetPage"
          @clear="resetPage"
        />
        <n-date-picker v-model:value="dateRange" type="daterange" clearable style="width: 240px" @update:value="resetPage" />
        <n-select v-model:value="filterType" placeholder="目标类型" clearable filterable style="width: 150px" :options="TARGET_OPTIONS" @update:value="resetPage" />
        <n-select v-model:value="filterAction" placeholder="操作类型" clearable filterable style="width: 140px" :options="ACTION_OPTIONS" @update:value="resetPage" />
        <n-select v-model:value="filterRole" placeholder="角色" clearable style="width: 110px" :options="ROLE_OPTIONS" @update:value="onRoleChange" />
        <n-select v-model:value="filterUser" placeholder="操作人" clearable filterable style="width: 160px" :options="userOpts" @update:value="resetPage" />
        <n-button type="primary" size="small" @click="resetPage">查询</n-button>
        <n-button size="small" @click="resetAll">重置</n-button>
      </div>
      <n-data-table
        :columns="columns"
        :data="list"
        :loading="loading"
        :bordered="false"
        size="small"
        :row-key="(r: AuditLog) => r.id"
        :row-props="rowProps"
        :pagination="false"
        :scroll-x="1326"
        @update:sorter="onSort"
      />
      <div class="pagination-bar">
        <n-pagination
          v-model:page="page"
          :item-count="total"
          :page-size="pageSize"
          :page-slot="7"
          show-size-picker
          :page-sizes="[20, 50, 100]"
          @update:page="reload"
          @update:page-size="onPageSizeChange"
        >
          <template #prefix>共 {{ total }} 条</template>
        </n-pagination>
      </div>
    </div>

    <n-drawer v-model:show="drawerVisible" :width="600" placement="right">
      <n-drawer-content :title="`操作审计详情 #${activeLog?.id ?? ''}`" closable>
        <template v-if="activeLog">
          <n-descriptions bordered :column="2" size="small" label-placement="left" :label-style="{ width: '92px' }">
            <n-descriptions-item label="操作时间">{{ formatDate(activeLog.created_at) }}</n-descriptions-item>
            <n-descriptions-item label="操作人">
              {{ activeLog.user_name }}（{{ ROLE_LABELS[activeLog.user_role] || activeLog.user_role }}）
            </n-descriptions-item>
            <n-descriptions-item label="操作类型">
              <n-tag size="small" :type="getActionTagType(activeLog.action)">{{ getActionLabel(activeLog.action) }}</n-tag>
              <span class="muted mono">{{ activeLog.action }}</span>
            </n-descriptions-item>
            <n-descriptions-item label="目标">
              {{ getTargetLabel(activeLog.target_type) }} · {{ activeLog.target_name || '—' }} · {{ activeLog.target_id }}
            </n-descriptions-item>
            <n-descriptions-item label="IP 地址">{{ activeLog.ip_address || '—' }}</n-descriptions-item>
            <n-descriptions-item label="请求 ID">
              <template v-if="activeLog.request_id">
                <span class="mono">{{ activeLog.request_id }}</span>
                <n-button size="tiny" quaternary type="primary" @click="copyText(activeLog.request_id!)">复制</n-button>
              </template>
              <span v-else>—</span>
            </n-descriptions-item>
            <n-descriptions-item label="备注" :span="2">{{ activeLog.remark || '—' }}</n-descriptions-item>
          </n-descriptions>

          <div class="drawer-section">
            <div class="drawer-section-title">变更明细</div>
            <table v-if="activeDiff.isStructured && activeDiff.items.length" class="diff-table">
              <thead>
                <tr><th style="width: 34%">字段</th><th>变更前</th><th>变更后</th></tr>
              </thead>
              <tbody>
                <tr v-for="item in activeDiff.items" :key="item.key" :class="{ changed: item.changed }">
                  <td>{{ item.label }}</td>
                  <td class="before">{{ item.before }}</td>
                  <td class="after">{{ item.after }}</td>
                </tr>
              </tbody>
            </table>
            <template v-else-if="activeDiff.beforePretty || activeDiff.afterPretty">
              <div v-if="activeDiff.beforePretty" class="raw-title">变更前</div>
              <pre v-if="activeDiff.beforePretty" class="raw-pre">{{ activeDiff.beforePretty }}</pre>
              <div v-if="activeDiff.afterPretty" class="raw-title">变更后</div>
              <pre v-if="activeDiff.afterPretty" class="raw-pre">{{ activeDiff.afterPretty }}</pre>
            </template>
            <div v-else class="muted">无变更内容记录</div>

            <n-collapse style="margin-top: 12px">
              <n-collapse-item title="查看原始 JSON" name="raw">
                <div class="raw-title">变更前</div>
                <n-button size="tiny" quaternary type="primary" @click="copyText(activeDiff.beforePretty)">复制</n-button>
                <pre class="raw-pre">{{ activeDiff.beforePretty || '—' }}</pre>
                <div class="raw-title">变更后</div>
                <n-button size="tiny" quaternary type="primary" @click="copyText(activeDiff.afterPretty)">复制</n-button>
                <pre class="raw-pre">{{ activeDiff.afterPretty || '—' }}</pre>
              </n-collapse-item>
            </n-collapse>
          </div>

          <div v-if="relatedLogs.length > 1" class="drawer-section">
            <div class="drawer-section-title">同请求关联记录</div>
            <div class="related-list">
              <div
                v-for="log in relatedLogs"
                :key="log.id"
                class="related-item"
                :class="{ active: log.id === activeLog.id }"
                @click="selectRelated(log)"
              >
                <span class="related-time">{{ formatDate(log.created_at) }}</span>
                <n-tag size="small" :type="getActionTagType(log.action)">{{ getActionLabel(log.action) }}</n-tag>
                <span class="related-target">{{ getTargetLabel(log.target_type) }} · {{ log.target_name || log.target_id }}</span>
                <n-tag v-if="log.id === activeLog.id" size="tiny" type="info">当前</n-tag>
              </div>
            </div>
          </div>
        </template>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>
<script setup lang="ts">
import { h, ref, onMounted, computed } from 'vue'
import { NTag, NButton, type DataTableColumns, type DataTableSortState } from 'naive-ui'
import dayjs from 'dayjs'
import { accountApi, auditLogApi } from '@/api'
import { formatDate } from '@/utils/format'
import type { AuditLog } from '@/types'
import {
  ROLE_LABELS,
  ROLE_OPTIONS,
  TARGET_OPTIONS,
  ACTION_OPTIONS,
  getTargetLabel,
  getActionLabel,
  getActionTagType,
  buildAuditDiff,
  buildChangeSummary,
} from '@/utils/auditFormat'

const message = useMessage()

const pageSize = ref(20)
const page = ref(1)
const total = ref(0)
const list = ref<AuditLog[]>([])
const loading = ref(false)
const sortOrder = ref<'asc' | 'desc'>('desc')

const keyword = ref('')
const dateRange = ref<[number, number] | null>(null)
const filterType = ref<string | null>(null)
const filterAction = ref<string | null>(null)
const filterRole = ref<string | null>(null)
const filterUser = ref<number | null>(null)
const userOpts = ref<{ label: string; value: number }[]>([{ label: '系统任务', value: 0 }])
let userRoleMap = new Map<number, string>()

const drawerVisible = ref(false)
const activeLog = ref<AuditLog | null>(null)
const relatedLogs = ref<AuditLog[]>([])
let relatedSeq = 0

const activeDiff = computed(() => buildAuditDiff(activeLog.value?.before_value, activeLog.value?.after_value))

const columns = computed<DataTableColumns<AuditLog>>(() => [
  { title: 'ID', key: 'id', width: 64 },
  {
    title: '操作人', key: 'user_name', width: 130,
    render: (r) => h('div', [
      h('div', lineProps(r.user_name), r.user_name),
      h('div', lineProps(ROLE_LABELS[r.user_role] || r.user_role, true), ROLE_LABELS[r.user_role] || r.user_role),
    ]),
  },
  {
    title: '操作', key: 'action', width: 110,
    render: (r) => h(NTag, { size: 'small', type: getActionTagType(r.action) }, {
      default: () => h('span', { title: r.action }, getActionLabel(r.action)),
    }),
  },
  {
    title: '目标', key: 'target_name', width: 200,
    render: (r) => h('div', [
      h('div', lineProps(r.target_name || r.target_id), r.target_name || r.target_id),
      h('div', lineProps(`${getTargetLabel(r.target_type)} · ${r.target_id}`, true), `${getTargetLabel(r.target_type)} · ${r.target_id}`),
    ]),
  },
  {
    title: '变更内容', key: 'changes', width: 440,
    render: (r) => {
      const s = buildChangeSummary(r.before_value, r.after_value)
      if (s.kind === 'empty') return h('span', { style: { color: 'var(--text-3)' } }, '—')
      const style: Record<string, string> = {
        lineHeight: '1.5',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }
      let text = s.text
      if (s.kind === 'create') {
        style.color = '#16a34a'
        text = `+ ${s.text}`
      } else if (s.kind === 'delete') {
        style.color = '#dc2626'
        text = `- ${s.text}`
      }
      return h('div', { style, title: s.fullText }, text)
    },
  },
  { title: '备注', key: 'remark', width: 160, ellipsis: { tooltip: true } },
  {
    title: '时间', key: 'created_at', width: 150, sortable: true,
    sortOrder: sortOrder.value === 'asc' ? 'ascend' : 'descend',
    render: (r) => formatDate(r.created_at),
  },
  {
    title: '操作', key: 'detail', width: 72, fixed: 'right',
    render: (r) => h(NButton, {
      size: 'tiny',
      quaternary: true,
      type: 'primary',
      onClick: (e: MouseEvent) => {
        e.stopPropagation()
        void openDetail(r)
      },
    }, { default: () => '详情' }),
  },
])

/** 单元格单行省略：样式放 style 里，悬停 title 看全文 */
function lineProps(title: string, muted = false): Record<string, unknown> {
  return {
    style: {
      lineHeight: '1.5',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      ...(muted ? { fontSize: '12px', color: 'var(--text-3)' } : null),
    },
    title,
  }
}

function rowProps(row: AuditLog) {
  return {
    style: 'cursor: pointer',
    onClick: () => void openDetail(row),
  }
}

function onSort(sorter: DataTableSortState | DataTableSortState[] | null) {
  const s = Array.isArray(sorter) ? sorter[0] : sorter
  if (!s) return
  sortOrder.value = s.order === 'ascend' ? 'asc' : 'desc'
  resetPage()
}

function onRoleChange(value: string | null) {
  if (value === 'customer') filterUser.value = null
  resetPage()
}

function onPageSizeChange(size: number) {
  pageSize.value = size
  page.value = 1
  void reload()
}

function resetPage() {
  page.value = 1
  void reload()
}

function resetAll() {
  keyword.value = ''
  dateRange.value = null
  filterType.value = null
  filterAction.value = null
  filterRole.value = null
  filterUser.value = null
  sortOrder.value = 'desc'
  resetPage()
}

let reqSeq = 0

async function reload() {
  const seq = ++reqSeq
  loading.value = true
  // 选了操作人却未手选角色时，自动带出角色，避免与客户 ID 冲突
  let autoRole: string | undefined
  if (filterUser.value !== null && !filterRole.value) {
    autoRole = filterUser.value === 0 ? 'system' : userRoleMap.get(filterUser.value)
  }
  try {
    const res = await auditLogApi.list({
      keyword: keyword.value.trim() || undefined,
      target_type: filterType.value || undefined,
      action: filterAction.value || undefined,
      user_id: filterUser.value ?? undefined,
      user_role: filterRole.value || autoRole,
      date_from: dateRange.value ? dayjs(dateRange.value[0]).format('YYYY-MM-DD') : undefined,
      date_to: dateRange.value ? dayjs(dateRange.value[1]).format('YYYY-MM-DD') : undefined,
      sort: sortOrder.value,
      page: page.value,
      page_size: pageSize.value,
    })
    if (seq !== reqSeq) return
    list.value = res.items
    total.value = res.total
  } finally {
    if (seq === reqSeq) loading.value = false
  }
}

async function loadUsers() {
  const accounts = await accountApi.list()
  const map = new Map<number, string>()
  const opts: { label: string; value: number }[] = [{ label: '系统任务', value: 0 }]
  for (const a of accounts) {
    map.set(a.id, a.role_code)
    opts.push({ label: a.real_name || a.username, value: a.id })
  }
  userRoleMap = map
  userOpts.value = opts
}

async function openDetail(row: AuditLog) {
  activeLog.value = row
  drawerVisible.value = true
  await loadRelated(row)
}

async function loadRelated(row: AuditLog) {
  const seq = ++relatedSeq
  relatedLogs.value = []
  if (!row.request_id) return
  try {
    const res = await auditLogApi.list({ request_id: row.request_id, page: 1, page_size: 50, sort: 'asc' })
    if (seq !== relatedSeq) return
    relatedLogs.value = res.items
  } catch {
    if (seq === relatedSeq) relatedLogs.value = []
  }
}

function selectRelated(log: AuditLog) {
  activeLog.value = log
}

async function copyText(text: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    message.success('已复制')
  } catch {
    message.error('复制失败，请手动选择复制')
  }
}

onMounted(() => {
  void loadUsers()
  void reload()
})
</script>
<style scoped>
.muted { color: var(--text-3); }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.drawer-section { margin-top: 20px; }
.drawer-section-title { font-weight: 600; font-size: 14px; margin-bottom: 8px; }
.raw-title { font-size: 12px; color: var(--text-3); margin: 8px 0 4px; }
.raw-pre {
  margin: 0;
  padding: 10px 12px;
  max-height: 260px;
  overflow: auto;
  background: #fafafa;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
.diff-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.diff-table th,
.diff-table td { border: 1px solid var(--border); padding: 6px 8px; text-align: left; vertical-align: top; }
.diff-table th { background: #fafafa; font-weight: 600; }
.diff-table tr.changed { background: #fef9c3; }
.diff-table td.before { color: #dc2626; }
.diff-table td.after { color: #16a34a; font-weight: 600; }
.related-list { display: flex; flex-direction: column; gap: 6px; }
.related-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.related-item.active { border-color: var(--primary, #dc2626); background: #fef2f2; }
.related-time { color: var(--text-3); white-space: nowrap; }
.related-target {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
