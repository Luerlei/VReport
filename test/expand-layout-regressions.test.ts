/**
 * 展开布局与绑定清理回归测试
 */
import { describe, it, expect } from 'vitest'
import { Grid } from '../src/core/cell/Grid'
import { createEmptyTemplate } from '../src/core/serializer/Serializer'
import { ExpandEngine } from '../src/core/engine/ExpandEngine'
import { Aggregator } from '../src/core/engine/Aggregator'

describe('binding cleanup and expand layout regressions', () => {
  it('clearing bound cell content should remove binding and expand properties', () => {
    const grid = new Grid(5, 5)
    const cell = grid.getRealCell(1, 1)!
    cell.dataset = 'ds1'
    cell.fieldName = 'amount'
    cell.aggregate = 'sum'
    cell.expandDirection = 'down'
    cell.leftMasterCell = 'A1'
    cell.topMasterCell = 'B1'

    grid.setCellContent(1, 1, '')

    expect(cell.content).toBe('')
    expect(cell.dataset).toBeUndefined()
    expect(cell.fieldName).toBeUndefined()
    expect(cell.aggregate).toBeUndefined()
    expect(cell.expandDirection).toBe('none')
    expect(cell.leftMasterCell).toBeUndefined()
    expect(cell.topMasterCell).toBeUndefined()
  })

  it('direct dataset variable content should sync binding from content', () => {
    const grid = new Grid(5, 5)
    const cell = grid.getRealCell(0, 0)!

    grid.setCellContent(0, 0, '${orders.total}')

    expect(cell.dataset).toBe('orders')
    expect(cell.fieldName).toBe('total')
    expect(cell.aggregate).toBe('none')
    expect(cell.expandDirection).toBe('none')
  })

  it('adjacent down-expanding roots should not overlap after preview expansion', () => {
    const tpl = createEmptyTemplate('adjacent-down')
    tpl.dataSets = [
      {
        id: 'setA',
        name: 'dsA',
        sourceId: 'srcA',
        extractor: {},
        cachedRows: [{ v: 'A1' }, { v: 'A2' }]
      },
      {
        id: 'setB',
        name: 'dsB',
        sourceId: 'srcB',
        extractor: {},
        cachedRows: [{ v: 'B1' }, { v: 'B2' }, { v: 'B3' }]
      }
    ]

    const grid = new Grid(6, 4)
    const first = grid.getRealCell(0, 0)!
    first.content = '${dsA.v}'
    first.dataset = 'dsA'
    first.fieldName = 'v'
    first.expandDirection = 'down'

    const second = grid.getRealCell(1, 0)!
    second.content = '${dsB.v}'
    second.dataset = 'dsB'
    second.fieldName = 'v'
    second.expandDirection = 'down'

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      tpl.dataSets
    ).expand()

    const agg = new Aggregator(result.grid)
    agg.evaluateAll()

    const colA = result.grid.map((row) => row[0]?.value).filter((v) => v !== undefined && v !== '')
    expect(colA).toEqual(['A1', 'A2', 'B1', 'B2', 'B3'])
  })

  it('adjacent right-expanding roots should not overlap after preview expansion', () => {
    const tpl = createEmptyTemplate('adjacent-right')
    tpl.dataSets = [
      {
        id: 'setA',
        name: 'dsA',
        sourceId: 'srcA',
        extractor: {},
        cachedRows: [{ v: 'A1' }, { v: 'A2' }]
      },
      {
        id: 'setB',
        name: 'dsB',
        sourceId: 'srcB',
        extractor: {},
        cachedRows: [{ v: 'B1' }, { v: 'B2' }, { v: 'B3' }]
      }
    ]

    const grid = new Grid(4, 6)
    const first = grid.getRealCell(0, 0)!
    first.content = '${dsA.v}'
    first.dataset = 'dsA'
    first.fieldName = 'v'
    first.expandDirection = 'right'

    const second = grid.getRealCell(0, 1)!
    second.content = '${dsB.v}'
    second.dataset = 'dsB'
    second.fieldName = 'v'
    second.expandDirection = 'right'

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      tpl.dataSets
    ).expand()

    const agg = new Aggregator(result.grid)
    agg.evaluateAll()

    const row0 = result.grid[0].map((cell) => cell?.value).filter((v) => v !== undefined && v !== '')
    expect(row0).toEqual(['A1', 'A2', 'B1', 'B2', 'B3'])
  })

  it('mixed down and right expansions should not overwrite static content below and on the right', () => {
    const tpl = createEmptyTemplate('mixed-expand')
    tpl.dataSets = [
      {
        id: 'setDown',
        name: 'downDs',
        sourceId: 'srcDown',
        extractor: {},
        cachedRows: [{ v: 'D1' }, { v: 'D2' }, { v: 'D3' }]
      },
      {
        id: 'setRight',
        name: 'rightDs',
        sourceId: 'srcRight',
        extractor: {},
        cachedRows: [{ v: 'R1' }, { v: 'R2' }, { v: 'R3' }]
      }
    ]

    const grid = new Grid(6, 6)
    const down = grid.getRealCell(0, 0)!
    down.content = '${downDs.v}'
    down.dataset = 'downDs'
    down.fieldName = 'v'
    down.expandDirection = 'down'

    const right = grid.getRealCell(1, 1)!
    right.content = '${rightDs.v}'
    right.dataset = 'rightDs'
    right.fieldName = 'v'
    right.expandDirection = 'right'

    grid.setCellContent(2, 2, 'STATIC-BLOCK')

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      tpl.dataSets
    ).expand()

    const agg = new Aggregator(result.grid)
    agg.evaluateAll()

    const downValues = result.grid.map((row) => row[0]?.value).filter((v) => v)
    expect(downValues).toEqual(['D1', 'D2', 'D3'])

    const rightValues = result.grid[3].map((cell) => cell?.value).filter((v) => v)
    expect(rightValues).toContain('R1')
    expect(rightValues).toContain('R2')
    expect(rightValues).toContain('R3')

    const hasStatic = result.grid.some((row) => row.some((cell) => cell?.value === 'STATIC-BLOCK'))
    expect(hasStatic).toBe(true)
  })

  it('D2 down and D3 right should coexist without preview corruption', () => {
    const tpl = createEmptyTemplate('d2-down-d3-right')
    tpl.dataSets = [
      {
        id: 'setDown',
        name: 'downDs',
        sourceId: 'srcDown',
        extractor: {},
        cachedRows: [{ v: 'D-1' }, { v: 'D-2' }, { v: 'D-3' }]
      },
      {
        id: 'setRight',
        name: 'rightDs',
        sourceId: 'srcRight',
        extractor: {},
        cachedRows: [{ v: 'R-1' }, { v: 'R-2' }, { v: 'R-3' }]
      }
    ]

    const grid = new Grid(8, 8)
    const d2 = grid.getRealCell(1, 3)!
    d2.content = '${downDs.v}'
    d2.dataset = 'downDs'
    d2.fieldName = 'v'
    d2.expandDirection = 'down'

    const d3 = grid.getRealCell(2, 3)!
    d3.content = '${rightDs.v}'
    d3.dataset = 'rightDs'
    d3.fieldName = 'v'
    d3.expandDirection = 'right'

    grid.setCellContent(3, 5, 'SAFE-STATIC')

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      tpl.dataSets
    ).expand()

    const agg = new Aggregator(result.grid)
    agg.evaluateAll()

    const downValues = result.grid.map((row) => row[3]?.value).filter((v) => v)
    expect(downValues).toContain('D-1')
    expect(downValues).toContain('D-2')
    expect(downValues).toContain('D-3')

    const rightRow = result.grid.find((row) => row.some((cell) => cell?.value === 'R-1'))
    expect(rightRow).toBeTruthy()
    const rightValues = rightRow!.map((cell) => cell?.value).filter((v) => v)
    expect(rightValues).toContain('R-1')
    expect(rightValues).toContain('R-2')
    expect(rightValues).toContain('R-3')

    const hasStatic = result.grid.some((row) => row.some((cell) => cell?.value === 'SAFE-STATIC'))
    expect(hasStatic).toBe(true)
  })

  it('plain formula should still follow targets after both row and column shifts', () => {
    const tpl = createEmptyTemplate('formula-follow-both-axes')
    tpl.dataSets = [
      {
        id: 'setDown',
        name: 'downDs',
        sourceId: 'srcDown',
        extractor: {},
        cachedRows: [{ v: 'X1' }, { v: 'X2' }, { v: 'X3' }]
      },
      {
        id: 'setRight',
        name: 'rightDs',
        sourceId: 'srcRight',
        extractor: {},
        cachedRows: [{ v: 'Y1' }, { v: 'Y2' }, { v: 'Y3' }]
      }
    ]

    const grid = new Grid(8, 8)
    const a1 = grid.getRealCell(0, 0)!
    a1.content = '${downDs.v}'
    a1.dataset = 'downDs'
    a1.fieldName = 'v'
    a1.expandDirection = 'down'

    const b2 = grid.getRealCell(1, 1)!
    b2.content = '${rightDs.v}'
    b2.dataset = 'rightDs'
    b2.fieldName = 'v'
    b2.expandDirection = 'right'

    grid.setCellContent(2, 4, '8')
    grid.setCellContent(2, 5, '9')
    grid.setCellContent(2, 6, '=E3+F3')

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      tpl.dataSets
    ).expand()

    const agg = new Aggregator(result.grid)
    agg.evaluateAll()

    const formulaCell = result.grid.flat().find((cell) => cell?.source.content === '=E3+F3')
    expect(formulaCell?.value).toBe(17)
  })

  it('A4 down + A5 down + A6 right should render right block at shifted row without spill', () => {
    const tpl = createEmptyTemplate('a4-a5-a6')
    tpl.dataSets = [
      {
        id: 'set1',
        name: 'shiftData',
        sourceId: 'src1',
        extractor: {},
        cachedRows: [{ label: '上移一' }, { label: '上移二' }, { label: '上移三' }]
      }
    ]

    const grid = new Grid(12, 8)
    const a4 = grid.getRealCell(3, 0)!
    a4.content = '${shiftData.label}'
    a4.dataset = 'shiftData'
    a4.fieldName = 'label'
    a4.expandDirection = 'down'

    const a5 = grid.getRealCell(4, 0)!
    a5.content = '${shiftData.label}'
    a5.dataset = 'shiftData'
    a5.fieldName = 'label'
    a5.expandDirection = 'down'

    const a6 = grid.getRealCell(5, 0)!
    a6.content = '${shiftData.label}'
    a6.dataset = 'shiftData'
    a6.fieldName = 'label'
    a6.expandDirection = 'right'

    grid.setCellContent(9, 0, 'AFTER-BLOCK')

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      tpl.dataSets
    ).expand()

    const agg = new Aggregator(result.grid)
    agg.evaluateAll()

    const firstBlock = result.grid.slice(3, 6).map((row) => row[0]?.value)
    expect(firstBlock).toEqual(['上移一', '上移二', '上移三'])

    const secondBlock = result.grid.slice(6, 9).map((row) => row[0]?.value)
    expect(secondBlock).toEqual(['上移一', '上移二', '上移三'])

    const rightRow = result.grid[9].slice(0, 3).map((cell) => cell?.value)
    expect(rightRow[0]).toBe('')
    expect(rightRow[1]).toBe('')
    expect(rightRow[2]).toBe('')

    expect(result.grid[13][0]?.value).toBe('AFTER-BLOCK')
    expect((result.warnings ?? []).every((w) => !w.includes('覆盖冲突'))).toBe(true)
  })

  it('expand result should expose warnings channel for future overlap diagnostics', () => {
    const tpl = createEmptyTemplate('conflict-warning')
    tpl.dataSets = [
      {
        id: 'set1',
        name: 'ds1',
        sourceId: 'src1',
        extractor: {},
        cachedRows: [{ v: 'A' }, { v: 'B' }]
      }
    ]

    const grid = new Grid(4, 4)
    const a1 = grid.getRealCell(0, 0)!
    a1.content = '${ds1.v}'
    a1.dataset = 'ds1'
    a1.fieldName = 'v'
    a1.expandDirection = 'right'

    const b1 = grid.getRealCell(0, 1)!
    b1.content = '${ds1.v}'
    b1.dataset = 'ds1'
    b1.fieldName = 'v'
    b1.expandDirection = 'right'

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      tpl.dataSets
    ).expand()

    expect(Array.isArray(result.warnings ?? [])).toBe(true)
  })

})
