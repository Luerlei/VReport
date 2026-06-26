/**
 * Excel 导出器
 * 基于 ExcelJS，逐单元格写入值与样式，处理合并、列宽、行高
 */
import ExcelJS from 'exceljs'
import type { RenderedCell } from '@/core/engine/ExpandEngine'
import { ConditionEngine } from '@/core/format/ConditionEngine'
import type { ConditionFormat } from '@/types'
import type { CellStyle, BorderEdge } from '@/core/cell/types'
import type { Exporter, ExportOptions } from './types'
import { downloadBlob } from './types'

export class ExcelExporter implements Exporter {
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
    const wb = new ExcelJS.Workbook()
    const sheet = wb.addWorksheet(options.title || '报表')

    // 设置列宽（ExcelJS 列宽单位约为字符宽度，px/7 近似）
    sheet.columns = colWidths.map((w) => ({ width: Math.max(8, Math.round(w / 7)) }))

    // 设置行高（ExcelJS 行高单位为磅，px * 0.75 近似）
    rowHeights.forEach((h, i) => {
      sheet.getRow(i + 1).height = Math.round(h * 0.75)
    })

    const condEngine = new ConditionEngine(this.conditionFormats)

    // 写入单元格
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r]
      for (let c = 0; c < row.length; c++) {
        const cell = row[c]
        if (!cell) continue
        const exCell = sheet.getCell(r + 1, c + 1)
        exCell.value = this.toExcelValue(cell)
        this.applyStyle(exCell, cell, condEngine)
      }
    }

    // 处理合并单元格
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const cell = grid[r][c]
        if (!cell) continue
        if (cell.rowSpan > 1 || cell.colSpan > 1) {
          sheet.mergeCells(r + 1, c + 1, r + cell.rowSpan, c + cell.colSpan)
        }
      }
    }

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const fileName = (options.fileName || options.title || '报表') + '.xlsx'
    downloadBlob(blob, fileName)
  }

  private toExcelValue(cell: RenderedCell): ExcelJS.CellValue {
    const v = cell.value
    if (v == null || v === '') return ''
    if (typeof v === 'number') return v
    if (typeof v === 'boolean') return v
    if (v instanceof Date) return v
    return String(v)
  }

  private applyStyle(
    exCell: ExcelJS.Cell,
    cell: RenderedCell,
    condEngine: ConditionEngine
  ): void {
    const baseStyle = cell.source.style
    const condStyle = condEngine.resolve(cell.source.name, cell.value, cell.context as any)
    const merged: CellStyle = { ...baseStyle, ...condStyle }

    const font: Partial<ExcelJS.Font> = {}
    if (merged.fontFamily) font.name = merged.fontFamily
    if (merged.fontSize) font.size = merged.fontSize
    if (merged.bold) font.bold = true
    if (merged.italic) font.italic = true
    if (merged.underline) font.underline = true
    if (merged.color) font.color = { argb: this.toArgb(merged.color) }
    exCell.font = font

    if (merged.background) {
      exCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: this.toArgb(merged.background) }
      }
    }

    const alignment: Partial<ExcelJS.Alignment> = {}
    if (merged.hAlign) alignment.horizontal = merged.hAlign as ExcelJS.Alignment['horizontal']
    // ExcelJS 垂直对齐用 'top' | 'middle' | 'bottom'，与 CellStyle 一致
    if (merged.vAlign) {
      alignment.vertical = merged.vAlign === 'middle' ? 'middle' : (merged.vAlign as 'top' | 'bottom')
    }
    if (merged.wrap) alignment.wrapText = true
    if (merged.indent) alignment.indent = merged.indent
    exCell.alignment = alignment

    const border: Partial<ExcelJS.Borders> = {}
    const toBorder = (e?: BorderEdge): Partial<ExcelJS.Border> | undefined => {
      if (!e || e.style === 'none') return undefined
      const styleMap: Record<string, ExcelJS.BorderStyle> = {
        solid: 'thin',
        dashed: 'dashed',
        dotted: 'dotted'
      }
      return { style: styleMap[e.style] || 'thin', color: { argb: this.toArgb(e.color) } }
    }
    const top = toBorder(merged.borderTop)
    const right = toBorder(merged.borderRight)
    const bottom = toBorder(merged.borderBottom)
    const left = toBorder(merged.borderLeft)
    if (top || right || bottom || left) {
      border.top = top
      border.right = right
      border.bottom = bottom
      border.left = left
      exCell.border = border
    }

    // 数字格式
    if (typeof cell.value === 'number' && cell.source.numberFormat) {
      exCell.numFmt = this.toExcelNumFmt(cell.source.numberFormat)
    }
  }

  /** 将 #RRGGBB 转为 ARGB（FF 前缀表示不透明） */
  private toArgb(hex: string): string {
    if (hex.startsWith('#')) hex = hex.slice(1)
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('')
    }
    return 'FF' + hex.toUpperCase()
  }

  /** 将报表数字格式转为 Excel 数字格式 */
  private toExcelNumFmt(fmt: string): string {
    // #,##0.00 -> #,##0.00
    // 简单映射，Excel 原生支持类似格式
    return fmt
  }
}
