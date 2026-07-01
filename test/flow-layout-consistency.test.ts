import { describe, it, expect } from 'vitest'
import {
  computeFlowPlacements,
  computeFlowColWidths,
  shouldRenderCell
} from '@/core/render/flowLayout'

describe('flow layout consistency', () => {
  it('preview/html/pdf flow placements should keep only meaningful flow cells', () => {
    const duplicatePlaceholder = {
      rowSpan: 1,
      colSpan: 1,
      value: '',
      context: {},
      source: {
        name: 'H24',
        row: 23,
        col: 7,
        cellType: 'text',
        content: '',
        style: {
          borderTop: '1px solid #d9d9d9',
          borderRight: '1px solid #d9d9d9',
          borderBottom: '1px solid #d9d9d9',
          borderLeft: '1px solid #d9d9d9'
        }
      }
    }

    const row = new Array(10).fill(null) as any[]
    for (let c = 0; c < 8; c++) {
      row[c] = {
        rowSpan: 1,
        colSpan: 1,
        value: `${String.fromCharCode(65 + c)}1`,
        context: {},
        source: {
          name: `${String.fromCharCode(65 + c)}1`,
          row: 0,
          col: c,
          cellType: 'text',
          content: `${String.fromCharCode(65 + c)}1`,
          style: {}
        }
      }
    }
    row[8] = duplicatePlaceholder
    row[9] = { ...duplicatePlaceholder }

    const grid = [row] as any

    const flow = computeFlowPlacements(grid)
    expect(flow.map((p) => [p.rowIndex + 1, p.flowCol])).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
      [1, 5],
      [1, 6],
      [1, 7],
      [1, 8]
    ])

    // 验证占位空壳在 shared filter 下会被剔除
    const renderedFlags = grid[0].map((cell, col) => shouldRenderCell(grid[0], col, cell))
    expect(renderedFlags.slice(8)).toEqual([false, false])
  })

  it('flow col widths should not include trailing duplicate placeholders', () => {
    const row = new Array(10).fill(null) as any[]
    for (let c = 0; c < 8; c++) {
      row[c] = {
        rowSpan: 1,
        colSpan: 1,
        value: `${String.fromCharCode(65 + c)}1`,
        context: {},
        source: {
          name: `${String.fromCharCode(65 + c)}1`,
          row: 0,
          col: c,
          cellType: 'text',
          content: `${String.fromCharCode(65 + c)}1`,
          style: {}
        }
      }
    }
    row[8] = {
      rowSpan: 1,
      colSpan: 1,
      value: '',
      context: {},
      source: {
        name: 'I1',
        row: 0,
        col: 8,
        cellType: 'text',
        content: '',
        style: { borderRight: '1px solid #d9d9d9' }
      }
    }
    row[9] = {
      rowSpan: 1,
      colSpan: 1,
      value: '',
      context: {},
      source: {
        name: 'I1',
        row: 0,
        col: 8,
        cellType: 'text',
        content: '',
        style: { borderRight: '1px solid #d9d9d9' }
      }
    }

    const widths = computeFlowColWidths([row] as any, [90, 120, 100, 100, 100, 240, 140, 120, 120, 120])
    expect(widths.length).toBe(8)
  })
})
