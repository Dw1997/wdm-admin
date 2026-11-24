// 打印输出：用隐藏 iframe 加载单据 HTML 再调浏览器打印，不新开标签页。
// 真正的针式 / A4 打印机由浏览器打印窗口选择，前端只负责把单据送进去。

export interface PrintResult {
  ok: boolean
  reason?: 'blocked' | 'empty'
}

/** 单据页在 96dpi 下的像素尺寸（mm × 96 / 25.4）。预览按它算缩放。 */
export function mmToPx(mm: number): number {
  return (mm * 96) / 25.4
}

/**
 * 把整份单据 HTML 交给浏览器打印。
 * 打印窗口被拦截时返回 blocked，由页面提示"请允许弹出窗口"。
 */
export function printHtml(html: string): PrintResult {
  if (!html) return { ok: false, reason: 'empty' }
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
  document.body.appendChild(frame)

  const cleanup = () => {
    window.setTimeout(() => frame.remove(), 800)
  }

  let printed = false
  const run = () => {
    if (printed) return
    printed = true
    const win = frame.contentWindow
    if (!win) {
      cleanup()
      return
    }
    try {
      win.focus()
      win.print()
    } catch {
      // 打印窗口被拦截或浏览器拒绝：单据没送出去，页面提示重试
    } finally {
      cleanup()
    }
  }

  frame.onload = () => window.setTimeout(run, 60)
  frame.srcdoc = html
  // 兜底：某些浏览器 srcdoc 不触发 onload
  window.setTimeout(run, 1200)
  return { ok: true }
}
