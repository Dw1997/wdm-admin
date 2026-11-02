// src/utils/dict.ts - Static dictionary / enum label helpers.
import type { OrderStatus, PaymentMethod, CustomerStatus, CustomerLevel, ProductStatus, PriceStrategyType, CustomerLevelType, PriceAdjustmentType, PriceMethod, PriceChannelType, PriceSource, VendorType, VendorStatus } from '@/types'

export const ORDER_STATUS: Record<OrderStatus, { label: string; type: 'primary' | 'success' | 'warning' | 'info' | 'danger' }> = {
  pending_audit: { label: '待审核', type: 'warning' },
  rejected: { label: '已驳回', type: 'danger' },
  paid: { label: '待分拣', type: 'primary' },
  picking: { label: '分拣中', type: 'primary' },
  shipped: { label: '已发货', type: 'success' },
  completed: { label: '已完成', type: 'success' },
  cancelled: { label: '已取消', type: 'info' },
}

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  online: '在线支付',
  credit: '账期挂账',
  wechat: '微信',
  alipay: '支付宝',
  cash: '现金',
  bank: '对公转账',
}

export const CUSTOMER_STATUS: Record<CustomerStatus, { label: string; type: 'primary' | 'success' | 'warning' | 'info' | 'danger' }> = {
  pending: { label: '待审核', type: 'warning' },
  active: { label: '正常', type: 'success' },
  disabled: { label: '已禁用', type: 'danger' },
}

export const CUSTOMER_LEVEL: Record<CustomerLevel, { label: string; type: string }> = {
  bronze: { label: '青铜', type: 'info' },
  silver: { label: '白银', type: 'info' },
  gold: { label: '黄金', type: 'warning' },
  vip: { label: 'VIP', type: 'danger' },
}

export const CUSTOMER_LEVEL_TYPE: Record<CustomerLevelType, { label: string; type: 'primary' | 'default' }> = {
  retail: { label: '零售', type: 'default' },
  wholesale: { label: '批发', type: 'primary' },
}

export const PRICE_ADJUSTMENT_TYPE: Record<PriceAdjustmentType, string> = {
  percent: '百分比浮动',
  amount: '固定金额加减',
}

export const PRODUCT_STATUS: Record<ProductStatus, { label: string; type: 'primary' | 'success' | 'warning' | 'info' | 'danger' }> = {
  on_sale: { label: '在售', type: 'success' },
  off_shelf: { label: '下架', type: 'info' },
  draft: { label: '草稿', type: 'warning' },
}

export const PRICE_STRATEGY_TYPE: Record<PriceStrategyType, { label: string; type: string; color: string }> = {
  tier: { label: '等级价', type: 'primary', color: '#409EFF' },
  customer: { label: '客户专属价', type: 'success', color: '#67C23A' },
  ladder: { label: '阶梯价', type: 'warning', color: '#E6A23C' },
  flash: { label: '限时特价', type: 'danger', color: '#F56C6C' },
}

export const PRICE_METHOD: Record<PriceMethod, string> = {
  percent: '百分比 (%)',
  amount: '固定金额 (元)',
}

export const PRICE_CHANNEL_TYPE: Record<PriceChannelType, { label: string; type: 'primary' | 'warning' }> = {
  county_wholesale: { label: '县城批发', type: 'primary' },
  street_vendor: { label: '游商快批', type: 'warning' },
}

export const PRICE_SOURCE: Record<PriceSource, { label: string; type: 'success' | 'primary' | 'info' | 'default' }> = {
  customer_fixed: { label: '客户专属价', type: 'success' },
  level_sku: { label: '等级SKU价', type: 'primary' },
  level_default: { label: '等级默认价', type: 'info' },
  suggested: { label: '建议零售价', type: 'default' },
}

export const RULE_SOURCE: Record<'sku' | 'level' | 'none', string> = {
  sku: 'SKU专属规则',
  level: '等级默认规则',
  none: '无规则',
}

// ---------- 供应商 ----------
export const VENDOR_TYPE: Record<VendorType, string> = {
  market: '市场店家',
  origin: '产地',
  manufacturer: '厂家',
}
export const VENDOR_TYPE_OPTIONS = (Object.keys(VENDOR_TYPE) as VendorType[]).map((value) => ({ label: VENDOR_TYPE[value], value }))
export const vendorTypeLabel = (t: string) => VENDOR_TYPE[t as VendorType] || t

export const VENDOR_STATUS: Record<VendorStatus, { label: string; type: 'success' | 'warning' | 'error' }> = {
  active: { label: '正常', type: 'success' },
  order_disabled: { label: '禁止下单', type: 'warning' },
  login_disabled: { label: '禁止登录', type: 'error' },
}
export const VENDOR_STATUS_OPTIONS = (Object.keys(VENDOR_STATUS) as VendorStatus[]).map((value) => ({ label: VENDOR_STATUS[value].label, value }))
export const vendorStatusMeta = (s: string) => VENDOR_STATUS[s as VendorStatus] || { label: s, type: 'error' as const }
