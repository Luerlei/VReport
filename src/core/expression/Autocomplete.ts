/**
 * 公式自动补全数据
 * 提供函数名联想、参数提示、示例提示、格式校验
 */
import { listFunctions, getFunction, type FuncDef } from '@/core/expression/functions'
import { Lexer } from './Lexer'

export interface FormulaSuggestion {
  name: string
  desc: string
  argCount: number
  signature: string
  category: string
  example?: string
}

/** 获取所有公式建议 */
export function getAllSuggestions(): FormulaSuggestion[] {
  const result: FormulaSuggestion[] = []
  const cats = listFunctions()
  for (const c of cats) {
    for (const f of c.funcs) {
      result.push({
        name: f.name,
        desc: f.desc,
        argCount: f.argCount,
        signature: buildSignature(f),
        category: c.category,
        example: f.example
      })
    }
  }
  return result
}

/** 构建函数签名 */
function buildSignature(f: FuncDef): string {
  if (f.argCount === 0) return `${f.name}()`
  if (f.argCount === 1) return `${f.name}(值)`
  if (f.argCount === 2) return `${f.name}(值1, 值2)`
  if (f.argCount === 3) return `${f.name}(值1, 值2, 值3)`
  if (f.argCount === -1) return `${f.name}(值1, 值2, ...)`
  return `${f.name}(...)`
}

/**
 * 根据当前输入匹配公式建议
 * @param text 编辑器完整文本
 * @param cursorPos 光标位置
 * @returns 匹配的建议列表
 */
export function matchSuggestions(text: string, cursorPos: number): FormulaSuggestion[] {
  // 仅在公式模式（= 开头）时提供
  if (!text.startsWith('=')) return []

  // 提取光标前正在输入的单词
  const before = text.substring(1, cursorPos)
  // 匹配最后一个未闭合的函数名片段
  const match = before.match(/([a-zA-Z]\w*)$/)
  if (!match) return []

  const prefix = match[1].toLowerCase()
  const all = getAllSuggestions()
  return all.filter((s) => s.name.toLowerCase().startsWith(prefix)).slice(0, 8)
}

/**
 * 检测光标所在位置的函数，返回参数提示（含示例）
 */
export function getParamHint(text: string, cursorPos: number): FormulaSuggestion | null {
  if (!text.startsWith('=')) return null
  const before = text.substring(1, cursorPos)
  // 找最后一个未闭合的左括号前的函数名
  let depth = 0
  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i] === ')') depth++
    else if (before[i] === '(') {
      if (depth === 0) {
        // 找到匹配的左括号，提取函数名
        const nameMatch = before.substring(0, i).match(/([a-zA-Z]\w*)$/)
        if (nameMatch) {
          const fn = getFunction(nameMatch[1])
          if (fn) {
            return {
              name: fn.name,
              desc: fn.desc,
              argCount: fn.argCount,
              signature: buildSignature(fn),
              category: '',
              example: fn.example
            }
          }
        }
        return null
      }
      depth--
    }
  }
  return null
}

/**
 * 公式格式校验：检测括号匹配、函数是否存在等
 * @returns 错误信息，无错误返回 null
 */
export function validateFormula(text: string): string | null {
  if (!text || !text.startsWith('=')) return null
  const expr = text.substring(1)
  if (!expr.trim()) return null
  // 括号匹配
  let depth = 0
  for (const ch of expr) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (depth < 0) return '括号不匹配：多余的右括号 ")"'
  }
  if (depth > 0) return '括号不匹配：缺少右括号 ")"'
  // 字符串引号匹配
  for (const q of ['"', "'"]) {
    const cnt = expr.split(q).length - 1
    if (cnt % 2 !== 0) return `字符串引号 ${q} 未闭合`
  }
  // 函数名合法性：提取所有 函数名( 模式并校验
  const fnMatches = expr.matchAll(/([a-zA-Z]\w*)\s*\(/g)
  for (const m of fnMatches) {
    const fname = m[1]
    // 排除关键字 if/and/or（已特殊处理，但仍校验）
    const fn = getFunction(fname)
    if (!fn) return `未知函数：${fname}()`
  }
  // 词法校验：尝试 tokenize
  try {
    new Lexer(expr).tokenize()
  } catch (e) {
    return `语法错误：${(e as Error).message}`
  }
  return null
}
