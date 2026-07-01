import { describe, it, expect } from 'vitest'
import tplV4 from './fixtures/attachment-dynamic-template-v4.json'
import { gridFromTemplate } from '@/core/serializer/Serializer'
import { ExpandEngine } from '@/core/engine/ExpandEngine'
import { Aggregator } from '@/core/engine/Aggregator'
import type { ReportTemplate } from '@/types'

describe('attachment v4 preview regression', () => {
  it('should not render stray cells at I6, J7, E10, F10', () => {
    const tpl = JSON.parse(JSON.stringify(tplV4)) as ReportTemplate
    tpl.dataSets.forEach((set) => {
      const source = tpl.dataSources.find((s) => s.id === set.sourceId)
      set.cachedRows = source?.config?.rawJson ? JSON.parse(source.config.rawJson) : []
    })

    const grid = gridFromTemplate(tpl)
    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      tpl.dataSets
    ).expand()
    new Aggregator(result.grid).evaluateAll()

    // 1-based -> 0-based: I6=(5,8), J7=(6,9), E10=(9,4), F10=(9,5)
    expect(result.grid[5]?.[8]?.value ?? '').toBe('')
    expect(result.grid[6]?.[9]?.value ?? '').toBe('')
    expect(result.grid[9]?.[4]?.value ?? '').toBe('')
    expect(result.grid[9]?.[5]?.value ?? '').toBe('')
    expect((result.warnings ?? []).every((w) => !w.includes('覆盖冲突'))).toBe(true)
  })
})
