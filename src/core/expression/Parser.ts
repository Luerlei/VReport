/**
 * 语法分析器（递归下降）
 * 将 Token 流解析为 AST
 *
 * 文法（优先级从低到高）：
 *   expr      := concat
 *   concat    := comparison ( '&' comparison )*
 *   comparison:= equality ( ('='|'<>'|'!='|'>'|'<'|'>='|'<=') equality )*
 *   equality  := additive ( ('='|'<>') additive )*  // 合并到 comparison
 *   additive   := multiplicative ( ('+'|'-') multiplicative )*
 *   multiplicative := unary ( ('*'|'/'|'%') unary )*
 *   unary     := ('+'|'-') unary | postfix
 *   postfix   := primary ( ':' primary )?    // 区域 A1:B2
 *   primary   := number | string | boolean | fieldRef | cellRef | funcCall | '(' expr ')'
 *   funcCall  := identifier '(' (expr (',' expr)*)? ')'
 */
import { Lexer } from './Lexer'
import { AstNode, AstType, EvalContext, Token, TokenType, classifyExpr } from './types'
import { parseCellRef } from './Lexer'

export class Parser {
  private tokens: Token[]
  private pos = 0

  constructor(src: string) {
    this.tokens = new Lexer(src).tokenize()
  }

  parse(): AstNode {
    const node = this.parseExpr()
    if (this.peek().type !== TokenType.EOF) {
      throw new Error(`语法错误：未预期的 token "${this.peek().value}" 于位置 ${this.peek().pos}`)
    }
    return node
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)]
  }

  private next(): Token {
    return this.tokens[this.pos++]
  }

  private expect(type: TokenType): Token {
    const t = this.peek()
    if (t.type !== type) {
      throw new Error(`语法错误：期望 ${type}，实际 ${t.type}("${t.value}") 于位置 ${t.pos}`)
    }
    return this.next()
  }

  private parseExpr(): AstNode {
    return this.parseComparison()
  }

  private parseComparison(): AstNode {
    let left = this.parseConcat()
    while (
      [TokenType.OpEq, TokenType.OpNe, TokenType.OpGt, TokenType.OpLt, TokenType.OpGe, TokenType.OpLe].includes(
        this.peek().type
      )
    ) {
      const op = this.next().type
      const right = this.parseConcat()
      left = { type: AstType.BinaryOp, op, left, right }
    }
    return left
  }

  private parseConcat(): AstNode {
    let left = this.parseAdditive()
    while (this.peek().type === TokenType.OpConcat) {
      this.next()
      const right = this.parseAdditive()
      left = { type: AstType.BinaryOp, op: TokenType.OpConcat, left, right }
    }
    return left
  }

  private parseAdditive(): AstNode {
    let left = this.parseMultiplicative()
    while ([TokenType.OpPlus, TokenType.OpMinus].includes(this.peek().type)) {
      const op = this.next().type
      const right = this.parseMultiplicative()
      left = { type: AstType.BinaryOp, op, left, right }
    }
    return left
  }

  private parseMultiplicative(): AstNode {
    let left = this.parseUnary()
    while ([TokenType.OpMul, TokenType.OpDiv, TokenType.OpMod].includes(this.peek().type)) {
      const op = this.next().type
      const right = this.parseUnary()
      left = { type: AstType.BinaryOp, op, left, right }
    }
    return left
  }

  private parseUnary(): AstNode {
    if ([TokenType.OpPlus, TokenType.OpMinus].includes(this.peek().type)) {
      const op = this.next().type
      const operand = this.parseUnary()
      return { type: AstType.UnaryOp, op, operand }
    }
    return this.parseRange()
  }

  private parseRange(): AstNode {
    const left = this.parsePrimary()
    if (this.peek().type === TokenType.Colon) {
      this.next()
      const right = this.parsePrimary()
      // 仅单元格引用支持区域
      if (left.type !== AstType.CellRef || right.type !== AstType.CellRef) {
        throw new Error('语法错误：区域运算符 ":" 仅支持单元格引用')
      }
      return { type: AstType.CellRange, start: left, end: right }
    }
    return left
  }

  private parsePrimary(): AstNode {
    const t = this.peek()
    switch (t.type) {
      case TokenType.Number:
        this.next()
        return { type: AstType.Number, value: parseFloat(t.value) }
      case TokenType.String:
        this.next()
        return { type: AstType.String, value: t.value }
      case TokenType.Boolean:
        this.next()
        return { type: AstType.Boolean, value: t.value === 'true' }
      case TokenType.FieldRef:
        this.next()
        return { type: AstType.FieldRef, path: t.value }
      case TokenType.CellRef:
        this.next()
        return this.makeCellRefNode(t.value)
      case TokenType.Identifier: {
        this.next()
        // 函数调用
        if (this.peek().type === TokenType.LParen) {
          this.next()
          const args: AstNode[] = []
          if (this.peek().type !== TokenType.RParen) {
            args.push(this.parseExpr())
            while (this.peek().type === TokenType.Comma) {
              this.next()
              args.push(this.parseExpr())
            }
          }
          this.expect(TokenType.RParen)
          return { type: AstType.FunctionCall, name: t.value, args }
        }
        // 裸标识符视为字段引用（无 ${} 包裹的简写）
        return { type: AstType.FieldRef, path: t.value }
      }
      case TokenType.LParen: {
        this.next()
        const node = this.parseExpr()
        this.expect(TokenType.RParen)
        return node
      }
      default:
        throw new Error(`语法错误：未预期的 token ${t.type}("${t.value}") 于位置 ${t.pos}`)
    }
  }

  private makeCellRefNode(raw: string): AstNode {
    const { col, row, colAbs, rowAbs } = parseCellRef(raw)
    return { type: AstType.CellRef, col, row, colAbs, rowAbs, raw }
  }
}

/**
 * 解析表达式内容
 * - 纯文本：原样返回
 * - 简单表达式 ${...}：提取内部表达式解析
 * - 公式 =...：去掉 = 后解析
 */
export function parseExpression(content: string): { isText: boolean; text?: string; ast?: AstNode } {
  const type = classifyExpr(content)
  if (type === 'text') {
    return { isText: true, text: content }
  }
  if (type === 'simple') {
    // ${expr} 形式，提取所有 ${} 内容，拼接为字符串模板
    // 单个 ${} 时直接解析内部表达式
    const matches = content.match(/\$\{([^}]+)\}/g)
    if (matches && matches.length === 1 && matches[0] === content.trim()) {
      const inner = content.trim().slice(2, -1)
      return { isText: false, ast: new Parser(inner).parse() }
    }
    // 多个 ${} 或混合文本：转为 concat 表达式
    return { isText: false, ast: parseTemplateString(content) }
  }
  // formula
  const expr = content.slice(1)
  return { isText: false, ast: new Parser(expr).parse() }
}

/**
 * 解析模板字符串 "${a}-${b}" 为 concat(a, "-", b)
 */
function parseTemplateString(content: string): AstNode {
  const parts: AstNode[] = []
  let remaining = content
  let idx = 0
  while (remaining.length > 0) {
    const m = remaining.match(/^\$\{([^}]+)\}/)
    if (m) {
      const inner = m[1]
      parts.push(new Parser(inner).parse())
      remaining = remaining.slice(m[0].length)
    } else {
      // 普通文本，找到下一个 ${ 的位置
      const next = remaining.indexOf('${')
      const text = next === -1 ? remaining : remaining.slice(0, next)
      parts.push({ type: AstType.String, value: text })
      remaining = next === -1 ? '' : remaining.slice(next)
    }
    idx++
    if (idx > 1000) break // 防止死循环
  }
  if (parts.length === 1) return parts[0]
  // 用 concat 运算符连接
  return parts.reduce((acc, cur) => ({
    type: AstType.BinaryOp,
    op: TokenType.OpConcat,
    left: acc,
    right: cur
  }))
}
