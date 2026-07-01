/**
 * 公式引用随展开漂移回归测试
 */
import { describe, it, expect } from 'vitest'
import { createEmptyTemplate, gridFromTemplate } from '../src/core/serializer/Serializer'
import { ExpandEngine } from '../src/core/engine/ExpandEngine'
import { Aggregator } from '../src/core/engine/Aggregator'

describe('formula references should follow expansion shifts', () => {
  it('single cell reference should follow target cell after another dataset expands above it', () => {
    const tpl = createEmptyTemplate('follow-single-cell')
    tpl.dataSets = [
      {
        id: 'set1',
        name: 'dsTop',
        sourceId: 'src1',
        extractor: {},
        cachedRows: [{ name: 'A' }, { name: 'B' }, { name: 'C' }]
      }
    ]

    const grid = gridFromTemplate(tpl)
    // A1 向下展开，会把下方静态块整体下推 2 行
    const a1 = grid.getRealCell(0, 0)!
    a1.content = '${dsTop.name}'
    a1.dataset = 'dsTop'
    a1.fieldName = 'name'
    a1.expandDirection = 'down'

    // B3 是一个普通静态值，运行时会被推到 B5
    grid.setCellContent(2, 1, '7')
    // C4 公式在设计期通过选中 B3 得到 =B3，运行时应自动跟随到被推移后的目标
    grid.setCellContent(3, 2, '=B3')

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      tpl.dataSets
    ).expand()

    const agg = new Aggregator(result.grid)
    agg.evaluateAll()

    // 模板第 3 行静态值被向下推 2 行 => 渲染行 index 4
    expect(result.grid[4][1]?.value).toBe('7')
    // 模板第 4 行公式被向下推 2 行 => 渲染行 index 5，仍应取到同一模板静态目标
    expect(result.grid[5][2]?.value).toBe('7')
  })

  it('in-template range reference should follow shifted parameter cells after expansion above', () => {
    const tpl = createEmptyTemplate('follow-range')
    tpl.dataSets = [
      {
        id: 'set1',
        name: 'dsTop',
        sourceId: 'src1',
        extractor: {},
        cachedRows: [{ name: 'A' }, { name: 'B' }, { name: 'C' }]
      }
    ]

    const grid = gridFromTemplate(tpl)
    const a1 = grid.getRealCell(0, 0)!
    a1.content = '${dsTop.name}'
    a1.dataset = 'dsTop'
    a1.fieldName = 'name'
    a1.expandDirection = 'down'

    grid.setCellContent(2, 2, '10')
    grid.setCellContent(2, 3, '20')
    grid.setCellContent(2, 4, '30')
    grid.setCellContent(3, 5, '=sum(C3:E3)')

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      tpl.dataSets
    ).expand()

    const agg = new Aggregator(result.grid)
    agg.evaluateAll()

    expect(result.grid[4][2]?.value).toBe('10')
    expect(result.grid[4][3]?.value).toBe('20')
    expect(result.grid[4][4]?.value).toBe('30')
    expect(result.grid[5][5]?.value).toBe(60)
  })

  it('oversized rendered range should keep legacy behavior for expanded-summary formulas', () => {
    const tpl = createEmptyTemplate('legacy-expanded-range')
    tpl.dataSets = [
      {
        id: 'set1',
        name: 'ds1',
        sourceId: 'src1',
        extractor: {},
        cachedRows: [{ amount: 10 }, { amount: 20 }, { amount: 30 }]
      }
    ]

    const grid = gridFromTemplate(tpl)
    const a1 = grid.getRealCell(0, 0)!
    a1.content = '${ds1.amount}'
    a1.dataset = 'ds1'
    a1.fieldName = 'amount'
    a1.expandDirection = 'down'

    // 模板内常见旧写法: 汇总范围写得很大，依赖展开后渲染行参与计算。
    grid.setCellContent(1, 0, '=sum(A1:A100)')

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      tpl.dataSets
    ).expand()

    const agg = new Aggregator(result.grid)
    agg.evaluateAll()

    expect(result.grid[3][0]?.value).toBe(60)
  })
})
