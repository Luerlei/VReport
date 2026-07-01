/**
 * 表达式求值器
 * 遍历 AST 求值，支持字段引用、单元格引用、函数调用、运算符
 */
import { AstNode, AstType, EvalContext, TokenType } from './types'
import { getFunction } from './functions'

export class Evaluator {
  /** 缓存已解析的 AST，避免重复解析 */
  private static astCache = new Map<string, AstNode>()

  /** 求值入口：传入 AST 与上下文 */
  evaluate(ast: AstNode, ctx: EvalContext): unknown {
    switch (ast.type) {
      case AstType.Number:
        return ast.value
      case AstType.String:
        return ast.value
      case AstType.Boolean:
        return ast.value
      case AstType.FieldRef:
        return this.evalFieldRef(ast.path, ctx)
      case AstType.CellRef:
        return this.evalCellRef(ast, ctx)
      case AstType.CellRange:
        return this.evalCellRange(ast.start as any, ast.end as any, ctx)
      case AstType.UnaryOp:
        return this.evalUnary(ast.op, ast.operand, ctx)
      case AstType.BinaryOp:
        return this.evalBinary(ast.op, ast.left, ast.right, ctx)
      case AstType.FunctionCall:
        return this.evalFunction(ast.name, ast.args, ctx)
      default:
        throw new Error(`未知 AST 节点类型：${(ast as any).type}`)
    }
  }

  /** 字段引用：从上下文 rowData 取值，沿父链向上查找 */
  private evalFieldRef(path: string, ctx: EvalContext): unknown {
    // 支持 ds1.name / param.x / name 三种形式
    const parts = path.split('.').filter(Boolean)
    // 尝试在上下文链中查找
    let curCtx: EvalContext | undefined = ctx
    while (curCtx) {
      if (curCtx.rowData) {
        // 先尝试完整路径（如 ds1.name）
        const val = resolvePath(curCtx.rowData, parts)
        if (val !== undefined) return val
        // 若路径有多段且第一段是数据集名，尝试去掉前缀直接取字段
        // 例如 ds1.region -> rowData.region
        if (parts.length > 1) {
          const val2 = resolvePath(curCtx.rowData, parts.slice(1))
          if (val2 !== undefined) return val2
        }
      }
      if (curCtx.params && parts[0] === 'param') {
        const val = resolvePath(curCtx.params, parts.slice(1))
        if (val !== undefined) return val
      }

      // 动态数据集变量: 当无当前行字段值时，支持 ${ds.field} 返回整列数组。
      // 例如 sum(${order.amount}) 在静态汇总格中可随数据集行数变化自动计算。
      if (curCtx.datasetRows && parts.length > 1 && parts[0] !== 'param') {
        const rows = curCtx.datasetRows[parts[0]]
        if (Array.isArray(rows) && rows.length) {
          const values = rows
            .map((row) => resolvePath(row as Record<string, unknown>, parts.slice(1)))
            .filter((v) => v !== undefined)
          if (values.length) return values
        }
      }
      curCtx = curCtx.parent
    }
    return undefined
  }

  /** 单元格引用 */
  private evalCellRef(node: Extract<AstNode, { type: AstType.CellRef }>, ctx: EvalContext): unknown {
    if (!ctx.getCell) return undefined
    return ctx.getCell(node.col, node.row)
  }

  /** 单元格区域 */
  private evalCellRange(
    start: { col: number; row: number },
    end: { col: number; row: number },
    ctx: EvalContext
  ): unknown[] {
    if (!ctx.getRange) return []
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    return ctx.getRange(minCol, minRow, maxCol, maxRow)
  }

  /** 一元运算 */
  private evalUnary(op: TokenType, operand: AstNode, ctx: EvalContext): unknown {
    const v = this.evaluate(operand, ctx)
    if (op === TokenType.OpMinus) return -toNum(v)
    if (op === TokenType.OpPlus) return toNum(v)
    return v
  }

  /** 二元运算 */
  private evalBinary(op: TokenType, left: AstNode, right: AstNode, ctx: EvalContext): unknown {
    // 短路求值：if 函数已处理，这里 and/or 也需短路
    if (op === TokenType.OpConcat) {
      return toStr(this.evaluate(left, ctx)) + toStr(this.evaluate(right, ctx))
    }
    const lv = this.evaluate(left, ctx)
    const rv = this.evaluate(right, ctx)
    switch (op) {
      case TokenType.OpPlus: return toNum(lv) + toNum(rv)
      case TokenType.OpMinus: return toNum(lv) - toNum(rv)
      case TokenType.OpMul: return toNum(lv) * toNum(rv)
      case TokenType.OpDiv: return toNum(lv) / toNum(rv)
      case TokenType.OpMod: return toNum(lv) % toNum(rv)
      case TokenType.OpEq: return looseEqual(lv, rv)
      case TokenType.OpNe: return !looseEqual(lv, rv)
      case TokenType.OpGt: return toNum(lv) > toNum(rv)
      case TokenType.OpLt: return toNum(lv) < toNum(rv)
      case TokenType.OpGe: return toNum(lv) >= toNum(rv)
      case TokenType.OpLe: return toNum(lv) <= toNum(rv)
      default: throw new Error(`未知运算符：${op}`)
    }
  }

  /** 函数调用 */
  private evalFunction(name: string, args: AstNode[], ctx: EvalContext): unknown {
    const fn = getFunction(name)
    if (!fn) throw new Error(`未知函数：${name}`)
    // 特殊处理 if/and/or/case 的短路
    if (name.toLowerCase() === 'if') {
      const cond = this.evaluate(args[0], ctx)
      return toBool(cond) ? this.evaluate(args[1], ctx) : this.evaluate(args[2], ctx)
    }
    if (name.toLowerCase() === 'and') {
      return args.every((a) => toBool(this.evaluate(a, ctx)))
    }
    if (name.toLowerCase() === 'or') {
      return args.some((a) => toBool(this.evaluate(a, ctx)))
    }
    // 普通函数：先求值所有参数
    const argValues = args.map((a) => this.evaluate(a, ctx))
    // 校验参数数量
    if (fn.argCount >= 0 && argValues.length !== fn.argCount) {
      throw new Error(`函数 ${name} 需要 ${fn.argCount} 个参数，实际 ${argValues.length} 个`)
    }
    return fn.impl(argValues, ctx)
  }
}

/** 工具：转数字 */
function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (v == null || v === '') return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

/** 工具：转字符串 */
function toStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** 工具：转布尔 */
function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v !== '' && v !== '0' && v.toLowerCase() !== 'false'
  return !!v
}

/** 工具：宽松相等（类型转换后比较） */
function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a == b
  // 数字与字符串比较
  if (typeof a === 'number' || typeof b === 'number') {
    return toNum(a) === toNum(b)
  }
  return String(a) === String(b)
}

/** 工具：按路径取值 */
function resolvePath(obj: Record<string, unknown>, parts: string[]): unknown {
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

/** 单例 */
export const evaluator = new Evaluator()
