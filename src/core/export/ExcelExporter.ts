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

/** 单元格在导出表中的落位（1-based 行列） */
export interface CellPlacement {
  cell: RenderedCell
  row: number
  col: number
  rowSpan: number
  colSpan: number
}

/**
 * 计算导出落位：复刻预览(HTML 表格)的自动排布语义。
 * 预览用 `<td v-if="cell">` 渲染，会跳过 null 单元格（含右展开产生的“空隙列”），
 * 使每行内容左对齐收拢；导出需按同样规则落位，保证 Excel 与预览一致
 * （否则右展开插入的空隙列会在导出中残留为空白 C/D 列）。
 */
export function computeAutoFlowPlacements(
  grid: (RenderedCell | null)[][]
): CellPlacement[] {
  const placements: CellPlacement[] = []
  // 记录被上方 rowspan/colspan 占用的落位（key: `${rowIndex},${excelCol}`）
  const occupied = new Set<string>()
  for (let r = 0; r < grid.length; r++) {
    let excelCol = 1
    const row = grid[r]
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]
      if (!cell) continue
      // 跳过被上方合并占用的列
      while (occupied.has(`${r},${excelCol}`)) excelCol++
      const startCol = excelCol
      placements.push({
        cell,
        row: r + 1,
        col: startCol,
        rowSpan: cell.rowSpan,
        colSpan: cell.colSpan
      })
      // 标记该单元格覆盖的矩形（跨行/跨列），供后续行列避让
      for (let rr = r; rr < r + cell.rowSpan; rr++) {
        for (let cc = startCol; cc < startCol + cell.colSpan; cc++) {
          if (rr === r && cc === startCol) continue
          occupied.add(`${rr},${cc}`)
        }
      }
      excelCol += cell.colSpan
    }
  }
  return placements
}

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

    // 按预览(HTML 表格)的自动排布落位写入，跳过 null 空隙列，保证与预览一致
    const placements = computeAutoFlowPlacements(grid)
    for (const p of placements) {
      const exCell = sheet.getCell(p.row, p.col)
      exCell.value = this.toExcelValue(p.cell)
      this.applyStyle(exCell, p.cell, condEngine)
      if (p.rowSpan > 1 || p.colSpan > 1) {
        sheet.mergeCells(p.row, p.col, p.row + p.rowSpan - 1, p.col + p.colSpan - 1)
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
