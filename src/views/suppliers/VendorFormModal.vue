<template>
  <n-modal
    :show="show"
    preset="card"
    :title="title"
    :mask-closable="false"
    :close-on-esc="false"
    :on-close="onCancel"
    style="width: 680px; max-width: calc(100vw - 32px)"
  >
    <n-spin :show="loading">
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="left" label-width="84">
        <div class="section-title">基本信息</div>
        <n-grid :cols="2" :x-gap="24">
          <n-gi :span="2">
            <n-form-item label="供应商名称" path="name">
              <n-input v-model:value="form.name" maxlength="100" placeholder="请输入供应商名称" />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="类型" path="type">
              <n-radio-group v-model:value="form.type">
                <n-radio-button v-for="o in typeOpts" :key="o.value" :value="o.value">{{ o.label }}</n-radio-button>
              </n-radio-group>
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="状态" path="status">
              <n-select v-model:value="form.status" :options="statusOpts" />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="手机号" path="phone">
              <n-input ref="phoneRef" v-model:value="form.phone" maxlength="11" placeholder="选填，全局唯一" />
            </n-form-item>
          </n-gi>
          <n-gi v-if="isEdit">
            <n-form-item label="微信绑定">
              <n-tag size="small" :type="original?.wechat_bound ? 'success' : 'default'">
                {{ original?.wechat_bound ? '已绑定' : '未绑定' }}
              </n-tag>
            </n-form-item>
          </n-gi>
        </n-grid>

        <div class="section-title">联系人与地址</div>
        <n-grid :cols="2" :x-gap="24">
          <n-gi>
            <n-form-item label="联系人" path="contact_name">
              <n-input v-model:value="form.contact_name" maxlength="50" placeholder="选填" />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="联系电话" path="contact_phone">
              <n-input v-model:value="form.contact_phone" maxlength="20" placeholder="选填" />
            </n-form-item>
          </n-gi>
          <n-gi :span="2">
            <n-form-item label="所在地区">
              <RegionPicker
                v-model:value="regionValue"
                :fallback-label="[form.province, form.city, form.district, form.town].filter(Boolean).join(' / ')"
                @change="applyRegion"
              />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="镇 / 市场" path="town">
              <n-input v-model:value="form.town" maxlength="100" placeholder="选填" />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="详细地址" path="detail_address">
              <n-input v-model:value="form.detail_address" maxlength="255" placeholder="选填" />
            </n-form-item>
          </n-gi>
        </n-grid>
      </n-form>
    </n-spin>

    <template #footer>
      <div class="footer">
        <span v-if="isEdit && original" class="meta">
          创建：{{ formatDate(original.created_at) || '—' }}　修改：{{ formatDate(original.updated_at) || '—' }}
        </span>
        <n-space>
          <n-button @click="onCancel">取消</n-button>
          <n-button type="primary" :loading="saving" :disabled="loading" @click="onSave">保存</n-button>
        </n-space>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useDialog, useMessage, type FormInst, type FormRules } from 'naive-ui'
import { vendorApi } from '@/api'
import { VENDOR_STATUS_OPTIONS, VENDOR_TYPE_OPTIONS } from '@/utils/dict'
import { formatDate } from '@/utils/format'
import type { RegionSelection, Vendor, VendorPayload } from '@/types'
import RegionPicker from '@/components/RegionPicker.vue'

// vendorId 为空表示新建；有值表示编辑该供应商
const props = defineProps<{ show: boolean; vendorId: number | null }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void; (e: 'saved'): void }>()

const message = useMessage()
const dialog = useDialog()

const isEdit = computed(() => props.vendorId !== null)
const title = computed(() => (isEdit.value ? `编辑供应商${original.value ? ' · ' + original.value.name : ''}` : '新建供应商'))

const typeOpts = VENDOR_TYPE_OPTIONS
const statusOpts = VENDOR_STATUS_OPTIONS

type FormState = {
  name: string
  type: string
  phone: string
  status: string
  contact_name: string
  contact_phone: string
  province: string
  city: string
  district: string
  town: string
  detail_address: string
}

const emptyForm = (): FormState => ({
  name: '', type: 'market', phone: '', status: 'active', contact_name: '', contact_phone: '',
  province: '', city: '', district: '', town: '', detail_address: '',
})

const formRef = ref<FormInst | null>(null)
const phoneRef = ref<{ focus: () => void } | null>(null)
const form = reactive<FormState>(emptyForm())
const original = ref<Vendor | null>(null)
let snapshot = JSON.stringify(emptyForm())
const loading = ref(false)
const saving = ref(false)

const rules: FormRules = {
  name: [{ required: true, message: '请输入供应商名称', trigger: ['blur', 'input'] }],
  phone: [{ pattern: /^1[3-9]\d{9}$/, message: '请输入 11 位手机号', trigger: 'blur' }],
}

// ---- 省/市/县/乡镇选择 ----
const regionValue = ref<number | null>(null)

function applyRegion(sel: RegionSelection | null) {
  form.province = sel?.province || ''
  form.city = sel?.city || ''
  form.district = sel?.district || ''
  if (sel?.town) form.town = sel.town
  else if (!sel) form.town = ''
}

// ---- 打开时重置 / 回填 ----
function fill(v: Vendor) {
  original.value = v
  Object.assign(form, {
    name: v.name, type: v.type, phone: v.phone || '', status: v.status,
    contact_name: v.contact_name || '', contact_phone: v.contact_phone || '',
    province: v.province || '', city: v.city || '', district: v.district || '',
    town: v.town || '', detail_address: v.detail_address || '',
  })
  regionValue.value = null
  snapshot = JSON.stringify(form)
}

function close() {
  emit('update:show', false)
}

async function open() {
  original.value = null
  Object.assign(form, emptyForm())
  regionValue.value = null
  snapshot = JSON.stringify(form)
  formRef.value?.restoreValidation()
  loading.value = true
  try {
    if (props.vendorId !== null) fill(await vendorApi.get(props.vendorId))
  } catch (e: any) {
    if (e?.response?.status === 404) {
      message.error('供应商不存在')
      close()
      emit('saved') // 让列表刷新，去掉已不存在的行
    }
  } finally {
    loading.value = false
  }
}

watch(() => props.show, (v) => { if (v) open() })

// ---- 保存 ----
const NULLABLE: (keyof FormState)[] = ['phone', 'contact_name', 'contact_phone', 'province', 'city', 'district', 'town', 'detail_address']

function valueOf(key: keyof FormState): string | null {
  const v = (form[key] ?? '').trim()
  return NULLABLE.includes(key) && v === '' ? null : v
}

function buildPayload(): VendorPayload {
  const keys = Object.keys(emptyForm()) as (keyof FormState)[]
  if (!isEdit.value || !original.value) {
    return Object.fromEntries(keys.map((k) => [k, valueOf(k)]).filter(([, v]) => v !== null)) as VendorPayload
  }
  const base = original.value as unknown as Record<string, string | null>
  const diff: Record<string, string | null> = {}
  for (const k of keys) {
    const now = valueOf(k)
    if (now !== (base[k] ?? null)) diff[k] = now
  }
  return diff as VendorPayload
}

const isDirty = () => JSON.stringify(form) !== snapshot

async function onSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const payload = buildPayload()
  if (isEdit.value && Object.keys(payload).length === 0) {
    message.info('没有修改')
    return
  }
  const doSave = async () => {
    saving.value = true
    try {
      if (isEdit.value) await vendorApi.update(props.vendorId as number, payload)
      else await vendorApi.create(payload)
      message.success(isEdit.value ? '保存成功' : '创建成功')
      close()
      emit('saved')
    } catch (e: any) {
      if (e?.response?.status === 409) phoneRef.value?.focus()
    } finally {
      saving.value = false
    }
  }
  if (isEdit.value && 'phone' in payload && original.value?.wechat_bound) {
    dialog.warning({
      title: '修改手机号',
      content: '修改后供应商仍用已绑定的微信登录，但新手机号不能与其他供应商重复。',
      positiveText: '确认修改',
      negativeText: '取消',
      onPositiveClick: doSave,
    })
  } else {
    await doSave()
  }
}

function onCancel() {
  if (!isDirty()) return close()
  dialog.warning({
    title: '有未保存的修改',
    content: '关闭后修改的内容将丢失，确认关闭？',
    positiveText: '关闭',
    negativeText: '继续编辑',
    onPositiveClick: close,
  })
}
</script>

<style scoped>
.section-title { margin: 0 0 12px; font-size: 14px; font-weight: 600; }
.section-title:not(:first-child) { margin-top: 8px; }
.footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.meta { color: #909399; font-size: 12px; }
</style>
