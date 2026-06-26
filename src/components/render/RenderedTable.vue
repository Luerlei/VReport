<template>
  <div class="rendered-table-wrap" :style="{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }">
    <table class="rendered-table" border="0" cellspacing="0" cellpadding="0">
      <colgroup>
        <col v-for="(w, i) in colWidths" :key="i" :style="{ width: w + 'px' }" />
      </colgroup>
      <tbody>
        <tr v-for="(row, r) in grid" :key="r" :style="{ height: rowHeights[r] + 'px' }">
          <template v-for="(cell, c) in row" :key="`${r}-${c}`">
            <td
              v-if="cell"
              :rowspan="cell.rowSpan"
              :colspan="cell.colSpan"
              :style="cellCss(cell)"
              :class="{ 'chart-cell': cell.source.cellType === 'chart', 'image-cell': cell.source.cellType === 'image', 'qr-cell': cell.source.cellType === 'qrcode', 'barcode-cell': cell.source.cellType === 'barcode' }"
            >
              <ChartCell
                v-if="cell.source.cellType === 'chart'"
                :config="cell.source.chartConfig"
                :context="cell.context"
              />
              <img
                v-else-if="cell.source.cellType === 'image'"
                :src="imageUrl(cell)"
                :style="imageStyle(cell)"
              />
              <QRPreview
                v-else-if="cell.source.cellType === 'qrcode'"
                :config="cell.source.qrConfig"
                :resolved-data="resolvedData(cell)"
                :width="qrSize(r, c, cell)"
                :height="qrSize(r, c, cell)"
              />
              <BarcodePreview
                v-else-if="cell.source.cellType === 'barcode'"
                :config="cell.source.barcodeConfig"
                :resolved-data="resolvedData(cell)"
              />
              <span v-else>{{ formatValue(cell) }}</span>
            </td>
          </template>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RenderedCell } from '@/core/engine/ExpandEngine'
import { styleToCss } from '@/core/render/StyleResolver'
import { ConditionEngine } from '@/core/format/ConditionEngine'
import type { ConditionFormat, ImageConfig } from '@/types'
import ChartCell from './ChartCell.vue'
import QRPreview from '@/components/designer/QRPreview.vue'
import BarcodePreview from '@/components/designer/BarcodePreview.vue'

const props = defineProps<{
  grid: (RenderedCell | null)[][]
  rowHeights: number[]
  colWidths: number[]
  zoom?: number
  conditionFormats?: ConditionFormat[]
}>()

const zoom = computed(() => props.zoom ?? 100)
const conditionEngine = computed(() => new ConditionEngine(props.conditionFormats ?? []))

function cellCss(cell: RenderedCell): Record<string, string> {
  const base = styleToCss(cell.source.style)
  // 应用条件格式
  const condStyle = conditionEngine.value.resolve(
    cell.source.name,
    cell.value,
    cell.context as any
  )
  return { ...base, ...styleToCss({ ...cell.source.style, ...condStyle } as any) }
}

function formatValue(cell: RenderedCell): string {
  const v = cell.value
  if (v == null) return ''
  // 数字格式
  if (typeof v === 'number' && cell.source.numberFormat) {
    return formatNumber(v, cell.source.numberFormat)
  }
  // 日期格式
  if (v instanceof Date && cell.source.dateFormat) {
    return formatDate(v, cell.source.dateFormat)
  }
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** 图片 URL:base64 模式用嵌入数据;URL 模式用 cell.value(已解析表达式) */
function imageUrl(cell: RenderedCell): string {
  const cfg = cell.source.imageConfig
  if (!cfg) return ''
  if (cfg.source === 'base64' && cfg.base64) {
    return `data:${cfg.mimeType ?? 'image/png'};base64,${cfg.base64}`
  }
  // URL 模式:cell.value 已是求值后的 URL 字符串
  return String(cell.value ?? cfg.url ?? '')
}

/** 图片样式 */
function imageStyle(cell: RenderedCell): Record<string, string> {
  const cfg = cell.source.imageConfig as ImageConfig | undefined
  if (!cfg) return { 'max-width': '100%', 'max-height': '100%' }
  const style: Record<string, string> = { 'max-width': '100%', 'max-height': '100%' }
  if (cfg.width) style['width'] = cfg.width + 'px'
  if (cfg.height) style['height'] = cfg.height + 'px'
  const fit = cfg.fit ?? 'contain'
  style['object-fit'] = fit === 'fill' ? 'fill' : fit === 'cover' ? 'cover' : fit === 'none' ? 'none' : 'contain'
  style['display'] = 'block'
  style['margin'] = 'auto'
  return style
}

/** 二维码/条码的运行时数据:cell.value 已由求值器解析表达式 */
function resolvedData(cell: RenderedCell): string {
  const v = cell.value
  if (v == null) return ''
  return String(v)
}

/** 二维码尺寸(根据单元格合并范围计算) */
function qrSize(r: number, c: number, cell: RenderedCell): number {
  const totalH = (props.rowHeights[r] ?? 28) * (cell.rowSpan ?? 1)
  const totalW = (props.colWidths[c] ?? 100) * (cell.colSpan ?? 1)
  return Math.max(40, Math.min(totalH, totalW) - 8)
}

function formatNumber(n: number, fmt: string): string {
  const dotIdx = fmt.indexOf('.')
  let decimals = 0
  if (dotIdx >= 0) decimals = fmt.length - dotIdx - 1
  const hasGroup = fmt.includes(',')
  let s = n.toFixed(decimals)
  if (hasGroup) {
    const [intPart, decPart] = s.split('.')
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    s = decPart ? `${grouped}.${decPart}` : grouped
  }
  return s
}

function formatDate(d: Date, fmt: string): string {
  // 简单实现：yyyy-MM-dd -> 2024-01-01
  const map: Record<string, string> = {
    'yyyy': String(d.getFullYear()),
    'MM': String(d.getMonth() + 1).padStart(2, '0'),
    'dd': String(d.getDate()).padStart(2, '0'),
    'HH': String(d.getHours()).padStart(2, '0'),
    'mm': String(d.getMinutes()).padStart(2, '0'),
    'ss': String(d.getSeconds()).padStart(2, '0')
  }
  let result = fmt
  for (const [k, v] of Object.entries(map)) {
    result = result.replace(k, v)
  }
  return result
}
</script>

<style scoped>
.rendered-table-wrap {
  display: inline-block;
  background: #fff;
}

.rendered-table {
  border-collapse: collapse;
  table-layout: fixed;
}

.rendered-table td {
  border: 1px solid #d9d9d9;
  padding: 2px 4px;
  overflow: hidden;
  word-break: break-all;
}

.chart-cell,
.image-cell,
.qr-cell,
.barcode-cell {
  padding: 0 !important;
  text-align: center;
}
</style>
