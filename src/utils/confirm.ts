import { h } from 'vue'
import { NButton, NSpace, type DialogApi, type DialogReactive } from 'naive-ui'
import type { VNodeChild } from 'vue'

interface ConfirmOptions {
  title: string
  content: string | (() => VNodeChild)
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}

/**
 * 二次确认弹窗。
 *
 * 不用 dialog.warning 的 onPositiveClick：当前 Naive UI 版本在
 * DialogEnvironment 里会把该回调和内部 handler 合并成数组，点击时报
 * "onPositiveClick is not a function"。这里用自定义 action 按钮直接销毁弹窗。
 */
export function confirmAction(dialog: DialogApi, options: ConfirmOptions): DialogReactive {
  let instance: DialogReactive | undefined
  const close = () => instance?.destroy()
  instance = dialog.create({
    type: options.danger ? 'warning' : 'info',
    title: options.title,
    content: options.content,
    action: () =>
      h(NSpace, { justify: 'end', size: 8, wrap: false }, {
        default: () => [
          h(NButton, { size: 'small', onClick: close }, { default: () => options.cancelText || '取消' }),
          h(
            NButton,
            {
              size: 'small',
              type: options.danger ? 'error' : 'primary',
              onClick: async () => {
                close()
                await options.onConfirm()
              },
            },
            { default: () => options.confirmText || '确认' },
          ),
        ],
      }),
  })
  return instance
}
