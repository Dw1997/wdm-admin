import { h, type VNodeChild } from 'vue'
import { NButton, NIcon, NPopover, createDiscreteApi } from 'naive-ui'
import { Copy } from '@vicons/tabler'

const { message } = createDiscreteApi(['message'])

export interface CustomerCellOptions {
  /** 客户名称下方的小字副标题（如归属销售） */
  subtitle?: string | null
  /** 客户名称加粗 */
  strong?: boolean
  /** 复制成功后的自定义反馈；不传则用全局 message 提示 */
  onCopied?: () => void
}

/** 复制文本到剪贴板，优先 Clipboard API，失败退回 textarea 方案 */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 权限被拒或非安全上下文，走兜底
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    el.remove()
    return ok
  } catch {
    return false
  }
}

/**
 * 渲染列表客户列：名称直接显示，悬停名称弹气泡显示手机号并可一键复制。
 * 手机号不在单元格里常驻显示，保持列表干净。
 */
export function renderCustomerNameCell(
  name: string,
  phone?: string | null,
  opts: CustomerCellOptions = {},
): VNodeChild {
  const displayName = name || '—'
  const subtitle = (opts.subtitle ?? '').trim()

  const nameStyle = [
    `font-weight:${opts.strong ? 600 : 500}`,
    phone ? 'border-bottom:1px dashed var(--border);cursor:default' : '',
  ]
    .filter(Boolean)
    .join(';')

  const nameNode = h('span', { style: nameStyle }, displayName)

  const copyPhone = async () => {
    if (!phone) return
    const ok = await writeClipboard(phone)
    if (!ok) {
      message.error('复制失败，请手动选择手机号')
      return
    }
    if (opts.onCopied) opts.onCopied()
    else message.success('已复制手机号')
  }

  const withPopover = phone
    ? h(
        NPopover,
        { trigger: 'hover', placement: 'top-start', showArrow: true },
        {
          trigger: () => nameNode,
          default: () =>
            h('div', { style: 'display:flex;align-items:center;gap:10px' }, [
              h(
                'span',
                {
                  style: 'font-variant-numeric:tabular-nums;cursor:pointer;user-select:all',
                  onClick: copyPhone,
                },
                phone,
              ),
              h(
                NButton,
                { size: 'tiny', text: true, type: 'primary', onClick: copyPhone },
                {
                  icon: () => h(NIcon, { component: Copy, size: 14 }),
                  default: () => '复制',
                },
              ),
            ]),
        },
      )
    : nameNode

  return h('div', { style: 'min-width:0' }, [
    h('div', null, [withPopover]),
    subtitle ? h('div', { class: 'muted' }, subtitle) : null,
  ])
}
