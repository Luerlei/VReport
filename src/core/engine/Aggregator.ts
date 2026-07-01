/**
 * 聚合计算器
 * 对展开后的渲染网格应用聚合函数与表达式求值
 */
import type { RenderedCell } from './ExpandEngine'
import type { ExpandContext } from './Context'
import { evaluator } from '@/core/expression/Evaluator'
import { parseExpression } from '@/core/expression/Parser'
import type { EvalContext } from '@/core/expression/types'
import type { Cell } from '@/core/cell/types'

export class Aggregator {
  /** 渲染网格 */
  private grid: (RenderedCell | null)[][]
  /** 已求值的单元格缓存 */
  private evaluated = new Map<string, unknown>()
  /** 正在求值的单元格（防止循环引用） */
  private evaluating = new Set<string>()

  constructor(grid: (RenderedCell | null)[][]) {
    this.grid = grid
  }

  /** 对所有单元格求值（按需递归，自动处理任意层依赖） */
  evaluateAll(): void {
    this.evaluated.clear()
    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < this.grid[r].length; c++) {
        const rc = this.grid[r][c]
        if (!rc) continue
        this.getCellValue(r, c)
      }
    }
  }

  /** 求值单个单元格 */
  private evaluateCell(rc: RenderedCell, row: number, col: number): unknown {
    const cell = rc.source
    const content = cell.content
    if (!content) return ''

    const { isText, text, ast } = parseExpression(content)
    if (isText) return text ?? ''
    if (!ast) return ''

    const key = `${row},${col}`
    // 循环引用检测：返回 #CIRC! 提示而非静默 undefined
    if (this.evaluating.has(key)) return '#CIRC!'
    this.evaluating.add(key)

    const ctx: EvalContext = {
      rowData: rc.context?.rowData,
      datasetRows: rc.context?.datasetRows,
      params: rc.context?.params,
      getCell: (c, r) => this.getCellValueByTemplateRef(rc, r, c),
      getRange: (sc, sr, ec, er) => this.getRangeValuesByReference(rc, sr, sc, er, ec),
      parent: rc.context?.parent
    }

    try {
      const result = evaluator.evaluate(ast, ctx)
      return result
    } catch (e) {
      return `#ERROR: ${(e as Error).message}`
    } finally {
      this.evaluating.delete(key)
    }
  }

  /** 获取单元格值（已求值的直接返回，否则递归求值） */
  private getCellValue(row: number, col: number): unknown {
    const key = `${row},${col}`
    if (this.evaluated.has(key)) return this.evaluated.get(key)
    const rc = this.grid[row]?.[col]
    if (!rc) return undefined
    const val = this.evaluateCell(rc, row, col)
    // 循环引用结果也缓存，避免重复计算
    this.evaluated.set(key, val)
    rc.value = val
    return val
  }

  /**
   * 单个单元格引用按模板源坐标解析，避免其它数据集展开导致渲染坐标漂移后引用失真。
   * 若找不到语义匹配目标，则回退到旧的渲染坐标语义。
   */
  private getCellValueByTemplateRef(current: RenderedCell, templateRow: number, templateCol: number): unknown {
    const target = this.findBestRenderedCellForTemplateRef(current, templateRow, templateCol)
    if (target) {
      return this.getCellValue(target.row, target.col)
    }
    return this.getCellValue(templateRow, templateCol)
  }

  /** 根据模板源坐标找到最合适的渲染单元格 */
  private findBestRenderedCellForTemplateRef(
    current: RenderedCell,
    templateRow: number,
    templateCol: number
  ): RenderedCell | null {
    const candidates: RenderedCell[] = []
    for (const row of this.grid) {
      for (const cell of row) {
        if (cell && cell.source.row === templateRow && cell.source.col === templateCol) {
          candidates.push(cell)
        }
      }
    }
    if (!candidates.length) return null
    if (candidates.length === 1) return candidates[0]

    let best: RenderedCell | null = null
    let bestScore = -1
    for (const candidate of candidates) {
      const score = this.scoreContextAffinity(current.context, candidate.context)
      if (score > bestScore) {
        best = candidate
        bestScore = score
      }
    }
    return best ?? candidates[0]
  }

  /** 当前单元格上下文与候选单元格上下文的亲和度，越大越优先 */
  private scoreContextAffinity(a?: ExpandContext, b?: ExpandContext): number {
    if (!a || !b) return 0
    if (a === b) return 1000

    const chainA = this.getContextChain(a)
    const chainB = this.getContextChain(b)
    for (let i = 0; i < chainA.length; i++) {
      const ctxA = chainA[i]
      const idxB = chainB.indexOf(ctxA)
      if (idxB >= 0) {
        return 800 - i - idxB
      }
    }

    for (let i = 0; i < chainA.length; i++) {
      for (let j = 0; j < chainB.length; j++) {
        const ctxA = chainA[i]
        const ctxB = chainB[j]
        if (ctxA.rowData && ctxA.rowData === ctxB.rowData) {
          return 600 - i - j
        }
      }
    }

    if (a.datasetName && b.datasetName && a.datasetName === b.datasetName) {
      return 200
    }
    return 1
  }

  private getContextChain(ctx: ExpandContext): ExpandContext[] {
    const chain: ExpandContext[] = []
    let cur: ExpandContext | undefined = ctx
    while (cur) {
      chain.push(cur)
      cur = cur.parent
    }
    return chain
  }

  /** 获取区域所有值 */
  private getRangeValues(startRow: number, startCol: number, endRow: number, endCol: number): unknown[] {
    const values: unknown[] = []
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const rc = this.grid[r]?.[c]
        if (rc) {
          const v = this.getCellValue(r, c)
          if (v !== undefined) values.push(v)
        }
      }
    }
    return values
  }

  /**
   * 范围引用优先按模板源坐标解析；若范围明显超出模板边界，则回退为旧的渲染坐标语义，兼容已有汇总模板。
   */
  private getRangeValuesByReference(
    current: RenderedCell,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): unknown[] {
    if (!this.shouldUseTemplateRange(startRow, startCol, endRow, endCol)) {
      return this.getRangeValues(startRow, startCol, endRow, endCol)
    }

    const values: unknown[] = []
    const minRow = Math.min(startRow, endRow)
    const maxRow = Math.max(startRow, endRow)
    const minCol = Math.min(startCol, endCol)
    const maxCol = Math.max(startCol, endCol)
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const target = this.findBestRenderedCellForTemplateRef(current, r, c)
        if (!target) continue
        const value = this.getCellValue(target.row, target.col)
        if (value !== undefined) values.push(value)
      }
    }
    return values
  }

  /** 模板范围语义仅在端点都落在模板边界内时启用 */
  private shouldUseTemplateRange(startRow: number, startCol: number, endRow: number, endCol: number): boolean {
    let maxTemplateRow = -1
    let maxTemplateCol = -1
    for (const row of this.grid) {
      for (const cell of row) {
        if (!cell) continue
        maxTemplateRow = Math.max(maxTemplateRow, cell.source.row)
        maxTemplateCol = Math.max(maxTemplateCol, cell.source.col)
      }
    }
    return (
      startRow >= 0 && endRow >= 0 && startCol >= 0 && endCol >= 0 &&
      startRow <= maxTemplateRow && endRow <= maxTemplateRow &&
      startCol <= maxTemplateCol && endCol <= maxTemplateCol
    )
  }
}
