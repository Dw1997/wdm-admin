<template>
  <div class="page-container">
    <div class="card-section">
      <div class="page-header">
        <h2 class="page-title">价格查询</h2>
      </div>
      <div class="filter-bar">
        <n-input v-model:value="bookKeyword" clearable placeholder="搜索价格簿名称" style="width: 220px" @keyup.enter="loadBooks" />
        <n-button type="primary" size="small" @click="loadBooks">查询</n-button>
        <n-button size="small" @click="openBookCreate">新建价格簿</n-button>
      </div>
      <n-data-table
        :columns="bookColumns"
        :data="books"
        :loading="loading"
        size="small"
        :bordered="false"
        :row-key="(r: PriceBook) => r.id"
        :row-class-name="(r: PriceBook) => (r.id === currentBookId ? 'row-active' : '')"
        :row-props="(r: PriceBook) => ({ style: 'cursor: pointer', onClick: () => selectBook(r.id) })"
      />
    </div>

    <div class="card-section" v-if="currentBook">
      <div class="page-header">
        <h2 class="page-title">
          {{ currentBook.name }}
          <n-tag size="small" :type="PRICE_CHANNEL_TYPE[currentBook.channel_type].type" :bordered="false" style="margin-left: 8px">
            {{ PRICE_CHANNEL_TYPE[currentBook.channel_type].label }}
          </n-tag>
        </h2>
        <n-button type="primary" size="small" @click="openItemCreate">新增明细</n-button>
      </div>
      <n-data-table
        :columns="itemColumns"
        :data="bookItems"
        :loading="itemsLoading"
        size="small"
        :bordered="false"
        :row-key="(r: PriceBookItem) => r.id"
      />
    </div>

    <n-modal v-model:show="showBookModal" preset="card" :title="bookForm.id ? '编辑价格簿' : '新建价格簿'" style="width: 440px">
      <n-form label-placement="left" label-width="90">
        <n-form-item label="名称">
          <n-input v-model:value="bookForm.name" maxlength="50" show-count placeholder="价格簿名称" />
        </n-form-item>
        <n-form-item label="销售渠道">
          <n-select v-model:value="bookForm.channel_type" :options="channelOptions" placeholder="选择渠道" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <n-button size="small" @click="showBookModal = false">取消</n-button>
          <n-button type="primary" size="small" :loading="saving" @click="saveBook">保存</n-button>
        </div>
      </template>
    </n-modal>

    <n-modal v-model:show="showItemModal" preset="card" :title="itemForm.id ? '编辑明细' : '新增明细'" style="width: 460px">
      <n-form label-placement="left" label-width="90">
        <n-form-item label="商品">
          <n-select v-model:value="itemForm.spu_id" :options="spuOptions" filterable :disabled="!!itemForm.id" placeholder="选择商品" />
        </n-form-item>
        <n-form-item label="价格 (元)">
          <n-input-number v-model:value="itemForm.price" :precision="2" :min="0" style="width: 100%" />
        </n-form-item>
        <n-form-item label="生效日期">
          <n-date-picker v-model:formatted-value="itemForm.effective_date" type="date" value-format="yyyy-MM-dd" style="width: 100%" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <n-button size="small" @click="showItemModal = false">取消</n-button>
          <n-button type="primary" size="small" :loading="saving" @click="saveItem">保存</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, computed, onMounted } from 'vue'
import {
  NButton, NInput, NInputNumber, NSelect, NDataTable, NTag, useMessage, useDialog,
  type DataTableColumns,
} from 'naive-ui'
import { priceBookApi, productApi, fetchAllPages, PAGE_SIZE } from '@/api'
import { PRICE_CHANNEL_TYPE } from '@/utils/dict'
import { formatDate } from '@/utils/format'
import type { PriceBook, PriceBookItem, PriceChannelType, ProductSPU } from '@/types'

const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const itemsLoading = ref(false)
const saving = ref(false)

const books = ref<PriceBook[]>([])
const allItems = ref<PriceBookItem[]>([])
const spus = ref<ProductSPU[]>([])
const bookKeyword = ref('')
const currentBookId = ref<number | null>(null)

const currentBook = computed(() => books.value.find((b) => b.id === currentBookId.value) || null)
const bookItems = computed(() => allItems.value.filter((it) => it.book_id === currentBookId.value))

const channelOptions = (Object.keys(PRICE_CHANNEL_TYPE) as PriceChannelType[]).map((k) => ({
  label: PRICE_CHANNEL_TYPE[k].label,
  value: k,
}))

const spuOptions = ref<{ label: string; value: number }[]>([])

function spuName(spuId: number): string {
  const spu = spus.value.find((s) => s.id === spuId)
  return spu ? `${spu.name} (${spu.code})` : `SPU #${spuId}`
}

const bookColumns = computed<DataTableColumns<PriceBook>>(() => [
  { title: '名称', key: 'name', minWidth: 160 },
  {
    title: '销售渠道', key: 'channel_type', width: 120,
    render: (r) => h(NTag, { size: 'small', type: PRICE_CHANNEL_TYPE[r.channel_type].type, bordered: false }, { default: () => PRICE_CHANNEL_TYPE[r.channel_type].label }),
  },
  {
    title: '明细数', key: 'items', width: 80,
    render: (r) => allItems.value.filter((it) => it.book_id === r.id).length,
  },
  { title: '更新时间', key: 'updated_at', width: 160, render: (r) => (r.updated_at ? formatDate(r.updated_at) : '—') },
  {
    title: '操作', key: 'actions', width: 130,
    render: (r) => h('div', { style: 'display:flex;gap:8px' }, [
      h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openBookEdit(r) }, { default: () => '编辑' }),
      h(NButton, {
        size: 'small', text: true, type: 'error',
        onClick: () => dialog.warning({
          title: '删除价格簿',
          content: `确定删除价格簿「${r.name}」及其全部明细？`,
          positiveText: '删除',
          negativeText: '取消',
          onPositiveClick: () => removeBook(r),
        }),
      }, { default: () => '删除' }),
    ]),
  },
])

const itemColumns = computed<DataTableColumns<PriceBookItem>>(() => [
  { title: '商品', key: 'spu', minWidth: 200, render: (r) => spuName(r.spu_id) },
  { title: '价格 (元)', key: 'price', width: 120, render: (r) => `¥${r.price}` },
  { title: '生效日期', key: 'effective_date', width: 120 },
  { title: '更新时间', key: 'updated_at', width: 160, render: (r) => (r.updated_at ? formatDate(r.updated_at) : '—') },
  {
    title: '操作', key: 'actions', width: 130,
    render: (r) => h('div', { style: 'display:flex;gap:8px' }, [
      h(NButton, { size: 'small', text: true, type: 'primary', onClick: () => openItemEdit(r) }, { default: () => '编辑' }),
      h(NButton, {
        size: 'small', text: true, type: 'error',
        onClick: () => dialog.warning({
          title: '删除明细',
          content: `确定删除「${spuName(r.spu_id)}」的价格明细？`,
          positiveText: '删除',
          negativeText: '取消',
          onPositiveClick: () => removeItem(r),
        }),
      }, { default: () => '删除' }),
    ]),
  },
])

const showBookModal = ref(false)
const bookForm = ref({ id: null as number | null, name: '', channel_type: 'county_wholesale' as PriceChannelType })

const showItemModal = ref(false)
const itemForm = ref({ id: null as number | null, spu_id: null as number | null, price: 0, effective_date: '' })

function selectBook(id: number) {
  currentBookId.value = id
}

function openBookCreate() {
  bookForm.value = { id: null, name: '', channel_type: 'county_wholesale' }
  showBookModal.value = true
}

function openBookEdit(r: PriceBook) {
  bookForm.value = { id: r.id, name: r.name, channel_type: r.channel_type }
  showBookModal.value = true
}

async function saveBook() {
  if (!bookForm.value.name.trim()) return message.warning('请输入价格簿名称')
  saving.value = true
  try {
    if (bookForm.value.id) {
      await priceBookApi.update(bookForm.value.id, { name: bookForm.value.name, channel_type: bookForm.value.channel_type })
    } else {
      const created = await priceBookApi.create({ name: bookForm.value.name, channel_type: bookForm.value.channel_type })
      currentBookId.value = created.id
    }
    message.success('价格簿已保存')
    showBookModal.value = false
    await loadBooks()
  } finally {
    saving.value = false
  }
}

async function removeBook(r: PriceBook) {
  await priceBookApi.remove(r.id)
  if (currentBookId.value === r.id) currentBookId.value = null
  message.success('价格簿已删除')
  await Promise.all([loadBooks(), loadItems()])
}

function openItemCreate() {
  if (!currentBook.value) return
  itemForm.value = { id: null, spu_id: null, price: 0, effective_date: '' }
  showItemModal.value = true
}

function openItemEdit(r: PriceBookItem) {
  itemForm.value = { id: r.id, spu_id: r.spu_id, price: Number(r.price), effective_date: r.effective_date }
  showItemModal.value = true
}

async function saveItem() {
  if (!currentBook.value) return
  if (!itemForm.value.spu_id) return message.warning('请选择商品')
  if (!itemForm.value.effective_date) return message.warning('请选择生效日期')
  saving.value = true
  try {
    if (itemForm.value.id) {
      await priceBookApi.updateItem(itemForm.value.id, { price: itemForm.value.price, effective_date: itemForm.value.effective_date })
    } else {
      await priceBookApi.createItem({
        book_id: currentBook.value.id,
        spu_id: itemForm.value.spu_id,
        price: itemForm.value.price,
        effective_date: itemForm.value.effective_date,
      })
    }
    message.success('明细已保存')
    showItemModal.value = false
    await loadItems()
  } finally {
    saving.value = false
  }
}

async function removeItem(r: PriceBookItem) {
  await priceBookApi.removeItem(r.id)
  message.success('明细已删除')
  await loadItems()
}

async function loadBooks() {
  loading.value = true
  try {
    // /price-books 返回裸数组无 total，统一 page_size=20 逐页拉全量
    books.value = await fetchAllPages((p) => priceBookApi.list({ keyword: bookKeyword.value || undefined, page: p, page_size: PAGE_SIZE }))
    if (currentBookId.value && !books.value.some((b) => b.id === currentBookId.value)) {
      currentBookId.value = null
    }
  } finally {
    loading.value = false
  }
}

async function loadItems() {
  itemsLoading.value = true
  try {
    // /price-book-items 无 book_id 服务端筛选参数（Apifox），统一 page_size=20 逐页拉全量后前端按簿过滤
    allItems.value = await fetchAllPages((p) => priceBookApi.items({ page: p, page_size: PAGE_SIZE }))
  } finally {
    itemsLoading.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    // 商品下拉需全量选项：统一 page_size=20 逐页拉取
    const spuList = await fetchAllPages((p) => productApi.spus({ page: p, page_size: PAGE_SIZE }))
    spuOptions.value = spuList.map((s) => ({ label: `${s.name} (${s.code})`, value: s.id }))
    spus.value = spuList
    await Promise.all([loadBooks(), loadItems()])
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
:deep(.row-active) td {
  background-color: var(--primary-soft);
}
</style>
