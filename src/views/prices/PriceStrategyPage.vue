<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">价格策略</h2><n-button type="primary" @click="openCreate">新建策略</n-button></div>
      <n-alert type="warning" :bordered="false" style="margin-bottom: 16px">价格隔离原则：所有价格在后端按 (客户, 商品, 单位) 解析后下发，前端不做价格过滤。</n-alert>
      <div class="filter-bar">
        <n-select v-model:value="query.type" placeholder="策略类型" clearable style="width: 140px" :options="[{label:'等级价',value:'tier'},{label:'客户专属价',value:'customer'},{label:'阶梯价',value:'ladder'},{label:'限时特价',value:'flash'}]" @update:value="reload" />
        <n-select v-model:value="query.product_id" placeholder="商品" clearable filterable style="width: 280px" :options="productOpts" @update:value="reload" />
        <n-button type="primary" size="small" @click="reload">查询</n-button>
      </div>
      <n-data-table :columns="columns" :data="list" :loading="loading" :bordered="false" size="small" />
    </div>
    <n-modal v-model:show="editVisible" :title="form.id ? '编辑策略' : '新建策略'" preset="card" style="width: 720px">
      <n-form :model="form" label-placement="left" label-width="100">
        <n-form-item label="策略类型"><n-radio-group v-model:value="form.type"><n-radio-button value="tier">等级价</n-radio-button><n-radio-button value="customer">客户专属</n-radio-button><n-radio-button value="ladder">阶梯价</n-radio-button><n-radio-button value="flash">限时特价</n-radio-button></n-radio-group></n-form-item>
        <n-form-item label="策略名称"><n-input v-model:value="form.name" /></n-form-item>
        <n-form-item label="适用商品"><n-select v-model:value="form.product_id" filterable :options="productOpts" /></n-form-item>
        <n-form-item v-if="form.type === 'flash'" label="有效期"><n-date-picker v-model:value="flashRange" type="datetimerange" /></n-form-item>
        <n-form-item label="价格规则"><n-button size="small" dashed @click="addRule">+ 添加规则</n-button></n-form-item>
      </n-form>
      <template #footer><n-button @click="editVisible=false">取消</n-button><n-button type="primary" :loading="saving" @click="onSave">保存</n-button></template>
    </n-modal>
  </div>
</template>
<script setup lang="ts">
import { h, ref, reactive, onMounted, computed, watch } from 'vue'
import { NButton, NTag, NSwitch, NPopconfirm, useMessage, type DataTableColumns } from 'naive-ui'
import { priceApi, productApi } from '@/api'
import { PRICE_STRATEGY_TYPE } from '@/utils/dict'
import type { PriceStrategy, Product, PageQuery } from '@/types'

const list = ref<PriceStrategy[]>([]); const loading = ref(false); const query = reactive<PageQuery>({ type: '', product_id: '', enabled: '' })
const products = ref<Product[]>([]); const productOpts = computed(() => products.value.map(p => ({ label: `${p.sku} · ${p.name}`, value: p.id })))
const editVisible = ref(false); const saving = ref(false); const message = useMessage()
const form = reactive<any>({ id: 0, product_id: 0, type: 'tier', name: '', rules: [], enabled: true, priority: 10, remark: '', starts_at: '', ends_at: '' })
const flashRange = ref<[number, number] | null>(null)

const columns = computed<DataTableColumns<PriceStrategy>>(() => [
  { title: '类型', key: 'type', width: 100, render: (r) => h(NTag, { size: 'small', type: PRICE_STRATEGY_TYPE[r.type as keyof typeof PRICE_STRATEGY_TYPE]?.type as any }, { default: () => PRICE_STRATEGY_TYPE[r.type as keyof typeof PRICE_STRATEGY_TYPE]?.label }) },
  { title: '策略名称', key: 'name', ellipsis: { tooltip: true } },
  { title: '规则', key: 'rules', render: (r) => r.rules.map((rule: any, i: number) => h(NTag, { size: 'small', bordered: false, style: 'margin-right:4px', key: i }, { default: () => `${rule.level || rule.min_qty || rule.customer_name || '通用'} · ${rule.unit} · ¥${rule.unit_price.toFixed(2)}` })) },
  { title: '优先级', key: 'priority', width: 70 },
  { title: '状态', key: 'enabled', width: 70, render: (r) => h(NSwitch, { size: 'small', value: r.enabled, onUpdateValue: () => onToggle(r) }) },
  { title: '操作', key: 'actions', width: 120, render: (r) => h('div', [h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openEdit(r) }, { default: () => '编辑' }), h(NPopconfirm, { onPositiveClick: () => onDelete(r) }, { default: () => '确认删除?', trigger: () => h(NButton, { size: 'small', text: true, type: 'error', style: 'margin-left:8px' }, { default: () => '删除' }) })]) },
])

async function reload() { loading.value = true; try { const res = await priceApi.list({ ...query }); list.value = res.items } finally { loading.value = false } }
async function loadDeps() { products.value = await productApi.all() }
function addRule() { form.rules.push({ unit: '包', unit_price: 0 }) }
function openCreate() { Object.assign(form, { id: 0, product_id: products.value[0]?.id ?? 0, type: 'tier', name: '', rules: [], enabled: true, priority: 10, remark: '', starts_at: '', ends_at: '' }); addRule(); editVisible.value = true }
function openEdit(r: PriceStrategy) { Object.assign(form, JSON.parse(JSON.stringify(r))); flashRange.value = r.starts_at && r.ends_at ? [new Date(r.starts_at).getTime(), new Date(r.ends_at).getTime()] as any : null; editVisible.value = true }
async function onSave() { saving.value = true; try { if (form.id) { await priceApi.update(form.id, form); message.success('已更新') } else { await priceApi.create(form); message.success('已创建') } editVisible.value = false; reload() } finally { saving.value = false } }
async function onDelete(r: PriceStrategy) { await priceApi.remove(r.id); message.success('已删除'); reload() }
async function onToggle(r: PriceStrategy) { await priceApi.update(r.id, { enabled: r.enabled }); message.success('已更新') }
watch(() => form.type, () => { form.rules = []; addRule() })
onMounted(() => { loadDeps(); reload() })
</script>
