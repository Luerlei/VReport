import { colIndexToName, type Cell } from '@/core/cell/types'

/** 将坐标格式化为单元格引用(A1) */
export function toCellRef(row: number, col: number): string {
  return colIndexToName(col) + (row + 1)
}

/** 将起止坐标格式化为区域引用(A1 或 A1:B8) */
export function toRangeRef(startRow: number, startCol: number, endRow: number, endCol: number): string {
  const r1 = Math.min(startRow, endRow)
  const r2 = Math.max(startRow, endRow)
  const c1 = Math.min(startCol, endCol)
  const c2 = Math.max(startCol, endCol)
  const from = toCellRef(r1, c1)
  const to = toCellRef(r2, c2)
  return from === to ? from : `${from}:${to}`
}

/**
 * 公式参数拾取 token。
 * 若单元格绑定了数据集字段，优先返回 ${ds.field}，保证数据行数变化时公式仍可动态计算。
 */
export function getFormulaPickToken(cell: Cell | null, row: number, col: number): string {
  if (cell?.dataset && cell?.fieldName) {
    return `\${${cell.dataset}.${cell.fieldName}}`
  }
  return toCellRef(row, col)
}

/**
 * 将弹出菜单夹取进视口，避免在窗口/报表边缘时被裁切。
 * 优先放在光标处；若右/下方溢出则向左/上回收，仍保证不小于 margin。
 */
export function clampMenuPosition(
  preferX: number,
  preferY: number,
  menuW: number,
  menuH: number,
  vw: number,
  vh: number,
  margin = 6
): { x: number; y: number } {
  let x = preferX
  let y = preferY
  if (x + menuW + margin > vw) x = vw - menuW - margin
  if (y + menuH + margin > vh) y = vh - menuH - margin
  return { x: Math.max(margin, x), y: Math.max(margin, y) }
}

/** IME 组合输入阶段不应由画布键盘逻辑接管 */
export function shouldIgnoreCanvasKeydownForIME(e: KeyboardEvent): boolean {
  const anyEvent = e as KeyboardEvent & { keyCode?: number }
  return e.isComposing || e.key === 'Process' || anyEvent.keyCode === 229
}

/** 左侧字段插入时同步更新单元格绑定信息 */
export function applyFieldBinding(cell: Cell, dsName: string, fieldName: string): boolean {
  const changed = cell.dataset !== dsName || cell.fieldName !== fieldName
  if (!changed) return false
  cell.dataset = dsName
  cell.fieldName = fieldName
  cell.aggregate = cell.aggregate ?? 'none'
  return true
}
