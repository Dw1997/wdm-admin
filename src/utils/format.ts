// src/utils/format.ts
import dayjs from 'dayjs'

export function formatMoney(n: number | string | undefined | null, withSymbol = true): string {
  if (n === undefined || n === null || n === '') return withSymbol ? '¥0.00' : '0.00'
  const num = Number(n)
  if (Number.isNaN(num)) return withSymbol ? '¥0.00' : '0.00'
  return (withSymbol ? '¥' : '') + num.toFixed(2)
}

export function formatQty(n: number | undefined | null): string {
  if (n === undefined || n === null) return '0'
  return Number(n).toLocaleString('zh-CN')
}

export function formatDate(s: string | undefined | null, fmt = 'YYYY-MM-DD HH:mm'): string {
  if (!s) return '-'
  return dayjs(s).format(fmt)
}

export function relativeTime(s: string | undefined | null): string {
  if (!s) return '-'
  const diff = dayjs().diff(dayjs(s), 'day')
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff < 7) return `${diff} 天前`
  if (diff < 30) return `${Math.floor(diff / 7)} 周前`
  return dayjs(s).format('YYYY-MM-DD')
}

export function formatPhone(phone: string | undefined): string {
  if (!phone) return ''
  if (phone.length === 11) return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3')
  return phone
}
