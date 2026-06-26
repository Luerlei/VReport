/**
 * 条件格式引擎
 * 根据规则匹配单元格值，返回应用的样式覆盖
 */
import type { CellStyle } from '@/core/cell/types'
import type { ConditionFormat, ConditionRule } from '@/types'
import { evaluator } from '@/core/expression/Evaluator'
import { parseExpression } from '@/core/expression/Parser'
import type { EvalContext } from '@/core/expression/types'

export class ConditionEngine {
  private formats: ConditionFormat[]

  constructor(formats: ConditionFormat[]) {
    this.formats = formats
  }

  /**
   * 为指定单元格值计算命中的样式
   * @param cellName 单元格名 A1
   * @param value 单元格值
   * @param ctx 求值上下文（用于表达式规则）
   * @returns 合并后的样式覆盖（可能为空）
   */
  resolve(cellName: string, value: unknown, ctx?: EvalContext): Partial<CellStyle> {
    let result: Partial<CellStyle> = {}
    for (const fmt of this.formats) {
      if (!this.inScope(fmt.scope, cellName)) continue
      for (const rule of fmt.rules) {
        if (this.matchRule(rule, value, ctx)) {
          result = { ...result, ...rule.style }
        }
      }
    }
    return result
  }

  /** 判断单元格是否在条件格式作用范围内 */
  private inScope(scope: string, cellName: string): boolean {
    if (!scope) return false
    // 支持 "A1:A10" 区域 或 "A1" 单个
    if (scope.includes(':')) {
      const [start, end] = scope.split(':')
      return compareCellName(cellName, start) >= 0 && compareCellName(cellName, end) <= 0
    }
    return scope === cellName
  }

  /** 判断规则是否命中 */
  private matchRule(rule: ConditionRule, value: unknown, ctx?: EvalContext): boolean {
    if (rule.type === 'cellValue') {
      const n = toNum(value)
      const target = toNum(rule.value)
      switch (rule.operator) {
        case 'gt': return n > target
        case 'lt': return n < target
        case 'eq': return n === target
        case 'ne': return n !== target
        case 'ge': return n >= target
        case 'le': return n <= target
        case 'between': {
          const vals = rule.value as [number, number]
          return n >= vals[0] && n <= vals[1]
        }
        case 'contains': return String(value).includes(String(rule.value))
        default: return false
      }
    }
    if (rule.type === 'expression' && rule.expression) {
      try {
        const { ast } = parseExpression(rule.expression)
        if (!ast) return false
        const result = evaluator.evaluate(ast, ctx ?? {})
        return !!result
      } catch {
        return false
      }
    }
    return false
  }
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (v == null || v === '') return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

/** 简单的单元格名比较（按字母+数字，不区分大小写） */
function compareCellName(a: string, b: string): number {
  const ma = a.match(/^([A-Za-z]+)(\d+)$/)
  const mb = b.match(/^([A-Za-z]+)(\d+)$/)
  if (!ma || !mb) return a.localeCompare(b)
  const ca = ma[1].toUpperCase()
  const cb = mb[1].toUpperCase()
  if (ca !== cb) return ca < cb ? -1 : 1
  return parseInt(ma[2]) - parseInt(mb[2])
}
