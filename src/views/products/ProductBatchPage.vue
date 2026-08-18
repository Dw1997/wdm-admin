<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header"><h2 class="page-title">批次与效期</h2><span class="text-muted" style="font-size:13px">临期 {{ summary.expiring }} 个；已过期 {{ summary.expired }} 个</span></div>
      <div class="filter-bar">
        <n-select v-model:value="filterProduct" placeholder="全部商品" clearable filterable style="width: 280px" :options="productOpts" @update:value="reload" />
        <n-select v-model:value="filterStatus" placeholder="状态" clearable style="width: 140px" :options="[{label:'正常',value:'normal'},{label:'临期',value:'expiring'},{label:'已过期',value:'expired'}]" @update:value="reload" />
        <n-button size="small" @click="reload">刷新</n-button>
      </div>
      <n-data-table :columns="columns" :data="rows" :loading="loading" :bordered="false" size="small" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { h, ref, reactive, onMounted, computed } from 'vue'
import { NTag, NButton, useMessage, useDialog, type DataTableColumns } from 'naive-ui'
import { productApi } from '@/api'
import { formatQty } from '@/utils/format'
import type { Product } from '@/types'

const products = ref<Product[]>([]); const rows = ref<any[]>([]); const loading = ref(false)
const filterProduct = ref<number | null>(null); const filterStatus = ref('')
const message = useMessage(); const dialog = useDialog()
const productOpts = computed(() => products.value.map(p => ({ label: `${p.sku} · ${p.name}`, value: p.id })))
const summary = computed(() => { const s = { expiring: 0, expired: 0, normal: 0 }; rows.value.forEach(r => s[r.status as 'expiring' | 'expired' | 'normal']++); return s })

const columns = computed<DataTableColumns<any>>(() => [
  { title: 'SKU', key: 'sku', width: 120 },
  { title: '商品', key: 'name', ellipsis: { tooltip: true } },
  { title: '批次号', key: 'batch_no', width: 180 },
  { title: '生产日期', key: 'production_date', width: 120 },
  { title: '到期日期', key: 'expiry_date', width: 120 },
  { title: '距到期', key: 'days_left', width: 90, render: (r) => h(NTag, { size: 'small', type: r.status === 'expired' ? 'error' : r.status === 'expiring' ? 'warning' : 'success' }, { default: () => r.days_left < 0 ? '已过期' : `${r.days_left} 天` }) },
  { title: '数量', key: 'quantity', width: 90, render: (r) => `${formatQty(r.quantity)} ${r.base_unit}` },
  { title: '成本价', key: 'cost_price', width: 90, render: (r) => `¥${r.cost_price.toFixed(2)}` },
  { title: '状态', key: 'status', width: 80, render: (r) => h(NTag, { size: 'small', type: r.status === 'expired' ? 'error' : r.status === 'expiring' ? 'warning' : 'success' }, { default: () => r.status === 'expired' ? '已过期' : r.status === 'expiring' ? '临期' : '正常' }) },
  { title: '操作', key: 'actions', width: 140, render: (r) => h('div', [h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => mark(r) }, { default: () => '标记促销' }), h(NButton, { size: 'small', text: true, type: 'error', style: 'margin-left:8px', onClick: () => dispose(r) }, { default: () => '报废' })]) },
])

async function reload() {
  loading.value = true; try {
    const all = await productApi.all(); products.value = all; const out: any[] = []
    for (const p of all) { if (filterProduct.value && p.id !== filterProduct.value) continue
      for (const b of p.batches) { const days = Math.floor((new Date(b.expiry_date.replace(/-/g,'/')).getTime()-Date.now())/86400000)
        let status = 'normal'; if (days < 0) status = 'expired'; else if (days <= p.expiry_warning_days) status = 'expiring'
        if (filterStatus.value && filterStatus.value !== status) continue
        out.push({ ...b, product_id: p.id, sku: p.sku, name: p.name, base_unit: p.base_unit, days_left: days, status }) }
    }
    rows.value = out.sort((a, b) => a.days_left - b.days_left)
  } finally { loading.value = false }
}
function mark(r: any) { message.success('已加入促销候选清单') }
function dispose(r: any) {
  dialog.warning({ title: '报废确认', content: `确认报废批次 ${r.batch_no}（${r.quantity}${r.base_unit}）？`, positiveText: '确认', negativeText: '取消', onPositiveClick: async () => {
    const p = products.value.find(x => x.id === r.product_id); if (!p) return
    await productApi.update(p.id, { stock: Math.max(0, p.stock - r.quantity), batches: p.batches.filter(b => b.batch_no !== r.batch_no) }); message.success('已报废'); reload()
  } })
}
onMounted(reload)
</script>
