<template>
  <div class="cell-toolbar">
    <!-- 撤销/重做 -->
    <a-tooltip title="撤销 (Ctrl+Z)">
      <a-button size="small" type="text" :disabled="!history.canUndo" @click="history.undo()">
        <template #icon><UndoOutlined /></template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="重做 (Ctrl+Y)">
      <a-button size="small" type="text" :disabled="!history.canRedo" @click="history.redo()">
        <template #icon><RedoOutlined /></template>
      </a-button>
    </a-tooltip>

    <a-divider type="vertical" />

    <!-- 字体 -->
    <a-select
      v-model:value="fontFamily"
      size="small"
      style="width: 110px"
      @change="applyStyle({ fontFamily })"
    >
      <a-select-option value="Microsoft YaHei">微软雅黑</a-select-option>
      <a-select-option value="SimSun">宋体</a-select-option>
      <a-select-option value="SimHei">黑体</a-select-option>
      <a-select-option value="KaiTi">楷体</a-select-option>
      <a-select-option value="Arial">Arial</a-select-option>
      <a-select-option value="Times New Roman">Times New Roman</a-select-option>
    </a-select>
    <a-input-number
      v-model:value="fontSize"
      size="small"
      :min="6"
      :max="72"
      style="width: 60px; margin-left: 4px"
      @change="applyStyle({ fontSize })"
    />

    <a-divider type="vertical" />

    <!-- 加粗/斜体/下划线 -->
    <a-tooltip title="加粗 (Ctrl+B)">
      <a-button size="small" type="text" :class="{ active: bold }" @click="toggleBold">
        <template #icon><BoldOutlined /></template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="斜体 (Ctrl+I)">
      <a-button size="small" type="text" :class="{ active: italic }" @click="toggleItalic">
        <template #icon><ItalicOutlined /></template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="下划线 (Ctrl+U)">
      <a-button size="small" type="text" :class="{ active: underline }" @click="toggleUnderline">
        <template #icon><UnderlineOutlined /></template>
      </a-button>
    </a-tooltip>

    <a-divider type="vertical" />

    <!-- 字体颜色 -->
    <a-popover v-model:open="colorPopover" trigger="click" placement="bottomLeft" :overlay-class-name="'color-popover'">
      <template #title>
        <span style="font-size: 12px">字体颜色</span>
      </template>
      <template #content>
        <div class="color-picker-panel">
          <div class="preset-colors">
            <div
              v-for="c in presetColors"
              :key="c"
              class="preset-color"
              :style="{ background: c }"
              @click="applyColor('color', c)"
            ></div>
          </div>
          <div class="custom-color-row">
            <input type="color" v-model="customColor" class="native-color-input" />
            <a-button size="small" type="primary" @click="applyColor('color', customColor)">应用</a-button>
          </div>
          <div class="auto-color-row">
            <a-button size="small" block @click="applyColor('color', '')">自动颜色</a-button>
          </div>
        </div>
      </template>
      <a-tooltip title="字体颜色">
        <button class="color-btn">
          <FontColorsOutlined />
          <div class="color-bar" :style="{ background: color || '#1f2329' }"></div>
        </button>
      </a-tooltip>
    </a-popover>

    <!-- 背景色 -->
    <a-popover v-model:open="bgPopover" trigger="click" placement="bottomLeft" :overlay-class-name="'color-popover'">
      <template #title>
        <span style="font-size: 12px">背景色</span>
      </template>
      <template #content>
        <div class="color-picker-panel">
          <div class="preset-colors">
            <div
              v-for="c in presetColors"
              :key="c"
              class="preset-color"
              :style="{ background: c }"
              @click="applyColor('background', c)"
            ></div>
          </div>
          <div class="custom-color-row">
            <input type="color" v-model="customBg" class="native-color-input" />
            <a-button size="small" type="primary" @click="applyColor('background', customBg)">应用</a-button>
          </div>
          <div class="auto-color-row">
            <a-button size="small" block @click="applyColor('background', '')">无填充</a-button>
          </div>
        </div>
      </template>
      <a-tooltip title="背景色">
        <button class="color-btn">
          <BgColorsOutlined />
          <div class="color-bar" :style="{ background: background || '#ffffff' }"></div>
        </button>
      </a-tooltip>
    </a-popover>

    <a-divider type="vertical" />

    <!-- 对齐 -->
    <a-tooltip title="左对齐">
      <a-button size="small" type="text" :class="{ active: hAlign === 'left' }" @click="setHAlign('left')">
        <template #icon><AlignLeftOutlined /></template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="居中">
      <a-button size="small" type="text" :class="{ active: hAlign === 'center' }" @click="setHAlign('center')">
        <template #icon><AlignCenterOutlined /></template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="右对齐">
      <a-button size="small" type="text" :class="{ active: hAlign === 'right' }" @click="setHAlign('right')">
        <template #icon><AlignRightOutlined /></template>
      </a-button>
    </a-tooltip>

    <a-divider type="vertical" />

    <!-- 垂直对齐 -->
    <a-tooltip title="顶部对齐">
      <a-button size="small" type="text" :class="{ active: vAlign === 'top' }" @click="setVAlign('top')">
        <template #icon><VerticalAlignTopOutlined /></template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="垂直居中">
      <a-button size="small" type="text" :class="{ active: vAlign === 'middle' }" @click="setVAlign('middle')">
        <template #icon><VerticalAlignMiddleOutlined /></template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="底部对齐">
      <a-button size="small" type="text" :class="{ active: vAlign === 'bottom' }" @click="setVAlign('bottom')">
        <template #icon><VerticalAlignBottomOutlined /></template>
      </a-button>
    </a-tooltip>

    <a-divider type="vertical" />

    <!-- 自动换行 -->
    <a-tooltip title="自动换行">
      <a-button size="small" type="text" :class="{ active: wrap }" @click="toggleWrap">
        <template #icon><ColumnWidthOutlined /></template>
      </a-button>
    </a-tooltip>

    <a-divider type="vertical" />

    <!-- 行高/列宽(下拉设定) -->
    <a-popover v-model:open="sizePopover" trigger="click" placement="bottomLeft">
      <template #title>
        <span style="font-size: 12px">行高 / 列宽</span>
      </template>
      <template #content>
        <div class="size-panel">
          <div class="size-row">
            <span class="size-label">行高</span>
            <a-input-number
              v-model:value="rowHeightValue"
              size="small"
              :min="10"
              :max="200"
              :step="1"
              style="width: 90px"
              @change="onRowHeightChange"
            />
            <span class="size-unit">px</span>
          </div>
          <div class="size-row">
            <span class="size-label">列宽</span>
            <a-input-number
              v-model:value="colWidthValue"
              size="small"
              :min="20"
              :max="500"
              :step="1"
              style="width: 90px"
              @change="onColWidthChange"
            />
            <span class="size-unit">px</span>
          </div>
        </div>
      </template>
      <a-tooltip title="行高 / 列宽">
        <a-button size="small" type="text">
          <template #icon><ColumnHeightOutlined /></template>
        </a-button>
      </a-tooltip>
    </a-popover>

    <a-divider type="vertical" />

    <!-- 边框 -->
    <a-dropdown>
      <a-tooltip title="边框">
        <a-button size="small" type="text">
          <template #icon><BorderOuterOutlined /></template>
        </a-button>
      </a-tooltip>
      <template #overlay>
        <a-menu @click="onBorderMenu">
          <a-menu-item key="all"><BorderOutlined /> 全部边框</a-menu-item>
          <a-menu-item key="outer"><BorderOuterOutlined /> 外边框</a-menu-item>
          <a-menu-item key="top"><BorderTopOutlined /> 上边框</a-menu-item>
          <a-menu-item key="bottom"><BorderBottomOutlined /> 下边框</a-menu-item>
          <a-menu-item key="left"><BorderLeftOutlined /> 左边框</a-menu-item>
          <a-menu-item key="right"><BorderRightOutlined /> 右边框</a-menu-item>
          <a-menu-divider />
          <a-menu-item key="none"><StopOutlined /> 无边框</a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>

    <!-- 合并/拆分 -->
    <a-tooltip title="合并单元格">
      <a-button size="small" type="text" :disabled="designer.isSingle" @click="onMerge">
        <template #icon><MergeCellsOutlined /></template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="拆分单元格">
      <a-button size="small" type="text" :disabled="!canUnmerge" @click="onUnmerge">
        <template #icon><SplitCellsOutlined /></template>
      </a-button>
    </a-tooltip>

    <a-divider type="vertical" />

    <!-- 插入行/列 -->
    <a-tooltip title="插入行">
      <a-button size="small" type="text" @click="onInsertRow">
        <template #icon><InsertRowAboveOutlined /></template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="插入列">
      <a-button size="small" type="text" @click="onInsertCol">
        <template #icon><InsertRowLeftOutlined /></template>
      </a-button>
    </a-tooltip>

    <a-divider type="vertical" />

    <!-- 插入图片/二维码/条码/图表 -->
    <a-tooltip title="插入图片">
      <a-button size="small" type="text" @click="emit('insert-image')">
        <template #icon><PictureOutlined /></template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="插入二维码">
      <a-button size="small" type="text" @click="emit('insert-qrcode')">
        <template #icon><QrcodeOutlined /></template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="插入条码">
      <a-button size="small" type="text" @click="emit('insert-barcode')">
        <template #icon><BarcodeOutlined /></template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="插入图表">
      <a-button size="small" type="text" @click="emit('insert-chart')">
        <template #icon><BarChartOutlined /></template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="插入公式">
      <a-button size="small" type="text" @click="onInsertFormula">
        <template #icon><FunctionOutlined /></template>
      </a-button>
    </a-tooltip>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  FontColorsOutlined,
  BgColorsOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignMiddleOutlined,
  VerticalAlignBottomOutlined,
  ColumnWidthOutlined,
  BorderOuterOutlined,
  BorderOutlined,
  BorderTopOutlined,
  BorderBottomOutlined,
  BorderLeftOutlined,
  BorderRightOutlined,
  MergeCellsOutlined,
  SplitCellsOutlined,
  InsertRowAboveOutlined,
  InsertRowLeftOutlined,
  UndoOutlined,
  RedoOutlined,
  StopOutlined,
  PictureOutlined,
  QrcodeOutlined,
  BarcodeOutlined,
  BarChartOutlined,
  FunctionOutlined,
  ColumnHeightOutlined
} from '@ant-design/icons-vue'
import { useReportStore } from '@/stores/report'
import { useDesignerStore } from '@/stores/designer'
import { useHistoryStore } from '@/stores/history'
import type { HAlign, BorderEdge } from '@/core/cell/types'

const report = useReportStore()
const designer = useDesignerStore()
const history = useHistoryStore()

const emit = defineEmits<{
  (e: 'insert-image'): void
  (e: 'insert-qrcode'): void
  (e: 'insert-barcode'): void
  (e: 'insert-chart'): void
}>()

/** 预设颜色板 */
const presetColors = [
  '#000000', '#595959', '#8c8c8c', '#bfbfbf', '#ffffff', '#f5222d',
  '#fa541c', '#fa8c16', '#faad14', '#fadb14', '#a0d911', '#52c41a',
  '#13c2c2', '#1677ff', '#2f54eb', '#722ed1', '#eb2f96', '#1f2329',
  '#ffe7ba', '#ffd591', '#ffc068', '#ffa940', '#d4380d', '#874d00'
]

/** Popover 状态 */
const colorPopover = ref(false)
const bgPopover = ref(false)
const sizePopover = ref(false)
const customColor = ref('#1f2329')
const customBg = ref('#ffffff')

/** 应用颜色到选区 */
function applyColor(target: 'color' | 'background', val: string) {
  if (target === 'color') {
    color.value = val
    customColor.value = val || '#1f2329'
    applyStyle({ color: val || undefined })
    colorPopover.value = false
  } else {
    background.value = val
    customBg.value = val || '#ffffff'
    applyStyle({ background: val || undefined })
    bgPopover.value = false
  }
}

/** 当前选区主单元格样式（用于显示工具栏状态） */
const currentCell = computed(() => {
  if (!report.grid) return null
  return report.grid.getRealCell(designer.selection.startRow, designer.selection.startCol)
})

const fontFamily = ref<string>('Microsoft YaHei')
const fontSize = ref<number>(12)
const bold = ref(false)
const italic = ref(false)
const underline = ref(false)
const color = ref('#1f2329')
const background = ref('#ffffff')
const hAlign = ref<HAlign>('left')
const vAlign = ref<string>('middle')
const wrap = ref(false)
const rowHeightValue = ref<number>(28)
const colWidthValue = ref<number>(100)

const colorInputRef = ref<HTMLInputElement | null>(null)
const bgInputRef = ref<HTMLInputElement | null>(null)

/** 监听选区变化，同步工具栏状态 */
watch(
  currentCell,
  (cell) => {
    if (!cell) return
    const s = cell.style
    fontFamily.value = s.fontFamily ?? 'Microsoft YaHei'
    fontSize.value = s.fontSize ?? 12
    bold.value = !!s.bold
    italic.value = !!s.italic
    underline.value = !!s.underline
    color.value = s.color ?? '#1f2329'
    background.value = s.background ?? '#ffffff'
    hAlign.value = s.hAlign ?? 'left'
    vAlign.value = s.vAlign ?? 'middle'
    wrap.value = !!s.wrap
    customColor.value = s.color ?? '#1f2329'
    customBg.value = s.background ?? '#ffffff'
    // 同步行高/列宽(基于选区起始行列)
    if (report.grid) {
      rowHeightValue.value = report.grid.rows[designer.selection.startRow]?.height ?? 28
      colWidthValue.value = report.grid.columns[designer.selection.startCol]?.width ?? 100
    }
  },
  { immediate: true }
)

const canUnmerge = computed(() => {
  if (!report.grid) return false
  const cell = report.grid.getRealCell(designer.selection.startRow, designer.selection.startCol)
  return !!cell && (cell.rowSpan > 1 || cell.colSpan > 1)
})

/** 应用样式到选区（支持多选） */
function applyStyle(patch: Record<string, unknown>) {
  if (!report.grid) return
  history.pushHistory()
  const s = designer.selection
  report.grid.applyStyleToRange(s.startRow, s.startCol, s.endRow, s.endCol, patch as any)
  report.markDirty()
}

function toggleBold() {
  bold.value = !bold.value
  applyStyle({ bold: bold.value })
}
function toggleItalic() {
  italic.value = !italic.value
  applyStyle({ italic: italic.value })
}
function toggleUnderline() {
  underline.value = !underline.value
  applyStyle({ underline: underline.value })
}
function setHAlign(v: HAlign) {
  hAlign.value = v
  applyStyle({ hAlign: v })
}

function setVAlign(v: string) {
  vAlign.value = v
  applyStyle({ vAlign: v })
}

function toggleWrap() {
  wrap.value = !wrap.value
  applyStyle({ wrap: wrap.value })
}

/** 设置选区行高(应用到选区所有行) */
function onRowHeightChange() {
  if (!report.grid) return
  history.pushHistory()
  const s = designer.selection
  for (let r = s.startRow; r <= s.endRow; r++) {
    report.grid.setRowHeight(r, rowHeightValue.value)
  }
  report.markDirty()
}

/** 设置选区列宽(应用到选区所有列) */
function onColWidthChange() {
  if (!report.grid) return
  history.pushHistory()
  const s = designer.selection
  for (let c = s.startCol; c <= s.endCol; c++) {
    report.grid.setColWidth(c, colWidthValue.value)
  }
  report.markDirty()
}

/** 插入公式:进入公式编辑模式,以 = 开头 */
function onInsertFormula() {
  designer.requestStartFormulaEdit()
}

function onBorderMenu({ key }: { key: string }) {
  if (!report.grid) return
  history.pushHistory()
  const s = designer.selection
  report.grid.setBorderToRange(s.startRow, s.startCol, s.endRow, s.endCol, key as any)
  report.markDirty()
}

function onMerge() {
  if (!report.grid) return
  const s = designer.selection
  history.pushHistory()
  report.grid.merge(s.startRow, s.startCol, s.endRow, s.endCol)
  report.markDirty()
}

function onUnmerge() {
  if (!report.grid) return
  history.pushHistory()
  report.grid.unmerge(designer.selection.startRow, designer.selection.startCol)
  report.markDirty()
}

function onInsertRow() {
  if (!report.grid) return
  history.pushHistory()
  report.grid.insertRow(designer.selection.startRow)
  report.markDirty()
}

function onInsertCol() {
  if (!report.grid) return
  history.pushHistory()
  report.grid.insertCol(designer.selection.startCol)
  report.markDirty()
}
</script>

<style scoped>
.cell-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 12px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  flex-wrap: wrap;
  min-height: 40px;
}

.cell-toolbar :deep(.ant-btn) {
  padding: 2px 6px;
  height: 28px;
}

.cell-toolbar :deep(.ant-btn.active) {
  background: #e6f4ff;
  color: #1677ff;
}

.cell-toolbar :deep(.ant-btn:disabled) {
  color: #d9d9d9;
}

.color-picker-wrap {
  display: inline-flex;
  align-items: center;
}

.color-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  padding: 1px 4px;
  height: 28px;
  border-radius: 4px;
  font-size: 14px;
  color: #595959;
}

.color-btn:hover {
  background: #f5f5f5;
}

.color-bar {
  width: 16px;
  height: 3px;
  margin-top: 1px;
  border: 1px solid #d9d9d9;
}

.cell-toolbar :deep(.ant-divider-vertical) {
  height: 20px;
  margin: 0 4px;
}

.cell-toolbar :deep(.ant-select-selector) {
  font-size: 12px;
}

.color-picker-panel {
  width: 168px;
}

.preset-colors {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.preset-color {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid #d9d9d9;
  transition: transform 0.15s;
}

.preset-color:hover {
  transform: scale(1.15);
  border-color: #1677ff;
}

.custom-color-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.native-color-input {
  width: 36px;
  height: 28px;
  padding: 0;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  cursor: pointer;
  background: none;
}

.auto-color-row {
  border-top: 1px solid #f0f0f0;
  padding-top: 6px;
}

/* 行高/列宽设定面板 */
.size-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px 0;
}

.size-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.size-label {
  font-size: 12px;
  color: #595959;
  width: 36px;
  flex-shrink: 0;
}

.size-unit {
  font-size: 11px;
  color: #999;
}
</style>
