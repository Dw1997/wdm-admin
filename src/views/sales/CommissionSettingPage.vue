<template>
  <div class="page-container commission-setting">
    <div class="page-header">
      <div>
        <h2 class="page-title">提成设置</h2>
        <p class="page-sub">
          给每位销售单独设置商品的提成比例；没单独设置的商品回落到该销售的默认提成率。保存后只对之后下的订单生效。
        </p>
      </div>
      <n-button text type="primary" @click="helpVisible = true">查看口径</n-button>
    </div>

    <n-alert type="info" :bordered="false" class="rule-bar">
      提成按 <b>订单行金额 × 该行比例</b> 计算；比例在下单时快照到订单行，改了不影响已下的订单。
      填 <b>0</b> 表示这个商品不提成，留空表示跟随默认。
    </n-alert>

    <div class="setting-grid">
      <aside class="card-section sales-pane">
        <n-input
          v-model:value="salesKeyword"
          size="small"
          clearable
          placeholder="搜销售姓名或手机号"
        />
        <n-spin :show="salesLoading" class="sales-spin">
          <div class="sales-list">
            <button
              v-for="s in visibleSales"
              :key="s.sales_id"
              type="button"
              class="sales-item"
              :class="{ active: s.sales_id === currentId, off: !s.is_active }"
              @click="selectSales(s)"
            >
              <span class="avatar">{{ s.sales_name.slice(0, 1) }}</span>
              <span class="who">
                <span class="name">
                  {{ s.sales_name }}
                  <em v-if="!s.is_active">已停用</em>
                </span>
                <span class="meta">
                  {{ s.own_count ? `已设 ${s.own_count} / ${s.sku_total} 个规格` : '全部跟随默认' }}
                </span>
              </span>
              <n-tag size="tiny" :bordered="false" :type="s.default_rate ? 'primary' : 'error'">
                {{ s.default_rate ? `默认 ${rateText(s.default_rate)}` : '未设默认' }}
              </n-tag>
            </button>
            <n-empty v-if="!visibleSales.length" size="small" description="没有匹配的销售" />
          </div>
        </n-spin>
      </aside>

      <section class="card-section main-pane">
        <header class="main-head">
          <div class="main-title">
            <h3>{{ current?.sales_name || '—' }}</h3>
            <n-tag v-if="current" size="small" :bordered="false" :type="current.default_rate ? 'primary' : 'error'">
              {{ current.default_rate ? `默认 ${rateText(current.default_rate)}` : '未设默认提成率' }}
            </n-tag>
            <n-button
              size="tiny"
              quaternary
              type="primary"
              :disabled="!current?.is_active"
              @click="openDefault"
            >
              修改默认比例
            </n-button>
          </div>
          <span v-if="current" class="main-stat">
            已单独设置 <b>{{ current.own_count }}</b> 个 · 跟随默认
            <b>{{ current.sku_total - current.own_count }}</b> 个
          </span>
        </header>

        <n-alert v-if="current && !current.is_active" type="warning" :bordered="false" class="pane-alert">
          该销售已停用，提成设置只读；如需调整请先在账户管理启用。
        </n-alert>
        <n-alert
          v-else-if="current && !current.default_rate"
          type="warning"
          :bordered="false"
          class="pane-alert"
        >
          该销售还没设默认提成率，没单独设置的商品一律不提成。先点「修改默认比例」补上。
        </n-alert>

        <n-tabs :value="tab" type="line" class="main-tabs" @update:value="onTabChange">
          <n-tab-pane name="sku" tab="商品提成">
            <div class="toolbar">
              <n-radio-group v-model:value="status" size="small" @update:value="reloadSkus">
                <n-radio-button value="all">全部</n-radio-button>
                <n-radio-button value="own">已单独设置</n-radio-button>
                <n-radio-button value="follow">跟随默认</n-radio-button>
              </n-radio-group>
              <n-input
                v-model:value="keyword"
                size="small"
                clearable
                placeholder="搜商品名、编码或条码"
                style="width: 200px"
                @keyup.enter="reloadSkus"
                @clear="reloadSkus"
              />
              <n-select
                v-model:value="categoryId"
                size="small"
                clearable
                filterable
                placeholder="全部分类"
                :options="categoryOptions"
                style="width: 150px"
                @update:value="reloadSkus"
              />
              <span class="spacer" />
              <n-button
                size="small"
                type="primary"
                :disabled="!picked.length || !current?.is_active"
                @click="openBatch"
              >
                {{ picked.length ? `批量设置 (${picked.length})` : '批量设置' }}
              </n-button>
            </div>

            <div class="grid-head">
              <div>
                <n-checkbox
                  :checked="allChecked"
                  :indeterminate="someChecked"
                  :disabled="!current?.is_active || !allSkus.length"
                  @update:checked="toggleAll"
                />
              </div>
              <div>商品 / 规格</div>
              <div class="col-cat">分类</div>
              <div class="col-unit">单位</div>
              <div class="col-rate">提成比例</div>
              <div class="col-src">来源</div>
              <div class="col-act">操作</div>
            </div>

            <n-spin :show="skuLoading" class="sku-spin">
              <div class="grid-body">
                <template v-for="spu in spuRows" :key="spu.spu_id">
                  <!-- 单 SKU 商品：紧凑单行展示 -->
                  <div
                    v-if="spu.skus.length === 1"
                    class="grid-row"
                    :class="{ dirty: isDirty(spu.skus[0]), off: !spu.skus[0].is_enabled }"
                  >
                    <div>
                      <n-checkbox
                        :checked="picked.includes(spu.skus[0].sku_id)"
                        :disabled="!current?.is_active"
                        @update:checked="(v) => togglePick(spu.skus[0].sku_id, v)"
                      />
                    </div>
                    <div class="product">
                      <span class="dot" />
                      <div class="product-text">
                        <div class="pname">
                          {{ spu.spu_name }}
                          <span v-if="!spu.skus[0].is_enabled" class="off-tag">已停用</span>
                        </div>
                        <div class="pcode">
                          {{ spu.spu_code }}
                          <template v-if="spu.skus[0].sku_spec"> · {{ spu.skus[0].sku_spec }}</template>
                          <template v-if="spu.skus[0].sku_remark">（{{ spu.skus[0].sku_remark }}）</template>
                        </div>
                      </div>
                    </div>
                    <div class="col-cat muted">{{ spu.category_name || '—' }}</div>
                    <div class="col-unit muted">{{ spu.skus[0].unit || spu.skus[0].sku_spec || '—' }}</div>
                    <div class="col-rate">
                      <n-input-number
                        :value="rowValue(spu.skus[0])"
                        size="small"
                        :min="0"
                        :max="100"
                        :precision="2"
                        :show-button="false"
                        :disabled="!current?.is_active"
                        :placeholder="defaultPlaceholder"
                        @update:value="(v) => setRate(spu.skus[0], v)"
                      >
                        <template #suffix>%</template>
                      </n-input-number>
                    </div>
                    <div class="col-src">
                      <n-tag v-if="isDirty(spu.skus[0])" size="tiny" :bordered="false" type="warning">
                        {{
                          pending[spu.skus[0].sku_id] === null
                            ? '待清除'
                            : `待保存 ${pendingRateText(spu.skus[0].sku_id)}`
                        }}
                      </n-tag>
                      <n-tag v-else-if="spu.skus[0].is_own" size="tiny" :bordered="false" type="primary">
                        单独设置
                      </n-tag>
                      <n-tag v-else size="tiny" :bordered="false">
                        跟随默认 {{ spu.skus[0].effective_rate ? rateText(spu.skus[0].effective_rate) : '未设' }}
                      </n-tag>
                    </div>
                    <div class="col-act">
                      <n-tooltip v-if="spu.skus[0].is_own" placement="top" :delay="150">
                        <template #trigger>
                          <n-button
                            text
                            type="error"
                            aria-label="清除"
                            :disabled="!current?.is_active"
                            @click="clearRate(spu.skus[0])"
                          >
                            <template #icon><n-icon :component="Trash" :size="16" /></template>
                          </n-button>
                        </template>
                        清除
                      </n-tooltip>
                    </div>
                  </div>

                  <!-- 多 SKU 商品：SPU 父行 + SKU 子行（默认展开） -->
                  <div v-else class="spu-group">
                    <div
                      class="grid-row spu-parent-row"
                      :class="{ off: !spu.is_enabled, dirty: spuDirtyCount(spu) > 0 }"
                    >
                      <div>
                        <n-checkbox
                          :checked="isSpuAllChecked(spu)"
                          :indeterminate="isSpuSomeChecked(spu)"
                          :disabled="!current?.is_active"
                          @update:checked="(v) => toggleSpu(spu, v)"
                        />
                      </div>
                      <button
                        type="button"
                        class="spu-toggle"
                        @click="toggleCollapse(spu.spu_id)"
                      >
                        <span class="collapse-arrow" :class="{ collapsed: isCollapsed(spu.spu_id) }">▾</span>
                        <div class="product-text">
                          <div class="pname">
                            {{ spu.spu_name }}
                            <span class="sku-count-tag">{{ spu.skus.length }} 个规格</span>
                            <span v-if="!spu.is_enabled" class="off-tag">已停用</span>
                          </div>
                          <div class="pcode">{{ spu.spu_code }}</div>
                        </div>
                      </button>
                      <div class="col-cat muted">{{ spu.category_name || '—' }}</div>
                      <div class="col-unit muted">—</div>
                      <div class="col-rate spu-summary">
                        <span v-if="spuOwnCount(spu) > 0">已设 {{ spuOwnCount(spu) }}/{{ spu.skus.length }}</span>
                        <span v-else class="muted">全部跟随默认</span>
                      </div>
                      <div class="col-src">
                        <n-tag v-if="spuDirtyCount(spu) > 0" size="tiny" :bordered="false" type="warning">
                          待保存 {{ spuDirtyCount(spu) }} 项
                        </n-tag>
                      </div>
                      <div class="col-act" />
                    </div>

                    <div
                      v-for="sku in spu.skus"
                      v-show="!isCollapsed(spu.spu_id)"
                      :key="sku.sku_id"
                      class="grid-row sku-child-row"
                      :class="{ dirty: isDirty(sku), off: !sku.is_enabled }"
                    >
                      <div>
                        <n-checkbox
                          :checked="picked.includes(sku.sku_id)"
                          :disabled="!current?.is_active"
                          @update:checked="(v) => togglePick(sku.sku_id, v)"
                        />
                      </div>
                      <div class="product sku-indent">
                        <span class="sku-branch" />
                        <span class="dot" />
                        <div class="product-text">
                          <div class="pname sku-spec-name">
                            {{ sku.sku_spec || '默认规格' }}
                            <span v-if="!sku.is_enabled" class="off-tag">已停用</span>
                          </div>
                          <div v-if="sku.sku_remark || sku.barcode" class="pcode">
                            <template v-if="sku.sku_remark">{{ sku.sku_remark }}</template>
                            <template v-if="sku.sku_remark && sku.barcode"> · </template>
                            <template v-if="sku.barcode">{{ sku.barcode }}</template>
                          </div>
                        </div>
                      </div>
                      <div class="col-cat muted" />
                      <div class="col-unit muted">{{ sku.unit || sku.sku_spec || '—' }}</div>
                      <div class="col-rate">
                        <n-input-number
                          :value="rowValue(sku)"
                          size="small"
                          :min="0"
                          :max="100"
                          :precision="2"
                          :show-button="false"
                          :disabled="!current?.is_active"
                          :placeholder="defaultPlaceholder"
                          @update:value="(v) => setRate(sku, v)"
                        >
                          <template #suffix>%</template>
                        </n-input-number>
                      </div>
                      <div class="col-src">
                        <n-tag v-if="isDirty(sku)" size="tiny" :bordered="false" type="warning">
                          {{ pending[sku.sku_id] === null ? '待清除' : `待保存 ${pendingRateText(sku.sku_id)}` }}
                        </n-tag>
                        <n-tag v-else-if="sku.is_own" size="tiny" :bordered="false" type="primary">单独设置</n-tag>
                        <n-tag v-else size="tiny" :bordered="false">
                          跟随默认 {{ sku.effective_rate ? rateText(sku.effective_rate) : '未设' }}
                        </n-tag>
                      </div>
                      <div class="col-act">
                        <n-tooltip v-if="sku.is_own" placement="top" :delay="150">
                          <template #trigger>
                            <n-button
                              text
                              type="error"
                              aria-label="清除"
                              :disabled="!current?.is_active"
                              @click="clearRate(sku)"
                            >
                              <template #icon><n-icon :component="Trash" :size="16" /></template>
                            </n-button>
                          </template>
                          清除
                        </n-tooltip>
                      </div>
                    </div>
                  </div>
                </template>
                <n-empty v-if="!skuLoading && !spuRows.length" description="没有符合条件的商品" class="empty" />
              </div>
            </n-spin>

            <div class="grid-foot">
              <span>
                共 <b>{{ total }}</b> 个商品（当前页 <b>{{ allSkus.length }}</b> 个规格）<template v-if="filtered">（已筛选）</template>
              </span>
              <span class="spacer" />
              <n-pagination
                v-model:page="page"
                :page-size="pageSize"
                :item-count="total"
                size="small"
                @update:page="loadSkus"
              />
            </div>
          </n-tab-pane>

          <n-tab-pane name="log" :tab="`变更记录${changeTotal ? ` (${changeTotal})` : ''}`">
            <div class="log-scroll">
              <n-data-table
                remote
                size="small"
                :bordered="false"
                :columns="changeColumns"
                :data="changes"
                :loading="changeLoading"
                :row-key="(r: CommissionSettingChange) => r.batch_no"
                :pagination="changePagination"
                @update:page="onChangePage"
              />
            </div>
          </n-tab-pane>
        </n-tabs>
      </section>
    </div>

    <transition name="slide-up">
      <div v-if="pendingCount" class="save-bar">
        <div class="save-text">
          <div>已修改 <b>{{ pendingCount }}</b> 项 · {{ current?.sales_name }}</div>
          <div class="save-hint">保存后对之后下的订单生效，历史订单按原快照不变</div>
        </div>
        <span class="spacer" />
        <n-button size="small" @click="discard">放弃</n-button>
        <n-button size="small" type="primary" :loading="saving" @click="save">保存修改</n-button>
      </div>
    </transition>

    <n-modal
      v-model:show="batchVisible"
      preset="card"
      style="width: 460px"
      :title="`批量设置提成`"
      :bordered="false"
    >
      <p class="modal-sub">已选 {{ picked.length }} 个规格 · 销售 {{ current?.sales_name }}</p>
      <n-radio-group v-model:value="batchMode" class="batch-modes">
        <label class="batch-opt" :class="{ on: batchMode === 'set' }">
          <n-radio value="set" />
          <div class="batch-opt-body">
            <div class="batch-opt-title">统一设为</div>
            <n-input-number
              v-model:value="batchRate"
              size="small"
              :min="0"
              :max="100"
              :precision="2"
              :show-button="false"
              placeholder="5.00"
              style="width: 110px"
            >
              <template #suffix>%</template>
            </n-input-number>
            <div class="batch-opt-note">填 0 表示这批商品都不提成。</div>
          </div>
        </label>
        <label class="batch-opt" :class="{ on: batchMode === 'clear' }">
          <n-radio value="clear" />
          <div class="batch-opt-body">
            <div class="batch-opt-title">清除单独设置，回落默认比例</div>
            <div class="batch-opt-note">
              将跟随 {{ current?.sales_name }} 的默认比例
              {{ current?.default_rate ? rateText(current.default_rate) : '（未设置，等于不提成）' }}
            </div>
          </div>
        </label>
      </n-radio-group>
      <p class="modal-foot-note">批量设置只是填入表格，仍需点「保存修改」才提交。</p>
      <template #footer>
        <div class="modal-actions">
          <n-button size="small" @click="batchVisible = false">取消</n-button>
          <n-button size="small" type="primary" @click="applyBatch">应用到表格</n-button>
        </div>
      </template>
    </n-modal>

    <n-modal
      v-model:show="defaultVisible"
      preset="card"
      style="width: 420px"
      title="修改默认比例"
      :bordered="false"
    >
      <p class="modal-sub">{{ current?.sales_name }} · 影响没单独设置的商品</p>
      <n-input-number
        v-model:value="defaultRate"
        :min="0"
        :max="100"
        :precision="2"
        :show-button="false"
        placeholder="3.00"
        style="width: 140px"
      >
        <template #suffix>%</template>
      </n-input-number>
      <p class="modal-foot-note">
        与「账户管理」里的提成率是同一个值，保存后对之后下单生效。
      </p>
      <template #footer>
        <div class="modal-actions">
          <n-button size="small" @click="defaultVisible = false">取消</n-button>
          <n-button size="small" type="primary" :loading="savingDefault" @click="saveDefault">保存</n-button>
        </div>
      </template>
    </n-modal>

    <n-modal
      v-model:show="helpVisible"
      preset="card"
      style="width: 560px"
      title="提成口径"
      :bordered="false"
    >
      <div class="help-body">
        <p><b>1. 算多少：</b>订单提成 = Σ(每个订单行的金额 × 该行比例)。行金额取该行实收（行原价 − 行折扣），退货按行扣减。</p>
        <p><b>2. 比例从哪来：</b>先看「这个销售 + 这个商品」有没有单独设置；没有就用该销售的默认比例；默认比例也没设，这个商品就不提成。</p>
        <p><b>3. 什么时候定下来：</b>下单时把每行的比例快照写到订单行上。之后改设置，已下的订单仍按当时的比例算。</p>
        <p><b>4. 算谁：</b>订单上的销售快照。客户后来改归属，不影响已下单的提成。</p>
        <p><b>5. 0 和留空的区别：</b>0 是明确「这个商品不提成」；留空是「跟随默认」，默认改了它也跟着变。</p>
      </div>
      <template #footer>
        <div class="modal-actions">
          <n-button size="small" type="primary" @click="helpVisible = false">知道了</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { NTag, useDialog, useMessage, type DataTableColumns } from 'naive-ui'
import { Trash } from '@vicons/tabler'
import { accountApi, categoryApi, financeApi } from '@/api'
import { formatDate } from '@/utils/format'
import type {
  Category,
  CommissionSettingChange,
  CommissionSettingSales,
  CommissionSettingSku,
  CommissionSettingSpu,
} from '@/types'

const message = useMessage()
const dialog = useDialog()

const salesList = ref<CommissionSettingSales[]>([])
const salesLoading = ref(false)
const salesKeyword = ref('')
const currentId = ref<number | null>(null)
const current = computed(
  () => salesList.value.find((s) => s.sales_id === currentId.value) || null,
)
const visibleSales = computed(() => {
  const kw = salesKeyword.value.trim()
  if (!kw) return salesList.value
  return salesList.value.filter(
    (s) => s.sales_name.includes(kw) || String(s.sales_id) === kw,
  )
})

const spuRows = ref<CommissionSettingSpu[]>([])
const allSkus = computed(() => spuRows.value.flatMap((spu) => spu.skus))
const collapsedSpuIds = ref<number[]>([])
const skuLoading = ref(false)
const total = ref(0)
const filtered = ref(false)
const page = ref(1)
const pageSize = 20
const keyword = ref('')
const categoryId = ref<number | null>(null)
const status = ref<string>('all')
const categoryOptions = ref<{ label: string; value: number }[]>([])

const tab = ref<'sku' | 'log'>('sku')
const pending = ref<Record<number, number | null>>({})
const picked = ref<number[]>([])
const saving = ref(false)

const changes = ref<CommissionSettingChange[]>([])
const changeTotal = ref(0)
const changePage = ref(1)
const changeLoading = ref(false)

const batchVisible = ref(false)
const batchMode = ref<'set' | 'clear'>('set')
const batchRate = ref<number | null>(null)
const defaultVisible = ref(false)
const defaultRate = ref<number | null>(null)
const savingDefault = ref(false)
const helpVisible = ref(false)

const pendingCount = computed(() => Object.keys(pending.value).length)
const defaultPlaceholder = computed(() =>
  current.value?.default_rate ? rateText(current.value.default_rate) : '0.00',
)

function rateText(rate: string | null | undefined): string {
  if (rate === null || rate === undefined || rate === '') return '—'
  return `${(Number(rate) * 100).toFixed(2)}%`
}

function pendingRateText(skuId: number): string {
  const v = pending.value[skuId]
  return v === null || v === undefined ? '—' : `${Number(v).toFixed(2)}%`
}

function toApiRate(percent: number): string {
  return (percent / 100).toFixed(4)
}

function isDirty(row: CommissionSettingSku): boolean {
  // 直接读键值，让渲染依赖到这一行；hasOwnProperty 不会被 Vue 追踪
  return pending.value[row.sku_id] !== undefined
}

function rowValue(row: CommissionSettingSku): number | null {
  const v = pending.value[row.sku_id]
  if (v !== undefined) return v
  return row.is_own && row.own_rate ? Number((Number(row.own_rate) * 100).toFixed(2)) : null
}

function setRate(row: CommissionSettingSku, percent: number | null) {
  if (!current.value?.is_active) return
  const saved = row.is_own && row.own_rate ? Number((Number(row.own_rate) * 100).toFixed(2)) : null
  if (percent === null) {
    if (saved === null) delete pending.value[row.sku_id]
    else pending.value[row.sku_id] = null
    return
  }
  const value = Number(percent.toFixed(2))
  if (saved !== null && Math.abs(saved - value) < 0.005) delete pending.value[row.sku_id]
  else pending.value[row.sku_id] = value
}

function clearRate(row: CommissionSettingSku) {
  if (!current.value?.is_active) return
  pending.value[row.sku_id] = null
}

function isCollapsed(spuId: number): boolean {
  return collapsedSpuIds.value.includes(spuId)
}

function toggleCollapse(spuId: number) {
  if (isCollapsed(spuId)) {
    collapsedSpuIds.value = collapsedSpuIds.value.filter((id) => id !== spuId)
  } else {
    collapsedSpuIds.value = [...collapsedSpuIds.value, spuId]
  }
}

function spuOwnCount(spu: CommissionSettingSpu): number {
  return spu.skus.filter((sku) => {
    const v = pending.value[sku.sku_id]
    if (v !== undefined) return v !== null
    return sku.is_own
  }).length
}

function spuDirtyCount(spu: CommissionSettingSpu): number {
  return spu.skus.filter((sku) => isDirty(sku)).length
}

function isSpuAllChecked(spu: CommissionSettingSpu): boolean {
  return spu.skus.length > 0 && spu.skus.every((sku) => picked.value.includes(sku.sku_id))
}

function isSpuSomeChecked(spu: CommissionSettingSpu): boolean {
  return !isSpuAllChecked(spu) && spu.skus.some((sku) => picked.value.includes(sku.sku_id))
}

function toggleSpu(spu: CommissionSettingSpu, v: boolean) {
  const spuSkuIds = spu.skus.map((sku) => sku.sku_id)
  if (!v) {
    const idSet = new Set(spuSkuIds)
    picked.value = picked.value.filter((id) => !idSet.has(id))
    return
  }
  const ids = new Set(picked.value)
  spuSkuIds.forEach((id) => ids.add(id))
  picked.value = [...ids]
}

const allChecked = computed(
  () => allSkus.value.length > 0 && allSkus.value.every((r) => picked.value.includes(r.sku_id)),
)
const someChecked = computed(
  () => !allChecked.value && allSkus.value.some((r) => picked.value.includes(r.sku_id)),
)

function toggleAll(v: boolean) {
  if (!v) {
    const ids = new Set(allSkus.value.map((r) => r.sku_id))
    picked.value = picked.value.filter((id) => !ids.has(id))
    return
  }
  const ids = new Set(picked.value)
  allSkus.value.forEach((r) => ids.add(r.sku_id))
  picked.value = [...ids]
}

function togglePick(id: number, v: boolean) {
  picked.value = v ? [...new Set([...picked.value, id])] : picked.value.filter((x) => x !== id)
}

async function loadSales() {
  salesLoading.value = true
  try {
    const res = await financeApi.commissionSettingSales()
    salesList.value = res.items
    if (!salesList.value.some((s) => s.sales_id === currentId.value)) {
      currentId.value = salesList.value[0]?.sales_id ?? null
      pending.value = {}
      picked.value = []
    }
  } catch (e) {
    message.error(`销售列表加载失败：${(e as Error).message}`)
  } finally {
    salesLoading.value = false
  }
}

async function loadSkus() {
  if (!currentId.value) {
    spuRows.value = []
    total.value = 0
    return
  }
  skuLoading.value = true
  try {
    const res = await financeApi.commissionSettingSkus(currentId.value, {
      keyword: keyword.value.trim() || undefined,
      category_id: categoryId.value ?? undefined,
      status: status.value,
      page: page.value,
      page_size: pageSize,
    })
    spuRows.value = res.items
    total.value = res.total
    filtered.value = Boolean(keyword.value.trim() || categoryId.value || status.value !== 'all')
    const validIds = new Set(res.items.flatMap((spu) => spu.skus.map((sku) => sku.sku_id)))
    picked.value = picked.value.filter((id) => validIds.has(id))
  } catch (e) {
    message.error(`商品提成加载失败：${(e as Error).message}`)
  } finally {
    skuLoading.value = false
  }
}

function reloadSkus() {
  page.value = 1
  loadSkus()
}

async function loadChanges() {
  changeLoading.value = true
  try {
    const res = await financeApi.commissionSettingChanges({
      sales_id: currentId.value ?? undefined,
      page: changePage.value,
      page_size: pageSize,
    })
    changes.value = res.items
    changeTotal.value = res.total
  } catch (e) {
    message.error(`变更记录加载失败：${(e as Error).message}`)
  } finally {
    changeLoading.value = false
  }
}

function onChangePage(p: number) {
  changePage.value = p
  loadChanges()
}

async function refreshAfterSave() {
  await Promise.all([loadSales(), loadSkus()])
  if (tab.value === 'log') loadChanges()
}

function guardPending(action: () => void) {
  if (!pendingCount.value) {
    action()
    return
  }
  dialog.warning({
    title: '有未保存的改动',
    content: `当前销售还有 ${pendingCount.value} 项提成改动未保存，离开后这些改动会丢失。`,
    positiveText: '放弃并离开',
    negativeText: '继续编辑',
    onPositiveClick: () => {
      pending.value = {}
      action()
      message.info('已放弃未保存的改动')
    },
  })
}

function selectSales(s: CommissionSettingSales) {
  if (s.sales_id === currentId.value) return
  guardPending(() => {
    currentId.value = s.sales_id
    page.value = 1
    picked.value = []
    pending.value = {}
    if (tab.value === 'log') {
      changePage.value = 1
      loadChanges()
    }
    loadSkus()
  })
}

function onTabChange(value: string) {
  if (value === tab.value) return
  if (value === 'log' && pendingCount.value) {
    dialog.warning({
      title: '有未保存的改动',
      content: `还有 ${pendingCount.value} 项改动未保存，去「变更记录」会丢掉这些改动。`,
      positiveText: '放弃并切换',
      negativeText: '继续编辑',
      onPositiveClick: () => {
        pending.value = {}
        tab.value = 'log'
        changePage.value = 1
        loadChanges()
      },
    })
    return
  }
  tab.value = value as 'sku' | 'log'
  if (value === 'log') {
    changePage.value = 1
    loadChanges()
  }
}

function openBatch() {
  if (!picked.value.length) return
  batchMode.value = 'set'
  batchRate.value = null
  batchVisible.value = true
}

function applyBatch() {
  if (!current.value?.is_active) return
  if (batchMode.value === 'set') {
    if (batchRate.value === null) {
      message.warning('请填一个 0 到 100 之间的比例')
      return
    }
    const rate = Number(batchRate.value)
    picked.value.forEach((id) => {
      pending.value[id] = rate
    })
  } else {
    picked.value.forEach((id) => {
      const row = allSkus.value.find((r) => r.sku_id === id)
      if (row?.is_own) pending.value[id] = null
      else delete pending.value[id]
    })
  }
  const count = picked.value.length
  picked.value = []
  batchVisible.value = false
  message.success(`已把 ${count} 个规格填入表格，记得点「保存修改」`)
}

function discard() {
  pending.value = {}
  message.info('已放弃未保存的改动')
}

async function save() {
  if (!currentId.value || !pendingCount.value) return
  const items = Object.entries(pending.value).map(([skuId, rate]) => ({
    sku_id: Number(skuId),
    rate: rate === null ? null : toApiRate(rate),
  }))
  saving.value = true
  try {
    const res = await financeApi.saveCommissionSettings(currentId.value, items)
    pending.value = {}
    picked.value = []
    if (res.changed_count === 0) message.info('没有实际变化，未提交')
    else message.success(`已保存 ${res.changed_count} 项，对之后下的订单生效`)
    await refreshAfterSave()
  } catch (e) {
    message.error(`保存失败：${(e as Error).message}`)
  } finally {
    saving.value = false
  }
}

function openDefault() {
  if (!current.value?.is_active) return
  defaultRate.value = current.value.default_rate
    ? Number((Number(current.value.default_rate) * 100).toFixed(2))
    : null
  defaultVisible.value = true
}

async function saveDefault() {
  if (!currentId.value) return
  if (defaultRate.value === null) {
    message.warning('请填一个 0 到 100 之间的比例')
    return
  }
  savingDefault.value = true
  try {
    await accountApi.update(currentId.value, {
      commission_rate: toApiRate(Number(defaultRate.value)),
    })
    defaultVisible.value = false
    message.success('默认比例已更新，对之后下单生效')
    await refreshAfterSave()
  } catch (e) {
    message.error(`保存失败：${(e as Error).message}`)
  } finally {
    savingDefault.value = false
  }
}

const changeColumns = computed<DataTableColumns<CommissionSettingChange>>(() => [
  {
    type: 'expand',
    width: 36,
    renderExpand: (row) =>
      h(
        'div',
        { class: 'change-detail' },
        row.changes.map((c) =>
          h('div', { class: 'change-detail-row' }, [
            h('span', { class: 'change-detail-name' }, c.sku_name),
            h(
              'span',
              { class: 'change-detail-rate' },
              c.new_rate === null
                ? `${rateText(c.old_rate)} → 跟随默认`
                : `${rateText(c.old_rate)} → ${rateText(c.new_rate)}`,
            ),
          ]),
        ),
      ),
  },
  {
    title: '时间',
    key: 'created_at',
    width: 150,
    render: (r) => formatDate(r.created_at, 'YYYY-MM-DD HH:mm'),
  },
  { title: '操作人', key: 'operator_name', width: 90 },
  { title: '销售', key: 'sales_name', width: 100 },
  {
    title: '商品',
    key: 'changes',
    render: (r) => (r.changed_count > 1 ? `${r.changed_count} 个商品` : r.changes[0]?.sku_name ?? '—'),
    ellipsis: { tooltip: true },
  },
  {
    title: '比例变化',
    key: 'diff',
    width: 190,
    render: (r) => {
      if (r.changed_count > 1) return h('span', { class: 'muted' }, '见展开明细')
      const c = r.changes[0]
      if (!c) return '—'
      return h('span', {}, [
        c.old_rate === null ? null : h('s', { class: 'old-rate' }, rateText(c.old_rate)),
        h('b', {}, c.new_rate === null ? '跟随默认' : rateText(c.new_rate)),
      ])
    },
  },
  {
    title: '方式',
    key: 'way',
    width: 80,
    render: (r) =>
      h(
        NTag,
        {
          size: 'tiny',
          bordered: false,
          type: r.way === 'batch' ? 'warning' : r.way === 'clear' ? 'default' : 'primary',
        },
        { default: () => (r.way === 'batch' ? '批量' : r.way === 'clear' ? '清除' : '单独') },
      ),
  },
])

const changePagination = computed(() => ({
  page: changePage.value,
  pageSize,
  itemCount: changeTotal.value,
  showSizePicker: false,
}))

onMounted(async () => {
  try {
    const tree = await categoryApi.tree()
    const flat: { label: string; value: number }[] = []
    const walk = (nodes: Category[], depth: number) => {
      nodes.forEach((node) => {
        flat.push({ label: `${'　'.repeat(depth)}${node.name}`, value: node.id })
        if (node.children?.length) walk(node.children, depth + 1)
      })
    }
    walk(tree, 0)
    categoryOptions.value = flat
  } catch {
    categoryOptions.value = []
  }
  await loadSales()
  await loadSkus()
})
</script>

<style scoped>
.commission-setting {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.commission-setting > .page-header,
.commission-setting > .rule-bar {
  flex: none;
}
.page-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.6;
}
.rule-bar {
  margin-bottom: 12px;
  font-size: 12.5px;
}
.rule-bar b {
  color: var(--primary);
}
.setting-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 288px minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
  overflow: hidden;
}
.sales-pane {
  height: 100%;
  min-height: 0;
  padding: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sales-spin {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sales-spin :deep(.n-spin-content) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sales-list {
  flex: 1;
  min-height: 0;
  margin-top: 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding-right: 2px;
}
.sales-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  position: relative;
  transition: background 0.12s;
}
.sales-item:hover {
  background: var(--bg-hover);
}
.sales-item.active {
  background: var(--primary-soft);
}
.sales-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 7px;
  bottom: 7px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--primary);
}
.sales-item.off {
  opacity: 0.55;
}
.avatar {
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 50%;
  background: var(--bg-subtle);
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}
.sales-item.active .avatar {
  background: var(--bg-card);
  color: var(--primary);
}
.who {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.who .name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.who .name em {
  font-style: normal;
  font-size: 10px;
  font-weight: 400;
  color: var(--text-3);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0 4px;
  margin-left: 4px;
}
.who .meta {
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.main-pane {
  height: 100%;
  min-height: 0;
  min-width: 0;
  padding: 10px 14px 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.main-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 2px 0 6px;
}
.main-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.main-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.main-stat {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-3);
}
.main-stat b {
  color: var(--text-1);
}
.pane-alert {
  flex: none;
  margin-bottom: 8px;
  font-size: 12.5px;
}
.main-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.main-tabs :deep(.n-tabs-nav) {
  flex: none;
}
.main-tabs :deep(.n-tabs-pane-wrapper) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.main-tabs :deep(.n-tab-pane) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-top: 0;
}
.toolbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 0;
}
.spacer {
  flex: 1;
}

.grid-head,
.grid-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 96px 60px 128px 168px 56px;
  gap: 10px;
  align-items: center;
  padding: 0 8px;
}
.grid-head {
  flex: none;
  height: 34px;
  font-size: 12px;
  color: var(--text-3);
  background: var(--bg-subtle);
  border-radius: 8px;
}
.sku-spin {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sku-spin :deep(.n-spin-content) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.grid-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding-bottom: 64px;
}
.log-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-top: 8px;
}
.grid-row {
  min-height: 52px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.grid-row:hover {
  background: var(--bg-subtle);
}
.spu-parent-row {
  min-height: 46px;
  background: var(--bg-subtle);
}
.spu-parent-row:hover {
  background: var(--bg-hover);
}
.spu-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.collapse-arrow {
  flex: none;
  width: 14px;
  font-size: 12px;
  color: var(--text-3);
  display: inline-flex;
  justify-content: center;
  transition: transform 0.15s;
}
.collapse-arrow.collapsed {
  transform: rotate(-90deg);
}
.sku-count-tag {
  font-size: 10.5px;
  font-weight: 500;
  color: var(--primary);
  background: var(--primary-soft);
  border-radius: 4px;
  padding: 1px 5px;
  margin-left: 6px;
}
.spu-summary {
  font-size: 12px;
  color: var(--text-2);
  text-align: right;
  white-space: nowrap;
}
.sku-child-row {
  min-height: 48px;
  background: var(--bg-card);
}
.sku-indent {
  padding-left: 14px;
}
.sku-branch {
  flex: none;
  width: 10px;
  height: 12px;
  border-left: 1.5px solid var(--border);
  border-bottom: 1.5px solid var(--border);
  border-bottom-left-radius: 3px;
  margin-top: -6px;
}
.sku-spec-name {
  font-weight: 400;
}
.grid-row.off .pname,
.grid-row.off .pcode,
.grid-row.off .muted {
  color: var(--text-3);
}
.grid-row.dirty {
  background: color-mix(in srgb, var(--primary) 4%, transparent);
}
.product {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.dot {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
  background: var(--primary);
  opacity: 0;
}
.grid-row.dirty .dot {
  opacity: 1;
}
.product-text {
  min-width: 0;
}
.pname {
  font-weight: 500;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pcode {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 1px;
}
.off-tag {
  font-size: 10px;
  color: var(--text-3);
  background: var(--bg-hover);
  border-radius: 4px;
  padding: 0 4px;
  margin-left: 4px;
}
.muted {
  color: var(--text-3);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.col-rate :deep(.n-input-number) {
  width: 100%;
}
.col-rate :deep(.n-input__input-el) {
  text-align: right;
}
.col-src,
.col-act {
  white-space: nowrap;
}
.col-act {
  text-align: right;
}
.grid-foot {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 8px 0;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-3);
}
.grid-foot b {
  color: var(--text-1);
}
.empty {
  padding: 28px 0;
}

.save-bar {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 520px;
  padding: 10px 14px 10px 18px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(16, 24, 40, 0.16);
}
.save-text {
  font-size: 13px;
  color: var(--text-1);
}
.save-hint {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 2px;
}
.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.18s, transform 0.18s;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 16px);
}

.modal-sub {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--text-3);
}
.batch-modes {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
.batch-opt {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  cursor: pointer;
}
.batch-opt.on {
  border-color: var(--primary);
  background: var(--primary-soft);
}
.batch-opt-body {
  flex: 1;
  min-width: 0;
}
.batch-opt-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}
.batch-opt-note {
  font-size: 11.5px;
  color: var(--text-3);
  margin-top: 6px;
  line-height: 1.6;
}
.modal-foot-note {
  margin: 12px 0 0;
  font-size: 11.5px;
  color: var(--text-3);
}
.modal-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}
.help-body {
  font-size: 13px;
  line-height: 1.85;
  color: var(--text-2);
}
.help-body p {
  margin: 0 0 10px;
}
.help-body b {
  color: var(--text-1);
}
.change-detail {
  padding: 6px 8px;
}
.change-detail-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12.5px;
  padding: 3px 0;
  color: var(--text-2);
}
.change-detail-rate {
  color: var(--text-3);
}
.old-rate {
  color: var(--text-3);
  margin-right: 6px;
}

@media (max-width: 1120px) {
  .commission-setting {
    height: auto;
    min-height: 100%;
    overflow: visible;
  }
  .setting-grid {
    flex: none;
    overflow: visible;
    grid-template-columns: 1fr;
  }
  .sales-pane {
    height: auto;
    max-height: 260px;
  }
  .main-pane {
    height: auto;
    overflow: visible;
  }
  .main-tabs,
  .main-tabs :deep(.n-tabs-pane-wrapper),
  .main-tabs :deep(.n-tab-pane),
  .sku-spin,
  .sku-spin :deep(.n-spin-content) {
    overflow: visible;
  }
  .grid-body {
    overflow: visible;
  }
  .grid-head,
  .grid-row {
    grid-template-columns: 30px minmax(0, 1fr) 120px 60px;
  }
  .grid-head .col-cat,
  .grid-head .col-unit,
  .grid-head .col-src,
  .grid-row .col-cat,
  .grid-row .col-unit,
  .grid-row .col-src {
    display: none;
  }
  .save-bar {
    min-width: 0;
    width: calc(100% - 32px);
  }
}
</style>
