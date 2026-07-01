/**
 * CellCanvas 公式交互组件测试
 * 覆盖：普通单元格引用、绑定字段单元格引用、普通范围拖选
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { nextTick } from 'vue'
import CellCanvas from '../src/components/designer/CellCanvas.vue'
import { useReportStore } from '../src/stores/report'
import { useDesignerStore } from '../src/stores/designer'
import { uid } from '../src/utils/id'

function findCellByText(wrapper: ReturnType<typeof mount>, text: string) {
  const cell = wrapper.findAll('.cell').find((node) => node.text().includes(text))
  expect(cell, `未找到包含文本 ${text} 的单元格`).toBeTruthy()
  return cell!
}

describe('CellCanvas formula ui interactions', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('clicking a plain cell in formula mode inserts a normal cell reference', async () => {
    const report = useReportStore()
    const designer = useDesignerStore()
    report.newTemplate('ui-test')
    report.grid!.setCellContent(1, 1, 'PLAIN')

    const wrapper = mount(CellCanvas, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: {
          QRPreview: true,
          BarcodePreview: true,
          ChartCell: true
        }
      }
    })

    designer.setSelection(0, 0)
    designer.requestStartFormulaEdit()
    await nextTick()
    await nextTick()

    const plainCell = findCellByText(wrapper, 'PLAIN')
    await plainCell.trigger('mousedown', { button: 0 })
    await nextTick()

    const editor = wrapper.get('textarea.cell-editor')
    expect((editor.element as HTMLTextAreaElement).value).toBe('=B2')
  })

  it('clicking a dataset-bound cell in formula mode inserts dataset variable token', async () => {
    const report = useReportStore()
    const designer = useDesignerStore()
    report.newTemplate('ui-test')
    const bound = report.grid!.getRealCell(1, 2)!
    bound.content = '${ds1.amount}'
    bound.dataset = 'ds1'
    bound.fieldName = 'amount'

    const wrapper = mount(CellCanvas, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: {
          QRPreview: true,
          BarcodePreview: true,
          ChartCell: true
        }
      }
    })

    designer.setSelection(0, 0)
    designer.requestStartFormulaEdit()
    await nextTick()
    await nextTick()

    const boundCell = findCellByText(wrapper, '${ds1.amount}')
    await boundCell.trigger('mousedown', { button: 0 })
    await nextTick()

    const editor = wrapper.get('textarea.cell-editor')
    expect((editor.element as HTMLTextAreaElement).value).toBe('=${ds1.amount}')
  })

  it('dragging across plain cells in formula mode inserts a range reference', async () => {
    const report = useReportStore()
    const designer = useDesignerStore()
    report.newTemplate('ui-test')
    report.grid!.setCellContent(1, 1, 'RANGE_START')
    report.grid!.setCellContent(1, 3, 'RANGE_END')

    const wrapper = mount(CellCanvas, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: {
          QRPreview: true,
          BarcodePreview: true,
          ChartCell: true
        }
      }
    })

    const cellsArea = wrapper.get('.cells-area').element as HTMLDivElement
    Object.defineProperty(cellsArea, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })
    })

    designer.setSelection(0, 0)
    designer.requestStartFormulaEdit()
    await nextTick()
    await nextTick()

    const startCell = findCellByText(wrapper, 'RANGE_START')
    await startCell.trigger('mousedown', { button: 0 })
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 350, clientY: 40 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await nextTick()

    const editor = wrapper.get('textarea.cell-editor')
    expect((editor.element as HTMLTextAreaElement).value).toBe('=B2:D2')
  })

  it('re-clicking the same cell while editing a formula should not insert self reference', async () => {
    const report = useReportStore()
    report.newTemplate('ui-test')
    report.grid!.setCellContent(0, 0, '=A1+B1')

    const wrapper = mount(CellCanvas, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: {
          QRPreview: true,
          BarcodePreview: true,
          ChartCell: true
        }
      }
    })

    const formulaCell = findCellByText(wrapper, '=A1+B1')
    await formulaCell.trigger('dblclick')
    await nextTick()

    const editorBefore = wrapper.get('textarea.cell-editor')
    expect((editorBefore.element as HTMLTextAreaElement).value).toBe('=A1+B1')

    // 公式编辑中点击同一单元格，仅用于继续编辑，不应插入 A1 引用。
    await formulaCell.trigger('mousedown', { button: 0 })
    await nextTick()

    const editorAfter = wrapper.get('textarea.cell-editor')
    expect((editorAfter.element as HTMLTextAreaElement).value).toBe('=A1+B1')
  })

  it('dragging row headers should select multiple full rows', async () => {
    const report = useReportStore()
    const designer = useDesignerStore()
    report.newTemplate('ui-test')

    const wrapper = mount(CellCanvas, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: {
          QRPreview: true,
          BarcodePreview: true,
          ChartCell: true
        }
      }
    })

    const cellsArea = wrapper.get('.cells-area').element as HTMLDivElement
    Object.defineProperty(cellsArea, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 1200,
        bottom: 800,
        width: 1200,
        height: 800,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })
    })

    const rowHeaders = wrapper.findAll('.row-header')
    await rowHeaders[1].trigger('mousedown', { button: 0 })
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 85 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await nextTick()

    expect(designer.selection.startRow).toBe(1)
    expect(designer.selection.endRow).toBe(3)
    expect(designer.selection.startCol).toBe(0)
    expect(designer.selection.endCol).toBe(report.grid!.colCount - 1)
  })

  it('dragging column headers should select multiple full columns', async () => {
    const report = useReportStore()
    const designer = useDesignerStore()
    report.newTemplate('ui-test')

    const wrapper = mount(CellCanvas, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: {
          QRPreview: true,
          BarcodePreview: true,
          ChartCell: true
        }
      }
    })

    const cellsArea = wrapper.get('.cells-area').element as HTMLDivElement
    Object.defineProperty(cellsArea, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 1200,
        bottom: 800,
        width: 1200,
        height: 800,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })
    })

    const colHeaders = wrapper.findAll('.col-header')
    await colHeaders[1].trigger('mousedown', { button: 0 })
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 340, clientY: 10 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await nextTick()

    expect(designer.selection.startCol).toBe(1)
    expect(designer.selection.endCol).toBe(3)
    expect(designer.selection.startRow).toBe(0)
    expect(designer.selection.endRow).toBe(report.grid!.rowCount - 1)
  })

  it('right clicking inside a selected row range should keep multi-row selection for batch delete', async () => {
    const report = useReportStore()
    const designer = useDesignerStore()
    report.newTemplate('ui-test')

    const wrapper = mount(CellCanvas, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: {
          QRPreview: true,
          BarcodePreview: true,
          ChartCell: true
        }
      }
    })

    const cellsArea = wrapper.get('.cells-area').element as HTMLDivElement
    Object.defineProperty(cellsArea, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 1200,
        bottom: 800,
        width: 1200,
        height: 800,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })
    })

    const rowHeaders = wrapper.findAll('.row-header')
    await rowHeaders[1].trigger('mousedown', { button: 0 })
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 85 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await nextTick()

    await rowHeaders[2].trigger('mousedown', { button: 2 })
    await rowHeaders[2].trigger('contextmenu', { button: 2, clientX: 20, clientY: 20 })
    await nextTick()

    expect(designer.selection.startRow).toBe(1)
    expect(designer.selection.endRow).toBe(3)
    expect(designer.selection.startCol).toBe(0)
    expect(designer.selection.endCol).toBe(report.grid!.colCount - 1)
  })

  it('right clicking inside a selected column range should keep multi-column selection for batch delete', async () => {
    const report = useReportStore()
    const designer = useDesignerStore()
    report.newTemplate('ui-test')

    const wrapper = mount(CellCanvas, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: {
          QRPreview: true,
          BarcodePreview: true,
          ChartCell: true
        }
      }
    })

    const cellsArea = wrapper.get('.cells-area').element as HTMLDivElement
    Object.defineProperty(cellsArea, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 1200,
        bottom: 800,
        width: 1200,
        height: 800,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })
    })

    const colHeaders = wrapper.findAll('.col-header')
    await colHeaders[1].trigger('mousedown', { button: 0 })
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 340, clientY: 10 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await nextTick()

    await colHeaders[2].trigger('mousedown', { button: 2 })
    await colHeaders[2].trigger('contextmenu', { button: 2, clientX: 20, clientY: 20 })
    await nextTick()

    expect(designer.selection.startCol).toBe(1)
    expect(designer.selection.endCol).toBe(3)
    expect(designer.selection.startRow).toBe(0)
    expect(designer.selection.endRow).toBe(report.grid!.rowCount - 1)
  })

  it('whole-row or whole-column selection should highlight headers without cell outline flood', async () => {
    const report = useReportStore()
    const designer = useDesignerStore()
    report.newTemplate('ui-test')

    const wrapper = mount(CellCanvas, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: {
          QRPreview: true,
          BarcodePreview: true,
          ChartCell: true
        }
      }
    })

    const rowHeaders = wrapper.findAll('.row-header')
    await rowHeaders[1].trigger('mousedown', { button: 0 })
    await nextTick()
    // 整行选中：单元格不描边(selected)，改用底色(band-selected)突出，表头高亮
    expect(wrapper.findAll('.cell.selected').length).toBe(0)
    expect(wrapper.findAll('.cell.band-selected').length).toBeGreaterThan(0)
    expect(wrapper.findAll('.row-header.selected').length).toBeGreaterThan(0)
    expect(wrapper.findAll('.col-header.selected').length).toBe(0)

    const colHeaders = wrapper.findAll('.col-header')
    await colHeaders[1].trigger('mousedown', { button: 0 })
    await nextTick()
    expect(wrapper.findAll('.cell.selected').length).toBe(0)
    expect(wrapper.findAll('.cell.band-selected').length).toBeGreaterThan(0)
    expect(wrapper.findAll('.col-header.selected').length).toBeGreaterThan(0)
    expect(wrapper.findAll('.row-header.selected').length).toBe(0)

    designer.setSelection(2, 2)
    await nextTick()
    // 单个单元格选中：维持描边样式，不使用底色高亮
    expect(wrapper.findAll('.cell.selected').length).toBe(1)
    expect(wrapper.findAll('.cell.band-selected').length).toBe(0)
  })

  it('drag selection should not double-count scroll offset (formula-mode over-selection)', async () => {
    const report = useReportStore()
    const designer = useDesignerStore()
    report.newTemplate('ui-test')

    const wrapper = mount(CellCanvas, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: {
          QRPreview: true,
          BarcodePreview: true,
          ChartCell: true
        }
      }
    })

    // 模拟已向下滚动 56px（2 行）。因虚拟滚动缓冲(BUFFER*28=140>56)，第 0 行仍会渲染。
    const canvasEl = wrapper.get('.cell-canvas').element as HTMLElement
    Object.defineProperty(canvasEl, 'scrollTop', { configurable: true, value: 56 })
    Object.defineProperty(canvasEl, 'scrollLeft', { configurable: true, value: 0 })
    await wrapper.get('.cell-canvas').trigger('scroll')
    await nextTick()

    // 真实 DOM 中滚动 56px 后，.cells-area 内容顶部上移到视口 y=-56。
    const cellsArea = wrapper.get('.cells-area').element as HTMLDivElement
    Object.defineProperty(cellsArea, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: -56,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: -56,
        toJSON: () => ({})
      })
    })

    // 从 A1(第 0 行) 起拖，鼠标移动到 clientY=40：
    //   正确映射 relY = 40 - (-56) = 96 → 第 3 行(index 3)。
    //   若错误叠加 scrollTop(56) 会得到 relY=152 → 第 5 行，形成“大面积超选”。
    const firstCell = wrapper.findAll('.cell')[0]
    await firstCell.trigger('mousedown', { button: 0 })
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 40 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await nextTick()

    expect(designer.selection.startRow).toBe(0)
    expect(designer.selection.endRow).toBe(3)
  })

  it('pasting copied formula cells should shift relative references by paste offset', async () => {
    const report = useReportStore()
    const designer = useDesignerStore()
    report.newTemplate('ui-test')
    report.grid!.setCellContent(0, 0, '1')
    report.grid!.setCellContent(0, 1, '2')
    report.grid!.setCellContent(0, 2, '=A1+B1')

    const wrapper = mount(CellCanvas, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: {
          QRPreview: true,
          BarcodePreview: true,
          ChartCell: true
        }
      }
    })

    const formulaCell = findCellByText(wrapper, '=A1+B1')
    await formulaCell.trigger('mousedown', { button: 0 })
    const anyVm = wrapper.vm as any
    anyVm.doCopy()

    designer.setSelection(1, 2)
    anyVm.doPaste()
    await nextTick()

    expect(report.grid!.getRealCell(1, 2)!.content).toBe('=A2+B2')
  })

  it('structural edits through canvas should shift condition format scopes', async () => {
    const report = useReportStore()
    const designer = useDesignerStore()
    report.newTemplate('ui-test')
    report.currentTemplate!.conditionFormats.push({
      id: uid('cf_'),
      name: 'scope-test',
      scope: 'A1:B2',
      rules: []
    })

    const wrapper = mount(CellCanvas, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: {
          QRPreview: true,
          BarcodePreview: true,
          ChartCell: true
        }
      }
    })

    designer.setSelection(0, 0)
    const anyVm = wrapper.vm as any
    anyVm.doInsertRow()
    anyVm.doInsertCol()
    await nextTick()

    expect(report.currentTemplate!.conditionFormats[0].scope).toBe('B2:C3')
  })
})
