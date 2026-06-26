/**
 * HTML 导出器
 * 将渲染网格序列化为自包含的 HTML 文件（内联样式）
 */
import type { RenderedCell } from '@/core/engine/ExpandEngine'
import { styleToCss } from '@/core/render/StyleResolver'
import { ConditionEngine } from '@/core/format/ConditionEngine'
import type { ConditionFormat } from '@/types'
import type { Exporter, ExportOptions } from './types'
import { downloadString } from './types'

export class HtmlExporter implements Exporter {
  private conditionFormats: ConditionFormat[]

  constructor(conditionFormats: ConditionFormat[] = []) {
    this.conditionFormats = conditionFormats
  }

  async export(
    grid: (RenderedCell | null)[][],
    rowHeights: number[],
    colWidths: number[],
    options: ExportOptions
  ): Promise<void> {
    const title = options.title || '报表'
    const condEngine = new ConditionEngine(this.conditionFormats)

    const html = this.buildHtml(grid, rowHeights, colWidths, title, condEngine)
    const fileName = (options.fileName || title) + '.html'
    downloadString(html, 'text/html;charset=utf-8', fileName)
  }

  private buildHtml(
    grid: (RenderedCell | null)[][],
    rowHeights: number[],
    colWidths: number[],
    title: string,
    condEngine: ConditionEngine
  ): string {
    const colsHtml = colWidths
      .map((w) => `<col style="width:${w}px">`)
      .join('')

    const rowsHtml = grid
      .map((row, r) => {
        const height = rowHeights[r] ?? 28
        const cellsHtml = row
          .map((cell) => {
            if (!cell) return ''
            const style = this.resolveStyle(cell, condEngine)
            const styleStr = this.styleToString(style)
            const value = this.escapeHtml(this.formatValue(cell))
            return `<td rowspan="${cell.rowSpan}" colspan="${cell.colSpan}" style="${styleStr}">${value}</td>`
          })
          .join('')
        return `<tr style="height:${height}px">${cellsHtml}</tr>`
      })
      .join('')

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${this.escapeHtml(title)}</title>
<style>
body { margin: 0; padding: 16px; font-family: "Microsoft YaHei", Arial, sans-serif; }
table { border-collapse: collapse; table-layout: fixed; }
td { border: 1px solid #d9d9d9; padding: 2px 4px; overflow: hidden; word-break: break-all; }
@page { size: A4; margin: 1cm; }
</style>
</head>
<body>
<h2 style="text-align:center;margin-bottom:16px">${this.escapeHtml(title)}</h2>
<table border="0" cellspacing="0" cellpadding="0">
<colgroup>${colsHtml}</colgroup>
<tbody>${rowsHtml}</tbody>
</table>
</body>
</html>`
  }

  private resolveStyle(cell: RenderedCell, condEngine: ConditionEngine): Record<string, string> {
    const base = styleToCss(cell.source.style)
    const condStyle = condEngine.resolve(cell.source.name, cell.value, cell.context as any)
    return { ...base, ...styleToCss({ ...cell.source.style, ...condStyle } as any) }
  }

  private styleToString(style: Record<string, string>): string {
    return Object.entries(style)
      .map(([k, v]) => `${k}:${v}`)
      .join(';')
  }

  private formatValue(cell: RenderedCell): string {
    const v = cell.value
    if (v == null) return ''
    if (typeof v === 'number' && cell.source.numberFormat) {
      return this.formatNumber(v, cell.source.numberFormat)
    }
    if (v instanceof Date && cell.source.dateFormat) {
      return this.formatDate(v, cell.source.dateFormat)
    }
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }

  private formatNumber(n: number, fmt: string): string {
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

  private formatDate(d: Date, fmt: string): string {
    const map: Record<string, string> = {
      yyyy: String(d.getFullYear()),
      MM: String(d.getMonth() + 1).padStart(2, '0'),
      dd: String(d.getDate()).padStart(2, '0'),
      HH: String(d.getHours()).padStart(2, '0'),
      mm: String(d.getMinutes()).padStart(2, '0'),
      ss: String(d.getSeconds()).padStart(2, '0')
    }
    let result = fmt
    for (const [k, v] of Object.entries(map)) {
      result = result.replace(k, v)
    }
    return result
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
}
