<template>
  <div class="designer-view">
    <DesignerToolbar />
    <div class="designer-body">
      <!-- 左侧面板（可收起） -->
      <div v-show="leftPanelVisible" class="left-panel">
        <div class="left-panel-content">
          <a-tabs v-model:activeKey="leftTab" size="small" class="left-tabs">
            <a-tab-pane key="data" tab="数据">
              <DataPanel />
            </a-tab-pane>
            <a-tab-pane key="param" tab="参数">
              <ParameterPanel />
            </a-tab-pane>
          </a-tabs>
        </div>
        <!-- 左侧栏折叠按钮（在左侧栏右上角） -->
        <a-tooltip title="收起左侧栏">
          <div class="panel-toggle-btn left-panel-toggle" @click="leftPanelVisible = false">
            <MenuFoldOutlined />
          </div>
        </a-tooltip>
      </div>
      <!-- 左侧栏收起后的展开按钮 -->
      <a-tooltip v-if="!leftPanelVisible" title="展开左侧栏">
        <div class="panel-toggle-btn left-show-btn" @click="leftPanelVisible = true">
          <MenuUnfoldOutlined />
        </div>
      </a-tooltip>

      <div class="canvas-wrap">
        <CellToolbar
          @insert-image="openImageDialog"
          @insert-qrcode="openQRDialog"
          @insert-barcode="openBarcodeDialog"
          @insert-chart="openChartDialog"
        />
        <div class="canvas-scroll">
          <CellCanvas ref="canvasRef" />
        </div>
      </div>

      <!-- 右侧面板（可收起） -->
      <div v-show="rightPanelVisible" class="right-panel">
        <div class="right-panel-content">
          <PropertyPanel @reconfigure="onReconfigure" />
        </div>
        <!-- 右侧栏折叠按钮（在右侧栏左上角，箭头向右表示向右收起） -->
        <a-tooltip title="收起右侧栏">
          <div class="panel-toggle-btn right-panel-toggle" @click="rightPanelVisible = false">
            <MenuUnfoldOutlined />
          </div>
        </a-tooltip>
      </div>
      <!-- 右侧栏收起后的展开按钮（箭头向左表示从右侧展开） -->
      <a-tooltip v-if="!rightPanelVisible" title="展开右侧栏">
        <div class="panel-toggle-btn right-show-btn" @click="rightPanelVisible = true">
          <MenuFoldOutlined />
        </div>
      </a-tooltip>
    </div>
    <div class="status-bar">
      <span class="status-left">{{ statusText }}</span>
      <span class="status-right">
        <a-tag v-if="report.dirty" color="orange">未保存</a-tag>
        <span v-else class="saved-tip">已保存</span>
      </span>
    </div>

    <!-- 插入元素对话框 -->
    <ImageDialog v-model:visible="imageDialogVisible" :initial="currentCellInitial?.imageConfig" @confirm="onInsertImage" />
    <QRCodeDialog v-model:visible="qrDialogVisible" :initial="currentCellInitial?.qrConfig" @confirm="onInsertQRCode" />
    <BarcodeDialog v-model:visible="barcodeDialogVisible" :initial="currentCellInitial?.barcodeConfig" @confirm="onInsertBarcode" />
    <ChartDialog v-model:visible="chartDialogVisible" :initial="currentCellInitial?.chartConfig" @confirm="onInsertChart" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons-vue'
import { useReportStore } from '@/stores/report'
import { useDesignerStore } from '@/stores/designer'
import { useHistoryStore } from '@/stores/history'
import DesignerToolbar from '@/components/designer/DesignerToolbar.vue'
import CellToolbar from '@/components/designer/CellToolbar.vue'
import CellCanvas from '@/components/designer/CellCanvas.vue'
import PropertyPanel from '@/components/designer/PropertyPanel.vue'
import DataPanel from '@/components/designer/DataPanel.vue'
import ParameterPanel from '@/components/designer/ParameterPanel.vue'
import ImageDialog from '@/components/designer/ImageDialog.vue'
import QRCodeDialog from '@/components/designer/QRCodeDialog.vue'
import BarcodeDialog from '@/components/designer/BarcodeDialog.vue'
import ChartDialog from '@/components/designer/ChartDialog.vue'
import { cellName, type Cell } from '@/core/cell/types'
import type { ImageConfig, QRConfig, BarcodeConfig, ChartConfig } from '@/types'

const route = useRoute()
const report = useReportStore()
const designer = useDesignerStore()
const history = useHistoryStore()

const leftTab = ref('data')
const leftPanelVisible = ref(true)
const rightPanelVisible = ref(true)
const canvasRef = ref<InstanceType<typeof CellCanvas>>()

const statusText = computed(() => {
  const s = designer.selection
  return `${cellName(s.startRow, s.startCol)} · 行 ${s.startRow + 1} · 列 ${s.startCol + 1} · 缩放 ${designer.zoom}%`
})

// ===== 插入元素对话框 =====
const imageDialogVisible = ref(false)
const qrDialogVisible = ref(false)
const barcodeDialogVisible = ref(false)
const chartDialogVisible = ref(false)

/** 当前选中单元格(用于回显配置) */
const currentCellInitial = computed<Cell | null>(() => {
  if (!report.grid) return null
  return report.grid.getRealCell(designer.selection.startRow, designer.selection.startCol)
})

function openImageDialog() {
  imageDialogVisible.value = true
}
function openQRDialog() {
  qrDialogVisible.value = true
}
function openBarcodeDialog() {
  barcodeDialogVisible.value = true
}
function openChartDialog() {
  chartDialogVisible.value = true
}

/** 属性面板"重新配置"按钮:根据当前单元格类型打开对应对话框 */
function onReconfigure() {
  const t = currentCellInitial.value?.cellType
  if (t === 'image') openImageDialog()
  else if (t === 'qrcode') openQRDialog()
  else if (t === 'barcode') openBarcodeDialog()
  else if (t === 'chart') openChartDialog()
}

/** 通用:写入配置到当前选中单元格 */
function applyInsert(cellType: Cell['cellType'], patch: Partial<Cell>) {
  if (!report.grid) return
  const cell = report.grid.getRealCell(designer.selection.startRow, designer.selection.startCol)
  if (!cell) return
  history.pushHistory()
  cell.cellType = cellType
  Object.assign(cell, patch)
  report.markDirty()
}

function onInsertImage(config: ImageConfig) {
  // 图片:content 设为 URL 表达式(运行时求值为图片地址);base64 模式用占位
  const content = config.source === 'url' ? (config.url ?? '') : `[image:base64]`
  applyInsert('image', { imageConfig: config, content })
}
function onInsertQRCode(config: QRConfig) {
  // 二维码:content 即数据表达式,运行时由求值器解析为实际数据
  applyInsert('qrcode', { qrConfig: config, content: config.data })
}
function onInsertBarcode(config: BarcodeConfig) {
  // 条码:content 即数据表达式,运行时由求值器解析为实际数据
  applyInsert('barcode', { barcodeConfig: config, content: config.data })
}
function onInsertChart(config: ChartConfig) {
  applyInsert('chart', { chartConfig: config, content: `[chart] ${config.title ?? config.type}` })
}

onMounted(async () => {
  const id = route.params.id as string | undefined
  try {
    if (id) {
      await report.open(id)
      // open 后若 grid 仍为空（如模板数据异常），兜底新建避免画布空白
      if (!report.grid) {
        report.newTemplate()
      }
    } else if (!report.currentTemplate) {
      report.newTemplate()
    }
  } catch (e: any) {
    console.error('加载模板失败:', e)
    message.error('加载模板失败：' + (e?.message ?? e))
    // 失败时兜底新建，避免卡在空白
    report.newTemplate()
  }
  // 确保画布在 grid 加载后正确测量视口
  await nextTick()
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})

function onKeydown(e: KeyboardEvent) {
  if (designer.editingCell) return
  const ctrl = e.ctrlKey || e.metaKey
  if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault()
    history.undo()
  } else if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault()
    history.redo()
  } else if (ctrl && e.key.toLowerCase() === 's') {
    e.preventDefault()
    report.save()
  }
}
</script>

<style scoped>
.designer-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f0f2f5;
}

.designer-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.left-panel {
  width: 280px;
  border-right: 1px solid #e8e8e8;
  background: #fff;
  overflow: visible;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
  position: relative;
}

.left-panel-content {
  flex: 1;
  overflow: auto;
  height: 100%;
}

.left-tabs :deep(.ant-tabs-nav) {
  margin: 0 12px;
}

.canvas-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f0f2f5;
  min-width: 0;
  position: relative;
}

.canvas-scroll {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.right-panel {
  width: 320px;
  border-left: 1px solid #e8e8e8;
  overflow: visible;
  background: #fff;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
  position: relative;
}

.right-panel-content {
  flex: 1;
  overflow: auto;
  height: 100%;
}

.panel-toggle-btn {
  position: absolute;
  top: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  color: #595959;
  font-size: 14px;
  z-index: 20;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.panel-toggle-btn:hover {
  color: #1677ff;
  border-color: #1677ff;
  background: #e6f4ff;
}

/* 左侧栏内部的折叠按钮(右上角) */
.left-panel-toggle {
  right: 8px;
}

/* 右侧栏内部的折叠按钮(最右边) */
.right-panel-toggle {
  right: 8px;
}

/* 面板收起后的展开按钮(在画布边缘) */
.left-show-btn {
  left: 4px;
  top: 4px;
}

.right-show-btn {
  right: 4px;
  top: 4px;
}

.status-bar {
  height: 28px;
  background: #fff;
  border-top: 1px solid #e8e8e8;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
}

.status-left {
  color: #595959;
}

.status-right {
  display: flex;
  align-items: center;
}

.saved-tip {
  color: #52c41a;
  font-size: 12px;
}
</style>
