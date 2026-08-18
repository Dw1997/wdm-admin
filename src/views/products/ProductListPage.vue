<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">商品管理</h2><n-button type="primary" @click="openCreate">新建商品</n-button></div>
      <div class="filter-bar">
        <n-input v-model:value="query.keyword" placeholder="搜索 SKU / 名称" clearable style="width: 240px" @keyup.enter="reload" />
        <n-select v-model:value="query.status" placeholder="状态" clearable style="width: 120px" :options="[{label:'在售',value:'on_sale'},{label:'下架',value:'off_shelf'},{label:'草稿',value:'draft'}]" @update:value="reload" />
        <n-button type="primary" size="small" @click="reload">查询</n-button>
      </div>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" />
      <div class="pagination-bar"><n-pagination v-model:page="query.page" :page-size="query.page_size" :item-count="total" @update:page="reload" /></div>
    </div>
    <n-modal v-model:show="editVisible" :title="form.id ? '编辑商品' : '新建商品'" preset="card" style="width: 800px">
      <n-form :model="form" label-placement="left" label-width="100">
        <n-grid :cols="2" :x-gap="16"><n-gi><n-form-item label="SKU"><n-input v-model:value="form.sku" /></n-form-item></n-gi><n-gi><n-form-item label="分类"><n-input v-model:value="form.category" /></n-form-item></n-gi></n-grid>
        <n-form-item label="商品名称"><n-input v-model:value="form.name" /></n-form-item>
        <n-grid :cols="2" :x-gap="16"><n-gi><n-form-item label="品牌"><n-input v-model:value="form.brand" /></n-form-item></n-gi><n-gi><n-form-item label="规格"><n-input v-model:value="form.spec" /></n-form-item></n-gi></n-grid>
        <n-form-item label="基础单位"><n-input v-model:value="form.base_unit" /></n-form-item>
        <n-form-item label="多单位换算"><n-dynamic-tags v-model:value="form.unitTags" /></n-form-item>
        <n-grid :cols="3" :x-gap="16"><n-gi><n-form-item label="安全库存"><n-input-number v-model:value="form.safety_stock" :min="0" /></n-form-item></n-gi><n-gi><n-form-item label="临期预警"><n-input-number v-model:value="form.expiry_warning_days" :min="1" /></n-form-item></n-gi><n-gi><n-form-item label="状态"><n-select v-model:value="form.status" :options="[{label:'在售',value:'on_sale'},{label:'下架',value:'off_shelf'},{label:'草稿',value:'draft'}]" /></n-form-item></n-gi></n-grid>
        <n-form-item label="描述"><n-input v-model:value="form.description" type="textarea" :rows="2" /></n-form-item>
      </n-form>
      <template #footer><n-button @click="editVisible=false">取消</n-button><n-button type="primary" :loading="saving" @click="onSave">保存</n-button></template>
    </n-modal>
    <n-modal v-model:show="stockVisible" title="商品入库" preset="card" style="width: 600px">
      <n-form label-placement="left" label-width="100">
        <n-form-item label="商品"><n-input :value="stockForm.product_name" disabled /></n-form-item>
        <n-form-item label="生产日期"><n-date-picker v-model:value="stockForm.production_date" type="date" /></n-form-item>
        <n-form-item label="到期日期"><n-date-picker v-model:value="stockForm.expiry_date" type="date" /></n-form-item>
        <n-form-item label="入库数量"><n-input-number v-model:value="stockForm.quantity" :min="1" /></n-form-item>
        <n-form-item label="成本价"><n-input-number v-model:value="stockForm.cost_price" :min="0" :step="0.1" /></n-form-item>
        <n-form-item label="批次号"><n-input v-model:value="stockForm.batch_no" /></n-form-item>
      </n-form>
      <template #footer><n-button @click="stockVisible=false">取消</n-button><n-button type="primary" @click="onStockSave">入库</n-button></template>
    </n-modal>
  </div>
</template>
<script setup lang="ts">
import { h, ref, reactive, onMounted, computed } from 'vue'
import { NButton, NTag, NSpace, NPopconfirm, useMessage, type DataTableColumns } from 'naive-ui'
import { productApi } from '@/api'
import { PRODUCT_STATUS } from '@/utils/dict'
import { formatQty, formatDate } from '@/utils/format'
import type { Product, PageQuery } from '@/types'

const list = ref<Product[]>([]); const total = ref(0); const loading = ref(false)
const query = reactive<PageQuery>({ page: 1, page_size: 20, keyword: '', status: '', category: '' })
const message = useMessage(); const editVisible = ref(false); const saving = ref(false); const stockVisible = ref(false)
const form = reactive<any>({ id: 0, sku: '', name: '', category: '', brand: '', spec: '', base_unit: '包', units: [], unitTags: [], status: 'on_sale', stock: 0, safety_stock: 0, expiry_warning_days: 30, batches: [], description: '' })
const stockForm = reactive<any>({ product_id: 0, product_name: '', base_unit: '包', batch_no: '', production_date: null, expiry_date: null, quantity: 1, cost_price: 0 })

const columns = computed<DataTableColumns<Product>>(() => [
  { title: 'SKU', key: 'sku', width: 120 },
  { title: '商品名称', key: 'name', ellipsis: { tooltip: true } },
  { title: '分类', key: 'category', width: 100 },
  { title: '多单位', key: 'units', width: 200, render: (r) => r.units.map((u, i) => h(NTag, { size: 'small', bordered: false, type: i === 0 ? 'primary' : 'default', style: 'margin-right:4px' }, { default: () => `1${r.base_unit}=${u.ratio}${u.name}` })) },
  { title: '库存', key: 'stock', width: 100, render: (r) => h('span', { style: r.stock < r.safety_stock ? 'color:#dc2626' : '' }, `${formatQty(r.stock)} ${r.base_unit}`) },
  { title: '批次', key: 'batches', width: 80, render: (r) => h(NTag, { size: 'small', type: r.batches.some((b:any) => { const d = (new Date(b.expiry_date.replace(/-/g,'/')).getTime()-Date.now())/86400000; return d >= 0 && d <= r.expiry_warning_days }) ? 'error' : 'default' }, { default: () => `${r.batches.length} 个` }) },
  { title: '状态', key: 'status', width: 70, render: (r) => h(NTag, { size: 'small', type: r.status === 'on_sale' ? 'success' : r.status === 'draft' ? 'warning' : 'default' }, { default: () => PRODUCT_STATUS[r.status as keyof typeof PRODUCT_STATUS]?.label }) },
  { title: '操作', key: 'actions', width: 180, fixed: 'right', render: (r) => h(NSpace, null, { default: () => [h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openEdit(r) }, { default: () => '编辑' }), h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openStock(r) }, { default: () => '入库' }), h(NPopconfirm, { onPositiveClick: () => onDelete(r) }, { default: () => '确认删除?', trigger: () => h(NButton, { size: 'small', text: true, type: 'error' }, { default: () => '删除' }) })] }) },
])

async function reload() { loading.value = true; try { const res = await productApi.list({ ...query }); list.value = res.items; total.value = res.total } finally { loading.value = false } }
function openCreate() { Object.assign(form, { id: 0, sku: '', name: '', category: '', brand: '', spec: '', base_unit: '包', units: [], unitTags: [], status: 'on_sale', stock: 0, safety_stock: 0, expiry_warning_days: 30, batches: [], description: '' }); editVisible.value = true }
function openEdit(r: Product) { Object.assign(form, JSON.parse(JSON.stringify(r)), { unitTags: r.units.map((u: any) => `1${r.base_unit}=${u.ratio}${u.name}`) }); editVisible.value = true }
async function onSave() {
  saving.value = true; try {
    form.units = (form.unitTags || []).map((t: string) => { const m = t.match(/1(\S+)=(\d+)(\S+)/); return m ? { name: m[3], ratio: Number(m[2]), base_unit: m[1] } : { name: t, ratio: 1, base_unit: form.base_unit } })
    if (form.id) { await productApi.update(form.id, form); message.success('已更新') } else { await productApi.create(form); message.success('已创建') }
    editVisible.value = false; reload()
  } finally { saving.value = false }
}
async function onDelete(r: Product) { await productApi.remove(r.id); message.success('已删除'); reload() }
function openStock(r: Product) { Object.assign(stockForm, { product_id: r.id, product_name: r.name, base_unit: r.base_unit, batch_no: `B${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*100).toString().padStart(2,'0')}`, production_date: null, expiry_date: null, quantity: 1, cost_price: 0 }); stockVisible.value = true }
async function onStockSave() {
  if (!stockForm.production_date || !stockForm.expiry_date) { message.warning('请填写日期'); return }
  const p = await productApi.get(stockForm.product_id); if (!p) return
  await productApi.update(p.id, { stock: p.stock + stockForm.quantity, batches: [...p.batches, { batch_no: stockForm.batch_no, production_date: stockForm.production_date, expiry_date: stockForm.expiry_date, quantity: stockForm.quantity, cost_price: stockForm.cost_price }] })
  message.success('入库成功'); stockVisible.value = false; reload()
}
onMounted(reload)
</script>
