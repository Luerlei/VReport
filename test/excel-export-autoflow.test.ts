/**
 * 回归：导出 Excel 应与预览一致——右展开插入的“空隙列”不得在导出中残留为空白列。
 * computeAutoFlowPlacements 复刻预览(HTML 表格跳过 null)的收拢排布。
 */
import { describe, it, expect } from 'vitest'
import { Grid } from '../src/core/cell/Grid'
import { ExpandEngine } from '../src/core/engine/ExpandEngine'
import { Aggregator } from '../src/core/engine/Aggregator'
import { computeAutoFlowPlacements } from '../src/core/export/ExcelExporter'
import type { DataSet } from '../src/types'

function buildShiftPlusStaticTable() {
  const grid = new Grid(12, 8)
  // 上部：shiftData 向下/向右展开区
  const a4 = grid.getRealCell(3, 0)!
  a4.content = '${shiftData.label}'; a4.dataset = 'shiftData'; a4.fieldName = 'label'; a4.expandDirection = 'down'
  grid.setCellContent(3, 1, '此块'); grid.merge(3, 1, 3, 7)
  const a5 = grid.getRealCell(4, 0)!
  a5.content = '${shiftData.label}'; a5.dataset = 'shiftData'; a5.fieldName = 'label'; a5.expandDirection = 'down'
  const b6 = grid.getRealCell(5, 1)!
  b6.content = '${shiftData.label}'; b6.dataset = 'shiftData'; b6.fieldName = 'label'; b6.expandDirection = 'right'
  // 下部：静态表 指标|公式|结果|预期
  grid.setCellContent(9, 0, '指标'); grid.setCellContent(9, 1, '公式')
  grid.setCellContent(9, 2, '结果'); grid.setCellContent(9, 3, '预期')
  grid.setCellContent(10, 0, '数量求和'); grid.setCellContent(10, 1, 'sum(${calcData.qty})')
  grid.setCellContent(10, 2, '=sum(${calcData.qty})'); grid.setCellContent(10, 3, '70')

  const dataSets: DataSet[] = [
    { id: 's1', name: 'shiftData', sourceId: 'x', extractor: {}, cachedRows: [{ label: '上移一' }, { label: '上移二' }, { label: '上移三' }] },
    { id: 's2', name: 'calcData', sourceId: 'y', extractor: {}, cachedRows: [{ qty: 10 }, { qty: 20 }, { qty: 15 }, { qty: 25 }] }
  ]
  const result = new ExpandEngine(
    grid.cells,
    grid.rows.map((r) => r.height),
    grid.columns.map((c) => c.width),
    dataSets
  ).expand()
  new Aggregator(result.grid).evaluateAll()
  return result
}

describe('excel export auto-flow matches preview', () => {
  it('static table below a right-expansion should not get blank C/D gap columns', () => {
    const result = buildShiftPlusStaticTable()
    const placements = computeAutoFlowPlacements(result.grid)

    // 找到静态表头行（含“指标/公式/结果/预期”）
    const byText = (t: string) =>
      placements.find((p) => String(p.cell.value ?? p.cell.source.content ?? '') === t)

    const 指标 = byText('指标')!
    const 公式 = byText('公式')!
    const 结果 = byText('结果')!
    const 预期 = byText('预期')!
    expect(指标).toBeTruthy()

    // 四个表头应在同一行、连续四列（1,2,3,4），而非被空隙列推到 1,2,5,6
    expect(公式.row).toBe(指标.row)
    expect(结果.row).toBe(指标.row)
    expect(预期.row).toBe(指标.row)
    expect(公式.col).toBe(指标.col + 1)
    expect(结果.col).toBe(指标.col + 2)
    expect(预期.col).toBe(指标.col + 3)

    // 数据行同样连续：数量求和 | sum | 结果值 | 预期值
    const 数量求和 = byText('数量求和')!
    const 预期值 = placements.find(
      (p) => p.row === 数量求和.row && p.col === 数量求和.col + 3
    )!
    expect(预期值).toBeTruthy()
    expect(String(预期值.cell.value ?? '')).toBe('70')

    // 该行不得在 数量求和 与其后数据之间出现空列断档
    const rowCols = placements
      .filter((p) => p.row === 数量求和.row)
      .map((p) => p.col)
      .sort((a, b) => a - b)
    const firstFour = rowCols.slice(0, 4)
    expect(firstFour).toEqual([数量求和.col, 数量求和.col + 1, 数量求和.col + 2, 数量求和.col + 3])
  })

  it('placements should honor merged cells (rowspan/colspan) without overlap', () => {
    const grid = new Grid(3, 4)
    grid.setCellContent(0, 0, 'M'); grid.merge(0, 0, 0, 1) // colSpan 2
    grid.setCellContent(0, 2, 'B')
    grid.setCellContent(1, 0, 'C')
    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      []
    ).expand()
    const placements = computeAutoFlowPlacements(result.grid)
    const m = placements.find((p) => p.cell.source.content === 'M')!
    const b = placements.find((p) => p.cell.source.content === 'B')!
    const c = placements.find((p) => p.cell.source.content === 'C')!
    // M 占 1-2 列，B 落在第 3 列（不与合并重叠）
    expect(m.col).toBe(1)
    expect(m.colSpan).toBe(2)
    expect(b.col).toBe(3)
    // 下一行 C 落第 1 列
    expect(c.row).toBe(2)
    expect(c.col).toBe(1)
  })
})
