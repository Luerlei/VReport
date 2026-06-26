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
            :style="cellStyle(row, col)"
            @mousedown.stop="onCellMouseDown($event, row, col)"
            @dblclick="onCellDblClick(row, col)"
          >
            <template v-if="isEditing(row, col)">
              <textarea
                ref="editorRefs"
                v-model="editValue"
                class="cell-editor"
                :style="editorStyle(row, col)"
                @blur="commitEdit"
                @keydown.enter.exact.prevent="onEditorEnter"
                @keydown.tab.exact.prevent="commitEditAndMove(1, 0)"
                @keydown.esc.prevent="cancelEdit"
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
              <!-- 参数提示 + 示例 -->
              <div v-if="paramHint" class="param-hint">
                <div class="hint-line">{{ paramHint.signature }} — {{ paramHint.desc }}</div>
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
        <InsertRowAboveOutlined /> 向上插入行
      </div>
      <div class="menu-item" @click="doInsertCol">
        <InsertRowLeftOutlined /> 向左插入列
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item danger" @click="doDeleteRow">
        <DeleteRowOutlined /> 删除行
      </div>
      <div class="menu-item danger" @click="doDeleteCol">
        <DeleteColumnOutlined /> 删除列
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
  const s = designer.selection
  return col >= s.startCol && col <= s.endCol
}
function isRowSelected(row: number): boolean {
  const s = designer.selection
  return row >= s.startRow && row <= s.endRow
}

function cellClass(row: number, col: number) {
  const cell = realCell(row, col)
  const isMain = cell && cell.row === row && cell.col === col
  return {
    selected: inSelection(row, col),
    merged: cell && (cell.rowSpan > 1 || cell.colSpan > 1) && isMain,
    covered: cell && !(cell.row === row && cell.col === col),
    'cell-image': isMain && cell?.cellType === 'image',
    'cell-qrcode': isMain && cell?.cellType === 'qrcode',
    'cell-barcode': isMain && cell?.cellType === 'barcode',
    'cell-chart': isMain && cell?.cellType === 'chart'
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
  if (s.fontFamily) css['font-family'] = s.fontFamily
  if (s.fontSize) css['font-size'] = s.fontSize + 'px'
  if (s.bold) css['font-weight'] = 'bold'
  if (s.italic) css['font-style'] = 'italic'
  if (s.underline) css['text-decoration'] = 'underline'
  if (s.color) css['color'] = s.color
  if (s.background) css['background-color'] = s.background
  if (s.hAlign) css['text-align'] = s.hAlign
  // 垂直对齐:用 flex 布局实现(vertical-align 在 block 元素中无效)
  if (s.vAlign) {
    css['display'] = 'flex'
    if (s.vAlign === 'top') css['align-items'] = 'flex-start'
    else if (s.vAlign === 'middle') css['align-items'] = 'center'
    else if (s.vAlign === 'bottom') css['align-items'] = 'flex-end'
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
import { parseCellRef } from '@/core/expression/Lexer'

const formulaSuggestions = ref<FormulaSuggestion[]>([])
const suggestIndex = ref(0)
const paramHint = ref<FormulaSuggestion | null>(null)
const formulaError = ref<string | null>(null)

/** Excel 风格引用高亮颜色调色板 */
const REF_COLORS = ['#0078D4', '#00B050', '#FFC000', '#7030A0', '#E97132', '#2E75B6', '#548235', '#C00000']

/** 公式引用高亮信息：每个引用对应一个颜色与单元格区域 */
interface FormulaRef {
  color: string
  cells: { row: number; col: number }[]
  isRange: boolean
}

/** 解析公式中所有单元格引用(含区域 A1:B3) */
function extractFormulaRefs(formula: string): FormulaRef[] {
  if (!formula || !formula.startsWith('=')) return []
  const expr = formula.substring(1)
  const refs: FormulaRef[] = []
  // 先匹配区域 A1:B3
  const rangeRe = /\$?[A-Za-z]+\$?[0-9]+\s*:\s*\$?[A-Za-z]+\$?[0-9]+/g
  const singleRe = /\$?[A-Za-z]+\$?[0-9]+/g
  let consumed: { start: number; end: number }[] = []
  let m: RegExpExecArray | null
  while ((m = rangeRe.exec(expr)) !== null) {
    const parts = m[0].split(':')
    try {
      const a = parseCellRef(parts[0].trim())
      const b = parseCellRef(parts[1].trim())
      const cells: { row: number; col: number }[] = []
      const minR = Math.min(a.row, b.row), maxR = Math.max(a.row, b.row)
      const minC = Math.min(a.col, b.col), maxC = Math.max(a.col, b.col)
      for (let r = minR; r <= maxR; r++) for (let c = minC; c <= maxC; c++) cells.push({ row: r, col: c })
      refs.push({ color: '', cells, isRange: true })
      consumed.push({ start: m.index, end: m.index + m[0].length })
    } catch { /* 忽略非法引用 */ }
  }
  // 再匹配单个单元格(排除已被区域覆盖的部分)
  while ((m = singleRe.exec(expr)) !== null) {
    const inRange = consumed.some((c) => m!.index >= c.start && m!.index + m![0].length <= c.end)
    if (inRange) continue
    try {
      const a = parseCellRef(m[0])
      refs.push({ color: '', cells: [{ row: a.row, col: a.col }], isRange: false })
    } catch { /* 忽略非法引用 */ }
  }
  // 分配颜色
  refs.forEach((r, i) => { r.color = REF_COLORS[i % REF_COLORS.length] })
  return refs
}

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
      const row = designer.selection.startRow
      const col = designer.selection.startCol
      const cell = grid.value.getRealCell(row, col)
      if (!cell) return
      const t = cell.cellType ?? 'text'
      if (t === 'image' || t === 'qrcode' || t === 'barcode' || t === 'chart') return
      history.pushHistory()
      const existing = cell.content || ''
      grid.value.setCellContent(row, col, existing ? existing + expr : expr)
      report.markDirty()
    }
    designer.fieldInsertRequest = null
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

function onCellMouseDown(e: MouseEvent, row: number, col: number) {
  // 公式拾取模式:点击单元格插入引用到编辑器光标位置,保持编辑状态
  if (designer.formulaPicking && designer.editingCell) {
    e.preventDefault() // 阻止 textarea 失焦
    const ref = colIndexToName(col) + (row + 1)
    const editor = editorRefs.value[0] as HTMLTextAreaElement | undefined
    const pos = editor?.selectionStart ?? editValue.value.length
    editValue.value = editValue.value.substring(0, pos) + ref + editValue.value.substring(pos)
    nextTick(() => {
      if (editor) {
        const newPos = pos + ref.length
        editor.selectionStart = editor.selectionEnd = newPos
        editor.focus()
      }
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
    // Shift+点击：扩展选区
    designer.extendSelection(row, col)
    return
  }
  // 普通点击：开始新选区
  designer.setSelection(row, col)
  isDragging = true
  dragStartRow = row
  dragStartCol = col
}

function onCellsAreaMouseDown(e: MouseEvent) {
  // 点击空白区域取消编辑
  if (designer.editingCell) commitEdit()
}

function onRowHeaderMouseDown(e: MouseEvent, row: number) {
  if (designer.editingCell) commitEdit()
  if (!grid.value) return
  designer.setSelection(row, 0)
  designer.extendSelection(row, grid.value.colCount - 1)
  isDragging = true
  dragStartRow = row
  dragStartCol = 0
}

function onColHeaderMouseDown(e: MouseEvent, col: number) {
  if (designer.editingCell) commitEdit()
  if (!grid.value) return
  designer.setSelection(0, col)
  designer.extendSelection(grid.value.rowCount - 1, col)
  isDragging = true
  dragStartRow = 0
  dragStartCol = col
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
  const relY = y - rect.top + scrollTop.value
  const relX = x - rect.left + scrollLeft.value
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
  if (!isDragging || !grid.value) return
  const pos = getCellFromPoint(e.clientX, e.clientY)
  if (!pos) return
  designer.setSelection(dragStartRow, dragStartCol)
  designer.extendSelection(pos.row, pos.col)
}

function onMouseUp() {
  isDragging = false
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

// ===== 键盘交互（Excel 风格） =====
function onCanvasKeydown(e: KeyboardEvent) {
  // 编辑中不处理
  if (designer.editingCell) return
  if (!grid.value) return

  const ctrl = e.ctrlKey || e.metaKey
  const s = designer.selection
  const key = e.key

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

function onContextMenu(e: MouseEvent) {
  contextMenu.value = { show: true, x: e.clientX, y: e.clientY }
}

function closeContextMenu() {
  contextMenu.value.show = false
}

function doInsertRow() {
  if (!grid.value) return
  history.pushHistory()
  grid.value.insertRow(designer.selection.startRow)
  report.markDirty()
  closeContextMenu()
}
function doInsertCol() {
  if (!grid.value) return
  history.pushHistory()
  grid.value.insertCol(designer.selection.startCol)
  report.markDirty()
  closeContextMenu()
}
function doDeleteRow() {
  if (!grid.value) return
  history.pushHistory()
  grid.value.deleteRow(designer.selection.startRow)
  report.markDirty()
  closeContextMenu()
}
function doDeleteCol() {
  if (!grid.value) return
  history.pushHistory()
  grid.value.deleteCol(designer.selection.startCol)
  report.markDirty()
  closeContextMenu()
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
    const p = parseCellName(name)
    if (!p) return undefined
    const nr = p.row + rowOffset
    const nc = p.col + colOffset
    if (nr < 0 || nc < 0) return undefined
    return colIndexToName(nc) + (nr + 1)
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
      target.content = cloned.content
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

.cell.merged {
  z-index: 1;
}

.cell-text {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
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
}

.menu-item {
  padding: 6px 16px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
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
