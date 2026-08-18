<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">客户列表</h2>
        <n-button type="primary" @click="openCreate">新增客户</n-button>
      </div>
      <div class="filter-bar">
        <n-input v-model:value="query.keyword" placeholder="姓名 / 手机 / 店铺" clearable style="width: 240px" @keyup.enter="reload" />
        <n-select v-model:value="query.status" placeholder="状态" clearable style="width: 120px" :options="[{label:'待审核',value:'pending'},{label:'正常',value:'active'},{label:'已禁用',value:'disabled'}]" @update:value="reload" />
        <n-select v-model:value="query.level" placeholder="等级" clearable style="width: 120px" :options="[{label:'青铜',value:'bronze'},{label:'白银',value:'silver'},{label:'黄金',value:'gold'},{label:'VIP',value:'vip'}]" @update:value="reload" />
        <n-select v-model:value="query.sales_id" placeholder="归属销售" clearable filterable style="width: 160px" :options="salesOpts" @update:value="reload" />
        <n-button type="primary" size="small" @click="reload">查询</n-button>
      </div>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" :row-key="(r:any)=>r.id" />
      <div class="pagination-bar"><n-pagination v-model:page="query.page" :page-size="query.page_size" :item-count="total" @update:page="reload" /></div>
    </div>
    <n-modal v-model:show="editVisible" :title="form.id ? '编辑客户' : '新增客户'" preset="card" style="width: 600px">
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="left" label-width="100">
        <n-form-item label="客户姓名" path="name"><n-input v-model:value="form.name" /></n-form-item>
        <n-form-item label="店铺名"><n-input v-model:value="form.shop_name" /></n-form-item>
        <n-form-item label="手机号" path="phone"><n-input v-model:value="form.phone" maxlength="11" /></n-form-item>
        <n-form-item label="地址"><n-input v-model:value="form.address" /></n-form-item>
        <n-form-item label="等级" path="level"><n-select v-model:value="form.level" :options="[{label:'青铜',value:'bronze'},{label:'白银',value:'silver'},{label:'黄金',value:'gold'},{label:'VIP',value:'vip'}]" /></n-form-item>
        <n-form-item label="归属销售"><n-select v-model:value="form.sales_id" filterable :options="salesOpts" /></n-form-item>
        <n-form-item label="账期额度"><n-input-number v-model:value="form.credit_limit" :min="0" :step="1000" /></n-form-item>
        <n-form-item label="备注"><n-input v-model:value="form.remark" type="textarea" :rows="2" /></n-form-item>
      </n-form>
      <template #footer><n-button @click="editVisible=false">取消</n-button><n-button type="primary" :loading="saving" @click="onSave">保存</n-button></template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, reactive, onMounted, computed } from 'vue'
import { NButton, NTag, NSpace, NPopconfirm, useMessage, type DataTableColumns, type FormInst, type FormRules } from 'naive-ui'
import { customerApi, salesApi } from '@/api'
import { CUSTOMER_STATUS, CUSTOMER_LEVEL } from '@/utils/dict'
import { formatQty, formatDate, relativeTime } from '@/utils/format'
import type { Customer, Sales, PageQuery } from '@/types'

const list = ref<Customer[]>([])
const total = ref(0)
const loading = ref(false)
const query = reactive<PageQuery>({ page: 1, page_size: 20, keyword: '', status: '', level: '', sales_id: '' })
const sales = ref<Sales[]>([])
const salesOpts = computed(() => sales.value.map(s => ({ label: s.name, value: s.id })))
const message = useMessage()
const editVisible = ref(false)
const saving = ref(false)
const formRef = ref<FormInst>()
const form = reactive<any>({ id: 0, name: '', phone: '', address: '', shop_name: '', status: 'active', level: 'bronze', credit_limit: 0, used_credit: 0, registered_at: '' })
const rules: FormRules = {
  name: [{ required: true, message: '请输入客户姓名', trigger: 'blur' }],
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }, { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }],
  level: [{ required: true, message: '请选择等级', trigger: 'change' }],
}

const columns = computed<DataTableColumns<Customer>>(() => [
  { title: 'ID', key: 'id', width: 60 },
  { title: '客户', key: 'name', width: 120 },
  { title: '店铺', key: 'shop_name', ellipsis: { tooltip: true } },
  { title: '手机', key: 'phone', width: 130 },
  { title: '等级', key: 'level', width: 90, render: (r) => h(NTag, { size: 'small', type: r.level === 'vip' ? 'error' : r.level === 'gold' ? 'warning' : 'default' }, { default: () => CUSTOMER_LEVEL[r.level]?.label || r.level }) },
  { title: '状态', key: 'status', width: 80, render: (r) => h(NTag, { size: 'small', type: r.status === 'active' ? 'success' : r.status === 'pending' ? 'warning' : 'error' }, { default: () => CUSTOMER_STATUS[r.status]?.label }) },
  { title: '归属销售', key: 'sales_name', width: 100, render: (r) => r.sales_name || '—' },
  { title: '可用额度', key: 'available_credit', width: 100, render: (r) => `¥${formatQty(r.available_credit)}` },
  { title: '注册时间', key: 'registered_at', width: 150, render: (r) => formatDate(r.registered_at) },
  { title: '最近下单', key: 'last_order_at', width: 100, render: (r) => relativeTime(r.last_order_at) },
  { title: '操作', key: 'actions', width: 200, fixed: 'right', render: (r) => h(NSpace, null, {
    default: () => [
      h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openEdit(r) }, { default: () => '编辑' }),
      h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openBind(r) }, { default: () => '绑定' }),
      h(NPopconfirm, { onPositiveClick: () => onDelete(r) }, { default: () => '确认删除?', trigger: () => h(NButton, { size: 'small', text: true, type: 'error' }, { default: () => '删除' }) }),
    ],
  }) },
])

async function reload() {
  loading.value = true
  try { const res = await customerApi.list({ ...query }); list.value = res.items; total.value = res.total } finally { loading.value = false }
}
async function loadSales() { sales.value = await salesApi.all() }
function openCreate() { Object.assign(form, { id: 0, name: '', phone: '', address: '', shop_name: '', status: 'active', level: 'bronze', credit_limit: 0, used_credit: 0, registered_at: '', remark: '' }); editVisible.value = true }
function openEdit(r: Customer) { Object.assign(form, JSON.parse(JSON.stringify(r))); editVisible.value = true }
function openBind(r: Customer) { Object.assign(form, r); message.info('绑定功能开发中') }
async function onSave() {
  if (!formRef.value) return
  try { await formRef.value.validate() } catch { return }
  saving.value = true
  try {
    if (form.id) { await customerApi.update(form.id, form); message.success('已更新') }
    else { await customerApi.create(form); message.success('已创建') }
    editVisible.value = false; reload()
  } finally { saving.value = false }
}
async function onDelete(r: Customer) { await customerApi.remove(r.id); message.success('已删除'); reload() }
onMounted(() => { loadSales(); reload() })
</script>
