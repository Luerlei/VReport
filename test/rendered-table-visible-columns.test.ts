import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RenderedTable from '@/components/render/RenderedTable.vue'

describe('RenderedTable visible columns', () => {
  function makeBaseAHRow(): any[] {
    const row = new Array(10).fill(null)
    for (let c = 0; c < 8; c++) {
      row[c] = {
        rowSpan: 1,
        colSpan: 1,
        value: `${String.fromCharCode(65 + c)}1`,
        context: {},
        source: {
          name: `${String.fromCharCode(65 + c)}1`,
          cellType: 'text',
          content: `${String.fromCharCode(65 + c)}1`,
          style: {}
        }
      }
    }
    return row
  }

  it('should hide trailing empty columns in preview headers', () => {
    const row = makeBaseAHRow()
    row[8] = null
    row[9] = null
    const grid = [row] as any

    const wrapper = mount(RenderedTable, {
      props: {
        grid,
        rowHeights: [28],
        colWidths: [90, 120, 100, 100, 100, 240, 140, 120, 120, 120],
        showRowColHeaders: true
      }
    })

    const labels = wrapper
      .findAll('thead th.index-header')
      .map((n) => n.text())

    expect(labels).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    expect(labels.includes('I')).toBe(false)
    expect(labels.includes('J')).toBe(false)
  })

  it('should ignore trailing placeholder cells with empty text/style', () => {
    const emptyPlaceholder = {
      rowSpan: 1,
      colSpan: 1,
      value: '',
      context: {},
      source: {
        name: 'I1',
        cellType: 'text',
        content: '',
        style: {}
      }
    }

    const row = makeBaseAHRow()
    row[8] = emptyPlaceholder
    row[9] = emptyPlaceholder
    const grid = [row] as any

    const wrapper = mount(RenderedTable, {
      props: {
        grid,
        rowHeights: [28],
        colWidths: [90, 120, 100, 100, 100, 240, 140, 120, 120, 120],
        showRowColHeaders: true
      }
    })

    const labels = wrapper
      .findAll('thead th.index-header')
      .map((n) => n.text())

    expect(labels).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
  })

  it('should ignore trailing style-only placeholders from right-expansion padding', () => {
    const styleOnlyPlaceholder = {
      rowSpan: 1,
      colSpan: 1,
      value: '',
      context: {},
      source: {
        name: 'I12',
        cellType: 'text',
        content: '',
        style: {
          borderTop: '1px solid #d9d9d9',
          borderBottom: '1px solid #d9d9d9'
        }
      }
    }

    const row = makeBaseAHRow()
    row[8] = styleOnlyPlaceholder
    row[9] = styleOnlyPlaceholder
    const grid = [row] as any

    const wrapper = mount(RenderedTable, {
      props: {
        grid,
        rowHeights: [28],
        colWidths: [90, 120, 100, 100, 100, 240, 140, 120, 120, 120],
        showRowColHeaders: true
      }
    })

    const labels = wrapper
      .findAll('thead th.index-header')
      .map((n) => n.text())

    expect(labels).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    expect(labels.includes('I')).toBe(false)
    expect(labels.includes('J')).toBe(false)
  })

  it('should ignore trailing empty formula placeholders from right-expansion', () => {
    const emptyFormulaPlaceholder = {
      rowSpan: 1,
      colSpan: 1,
      value: '',
      context: {},
      source: {
        name: 'I6',
        cellType: 'formula',
        content: '',
        style: {}
      }
    }

    const row = makeBaseAHRow()
    row[8] = emptyFormulaPlaceholder
    row[9] = emptyFormulaPlaceholder
    const grid = [row] as any

    const wrapper = mount(RenderedTable, {
      props: {
        grid,
        rowHeights: [28],
        colWidths: [90, 120, 100, 100, 100, 240, 140, 120, 120, 120],
        showRowColHeaders: true
      }
    })

    const labels = wrapper
      .findAll('thead th.index-header')
      .map((n) => n.text())

    expect(labels).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    expect(labels.includes('I')).toBe(false)
    expect(labels.includes('J')).toBe(false)
  })

  it('should map absolute offset cells into continuous flow headers', () => {
    const row = new Array(10).fill(null) as any[]
    row[8] = {
      rowSpan: 1,
      colSpan: 1,
      value: '结果',
      context: {},
      source: {
        name: 'G27',
        cellType: 'text',
        content: '结果',
        style: {}
      }
    }
    row[9] = {
      rowSpan: 1,
      colSpan: 1,
      value: '预期',
      context: {},
      source: {
        name: 'H27',
        cellType: 'text',
        content: '预期',
        style: {}
      }
    }

    const wrapper = mount(RenderedTable, {
      props: {
        grid: [row] as any,
        rowHeights: [28],
        colWidths: [90, 120, 100, 100, 100, 240, 140, 120, 120, 120],
        showRowColHeaders: true
      }
    })

    const labels = wrapper
      .findAll('thead th.index-header')
      .map((n) => n.text())

    expect(labels).toEqual(['A', 'B'])
    expect(labels.includes('I')).toBe(false)
    expect(labels.includes('J')).toBe(false)
  })

  it('should not render duplicate trailing placeholder grid cells beyond last visible column', () => {
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

    const row = makeBaseAHRow()
    row[8] = duplicatePlaceholder
    row[9] = { ...duplicatePlaceholder }

    const wrapper = mount(RenderedTable, {
      props: {
        grid: [row] as any,
        rowHeights: [28],
        colWidths: [90, 120, 100, 100, 100, 240, 140, 120, 120, 120],
        showRowColHeaders: true
      }
    })

    const bodyCells = wrapper.findAll('tbody td')
    // A-H 八个有效格，右侧重复占位格全部不渲染
    expect(bodyCells.length).toBe(8)
  })
})
