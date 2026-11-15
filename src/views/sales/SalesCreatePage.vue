<template>
  <div class="page-container">
    <div class="card-section" style="max-width: 640px">
      <div class="page-header"><h2 class="page-title">新建销售</h2></div>
      <n-alert type="info" :bordered="false" style="margin-bottom: 20px">销售使用手机号和密码登录移动端，推广码由系统生成。</n-alert>
      <n-form :model="form" label-placement="left" label-width="100">
        <n-form-item label="姓名" required><n-input v-model:value="form.real_name" maxlength="50" placeholder="请输入销售姓名" /></n-form-item>
        <n-form-item label="手机号" required><n-input v-model:value="form.phone" maxlength="11" placeholder="请输入登录手机号" /></n-form-item>
        <n-form-item label="提成比例" required><n-input v-model:value="form.commissionPercent" placeholder="例如 5 表示 5%"><template #suffix>%</template></n-input></n-form-item>
        <n-form-item label="初始密码" required><n-input v-model:value="form.password" type="password" show-password-on="click" placeholder="至少 6 位" /></n-form-item>
        <n-form-item label="确认密码" required><n-input v-model:value="form.confirmPassword" type="password" show-password-on="click" /></n-form-item>
      </n-form>
      <div style="display: flex; justify-content: flex-end; gap: 12px">
        <n-button @click="router.push('/sales/list')">取消</n-button>
        <n-button type="primary" :loading="saving" @click="createSales">创建销售</n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { accountApi, roleApi } from '@/api'

const router = useRouter()
const message = useMessage()
const saving = ref(false)
const salesRoleId = ref<number | null>(null)
const form = reactive({ real_name: '', phone: '', commissionPercent: '', password: '', confirmPassword: '' })

onMounted(async () => {
  const roles = await roleApi.list()
  salesRoleId.value = roles.find((role) => role.code === 'sales' && role.is_active)?.id ?? null
})

async function createSales() {
  if (!form.real_name.trim() || !/^1[3-9]\d{9}$/.test(form.phone)) {
    message.warning('请填写姓名和正确的手机号')
    return
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(form.commissionPercent) || Number(form.commissionPercent) > 100) {
    message.warning('提成比例请填写 0 至 100，最多两位小数')
    return
  }
  if (form.password.length < 6 || form.password !== form.confirmPassword) {
    message.warning('密码至少 6 位，且两次输入必须一致')
    return
  }
  if (!salesRoleId.value) {
    message.error('销售角色未启用，请联系管理员')
    return
  }
  saving.value = true
  try {
    await accountApi.create({
      username: form.phone,
      phone: form.phone,
      commission_rate: (Number(form.commissionPercent) / 100).toFixed(4),
      real_name: form.real_name.trim(),
      password: form.password,
      role_id: salesRoleId.value,
      is_active: true,
    })
    message.success('销售已创建')
    await router.push('/sales/list')
  } finally {
    saving.value = false
  }
}
</script>
