import { describe, it, expect } from 'vitest'
import tplV4 from './fixtures/attachment-dynamic-template-v4.json'
import { gridFromTemplate } from '@/core/serializer/Serializer'
import { ExpandEngine } from '@/core/engine/ExpandEngine'
import { Aggregator } from '@/core/engine/Aggregator'
import type { ReportTemplate } from '@/types'

describe('C6 right expansion regression', () => {
  it('C6 (same-row right root) should expand sequentially after B6', () => {
    const tpl = JSON.parse(JSON.stringify(tplV4)) as ReportTemplate
    tpl.dataSets.forEach((set) => {
      const source = tpl.dataSources.find((s) => s.id === set.sourceId)
      set.cachedRows = source?.config?.rawJson ? JSON.parse(source.config.rawJson) : []
    })

    const grid = gridFromTemplate(tpl)
    const c6 = grid.getRealCell(5, 2)
    expect(c6).toBeTruthy()
    if (c6) {
      c6.content = '${shiftData.label}'
      c6.dataset = 'shiftData'
      c6.fieldName = 'label'
      c6.expandDirection = 'right'
    }

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      tpl.dataSets
    ).expand()

    new Aggregator(result.grid).evaluateAll()

    const b6: Array<{ row: number; col: number; value: unknown }> = []
    const c6Rendered: Array<{ row: number; col: number; value: unknown }> = []
    for (let r = 0; r < result.grid.length; r++) {
      for (let c = 0; c < result.grid[r].length; c++) {
        const cell = result.grid[r][c]
        if (!cell) continue
        if (cell.source.name === 'B6') b6.push({ row: r, col: c, value: cell.value })
        if (cell.source.name === 'C6') c6Rendered.push({ row: r, col: c, value: cell.value })
      }
    }

    b6.sort((a, b) => a.col - b.col)
    c6Rendered.sort((a, b) => a.col - b.col)

    expect(b6.length).toBe(3)
    expect(c6Rendered.length).toBe(3)
    expect(new Set(b6.map((item) => item.row)).size).toBe(1)
    expect(new Set(c6Rendered.map((item) => item.row)).size).toBe(1)
    expect(b6[0].row).toBe(c6Rendered[0].row)
    expect(c6Rendered[0].col).toBeGreaterThan(b6[b6.length - 1].col)
    expect(b6.map((item) => item.value)).toEqual(['上移一', '上移二', '上移三'])
    expect(c6Rendered.map((item) => item.value)).toEqual(['上移一', '上移二', '上移三'])
  })
})
