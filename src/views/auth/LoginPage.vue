<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">
        <div class="brand-mark">副</div>
        <h1 class="brand-title">味都美副食批零</h1>
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
const form = reactive({ username: '', password: '' })
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
  background:
    radial-gradient(900px 500px at 15% 10%, rgba(99, 102, 241, 0.18), transparent 60%),
    radial-gradient(800px 500px at 90% 90%, rgba(129, 140, 248, 0.16), transparent 60%),
    var(--bg-page);
  padding: 24px; position: relative;
}
.login-card {
  position: relative; width: 400px; max-width: 100%; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: 16px; padding: 44px 40px;
  box-shadow: 0 24px 60px rgba(16, 24, 40, 0.12);
}
.brand { text-align: center; margin-bottom: 32px; }
.brand-mark {
  width: 56px; height: 56px; background: linear-gradient(135deg, #4f46e5, #818cf8); color: #fff;
  font-size: 28px; font-weight: 700; border-radius: 16px; margin: 0 auto 14px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.35);
}
.brand-title { font-size: 22px; font-weight: 600; margin: 0; }
.brand-sub { color: var(--text-3); font-size: 13px; margin: 6px 0 0; }
</style>
