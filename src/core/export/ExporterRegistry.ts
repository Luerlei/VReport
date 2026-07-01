/**
 * 导出器注册中心
 * 根据格式创建对应的导出器实例
 */
import type { ConditionFormat } from '@/types'
import type { Exporter, ExportFormat } from './types'
import { HtmlExporter } from './HtmlExporter'
import { ExcelExporter } from './ExcelExporter'
import { PdfExporter } from './PdfExporter'

/** 创建导出器 */
export function createExporter(
  format: ExportFormat,
  conditionFormats: ConditionFormat[] = []
): Exporter {
  switch (format) {
    case 'html':
      return new HtmlExporter(conditionFormats)
    case 'excel':
      return new ExcelExporter(conditionFormats)
    case 'pdf':
      return new PdfExporter(conditionFormats)
    default:
      throw new Error(`不支持的导出格式：${format}`)
  }
}
