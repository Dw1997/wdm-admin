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

/** 金额字符串按整元显示（看板用），带千分位；非法值显示 ¥0 */
export function formatYuan(n: number | string | undefined | null): string {
  const num = Number(n)
  if (n === undefined || n === null || n === '' || Number.isNaN(num)) return '¥0'
  const sign = num < 0 ? '-' : ''
  return sign + '¥' + Math.abs(Math.round(num)).toLocaleString('zh-CN')
}

/** 建议零售价：按 SKU 的成本价与定价规则计算（管理员视角，规则见 05 价格体系设计） */
export function calcSuggestedPrice(sku: {
  cost_price?: number | string | null
  price_method?: string | null
  price_value?: number | string | null
}): number {
  const base = Number(sku.cost_price) || 0
  const value = Number(sku.price_value) || 0
  const raw = sku.price_method === 'amount' ? base + value : base * (1 + value / 100)
  return Math.max(raw, 0)
}
