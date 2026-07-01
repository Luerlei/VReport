/**
 * 词法分析器
 * 将表达式字符串转为 Token 流
 *
 * 支持的词法：
 *  - 数字：123, 123.45
 *  - 字符串："abc" 或 'abc'
 *  - 布尔：true / false
 *  - 标识符：sum, if, myFunc
 *  - 单元格引用：A1, $A$1, B$2
 *  - 字段引用：${ds1.name}, ${param.x}, ${name}（在预处理阶段已提取）
 *  - 运算符：+ - * / % & = <> > < >= <=
 *  - 括号、逗号、冒号
 */
import { Token, TokenType } from './types'

export class Lexer {
  private src: string
  private pos = 0
  private tokens: Token[] = []

  constructor(src: string) {
    this.src = src
  }

  tokenize(): Token[] {
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos]
      // 跳过空白
      if (/\s/.test(ch)) {
        this.pos++
        continue
      }
      // 字段引用 ${...}
      if (ch === '$' && this.src[this.pos + 1] === '{') {
        this.readFieldRef()
        continue
      }
      // 数字
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(this.src[this.pos + 1] ?? ''))) {
        this.readNumber()
        continue
      }
      // 字符串
      if (ch === '"' || ch === "'") {
        this.readString(ch)
        continue
      }
      // 标识符或单元格引用（字母或 $ 开头）
      if (/[a-zA-Z_$]/.test(ch)) {
        this.readIdentifierOrCell()
        continue
      }
      // 运算符
      if (this.readOperator()) continue
      // 符号
      if (ch === '(') { this.push(TokenType.LParen, ch); this.pos++; continue }
      if (ch === ')') { this.push(TokenType.RParen, ch); this.pos++; continue }
      if (ch === ',') { this.push(TokenType.Comma, ch); this.pos++; continue }
      if (ch === ':') { this.push(TokenType.Colon, ch); this.pos++; continue }
      // 未知字符
      throw new Error(`词法错误：未知字符 "${ch}" 于位置 ${this.pos}`)
    }
    this.push(TokenType.EOF, '')
    return this.tokens
  }

  /** 读取字段引用 ${...} */
  private readFieldRef() {
    const start = this.pos
    this.pos += 2 // 跳过 ${
    let s = ''
    while (this.pos < this.src.length && this.src[this.pos] !== '}') {
      s += this.src[this.pos]
      this.pos++
    }
    if (this.pos >= this.src.length) throw new Error('词法错误：字段引用未闭合 ${...}')
    this.pos++ // 跳过 }
    this.tokens.push({ type: TokenType.FieldRef, value: s, pos: start })
  }

  private push(type: TokenType, value: string) {
    this.tokens.push({ type, value, pos: this.pos })
  }

  private readNumber() {
    const start = this.pos
    let s = ''
    while (this.pos < this.src.length && /[0-9.]/.test(this.src[this.pos])) {
      s += this.src[this.pos]
      this.pos++
    }
    this.tokens.push({ type: TokenType.Number, value: s, pos: start })
  }

  private readString(quote: string) {
    const start = this.pos
    this.pos++ // 跳过开头引号
    let s = ''
    while (this.pos < this.src.length && this.src[this.pos] !== quote) {
      if (this.src[this.pos] === '\\') {
        // 转义
        this.pos++
        const next = this.src[this.pos]
        s += next === 'n' ? '\n' : next === 't' ? '\t' : next ?? ''
      } else {
        s += this.src[this.pos]
      }
      this.pos++
    }
    if (this.pos >= this.src.length) throw new Error('词法错误：字符串未闭合')
    this.pos++ // 跳过结尾引号
    this.tokens.push({ type: TokenType.String, value: s, pos: start })
  }

  private readIdentifierOrCell() {
    const start = this.pos
    let s = ''
    // 读取 $ 字母 数字（用于 $A$1 等）
    while (this.pos < this.src.length && /[a-zA-Z0-9_$]/.test(this.src[this.pos])) {
      s += this.src[this.pos]
      this.pos++
    }
    // 支持字段路径中的点号：ds1.region / param.x
    // 点号后必须跟字母/数字/_，避免与数字小数点冲突
    while (
      this.src[this.pos] === '.' &&
      /[a-zA-Z0-9_$]/.test(this.src[this.pos + 1] ?? '')
    ) {
      s += '.'
      this.pos++
      while (this.pos < this.src.length && /[a-zA-Z0-9_$]/.test(this.src[this.pos])) {
        s += this.src[this.pos]
        this.pos++
      }
    }
    // 判断是单元格引用还是标识符
    if (isCellRef(s)) {
      this.tokens.push({ type: TokenType.CellRef, value: s, pos: start })
    } else if (s === 'true' || s === 'false') {
      this.tokens.push({ type: TokenType.Boolean, value: s, pos: start })
    } else {
      this.tokens.push({ type: TokenType.Identifier, value: s, pos: start })
    }
  }

  private readOperator(): boolean {
    const ch = this.src[this.pos]
    const next = this.src[this.pos + 1] ?? ''
    const start = this.pos
    // 双字符运算符
    if (ch === '>' && next === '=') { this.push(TokenType.OpGe, '>='); this.pos += 2; return true }
    if (ch === '<' && next === '=') { this.push(TokenType.OpLe, '<='); this.pos += 2; return true }
    if (ch === '<' && next === '>') { this.push(TokenType.OpNe, '<>'); this.pos += 2; return true }
    if (ch === '!' && next === '=') { this.push(TokenType.OpNe, '!='); this.pos += 2; return true }
    // 单字符运算符
    const map: Record<string, TokenType> = {
      '+': TokenType.OpPlus,
      '-': TokenType.OpMinus,
      '*': TokenType.OpMul,
      '/': TokenType.OpDiv,
      '%': TokenType.OpMod,
      '&': TokenType.OpConcat,
      '=': TokenType.OpEq,
      '>': TokenType.OpGt,
      '<': TokenType.OpLt
    }
    if (map[ch]) {
      this.push(map[ch], ch)
      this.pos++
      return true
    }
    return false
  }
}

/** 判断字符串是否为单元格引用，如 A1, $A$1, B$2 */
export function isCellRef(s: string): boolean {
  return /^\$?[A-Za-z]+\$?[0-9]+$/.test(s)
}

/** 解析单元格引用为 {col, row, colAbs, rowAbs} */
export function parseCellRef(s: string): { col: number; row: number; colAbs: boolean; rowAbs: boolean } {
  const m = s.match(/^(\$?)([A-Za-z]+)(\$?)([0-9]+)$/)
  if (!m) throw new Error(`无效的单元格引用：${s}`)
  const colAbs = m[1] === '$'
  const col = colNameToIndex(m[2])
  const rowAbs = m[3] === '$'
  const row = parseInt(m[4], 10) - 1
  return { col, row, colAbs, rowAbs }
}

/** 列名转列索引 A->0, Z->25, AA->26 */
export function colNameToIndex(name: string): number {
  let idx = 0
  const upper = name.toUpperCase()
  for (let i = 0; i < upper.length; i++) {
    idx = idx * 26 + (upper.charCodeAt(i) - 64)
  }
  return idx - 1
}
