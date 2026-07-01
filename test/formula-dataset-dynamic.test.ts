/**
 * 数据集变量动态公式测试
 * 场景: 静态汇总格中使用 ${ds.field}，应自动随数据集行数变化聚合。
 */
import { describe, it, expect } from 'vitest'
import { createEmptyTemplate, gridFromTemplate } from '../src/core/serializer/Serializer'
import { ExpandEngine } from '../src/core/engine/ExpandEngine'
import { Aggregator } from '../src/core/engine/Aggregator'

describe('dynamic dataset variable in formula', () => {
  it('sum(${ds.amount}) should aggregate over whole dataset in static cell', () => {
    const tpl = createEmptyTemplate('dynamic-ds-formula')
    tpl.dataSets = [
      {
        id: 'set1',
        name: 'ds1',
        sourceId: 'src1',
        extractor: {},
        cachedRows: [
          { amount: 10 },
          { amount: 20 },
          { amount: 30 }
        ]
      }
    ]

    const grid = gridFromTemplate(tpl)
    // 静态汇总格(不展开)
    grid.setCellContent(0, 0, '=sum(${ds1.amount})')

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      tpl.dataSets
    ).expand()

    const agg = new Aggregator(result.grid)
    agg.evaluateAll()

    expect(result.grid[0][0]?.value).toBe(60)
  })

  it('row context should still prefer current row value for ${ds.field}', () => {
    const tpl = createEmptyTemplate('row-context-ds-formula')
    tpl.dataSets = [
      {
        id: 'set1',
        name: 'ds1',
        sourceId: 'src1',
        extractor: {},
        cachedRows: [
          { amount: 11 },
          { amount: 22 },
          { amount: 33 }
        ]
      }
    ]

    const grid = gridFromTemplate(tpl)
    // A1 向下展开为每行金额
    const a1 = grid.getRealCell(0, 0)!
    a1.content = '${ds1.amount}'
    a1.dataset = 'ds1'
    a1.fieldName = 'amount'
    a1.expandDirection = 'down'

    // B1 同行跟随上下文，引用当前行 amount
    grid.setCellContent(0, 1, '= ${ds1.amount}')

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      tpl.dataSets
    ).expand()

    const agg = new Aggregator(result.grid)
    agg.evaluateAll()

    expect(result.grid[0][1]?.value).toBe(11)
    expect(result.grid[1][1]?.value).toBe(22)
    expect(result.grid[2][1]?.value).toBe(33)
  })
})
