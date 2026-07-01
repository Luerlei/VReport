import { describe, it, expect } from 'vitest'
import { Grid } from '../src/core/cell/Grid'
import { ExpandEngine } from '../src/core/engine/ExpandEngine'
import { Aggregator } from '../src/core/engine/Aggregator'
import type { DataSet } from '../src/types'

describe('multiple right expand roots', () => {
  it('roots in same row should expand side-by-side without overlap', () => {
    const grid = new Grid(4, 8)

    const a1 = grid.getRealCell(0, 0)!
    a1.content = '${dsA.v}'
    a1.dataset = 'dsA'
    a1.fieldName = 'v'
    a1.expandDirection = 'right'

    const b1 = grid.getRealCell(0, 1)!
    b1.content = '${dsB.v}'
    b1.dataset = 'dsB'
    b1.fieldName = 'v'
    b1.expandDirection = 'right'

    const sets: DataSet[] = [
      { id: 'a', name: 'dsA', sourceId: 'sa', extractor: {}, cachedRows: [{ v: 'A1' }, { v: 'A2' }] },
      { id: 'b', name: 'dsB', sourceId: 'sb', extractor: {}, cachedRows: [{ v: 'B1' }, { v: 'B2' }, { v: 'B3' }] }
    ]

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      sets
    ).expand()
    new Aggregator(result.grid).evaluateAll()

    const row0 = result.grid[0].map((cell) => cell?.value).filter((v) => v != null && v !== '')
    expect(row0).toEqual(['A1', 'A2', 'B1', 'B2', 'B3'])
    expect(Array.isArray(result.warnings ?? [])).toBe(true)
  })

  it('same-row roots with same dataset should both expand in sequence', () => {
    const grid = new Grid(4, 8)

    const b1 = grid.getRealCell(0, 1)!
    b1.content = '${shiftData.label}'
    b1.dataset = 'shiftData'
    b1.fieldName = 'label'
    b1.expandDirection = 'right'

    const c1 = grid.getRealCell(0, 2)!
    c1.content = '${shiftData.label}'
    c1.dataset = 'shiftData'
    c1.fieldName = 'label'
    c1.expandDirection = 'right'

    // 下方静态区，验证不会被右展开挤乱
    grid.setCellContent(2, 0, '指标')
    grid.setCellContent(2, 1, '公式')
    grid.setCellContent(2, 2, '结果')
    grid.setCellContent(2, 3, '预期')

    const sets: DataSet[] = [
      {
        id: 's1',
        name: 'shiftData',
        sourceId: 'src',
        extractor: {},
        cachedRows: [{ label: '上移一' }, { label: '上移二' }, { label: '上移三' }]
      }
    ]

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      sets
    ).expand()
    new Aggregator(result.grid).evaluateAll()

    const row0 = result.grid[0].map((cell) => cell?.value).filter((v) => v != null && v !== '')
    expect(row0).toEqual(['上移一', '上移二', '上移三', '上移一', '上移二', '上移三'])
    expect(result.grid[2][4]?.value ?? '').toBe('')
    expect(result.grid[2][5]?.value ?? '').toBe('')
  })

  it('same-template-row right roots should share shifted rendered row band', () => {
    const grid = new Grid(14, 8)

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

    const b6 = grid.getRealCell(5, 1)!
    b6.content = '${shiftData.label}'
    b6.dataset = 'shiftData'
    b6.fieldName = 'label'
    b6.expandDirection = 'right'

    const c6 = grid.getRealCell(5, 2)!
    c6.content = '${shiftData.label}'
    c6.dataset = 'shiftData'
    c6.fieldName = 'label'
    c6.expandDirection = 'right'

    const sets: DataSet[] = [
      {
        id: 's1',
        name: 'shiftData',
        sourceId: 'src',
        extractor: {},
        cachedRows: [{ label: '上移一' }, { label: '上移二' }, { label: '上移三' }]
      }
    ]

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      sets
    ).expand()
    new Aggregator(result.grid).evaluateAll()

    const b6Rows: number[] = []
    const c6Rows: number[] = []
    for (let r = 0; r < result.grid.length; r++) {
      for (let c = 0; c < result.grid[r].length; c++) {
        const cell = result.grid[r][c]
        if (!cell) continue
        if (cell.source.name === 'B6') b6Rows.push(r)
        if (cell.source.name === 'C6') c6Rows.push(r)
      }
    }
    expect(b6Rows.length).toBeGreaterThan(0)
    expect(c6Rows.length).toBeGreaterThan(0)
    expect(Math.min(...b6Rows)).toBe(Math.min(...c6Rows))
  })
})
