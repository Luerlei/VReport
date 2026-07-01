/**
 * 回归：多个向下展开根 + 同数据集向右展开根共存时，
 * 向右展开不得在“模板行索引”处产生游离单元格（预览 I6/I7、导出 C/D 列脏数据的根因）。
 */
import { describe, it, expect } from 'vitest'
import { createEmptyTemplate, gridFromTemplate } from '../src/core/serializer/Serializer'
import { ExpandEngine } from '../src/core/engine/ExpandEngine'
import { Aggregator } from '../src/core/engine/Aggregator'

describe('right expansion should not leave stray cells at template-row band', () => {
  it('down+down then right on same dataset lands only at shifted row', () => {
    const tpl = createEmptyTemplate('shift-stray')
    tpl.dataSets = [
      {
        id: 'set1',
        name: 'shiftData',
        sourceId: 'src1',
        extractor: {},
        cachedRows: [{ label: '上移一' }, { label: '上移二' }, { label: '上移三' }]
      }
    ]

    const grid = gridFromTemplate(tpl)
    // A4 (row3,col0) 向下展开
    const a4 = grid.getRealCell(3, 0)!
    a4.content = '${shiftData.label}'
    a4.dataset = 'shiftData'
    a4.fieldName = 'label'
    a4.expandDirection = 'down'
    // B4 (row3,col1) 静态合并块，横跨 7 列（模拟附件“此块会展开 3 行”）
    grid.setCellContent(3, 1, '此块会展开 3 行')
    grid.merge(3, 1, 3, 7)
    // A5 (row4,col0) 向下展开
    const a5 = grid.getRealCell(4, 0)!
    a5.content = '${shiftData.label}'
    a5.dataset = 'shiftData'
    a5.fieldName = 'label'
    a5.expandDirection = 'down'
    // B6 (row5,col1) 向右展开
    const b6 = grid.getRealCell(5, 1)!
    b6.content = '${shiftData.label}'
    b6.dataset = 'shiftData'
    b6.fieldName = 'label'
    b6.expandDirection = 'right'

    const result = new ExpandEngine(
      grid.cells,
      grid.rows.map((r) => r.height),
      grid.columns.map((c) => c.width),
      tpl.dataSets
    ).expand()
    new Aggregator(result.grid).evaluateAll()

    // 向右展开落在“被前序向下展开下推后的真实渲染行”（idx 9）：B10/C10/D10
    expect(result.grid[9]?.[1]?.value).toBe('上移一')
    expect(result.grid[9]?.[2]?.value).toBe('上移二')
    expect(result.grid[9]?.[3]?.value).toBe('上移三')

    // 关键回归：模板行 idx5（B6 的模板行）不得出现游离右展开单元格
    expect(result.grid[5]?.[2]?.value ?? '').toBe('')
    expect(result.grid[5]?.[3]?.value ?? '').toBe('')

    // 也不应把游离数据写入更靠右的列（预览中曾出现在 I/J 区域）
    for (let c = 2; c < (result.grid[5]?.length ?? 0); c++) {
      const v = result.grid[5]?.[c]?.value ?? ''
      expect(v === '上移二' || v === '上移三').toBe(false)
    }
  })
})
