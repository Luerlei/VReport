import { colIndexToName } from './types'

export interface StructuralShiftOptions {
  rowInsertIndex?: number
  rowInsertCount?: number
  colInsertIndex?: number
  colInsertCount?: number
  rowDeleteIndex?: number
  rowDeleteCount?: number
  colDeleteIndex?: number
  colDeleteCount?: number
}

export function colNameToIndex(name: string): number {
  let idx = 0
  const upper = name.toUpperCase()
  for (let i = 0; i < upper.length; i++) {
    idx = idx * 26 + (upper.charCodeAt(i) - 64)
  }
  return idx - 1
}

export function shiftCellRefName(name: string, options: StructuralShiftOptions): string | null {
  const match = name.match(/^(\$?)([A-Za-z]+)(\$?)(\d+)$/)
  if (!match) return null

  const [, colDollar, colName, rowDollar, rowNum] = match
  let col = colNameToIndex(colName)
  let row = parseInt(rowNum, 10) - 1

  if (!rowDollar) {
    if (options.rowInsertIndex != null && options.rowInsertCount && row >= options.rowInsertIndex) {
      row += options.rowInsertCount
    }
    if (options.rowDeleteIndex != null && options.rowDeleteCount) {
      row = shiftIndexForDelete(row, options.rowDeleteIndex, options.rowDeleteCount)
    }
  }

  if (!colDollar) {
    if (options.colInsertIndex != null && options.colInsertCount && col >= options.colInsertIndex) {
      col += options.colInsertCount
    }
    if (options.colDeleteIndex != null && options.colDeleteCount) {
      col = shiftIndexForDelete(col, options.colDeleteIndex, options.colDeleteCount)
    }
  }

  if (row < 0 || col < 0) return null
  return `${colDollar}${colIndexToName(col)}${rowDollar}${row + 1}`
}

export function shiftFormulaRefs(content: string, options: StructuralShiftOptions): string {
  return content.replace(/(\$?)([A-Za-z]+)(\$?)(\d+)/g, (match) => {
    return shiftCellRefName(match, options) ?? match
  })
}

export function shiftRangeScope(scope: string, options: StructuralShiftOptions): string {
  if (!scope) return scope
  if (!scope.includes(':')) {
    return shiftCellRefName(scope, options) ?? scope
  }
  const [start, end] = scope.split(':')
  const shiftedStart = shiftCellRefName(start, options) ?? start
  const shiftedEnd = shiftCellRefName(end, options) ?? end
  return `${shiftedStart}:${shiftedEnd}`
}

export function shiftIndexForDelete(value: number, index: number, count: number): number {
  const deleteEnd = index + count - 1
  if (value < index) return value
  if (value > deleteEnd) return value - count
  return index
}
