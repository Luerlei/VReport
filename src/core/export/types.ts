/**
 * 导出器类型定义
 */
import type { RenderedCell } from '@/core/engine/ExpandEngine'

/** 导出格式 */
export type ExportFormat = 'html' | 'excel' | 'pdf'

/** 导出选项 */
export interface ExportOptions {
  format: ExportFormat
  fileName?: string
  /** PDF 横向 */
  landscape?: boolean
  /** PDF 纸张大小 */
  paper?: 'A4' | 'A3' | 'letter'
  /** 报表标题（用于 HTML 标题、Excel sheet 名） */
  title?: string
}

/** 导出器接口 */
export interface Exporter {
  export(
    grid: (RenderedCell | null)[][],
    rowHeights: number[],
    colWidths: number[],
    options: ExportOptions
  ): Promise<void>
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 触发浏览器下载（字符串内容） */
export function downloadString(content: string, mime: string, fileName: string): void {
  const blob = new Blob([content], { type: mime })
  downloadBlob(blob, fileName)
}
