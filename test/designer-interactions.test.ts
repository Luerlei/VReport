/**
 * 设计器交互回归测试
 * 覆盖: 公式区域引用、IME 键盘保护、字段插入绑定同步、属性面板字段联动
 */
import { describe, it, expect } from 'vitest'
import { createCell } from '../src/core/cell/types'
import {
  toCellRef,
  toRangeRef,
  shouldIgnoreCanvasKeydownForIME,
  applyFieldBinding,
  getFormulaPickToken,
  clampMenuPosition
} from '../src/components/designer/canvasEditHelpers'
import {
  getDatasetFieldOptions,
  normalizeFieldValueForDataset,
  datasetVarOfCell
} from '../src/components/designer/propertyBindingHelpers'
import { createEmptyTemplate } from '../src/core/serializer/Serializer'

describe('designer interactions helpers', () => {
  it('toCellRef/toRangeRef should build excel style refs', () => {
    expect(toCellRef(1, 3)).toBe('D2')
    expect(toRangeRef(1, 3, 7, 3)).toBe('D2:D8')
    // 反向拖拽也应归一化
    expect(toRangeRef(7, 3, 1, 3)).toBe('D2:D8')
    // 单格区域退化为单引用
    expect(toRangeRef(2, 2, 2, 2)).toBe('C3')
  })

  it('clampMenuPosition should keep context menu inside viewport near edges', () => {
    const vw = 1000
    const vh = 800
    // 光标在中间：不夹取
    expect(clampMenuPosition(300, 200, 180, 260, vw, vh)).toEqual({ x: 300, y: 200 })
    // 靠右下角：向左/上回收，保证完整显示
    expect(clampMenuPosition(950, 760, 180, 260, vw, vh)).toEqual({
      x: vw - 180 - 6,
      y: vh - 260 - 6
    })
    // 极端小视口：至少保证从 margin 开始（顶/左可见）
    const r = clampMenuPosition(50, 50, 400, 900, 300, 500)
    expect(r.x).toBe(6)
    expect(r.y).toBe(6)
  })

  it('datasetVarOfCell should detect dataset variable via metadata or content', () => {
    // 显式绑定优先
    expect(datasetVarOfCell({ dataset: 'ds1', fieldName: 'qty', content: '' })).toBe('ds1.qty')
    // 无绑定时回退解析内容中的单个 ${ds.field}
    expect(datasetVarOfCell({ content: '${shiftData.label}' })).toBe('shiftData.label')
    expect(datasetVarOfCell({ content: '  ${calcData.qty}  ' })).toBe('calcData.qty')
    // 聚合公式 / 普通文本 / 空 不算数据集变量
    expect(datasetVarOfCell({ content: '=sum(${calcData.qty})' })).toBeNull()
    expect(datasetVarOfCell({ content: '普通文本' })).toBeNull()
    expect(datasetVarOfCell({ content: '' })).toBeNull()
    expect(datasetVarOfCell(null)).toBeNull()
  })

  it('shouldIgnoreCanvasKeydownForIME should bypass composing key events', () => {
    const composingEvent = { isComposing: true, key: 'a', keyCode: 65 } as KeyboardEvent
    const processEvent = { isComposing: false, key: 'Process', keyCode: 229 } as KeyboardEvent
    const normalEvent = { isComposing: false, key: 'a', keyCode: 65 } as KeyboardEvent

    expect(shouldIgnoreCanvasKeydownForIME(composingEvent)).toBe(true)
    expect(shouldIgnoreCanvasKeydownForIME(processEvent)).toBe(true)
    expect(shouldIgnoreCanvasKeydownForIME(normalEvent)).toBe(false)
  })

  it('applyFieldBinding should sync dataset/field and keep aggregate default', () => {
    const cell = createCell(0, 0)
    const changed = applyFieldBinding(cell, 'orders', 'amount')

    expect(changed).toBe(true)
    expect(cell.dataset).toBe('orders')
    expect(cell.fieldName).toBe('amount')
    expect(cell.aggregate).toBe('none')

    const changedAgain = applyFieldBinding(cell, 'orders', 'amount')
    expect(changedAgain).toBe(false)
  })

  it('getFormulaPickToken should prefer dataset field variable on bound cell', () => {
    const bound = createCell(2, 3)
    bound.dataset = 'orders'
    bound.fieldName = 'amount'
    expect(getFormulaPickToken(bound, 2, 3)).toBe('${orders.amount}')

    const plain = createCell(2, 3)
    expect(getFormulaPickToken(plain, 2, 3)).toBe('D3')
  })

  it('getDatasetFieldOptions should merge extractor fields and cached row fields', () => {
    const tpl = createEmptyTemplate('fields-test')
    tpl.dataSets = [
      {
        id: 'ds1',
        name: 'orders',
        sourceId: 'src1',
        extractor: {
          fields: [
            { field: 'amount' },
            { field: 'createdAt', alias: 'created_date' }
          ]
        },
        cachedRows: [{ amount: 100, region: 'east' }]
      }
    ]

    const fields = getDatasetFieldOptions(tpl, 'orders')
    expect(fields).toEqual(['amount', 'created_date', 'region'])
  })

  it('normalizeFieldValueForDataset should clear invalid field value on dataset switch', () => {
    expect(normalizeFieldValueForDataset('amount', ['amount', 'region'])).toBe('amount')
    expect(normalizeFieldValueForDataset('name', ['amount', 'region'])).toBe('')
  })
})
