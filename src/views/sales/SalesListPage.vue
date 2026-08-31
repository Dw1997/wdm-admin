<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">销售列表</h2><n-button type="primary" @click="openCreate">新增销售</n-button></div>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" />
    </div>
    <n-modal v-model:show="editVisible" title="新增销售" preset="card" style="width: 500px">
      <n-form :model="form" label-placement="left" label-width="80">
        <n-form-item label="姓名"><n-input v-model:value="form.name" /></n-form-item>
        <n-form-item label="手机"><n-input v-model:value="form.phone" maxlength="11" /></n-form-item>
        <n-form-item label="负责区域"><n-input v-model:value="form.region" /></n-form-item>
        <n-form-item label="备注"><n-input v-model:value="form.remark" type="textarea" :rows="2" /></n-form-item>
      </n-form>
      <template #footer><n-button @click="editVisible=false">取消</n-button><n-button type="primary" :loading="saving" @click="onSave">保存</n-button></template>
    </n-modal>
    <n-modal v-model:show="shareVisible" title="推广链接" preset="card" style="width: 520px">
      <n-input-group><n-input :value="shareLink" readonly /><n-button @click="copyText(shareLink)">复制</n-button></n-input-group>
    </n-modal>
  </div>
</template>
<script setup lang="ts">
import { h, ref, reactive, onMounted, computed } from 'vue'
import { NButton, NTag, useMessage, type DataTableColumns } from 'naive-ui'
import { salesApi } from '@/api'
import { formatQty, formatDate } from '@/utils/format'
import type { Sales, PageQuery } from '@/types'

const list = ref<Sales[]>([]); const loading = ref(false); const query = reactive<PageQuery>({ page: 1, page_size: 20 })
const editVisible = ref(false); const saving = ref(false); const shareVisible = ref(false); const message = useMessage()
const form = reactive({ name: '', phone: '', region: '', remark: '' })
const shareLink = ref('')

const columns = computed<DataTableColumns<Sales>>(() => [
  { title: 'ID', key: 'id', width: 50 },
  { title: '姓名', key: 'name', width: 100 },
  { title: '手机', key: 'phone', width: 120 },
  { title: '邀请码', key: 'invite_code', width: 120, render: (r) => h(NTag, { size: 'small', bordered: false }, { default: () => r.invite_code }) },
  { title: '区域', key: 'region', width: 80, render: (r) => r.region || '—' },
  { title: '客户数', key: 'total_customers', width: 100, render: (r) => `${r.total_customers} 总 / ${r.active_customers} 活跃` },
  { title: '累计GMV', key: 'total_gmv', width: 120, render: (r) => `¥${formatQty(r.total_gmv)}` },
  { title: '预估提成', key: 'estimated_commission', width: 120, render: (r) => h('span', { style: 'color:#ea580c' }, `¥${formatQty(r.estimated_commission)}`) },
  { title: '状态', key: 'status', width: 70, render: (r) => h(NTag, { size: 'small', type: r.status === 'active' ? 'success' : 'default' }, { default: () => r.status === 'active' ? '正常' : '禁用' }) },
  { title: '操作', key: 'actions', width: 150, render: (r) => h('div', [h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openShare(r) }, { default: () => '推广链接' }), h(NButton, { size: 'small', text: true, type: r.status === 'active' ? 'error' : 'primary', style: 'margin-left:8px', onClick: () => toggleStatus(r) }, { default: () => r.status === 'active' ? '禁用' : '启用' })]) },
])

async function reload() { loading.value = true; try { const res = await salesApi.list(query); list.value = res.items } finally { loading.value = false } }
function openCreate() { Object.assign(form, { name: '', phone: '', region: '', remark: '' }); editVisible.value = true }
async function onSave() { saving.value = true; try { await salesApi.create({ ...form, invite_code: `SALE${String(Date.now()).slice(-6)}`, status: 'active' } as any); message.success('已创建'); editVisible.value = false; reload() } finally { saving.value = false } }
function openShare(r: Sales) { shareLink.value = `https://m.example.com/register?invite=${r.invite_code}`; shareVisible.value = true }
async function toggleStatus(r: Sales) { await salesApi.update(r.id, { status: r.status === 'active' ? 'disabled' : 'active' }); message.success('已更新'); reload() }
async function copyText(t: string) { try { await navigator.clipboard.writeText(t); message.success('已复制') } catch { message.warning('复制失败') } }
onMounted(reload)
</script>
