<template>
  <canvas ref="canvasRef" class="qr-preview"></canvas>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import QRCode from 'qrcode'
import type { QRConfig } from '@/types'

const props = defineProps<{
  config?: QRConfig
  width?: number
  height?: number
  /** 运行时已解析的数据(覆盖 config.data 中的表达式) */
  resolvedData?: string
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

onMounted(() => {
  nextTick(render)
})

watch(() => props.config, render, { deep: true })
watch(() => props.width, render)
watch(() => props.height, render)
watch(() => props.resolvedData, render)

function render() {
  const canvas = canvasRef.value
  if (!canvas || !props.config) return
  const data = props.resolvedData != null ? props.resolvedData : resolveForPreview(props.config.data)
  if (!data) {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      canvas.width = 64
      canvas.height = 64
      ctx.fillStyle = '#fafafa'
      ctx.fillRect(0, 0, 64, 64)
      ctx.fillStyle = '#bbb'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('二维码', 32, 36)
    }
    return
  }
  QRCode.toCanvas(
    canvas,
    data,
    {
      errorCorrectionLevel: props.config.errorCorrectLevel ?? 'M',
      margin: props.config.margin ?? 2,
      width: props.width ?? Math.max(60, Math.min(props.height ?? 80, 100)),
      color: {
        dark: props.config.foreground ?? '#000000',
        light: props.config.background ?? '#ffffff'
      }
    },
    (err) => {
      if (err) console.warn('QR render error:', err)
    }
  )
}

/** 设计期预览:把表达式替换为占位文本,运行时由求值器替换 */
function resolveForPreview(text: string): string {
  if (!text) return ''
  return text.replace(/\$\{[^}]+\}/g, 'SAMPLE')
}
</script>

<style scoped>
.qr-preview {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
