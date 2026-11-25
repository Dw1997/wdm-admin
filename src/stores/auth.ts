// src/stores/auth.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'
import type { UserInfo } from '@/types'

const ACCESS_KEY = 'wdm_admin_access'
const REFRESH_KEY = 'wdm_admin_refresh'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string>(localStorage.getItem(ACCESS_KEY) || '')
  const refreshToken = ref<string>(localStorage.getItem(REFRESH_KEY) || '')
  const user = ref<UserInfo | null>(null)

  const isLoggedIn = computed(() => !!accessToken.value)

  const userInitial = computed(() => {
    const name = user.value?.real_name || user.value?.username || ''
    return name ? name.charAt(0).toUpperCase() : '管'
  })

  function setTokens(newAccessToken: string, newRefreshToken?: string) {
    accessToken.value = newAccessToken
    localStorage.setItem(ACCESS_KEY, newAccessToken)
    if (newRefreshToken) {
      refreshToken.value = newRefreshToken
      localStorage.setItem(REFRESH_KEY, newRefreshToken)
    }
  }

  async function login(username: string, password: string) {
    const tokens = await authApi.login(username, password)
    setTokens(tokens.access_token, tokens.refresh_token)
    await fetchMe()
  }

  async function fetchMe() {
    try {
      user.value = await authApi.me()
    } catch {
      // No mock fallback: leave user empty on failure (401 is handled by the http interceptor).
      user.value = null
    }
  }

  function clearSession() {
    accessToken.value = ''
    refreshToken.value = ''
    user.value = null
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch {
      /* ignore */
    }
    clearSession()
  }

  return { accessToken, refreshToken, user, isLoggedIn, userInitial, login, logout, clearSession, fetchMe, setTokens }
})
