/**
 * 设计器交互状态：选中、编辑、复制
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Cell } from '@/core/cell/types'

export interface DesignerConflictWarning {
  message: string
  sourceCell?: string
  targetCell?: string
}

/** 选区范围 */
export interface Selection {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

export const useDesignerStore = defineStore('designer', () => {
  /** 当前选区 */
  const selection = ref<Selection>({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 })
  /** 正在编辑的单元格坐标 */
  const editingCell = ref<{ row: number; col: number } | null>(null)
  /** 复制的单元格数据矩阵(支持多单元格复制粘贴) */
  const clipboard = ref<{ cells: Cell[][]; cutMode: boolean } | null>(null)
  /** 缩放比例 */
  const zoom = ref(100)
  /** 主格拾取模式:null=未拾取, 'left'=拾取左主格, 'top'=拾取上主格 */
  const masterPicking = ref<'left' | 'top' | null>(null)
  /** 拾取到的主格引用(由画布点击后填充) */
  const pickedMasterCell = ref<string | null>(null)
  /** 字段插入请求(由数据面板触发,画布监听后插入到光标位置或当前单元格) */
  const fieldInsertRequest = ref<{ dsName: string; fieldName: string } | null>(null)

  /** 请求插入字段变量到当前单元格 */
  function requestFieldInsert(dsName: string, fieldName: string) {
    fieldInsertRequest.value = { dsName, fieldName }
  }

  /** 清除字段插入请求(由画布消费后调用) */
  function clearFieldInsertRequest() {
    fieldInsertRequest.value = null
  }

  /** 公式编辑模式:点击单元格插入单元格引用作为公式参数 */
  const formulaPicking = ref(false)
  /** 公式编辑启动信号(由工具栏触发,画布监听后进入公式编辑) */
  const startFormulaEditSignal = ref(0)
  /** 保存前展开校验冲突告警（用于设计器页展示和高亮） */
  const saveConflictWarnings = ref<DesignerConflictWarning[]>([])
  /** 冲突单元格 key 集合(row,col) */
  const saveConflictCellKeys = computed(() => {
    const keys = new Set<string>()
    for (const w of saveConflictWarnings.value) {
      if (w.sourceCell) keys.add(w.sourceCell)
      if (w.targetCell) keys.add(w.targetCell)
    }
    return keys
  })

  /** 请求进入公式编辑模式 */
  function requestStartFormulaEdit() {
    startFormulaEditSignal.value++
  }

  /** 更新保存冲突告警 */
  function setSaveConflictWarnings(warnings: DesignerConflictWarning[]) {
    saveConflictWarnings.value = warnings
  }

  /** 清理保存冲突告警 */
  function clearSaveConflictWarnings() {
    saveConflictWarnings.value = []
  }

  /** 是否选中单个单元格 */
  const isSingle = computed(
    () =>
      selection.value.startRow === selection.value.endRow &&
      selection.value.startCol === selection.value.endCol
  )

  /** 选中区域行数 */
  const rowCount = computed(() => selection.value.endRow - selection.value.startRow + 1)
  /** 选中区域列数 */
  const colCount = computed(() => selection.value.endCol - selection.value.startCol + 1)

  /** 设置选区 */
  function setSelection(row: number, col: number, additive = false) {
    if (additive) {
      const s = selection.value
      selection.value = {
        startRow: Math.min(s.startRow, row),
        startCol: Math.min(s.startCol, col),
        endRow: Math.max(s.endRow, row),
        endCol: Math.max(s.endCol, col)
      }
    } else {
      selection.value = { startRow: row, startCol: col, endRow: row, endCol: col }
    }
    editingCell.value = null
  }

  /** 扩展选区到指定位置 */
  function extendSelection(row: number, col: number) {
    const s = selection.value
    selection.value = {
      startRow: Math.min(s.startRow, row),
      startCol: Math.min(s.startCol, col),
      endRow: Math.max(s.endRow, row),
      endCol: Math.max(s.endCol, col)
    }
  }

  /** 进入编辑 */
  function startEdit(row: number, col: number) {
    editingCell.value = { row, col }
  }

  /** 退出编辑 */
  function endEdit() {
    editingCell.value = null
  }

  /** 设置缩放 */
  function setZoom(z: number) {
    zoom.value = Math.max(50, Math.min(200, z))
  }

  return {
    selection,
    editingCell,
    clipboard,
    zoom,
    masterPicking,
    pickedMasterCell,
    fieldInsertRequest,
    requestFieldInsert,
    clearFieldInsertRequest,
    formulaPicking,
    startFormulaEditSignal,
    saveConflictWarnings,
    saveConflictCellKeys,
    requestStartFormulaEdit,
    setSaveConflictWarnings,
    clearSaveConflictWarnings,
    isSingle,
    rowCount,
    colCount,
    setSelection,
    extendSelection,
    startEdit,
    endEdit,
    setZoom
  }
})
