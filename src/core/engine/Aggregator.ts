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
      params: rc.context?.params,
      getCell: (c, r) => this.getCellValue(r, c),
      getRange: (sc, sr, ec, er) => this.getRangeValues(sr, sc, er, ec),
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
}
