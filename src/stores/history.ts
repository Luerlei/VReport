/**
 * 撤销/重做历史栈
 * 基于 Grid 快照（JSON）实现，简单可靠
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { Grid } from '@/core/cell/Grid'
import { useReportStore } from './report'

const MAX_HISTORY = 50

export const useHistoryStore = defineStore('history', () => {
  /** 历史栈（JSON 快照） */
  const undoStack = ref<string[]>([])
  /** 重做栈 */
  const redoStack = ref<string[]>([])

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  /** 在执行 mutation 前调用，保存当前快照 */
  function pushHistory(): void {
    const report = useReportStore()
    if (!report.grid) return
    undoStack.value.push(JSON.stringify(report.grid.toJSON()))
    if (undoStack.value.length > MAX_HISTORY) undoStack.value.shift()
    redoStack.value = []
  }

  /** 撤销 */
  function undo(): void {
    const report = useReportStore()
    if (!report.grid || !undoStack.value.length) return
    // 当前状态压入 redo
    redoStack.value.push(JSON.stringify(report.grid.toJSON()))
    const snapshot = undoStack.value.pop()!
    restore(report.grid, snapshot)
    report.markDirty()
  }

  /** 重做 */
  function redo(): void {
    const report = useReportStore()
    if (!report.grid || !redoStack.value.length) return
    undoStack.value.push(JSON.stringify(report.grid.toJSON()))
    const snapshot = redoStack.value.pop()!
    restore(report.grid, snapshot)
    report.markDirty()
  }

  /** 清空历史（新建/打开模板时调用） */
  function clear(): void {
    undoStack.value = []
    redoStack.value = []
  }

  function restore(grid: Grid, snapshot: string): void {
    const data = JSON.parse(snapshot)
    const newGrid = Grid.fromJSON(data)
    grid.cells = newGrid.cells
    grid.rows = newGrid.rows
    grid.columns = newGrid.columns
  }

  return {
    canUndo,
    canRedo,
    pushHistory,
    undo,
    redo,
    clear
  }
})
