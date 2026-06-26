/**
 * PDF 导出器
 * 基于 html2canvas + jsPDF，将渲染网格截图后按页切分
 *
 * 实现思路：
 * 1. 临时构建一个隐藏的 DOM 表格（与 RenderedTable 视觉一致）
 * 2. html2canvas 截图为 canvas
 * 3. 按纸张大小切分 canvas 为多页 PDF
 */
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { RenderedCell } from '@/core/engine/ExpandEngine'
import { styleToCss } from '@/core/render/StyleResolver'
import { ConditionEngine } from '@/core/format/ConditionEngine'
import type { ConditionFormat } from '@/types'
import type { Exporter, ExportOptions } from './types'
import { downloadBlob } from './types'

/** 纸张尺寸（mm） */
const PAPER_SIZE: Record<string, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  letter: { w: 215.9, h: 279.4 }
}

export class PdfExporter implements Exporter {
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
    const paper = options.paper || 'A4'
    const landscape = options.landscape ?? false
    const size = PAPER_SIZE[paper] || PAPER_SIZE.A4
    const pageW = landscape ? size.h : size.w
    const pageH = landscape ? size.w : size.h
    // 页边距 10mm
    const margin = 10
    const contentW = pageW - margin * 2
    const contentH = pageH - margin * 2

    // 1. 构建临时 DOM
    const container = this.buildTempDom(grid, rowHeights, colWidths, options.title)
    document.body.appendChild(container)

    try {
      // 2. 等待渲染（图表等异步内容）
      await this.waitForRender(container)

      // 3. html2canvas 截图
      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      })

      // 4. 切分多页 PDF
      const pdf = new jsPDF({
        orientation: landscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: paper.toLowerCase() as 'a4' | 'a3' | 'letter'
      })

      const imgW = contentW
      const imgH = (canvas.height * imgW) / canvas.width
      const pageContentH = contentH
      const pageHeightInPx = (pageContentH * canvas.width) / imgW

      let renderedH = 0
      let pageIdx = 0
      while (renderedH < canvas.height) {
        if (pageIdx > 0) pdf.addPage()
        const sliceH = Math.min(pageHeightInPx, canvas.height - renderedH)
        // 创建当前页的 canvas 切片
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvas.width
        pageCanvas.height = sliceH
        const ctx = pageCanvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
        ctx.drawImage(
          canvas,
          0,
          renderedH,
          canvas.width,
          sliceH,
          0,
          0,
          canvas.width,
          sliceH
        )
        const imgData = pageCanvas.toDataURL('image/jpeg', 0.92)
        const sliceImgH = (sliceH * imgW) / canvas.width
        pdf.addImage(imgData, 'JPEG', margin, margin, imgW, sliceImgH)
        renderedH += sliceH
        pageIdx++
      }

      const blob = pdf.output('blob')
      const fileName = (options.fileName || options.title || '报表') + '.pdf'
      downloadBlob(blob, fileName)
    } finally {
      document.body.removeChild(container)
    }
  }

  private buildTempDom(
    grid: (RenderedCell | null)[][],
    rowHeights: number[],
    colWidths: number[],
    title?: string
  ): HTMLElement {
    const condEngine = new ConditionEngine(this.conditionFormats)
    const wrapper = document.createElement('div')
    wrapper.style.position = 'fixed'
    wrapper.style.left = '-99999px'
    wrapper.style.top = '0'
    wrapper.style.background = '#ffffff'
    wrapper.style.padding = '16px'

    if (title) {
      const h = document.createElement('h2')
      h.textContent = title
      h.style.textAlign = 'center'
      h.style.marginBottom = '12px'
      h.style.fontFamily = '"Microsoft YaHei", Arial, sans-serif'
      wrapper.appendChild(h)
    }

    const table = document.createElement('table')
    table.style.borderCollapse = 'collapse'
    table.style.tableLayout = 'fixed'

    // colgroup
    const colgroup = document.createElement('colgroup')
    colWidths.forEach((w) => {
      const col = document.createElement('col')
      col.style.width = w + 'px'
      colgroup.appendChild(col)
    })
    table.appendChild(colgroup)

    const tbody = document.createElement('tbody')
    grid.forEach((row, r) => {
      const tr = document.createElement('tr')
      tr.style.height = (rowHeights[r] ?? 28) + 'px'
      row.forEach((cell) => {
        if (!cell) return
        const td = document.createElement('td')
        td.rowSpan = cell.rowSpan
        td.colSpan = cell.colSpan
        const baseStyle = styleToCss(cell.source.style)
        const condStyle = condEngine.resolve(cell.source.name, cell.value, cell.context as any)
        const merged = { ...baseStyle, ...styleToCss({ ...cell.source.style, ...condStyle } as any) }
        Object.assign(td.style, merged)
        td.style.border = '1px solid #d9d9d9'
        td.style.padding = '2px 4px'
        td.style.overflow = 'hidden'
        td.textContent = this.formatValue(cell)
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    wrapper.appendChild(table)

    return wrapper
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

  private waitForRender(container: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      // 等待一帧确保 DOM 渲染完成
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve())
      })
    })
  }
}
