/**
 * 迭代展开引擎 ⭐核心
 *
 * 将模板网格按数据集行数展开为渲染网格
 *
 * 算法：
 * 1. 构建主格树
 * 2. 对每个根节点递归展开：
 *    - 向下展开：复制行，每行绑定一条数据
 *    - 向右展开：复制列，每列绑定一条数据
 * 3. 非展开单元格按主格上下文填充
 * 4. 聚合单元格基于子主格范围计算
 */
import type { Cell } from '@/core/cell/types'
import type { DataSet } from '@/types'
import type { DataRow } from '@/core/datasource/types'
import { buildMasterTree, sortRoots, type MasterNode } from './MasterTree'
import { createRootContext, deriveContext, type ExpandContext } from './Context'

/** 渲染后的单元格 */
export interface RenderedCell {
  /** 来源模板单元格（克隆） */
  source: Cell
  /** 在渲染网格中的行 */
  row: number
  /** 在渲染网格中的列 */
  col: number
  /** 行合并 */
  rowSpan: number
  /** 列合并 */
  colSpan: number
  /** 求值后的显示值 */
  value?: unknown
  /** 所属上下文（用于表达式求值） */
  context?: ExpandContext
}

/** 展开结果 */
export interface ExpandResult {
  /** 渲染网格 */
  grid: (RenderedCell | null)[][]
  /** 行高列表 */
  rowHeights: number[]
  /** 列宽列表 */
  colWidths: number[]
}

/**
 * 展开引擎
 */
export class ExpandEngine {
  /** 模板单元格 */
  private templateCells: (Cell | null)[][]
  /** 模板行高 */
  private templateRowHeights: number[]
  /** 模板列宽 */
  private templateColWidths: number[]
  /** 数据集缓存 */
  private dataSets: Map<string, DataRow[]>
  /** 渲染网格 */
  private rendered: (RenderedCell | null)[][]
  /** 渲染行高 */
  private renderedRowHeights: number[]
  /** 渲染列宽 */
  private renderedColWidths: number[]
  /** 参数值（用于表达式 ${param.xxx}） */
  private params?: Record<string, unknown>

  constructor(
    templateCells: (Cell | null)[][],
    rowHeights: number[],
    colWidths: number[],
    dataSets: DataSet[],
    params?: Record<string, unknown>
  ) {
    this.templateCells = templateCells
    this.templateRowHeights = rowHeights
    this.templateColWidths = colWidths
    this.params = params
    this.dataSets = new Map()
    for (const ds of dataSets) {
      this.dataSets.set(ds.name, ds.cachedRows ?? [])
    }
    // 初始渲染网格与模板等大
    this.rendered = []
    this.renderedRowHeights = []
    this.renderedColWidths = []
  }

  /** 执行展开 */
  expand(): ExpandResult {
    // 若无展开单元格，直接克隆模板
    const roots = buildMasterTree(this.templateCells)
    if (roots.length === 0) {
      this.cloneTemplateAsIs()
      return {
        grid: this.rendered,
        rowHeights: this.renderedRowHeights,
        colWidths: this.renderedColWidths
      }
    }

    // 初始化渲染网格为模板大小（后续按需扩展）
    this.initRenderedFromTemplate()

    const { downRoots, rightRoots } = sortRoots(roots)
    const rootCtx = createRootContext(this.params)

    // 先处理向下展开的根节点
    for (const root of downRoots) {
      this.expandDown(root, root.cell.row, rootCtx)
    }
    // 再处理向右展开的根节点
    for (const root of rightRoots) {
      this.expandRight(root, root.cell.col, rootCtx)
    }

    // 填充非展开单元格
    this.fillNonExpandCells()

    return {
      grid: this.rendered,
      rowHeights: this.renderedRowHeights,
      colWidths: this.renderedColWidths
    }
  }

  /** 无展开时直接克隆模板 */
  private cloneTemplateAsIs() {
    const rowCount = this.templateCells.length
    const colCount = this.templateCells[0]?.length ?? 0
    this.rendered = Array.from({ length: rowCount }, (_, r) =>
      Array.from({ length: colCount }, (_, c) => {
        const cell = this.templateCells[r][c]
        if (!cell) return null
        return {
          source: { ...cell },
          row: r,
          col: c,
          rowSpan: cell.rowSpan,
          colSpan: cell.colSpan
        }
      })
    )
    this.renderedRowHeights = [...this.templateRowHeights]
    this.renderedColWidths = [...this.templateColWidths]
  }

  /** 初始化渲染网格为模板大小 */
  private initRenderedFromTemplate() {
    this.cloneTemplateAsIs()
  }

  /**
   * 向下展开
   * @param node 主格节点
   * @param startRow 在渲染网格中的起始行
   * @param parentCtx 父上下文
   */
  private expandDown(node: MasterNode, startRow: number, parentCtx: ExpandContext): number {
    const cell = node.cell
    const data = this.getData(cell.dataset)
    const rowCount = Math.max(data.length, 1)

    // 若数据为空，仍保留一行（显示空）
    const effectiveData = data.length > 0 ? data : [{}]
    const effectiveRowCount = data.length > 0 ? data.length : 1

    // 在渲染网格中插入 effectiveRowCount - 1 行（已有1行）
    // 新行从模板对应行克隆单元格（保持非展开单元格的内容与样式）
    if (effectiveRowCount > 1) {
      this.insertRowsFromTemplate(startRow + 1, effectiveRowCount - 1, cell.row)
    }

    // 为每行填充数据
    for (let i = 0; i < effectiveRowCount; i++) {
      const row = startRow + i
      const rowData = effectiveData[i] ?? {}
      const ctx = deriveContext(
        parentCtx,
        rowData,
        cell.dataset ?? '',
        [row, row],
        [cell.col, cell.col + cell.colSpan - 1]
      )
      // 填充本单元格（展开主格）
      this.setRenderedCell(row, cell.col, cell, ctx)
      // 处理同行其他单元格（非展开的跟随填充，赋予上下文）
      this.fillRowCells(row, cell, ctx)
      // 递归处理子节点
      for (const child of node.leftChildren) {
        this.expandDown(child, row, ctx)
      }
      for (const child of node.topChildren) {
        this.expandRight(child, child.cell.col, ctx)
      }
    }

    return startRow + effectiveRowCount - 1
  }

  /**
   * 向右展开
   */
  private expandRight(node: MasterNode, startCol: number, parentCtx: ExpandContext): number {
    const cell = node.cell
    const data = this.getData(cell.dataset)
    const effectiveData = data.length > 0 ? data : [{}]
    const effectiveColCount = data.length > 0 ? data.length : 1

    // 插入列（从模板对应列克隆单元格）
    if (effectiveColCount > 1) {
      this.insertColsFromTemplate(startCol + 1, effectiveColCount - 1, cell.col)
    }

    for (let i = 0; i < effectiveColCount; i++) {
      const col = startCol + i
      const rowData = effectiveData[i] ?? {}
      const ctx = deriveContext(
        parentCtx,
        rowData,
        cell.dataset ?? '',
        [cell.row, cell.row + cell.rowSpan - 1],
        [col, col]
      )
      this.setRenderedCell(cell.row, col, cell, ctx)
      this.fillColCells(col, cell, ctx)
      // 递归子节点
      for (const child of node.topChildren) {
        this.expandRight(child, col, ctx)
      }
      for (const child of node.leftChildren) {
        this.expandDown(child, child.cell.row, ctx)
      }
    }

    return startCol + effectiveColCount - 1
  }

  /** 填充同行其他单元格的上下文（从属单元格跟随主格展开） */
  private fillRowCells(row: number, masterCell: Cell, ctx: ExpandContext) {
    // 展开感知的单元格（expandDirection !== 'none'）由自己的展开逻辑处理上下文
    // 无展开方向的跟随单元格（expandDirection === 'none'）继承主格上下文
    for (let c = 0; c < this.rendered[row].length; c++) {
      if (c === masterCell.col) continue
      const rc = this.rendered[row][c]
      if (rc && !rc.context && rc.source.expandDirection === 'none') {
        rc.context = ctx
      }
    }
  }

  /** 填充非展开单元格（无主格的普通单元格） */
  private fillNonExpandCells() {
    for (let r = 0; r < this.rendered.length; r++) {
      for (let c = 0; c < this.rendered[r].length; c++) {
        const rc = this.rendered[r][c]
        if (rc && !rc.context) {
          // 无上下文的单元格使用根上下文
          rc.context = createRootContext(this.params)
        }
      }
    }
  }

  /** 填充同列中本展开单元格下方的非展开单元格 */
  private fillColCells(col: number, masterCell: Cell, ctx: ExpandContext) {
    for (let r = 0; r < this.rendered.length; r++) {
      const rc = this.rendered[r]?.[col]
      if (rc && !rc.context && rc.source.expandDirection === 'none' && rc.source.col === masterCell.col) {
        rc.context = ctx
      }
    }
  }

  /** 设置渲染单元格 */
  private setRenderedCell(row: number, col: number, source: Cell, ctx: ExpandContext) {
    while (row >= this.rendered.length) this.appendRow()
    while (col >= this.rendered[0].length) this.appendCol()
    this.rendered[row][col] = {
      source: { ...source },
      row,
      col,
      rowSpan: source.rowSpan,
      colSpan: source.colSpan,
      context: ctx
    }
    // 处理合并：被覆盖位置置 null
    for (let r = row; r < row + source.rowSpan; r++) {
      for (let c = col; c < col + source.colSpan; c++) {
        if (r === row && c === col) continue
        if (this.rendered[r]) this.rendered[r][c] = null
      }
    }
  }

  /** 在渲染网格中插入行 */
  private insertRows(at: number, count: number) {
    for (let i = 0; i < count; i++) {
      const newRow: (RenderedCell | null)[] = Array(this.rendered[0].length).fill(null)
      this.rendered.splice(at + i, 0, newRow)
      this.renderedRowHeights.splice(at + i, 0, this.templateRowHeights[0] ?? 28)
    }
    this.refreshRenderedCoords()
  }

  /**
   * 从模板对应行克隆单元格并插入新行
   * @param at 插入位置
   * @param count 插入行数
   * @param templateRow 模板行索引（用于克隆单元格）
   */
  private insertRowsFromTemplate(at: number, count: number, templateRow: number) {
    const tplRow = this.templateCells[templateRow]
    const colCount = this.rendered[0]?.length ?? 0
    for (let i = 0; i < count; i++) {
      const newRow: (RenderedCell | null)[] = new Array(colCount).fill(null)
      // 从模板行克隆单元格
      if (tplRow) {
        for (let c = 0; c < colCount; c++) {
          const tplCell = tplRow[c]
          if (tplCell) {
            newRow[c] = {
              source: { ...tplCell, style: { ...tplCell.style } },
              row: at + i,
              col: c,
              rowSpan: tplCell.rowSpan,
              colSpan: tplCell.colSpan
              // context 留空，由 fillRowCells 填充
            }
          }
        }
      }
      this.rendered.splice(at + i, 0, newRow)
      this.renderedRowHeights.splice(at + i, 0, this.templateRowHeights[templateRow] ?? 28)
    }
    this.refreshRenderedCoords()
  }

  /** 在渲染网格中插入列 */
  private insertCols(at: number, count: number) {
    for (let i = 0; i < count; i++) {
      for (const row of this.rendered) {
        row.splice(at + i, 0, null)
      }
      this.renderedColWidths.splice(at + i, 0, this.templateColWidths[0] ?? 100)
    }
    this.refreshRenderedCoords()
  }

  /**
   * 从模板对应列克隆单元格并插入新列
   * @param at 插入位置
   * @param count 插入列数
   * @param templateCol 模板列索引
   */
  private insertColsFromTemplate(at: number, count: number, templateCol: number) {
    for (let i = 0; i < count; i++) {
      for (let r = 0; r < this.rendered.length; r++) {
        const tplCell = this.templateCells[r]?.[templateCol]
        const newCell = tplCell
          ? {
              source: { ...tplCell, style: { ...tplCell.style } },
              row: r,
              col: at + i,
              rowSpan: tplCell.rowSpan,
              colSpan: tplCell.colSpan
            }
          : null
        this.rendered[r].splice(at + i, 0, newCell)
      }
      this.renderedColWidths.splice(at + i, 0, this.templateColWidths[templateCol] ?? 100)
    }
    this.refreshRenderedCoords()
  }

  /** 追加行 */
  private appendRow() {
    this.rendered.push(Array(this.rendered[0].length).fill(null))
    this.renderedRowHeights.push(this.templateRowHeights[0] ?? 28)
  }

  /** 追加列 */
  private appendCol() {
    for (const row of this.rendered) {
      row.push(null)
    }
    this.renderedColWidths.push(this.templateColWidths[0] ?? 100)
  }

  /** 刷新渲染网格坐标 */
  private refreshRenderedCoords() {
    for (let r = 0; r < this.rendered.length; r++) {
      for (let c = 0; c < this.rendered[r].length; c++) {
        const rc = this.rendered[r][c]
        if (rc) {
          rc.row = r
          rc.col = c
        }
      }
    }
  }

  /** 获取数据集数据 */
  private getData(datasetName?: string): DataRow[] {
    if (!datasetName) return []
    return this.dataSets.get(datasetName) ?? []
  }
}
