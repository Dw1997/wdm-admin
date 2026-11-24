import { h, type Component, type VNodeChild } from 'vue'
import { NButton, NIcon, NPopconfirm, NTooltip } from 'naive-ui'
import {
  Ban,
  CircleCheck,
  DeviceFloppy,
  Edit,
  Eye,
  Key,
  Plus,
  Printer,
  Qrcode,
  ShieldLock,
  Trash,
} from '@vicons/tabler'

export type ActionIconKey =
  | 'view'
  | 'edit'
  | 'delete'
  | 'print'
  | 'add'
  | 'qrcode'
  | 'key'
  | 'disable'
  | 'enable'
  | 'permission'
  | 'save'

type ButtonType = 'default' | 'tertiary' | 'primary' | 'info' | 'success' | 'warning' | 'error'

const ICON_PRESETS: Record<ActionIconKey, { icon: Component; defaultLabel: string; defaultType: ButtonType }> = {
  view: { icon: Eye, defaultLabel: '查看', defaultType: 'primary' },
  edit: { icon: Edit, defaultLabel: '编辑', defaultType: 'primary' },
  delete: { icon: Trash, defaultLabel: '删除', defaultType: 'error' },
  print: { icon: Printer, defaultLabel: '打印', defaultType: 'default' },
  add: { icon: Plus, defaultLabel: '添加', defaultType: 'primary' },
  qrcode: { icon: Qrcode, defaultLabel: '推广码', defaultType: 'primary' },
  key: { icon: Key, defaultLabel: '重置密码', defaultType: 'primary' },
  disable: { icon: Ban, defaultLabel: '停用', defaultType: 'warning' },
  enable: { icon: CircleCheck, defaultLabel: '启用', defaultType: 'success' },
  permission: { icon: ShieldLock, defaultLabel: '权限配置', defaultType: 'primary' },
  save: { icon: DeviceFloppy, defaultLabel: '保存', defaultType: 'primary' },
}

export interface ActionIconOptions {
  /** 预设图标名 */
  icon: ActionIconKey
  /** 悬停提示文案，默认取预设中文名 */
  label?: string
  /** 按钮语义色，默认取预设语义色 */
  type?: ButtonType
  /** 图标像素大小，默认 17 */
  size?: number
  disabled?: boolean
  loading?: boolean
  /** 传入确认文案时自动包裹 NPopconfirm，点击确定后触发 onClick */
  confirm?: string
  /** 阻止点击事件冒泡（用于带行点击事件或树节点场景） */
  stopPropagation?: boolean
  onClick: () => void
}

/**
 * 渲染列表操作栏的纯图标按钮（统一带 NTooltip 悬停提示，可选 NPopconfirm 二次确认）
 */
export function actionIcon(opts: ActionIconOptions): VNodeChild {
  const preset = ICON_PRESETS[opts.icon]
  const label = opts.label ?? preset.defaultLabel
  const type = opts.type ?? preset.defaultType
  const iconSize = opts.size ?? 17

  const renderBtn = (withClick: boolean) =>
    h(
      NButton,
      {
        text: true,
        type,
        disabled: opts.disabled,
        loading: opts.loading,
        'aria-label': label,
        onClick: (e: MouseEvent) => {
          if (opts.stopPropagation) e.stopPropagation()
          if (withClick) opts.onClick()
        },
      },
      {
        icon: () => h(NIcon, { component: preset.icon, size: iconSize }),
      },
    )

  const withTooltip = (trigger: VNodeChild) =>
    h(
      NTooltip,
      { placement: 'top', delay: 150 },
      {
        trigger: () => trigger,
        default: () => label,
      },
    )

  if (opts.confirm && !opts.disabled) {
    return h(
      NPopconfirm,
      { onPositiveClick: () => opts.onClick() },
      {
        default: () => opts.confirm,
        trigger: () => withTooltip(renderBtn(false)),
      },
    )
  }

  return withTooltip(renderBtn(true))
}

export interface ActionBarOptions {
  /** 外层阻止点击事件冒泡 */
  stopPropagation?: boolean
  /** 对齐方式 */
  justify?: 'flex-start' | 'flex-end' | 'center'
  /** 按钮间距（px），默认 10 */
  gap?: number
}

/**
 * 列表操作栏容器：自动过滤空项，统一横向排布与间距
 */
export function actionBar(
  items: Array<VNodeChild | false | null | undefined>,
  opts: ActionBarOptions = {},
): VNodeChild {
  const visible = items.filter((item): item is VNodeChild => Boolean(item))
  if (!visible.length) return '—'
  const justify = opts.justify ?? 'flex-start'
  const gap = opts.gap ?? 10
  return h(
    'div',
    {
      style: `display:inline-flex;align-items:center;justify-content:${justify};gap:${gap}px;flex-wrap:nowrap`,
      onClick: opts.stopPropagation ? (e: MouseEvent) => e.stopPropagation() : undefined,
    },
    visible,
  )
}
