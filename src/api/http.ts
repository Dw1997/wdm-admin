// src/api/http.ts - Axios wrapper with auth header, error handling, mock toggle.
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { createDiscreteApi } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { mockAdapter } from '@/api/mock'

const { message } = createDiscreteApi(['message'])

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const useMock = !import.meta.env.VITE_API_BASE_URL

export const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

if (useMock) {
  http.defaults.adapter = mockAdapter
}

http.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`
  }
  return config
})

http.interceptors.response.use(
  (resp) => {
    // Backend wraps every /api/v1 JSON response in {code, message, data}; unwrap to data.
    const body = resp.data as Record<string, unknown> | null | undefined
    if (body && typeof body === 'object' && typeof body.code === 'number' && 'data' in body) {
      return body.data
    }
    return resp.data
  },
  (error) => {
    const status = error?.response?.status
    const detail = error?.response?.data?.detail || error?.response?.data?.message || error.message
    const url = error.config?.url || ''
    if (status === 401) {
      const auth = useAuthStore()
      if (url.includes('/auth/login')) {
        return Promise.reject(error)
      }
      if (url.includes('/auth/logout')) {
        auth.clearSession()
      } else {
        auth.logout()
        message.error('登录已过期，请重新登录')
        window.location.href = '/login'
      }
    } else if (status === 403) {
      message.error('没有权限')
    } else if (status && status >= 500) {
      message.error(`服务异常 (${status})`)
    } else if (detail) {
      message.error(String(detail))
    } else {
      message.error('网络异常')
    }
    return Promise.reject(error)
  },
)

export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return http.get<T, T>(url, config) as unknown as Promise<T>
}

export async function post<T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> {
  return http.post<T, T>(url, data, config) as unknown as Promise<T>
}

export async function put<T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> {
  return http.put<T, T>(url, data, config) as unknown as Promise<T>
}

export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return http.delete<T, T>(url, config) as unknown as Promise<T>
}
