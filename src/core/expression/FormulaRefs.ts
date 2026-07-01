/**
 * 公式单元格引用解析：从公式字符串提取所有被引用的单元格坐标，并按出现顺序分配高亮颜色。
 * 供画布在编辑公式时以 Excel/WPS 风格高亮被引用的单元格。
 */
import { parseCellRef } from './Lexer'

/** Excel 风格引用高亮颜色调色板 */
export const REF_COLORS = [
  '#0078D4',
  '#00B050',
  '#FFC000',
  '#7030A0',
  '#E97132',
  '#2E75B6',
  '#548235',
  '#C00000'
]

/** 公式引用高亮信息：每个引用对应一个颜色与单元格区域 */
export interface FormulaRef {
  color: string
  cells: { row: number; col: number }[]
  isRange: boolean
}

/** 解析公式中所有单元格引用(含区域 A1:B3)，按出现顺序分配高亮颜色 */
export function extractFormulaRefs(formula: string): FormulaRef[] {
  if (!formula || !formula.startsWith('=')) return []
  const expr = formula.substring(1)
  const refs: FormulaRef[] = []
  // 先匹配区域 A1:B3
  const rangeRe = /\$?[A-Za-z]+\$?[0-9]+\s*:\s*\$?[A-Za-z]+\$?[0-9]+/g
  const singleRe = /\$?[A-Za-z]+\$?[0-9]+/g
  const consumed: { start: number; end: number }[] = []
  let m: RegExpExecArray | null
  while ((m = rangeRe.exec(expr)) !== null) {
    const parts = m[0].split(':')
    try {
      const a = parseCellRef(parts[0].trim())
      const b = parseCellRef(parts[1].trim())
      const cells: { row: number; col: number }[] = []
      const minR = Math.min(a.row, b.row),
        maxR = Math.max(a.row, b.row)
      const minC = Math.min(a.col, b.col),
        maxC = Math.max(a.col, b.col)
      for (let r = minR; r <= maxR; r++)
        for (let c = minC; c <= maxC; c++) cells.push({ row: r, col: c })
      refs.push({ color: '', cells, isRange: true })
      consumed.push({ start: m.index, end: m.index + m[0].length })
    } catch {
      /* 忽略非法引用 */
    }
  }
  // 再匹配单个单元格(排除已被区域覆盖的部分)
  while ((m = singleRe.exec(expr)) !== null) {
    const matched = m
    const inRange = consumed.some(
      (c) => matched.index >= c.start && matched.index + matched[0].length <= c.end
    )
    if (inRange) continue
    try {
      const a = parseCellRef(matched[0])
      refs.push({ color: '', cells: [{ row: a.row, col: a.col }], isRange: false })
    } catch {
      /* 忽略非法引用 */
    }
  }
  // 分配颜色
  refs.forEach((r, i) => {
    r.color = REF_COLORS[i % REF_COLORS.length]
  })
  return refs
}
