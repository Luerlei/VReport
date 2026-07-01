<template>
  <div
    class="cell-canvas"
    ref="canvasRootRef"
    tabindex="0"
    @scroll="onScroll"
    @contextmenu.prevent="onContextMenu"
    @keydown="onCanvasKeydown"
  >
    <!-- 左上角空白 -->
    <div class="corner-cell"></div>
    <!-- 列表头 -->
    <div class="col-header-row" ref="colHeaderRef">
      <div
        v-if="colSpacerBefore"
        class="col-spacer"
        :style="{ width: colSpacerBefore + 'px' }"
      ></div>
      <div
        v-for="col in visibleCols"
        :key="`col-${col}`"
        class="col-header"
        :class="{ selected: isColSelected(col) }"
          :data-col="col"
        :style="{ width: colWidth(col) + 'px' }"
        @mousedown.prevent="onColHeaderMouseDown($event, col)"
      >
        {{ colIndexToName(col) }}
        <div
          class="col-resize-handle"
          @mousedown.stop.prevent="onColResizeStart($event, col)"
        ></div>
      </div>
      <div
        v-if="colSpacerAfter"
        class="col-spacer"
        :style="{ width: colSpacerAfter + 'px' }"
      ></div>
    </div>
    <!-- 行表头 + 单元格区域 -->
    <div class="canvas-body">
      <div class="row-header-col" ref="rowHeaderRef">
        <div
          v-if="rowSpacerBefore"
          class="row-spacer"
          :style="{ height: rowSpacerBefore + 'px' }"
        ></div>
        <div
          v-for="row in visibleRows"
          :key="`row-${row}`"
          class="row-header"
          :class="{ selected: isRowSelected(row) }"
          :data-row="row"
          :style="{ height: rowHeight(row) + 'px' }"
          @mousedown.prevent="onRowHeaderMouseDown($event, row)"
        >
          {{ row + 1 }}
          <div
            class="row-resize-handle"
            @mousedown.stop.prevent="onRowResizeStart($event, row)"
          ></div>
        </div>
        <div
          v-if="rowSpacerAfter"
          class="row-spacer"
          :style="{ height: rowSpacerAfter + 'px' }"
        ></div>
      </div>
      <div
        class="cells-area"
        ref="cellsAreaRef"
        @mousedown="onCellsAreaMouseDown"
      >
        <div
          v-if="rowSpacerBefore"
          class="row-spacer"
          :style="{ height: rowSpacerBefore + 'px' }"
        ></div>
        <div
          v-for="row in visibleRows"
          :key="`r-${row}`"
          class="cell-row"
          :style="{ height: rowHeight(row) + 'px' }"
        >
          <div
            v-if="colSpacerBefore"
            class="col-spacer"
            :style="{ width: colSpacerBefore + 'px' }"
          ></div>
          <div
            v-for="col in visibleCols"
            :key="`c-${row}-${col}`"
            class="cell"
            :class="cellClass(row, col)"
            :data-row="row"
            :data-col="col"
            :style="cellStyle(row, col)"
            @mousedown.stop="onCellMouseDown($event, row, col)"
            @dblclick="onCellDblClick(row, col)"
          >
            <span
              v-if="showExpandIndicator(row, col)"
              class="expand-indicator"
              :class="`dir-${expandDirectionOf(row, col)}`"
              :title="expandIndicatorTitle(row, col)"
            ></span>
            <template v-if="isEditing(row, col)">
              <textarea
                ref="editorRefs"
                v-model="editValue"
                class="cell-editor"
                :style="editorStyle(row, col)"
                @blur="commitEdit"
                @keydown.enter.exact.prevent="onEditorEnter"
                @keydown.tab.exact.prevent="onEditorTab"
                @keydown.esc.prevent="onEditorEsc"
                @keydown.up.prevent="onSuggestionNav(-1)"
                @keydown.down.prevent="onSuggestionNav(1)"
                @input="onEditorInput"
              />
              <!-- 公式联想提示 -->
              <div v-if="formulaSuggestions.length" class="formula-suggest">
                <div
                  v-for="(s, i) in formulaSuggestions"
                  :key="s.name"
                  class="suggest-item"
                  :class="{ active: i === suggestIndex }"
                  @mousedown.prevent="applySuggestion(s)"
                >
                  <span class="suggest-name">{{ s.signature }}</span>
                  <span class="suggest-desc">{{ s.desc }}</span>
                </div>
              </div>
              <!-- 参数提示 + 当前参数高亮 + 示例 -->
              <div v-if="paramHint" class="param-hint">
                <div class="hint-line">
                  <span class="hint-fn">{{ paramHint.name }}</span>(<template
                    v-for="(arg, i) in (paramHint.args ?? [])"
                    :key="i"
                  ><span
                      :style="
                        i === paramHint.activeArg
                          ? 'font-weight:700;color:#0078D4;text-decoration:underline'
                          : ''
                      "
                    >{{ arg }}</span><span v-if="i < (paramHint.args ?? []).length - 1">, </span></template
                  >) <span class="hint-desc">— {{ paramHint.desc }}</span>
                </div>
                <div v-if="paramHint.example" class="hint-example">示例：{{ paramHint.example }}</div>
              </div>
              <!-- 公式错误提示 -->
              <div v-if="formulaError" class="formula-error">
                {{ formulaError }}
              </div>
            </template>
            <template v-else>
              <img
                v-if="cellTypeOf(row, col) === 'image'"
                :src="imageUrlOf(row, col)"
                class="cell-image-el"
                :style="imageStyleOf(row, col)"
              />
              <QRPreview
                v-else-if="cellTypeOf(row, col) === 'qrcode'"
                :config="realCell(row, col)?.qrConfig"
                :width="qrSize(row, col)"
                :height="qrSize(row, col)"
              />
              <BarcodePreview
                v-else-if="cellTypeOf(row, col) === 'barcode'"
                :config="realCell(row, col)?.barcodeConfig"
              />
              <ChartCell
                v-else-if="cellTypeOf(row, col) === 'chart'"
                :config="realCell(row, col)?.chartConfig"
                :width="chartWidth(row, col)"
                :height="chartHeight(row, col)"
                class="cell-chart"
              />
              <span v-else class="cell-text">{{ displayText(row, col) }}</span>
            </template>
          </div>
          <div
            v-if="colSpacerAfter"
            class="col-spacer"
            :style="{ width: colSpacerAfter + 'px' }"
          ></div>
        </div>
        <div
          v-if="rowSpacerAfter"
          class="row-spacer"
          :style="{ height: rowSpacerAfter + 'px' }"
        ></div>
      </div>
    </div>

    <!-- 右键菜单 -->
    <div
      v-if="contextMenu.show"
      ref="contextMenuRef"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <div class="menu-item" @click="doCopy">
        <CopyOutlined /> 复制 <span class="menu-shortcut">Ctrl+C</span>
      </div>
      <div class="menu-item" @click="doCut">
        <ScissorOutlined /> 剪切 <span class="menu-shortcut">Ctrl+X</span>
      </div>
      <div class="menu-item" @click="doPaste">
        <SnippetsOutlined /> 粘贴 <span class="menu-shortcut">Ctrl+V</span>
      </div>
      <div class="menu-item danger" @click="doDeleteContent">
        <DeleteOutlined /> 删除内容 <span class="menu-shortcut">Delete</span>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" @click="doSelectAll">
        <DragOutlined /> 全选 <span class="menu-shortcut">Ctrl+A</span>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" @click="doInsertRow">
        <div class="menu-item-main"><InsertRowAboveOutlined /> 向上插入行</div>
        <input
          v-model.number="insertRowCount"
          class="menu-count-input"
          type="number"
          min="1"
          step="1"
          @click.stop
          @mousedown.stop
        />
      </div>
      <div class="menu-item" @click="doInsertCol">
        <div class="menu-item-main"><InsertRowLeftOutlined /> 向左插入列</div>
        <input
          v-model.number="insertColCount"
          class="menu-count-input"
          type="number"
          min="1"
          step="1"
          @click.stop
          @mousedown.stop
        />
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item danger" @click="doDeleteRow">
        <div class="menu-item-main"><DeleteRowOutlined /> 删除行</div>
      </div>
      <div class="menu-item danger" @click="doDeleteCol">
        <div class="menu-item-main"><DeleteColumnOutlined /> 删除列</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import {
  InsertRowAboveOutlined,
  InsertRowLeftOutlined,
  DeleteRowOutlined,
  DeleteColumnOutlined,
  CopyOutlined,
  SnippetsOutlined,
  ScissorOutlined,
  DeleteOutlined,
  DragOutlined
} from '@ant-design/icons-vue'
import { useReportStore } from '@/stores/report'
import { useDesignerStore } from '@/stores/designer'
import { useHistoryStore } from '@/stores/history'
import { colIndexToName, createCell, type Cell, type CellStyle, type CellType } from '@/core/cell/types'
import { toRangeRef, shouldIgnoreCanvasKeydownForIME, applyFieldBinding, getFormulaPickToken, clampMenuPosition } from './canvasEditHelpers'
import { shiftCellRefName, shiftFormulaRefs, shiftRangeScope } from '@/core/cell/refShift'
import QRPreview from './QRPreview.vue'
import BarcodePreview from './BarcodePreview.vue'
import ChartCell from '@/components/render/ChartCell.vue'

const report = useReportStore()
const designer = useDesignerStore()
const history = useHistoryStore()

const grid = computed(() => report.grid)

/** 滚动位置 */
const scrollTop = ref(0)
const scrollLeft = ref(0)
/** 视口大小 */
const viewportHeight = ref(600)
const viewportWidth = ref(800)
/** 超出视口多渲染的缓冲行/列数 */
const BUFFER = 5

const cellsAreaRef = ref<HTMLElement | null>(null)
const canvasRootRef = ref<HTMLElement | null>(null)

/** 总高度 */
const totalHeight = computed(() => {
  if (!grid.value) return 0
  return grid.value.rows.reduce((sum, r) => sum + r.height, 0)
})
/** 总宽度 */
const totalWidth = computed(() => {
  if (!grid.value) return 0
  return grid.value.columns.reduce((sum, c) => sum + c.width, 0)
})

/** 可视行索引（虚拟滚动） */
const visibleRows = computed(() => {
  if (!grid.value) return []
  let acc = 0
  const startIdx = grid.value.rows.findIndex((r) => {
    const next = acc + r.height
    if (next > scrollTop.value - BUFFER * 28) return true
    acc = next
    return false
  })
  const start = Math.max(0, startIdx)
  const rows: number[] = []
  let h = 0
  for (let i = start; i < grid.value.rowCount; i++) {
    if (h > viewportHeight.value + BUFFER * 28) break
    rows.push(i)
    h += grid.value.rows[i].height
  }
  return rows
})

/** 可视列索引（虚拟滚动） */
const visibleCols = computed(() => {
  if (!grid.value) return []
  let acc = 0
  const startIdx = grid.value.columns.findIndex((c) => {
    const next = acc + c.width
    if (next > scrollLeft.value - BUFFER * 100) return true
    acc = next
    return false
  })
  const start = Math.max(0, startIdx)
  const cols: number[] = []
  let w = 0
  for (let i = start; i < grid.value.colCount; i++) {
    if (w > viewportWidth.value + BUFFER * 100) break
    cols.push(i)
    w += grid.value.columns[i].width
  }
  return cols
})

/** 行前后的占位高度 */
const rowSpacerBefore = computed(() => {
  if (!grid.value || !visibleRows.value.length) return 0
  let h = 0
  for (let i = 0; i < visibleRows.value[0]; i++) h += grid.value.rows[i].height
  return h
})
const rowSpacerAfter = computed(() => {
  if (!grid.value || !visibleRows.value.length) return 0
  let h = 0
  const last = visibleRows.value[visibleRows.value.length - 1]
  for (let i = last + 1; i < grid.value.rowCount; i++) h += grid.value.rows[i].height
  return h
})
/** 列前后的占位宽度 */
const colSpacerBefore = computed(() => {
  if (!grid.value || !visibleCols.value.length) return 0
  let w = 0
  for (let i = 0; i < visibleCols.value[0]; i++) w += grid.value.columns[i].width
  return w
})
const colSpacerAfter = computed(() => {
  if (!grid.value || !visibleCols.value.length) return 0
  let w = 0
  const last = visibleCols.value[visibleCols.value.length - 1]
  for (let i = last + 1; i < grid.value.colCount; i++) w += grid.value.columns[i].width
  return w
})

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  scrollTop.value = el.scrollTop
  scrollLeft.value = el.scrollLeft
}

const rowHeaderRef = ref<HTMLElement | null>(null)
const colHeaderRef = ref<HTMLElement | null>(null)

function rowHeight(row: number): number {
  return grid.value?.rows[row]?.height ?? 28
}
function colWidth(col: number): number {
  return grid.value?.columns[col]?.width ?? 100
}

/** 获取实际单元格（合并时返回主格） */
function realCell(row: number, col: number): Cell | null {
  return grid.value?.getRealCell(row, col) ?? null
}

/** 单元格是否在选区内 */
function inSelection(row: number, col: number): boolean {
  const s = designer.selection
  return (
    row >= s.startRow && row <= s.endRow && col >= s.startCol && col <= s.endCol
  )
}

function isColSelected(col: number): boolean {
  if (!grid.value) return false
  const s = designer.selection
  const fullRows = s.startCol === 0 && s.endCol === grid.value.colCount - 1
  const fullCols = s.startRow === 0 && s.endRow === grid.value.rowCount - 1
  if (fullRows && !fullCols) return false
  return col >= s.startCol && col <= s.endCol
}
function isRowSelected(row: number): boolean {
  if (!grid.value) return false
  const s = designer.selection
  const fullRows = s.startCol === 0 && s.endCol === grid.value.colCount - 1
  const fullCols = s.startRow === 0 && s.endRow === grid.value.rowCount - 1
  if (fullCols && !fullRows) return false
  return row >= s.startRow && row <= s.endRow
}

function isWholeRowOrColSelection(): boolean {
  if (!grid.value) return false
  const s = designer.selection
  const fullRows = s.startCol === 0 && s.endCol === grid.value.colCount - 1
  const fullCols = s.startRow === 0 && s.endRow === grid.value.rowCount - 1
  return !designer.isSingle && (fullRows || fullCols)
}

function cellClass(row: number, col: number) {
  const cell = realCell(row, col)
  const isMain = cell && cell.row === row && cell.col === col
  const inSel = inSelection(row, col)
  const whole = isWholeRowOrColSelection()
  const hasSaveConflict = !!(cell && designer.saveConflictCellKeys.has(cell.name))
  return {
    // 单元格/区域选中：保持描边高亮（现状不变）
    selected: inSel && !whole,
    // 整行/整列选中：用底色突出，不描边
    'band-selected': inSel && whole,
    merged: cell && (cell.rowSpan > 1 || cell.colSpan > 1) && isMain,
    covered: cell && !(cell.row === row && cell.col === col),
    'cell-image': isMain && cell?.cellType === 'image',
    'cell-qrcode': isMain && cell?.cellType === 'qrcode',
    'cell-barcode': isMain && cell?.cellType === 'barcode',
    'cell-chart': isMain && cell?.cellType === 'chart',
    'has-expand-indicator': showExpandIndicator(row, col),
    'save-conflict': hasSaveConflict
  }
}

/** 单元格样式：合并跨度 + 内容样式 + 公式引用高亮 */
function cellStyle(row: number, col: number): Record<string, string> {
  const cell = realCell(row, col)
  if (!cell) return {}
  const style: Record<string, string> = {}
  // 合并跨度
  if (cell.row === row && cell.col === col) {
    if (cell.rowSpan > 1) {
      let h = 0
      for (let r = row; r < row + cell.rowSpan; r++) h += rowHeight(r)
      style['height'] = h + 'px'
    }
    if (cell.colSpan > 1) {
      let w = 0
      for (let c = col; c < col + cell.colSpan; c++) w += colWidth(c)
      style['width'] = w + 'px'
      style['flex'] = 'none'
    } else {
      style['width'] = colWidth(col) + 'px'
      style['flex'] = 'none'
    }
    // 内容样式
    Object.assign(style, styleToCss(cell.style))
    // 公式引用高亮:用彩色边框(Excel 风格)
    const hlColor = formulaHighlightColor(row, col)
    if (hlColor) {
      style['box-shadow'] = `inset 0 0 0 2px ${hlColor}`
      style['z-index'] = '5'
      style['position'] = 'relative'
    }
  } else {
    // 被合并覆盖的位置不显示
    style['display'] = 'none'
  }
  return style
}

function styleToCss(s: CellStyle): Record<string, string> {
  const css: Record<string, string> = {}
  const vAlign = s.vAlign ?? 'middle'
  if (s.fontFamily) css['font-family'] = s.fontFamily
  if (s.fontSize) css['font-size'] = s.fontSize + 'px'
  if (s.bold) css['font-weight'] = 'bold'
  if (s.italic) css['font-style'] = 'italic'
  if (s.underline) css['text-decoration'] = 'underline'
  if (s.color) css['color'] = s.color
  if (s.background) css['background-color'] = s.background
  if (s.hAlign) css['text-align'] = s.hAlign
  // 垂直对齐:设计器中统一使用 flex，默认垂直居中。
  css['display'] = 'flex'
  if (vAlign === 'top') css['align-items'] = 'flex-start'
  else if (vAlign === 'middle') css['align-items'] = 'center'
  else if (vAlign === 'bottom') css['align-items'] = 'flex-end'
  if (s.hAlign) {
    if (s.hAlign === 'left') css['justify-content'] = 'flex-start'
    else if (s.hAlign === 'center') css['justify-content'] = 'center'
    else if (s.hAlign === 'right') css['justify-content'] = 'flex-end'
  }
  if (s.wrap) css['white-space'] = 'normal'
  else css['white-space'] = 'nowrap'
  css['overflow'] = 'hidden'
  if (s.paddingTop != null) css['padding-top'] = s.paddingTop + 'px'
  if (s.paddingRight != null) css['padding-right'] = s.paddingRight + 'px'
  if (s.paddingBottom != null) css['padding-bottom'] = s.paddingBottom + 'px'
  if (s.paddingLeft != null) css['padding-left'] = s.paddingLeft + 'px'
  // 边框
  const b = (e?: { style: string; color: string; width: number }) =>
    e && e.style !== 'none' ? `${e.width}px ${e.style} ${e.color}` : ''
  if (s.borderTop && s.borderTop.style !== 'none') css['border-top'] = b(s.borderTop)
  if (s.borderRight && s.borderRight.style !== 'none') css['border-right'] = b(s.borderRight)
  if (s.borderBottom && s.borderBottom.style !== 'none') css['border-bottom'] = b(s.borderBottom)
  if (s.borderLeft && s.borderLeft.style !== 'none') css['border-left'] = b(s.borderLeft)
  return css
}

function displayText(row: number, col: number): string {
  const cell = realCell(row, col)
  if (!cell) return ''
  return cell.content
}

function expandDirectionOf(row: number, col: number): 'down' | 'right' | null {
  const cell = realCell(row, col)
  if (!cell) return null
  if (cell.row !== row || cell.col !== col) return null
  if (!cell.dataset || !cell.fieldName) return null
  if (cell.expandDirection !== 'down' && cell.expandDirection !== 'right') return null
  return cell.expandDirection
}

function showExpandIndicator(row: number, col: number): boolean {
  return expandDirectionOf(row, col) !== null
}

function expandIndicatorTitle(row: number, col: number): string {
  const cell = realCell(row, col)
  const dir = expandDirectionOf(row, col)
  if (!cell || !dir) return ''
  return dir === 'down'
    ? `数据集变量(${cell.dataset}.${cell.fieldName}) - 向下展开`
    : `数据集变量(${cell.dataset}.${cell.fieldName}) - 向右展开`
}

// ===== 特殊单元格(图片/二维码/条码/图表)渲染辅助 =====
function cellTypeOf(row: number, col: number): CellType | undefined {
  return realCell(row, col)?.cellType
}

/** 图片 URL(base64 或 URL,设计期不解析表达式) */
function imageUrlOf(row: number, col: number): string {
  const cell = realCell(row, col)
  if (!cell?.imageConfig) return ''
  const cfg = cell.imageConfig
  if (cfg.source === 'base64' && cfg.base64) {
    return `data:${cfg.mimeType ?? 'image/png'};base64,${cfg.base64}`
  }
  return cfg.url ?? ''
}

/** 图片样式 */
function imageStyleOf(row: number, col: number): Record<string, string> {
  const cell = realCell(row, col)
  if (!cell?.imageConfig) return {}
  const cfg = cell.imageConfig
  const style: Record<string, string> = { 'max-width': '100%', 'max-height': '100%' }
  if (cfg.width) style['width'] = cfg.width + 'px'
  if (cfg.height) style['height'] = cfg.height + 'px'
  const fit = cfg.fit ?? 'contain'
  style['object-fit'] = fit === 'fill' ? 'fill' : fit === 'cover' ? 'cover' : fit === 'none' ? 'none' : 'contain'
  return style
}

/** 二维码尺寸(取单元格宽高较小值) */
function qrSize(row: number, col: number): number {
  const cell = realCell(row, col)
  const h = cell?.rowSpan ?? 1
  const w = cell?.colSpan ?? 1
  const totalH = rowHeight(row) * h
  const totalW = colWidth(col) * w
  return Math.max(40, Math.min(totalH, totalW) - 8)
}

/** 图表宽度 */
function chartWidth(row: number, col: number): number {
  const cell = realCell(row, col)
  if (cell?.chartConfig?.width) return cell.chartConfig.width
  const w = cell?.colSpan ?? 1
  return Math.max(120, colWidth(col) * w - 4)
}

/** 图表高度 */
function chartHeight(row: number, col: number): number {
  const cell = realCell(row, col)
  if (cell?.chartConfig?.height) return cell.chartConfig.height
  const h = cell?.rowSpan ?? 1
  return Math.max(100, rowHeight(row) * h - 4)
}

// ===== 编辑 =====
const editValue = ref('')
const editorRefs = ref<HTMLTextAreaElement[]>([])

// ===== 公式联想 =====
import {
  matchSuggestions,
  getParamHint,
  validateFormula,
  type FormulaSuggestion
} from '@/core/expression/Autocomplete'
import { extractFormulaRefs, type FormulaRef } from '@/core/expression/FormulaRefs'

const formulaSuggestions = ref<FormulaSuggestion[]>([])
const suggestIndex = ref(0)
const paramHint = ref<FormulaSuggestion | null>(null)
const formulaError = ref<string | null>(null)

/** 当前需要高亮的公式引用(编辑时取 editValue,选中公式单元格时取其内容) */
const formulaRefs = computed<FormulaRef[]>(() => {
  if (designer.editingCell && editValue.value.startsWith('=')) {
    return extractFormulaRefs(editValue.value)
  }
  // 非编辑状态:选中含公式的单元格时也高亮
  if (!designer.editingCell && grid.value) {
    const cell = grid.value.getRealCell(designer.selection.startRow, designer.selection.startCol)
    if (cell && cell.content.startsWith('=')) {
      return extractFormulaRefs(cell.content)
    }
  }
  return []
})

/** 单元格 -> 高亮颜色 的映射(用于快速查找) */
const formulaHighlightMap = computed<Map<string, string>>(() => {
  const map = new Map<string, string>()
  for (const ref of formulaRefs.value) {
    for (const c of ref.cells) {
      map.set(`${c.row},${c.col}`, ref.color)
    }
  }
  return map
})

/** 获取单元格的公式高亮颜色,无则返回 null */
function formulaHighlightColor(row: number, col: number): string | null {
  return formulaHighlightMap.value.get(`${row},${col}`) ?? null
}

/** 编辑器输入时更新联想,并自动进入/退出公式拾取模式 */
function onEditorInput(e: Event) {
  // 内容以 = 开头时自动进入公式拾取模式(支持鼠标选单元格填入参数)
  designer.formulaPicking = editValue.value.startsWith('=')
  updateSuggestions()
  // 公式校验
  formulaError.value = validateFormula(editValue.value)
}

/** 更新联想列表和参数提示 */
function updateSuggestions() {
  const editor = editorRefs.value[0]
  if (!editor) {
    formulaSuggestions.value = []
    paramHint.value = null
    return
  }
  const pos = editor.selectionStart ?? editValue.value.length
  formulaSuggestions.value = matchSuggestions(editValue.value, pos)
  suggestIndex.value = 0
  paramHint.value = getParamHint(editValue.value, pos)
}

/** 上下键导航联想 */
function onSuggestionNav(dir: number) {
  if (!formulaSuggestions.value.length) return
  suggestIndex.value = (suggestIndex.value + dir + formulaSuggestions.value.length) % formulaSuggestions.value.length
}

/** 应用选中的建议 */
function applySuggestion(s: FormulaSuggestion) {
  const editor = editorRefs.value[0]
  if (!editor) return
  const pos = editor.selectionStart ?? editValue.value.length
  const before = editValue.value.substring(0, pos)
  const after = editValue.value.substring(pos)
  // 替换正在输入的函数名片段
  const match = before.match(/([a-zA-Z]\w*)$/)
  if (match) {
    const newName = match[1]
    // 如果后面没有左括号，补上 (
    const needParen = !after.startsWith('(')
    editValue.value =
      before.substring(0, before.length - newName.length) +
      s.name +
      (needParen ? '()' : '') +
      after
    // 光标放到括号内
    nextTick(() => {
      const ed = editorRefs.value[0]
      if (ed) {
        const cursorPos = before.length - newName.length + s.name.length + (needParen ? 1 : 0)
        ed.setSelectionRange(cursorPos, cursorPos)
        ed.focus()
        updateSuggestions()
      }
    })
  }
}

/** Enter 键处理：有联想时应用选中项，否则提交 */
function onEditorEnter() {
  if (formulaSuggestions.value.length && suggestIndex.value >= 0) {
    applySuggestion(formulaSuggestions.value[suggestIndex.value])
    return
  }
  commitEditAndMove(0, 1)
}

/** Tab 键处理（Excel 风格）：有联想时补全函数，否则提交并右移 */
function onEditorTab() {
  if (formulaSuggestions.value.length) {
    applySuggestion(formulaSuggestions.value[suggestIndex.value])
    return
  }
  commitEditAndMove(1, 0)
}

/** Esc 键处理（Excel 风格）：有联想时先关闭联想，否则取消编辑 */
function onEditorEsc() {
  if (formulaSuggestions.value.length) {
    formulaSuggestions.value = []
    return
  }
  cancelEdit()
}

function isEditing(row: number, col: number): boolean {
  return designer.editingCell?.row === row && designer.editingCell?.col === col
}

function editorStyle(row: number, col: number): Record<string, string> {
  const cell = realCell(row, col)
  if (!cell) return {}
  return styleToCss(cell.style)
}

function onCellDblClick(row: number, col: number) {
  const cell = realCell(row, col)
  // 特殊类型(图片/二维码/条码/图表)不进入文本编辑,避免破坏配置
  if (cell && (cell.cellType === 'image' || cell.cellType === 'qrcode' || cell.cellType === 'barcode' || cell.cellType === 'chart')) {
    return
  }
  editValue.value = cell?.content ?? ''
  designer.startEdit(row, col)
  // 编辑已有公式内容时自动进入公式拾取模式
  designer.formulaPicking = editValue.value.startsWith('=')
  nextTick(() => {
    editorRefs.value[0]?.focus()
    editorRefs.value[0]?.select()
    updateSuggestions()
  })
}

function commitEdit() {
  if (!designer.editingCell || !grid.value) return
  const { row, col } = designer.editingCell
  const cell = grid.value.getRealCell(row, col)
  if (cell && cell.content !== editValue.value) {
    history.pushHistory()
    grid.value.setCellContent(row, col, editValue.value)
    report.markDirty()
  }
  designer.endEdit()
  designer.formulaPicking = false
  formulaSuggestions.value = []
  paramHint.value = null
  formulaError.value = null
}

/** 监听字段插入请求:编辑中在光标位置插入,非编辑追加到当前单元格 */
watch(
  () => designer.fieldInsertRequest,
  (req) => {
    if (!req || !grid.value) return
    const expr = `\${${req.dsName}.${req.fieldName}}`
    const targetPos = designer.editingCell ?? {
      row: designer.selection.startRow,
      col: designer.selection.startCol
    }
    const targetCell = grid.value.getRealCell(targetPos.row, targetPos.col)
    if (!targetCell) {
      designer.clearFieldInsertRequest()
      return
    }
    const targetType = targetCell.cellType ?? 'text'
    if (targetType === 'image' || targetType === 'qrcode' || targetType === 'barcode' || targetType === 'chart') {
      designer.clearFieldInsertRequest()
      return
    }

    const bindingChanged = applyFieldBinding(targetCell, req.dsName, req.fieldName)
    if (bindingChanged) {
      history.pushHistory()
      report.markDirty()
    }

    if (designer.editingCell) {
      // 编辑模式:在光标位置插入,保持编辑状态
      const editor = editorRefs.value[0] as HTMLTextAreaElement | undefined
      const pos = editor?.selectionStart ?? editValue.value.length
      editValue.value =
        editValue.value.substring(0, pos) + expr + editValue.value.substring(pos)
      nextTick(() => {
        if (editor) {
          const newPos = pos + expr.length
          editor.selectionStart = editor.selectionEnd = newPos
          editor.focus()
        }
        updateSuggestions()
      })
    } else {
      // 非编辑模式:追加到当前选中单元格内容
      history.pushHistory()
      const existing = targetCell.content || ''
      grid.value.setCellContent(targetPos.row, targetPos.col, existing ? existing + expr : expr)
      report.markDirty()
    }
    designer.clearFieldInsertRequest()
  }
)

/** 监听公式编辑启动信号:在当前单元格进入编辑,以 = 开头 */
watch(
  () => designer.startFormulaEditSignal,
  () => {
    if (!grid.value) return
    const row = designer.selection.startRow
    const col = designer.selection.startCol
    const cell = grid.value.getRealCell(row, col)
    if (!cell) return
    // 特殊类型不进入公式编辑
    const t = cell.cellType ?? 'text'
    if (t === 'image' || t === 'qrcode' || t === 'barcode' || t === 'chart') return
    // 已有公式内容则保持,否则以 = 开头
    editValue.value = cell.content && cell.content.startsWith('=') ? cell.content : '='
    designer.startEdit(row, col)
    designer.formulaPicking = true
    nextTick(() => {
      const editor = editorRefs.value[0]
      if (editor) {
        editor.focus()
        editor.setSelectionRange(editor.value.length, editor.value.length)
        updateSuggestions()
      }
    })
  }
)

function commitEditAndMove(dCol: number, dRow: number) {
  commitEdit()
  if (!grid.value) return
  const s = designer.selection
  const newRow = Math.max(0, Math.min(grid.value.rowCount - 1, s.startRow + dRow))
  const newCol = Math.max(0, Math.min(grid.value.colCount - 1, s.startCol + dCol))
  designer.setSelection(newRow, newCol)
}

function cancelEdit() {
  designer.endEdit()
  designer.formulaPicking = false
  formulaSuggestions.value = []
  paramHint.value = null
  formulaError.value = null
}

// ===== 鼠标选择 =====
let isDragging = false
let dragStartRow = 0
let dragStartCol = 0
let dragMode: 'cells' | 'rows' | 'cols' | null = null
let selectionAnchor: { row: number; col: number } | null = null
let formulaRangeDragging = false
let formulaRangeInsert: { start: number; end: number; anchorRow: number; anchorCol: number } | null = null

/** 更新公式中当前拖拽区域引用文本 */
function updateFormulaRangeInsert(row: number, col: number) {
  if (!formulaRangeInsert) return
  const rangeRef = toRangeRef(formulaRangeInsert.anchorRow, formulaRangeInsert.anchorCol, row, col)
  const before = editValue.value.substring(0, formulaRangeInsert.start)
  const after = editValue.value.substring(formulaRangeInsert.end)
  editValue.value = before + rangeRef + after
  formulaRangeInsert.end = formulaRangeInsert.start + rangeRef.length
  nextTick(() => {
    const editor = editorRefs.value[0]
    if (editor) {
      editor.selectionStart = editor.selectionEnd = formulaRangeInsert?.end ?? editor.value.length
      editor.focus()
    }
    updateSuggestions()
  })
}

function onCellMouseDown(e: MouseEvent, row: number, col: number) {
  if (e.button !== 0) return
  // 公式拾取模式:点击单元格插入引用到编辑器光标位置,保持编辑状态
  if (designer.formulaPicking && designer.editingCell) {
    // 点击当前正在编辑的单元格时，不应再次插入坐标；应允许继续编辑/定位光标。
    if (designer.editingCell.row === row && designer.editingCell.col === col) {
      return
    }
    e.preventDefault() // 阻止 textarea 失焦
    const editor = editorRefs.value[0] as HTMLTextAreaElement | undefined
    if (!editor) return
    const pos = editor?.selectionStart ?? editValue.value.length
    const pickedCell = grid.value?.getRealCell(row, col) ?? null
    const initialRef = getFormulaPickToken(pickedCell, row, col)
    editValue.value = editValue.value.substring(0, pos) + initialRef + editValue.value.substring(pos)
    // 仅普通单元格引用启用拖拽扩展区域；数据集字段变量为动态引用，不扩展成 A1:B2。
    const enableRangeDrag = !initialRef.startsWith('${')
    formulaRangeDragging = enableRangeDrag
    formulaRangeInsert = enableRangeDrag
      ? {
          start: pos,
          end: pos + initialRef.length,
          anchorRow: row,
          anchorCol: col
        }
      : null
    nextTick(() => {
      const newPos = pos + initialRef.length
      editor.selectionStart = editor.selectionEnd = newPos
      editor.focus()
      updateSuggestions()
    })
    return
  }
  // 正在编辑时先提交内容（避免点击其他单元格导致内容丢失）
  if (designer.editingCell) {
    commitEdit()
    designer.formulaPicking = false
  }
  // 主格拾取模式:点击单元格即完成拾取,不执行选区切换
  // 仅填充 pickedMasterCell,由 PropertyPanel 的 watch 判断更新左/上主格并清理状态
  if (designer.masterPicking) {
    designer.pickedMasterCell = colIndexToName(col) + (row + 1)
    return
  }
  if (e.shiftKey) {
    // Shift+点击：从锚点扩展选区；若无锚点则退回到当前选区左上角。
    const anchor = selectionAnchor ?? { row: designer.selection.startRow, col: designer.selection.startCol }
    designer.setSelection(anchor.row, anchor.col)
    designer.extendSelection(row, col)
    return
  }
  // 普通点击：开始新选区
  designer.setSelection(row, col)
  selectionAnchor = { row, col }
  isDragging = true
  dragMode = 'cells'
  dragStartRow = row
  dragStartCol = col
}

function onCellsAreaMouseDown(e: MouseEvent) {
  // 点击空白区域取消编辑
  if (designer.editingCell) commitEdit()
}

function onRowHeaderMouseDown(e: MouseEvent, row: number) {
  if (e.button !== 0) return
  if (designer.editingCell) commitEdit()
  if (!grid.value) return
  if (e.shiftKey) {
    const anchorRow = selectionAnchor?.row ?? designer.selection.startRow
    designer.setSelection(anchorRow, 0)
    designer.extendSelection(row, grid.value.colCount - 1)
    return
  }
  designer.setSelection(row, 0)
  designer.extendSelection(row, grid.value.colCount - 1)
  selectionAnchor = { row, col: 0 }
  isDragging = true
  dragMode = 'rows'
  dragStartRow = row
  dragStartCol = 0
}

function onColHeaderMouseDown(e: MouseEvent, col: number) {
  if (e.button !== 0) return
  if (designer.editingCell) commitEdit()
  if (!grid.value) return
  if (e.shiftKey) {
    const anchorCol = selectionAnchor?.col ?? designer.selection.startCol
    designer.setSelection(0, anchorCol)
    designer.extendSelection(grid.value.rowCount - 1, col)
    return
  }
  designer.setSelection(0, col)
  designer.extendSelection(grid.value.rowCount - 1, col)
  selectionAnchor = { row: 0, col }
  isDragging = true
  dragMode = 'cols'
  dragStartRow = 0
  dragStartCol = col
}

function getRowFromClientY(y: number): number | null {
  if (!grid.value || !cellsAreaRef.value) return null
  const rect = cellsAreaRef.value.getBoundingClientRect()
  // rect 已反映滚动位置（.cells-area 随 .cell-canvas 滚动），不可再加 scrollTop，否则双重计数。
  const relY = y - rect.top
  let accH = 0
  for (let i = 0; i < grid.value.rowCount; i++) {
    accH += grid.value.rows[i].height
    if (relY < accH) return i
  }
  return grid.value.rowCount - 1
}

function getColFromClientX(x: number): number | null {
  if (!grid.value || !cellsAreaRef.value) return null
  const rect = cellsAreaRef.value.getBoundingClientRect()
  // 同上：rect.left 已含横向滚动位移，不再加 scrollLeft。
  const relX = x - rect.left
  let accW = 0
  for (let i = 0; i < grid.value.colCount; i++) {
    accW += grid.value.columns[i].width
    if (relX < accW) return i
  }
  return grid.value.colCount - 1
}

// ===== 行高/列宽拖拽调整 =====
let colResizing = { col: -1, startX: 0, startWidth: 0 }
let rowResizing = { row: -1, startY: 0, startHeight: 0 }

/** 开始拖拽列宽 */
function onColResizeStart(e: MouseEvent, col: number) {
  if (!grid.value) return
  colResizing = { col, startX: e.clientX, startWidth: grid.value.columns[col]?.width ?? 80 }
  history.pushHistory()
  window.addEventListener('mousemove', onColResizeMove)
  window.addEventListener('mouseup', onColResizeEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onColResizeMove(e: MouseEvent) {
  if (!grid.value || colResizing.col < 0) return
  const delta = e.clientX - colResizing.startX
  grid.value.setColWidth(colResizing.col, colResizing.startWidth + delta)
  report.markDirty()
}

function onColResizeEnd() {
  colResizing.col = -1
  window.removeEventListener('mousemove', onColResizeMove)
  window.removeEventListener('mouseup', onColResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

/** 开始拖拽行高 */
function onRowResizeStart(e: MouseEvent, row: number) {
  if (!grid.value) return
  rowResizing = { row, startY: e.clientY, startHeight: grid.value.rows[row]?.height ?? 28 }
  history.pushHistory()
  window.addEventListener('mousemove', onRowResizeMove)
  window.addEventListener('mouseup', onRowResizeEnd)
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
}

function onRowResizeMove(e: MouseEvent) {
  if (!grid.value || rowResizing.row < 0) return
  const delta = e.clientY - rowResizing.startY
  grid.value.setRowHeight(rowResizing.row, rowResizing.startHeight + delta)
  report.markDirty()
}

function onRowResizeEnd() {
  rowResizing.row = -1
  window.removeEventListener('mousemove', onRowResizeMove)
  window.removeEventListener('mouseup', onRowResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

/** 根据鼠标位置计算行列索引 */
function getCellFromPoint(x: number, y: number): { row: number; col: number } | null {
  if (!grid.value || !cellsAreaRef.value) return null
  const rect = cellsAreaRef.value.getBoundingClientRect()
  // rect 已反映滚动偏移，直接用 clientX/Y 减 rect 即可；再加 scroll 会双重计数导致框选超选。
  const relY = y - rect.top
  const relX = x - rect.left
  // 计算行
  let accH = 0
  let row = -1
  for (let i = 0; i < grid.value.rowCount; i++) {
    accH += grid.value.rows[i].height
    if (relY < accH) {
      row = i
      break
    }
  }
  if (row === -1) row = grid.value.rowCount - 1
  // 计算列
  let accW = 0
  let col = -1
  for (let i = 0; i < grid.value.colCount; i++) {
    accW += grid.value.columns[i].width
    if (relX < accW) {
      col = i
      break
    }
  }
  if (col === -1) col = grid.value.colCount - 1
  return { row, col }
}

function onMouseMove(e: MouseEvent) {
  if (formulaRangeDragging) {
    const pos = getCellFromPoint(e.clientX, e.clientY)
    if (!pos) return
    updateFormulaRangeInsert(pos.row, pos.col)
    return
  }
  if (!isDragging || !grid.value) return
  if (dragMode === 'rows') {
    const row = getRowFromClientY(e.clientY)
    if (row == null) return
    designer.setSelection(dragStartRow, 0)
    designer.extendSelection(row, grid.value.colCount - 1)
    return
  }
  if (dragMode === 'cols') {
    const col = getColFromClientX(e.clientX)
    if (col == null) return
    designer.setSelection(0, dragStartCol)
    designer.extendSelection(grid.value.rowCount - 1, col)
    return
  }
  const pos = getCellFromPoint(e.clientX, e.clientY)
  if (!pos) return
  designer.setSelection(dragStartRow, dragStartCol)
  designer.extendSelection(pos.row, pos.col)
}

function onMouseUp() {
  isDragging = false
  dragMode = null
  formulaRangeDragging = false
  formulaRangeInsert = null
}

onMounted(() => {
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('mousemove', onMouseMove)
  // 点击空白关闭右键菜单
  document.addEventListener('click', closeContextMenu)
  // 测量视口大小
  updateViewport()
  // 监听窗口大小变化
  window.addEventListener('resize', updateViewport)
})

// grid 异步加载后(如从预览返回设计器)重新测量视口,避免初始为 0 导致画布空白
watch(grid, () => {
  nextTick(updateViewport)
})

onUnmounted(() => {
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('click', closeContextMenu)
  window.removeEventListener('resize', updateViewport)
  window.removeEventListener('mousemove', onColResizeMove)
  window.removeEventListener('mouseup', onColResizeEnd)
  window.removeEventListener('mousemove', onRowResizeMove)
  window.removeEventListener('mouseup', onRowResizeEnd)
})

function updateViewport() {
  if (canvasRootRef.value) {
    viewportHeight.value = canvasRootRef.value.clientHeight
    viewportWidth.value = canvasRootRef.value.clientWidth
  }
}

function pixelTopForRow(row: number): number {
  if (!grid.value) return 0
  let top = 0
  for (let i = 0; i < row; i++) top += grid.value.rows[i].height
  return top
}

function pixelLeftForCol(col: number): number {
  if (!grid.value) return 0
  let left = 0
  for (let i = 0; i < col; i++) left += grid.value.columns[i].width
  return left
}

/** 聚焦并滚动到指定单元格（供预览页冲突定位回设计器） */
function focusCell(row: number, col: number) {
  if (!grid.value || !canvasRootRef.value) return
  const safeRow = Math.max(0, Math.min(grid.value.rowCount - 1, row))
  const safeCol = Math.max(0, Math.min(grid.value.colCount - 1, col))
  designer.setSelection(safeRow, safeCol)

  const top = pixelTopForRow(safeRow)
  const left = pixelLeftForCol(safeCol)
  const bottom = top + rowHeight(safeRow)
  const right = left + colWidth(safeCol)
  const root = canvasRootRef.value

  if (top < root.scrollTop) root.scrollTop = top
  else if (bottom > root.scrollTop + root.clientHeight) root.scrollTop = Math.max(0, bottom - root.clientHeight)

  if (left < root.scrollLeft) root.scrollLeft = left
  else if (right > root.scrollLeft + root.clientWidth) root.scrollLeft = Math.max(0, right - root.clientWidth)

  scrollTop.value = root.scrollTop
  scrollLeft.value = root.scrollLeft
}

// ===== 键盘交互（Excel 风格） =====
function onCanvasKeydown(e: KeyboardEvent) {
  // 编辑中不处理
  if (designer.editingCell) return
  if (!grid.value) return

  const ctrl = e.ctrlKey || e.metaKey
  const s = designer.selection
  const key = e.key

  // 输入法组合输入过程中不拦截按键，避免中文首字母被当作普通字符写入。
  if (shouldIgnoreCanvasKeydownForIME(e)) {
    return
  }

  // Ctrl+B/I/U 样式快捷键
  if (ctrl && key.toLowerCase() === 'b') {
    e.preventDefault()
    toggleStyleProp('bold')
    return
  }
  if (ctrl && key.toLowerCase() === 'i') {
    e.preventDefault()
    toggleStyleProp('italic')
    return
  }
  if (ctrl && key.toLowerCase() === 'u') {
    e.preventDefault()
    toggleStyleProp('underline')
    return
  }

  // Ctrl+A 全选
  if (ctrl && key.toLowerCase() === 'a') {
    e.preventDefault()
    doSelectAll()
    return
  }
  // Ctrl+C 复制
  if (ctrl && key.toLowerCase() === 'c') {
    e.preventDefault()
    doCopy()
    return
  }
  // Ctrl+X 剪切
  if (ctrl && key.toLowerCase() === 'x') {
    e.preventDefault()
    doCut()
    return
  }
  // Ctrl+V 粘贴
  if (ctrl && key.toLowerCase() === 'v') {
    e.preventDefault()
    doPaste()
    return
  }

  // 方向键导航
  if (key === 'ArrowUp') {
    e.preventDefault()
    const r = Math.max(0, s.startRow - 1)
    designer.setSelection(r, s.startCol)
    return
  }
  if (key === 'ArrowDown') {
    e.preventDefault()
    const r = Math.min(grid.value.rowCount - 1, s.startRow + 1)
    designer.setSelection(r, s.startCol)
    return
  }
  if (key === 'ArrowLeft') {
    e.preventDefault()
    const c = Math.max(0, s.startCol - 1)
    designer.setSelection(s.startRow, c)
    return
  }
  if (key === 'ArrowRight') {
    e.preventDefault()
    const c = Math.min(grid.value.colCount - 1, s.startCol + 1)
    designer.setSelection(s.startRow, c)
    return
  }

  // Tab 导航
  if (key === 'Tab') {
    e.preventDefault()
    const dCol = e.shiftKey ? -1 : 1
    const c = Math.max(0, Math.min(grid.value.colCount - 1, s.startCol + dCol))
    designer.setSelection(s.startRow, c)
    return
  }

  // Enter 向下导航
  if (key === 'Enter' && !ctrl) {
    e.preventDefault()
    const r = Math.min(grid.value.rowCount - 1, s.startRow + 1)
    designer.setSelection(r, s.startCol)
    return
  }

  // F2 进入编辑
  if (key === 'F2') {
    e.preventDefault()
    startEditAt(s.startRow, s.startCol)
    return
  }

  // Delete/Backspace 清除内容
  if (key === 'Delete' || key === 'Backspace') {
    e.preventDefault()
    doDeleteContent()
    return
  }

  // 可打印字符：进入编辑并输入该字符
  if (key.length === 1 && !ctrl && !e.altKey) {
    e.preventDefault()
    startEditAt(s.startRow, s.startCol, key)
    return
  }
}

/** 在指定位置开始编辑，可预填首字符 */
function startEditAt(row: number, col: number, initialChar?: string) {
  const cell = realCell(row, col)
  editValue.value = initialChar ?? cell?.content ?? ''
  designer.startEdit(row, col)
  // 内容以 = 开头(公式)时自动进入公式拾取模式
  designer.formulaPicking = editValue.value.startsWith('=')
  nextTick(() => {
    const editor = editorRefs.value[0]
    if (editor) {
      editor.focus()
      if (initialChar) {
        editor.setSelectionRange(editor.value.length, editor.value.length)
      } else {
        editor.select()
      }
      updateSuggestions()
    }
  })
}

/** 切换样式属性（用于 Ctrl+B/I/U） */
function toggleStyleProp(prop: 'bold' | 'italic' | 'underline') {
  if (!grid.value) return
  const cell = realCell(designer.selection.startRow, designer.selection.startCol)
  if (!cell) return
  history.pushHistory()
  const newVal = !cell.style[prop]
  const s = designer.selection
  grid.value.applyStyleToRange(s.startRow, s.startCol, s.endRow, s.endCol, { [prop]: newVal })
  report.markDirty()
}

// ===== 右键菜单 =====
const contextMenu = ref({ show: false, x: 0, y: 0 })
const contextMenuRef = ref<HTMLElement | null>(null)
const insertRowCount = ref(1)
const insertColCount = ref(1)

/** 将右键菜单夹取到视口内，避免在报表/窗口边缘时被裁切显示不全 */
function clampContextMenuIntoViewport(preferX: number, preferY: number) {
  const el = contextMenuRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const { x, y } = clampMenuPosition(
    preferX,
    preferY,
    rect.width,
    rect.height,
    window.innerWidth,
    window.innerHeight
  )
  contextMenu.value.x = x
  contextMenu.value.y = y
}

function onContextMenu(e: MouseEvent) {
  if (designer.editingCell) commitEdit()
  if (grid.value) {
    const target = e.target as HTMLElement | null
    const rowHeaderEl = target?.closest('.row-header') as HTMLElement | null
    const colHeaderEl = target?.closest('.col-header') as HTMLElement | null
    const cellEl = target?.closest('.cell') as HTMLElement | null
    const s = designer.selection
    const startRow = Math.min(s.startRow, s.endRow)
    const endRow = Math.max(s.startRow, s.endRow)
    const startCol = Math.min(s.startCol, s.endCol)
    const endCol = Math.max(s.startCol, s.endCol)

    if (rowHeaderEl) {
      const row = Number(rowHeaderEl.dataset.row)
      const rowSelectionCoversAllCols = startCol === 0 && endCol === grid.value.colCount - 1
      const hitCurrentRowSelection = rowSelectionCoversAllCols && row >= startRow && row <= endRow
      if (!hitCurrentRowSelection) {
        designer.setSelection(row, 0)
        designer.extendSelection(row, grid.value.colCount - 1)
      }
    } else if (colHeaderEl) {
      const col = Number(colHeaderEl.dataset.col)
      const colSelectionCoversAllRows = startRow === 0 && endRow === grid.value.rowCount - 1
      const hitCurrentColSelection = colSelectionCoversAllRows && col >= startCol && col <= endCol
      if (!hitCurrentColSelection) {
        designer.setSelection(0, col)
        designer.extendSelection(grid.value.rowCount - 1, col)
      }
    } else if (cellEl) {
      const row = Number(cellEl.dataset.row)
      const col = Number(cellEl.dataset.col)
      const hitCurrentCellSelection = row >= startRow && row <= endRow && col >= startCol && col <= endCol
      if (!hitCurrentCellSelection) {
        designer.setSelection(row, col)
      }
    }
  }
  insertRowCount.value = 1
  insertColCount.value = 1
  contextMenu.value = { show: true, x: e.clientX, y: e.clientY }
  // 菜单渲染后按实际尺寸夹取进视口，避免边缘处被裁切
  nextTick(() => clampContextMenuIntoViewport(e.clientX, e.clientY))
}

function closeContextMenu() {
  contextMenu.value.show = false
}

function doInsertRow() {
  if (!grid.value) return
  const count = normalizeInsertCount(insertRowCount.value)
  history.pushHistory()
  grid.value.insertRow(designer.selection.startRow, count)
  shiftConditionFormatScopes({ rowInsertIndex: designer.selection.startRow, rowInsertCount: count })
  report.markDirty()
  closeContextMenu()
}
function doInsertCol() {
  if (!grid.value) return
  const count = normalizeInsertCount(insertColCount.value)
  history.pushHistory()
  grid.value.insertCol(designer.selection.startCol, count)
  shiftConditionFormatScopes({ colInsertIndex: designer.selection.startCol, colInsertCount: count })
  report.markDirty()
  closeContextMenu()
}
function doDeleteRow() {
  if (!grid.value) return
  const s = designer.selection
  const start = Math.min(s.startRow, s.endRow)
  const end = Math.max(s.startRow, s.endRow)
  const count = end - start + 1
  if (count <= 0) return
  if (count >= grid.value.rowCount) {
    _message.warning('至少保留 1 行')
    closeContextMenu()
    return
  }
  history.pushHistory()
  grid.value.deleteRow(start, count)
  shiftConditionFormatScopes({ rowDeleteIndex: start, rowDeleteCount: count })
  const nextRow = Math.min(start, grid.value.rowCount - 1)
  designer.setSelection(nextRow, Math.min(s.startCol, grid.value.colCount - 1))
  report.markDirty()
  closeContextMenu()
}
function doDeleteCol() {
  if (!grid.value) return
  const s = designer.selection
  const start = Math.min(s.startCol, s.endCol)
  const end = Math.max(s.startCol, s.endCol)
  const count = end - start + 1
  if (count <= 0) return
  if (count >= grid.value.colCount) {
    _message.warning('至少保留 1 列')
    closeContextMenu()
    return
  }
  history.pushHistory()
  grid.value.deleteCol(start, count)
  shiftConditionFormatScopes({ colDeleteIndex: start, colDeleteCount: count })
  const nextCol = Math.min(start, grid.value.colCount - 1)
  designer.setSelection(Math.min(s.startRow, grid.value.rowCount - 1), nextCol)
  report.markDirty()
  closeContextMenu()
}

function shiftConditionFormatScopes(options: Parameters<typeof shiftRangeScope>[1]) {
  const formats = report.currentTemplate?.conditionFormats
  if (!formats?.length) return
  for (const fmt of formats) {
    fmt.scope = shiftRangeScope(fmt.scope, options)
  }
}

function normalizeInsertCount(raw: number): number {
  if (!Number.isFinite(raw)) return 1
  const rounded = Math.floor(raw)
  if (rounded < 1) return 1
  if (rounded > 200) return 200
  return rounded
}

// ===== 复制/剪切/粘贴/删除单元格内容 =====
import { message as _message } from 'ant-design-vue'

/** 深拷贝单元格(去掉坐标信息,保留内容/样式/类型) */
function cloneCellForClipboard(cell: Cell): Cell {
  return JSON.parse(JSON.stringify(cell))
}

/** 复制选区单元格到剪贴板 */
function doCopy() {
  if (!grid.value) return
  const s = designer.selection
  const r1 = Math.min(s.startRow, s.endRow)
  const r2 = Math.max(s.startRow, s.endRow)
  const c1 = Math.min(s.startCol, s.endCol)
  const c2 = Math.max(s.startCol, s.endCol)
  const cells: Cell[][] = []
  for (let r = r1; r <= r2; r++) {
    const row: Cell[] = []
    for (let c = c1; c <= c2; c++) {
      const cell = grid.value.getRealCell(r, c)
      row.push(cell ? cloneCellForClipboard(cell) : createCell(r, c))
    }
    cells.push(row)
  }
  designer.clipboard = { cells, cutMode: false }
  closeContextMenu()
}

/** 剪切选区单元格:复制后清空原单元格内容(保留样式) */
function doCut() {
  if (!grid.value) return
  doCopy()
  designer.clipboard = { cells: designer.clipboard!.cells, cutMode: true }
  // 清空原区域内容(保留样式与类型配置)
  history.pushHistory()
  const s = designer.selection
  for (let r = s.startRow; r <= s.endRow; r++) {
    for (let c = s.startCol; c <= s.endCol; c++) {
      grid.value.setCellContent(r, c, '')
    }
  }
  report.markDirty()
  closeContextMenu()
}

/** 单元格名(A1)解析为 {row, col} */
function parseCellName(name: string): { row: number; col: number } | null {
  const m = name.match(/^([A-Za-z]+)([0-9]+)$/)
  if (!m) return null
  let col = 0
  const upper = m[1].toUpperCase()
  for (let i = 0; i < upper.length; i++) {
    col = col * 26 + (upper.charCodeAt(i) - 64)
  }
  return { row: parseInt(m[2], 10) - 1, col: col - 1 }
}

/** 粘贴剪贴板内容到当前选区起始位置 */
function doPaste() {
  if (!grid.value || !designer.clipboard) {
    _message.warning('剪贴板为空')
    return
  }
  const { cells, cutMode } = designer.clipboard
  const s = designer.selection
  const startRow = s.startRow
  const startCol = s.startCol
  // 计算源选区起始坐标，用于平移主格引用
  const srcOrigin = { row: cells[0]?.[0]?.row ?? 0, col: cells[0]?.[0]?.col ?? 0 }
  const rowOffset = startRow - srcOrigin.row
  const colOffset = startCol - srcOrigin.col
  /** 平移单元格名：A2 + 偏移 -> 新名 */
  const shiftName = (name?: string): string | undefined => {
    if (!name) return undefined
    return shiftCellRefName(name, {
      rowInsertIndex: rowOffset >= 0 ? 0 : undefined,
      rowInsertCount: rowOffset >= 0 ? rowOffset : undefined,
      colInsertIndex: colOffset >= 0 ? 0 : undefined,
      colInsertCount: colOffset >= 0 ? colOffset : undefined,
      rowDeleteIndex: rowOffset < 0 ? 0 : undefined,
      rowDeleteCount: rowOffset < 0 ? -rowOffset : undefined,
      colDeleteIndex: colOffset < 0 ? 0 : undefined,
      colDeleteCount: colOffset < 0 ? -colOffset : undefined
    }) ?? undefined
  }

  const shiftFormulaByOffset = (content: string): string => {
    const options = {
      rowInsertIndex: rowOffset >= 0 ? 0 : undefined,
      rowInsertCount: rowOffset >= 0 ? rowOffset : undefined,
      colInsertIndex: colOffset >= 0 ? 0 : undefined,
      colInsertCount: colOffset >= 0 ? colOffset : undefined,
      rowDeleteIndex: rowOffset < 0 ? 0 : undefined,
      rowDeleteCount: rowOffset < 0 ? -rowOffset : undefined,
      colDeleteIndex: colOffset < 0 ? 0 : undefined,
      colDeleteCount: colOffset < 0 ? -colOffset : undefined
    }
    return shiftFormulaRefs(content, options)
  }
  history.pushHistory()
  for (let r = 0; r < cells.length; r++) {
    for (let c = 0; c < cells[r].length; c++) {
      const tr = startRow + r
      const tc = startCol + c
      if (tr >= grid.value.rowCount || tc >= grid.value.colCount) continue
      const src = cells[r][c]
      const target = grid.value.getRealCell(tr, tc)
      if (!target) continue
      // 写入内容与样式(深拷贝避免引用污染)
      const cloned = cloneCellForClipboard(src)
      target.content = cloned.content.startsWith('=') ? shiftFormulaByOffset(cloned.content) : cloned.content
      target.cellType = cloned.cellType
      target.style = cloned.style
      target.expandDirection = cloned.expandDirection
      target.dataset = cloned.dataset
      target.fieldName = cloned.fieldName
      target.aggregate = cloned.aggregate
      // 主格引用按粘贴偏移量平移，保持相对主格关系
      target.leftMasterCell = shiftName(cloned.leftMasterCell)
      target.topMasterCell = shiftName(cloned.topMasterCell)
      target.imageConfig = cloned.imageConfig
      target.qrConfig = cloned.qrConfig
      target.barcodeConfig = cloned.barcodeConfig
      target.chartConfig = cloned.chartConfig
    }
  }
  // 剪切模式粘贴后清空剪贴板
  if (cutMode) {
    designer.clipboard = null
  }
  report.markDirty()
  closeContextMenu()
}

/** 删除选区单元格内容(Delete 键) */
function doDeleteContent() {
  if (!grid.value) return
  history.pushHistory()
  const s = designer.selection
  for (let r = s.startRow; r <= s.endRow; r++) {
    for (let c = s.startCol; c <= s.endCol; c++) {
      grid.value.setCellContent(r, c, '')
    }
  }
  report.markDirty()
  closeContextMenu()
}

/** 全选(Ctrl+A) */
function doSelectAll() {
  if (!grid.value) return
  designer.setSelection(0, 0)
  designer.extendSelection(grid.value.rowCount - 1, grid.value.colCount - 1)
  closeContextMenu()
}

// 暴露给父组件的方法
defineExpose({
  focusCell,
  mergeSelection: () => {
    if (!grid.value) return
    const s = designer.selection
    history.pushHistory()
    grid.value.merge(s.startRow, s.startCol, s.endRow, s.endCol)
    report.markDirty()
  },
  unmergeSelection: () => {
    if (!grid.value) return
    history.pushHistory()
    grid.value.unmerge(designer.selection.startRow, designer.selection.startCol)
    report.markDirty()
  }
})
</script>

<style scoped>
.cell-canvas {
  position: relative;
  display: inline-grid;
  grid-template-columns: 40px auto;
  grid-template-rows: 24px auto;
  background: #fff;
  user-select: none;
  overflow: auto;
  height: 100%;
  width: 100%;
}

.corner-cell {
  background: #fafafa;
  border-right: 1px solid #e8e8e8;
  border-bottom: 1px solid #e8e8e8;
  position: sticky;
  left: 0;
  top: 0;
  z-index: 3;
}

.col-header-row {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 2;
  background: #fafafa;
}

.col-header {
  height: 24px;
  line-height: 24px;
  text-align: center;
  border-right: 1px solid #e8e8e8;
  border-bottom: 1px solid #e8e8e8;
  font-size: 12px;
  color: #666;
  flex: none;
  cursor: pointer;
  position: relative;
}

/* 列宽拖拽手柄:列头右侧边缘 */
.col-resize-handle {
  position: absolute;
  top: 0;
  right: -2px;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  z-index: 1;
}

.col-resize-handle:hover {
  background: #1677ff;
}

.col-header.selected {
  background: #e6f4ff;
  color: #1677ff;
}

.canvas-body {
  display: flex;
}

.row-header-col {
  position: sticky;
  left: 0;
  z-index: 2;
  background: #fafafa;
}

.row-header {
  width: 40px;
  line-height: 28px;
  text-align: center;
  border-right: 1px solid #e8e8e8;
  border-bottom: 1px solid #e8e8e8;
  font-size: 12px;
  color: #666;
  flex: none;
  cursor: pointer;
  position: relative;
}

/* 行高拖拽手柄:行头底部边缘 */
.row-resize-handle {
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 100%;
  height: 5px;
  cursor: row-resize;
  z-index: 1;
}

.row-resize-handle:hover {
  background: #1677ff;
}

.row-header.selected {
  background: #e6f4ff;
  color: #1677ff;
}

.cells-area {
  display: flex;
  flex-direction: column;
}

.cell-row {
  display: flex;
}

.cell {
  border-right: 1px solid #e8e8e8;
  border-bottom: 1px solid #e8e8e8;
  position: relative;
  flex: none;
  overflow: hidden;
  cursor: cell;
  box-sizing: border-box;
}

/* 特殊类型单元格:flex 居中,避免内容破坏布局 */
.cell.cell-image,
.cell.cell-qrcode,
.cell.cell-barcode,
.cell.cell-chart {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* canvas/svg 不超过单元格 */
.cell canvas,
.cell svg {
  max-width: 100%;
  max-height: 100%;
}

.cell.selected {
  outline: 2px solid #1677ff;
  outline-offset: -2px;
  z-index: 1;
}

/* 整行/整列选中：用底色突出（不描边）。inset box-shadow 覆盖在背景之上、内容之下，
   保证单元格文字仍清晰可见。 */
.cell.band-selected {
  box-shadow: inset 0 0 0 9999px rgba(22, 119, 255, 0.16);
}

.cell.save-conflict {
  box-shadow: inset 0 0 0 2px #ff4d4f;
}

.cell.merged {
  z-index: 1;
}

.cell-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: inherit;
}

.cell.has-expand-indicator .cell-text {
  padding-left: 12px;
  max-width: calc(100% - 12px);
}

.cell-image-el {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.cell-chart {
  width: 100%;
  height: 100%;
}

.cell-editor {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 2px solid #1677ff;
  outline: none;
  resize: none;
  padding: inherit;
  font-family: inherit;
  font-size: inherit;
  background: #fff;
  z-index: 5;
}

.expand-indicator {
  position: absolute;
  left: 3px;
  top: 50%;
  transform: translateY(-50%);
  min-width: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  line-height: 1;
  font-weight: 700;
  z-index: 2;
  pointer-events: none;
  width: 8px;
}

.expand-indicator.dir-down {
  color: #1677ff;
}

.expand-indicator.dir-down::before {
  content: '↓';
}

.expand-indicator.dir-right {
  color: #389e0d;
}

.expand-indicator.dir-right::before {
  content: '→';
}

.formula-suggest {
  position: absolute;
  top: 100%;
  left: 0;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 50;
  min-width: 240px;
  max-height: 200px;
  overflow-y: auto;
}

.suggest-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 12px;
  border-bottom: 1px solid #f5f5f5;
}

.suggest-item:hover,
.suggest-item.active {
  background: #e6f4ff;
}

.suggest-name {
  color: #1677ff;
  font-weight: 500;
  font-family: Consolas, monospace;
}

.suggest-desc {
  color: #999;
  margin-left: 12px;
}

.param-hint {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  color: #389e0d;
  z-index: 50;
  max-width: 360px;
}

.hint-line {
  white-space: nowrap;
}

.hint-example {
  margin-top: 2px;
  color: #7cb305;
  font-family: Consolas, monospace;
  font-size: 11px;
  white-space: nowrap;
}

.formula-error {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  color: #cf1322;
  z-index: 50;
  white-space: nowrap;
}

.context-menu {
  position: fixed;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 100;
  min-width: 180px;
  padding: 4px 0;
  max-height: calc(100vh - 12px);
  overflow-y: auto;
}

.menu-item {
  padding: 6px 16px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.menu-item-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.menu-shortcut {
  margin-left: auto;
  color: #999;
  font-size: 11px;
}

.menu-item :deep(.anticon) {
  font-size: 13px;
  color: #595959;
}

.menu-count-input {
  width: 54px;
  height: 22px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 12px;
}

.menu-item.danger {
  color: #ff4d4f;
}

.menu-item.danger :deep(.anticon) {
  color: #ff4d4f;
}

.menu-item:hover {
  background: #f5f5f5;
}

.menu-item.danger:hover {
  background: #fff1f0;
}

.menu-divider {
  height: 1px;
  background: #e8e8e8;
  margin: 4px 0;
}

.col-spacer {
  height: 100%;
  flex: none;
}

.row-spacer {
  width: 100%;
  flex: none;
}
</style>
