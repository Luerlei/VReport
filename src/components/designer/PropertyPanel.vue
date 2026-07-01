<template>
  <div class="property-panel">
    <!-- 顶部标签（预留扩展其他标签页） -->
    <div class="panel-tabs">
      <div class="panel-tab active">属性</div>
    </div>

    <div class="panel-content">
      <!-- 分组：单元格信息 -->
    <div class="prop-group">
      <div class="group-header" @click="groups.cell = !groups.cell">
        <span class="group-arrow">
          <DownOutlined v-if="groups.cell" />
          <RightOutlined v-else />
        </span>
        <span class="group-title">单元格</span>
      </div>
      <div v-show="groups.cell" class="group-body">
        <div class="prop-grid">
          <div class="prop-cell">
            <span class="prop-label">坐标</span>
            <span class="prop-value">{{ currentCell?.name ?? '-' }}</span>
          </div>
          <div class="prop-cell">
            <span class="prop-label">类型</span>
            <span class="prop-value">{{ cellTypeLabel }}</span>
          </div>
          <div class="prop-cell">
            <span class="prop-label">行高</span>
            <a-input-number
              v-model:value="rowHeightValue"
              size="small"
              :min="10"
              :max="200"
              :step="1"
              style="width: 70px"
              @change="onRowHeightChange"
            />
          </div>
          <div class="prop-cell">
            <span class="prop-label">列宽</span>
            <a-input-number
              v-model:value="colWidthValue"
              size="small"
              :min="20"
              :max="500"
              :step="1"
              style="width: 70px"
              @change="onColWidthChange"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 分组：特殊单元格配置(图片/二维码/条码/图表) -->
    <div v-if="hasSpecialConfig" class="prop-group">
      <div class="group-header" @click="groups.special = !groups.special">
        <span class="group-arrow">
          <DownOutlined v-if="groups.special" />
          <RightOutlined v-else />
        </span>
        <span class="group-title">{{ specialConfigTitle }}</span>
      </div>
      <div v-show="groups.special" class="group-body">
        <!-- 图片配置摘要 -->
        <template v-if="currentCell?.cellType === 'image' && currentCell.imageConfig">
          <div class="prop-grid">
            <div class="prop-cell">
              <span class="prop-label">来源</span>
              <span class="prop-value">{{ currentCell.imageConfig.source === 'url' ? 'URL' : '本地' }}</span>
            </div>
            <div class="prop-cell" v-if="currentCell.imageConfig.source === 'url'">
              <span class="prop-label">URL</span>
              <span class="prop-value ellipsis">{{ currentCell.imageConfig.url || '-' }}</span>
            </div>
            <div class="prop-cell" v-else>
              <span class="prop-label">数据</span>
              <span class="prop-value">{{ currentCell.imageConfig.base64 ? '已嵌入' : '未上传' }}</span>
            </div>
          </div>
        </template>
        <!-- 二维码配置摘要 -->
        <template v-else-if="currentCell?.cellType === 'qrcode' && currentCell.qrConfig">
          <div class="prop-grid">
            <div class="prop-cell">
              <span class="prop-label">纠错</span>
              <span class="prop-value">{{ currentCell.qrConfig.errorCorrectLevel ?? 'M' }}</span>
            </div>
            <div class="prop-cell">
              <span class="prop-label">数据</span>
              <span class="prop-value ellipsis">{{ currentCell.qrConfig.data || '-' }}</span>
            </div>
          </div>
        </template>
        <!-- 条码配置摘要 -->
        <template v-else-if="currentCell?.cellType === 'barcode' && currentCell.barcodeConfig">
          <div class="prop-grid">
            <div class="prop-cell">
              <span class="prop-label">类型</span>
              <span class="prop-value">{{ currentCell.barcodeConfig.format }}</span>
            </div>
            <div class="prop-cell">
              <span class="prop-label">数据</span>
              <span class="prop-value ellipsis">{{ currentCell.barcodeConfig.data || '-' }}</span>
            </div>
          </div>
        </template>
        <!-- 图表配置摘要 -->
        <template v-else-if="currentCell?.cellType === 'chart' && currentCell.chartConfig">
          <div class="prop-grid">
            <div class="prop-cell">
              <span class="prop-label">图表</span>
              <span class="prop-value">{{ chartTypeLabel }}</span>
            </div>
            <div class="prop-cell">
              <span class="prop-label">系列</span>
              <span class="prop-value">{{ currentCell.chartConfig.series.length }}</span>
            </div>
            <div class="prop-cell" style="grid-column: span 2">
              <span class="prop-label">数据集</span>
              <span class="prop-value ellipsis">{{ currentCell.chartConfig.dataset || '-' }}</span>
            </div>
          </div>
        </template>

        <div class="prop-actions">
          <a-tooltip title="重新配置">
            <a-button size="small" type="primary" @click="emit('reconfigure')">
              <template #icon><EditOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-tooltip title="清除为文本">
            <a-button size="small" danger @click="clearSpecialType">
              <template #icon><DeleteOutlined /></template>
            </a-button>
          </a-tooltip>
        </div>
      </div>
    </div>

    <!-- 分组：内容 -->
    <div class="prop-group">
      <div class="group-header" @click="groups.content = !groups.content">
        <span class="group-arrow">
          <DownOutlined v-if="groups.content" />
          <RightOutlined v-else />
        </span>
        <span class="group-title">内容</span>
      </div>
      <div v-show="groups.content" class="group-body">
        <a-textarea
          v-model:value="contentValue"
          :rows="2"
          size="small"
          placeholder="文本或表达式，如 ${ds1.name}"
          @change="onContentChange"
        />
      </div>
    </div>

    <!-- 分组：展开 -->
    <div class="prop-group">
      <div class="group-header" @click="groups.expand = !groups.expand">
        <span class="group-arrow">
          <DownOutlined v-if="groups.expand" />
          <RightOutlined v-else />
        </span>
        <span class="group-title">展开</span>
      </div>
      <div v-show="groups.expand" class="group-body">
        <div class="prop-row">
          <span class="prop-label">方向</span>
          <a-select v-model:value="expandValue" size="small" style="flex:1" @change="onExpandChange">
            <a-select-option value="none">不展开</a-select-option>
            <a-select-option value="down">向下</a-select-option>
            <a-select-option value="right">向右</a-select-option>
          </a-select>
        </div>
        <div class="prop-row">
          <span class="prop-label">左主格</span>
          <a-input
            v-model:value="leftMasterValue"
            allow-clear
            size="small"
            style="flex:1"
            :placeholder="autoLeftMaster ? `自动:${autoLeftMaster}` : '自动计算'"
            @blur="onLeftMasterChange"
            @pressEnter="onLeftMasterChange"
          />
          <a-tooltip :title="designer.masterPicking === 'left' ? '拾取中(点击单元格)' : '拾取单元格'">
            <a-button size="small" type="text" :class="{ active: designer.masterPicking === 'left' }" @click="startPickMaster('left')">
              <template #icon><AimOutlined /></template>
            </a-button>
          </a-tooltip>
        </div>
        <div class="prop-row">
          <span class="prop-label">上主格</span>
          <a-input
            v-model:value="topMasterValue"
            allow-clear
            size="small"
            style="flex:1"
            :placeholder="autoTopMaster ? `自动:${autoTopMaster}` : '自动计算'"
            @blur="onTopMasterChange"
            @pressEnter="onTopMasterChange"
          />
          <a-tooltip :title="designer.masterPicking === 'top' ? '拾取中(点击单元格)' : '拾取单元格'">
            <a-button size="small" type="text" :class="{ active: designer.masterPicking === 'top' }" @click="startPickMaster('top')">
              <template #icon><AimOutlined /></template>
            </a-button>
          </a-tooltip>
        </div>
      </div>
    </div>

    <!-- 分组：数据绑定 -->
    <div class="prop-group">
      <div class="group-header" @click="groups.data = !groups.data">
        <span class="group-arrow">
          <DownOutlined v-if="groups.data" />
          <RightOutlined v-else />
        </span>
        <span class="group-title">数据绑定</span>
      </div>
      <div v-show="groups.data" class="group-body">
        <div class="prop-row">
          <span class="prop-label">数据集</span>
          <a-select
            v-model:value="datasetValue"
            size="small"
            style="flex:1"
            placeholder="选择数据集"
            allowClear
            @change="onDatasetChange"
          >
            <a-select-option
              v-for="ds in report.currentTemplate?.dataSets ?? []"
              :key="ds.id"
              :value="ds.name"
            >{{ ds.name }}</a-select-option>
          </a-select>
        </div>
        <div class="prop-row">
          <span class="prop-label">字段</span>
          <a-select
            v-model:value="fieldValue"
            size="small"
            style="flex:1"
            placeholder="选择字段"
            allowClear
            @change="onDataChange"
          >
            <a-select-option
              v-for="field in selectedDatasetFields"
              :key="field"
              :value="field"
            >{{ field }}</a-select-option>
          </a-select>
        </div>
        <div class="prop-row">
          <span class="prop-label">聚合</span>
          <a-select v-model:value="aggregateValue" size="small" style="flex:1" @change="onDataChange">
            <a-select-option value="none">无</a-select-option>
            <a-select-option value="sum">求和</a-select-option>
            <a-select-option value="avg">平均</a-select-option>
            <a-select-option value="count">计数</a-select-option>
            <a-select-option value="max">最大</a-select-option>
            <a-select-option value="min">最小</a-select-option>
            <a-select-option value="group">分组</a-select-option>
            <a-select-option value="distinct">去重</a-select-option>
          </a-select>
        </div>
      </div>
    </div>

    <!-- 分组：规则 -->
    <div class="prop-group">
      <div class="group-header" @click="groups.advanced = !groups.advanced">
        <span class="group-arrow">
          <DownOutlined v-if="groups.advanced" />
          <RightOutlined v-else />
        </span>
        <span class="group-title">规则</span>
        <span v-if="currentCellName" class="group-title-actions" @click.stop>
          <a-tooltip title="新增规则">
            <a-button size="small" type="text" class="icon-action-btn" @click.stop="openCreateCellRule">
              <template #icon><PlusOutlined /></template>
            </a-button>
          </a-tooltip>
        </span>
      </div>
      <div v-show="groups.advanced" class="group-body">
        <div v-if="cellConditionFormats.length" class="cell-cond-cards">
          <a-card v-for="fmt in cellConditionFormats" :key="fmt.id" size="small" class="cell-cond-card">
            <template #title>{{ fmt.name }}</template>
            <template #extra>
              <a-space size="small">
                <a-button size="small" type="text" class="icon-action-btn" @click="openEditCellRule(fmt.id)">
                  <template #icon><EditOutlined /></template>
                </a-button>
                <a-button size="small" type="text" danger class="icon-action-btn" @click="removeCellRule(fmt.id)">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </a-space>
            </template>
            <div class="cell-rule-grid">
              <div class="cell-rule-item"><span class="rule-key">范围</span><span class="rule-val">{{ formatScopeDisplay(fmt) }}</span></div>
              <div class="cell-rule-item"><span class="rule-key">类型</span><span class="rule-val">{{ formatRuleType(fmt) }}</span></div>
              <div class="cell-rule-item"><span class="rule-key">条件</span><span class="rule-val">{{ formatRuleSummary(fmt) }}</span></div>
              <div class="cell-rule-item"><span class="rule-key">字体色</span><span class="rule-val color-chip-wrap"><span class="color-chip" :style="{ background: primaryRuleStyle(fmt).color || '#000000' }"></span>{{ primaryRuleStyle(fmt).color || '-' }}</span></div>
              <div class="cell-rule-item"><span class="rule-key">背景</span><span class="rule-val color-chip-wrap"><span class="color-chip" :style="{ background: primaryRuleStyle(fmt).background || '#ffffff' }"></span>{{ primaryRuleStyle(fmt).background || '-' }}</span></div>
              <div class="cell-rule-item"><span class="rule-key">加粗</span><span class="rule-val">{{ primaryRuleStyle(fmt).bold ? '是' : '否' }}</span></div>
            </div>
            <div class="rule-preview-strip" :style="rulePreviewStyle(fmt)">预览 Preview 123</div>
          </a-card>
        </div>
        <div v-else-if="currentCellName" class="cond-tip">当前单元格暂无规则，点击“新增”可快速创建</div>
      </div>
    </div>

    <ConditionDialog
      v-model:visible="showCondDialog"
      :target-cell="currentCellName"
      :default-current-cell-only="true"
      :prefill-scope="currentRuleScope"
      :initial-edit-format-id="editingCellRuleId"
    />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { DownOutlined, RightOutlined, EditOutlined, DeleteOutlined, AimOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { useReportStore } from '@/stores/report'
import { useDesignerStore } from '@/stores/designer'
import { useHistoryStore } from '@/stores/history'
import { colIndexToName, type CellType } from '@/core/cell/types'
import { getDatasetFieldOptions, normalizeFieldValueForDataset, datasetVarOfCell } from './propertyBindingHelpers'
import ConditionDialog from './ConditionDialog.vue'
import type { ConditionFormat } from '@/types'

const report = useReportStore()
const designer = useDesignerStore()
const history = useHistoryStore()

const emit = defineEmits<{
  (e: 'reconfigure'): void
}>()

const showCondDialog = ref(false)
const editingCellRuleId = ref<string | undefined>(undefined)

/** 分组折叠状态（默认全展开） */
const groups = reactive({
  cell: true,
  special: true,
  content: true,
  expand: true,
  data: true,
  advanced: true
})

const currentCell = computed(() => {
  if (!report.grid) return null
  return report.grid.getRealCell(designer.selection.startRow, designer.selection.startCol)
})

const currentCellName = computed(() => currentCell.value?.name ?? '')
/** 当前单元格若为数据集变量，返回 `dataset.field`（含内容回退解析），否则 null */
const currentDatasetVar = computed(() => datasetVarOfCell(currentCell.value))
const currentRuleScope = computed(() => {
  const cell = currentCell.value
  if (!cell) return undefined
  const dsVar = currentDatasetVar.value
  if (dsVar) {
    return `var:${dsVar}`
  }
  return cell.name
})

const cellConditionFormats = computed(() => {
  const name = currentCellName.value
  if (!name) return []
  const formats = report.currentTemplate?.conditionFormats ?? []
  return formats.filter((fmt) => inConditionScope(fmt.scope, name))
})

function openCreateCellRule() {
  editingCellRuleId.value = undefined
  showCondDialog.value = true
}

function openEditCellRule(formatId: string) {
  editingCellRuleId.value = formatId
  showCondDialog.value = true
}

function removeCellRule(formatId: string) {
  if (!report.currentTemplate) return
  history.pushHistory()
  report.currentTemplate.conditionFormats = report.currentTemplate.conditionFormats.filter((f) => f.id !== formatId)
  report.markDirty()
}

function formatRuleSummary(fmt: ConditionFormat): string {
  const rule = fmt.rules[0]
  if (!rule) return '-'
  if (rule.type === 'expression') return rule.expression || '表达式规则'
  if (rule.operator === 'between' && Array.isArray(rule.value)) {
    return `between ${rule.value[0]} ~ ${rule.value[1]}`
  }
  return `${rule.operator ?? ''} ${String(rule.value ?? '')}`.trim()
}

function formatRuleType(fmt: ConditionFormat): string {
  const rule = fmt.rules[0]
  if (!rule) return '-'
  return rule.type === 'expression' ? '公式' : '单元格值'
}

function primaryRuleStyle(fmt: ConditionFormat) {
  return fmt.rules[0]?.style ?? {}
}

function formatScopeDisplay(fmt: ConditionFormat): string {
  if (fmt.scope.startsWith('var:')) {
    return `${fmt.scope.slice(4)} (随数据集自动适配)`
  }
  // 当前单元格为数据集变量时，单格坐标规则也按变量展示（随数据量自动适配），
  // 避免展示固定坐标。
  const dsVar = currentDatasetVar.value
  if (dsVar && fmt.scope === currentCellName.value) {
    return `${dsVar} (随数据集自动适配)`
  }
  return fmt.scope
}

function rulePreviewStyle(fmt: ConditionFormat): Record<string, string> {
  const s = primaryRuleStyle(fmt)
  return {
    color: (s.color as string) || '#1f2329',
    background: (s.background as string) || '#f5f5f5',
    fontWeight: s.bold ? '700' : '400'
  }
}

watch(showCondDialog, (v) => {
  if (!v) editingCellRuleId.value = undefined
})

/** 当前单元格类型中文标签 */
const cellTypeLabel = computed(() => typeLabel(currentCell.value?.cellType))

/** 是否为特殊配置单元格(图片/二维码/条码/图表) */
const hasSpecialConfig = computed(() => {
  const t = currentCell.value?.cellType
  return t === 'image' || t === 'qrcode' || t === 'barcode' || t === 'chart'
})

/** 特殊配置分组标题 */
const specialConfigTitle = computed(() => {
  const t = currentCell.value?.cellType
  if (t === 'image') return '图片配置'
  if (t === 'qrcode') return '二维码配置'
  if (t === 'barcode') return '条码配置'
  if (t === 'chart') return '图表配置'
  return '配置'
})

/** 图表类型中文标签 */
const chartTypeLabel = computed(() => {
  const t = currentCell.value?.chartConfig?.type
  const map: Record<string, string> = {
    bar: '柱状图', line: '折线图', area: '面积图', pie: '饼图',
    radar: '雷达图', scatter: '散点图', funnel: '漏斗图'
  }
  return map[t ?? ''] ?? t ?? '-'
})

function typeLabel(t: CellType | undefined): string {
  const map: Record<string, string> = {
    text: '文本', formula: '公式', image: '图片',
    qrcode: '二维码', barcode: '条码', chart: '图表'
  }
  return map[t ?? 'text'] ?? '文本'
}

/** 清除特殊类型,恢复为文本单元格 */
function clearSpecialType() {
  if (!currentCell.value || !report.grid) return
  history.pushHistory()
  currentCell.value.cellType = 'text'
  currentCell.value.imageConfig = undefined
  currentCell.value.qrConfig = undefined
  currentCell.value.barcodeConfig = undefined
  currentCell.value.chartConfig = undefined
  currentCell.value.content = ''
  report.markDirty()
}

// 属性值
const contentValue = ref('')
const expandValue = ref<'none' | 'down' | 'right'>('none')
const leftMasterValue = ref('')
const topMasterValue = ref('')
const datasetValue = ref<string | undefined>(undefined)
const fieldValue = ref('')
const aggregateValue = ref('none')
const rowHeightValue = ref<number>(28)
const colWidthValue = ref<number>(80)

/** 当前所选数据集的字段列表 */
const selectedDatasetFields = computed<string[]>(() => {
  return getDatasetFieldOptions(report.currentTemplate, datasetValue.value)
})

/** 自动计算的左主格（用于占位提示） */
const autoLeftMaster = computed(() => autoCalcMaster('left'))
/** 自动计算的上主格（用于占位提示） */
const autoTopMaster = computed(() => autoCalcMaster('top'))

watch(
  () => [
    currentCell.value?.id,
    currentCell.value?.content,
    currentCell.value?.expandDirection,
    currentCell.value?.leftMasterCell,
    currentCell.value?.topMasterCell,
    currentCell.value?.dataset,
    currentCell.value?.fieldName,
    currentCell.value?.aggregate,
    designer.selection.startRow,
    designer.selection.startCol
  ],
  () => {
    const cell = currentCell.value
    if (!cell) return
    contentValue.value = cell.content
    expandValue.value = cell.expandDirection
    leftMasterValue.value = cell.leftMasterCell ?? ''
    topMasterValue.value = cell.topMasterCell ?? ''
    datasetValue.value = cell.dataset
    fieldValue.value = cell.fieldName ?? ''
    aggregateValue.value = cell.aggregate ?? 'none'
    // 同步行高/列宽
    if (report.grid) {
      rowHeightValue.value = report.grid.rows[designer.selection.startRow]?.height ?? 28
      colWidthValue.value = report.grid.columns[designer.selection.startCol]?.width ?? 80
    }
    // 主格输入框只展示用户真实配置；自动值仅在 placeholder 提示。
  },
  { immediate: true }
)

function onContentChange() {
  if (!currentCell.value || !report.grid) return
  history.pushHistory()
  report.grid.setCellContent(currentCell.value.row, currentCell.value.col, contentValue.value)
  report.markDirty()
}

/** 修改当前行高 */
function onRowHeightChange() {
  if (!report.grid) return
  history.pushHistory()
  const row = designer.selection.startRow
  if (report.grid.rows[row]) {
    report.grid.rows[row].height = rowHeightValue.value
    report.markDirty()
  }
}

/** 修改当前列宽 */
function onColWidthChange() {
  if (!report.grid) return
  history.pushHistory()
  const col = designer.selection.startCol
  if (report.grid.columns[col]) {
    report.grid.columns[col].width = colWidthValue.value
    report.markDirty()
  }
}

/**
 * 自动计算主格:
 * - 向下展开时,左主格 = 同行左侧最近的"向下展开"单元格
 * - 向右展开时,上主格 = 同列上方最近的"向右展开"单元格
 */
function autoCalcMaster(which: 'left' | 'top'): string {
  if (!report.grid || !currentCell.value) return ''
  const cur = currentCell.value
  if (which === 'left' && cur.expandDirection === 'down') {
    // 向左查找同行的向下展开单元格
    for (let c = cur.col - 1; c >= 0; c--) {
      const cell = report.grid.getRealCell(cur.row, c)
      if (cell && cell.expandDirection === 'down') {
        return colIndexToName(cell.col) + (cell.row + 1)
      }
    }
  }
  if (which === 'top' && cur.expandDirection === 'right') {
    // 向上查找同列的向右展开单元格
    for (let r = cur.row - 1; r >= 0; r--) {
      const cell = report.grid.getRealCell(r, cur.col)
      if (cell && cell.expandDirection === 'right') {
        return colIndexToName(cell.col) + (cell.row + 1)
      }
    }
  }
  return ''
}

/** 启动主格拾取模式 */
function startPickMaster(which: 'left' | 'top') {
  // 再次点击同一按钮则取消拾取
  if (designer.masterPicking === which) {
    designer.masterPicking = null
    return
  }
  designer.masterPicking = which
  designer.pickedMasterCell = null
}

/** 左主格输入变更 */
function onLeftMasterChange() {
  if (!currentCell.value) return
  const next = leftMasterValue.value.trim()
  if ((currentCell.value.leftMasterCell ?? '') === next) return
  history.pushHistory()
  currentCell.value.leftMasterCell = next || undefined
  leftMasterValue.value = next
  report.markDirty()
}

/** 上主格输入变更 */
function onTopMasterChange() {
  if (!currentCell.value) return
  const next = topMasterValue.value.trim()
  if ((currentCell.value.topMasterCell ?? '') === next) return
  history.pushHistory()
  currentCell.value.topMasterCell = next || undefined
  topMasterValue.value = next
  report.markDirty()
}

/** 监听画布拾取结果 */
watch(
  () => designer.pickedMasterCell,
  (picked) => {
    if (!picked) return
    if (designer.masterPicking === 'left') {
      leftMasterValue.value = picked
      onLeftMasterChange()
    } else if (designer.masterPicking === 'top') {
      topMasterValue.value = picked
      onTopMasterChange()
    }
    // 拾取完成,退出拾取模式
    designer.masterPicking = null
    designer.pickedMasterCell = null
  }
)

/** 展开方向变化时重新计算主格 */
function onExpandChange() {
  if (!currentCell.value) return
  history.pushHistory()
  currentCell.value.expandDirection = expandValue.value
  // 退出拾取模式
  designer.masterPicking = null
  report.markDirty()
}

function onDataChange() {
  if (!currentCell.value) return
  history.pushHistory()
  currentCell.value.dataset = datasetValue.value
  currentCell.value.fieldName = fieldValue.value || undefined
  currentCell.value.aggregate = aggregateValue.value as any
  report.markDirty()
}

/** 数据集切换后，字段只允许选择该数据集下可用字段 */
function onDatasetChange() {
  fieldValue.value = normalizeFieldValueForDataset(fieldValue.value, selectedDatasetFields.value)
  onDataChange()
}

function inConditionScope(scope: string, cellName: string): boolean {
  if (!scope || !cellName) return false
  if (scope.startsWith('var:')) {
    const cell = currentCell.value
    if (!cell?.dataset || !cell.fieldName) return false
    return scope === `var:${cell.dataset}.${cell.fieldName}`
  }
  if (!scope.includes(':')) return scope === cellName
  const [start, end] = scope.split(':')
  const cur = parseCellName(cellName)
  const s = parseCellName(start)
  const e = parseCellName(end)
  if (!cur || !s || !e) return false
  return cur.row >= Math.min(s.row, e.row) &&
    cur.row <= Math.max(s.row, e.row) &&
    cur.col >= Math.min(s.col, e.col) &&
    cur.col <= Math.max(s.col, e.col)
}

function parseCellName(name: string): { row: number; col: number } | null {
  const m = name.match(/^([A-Za-z]+)(\d+)$/)
  if (!m) return null
  let col = 0
  const upper = m[1].toUpperCase()
  for (let i = 0; i < upper.length; i++) {
    col = col * 26 + (upper.charCodeAt(i) - 64)
  }
  return { row: Number(m[2]) - 1, col: col - 1 }
}
</script>

<style scoped>
.property-panel {
  height: 100%;
  overflow-y: auto;
  background: #fff;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid #e8e8e8;
  background: #fafafa;
  flex-shrink: 0;
}

.panel-tab {
  padding: 8px 16px;
  font-size: 13px;
  color: #595959;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.panel-tab.active {
  color: #1677ff;
  border-bottom-color: #1677ff;
  font-weight: 500;
  background: #fff;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.prop-group {
  border-bottom: 1px solid #f0f0f0;
}

.group-header {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.group-header:hover {
  background: #f5f5f5;
}

.group-arrow {
  font-size: 10px;
  color: #999;
  margin-right: 6px;
  width: 12px;
  display: inline-flex;
}

.group-title {
  font-size: 13px;
  font-weight: 500;
  color: #1f2329;
}

.group-title-actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
}

.group-body {
  padding: 4px 10px 6px;
}

/* 只读属性:两列网格布局 */
.prop-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 8px;
}

.prop-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 22px;
}

/* 操作按钮:横向并排 */
.prop-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.prop-actions :deep(.ant-btn) {
  flex: 1;
}

.prop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  min-height: 28px;
}

.prop-row:last-child {
  margin-bottom: 0;
}

.prop-label {
  font-size: 12px;
  color: #8c8c8c;
  width: auto;
  flex-shrink: 0;
  text-align: right;
}

.prop-value {
  font-size: 12px;
  color: #1f2329;
  font-family: Consolas, monospace;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prop-value.ellipsis {
  max-width: 100%;
}

.cond-tip {
  margin-top: 4px;
  font-size: 12px;
  color: #888;
  text-align: center;
}

.cell-cond-title {
  margin-top: 6px;
  font-size: 12px;
  color: #595959;
  font-weight: 600;
}

.icon-action-btn {
  width: 24px;
  min-width: 24px;
  padding: 0;
}

.cell-cond-cards {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cell-cond-card :deep(.ant-card-head) {
  min-height: 34px;
  padding: 0 10px;
}

.cell-cond-card :deep(.ant-card-body) {
  padding: 8px 10px;
}

.cell-rule-line {
  font-size: 12px;
  color: #595959;
  line-height: 1.5;
}

.rule-preview-strip {
  margin-top: 8px;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  border: 1px solid #d9d9d9;
}

.cell-rule-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
}

.cell-rule-item {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.rule-key {
  color: #8c8c8c;
  font-size: 12px;
  flex-shrink: 0;
}

.rule-val {
  color: #1f2329;
  font-size: 12px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-chip-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.color-chip {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1px solid #d9d9d9;
  flex-shrink: 0;
}

.property-panel :deep(.ant-radio-group) {
  flex: 1;
}

.property-panel :deep(.ant-radio-button-wrapper) {
  flex: 1;
  text-align: center;
}

.property-panel :deep(.ant-checkbox) {
  font-size: 12px;
}
</style>
