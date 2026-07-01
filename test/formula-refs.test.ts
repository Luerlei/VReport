/**
 * 公式引用解析单元测试（从 CellCanvas 抽取后的 core 纯函数）
 */
import { describe, it, expect } from 'vitest'
import { extractFormulaRefs, REF_COLORS } from '../src/core/expression/FormulaRefs'

describe('extractFormulaRefs 公式引用解析', () => {
  it('非公式(不以=开头)返回空数组', () => {
    expect(extractFormulaRefs('A1')).toEqual([])
    expect(extractFormulaRefs('')).toEqual([])
    expect(extractFormulaRefs('hello world')).toEqual([])
  })

  it('解析单个单元格引用', () => {
    const refs = extractFormulaRefs('=A1')
    expect(refs).toHaveLength(1)
    expect(refs[0].isRange).toBe(false)
    expect(refs[0].cells).toHaveLength(1)
    expect(refs[0].color).toBe(REF_COLORS[0])
  })

  it('解析区域引用 A1:B2 展开为 4 个单元格', () => {
    const refs = extractFormulaRefs('=SUM(A1:B2)')
    expect(refs).toHaveLength(1)
    expect(refs[0].isRange).toBe(true)
    expect(refs[0].cells).toHaveLength(4)
  })

  it('多个引用按调色板顺序分配不同颜色', () => {
    const refs = extractFormulaRefs('=A1+B1+C1')
    expect(refs).toHaveLength(3)
    expect(refs[0].color).toBe(REF_COLORS[0])
    expect(refs[1].color).toBe(REF_COLORS[1])
    expect(refs[2].color).toBe(REF_COLORS[2])
  })

  it('区域内的单元格不重复计为单引用', () => {
    const refs = extractFormulaRefs('=SUM(A1:A3)')
    expect(refs).toHaveLength(1)
    expect(refs[0].isRange).toBe(true)
    expect(refs[0].cells).toHaveLength(3)
  })

  it('颜色按 8 色调色板循环', () => {
    const formula =
      '=' + Array.from({ length: 9 }, (_, i) => `${String.fromCharCode(65 + i)}1`).join('+')
    const refs = extractFormulaRefs(formula)
    expect(refs).toHaveLength(9)
    expect(refs[8].color).toBe(REF_COLORS[0])
  })
})
