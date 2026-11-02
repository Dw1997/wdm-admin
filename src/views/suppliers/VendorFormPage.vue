<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">{{ isEdit ? `编辑供应商${original ? ' · ' + original.name : ''}` : '新建供应商' }}</h2>
      <div class="header-actions">
        <n-button @click="router.push('/suppliers/list')">{{ isEdit ? '返回列表' : '取消' }}</n-button>
        <n-button type="primary" :loading="saving" :disabled="loading" @click="onSave">保存</n-button>
      </div>
    </div>

    <n-spin :show="loading">
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="left" label-width="84" class="vendor-form">
        <div class="card-section">
          <h3 class="section-title">基本信息</h3>
          <n-grid :cols="2" :x-gap="32">
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
              <n-form-item label="微信绑定" :show-feedback="false">
                <n-tag size="small" :type="original?.wechat_bound ? 'success' : 'default'">
                  {{ original?.wechat_bound ? '已绑定' : '未绑定' }}
                </n-tag>
              </n-form-item>
            </n-gi>
          </n-grid>
          <div class="hint">手机号用于供应商登录小程序时匹配身份。</div>
        </div>

        <div class="card-section">
          <h3 class="section-title">联系人与地址</h3>
          <n-grid :cols="2" :x-gap="32">
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
              <n-form-item label="省 / 市 / 区" :show-feedback="false" class="tight">
                <n-cascader
                  v-model:value="regionValue"
                  :options="regionCascaderOptions"
                  clearable
                  placeholder="请选择省市区"
                  @update:value="applyRegion"
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
        </div>

        <div v-if="isEdit && original" class="meta">
          创建时间：{{ formatDate(original.created_at) || '—' }}　最后修改：{{ formatDate(original.updated_at) || '—' }}
        </div>
      </n-form>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useDialog, useMessage, type FormInst, type FormRules } from 'naive-ui'
import { vendorApi, regionApi } from '@/api'
import { VENDOR_STATUS_OPTIONS, VENDOR_TYPE_OPTIONS } from '@/utils/dict'
import { formatDate } from '@/utils/format'
import type { RegionNode, Vendor, VendorPayload } from '@/types'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const id = computed(() => (route.params.id ? Number(route.params.id) : null))
const isEdit = computed(() => id.value !== null)

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

// ---- 省市区级联 ----
const regionOptions = ref<RegionNode[]>([])
const regionValue = ref<number | null>(null)

function mapRegion(node: RegionNode): any {
  return { label: node.name, value: node.id, children: node.children?.length ? node.children.map(mapRegion) : undefined }
}
const regionCascaderOptions = computed(() => regionOptions.value.map(mapRegion))

function findRegionPath(nodes: RegionNode[], target: number, path: RegionNode[] = []): RegionNode[] | null {
  for (const node of nodes) {
    const p = [...path, node]
    if (node.id === target) return p
    if (node.children) {
      const found = findRegionPath(node.children, target, p)
      if (found) return found
    }
  }
  return null
}

function applyRegion() {
  const path = regionValue.value == null ? [] : findRegionPath(regionOptions.value, Number(regionValue.value)) || []
  form.province = path[0]?.name || ''
  form.city = path[1]?.name || ''
  form.district = path[2]?.name || ''
}

function regionIdByNames(province: string, city: string, district: string): number | null {
  const p = regionOptions.value.find((n) => n.name === province)
  if (!p) return null
  const c = city ? p.children?.find((n) => n.name === city) : null
  if (!c) return p.id
  const d = district ? c.children?.find((n) => n.name === district) : null
  return (d || c).id
}

// ---- 加载与回填 ----
function fill(v: Vendor) {
  original.value = v
  Object.assign(form, {
    name: v.name, type: v.type, phone: v.phone || '', status: v.status,
    contact_name: v.contact_name || '', contact_phone: v.contact_phone || '',
    province: v.province || '', city: v.city || '', district: v.district || '',
    town: v.town || '', detail_address: v.detail_address || '',
  })
  regionValue.value = v.province ? regionIdByNames(v.province, v.city || '', v.district || '') : null
  snapshot = JSON.stringify(form)
}

onMounted(async () => {
  loading.value = true
  try {
    regionOptions.value = await regionApi.tree()
    if (isEdit.value) {
      try {
        fill(await vendorApi.get(id.value as number))
      } catch (e: any) {
        if (e?.response?.status === 404) {
          message.error('供应商不存在')
          router.replace('/suppliers/list')
        }
        return
      }
    }
  } finally {
    loading.value = false
  }
})

// ---- 保存 ----
const NULLABLE: (keyof FormState)[] = ['phone', 'contact_name', 'contact_phone', 'province', 'city', 'district', 'town', 'detail_address']

function valueOf(key: keyof FormState): string | null {
  const v = (form[key] ?? '').trim()
  return NULLABLE.includes(key) && v === '' ? null : v
}

function buildPayload(): VendorPayload {
  const keys = Object.keys(emptyForm()) as (keyof FormState)[]
  if (!isEdit.value || !original.value) {
    return Object.fromEntries(keys.map((k) => [k, valueOf(k)]).filter(([k, v]) => v !== null || k === 'phone')) as VendorPayload
  }
  const base = original.value as unknown as Record<string, string | null>
  const diff: Record<string, string | null> = {}
  for (const k of keys) {
    const now = valueOf(k)
    if (now !== (base[k] ?? null)) diff[k] = now
  }
  return diff as VendorPayload
}

function isDirty() {
  return JSON.stringify(form) !== snapshot
}

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
      if (isEdit.value) {
        fill(await vendorApi.update(id.value as number, payload))
        message.success('保存成功')
      } else {
        await vendorApi.create(payload)
        allowLeave = true
        message.success('创建成功')
        router.push('/suppliers/list')
      }
    } catch (e: any) {
      if (e?.response?.status === 409) phoneRef.value?.focus()
    } finally {
      saving.value = false
    }
  }
  const phoneChanged = isEdit.value && 'phone' in payload && original.value?.wechat_bound
  if (phoneChanged) {
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

// 有未保存修改时拦截离开：先取消本次跳转，确认后放行标志置位再重新跳转（避免挂起的导航被后续跳转取消）
let allowLeave = false
let confirming = false
onBeforeRouteLeave((to) => {
  if (allowLeave || !isDirty()) return true
  if (confirming) return false
  confirming = true
  dialog.warning({
    title: '有未保存的修改',
    content: '离开后修改的内容将丢失，确认离开？',
    positiveText: '离开',
    negativeText: '留下',
    onPositiveClick: () => {
      confirming = false
      allowLeave = true
      router.push(to.fullPath)
    },
    onNegativeClick: () => { confirming = false },
    onClose: () => { confirming = false },
    onMaskClick: () => { confirming = false },
  })
  return false
})
</script>

<style scoped>
.vendor-form { max-width: 880px; }
.header-actions { display: flex; gap: 8px; }
.section-title { margin: 0 0 16px; font-size: 15px; font-weight: 600; }
.hint { margin: -4px 0 0 84px; color: #909399; font-size: 12px; }
.meta { color: #909399; font-size: 12px; padding: 0 4px; }
.vendor-form :deep(.card-section) { margin-bottom: 16px; }
</style>
