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

/** 展开冲突告警详情（用于 UI 定位） */
export interface ExpandWarning {
  /** 告警文案 */
  message: string
  /** 来源模板单元格名（可定位回设计器） */
  sourceCell?: string
  /** 覆盖到的模板单元格名 */
  targetCell?: string
  /** 渲染网格行（0-based） */
  renderRow?: number
  /** 渲染网格列（0-based） */
  renderCol?: number
}

/** 展开结果 */
export interface ExpandResult {
  /** 渲染网格 */
  grid: (RenderedCell | null)[][]
  /** 行高列表 */
  rowHeights: number[]
  /** 列宽列表 */
  colWidths: number[]
  /** 展开阶段发现的覆盖/冲突告警 */
  warnings?: string[]
  /** 展开阶段结构化告警（用于点击定位） */
  warningDetails?: ExpandWarning[]
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
  /** 展开告警 */
  private warnings = new Set<string>()
  /** 展开告警详情 */
  private warningDetails: ExpandWarning[] = []
  /** 右展开行带游标：key=row+context，value=下一可用列 */
  private rightBandCursor = new Map<string, number>()
  /** 上下文对象稳定 ID（用于 rightBandCursor 分区） */
  private contextIdentity = new WeakMap<ExpandContext, number>()
  private contextIdSeed = 1

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
    this.warnings.clear()
    this.warningDetails = []
    this.rightBandCursor.clear()
    // 若无展开单元格，直接克隆模板
    const roots = buildMasterTree(this.templateCells)
    if (roots.length === 0) {
      this.cloneTemplateAsIs()
      this.applyRootContextToAllCells()
      return {
        grid: this.rendered,
        rowHeights: this.renderedRowHeights,
        colWidths: this.renderedColWidths,
        warnings: Array.from(this.warnings),
        warningDetails: this.warningDetails
      }
    }

    // 初始化渲染网格为模板大小（后续按需扩展）
    this.initRenderedFromTemplate()

    const { downRoots, rightRoots } = sortRoots(roots)
    const rootCtx = createRootContext(this.params, this.getDatasetRowsRecord())

    // 先处理向下展开的根节点
    for (const root of downRoots) {
      const start = this.findRenderedPositionForTemplateCell(root.cell.row, root.cell.col, rootCtx)
      this.expandDown(root, start?.row ?? root.cell.row, rootCtx)
    }
    // 再处理向右展开的根节点
    const orderedRightRoots = [...rightRoots].sort((a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col)
    const rightRootBandRowByTemplateRow = new Map<number, number>()
    for (const root of orderedRightRoots) {
      const skipReason = this.getSkipReasonForRightRoot(root, downRoots, orderedRightRoots)
      if (skipReason) {
        this.clearRenderedCellsForTemplateSource(root.cell.row, root.cell.col)
        this.addWarning({
          message: `已忽略右展开根 ${root.cell.name}（${skipReason}）`,
          sourceCell: root.cell.name,
          renderRow: root.cell.row,
          renderCol: root.cell.col
        })
        continue
      }
      const start = this.findRenderedPositionForTemplateCell(root.cell.row, root.cell.col, rootCtx)
      const rememberedBandRow = rightRootBandRowByTemplateRow.get(root.cell.row)
      const bandRow = rememberedBandRow ?? (start?.row ?? root.cell.row)
      if (rememberedBandRow == null) {
        rightRootBandRowByTemplateRow.set(root.cell.row, bandRow)
      }
      const requestedCol = start?.col ?? root.cell.col
      const startCol = this.reserveRightBandStart(bandRow, requestedCol, rootCtx)
      const endCol = this.expandRight(root, startCol, rootCtx, bandRow)
      this.advanceRightBandCursor(bandRow, rootCtx, endCol + 1)
    }

    // 填充非展开单元格
    this.fillNonExpandCells()

    return {
      grid: this.rendered,
      rowHeights: this.renderedRowHeights,
      colWidths: this.renderedColWidths,
      warnings: Array.from(this.warnings),
      warningDetails: this.warningDetails
    }
  }

  /** 记录告警（基于 message 去重，同时保留结构化字段） */
  private addWarning(detail: ExpandWarning) {
    if (this.warnings.has(detail.message)) return
    this.warnings.add(detail.message)
    this.warningDetails.push(detail)
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

  /** 无展开场景下，为所有单元格补充根上下文（含数据集缓存） */
  private applyRootContextToAllCells() {
    const rootCtx = createRootContext(this.params, this.getDatasetRowsRecord())
    for (let r = 0; r < this.rendered.length; r++) {
      for (let c = 0; c < this.rendered[r].length; c++) {
        const rc = this.rendered[r][c]
        if (rc) rc.context = rootCtx
      }
    }
  }

  /** 将数据集缓存转为普通对象，供表达式上下文安全传递 */
  private getDatasetRowsRecord(): Record<string, DataRow[]> {
    const record: Record<string, DataRow[]> = {}
    for (const [name, rows] of this.dataSets.entries()) {
      record[name] = rows
    }
    return record
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
    const anchor = this.findRenderedPositionForTemplateCell(cell.row, cell.col, parentCtx)
    const renderedCol = anchor?.col ?? cell.col
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
        [renderedCol, renderedCol + cell.colSpan - 1]
      )
      // 填充本单元格（展开主格）
      this.setRenderedCell(row, renderedCol, cell, ctx)
      // 处理同行其他单元格（非展开的跟随填充，赋予上下文）
      this.fillRowCells(row, renderedCol, ctx)
      // 递归处理子节点
      for (const child of node.leftChildren) {
        this.expandDown(child, row, ctx)
      }
      for (const child of node.topChildren) {
        const childAnchor = this.findRenderedPositionForTemplateCell(child.cell.row, child.cell.col, ctx)
        this.expandRight(child, childAnchor?.col ?? child.cell.col, ctx)
      }
    }

    return startRow + effectiveRowCount - 1
  }

  /**
   * 向右展开
   */
  private expandRight(
    node: MasterNode,
    startCol: number,
    parentCtx: ExpandContext,
    forcedRenderedRow?: number
  ): number {
    const cell = node.cell
    const anchor = this.findRenderedPositionForTemplateCell(cell.row, cell.col, parentCtx)
    const renderedRow = forcedRenderedRow ?? anchor?.row ?? cell.row
    const data = this.getData(cell.dataset)
    const effectiveData = data.length > 0 ? data : [{}]
    const effectiveColCount = data.length > 0 ? data.length : 1

    // 插入列（从模板对应列克隆单元格）
    // 注意：克隆落位必须使用「渲染锚点行」(renderedRow)，而非模板行 cell.row。
    // 前序向下展开会把本行整体下推，若仍按模板行索引落位，克隆列会落在错误的
    // 渲染行上，形成游离单元格（后续 fillColCells 还会误填数据）。
    if (effectiveColCount > 1 && this.shouldInsertColsForRightExpand(renderedRow, cell.rowSpan, startCol, effectiveColCount)) {
      this.insertColsFromTemplate(
        startCol + 1,
        effectiveColCount - 1,
        cell.col,
        renderedRow,
        cell.rowSpan,
        cell.row
      )
    }

    for (let i = 0; i < effectiveColCount; i++) {
      const col = startCol + i
      const rowData = effectiveData[i] ?? {}
      const ctx = deriveContext(
        parentCtx,
        rowData,
        cell.dataset ?? '',
        [renderedRow, renderedRow + cell.rowSpan - 1],
        [col, col]
      )
      this.setRenderedCell(renderedRow, col, cell, ctx)
      this.fillColCells(col, cell, ctx)
      // 递归子节点
      for (const child of node.topChildren) {
        const childAnchor = this.findRenderedPositionForTemplateCell(child.cell.row, child.cell.col, ctx)
        const childRow = childAnchor?.row ?? renderedRow
        const childRequestedCol = childAnchor?.col ?? col
        const childStartCol = this.reserveRightBandStart(childRow, childRequestedCol, ctx)
        const childEndCol = this.expandRight(child, childStartCol, ctx)
        this.advanceRightBandCursor(childRow, ctx, childEndCol + 1)
      }
      for (const child of node.leftChildren) {
        const childAnchor = this.findRenderedPositionForTemplateCell(child.cell.row, child.cell.col, ctx)
        this.expandDown(child, childAnchor?.row ?? child.cell.row, ctx)
      }
    }

    return startCol + effectiveColCount - 1
  }

  /**
   * 右展开是否需要真实插列：
   * - 若目标行带内已有足够空槽位（由前序 right 展开产生），复用现有列，避免再次全局插列影响下方静态区。
   * - 若存在非空占位冲突或越界，则继续插列保持原有兼容行为。
   */
  private shouldInsertColsForRightExpand(
    renderedAnchorRow: number,
    anchorRowSpan: number,
    startCol: number,
    effectiveColCount: number
  ): boolean {
    const rowStart = Math.max(0, renderedAnchorRow)
    const rowEnd = Math.max(rowStart, rowStart + Math.max(1, anchorRowSpan) - 1)
    const targetStartCol = startCol + 1
    const targetEndCol = startCol + effectiveColCount - 1
    const width = this.rendered[0]?.length ?? 0

    if (targetEndCol >= width) return true

    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = targetStartCol; c <= targetEndCol; c++) {
        const rc = this.rendered[r]?.[c]
        if (!rc) continue
        if (this.isReusableRightSlot(rc, rowStart, rowEnd)) continue
        return true
      }
    }
    return false
  }

  /**
   * 可复用的 right 占位：同一行带内、尚未绑定 context 的 right 模板根占位。
   * 这类单元格通常是“后续待处理的右展开根”，不应触发全局插列。
   */
  private isReusableRightSlot(rc: RenderedCell, rowStart: number, rowEnd: number): boolean {
    if (rc.context) return false
    if (rc.row < rowStart || rc.row > rowEnd) return false
    if (rc.source.expandDirection === 'right') return true

    if (rc.source.expandDirection !== 'none') return false
    if (rc.source.dataset || rc.source.fieldName) return false
    return (rc.source.content ?? '').trim() === ''
  }

  /** 填充同行其他单元格的上下文（从属单元格跟随主格展开） */
  private fillRowCells(row: number, masterRenderedCol: number, ctx: ExpandContext) {
    // 同行所有未设置 context 的单元格继承主格上下文
    // 不再用 source.row 比较（粘贴后主格 row 已变，无法匹配模板行）
    for (let c = 0; c < this.rendered[row].length; c++) {
      if (c === masterRenderedCol) continue
      const rc = this.rendered[row][c]
      if (rc && !rc.context) {
        rc.context = ctx
      }
    }
  }

  /** 填充非展开单元格（无主格的普通单元格） */
  private fillNonExpandCells() {
    const rootCtx = createRootContext(this.params, this.getDatasetRowsRecord())
    for (let r = 0; r < this.rendered.length; r++) {
      for (let c = 0; c < this.rendered[r].length; c++) {
        const rc = this.rendered[r][c]
        if (rc && !rc.context) {
          // 无上下文的单元格使用根上下文
          rc.context = rootCtx
        }
      }
    }
  }

  /** 填充同列中本展开单元格下方的非展开单元格 */
  private fillColCells(col: number, masterCell: Cell, ctx: ExpandContext) {
    for (let r = 0; r < this.rendered.length; r++) {
      const rc = this.rendered[r]?.[col]
      if (rc && !rc.context && rc.source.col === masterCell.col) {
        rc.context = ctx
      }
    }
  }

  /** 设置渲染单元格 */
  private setRenderedCell(row: number, col: number, source: Cell, ctx: ExpandContext) {
    while (row >= this.rendered.length) this.appendRow()
    while (col >= this.rendered[0].length) this.appendCol()
    const existing = this.rendered[row][col]
    const existingReusable = existing ? this.isReusableRightSlot(existing, row, row) : false
    if (existing && !existingReusable && (existing.source.row !== source.row || existing.source.col !== source.col)) {
      this.addWarning({
        message: `单元格 ${existing.source.name} 与 ${source.name} 在渲染坐标 ${colIndex(col)}${row + 1} 发生覆盖冲突`,
        sourceCell: source.name,
        targetCell: existing.source.name,
        renderRow: row,
        renderCol: col
      })
    }
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
        if (this.rendered[r]?.[c]) {
          const covered = this.rendered[r][c]
          if (covered && (covered.source.row !== source.row || covered.source.col !== source.col)) {
            this.addWarning({
              message: `合并单元格 ${source.name} 覆盖了 ${covered.source.name}（渲染坐标 ${colIndex(c)}${r + 1}）`,
              sourceCell: source.name,
              targetCell: covered.source.name,
              renderRow: r,
              renderCol: c
            })
          }
        }
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
  /**
   * 从模板对应列克隆单元格并插入新列（仅克隆展开锚点所在行段，避免覆盖无关静态区域）
   * @param at 插入位置
   * @param count 插入列数
   * @param templateCol 模板列索引
   * @param renderedAnchorRow 展开锚点在「渲染网格」中的行（前序展开后可能已偏移）
   * @param anchorRowSpan 展开锚点行跨度
   * @param templateAnchorRow 展开锚点模板行（用于取模板单元格内容/样式）
   */
  private insertColsFromTemplate(
    at: number,
    count: number,
    templateCol: number,
    renderedAnchorRow: number,
    anchorRowSpan: number,
    templateAnchorRow: number
  ) {
    const rowStart = Math.max(0, renderedAnchorRow)
    const rowEnd = Math.max(rowStart, rowStart + Math.max(1, anchorRowSpan) - 1)
    for (let i = 0; i < count; i++) {
      for (let r = 0; r < this.rendered.length; r++) {
        const inAnchorBand = r >= rowStart && r <= rowEnd
        // 落位用渲染行 r，取模板内容用「模板锚点行 + 段内偏移」，两者解耦。
        const tplCell = inAnchorBand
          ? this.templateCells[templateAnchorRow + (r - rowStart)]?.[templateCol]
          : null
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

  /** 查找模板单元格当前在渲染网格中的位置（用于前序展开后坐标自动跟随） */
  private findRenderedPositionForTemplateCell(
    templateRow: number,
    templateCol: number,
    preferredContext?: ExpandContext
  ): { row: number; col: number } | null {
    const candidates: RenderedCell[] = []
    for (let r = 0; r < this.rendered.length; r++) {
      for (let c = 0; c < this.rendered[r].length; c++) {
        const rc = this.rendered[r][c]
        if (rc && rc.source.row === templateRow && rc.source.col === templateCol) {
          candidates.push(rc)
        }
      }
    }
    if (!candidates.length) return null
    if (!preferredContext || candidates.length === 1) {
      return { row: candidates[0].row, col: candidates[0].col }
    }

    // 根上下文阶段优先选择“尚未被展开上下文占用”的候选，
    // 避免被上方 down 展开产生的克隆行抢占锚点（会导致 right 展开落位错乱）。
    if (this.isRootContext(preferredContext)) {
      const untouched = candidates.filter((c) => !c.context)
      if (untouched.length) {
        const bestUntouched = untouched.reduce((best, cur) => {
          const curDist = Math.abs(cur.row - templateRow) + Math.abs(cur.col - templateCol)
          const bestDist = Math.abs(best.row - templateRow) + Math.abs(best.col - templateCol)
          return curDist < bestDist ? cur : best
        })
        return { row: bestUntouched.row, col: bestUntouched.col }
      }
    }

    let best = candidates[0]
    let bestScore = -1
    for (const candidate of candidates) {
      const score = this.scoreContextAffinity(preferredContext, candidate.context)
      if (score > bestScore) {
        best = candidate
        bestScore = score
      }
    }
    return { row: best.row, col: best.col }
  }

  /** 根上下文：无父级、无当前行数据、无当前数据集名 */
  private isRootContext(ctx: ExpandContext): boolean {
    return !ctx.parent && !ctx.rowData && !ctx.datasetName
  }

  /** 上下文亲和度：优先同一上下文实例，其次共享祖先/数据行/数据集名 */
  private scoreContextAffinity(a?: ExpandContext, b?: ExpandContext): number {
    if (!a || !b) return 0
    if (a === b) return 1000

    const chainA = this.getContextChain(a)
    const chainB = this.getContextChain(b)
    for (let i = 0; i < chainA.length; i++) {
      const idx = chainB.indexOf(chainA[i])
      if (idx >= 0) return 800 - i - idx
    }

    for (let i = 0; i < chainA.length; i++) {
      for (let j = 0; j < chainB.length; j++) {
        if (chainA[i].rowData && chainA[i].rowData === chainB[j].rowData) {
          return 600 - i - j
        }
      }
    }

    if (a.datasetName && b.datasetName && a.datasetName === b.datasetName) {
      return 200
    }
    return 1
  }

  private getContextChain(ctx: ExpandContext): ExpandContext[] {
    const chain: ExpandContext[] = []
    let cur: ExpandContext | undefined = ctx
    while (cur) {
      chain.push(cur)
      cur = cur.parent
    }
    return chain
  }

  /** 分配 right 展开起始列：同一渲染行+上下文采用并排布局 */
  private reserveRightBandStart(renderedRow: number, requestedStartCol: number, ctx: ExpandContext): number {
    const key = this.rightBandKey(renderedRow, ctx)
    const nextCol = this.rightBandCursor.get(key)
    if (nextCol == null) return requestedStartCol
    return Math.max(requestedStartCol, nextCol)
  }

  /** 推进 right 展开行带游标 */
  private advanceRightBandCursor(renderedRow: number, ctx: ExpandContext, nextFreeCol: number) {
    const key = this.rightBandKey(renderedRow, ctx)
    const prev = this.rightBandCursor.get(key)
    if (prev == null) {
      this.rightBandCursor.set(key, nextFreeCol)
      return
    }
    this.rightBandCursor.set(key, Math.max(prev, nextFreeCol))
  }

  private rightBandKey(renderedRow: number, ctx: ExpandContext): string {
    return `${renderedRow}|${this.getContextIdentity(ctx)}`
  }

  private getContextIdentity(ctx: ExpandContext): number {
    const existing = this.contextIdentity.get(ctx)
    if (existing != null) return existing
    const id = this.contextIdSeed++
    this.contextIdentity.set(ctx, id)
    return id
  }

  /**
   * 识别“疑似重复右展开根”：同列已有同 dataset.field 的 down 根时，
   * 右展开根常由历史编辑残留造成，会把静态区误填充（如附件中的 B8/C8）。
   */
  private shouldSkipLikelyStrayRightRoot(root: MasterNode, downRoots: MasterNode[]): boolean {
    const cell = root.cell
    if (cell.expandDirection !== 'right') return false
    if (cell.leftMasterCell || cell.topMasterCell) return false
    if (!cell.dataset || !cell.fieldName) return false

    return downRoots.some((d) => {
      const dc = d.cell
      return (
        dc.row < cell.row &&
        dc.col === cell.col &&
        dc.dataset === cell.dataset &&
        dc.fieldName === cell.fieldName
      )
    })
  }

  /** 同行存在多个 right 根通常是用户有意配置，不应按“游离残留”直接抑制 */
  private hasSiblingRightRootInSameRow(root: MasterNode, rightRoots: MasterNode[]): boolean {
    const row = root.cell.row
    return rightRoots.some((r) => r !== root && r.cell.expandDirection === 'right' && r.cell.row === row)
  }

  private getSkipReasonForRightRoot(
    root: MasterNode,
    downRoots: MasterNode[],
    rightRoots: MasterNode[]
  ): string | null {
    if (!this.hasSiblingRightRootInSameRow(root, rightRoots) && this.shouldSkipLikelyStrayRightRoot(root, downRoots)) {
      return '与同列向下展开重复'
    }
    return null
  }

  /** 清理指定模板源单元格在渲染网格中的内容，避免残留占位变量被误显示 */
  private clearRenderedCellsForTemplateSource(templateRow: number, templateCol: number) {
    for (let r = 0; r < this.rendered.length; r++) {
      for (let c = 0; c < this.rendered[r].length; c++) {
        const rc = this.rendered[r][c]
        if (!rc) continue
        if (rc.source.row !== templateRow || rc.source.col !== templateCol) continue
        rc.source.content = ''
        rc.source.dataset = undefined
        rc.source.fieldName = undefined
        rc.source.expandDirection = 'none'
      }
    }
  }
}

function colIndex(col: number): string {
  let name = ''
  let n = col
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name
    n = Math.floor(n / 26) - 1
  }
  return name
}
