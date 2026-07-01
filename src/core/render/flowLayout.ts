import type { RenderedCell } from '@/core/engine/ExpandEngine'

export interface FlowPlacement {
  cell: RenderedCell
  rowIndex: number
  flowCol: number // 1-based
  rowSpan: number
  colSpan: number
  sourceCol: number
}

export function hasDisplayValue(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === 'string') return v.trim().length > 0
  return true
}

export function hasDisplayContent(content: unknown): boolean {
  if (typeof content !== 'string') return false
  return content.trim().length > 0
}

/** 与预览一致：文本/公式需有内容或值；可视组件恒可见 */
export function isMeaningfulCell(cell: RenderedCell): boolean {
  const cellType = cell.source.cellType ?? 'text'
  const isVisualComponent =
    cellType === 'chart' ||
    cellType === 'image' ||
    cellType === 'qrcode' ||
    cellType === 'barcode'
  if (isVisualComponent) return true
  if ((cell.rowSpan ?? 1) > 1 || (cell.colSpan ?? 1) > 1) return true
  if (hasDisplayValue(cell.value)) return true
  if (hasDisplayContent(cell.source.content)) return true
  return false
}

/**
 * 同源重复空壳去重：右展开后同一 source 可能在行内右侧出现重复占位，
 * 仅保留最左一个，避免 H 右侧出现额外网格线。
 */
export function shouldRenderCell(
  row: (RenderedCell | null)[][][number],
  col: number,
  cell: RenderedCell | null
): cell is RenderedCell {
  if (!cell) return false
  if (isMeaningfulCell(cell)) return true

  const sourceCol = typeof cell.source.col === 'number' ? cell.source.col : null
  // 无法定位来源列的空壳占位一律不渲染
  if (sourceCol == null) return false

  // 行内“有效内容”覆盖到的最大来源列（用来源列而非渲染列，避免被右移副本放大）
  let maxMeaningfulSourceCol = -1
  for (let c = 0; c < row.length; c++) {
    const cur = row[c]
    if (!cur) continue
    if (!isMeaningfulCell(cur)) continue
    const curSourceCol = typeof cur.source.col === 'number' ? cur.source.col : c
    if (curSourceCol > maxMeaningfulSourceCol) maxMeaningfulSourceCol = curSourceCol
  }

  // 来源列已经落在有效区右侧，视为尾部占位（不渲染）
  if (sourceCol > maxMeaningfulSourceCol) return false
  // 空壳被右移到来源列右侧，通常是右展开副本，占位不应渲染
  if (col > sourceCol) return false

  for (let c = 0; c < col; c++) {
    const left = row[c]
    if (!left) continue
    if (isMeaningfulCell(left)) continue
    if (left.source.row === cell.source.row && left.source.col === cell.source.col) {
      return false
    }
  }
  return true
}

/**
 * 计算预览/导出统一的流式落位：
 * - 跳过 null
 * - 跳过重复空壳
 * - 按 rowspan/colspan 避让
 */
export function computeFlowPlacements(grid: (RenderedCell | null)[][]): FlowPlacement[] {
  const placements: FlowPlacement[] = []
  const occupied = new Set<string>()

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r]
    let flowCol = 1
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]
      if (!shouldRenderCell(row, c, cell)) continue

      while (occupied.has(`${r},${flowCol}`)) flowCol++

      const rowSpan = Math.max(1, cell.rowSpan)
      const colSpan = Math.max(1, cell.colSpan)
      placements.push({
        cell,
        rowIndex: r,
        flowCol,
        rowSpan,
        colSpan,
        sourceCol: c
      })

      for (let rr = r; rr < r + rowSpan; rr++) {
        for (let cc = flowCol; cc < flowCol + colSpan; cc++) {
          if (rr === r && cc === flowCol) continue
          occupied.add(`${rr},${cc}`)
        }
      }

      flowCol += colSpan
    }
  }

  return placements
}

export function computeFlowColWidths(
  grid: (RenderedCell | null)[][],
  colWidths: number[]
): number[] {
  const placements = computeFlowPlacements(grid)
  const widthMap = new Map<number, number>()

  for (const p of placements) {
    for (let s = 0; s < p.colSpan; s++) {
      const flowCol = p.flowCol + s
      const sourceWidth = colWidths[p.sourceCol + s] ?? colWidths[p.sourceCol] ?? 100
      const prev = widthMap.get(flowCol) ?? 0
      if (sourceWidth > prev) widthMap.set(flowCol, sourceWidth)
    }
  }

  const maxFlowCol = Math.max(0, ...Array.from(widthMap.keys()))
  if (maxFlowCol <= 0) return []
  return Array.from({ length: maxFlowCol }, (_, i) => widthMap.get(i + 1) ?? 100)
}
