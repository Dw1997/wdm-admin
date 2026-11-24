<template>
  <n-modal
    :show="show"
    :title="modalTitle"
    preset="card"
    style="width: 440px"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="qr-wrap">
      <n-spin :show="loading">
        <div class="qr-stage">
          <img
            v-if="qrInfo?.qrcode_url"
            :src="qrInfo.qrcode_url"
            alt="推广小程序码"
            class="qr-img"
          />
          <div v-else class="qr-placeholder">
            {{ loading ? '正在生成小程序码...' : (qrInfo?.unavailable_reason || '暂未生成小程序码') }}
          </div>
        </div>
      </n-spin>

      <div class="qr-meta">
        <div>
          <span class="label">所属账号：</span>
          <strong>{{ displayName }}</strong>
        </div>
        <div>
          <span class="label">专属推广码：</span>
          <code>{{ qrInfo?.invite_code || '—' }}</code>
        </div>
        <div class="hint">客户微信扫码进小程序并使用手机号一键登录，将自动归属该账号；下载后可直接打印盲贴。</div>
      </div>
    </div>

    <template #footer>
      <div class="qr-footer">
        <n-button :loading="loading" @click="load(true)">刷新重生成</n-button>
        <div class="qr-footer-right">
          <n-button @click="emit('update:show', false)">关闭</n-button>
          <n-button
            type="primary"
            :disabled="!qrInfo?.qrcode_url"
            :loading="downloading"
            @click="onDownload"
          >
            下载图片
          </n-button>
        </div>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { promotionApi } from '@/api'
import type { PromotionQrcode } from '@/types'

const props = defineProps<{
  show: boolean
  accountId?: number | null
  accountName?: string
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'loaded', value: PromotionQrcode): void
}>()

const message = useMessage()
const loading = ref(false)
const downloading = ref(false)
const qrInfo = ref<PromotionQrcode | null>(null)

const displayName = computed(() => qrInfo.value?.account_name || props.accountName || '当前账号')
const modalTitle = computed(() => `推广小程序码 · ${displayName.value}`)

async function load(refresh = false) {
  loading.value = true
  try {
    const res = await promotionApi.qrcode({
      account_id: props.accountId || undefined,
      refresh: refresh || undefined,
    })
    qrInfo.value = res
    emit('loaded', res)
    if (refresh && res.qrcode_url) {
      message.success('已重新生成推广码')
    }
  } finally {
    loading.value = false
  }
}

async function onDownload() {
  const url = qrInfo.value?.qrcode_url
  if (!url) return
  const safeName = (displayName.value || 'promo').replace(/[\\/:*?"<>|\s]+/g, '_')
  const code = qrInfo.value?.invite_code || 'qrcode'
  const filename = `推广码-${safeName}-${code}.png`

  downloading.value = true
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error('download failed')
    const blob = await resp.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(blobUrl)
    message.success(`已开始下载 ${filename}`)
  } catch {
    // COS 未开 CORS 时降级新标签页打开右键另存
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.download = filename
    a.click()
    message.info('已在新窗口打开图片，请右键另存为')
  } finally {
    downloading.value = false
  }
}

watch(
  () => [props.show, props.accountId] as const,
  ([visible]) => {
    if (visible) {
      qrInfo.value = null
      load(false)
    }
  },
)
</script>

<style scoped>
.qr-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.qr-stage {
  width: 260px;
  height: 260px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  box-sizing: border-box;
}
.qr-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.qr-placeholder {
  text-align: center;
  color: var(--text-3, #6b7280);
  font-size: 13px;
  line-height: 1.6;
  padding: 0 12px;
}
.qr-meta {
  width: 100%;
  background: var(--bg-soft, #f9fafb);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.8;
}
.qr-meta .label {
  color: var(--text-3, #6b7280);
}
.qr-meta .hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-3, #6b7280);
  line-height: 1.5;
}
.qr-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.qr-footer-right {
  display: flex;
  gap: 8px;
}
</style>
