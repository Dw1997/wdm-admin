<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">商品管理 (SPU/SKU)</h2><n-button type="primary" @click="openCreate">新建商品</n-button></div>
      <div class="filter-bar"><n-input v-model:value="keyword" placeholder="搜索商品名称 / SPU编码" clearable style="width: 240px" @keyup.enter="reload" /><n-button type="primary" size="small" @click="reload">查询</n-button></div>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" :row-key="(r:any)=>r.id" :expand="expand" />
    </div>
    <n-modal v-model:show="editVisible" :title="form.id ? '编辑商品' : '新建商品'" preset="card" style="width: 820px">
      <n-form :model="form" label-placement="left" label-width="100">
        <n-grid :cols="2" :x-gap="16"><n-gi><n-form-item label="SPU编码"><n-input v-model:value="form.spu_code" /></n-form-item></n-gi><n-gi><n-form-item label="商品名称"><n-input v-model:value="form.name" /></n-form-item></n-gi></n-grid>
        <n-grid :cols="3" :x-gap="16"><n-gi><n-form-item label="分类"><n-cascader v-model:value="form.category_path" :options="categoryOptions" :props="{ checkStrictly: true, value: 'id', label: 'name', children: 'children' }" placeholder="选择分类" style="width:100%" @update:value="(v:any) => { form.category_id = v?.[v.length-1] || null }" /></n-form-item></n-gi><n-gi><n-form-item label="品牌"><n-input v-model:value="form.brand" /></n-form-item></n-gi><n-gi><n-form-item label="规格"><n-input v-model:value="form.spec" /></n-form-item></n-gi></n-grid>
        <n-form-item label="描述"><n-input v-model:value="form.description" type="textarea" :rows="2" /></n-form-item>
      </n-form>
      <template #footer><n-button @click="editVisible=false">取消</n-button><n-button type="primary" :loading="saving" @click="onSave">保存</n-button></template>
    </n-modal>
    <n-modal v-model:show="skuEditVisible" title="修改SKU价格" preset="card" style="width: 500px">
      <n-form label-placement="left" label-width="100">
        <n-form-item label="SKU编码"><span>{{ skuForm.sku_code }}</span></n-form-item>
        <n-form-item label="单位"><span>{{ skuForm.unit }}</span></n-form-item>
        <n-form-item label="成本价"><n-input-number v-model:value="skuForm.cost_price" :min="0" :step="0.1" /></n-form-item>
        <n-form-item label="默认售价"><n-input-number v-model:value="skuForm.default_price" :min="0" :step="0.1" /></n-form-item>
        <n-form-item label="最低价"><n-input-number v-model:value="skuForm.min_price" :min="0" :step="0.1" /><span style="margin-left:8px;font-size:12px;color:#909399">销售不可低于此价</span></n-form-item>
        <n-form-item label="库存"><n-input-number v-model:value="skuForm.stock" :min="0" /></n-form-item>
      </n-form>
      <template #footer><n-button @click="skuEditVisible=false">取消</n-button><n-button type="primary" :loading="saving" @click="onSKUSave">保存</n-button></template>
    </n-modal>
  </div>
</template>
<script setup lang="ts">
import { h, ref, reactive, onMounted, computed } from 'vue'
import { NButton, NTag, NSpace, NPopconfirm, useMessage, type DataTableColumns } from 'naive-ui'
import { spuApi, categoryApi, levelApi } from '@/api'
import type { ProductSPU, Category, LevelConfig, ProductSKU } from '@/types'

const list = ref<ProductSPU[]>([]); const loading = ref(false); const keyword = ref('')
const categoryOptions = ref<Category[]>([]); const levels = ref<LevelConfig[]>([])
const editVisible = ref(false); const saving = ref(false); const skuEditVisible = ref(false); const message = useMessage()
const form = reactive<any>({ id: 0, spu_code: '', name: '', category_id: null, category_path: [], brand: '', spec: '', description: '', status: 'on_sale', is_hot: false, skus: [] })
const skuForm = reactive<any>({ id: 0, sku_code: '', unit: '', cost_price: 0, default_price: 0, min_price: 0, stock: 0 })
const expand = ref({ expandedKeys: [] as number[], })

function renderSKU(sku: any) {
  return h('div', { style: 'background:#f9fafb;border-radius:8px;padding:12px;margin-bottom:8px' }, [
    h('div', { style: 'display:flex;justify-content:space-between;margin-bottom:4px' }, [
      h('span', { style: 'font-weight:600' }, `${sku.unit} (1=${sku.conversion_ratio})`),
      h('span', { style: 'color:#dc2626;font-weight:600' }, `¥${sku.default_price.toFixed(2)}`),
    ]),
    h('div', { style: 'font-size:12px;color:#909399;margin-bottom:4px' }, `成本 ¥${sku.cost_price.toFixed(2)} · 最低 ¥${sku.min_price.toFixed(2)} · 库存 ${sku.stock}`),
    h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
      sku.level_prices.length
        ? h(NSpace, { size: 4 }, { default: () => sku.level_prices.map((lp: any) => h(NTag, { size: 'small', bordered: false }, { default: () => `${lp.level_name}: ¥${lp.price.toFixed(2)}` })) })
        : h('span', { style: 'font-size:12px;color:#909399' }, '按默认价×等级百分比'),
      h(NButton, { size: 'tiny', text: true, type: 'primary', onClick: () => openSKUEdit(sku) }, { default: () => '改价' }),
    ]),
  ])
}

const columns = computed<DataTableColumns<ProductSPU>>(() => [
  { type: 'expand', expandable: () => true, renderExpand: (r) => h('div', { style: 'padding:8px 32px' }, r.skus.map(renderSKU)) },
  { title: 'SPU编码', key: 'spu_code', width: 120 },
  { title: '商品名称', key: 'name', ellipsis: { tooltip: true } },
  { title: '分类', key: 'category_name', width: 100 },
  { title: '品牌', key: 'brand', width: 80 },
  { title: 'SKU数', key: 'skus', width: 70, render: (r) => h(NTag, { size: 'small' }, { default: () => `${r.skus.length} 个` }) },
  { title: '热销', key: 'is_hot', width: 50, render: (r) => r.is_hot ? h(NTag, { size: 'small', type: 'error' }, { default: () => '热' }) : '' },
  { title: '状态', key: 'status', width: 70, render: (r) => h(NTag, { size: 'small', type: r.status === 'on_sale' ? 'success' : 'default' }, { default: () => r.status === 'on_sale' ? '在售' : '下架' }) },
  { title: '操作', key: 'actions', width: 120, render: (r) => h('div', [h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openEdit(r) }, { default: () => '编辑' }), h(NPopconfirm, { onPositiveClick: () => onDelete(r) }, { default: () => '确认删除?', trigger: () => h(NButton, { size: 'small', text: true, type: 'error', style: 'margin-left:8px' }, { default: () => '删除' }) })]) },
])

async function reload() { loading.value = true; try { list.value = await spuApi.list({ keyword: keyword.value }) } finally { loading.value = false } }
function openCreate() { Object.assign(form, { id: 0, spu_code: '', name: '', category_id: null, category_path: [], brand: '', spec: '', description: '', status: 'on_sale', is_hot: false, skus: [] }); editVisible.value = true }
function openEdit(r: ProductSPU) { Object.assign(form, JSON.parse(JSON.stringify(r)), { category_path: r.category_id ? [r.category_id] : [] }); editVisible.value = true }
async function onSave() { saving.value = true; try { if (form.id) { await spuApi.update(form.id, form); message.success('已更新') } else { await spuApi.create(form); message.success('已创建') } editVisible.value = false; reload() } finally { saving.value = false } }
async function onDelete(r: ProductSPU) { await spuApi.remove(r.id); message.success('已删除'); reload() }
function openSKUEdit(sku: ProductSKU) { Object.assign(skuForm, JSON.parse(JSON.stringify(sku))); skuEditVisible.value = true }
async function onSKUSave() { saving.value = true; try { await spuApi.updateSKU(skuForm.id, { cost_price: skuForm.cost_price, default_price: skuForm.default_price, min_price: skuForm.min_price, stock: skuForm.stock }); message.success('已更新'); skuEditVisible.value = false; reload() } finally { saving.value = false } }
onMounted(async () => { categoryOptions.value = await categoryApi.tree(); levels.value = await levelApi.list(); reload() })
</script>
