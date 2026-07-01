/**
 * 网格管理
 * 维护设计期的二维单元格数组，提供合并、拆分、行列增删等操作
 */
import {
  Cell,
  CellStyle,
  ColumnConfig,
  DEFAULT_COL_COUNT,
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_COUNT,
  DEFAULT_ROW_HEIGHT,
  RowConfig,
  cellName,
  createCell
} from './types'
import { shiftCellRefName, shiftFormulaRefs } from './refShift'

export class Grid {
  /** 二维数组：cells[row][col]，被合并的位置为 null */
  cells: (Cell | null)[][]
  rows: RowConfig[]
  columns: ColumnConfig[]

  constructor(rowCount = DEFAULT_ROW_COUNT, colCount = DEFAULT_COL_COUNT) {
    this.rows = Array.from({ length: rowCount }, (_, i) => ({
      index: i,
      height: DEFAULT_ROW_HEIGHT
    }))
    this.columns = Array.from({ length: colCount }, (_, i) => ({
      index: i,
      width: DEFAULT_COL_WIDTH
    }))
    this.cells = Array.from({ length: rowCount }, (_, r) =>
      Array.from({ length: colCount }, (_, c) => createCell(r, c))
    )
  }

  get rowCount(): number {
    return this.rows.length
  }

  get colCount(): number {
    return this.columns.length
  }

  /** 获取单元格（越界或被合并位置返回 null） */
  getCell(row: number, col: number): Cell | null {
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) return null
    return this.cells[row][col]
  }

  /** 获取单元格，若被合并则返回主单元格 */
  getRealCell(row: number, col: number): Cell | null {
    const cell = this.getCell(row, col)
    if (cell) return cell
    // 向左上查找合并主单元格
    for (let r = row; r >= 0; r--) {
      for (let c = col; c >= 0; c--) {
        const candidate = this.cells[r][c]
        if (candidate && candidate.rowSpan > 1 && candidate.colSpan > 1) {
          if (r + candidate.rowSpan > row && c + candidate.colSpan > col) return candidate
        } else if (candidate && candidate.rowSpan > 1 && r + candidate.rowSpan > row) {
          return candidate
        } else if (candidate && candidate.colSpan > 1 && c + candidate.colSpan > col) {
          return candidate
        }
      }
    }
    return null
  }

  /** 设置单元格内容 */
  setCellContent(row: number, col: number, content: string): void {
    const cell = this.getRealCell(row, col)
    if (cell) {
      cell.content = content
      syncCellBindingFromContent(cell)
      // 仅对纯文本/公式类型自动推断;图片/二维码/条码/图表类型保持不变
      if (
        cell.cellType === 'text' ||
        cell.cellType === 'formula' ||
        cell.cellType === undefined
      ) {
        cell.cellType = content.startsWith('=') ? 'formula' : 'text'
      }
    }
  }

  /** 合并选中区域 */
  merge(startRow: number, startCol: number, endRow: number, endCol: number): void {
    const r1 = Math.min(startRow, endRow)
    const r2 = Math.max(startRow, endRow)
    const c1 = Math.min(startCol, endCol)
    const c2 = Math.max(startCol, endCol)
    const rowSpan = r2 - r1 + 1
    const colSpan = c2 - c1 + 1

    const main = this.cells[r1][c1]
    if (!main) return
    main.rowSpan = rowSpan
    main.colSpan = colSpan

    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (r === r1 && c === c1) continue
        this.cells[r][c] = null
      }
    }
  }

  /** 拆分单元格 */
  unmerge(row: number, col: number): void {
    const cell = this.getRealCell(row, col)
    if (!cell || (cell.rowSpan === 1 && cell.colSpan === 1)) return
    const r1 = cell.row
    const c1 = cell.col
    const rowSpan = cell.rowSpan
    const colSpan = cell.colSpan
    cell.rowSpan = 1
    cell.colSpan = 1
    for (let r = r1; r < r1 + rowSpan; r++) {
      for (let c = c1; c < c1 + colSpan; c++) {
        if (r === r1 && c === c1) continue
        this.cells[r][c] = createCell(r, c)
      }
    }
  }

  /** 插入行 */
  insertRow(index: number, count = 1): void {
    const newRows: (Cell | null)[][] = []
    for (let i = 0; i < count; i++) {
      newRows.push(Array.from({ length: this.colCount }, (_, c) => createCell(index + i, c)))
    }
    this.cells.splice(index, 0, ...newRows)
    this.rows.splice(index, 0, ...Array.from({ length: count }, (_, i) => ({ index: index + i, height: DEFAULT_ROW_HEIGHT })))
    shiftFormulaRefsForRowInsert(this.cells, index, count)
    this.refreshIndices()
  }

  /** 插入列 */
  insertCol(index: number, count = 1): void {
    for (let r = 0; r < this.rowCount; r++) {
      const newCells: (Cell | null)[] = Array.from({ length: count }, (_, i) => createCell(r, index + i))
      this.cells[r].splice(index, 0, ...newCells)
    }
    this.columns.splice(index, 0, ...Array.from({ length: count }, (_, i) => ({ index: index + i, width: DEFAULT_COL_WIDTH })))
    shiftFormulaRefsForColInsert(this.cells, index, count)
    this.refreshIndices()
  }

  /** 删除行 */
  deleteRow(index: number, count = 1): void {
    this.cells.splice(index, count)
    this.rows.splice(index, count)
    shiftFormulaRefsForRowDelete(this.cells, index, count)
    this.refreshIndices()
  }

  /** 删除列 */
  deleteCol(index: number, count = 1): void {
    for (let r = 0; r < this.rowCount; r++) {
      this.cells[r].splice(index, count)
    }
    this.columns.splice(index, count)
    shiftFormulaRefsForColDelete(this.cells, index, count)
    this.refreshIndices()
  }

  /** 刷新所有单元格的行列索引与名称 */
  refreshIndices(): void {
    for (let r = 0; r < this.rowCount; r++) {
      this.rows[r].index = r
      for (let c = 0; c < this.colCount; c++) {
        if (c < this.columns.length) this.columns[c].index = c
        const cell = this.cells[r][c]
        if (cell) {
          cell.row = r
          cell.col = c
          cell.name = cellName(r, c)
        }
      }
    }
  }

  /** 设置行高 */
  setRowHeight(index: number, height: number): void {
    if (this.rows[index]) this.rows[index].height = Math.max(10, height)
  }

  /** 设置列宽 */
  setColWidth(index: number, width: number): void {
    if (this.columns[index]) this.columns[index].width = Math.max(20, width)
  }

  /**
   * 批量应用样式到选区（支持多选单元格）
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   * @param patch 样式补丁，仅覆盖传入的字段
   */
  applyStyleToRange(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    patch: Partial<CellStyle>
  ): void {
    const r1 = Math.min(startRow, endRow)
    const r2 = Math.max(startRow, endRow)
    const c1 = Math.min(startCol, endCol)
    const c2 = Math.max(startCol, endCol)
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const cell = this.getRealCell(r, c)
        if (cell) {
          Object.assign(cell.style, patch)
        }
      }
    }
  }

  /**
   * 批量设置边框
   * @param type 边框类型：all/none/outer/top/bottom/left/right
   */
  setBorderToRange(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    type: 'all' | 'none' | 'outer' | 'top' | 'bottom' | 'left' | 'right',
    edge?: import('./types').BorderEdge
  ): void {
    const r1 = Math.min(startRow, endRow)
    const r2 = Math.max(startRow, endRow)
    const c1 = Math.min(startCol, endCol)
    const c2 = Math.max(startCol, endCol)
    const solid = edge ?? { style: 'solid' as const, color: '#333', width: 1 }
    const none = { style: 'none' as const, color: '#333', width: 0 }

    if (type === 'all') {
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const cell = this.getRealCell(r, c)
          if (cell) {
            cell.style.borderTop = { ...solid }
            cell.style.borderBottom = { ...solid }
            cell.style.borderLeft = { ...solid }
            cell.style.borderRight = { ...solid }
          }
        }
      }
    } else if (type === 'none') {
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const cell = this.getRealCell(r, c)
          if (cell) {
            cell.style.borderTop = { ...none }
            cell.style.borderBottom = { ...none }
            cell.style.borderLeft = { ...none }
            cell.style.borderRight = { ...none }
          }
        }
      }
    } else if (type === 'outer') {
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const cell = this.getRealCell(r, c)
          if (!cell) continue
          cell.style.borderTop = r === r1 ? { ...solid } : cell.style.borderTop ?? { ...none }
          cell.style.borderBottom = r === r2 ? { ...solid } : cell.style.borderBottom ?? { ...none }
          cell.style.borderLeft = c === c1 ? { ...solid } : cell.style.borderLeft ?? { ...none }
          cell.style.borderRight = c === c2 ? { ...solid } : cell.style.borderRight ?? { ...none }
        }
      }
    } else {
      // 单边
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const cell = this.getRealCell(r, c)
          if (!cell) continue
          if (type === 'top' && r === r1) cell.style.borderTop = { ...solid }
          if (type === 'bottom' && r === r2) cell.style.borderBottom = { ...solid }
          if (type === 'left' && c === c1) cell.style.borderLeft = { ...solid }
          if (type === 'right' && c === c2) cell.style.borderRight = { ...solid }
        }
      }
    }
  }

  /** 序列化为纯数据（去除方法） */
  toJSON(): {
    rows: RowConfig[]
    columns: ColumnConfig[]
    cells: (Cell | null)[][]
  } {
    return {
      rows: this.rows.map((r) => ({ ...r })),
      columns: this.columns.map((c) => ({ ...c })),
      cells: this.cells.map((row) => row.map((c) => (c ? { ...c, style: { ...c.style } } : null)))
    }
  }

  /** 从数据恢复 */
  static fromJSON(data: {
    rows: RowConfig[]
    columns: ColumnConfig[]
    cells: (Cell | null)[][]
  }): Grid {
    const grid = new Grid(0, 0)
    grid.rows = data.rows.map((r) => ({ ...r }))
    grid.columns = data.columns.map((c) => ({ ...c }))
    grid.cells = data.cells.map((row, r) =>
      row.map((c) => (c ? { ...c, style: { ...c.style } } : null))
    )
    return grid
  }
}

/**
 * 内容变更后同步直接数据绑定：
 * - 若内容是单个 ${ds.field}，自动同步 dataset/fieldName
 * - 否则清理陈旧的数据绑定与展开主格配置，避免删除变量后仍残留属性
 */
function syncCellBindingFromContent(cell: Cell): void {
  const directBinding = parseDirectDatasetBinding(cell.content)
  if (directBinding) {
    cell.dataset = directBinding.dataset
    cell.fieldName = directBinding.fieldName
    cell.aggregate = cell.aggregate ?? 'none'
    return
  }

  cell.dataset = undefined
  cell.fieldName = undefined
  cell.aggregate = undefined
  cell.expandDirection = 'none'
  cell.leftMasterCell = undefined
  cell.topMasterCell = undefined
}

/** 解析“直接绑定型”数据集变量内容，仅匹配单个 ${ds.field} */
function parseDirectDatasetBinding(content: string): { dataset: string; fieldName: string } | null {
  const trimmed = content.trim()
  const match = trimmed.match(/^\$\{([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\}$/)
  if (!match) return null
  return {
    dataset: match[1],
    fieldName: match[2]
  }
}

function shiftFormulaRefsForRowInsert(cells: (Cell | null)[][], index: number, count: number): void {
  for (const row of cells) {
    for (const cell of row) {
      if (!cell) continue
      if (cell.content.startsWith('=')) {
        cell.content = shiftFormulaRefs(cell.content, { rowInsertIndex: index, rowInsertCount: count })
      }
      cell.leftMasterCell = shiftCellRefName(cell.leftMasterCell ?? '', { rowInsertIndex: index, rowInsertCount: count }) ?? cell.leftMasterCell
      cell.topMasterCell = shiftCellRefName(cell.topMasterCell ?? '', { rowInsertIndex: index, rowInsertCount: count }) ?? cell.topMasterCell
    }
  }
}

function shiftFormulaRefsForColInsert(cells: (Cell | null)[][], index: number, count: number): void {
  for (const row of cells) {
    for (const cell of row) {
      if (!cell) continue
      if (cell.content.startsWith('=')) {
        cell.content = shiftFormulaRefs(cell.content, { colInsertIndex: index, colInsertCount: count })
      }
      cell.leftMasterCell = shiftCellRefName(cell.leftMasterCell ?? '', { colInsertIndex: index, colInsertCount: count }) ?? cell.leftMasterCell
      cell.topMasterCell = shiftCellRefName(cell.topMasterCell ?? '', { colInsertIndex: index, colInsertCount: count }) ?? cell.topMasterCell
    }
  }
}

function shiftFormulaRefsForRowDelete(cells: (Cell | null)[][], index: number, count: number): void {
  for (const row of cells) {
    for (const cell of row) {
      if (!cell) continue
      if (cell.content.startsWith('=')) {
        cell.content = shiftFormulaRefs(cell.content, { rowDeleteIndex: index, rowDeleteCount: count })
      }
      cell.leftMasterCell = shiftCellRefName(cell.leftMasterCell ?? '', { rowDeleteIndex: index, rowDeleteCount: count }) ?? cell.leftMasterCell
      cell.topMasterCell = shiftCellRefName(cell.topMasterCell ?? '', { rowDeleteIndex: index, rowDeleteCount: count }) ?? cell.topMasterCell
    }
  }
}

function shiftFormulaRefsForColDelete(cells: (Cell | null)[][], index: number, count: number): void {
  for (const row of cells) {
    for (const cell of row) {
      if (!cell) continue
      if (cell.content.startsWith('=')) {
        cell.content = shiftFormulaRefs(cell.content, { colDeleteIndex: index, colDeleteCount: count })
      }
      cell.leftMasterCell = shiftCellRefName(cell.leftMasterCell ?? '', { colDeleteIndex: index, colDeleteCount: count }) ?? cell.leftMasterCell
      cell.topMasterCell = shiftCellRefName(cell.topMasterCell ?? '', { colDeleteIndex: index, colDeleteCount: count }) ?? cell.topMasterCell
    }
  }
}
