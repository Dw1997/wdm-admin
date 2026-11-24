// src/utils/auditFormat.ts
// 操作审计页面复用的字典与纯函数（标签、筛选选项、JSON 解析、变更摘要）

export type LabelOption = {
  label: string
  value: string
}

// ---------- 角色 ----------
export const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  sales: '销售',
  customer: '客户',
  system: '系统',
}

export const ROLE_OPTIONS: LabelOption[] = Object.entries(ROLE_LABELS).map(([value, label]) => ({
  label,
  value,
}))

// ---------- 目标类型 ----------
export const TARGET_LABELS: Record<string, string> = {
  order: '订单',
  customer: '客户',
  customer_sku_price: '客户固定价',
  level_price: '等级价',
  level: '客户等级',
  customer_tag: '客户标签',
  spu: '商品',
  sku: '商品规格',
  product: '商品',
  price: '价格',
  category: '商品分类',
  stock: '库存',
  return_order: '退货单',
  return_settlement: '退货结算',
  payment: '收款单',
  ledger_offset: '往来冲抵',
  credit_application: '额度申请',
  order_price_adjustment: '订单调价',
  delivery_note: '配送单',
  route_trip: '配送趟次',
  route_template: '常用路线',
  route_trip_call: '拜访/询单',
  freight_line: '物流线路',
  county_corridor: '县域走廊',
  purchase_receipt: '采购入库',
  purchase_return: '采购退货',
  vendor_payment: '供应商付款',
  operating_expense: '经营支出',
  commission_setting: '提成设置',
  commission_settlement: '提成结算',
  sales: '销售',
  coupon_template: '优惠券模板',
  customer_coupon: '客户优惠券',
  referral_reward: '推荐奖励',
  system_setting: '系统参数',
}

// 按高频业务排序，供筛选下拉使用
export const TARGET_OPTIONS: LabelOption[] = [
  'order',
  'customer',
  'payment',
  'return_order',
  'customer_sku_price',
  'level_price',
  'spu',
  'sku',
  'product',
  'price',
  'category',
  'stock',
  'return_settlement',
  'ledger_offset',
  'credit_application',
  'order_price_adjustment',
  'delivery_note',
  'route_trip',
  'route_template',
  'route_trip_call',
  'freight_line',
  'county_corridor',
  'purchase_receipt',
  'purchase_return',
  'vendor_payment',
  'operating_expense',
  'commission_setting',
  'commission_settlement',
  'sales',
  'coupon_template',
  'customer_coupon',
  'referral_reward',
  'system_setting',
  'level',
  'customer_tag',
].map((value) => ({ value, label: TARGET_LABELS[value] ?? value }))

// ---------- 动作 ----------
export const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  approve: '审核通过',
  auto_approve: '自动通过',
  reject: '驳回',
  audit_approve: '审核通过',
  audit_reject: '审核驳回',
  cancel: '取消',
  confirm: '确认',
  correct: '更正',
  deliver: '送达',
  depart: '发车',
  finish: '完成',
  merge: '合并',
  pay: '收款',
  reschedule: '改期',
  change_sales: '变更归属销售',
  set_credit: '设置授信',
  unbind_wechat: '解绑微信',
  print: '打印',
  submit: '提交',
  adjust: '调整',
  price_adjust: '调价',
  reverse: '冲销',
  'return.create': '创建退货单',
  'return.confirm': '确认退货',
  'return.reject': '驳回退货',
  'return.settle': '退货结算',
  'return.print': '打印退货单',
  'payment.create': '创建收款单',
  'operating_expense.create': '创建经营支出',
  'operating_expense.update': '更新经营支出',
  'operating_expense.delete': '删除经营支出',
  'commission.settle': '提成结算',
  'commission.revoke': '撤销提成',
  'commission_setting.update': '更新提成设置',
  coupon_template_create: '创建优惠券模板',
  coupon_template_update: '更新优惠券模板',
  coupon_template_status: '变更优惠券状态',
  coupon_issue: '发放优惠券',
  coupon_void: '作废优惠券',
  referral_reward_issue: '发放推荐奖励',
}

// 常用基础动作与复合动作优先，供筛选下拉使用
export const ACTION_OPTIONS: LabelOption[] = [
  'create',
  'update',
  'delete',
  'approve',
  'reject',
  'cancel',
  'confirm',
  'pay',
  'print',
  'adjust',
  'price_adjust',
  'submit',
  'deliver',
  'finish',
  'merge',
  'return.create',
  'return.confirm',
  'return.reject',
  'return.settle',
  'return.print',
  'payment.create',
  'operating_expense.create',
  'operating_expense.update',
  'operating_expense.delete',
  'commission.settle',
  'commission.revoke',
  'commission_setting.update',
  'coupon_template_create',
  'coupon_template_update',
  'coupon_template_status',
  'coupon_issue',
  'coupon_void',
  'referral_reward_issue',
].map((value) => ({ value, label: ACTION_LABELS[value] ?? value }))

export function getTargetLabel(targetType: string): string {
  return TARGET_LABELS[targetType] ?? targetType
}

export function getActionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action]
  const last = action.split(/[._]/).filter(Boolean).pop()
  if (last && ACTION_LABELS[last]) return ACTION_LABELS[last]
  return action
}

const TAG_ERROR = new Set(['delete', 'cancel', 'reject', 'void', 'unbind', 'reverse', 'revoke'])
const TAG_SUCCESS = new Set(['create', 'approve', 'confirm', 'pay', 'issue', 'settle'])
const TAG_INFO = new Set(['print', 'query', 'export', 'view'])

export function getActionTagType(action: string): 'success' | 'warning' | 'error' | 'info' {
  const tokens = action.toLowerCase().split(/[._]/).filter(Boolean)
  if (tokens.some((t) => TAG_ERROR.has(t))) return 'error'
  if (tokens.some((t) => TAG_SUCCESS.has(t))) return 'success'
  if (tokens.some((t) => TAG_INFO.has(t))) return 'info'
  return 'warning'
}

// ---------- 字段与值 ----------
/** 纯技术字段，不参与业务变更展示 */
const TECH_FIELDS = new Set([
  'id',
  'created_by',
  'created_by_name',
  'updated_by',
  'updated_by_name',
  'created_at',
  'updated_at',
])

export const FIELD_LABELS: Record<string, string> = {
  status: '状态',
  source: '来源',
  delivery_mode: '配送方式',
  total_amount: '总金额',
  amount: '金额',
  price: '售价',
  cost_price: '成本价',
  min_price: '最低价',
  level_price: '等级价',
  discount_amount: '优惠金额',
  freight_fee: '运费',
  quantity: '数量',
  phone: '手机号',
  address: '地址',
  name: '名称',
  real_name: '姓名',
  sales_id: '归属销售ID',
  sales_name: '归属销售',
  customer_id: '客户ID',
  customer_name: '客户',
  sku_id: 'SKU ID',
  spu_id: '商品ID',
  tag_id: '客户标签ID',
  level_id: '客户等级ID',
  credit_limit: '授信额度',
  credit_days: '账期(天)',
  is_active: '启用状态',
  remark: '备注',
  reason: '原因',
  call_result: '联系结果',
  rate: '提成比例',
  category_id: '分类ID',
}

export const VALUE_LABELS: Record<string, string> = {
  miniprogram: '小程序',
  phone_in: '电话/代下',
  admin: '管理端',
  sales: '销售端',
  local: '本地送',
  route: '路线送',
  freight: '物流发',
  pickup: '自提',
  pending_approval: '待审核',
  pending: '待配送',
  delivering: '配送中',
  delivered: '已送达',
  cancelled: '已取消',
  rejected: '已驳回',
  approved: '已通过',
  active: '正常',
  inactive: '停用',
  none: '未接通/无',
}

const MONEY_KEY_RE = /(amount|price|fee|limit|balance)/i

function isMoneyKey(key: string): boolean {
  return MONEY_KEY_RE.test(key) && !/_ids?$/.test(key)
}

function isNumeric(value: unknown): value is number | string {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim() !== '' && !Number.isNaN(Number(value))
  return false
}

function formatValue(key: string, value: unknown): string {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (isMoneyKey(key) && isNumeric(value)) return `¥${Number(value).toFixed(2)}`
  if (typeof value === 'string') return VALUE_LABELS[value] ?? value
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface ParsedSide {
  /** JSON 解析成功 */
  ok: boolean
  /** 解析后的值（ok 为 true 时有效） */
  value: unknown
  /** 格式化后的文本（缩进 2 空格；非 JSON 原样返回） */
  pretty: string
}

function parseSide(raw?: string | null): ParsedSide {
  if (raw === undefined || raw === null || raw.trim() === '') {
    return { ok: false, value: undefined, pretty: '' }
  }
  try {
    const value: unknown = JSON.parse(raw)
    return { ok: true, value, pretty: JSON.stringify(value, null, 2) }
  } catch {
    return { ok: false, value: undefined, pretty: raw }
  }
}

function visibleKeys(object: Record<string, unknown>): string[] {
  const keys = Object.keys(object)
  const filtered = keys.filter((key) => !TECH_FIELDS.has(key))
  return filtered.length ? filtered : keys
}

export interface AuditDiffItem {
  key: string
  label: string
  before: string
  after: string
  changed: boolean
}

export interface AuditDiffResult {
  items: AuditDiffItem[]
  isStructured: boolean
  beforePretty: string
  afterPretty: string
}

export function buildAuditDiff(
  beforeRaw?: string | null,
  afterRaw?: string | null,
): AuditDiffResult {
  const before = parseSide(beforeRaw)
  const after = parseSide(afterRaw)

  const beforeObj =
    before.ok && isPlainObject(before.value) ? before.value : undefined
  const afterObj = after.ok && isPlainObject(after.value) ? after.value : undefined
  // 解析成功但不是普通对象（数组、数字、字符串等），或非空但无法解析的文本
  const beforeOther = (before.ok && before.value !== null && !beforeObj) || (!before.ok && !!beforeRaw?.trim())
  const afterOther = (after.ok && after.value !== null && !afterObj) || (!after.ok && !!afterRaw?.trim())

  const isStructured = !beforeOther && !afterOther && (!!beforeObj || !!afterObj)

  const items: AuditDiffItem[] = []
  if (isStructured) {
    const keys = Array.from(
      new Set([...Object.keys(beforeObj ?? {}), ...Object.keys(afterObj ?? {})]),
    )
    const filtered = keys.filter((key) => !TECH_FIELDS.has(key))
    const visible = filtered.length ? filtered : keys
    for (const key of visible) {
      const beforeText = formatValue(key, beforeObj?.[key])
      const afterText = formatValue(key, afterObj?.[key])
      items.push({
        key,
        label: getFieldLabel(key),
        before: beforeText,
        after: afterText,
        changed: beforeText !== afterText,
      })
    }
  }

  return {
    items,
    isStructured,
    beforePretty: before.pretty,
    afterPretty: after.pretty,
  }
}

export interface ChangeSummary {
  kind: 'diff' | 'create' | 'delete' | 'raw' | 'empty'
  text: string
  fullText: string
}

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function buildChangeSummary(
  beforeRaw?: string | null,
  afterRaw?: string | null,
): ChangeSummary {
  const beforeText = beforeRaw?.trim() ?? ''
  const afterText = afterRaw?.trim() ?? ''
  if (!beforeText && !afterText) {
    return { kind: 'empty', text: '—', fullText: '—' }
  }

  const diff = buildAuditDiff(beforeRaw, afterRaw)
  if (diff.isStructured) {
    const beforeObj = parseSide(beforeRaw)
    const afterObj = parseSide(afterRaw)
    const hasBefore = beforeObj.ok && isPlainObject(beforeObj.value)
    const hasAfter = afterObj.ok && isPlainObject(afterObj.value)

    if (hasBefore && hasAfter) {
      const changed = diff.items.filter((item) => item.changed)
      const fullText = changed.length
        ? changed.map((item) => `${item.label}: ${item.before} → ${item.after}`).join(' · ')
        : '无变化'
      return { kind: 'diff', text: truncate(fullText), fullText }
    }

    if (hasAfter) {
      const obj = afterObj.value as Record<string, unknown>
      const fullText =
        visibleKeys(obj)
          .map((key) => `${getFieldLabel(key)}: ${formatValue(key, obj[key])}`)
          .join(' · ') || '—'
      return { kind: 'create', text: truncate(fullText), fullText }
    }

    const obj = beforeObj.value as Record<string, unknown>
    const fullText =
      visibleKeys(obj)
        .map((key) => `${getFieldLabel(key)}: ${formatValue(key, obj[key])}`)
        .join(' · ') || '—'
    return { kind: 'delete', text: truncate(fullText), fullText }
  }

  const fullText =
    beforeText && afterText ? `${beforeText} → ${afterText}` : beforeText || afterText
  return { kind: 'raw', text: truncate(fullText), fullText }
}
