<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">
        <div class="brand-mark">副</div>
        <h1 class="brand-title">副食批发平台</h1>
        <p class="brand-sub">管理端 · Admin Console</p>
      </div>
      <n-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="onSubmit">
        <n-form-item path="username" label="账号">
          <n-input v-model:value="form.username" placeholder="请输入账号" />
        </n-form-item>
        <n-form-item path="password" label="密码">
          <n-input v-model:value="form.password" type="password" show-password-on="click" placeholder="请输入密码" />
        </n-form-item>
        <n-alert v-if="errorMsg" type="error" :bordered="false" style="margin-bottom: 12px">{{ errorMsg }}</n-alert>
        <n-button type="primary" block :loading="loading" attr-type="submit">登录</n-button>
      </n-form>
      <div class="tips"><span>演示账号：admin / 任意 6 位以上密码</span></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage, type FormInst, type FormRules } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const message = useMessage()
const formRef = ref<FormInst>()
const loading = ref(false)
const errorMsg = ref('')
const form = reactive({ username: 'admin', password: '123456' })
const rules: FormRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
}

async function onSubmit() {
  if (loading.value) return
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch { return }
  loading.value = true
  errorMsg.value = ''
  try {
    await auth.login(form.username, form.password)
    message.success('登录成功')
    router.push((route.query.redirect as string) || '/dashboard')
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.detail || e?.response?.data?.message || '登录失败，请检查账号或密码'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #b91c1c, #dc2626, #ef4444); padding: 40rpx;
}
.login-card { width: 400px; max-width: 90vw; background: #fff; border-radius: 16px; padding: 48px 40px; box-shadow: 0 20rpx 60rpx rgba(0,0,0,0.2); }
.brand { text-align: center; margin-bottom: 40px; }
.brand-mark { width: 80px; height: 80px; background: #dc2626; color: #fff; font-size: 40px; font-weight: 700; border-radius: 16px; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; }
.brand-title { font-size: 24px; font-weight: 600; margin: 0; }
.brand-sub { color: #9ca3af; font-size: 13px; margin: 4px 0 0; }
.tips { text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af; padding-top: 16px; border-top: 1px dashed #e5e7eb; }
</style>
