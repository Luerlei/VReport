<template>
  <svg ref="svgRef" class="barcode-preview"></svg>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import JsBarcode from 'jsbarcode'
import type { BarcodeConfig } from '@/types'

const props = defineProps<{
  config?: BarcodeConfig
  /** 运行时已解析的数据(覆盖 config.data 中的表达式) */
  resolvedData?: string
}>()

const svgRef = ref<SVGSVGElement | null>(null)

onMounted(() => {
  nextTick(render)
})

watch(() => props.config, render, { deep: true })
watch(() => props.resolvedData, render)

function render() {
  const svg = svgRef.value
  if (!svg || !props.config) return
  const data = props.resolvedData != null ? props.resolvedData : resolveForPreview(props.config.data)
  if (!data) {
    svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#bbb" font-size="10">条码</text>'
    return
  }
  try {
    JsBarcode(svg, data, {
      format: props.config.format,
      width: 1.5,
      height: Math.min(props.config.height ?? 40, 60),
      displayValue: props.config.displayValue ?? true,
      fontSize: 10,
      lineColor: props.config.foreground ?? '#000000',
      background: props.config.background ?? '#ffffff'
    })
  } catch (e) {
    svg.innerHTML = `<text x="50%" y="50%" text-anchor="middle" fill="#ff4d4f" font-size="10">数据格式不符</text>`
  }
}

function resolveForPreview(text: string): string {
  if (!text) return ''
  return text.replace(/\$\{[^}]+\}/g, '1234567890')
}
</script>

<style scoped>
.barcode-preview {
  display: block;
  width: 100%;
  height: 100%;
  background: #fff;
}
</style>
