<template>
  <a-modal
    v-model:open="visible"
    :title="dialogTitle"
    :width="directEditor ? '560px' : '720px'"
    :footer="directEditor || ruleDialogVisible ? undefined : null"
    @ok="directEditor || ruleDialogVisible ? saveRule() : undefined"
    @cancel="onClose"
  >
    <template v-if="!directEditor && !ruleDialogVisible">
      <div class="cond-header">
        <a-button type="primary" size="small" @click="openRuleDialog">+ 新建规则</a-button>
        <a-checkbox v-if="targetCell" v-model:checked="currentCellOnly">仅显示当前单元格({{ targetCell }})</a-checkbox>
      </div>
      <a-list :data-source="visibleFormats" :locale="{ emptyText: currentCellOnly ? '当前单元格暂无规则' : '暂无条件格式规则' }">
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta :title="item.name" :description="`范围：${item.scope}，规则数：${item.rules.length}`" />
            <template #actions>
              <a-button size="small" type="link" @click="editFormat(item)">编辑</a-button>
              <a-button size="small" type="link" danger @click="removeFormat(item.id)">删除</a-button>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </template>

    <template v-if="directEditor || ruleDialogVisible">
      <a-form layout="vertical">
        <a-form-item label="名称" required>
          <a-input v-model:value="ruleForm.name" placeholder="如 高亮高分" />
        </a-form-item>
        <a-form-item label="应用范围" required>
          <a-input v-model:value="ruleForm.scope" :disabled="isVariableScope(ruleForm.scope)" :placeholder="scopePlaceholder" />
          <div class="scope-tip" v-if="isVariableScope(ruleForm.scope)">数据集变量规则范围随数据量自动适配，不允许手动填写坐标</div>
          <div v-else class="scope-presets">
            <a-button size="small" @click="applyScopePreset('cell')">当前单元格</a-button>
            <a-button size="small" @click="applyScopePreset('row')">当前行</a-button>
            <a-button size="small" @click="applyScopePreset('col')">当前列</a-button>
            <a-button size="small" @click="applyScopePreset('selection')">当前选区</a-button>
          </div>
        </a-form-item>
        <a-form-item label="规则类型">
          <a-radio-group v-model:value="ruleForm.type">
            <a-radio value="cellValue">单元格值</a-radio>
            <a-radio value="expression">公式</a-radio>
          </a-radio-group>
        </a-form-item>
        <template v-if="ruleForm.type === 'cellValue'">
          <a-form-item label="运算符">
            <a-select v-model:value="ruleForm.operator">
              <a-select-option value="gt">大于</a-select-option>
              <a-select-option value="lt">小于</a-select-option>
              <a-select-option value="eq">等于</a-select-option>
              <a-select-option value="ne">不等于</a-select-option>
              <a-select-option value="ge">大于等于</a-select-option>
              <a-select-option value="le">小于等于</a-select-option>
              <a-select-option value="contains">包含</a-select-option>
              <a-select-option value="between">区间</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="值">
            <a-input v-model:value="ruleForm.value" :placeholder="ruleForm.operator === 'between' ? '最小值,最大值 例如 70,80' : '比较值'" />
          </a-form-item>
        </template>
        <template v-else>
          <a-form-item label="表达式">
            <a-input v-model:value="ruleForm.expression" placeholder="如 =${score}>90" />
          </a-form-item>
        </template>
        <a-form-item label="命中样式">
          <a-space>
            <span>字体色：</span>
            <input type="color" v-model="ruleForm.color" />
            <span>背景：</span>
            <input type="color" v-model="ruleForm.background" />
            <a-checkbox v-model:checked="ruleForm.bold">加粗</a-checkbox>
          </a-space>
        </a-form-item>
      </a-form>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useReportStore } from '@/stores/report'
import { useDesignerStore } from '@/stores/designer'
import { uid } from '@/utils/id'
import type { ConditionFormat } from '@/types'
import { colIndexToName } from '@/core/cell/types'

const props = defineProps<{
  visible: boolean
  targetCell?: string
  defaultCurrentCellOnly?: boolean
  prefillScope?: string
  initialEditFormatId?: string
}>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>()

const report = useReportStore()
const designer = useDesignerStore()
const formats = computed(() => report.currentTemplate?.conditionFormats ?? [])
const targetCell = computed(() => props.targetCell ?? '')
const directEditor = computed(() => !!props.prefillScope)
const scopePlaceholder = computed(() => {
  return isVariableScope(ruleForm.value.scope) ? '变量范围自动适配' : '如 A1:A10 或 B2'
})
const currentCellOnly = ref(!!props.defaultCurrentCellOnly)
const dialogTitle = computed(() => {
  if (directEditor.value) return editing.value ? '编辑规则' : '新增规则'
  if (ruleDialogVisible.value) return editing.value ? '编辑规则' : '新建规则'
  return '条件格式管理'
})
const visibleFormats = computed(() => {
  if (!currentCellOnly.value || !targetCell.value) return formats.value
  return formats.value.filter((f) => inScope(f.scope, targetCell.value))
})

const visible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v)
})

watch(
  () => props.visible,
  (v) => {
    if (!v) return
    currentCellOnly.value = !!props.defaultCurrentCellOnly
    if (props.initialEditFormatId) {
      const target = formats.value.find((f) => f.id === props.initialEditFormatId)
      if (target) {
        editFormat(target)
        return
      }
    }
    if (directEditor.value) {
      openRuleDialog()
    }
  }
)

function onClose() {
  ruleDialogVisible.value = false
  editing.value = null
  emit('update:visible', false)
}

// 规则编辑
const ruleDialogVisible = ref(false)
const editing = ref<ConditionFormat | null>(null)
const ruleForm = ref({
  name: '',
  scope: '',
  type: 'cellValue' as 'cellValue' | 'expression',
  operator: 'gt' as 'gt' | 'lt' | 'eq' | 'ne' | 'ge' | 'le' | 'contains' | 'between',
  value: '',
  expression: '',
  color: '#ff0000',
  background: '#ffffff',
  bold: false
})

function openRuleDialog() {
  editing.value = null
  ruleForm.value = {
    name: '',
    scope: props.prefillScope || targetCell.value || '',
    type: 'cellValue',
    operator: 'gt',
    value: '',
    expression: '',
    color: '#ff0000',
    background: '#ffffff',
    bold: false
  }
  ruleDialogVisible.value = true
}

function isVariableScope(scope: string): boolean {
  return scope.startsWith('var:')
}

function applyScopePreset(kind: 'cell' | 'row' | 'col' | 'selection') {
  if (!report.grid) return
  const s = designer.selection
  if (kind === 'cell') {
    ruleForm.value.scope = `${colIndexToName(s.startCol)}${s.startRow + 1}`
    return
  }
  if (kind === 'row') {
    const start = `A${s.startRow + 1}`
    const end = `${colIndexToName(report.grid.colCount - 1)}${s.startRow + 1}`
    ruleForm.value.scope = `${start}:${end}`
    return
  }
  if (kind === 'col') {
    const col = colIndexToName(s.startCol)
    ruleForm.value.scope = `${col}1:${col}${report.grid.rowCount}`
    return
  }
  const r1 = Math.min(s.startRow, s.endRow)
  const r2 = Math.max(s.startRow, s.endRow)
  const c1 = Math.min(s.startCol, s.endCol)
  const c2 = Math.max(s.startCol, s.endCol)
  ruleForm.value.scope = `${colIndexToName(c1)}${r1 + 1}:${colIndexToName(c2)}${r2 + 1}`
}

function editFormat(f: ConditionFormat) {
  editing.value = f
  const rule = f.rules[0]
  // 若当前目标单元格是数据集变量，范围强制随变量自动适配（忽略旧的固定坐标 scope）
  const variableScope =
    props.prefillScope && props.prefillScope.startsWith('var:') ? props.prefillScope : ''
  ruleForm.value = {
    name: f.name,
    scope: variableScope || f.scope,
    type: rule?.type ?? 'cellValue',
    operator: (rule?.operator ?? 'gt') as any,
    value: Array.isArray(rule?.value) ? rule.value.join(',') : String(rule?.value ?? ''),
    expression: rule?.expression ?? '',
    color: rule?.style?.color ?? '#ff0000',
    background: rule?.style?.background ?? '#ffffff',
    bold: rule?.style?.bold ?? false
  }
  ruleDialogVisible.value = true
}

function saveRule() {
  if (!report.currentTemplate) return
  if (!ruleForm.value.name || !ruleForm.value.scope) {
    message.warning('请填写名称和范围')
    return
  }
  let ruleValue: unknown = ruleForm.value.value
  if (ruleForm.value.type === 'cellValue' && ruleForm.value.operator === 'between') {
    const pair = String(ruleForm.value.value)
      .split(/[，,]/)
      .map((v) => Number(v.trim()))
      .filter((v) => !Number.isNaN(v))
    if (pair.length !== 2) {
      message.warning('between 的值请填写为 "最小值,最大值"')
      return
    }
    ruleValue = [pair[0], pair[1]]
  }
  const style = {
    color: ruleForm.value.color,
    background: ruleForm.value.background,
    bold: ruleForm.value.bold
  }
  const rule = {
    id: uid('rule_'),
    type: ruleForm.value.type,
    operator: ruleForm.value.operator as any,
    value: ruleValue,
    expression: ruleForm.value.expression,
    style
  }
  if (editing.value) {
    editing.value.name = ruleForm.value.name
    editing.value.scope = ruleForm.value.scope
    editing.value.rules = [rule]
  } else {
    const fmt: ConditionFormat = {
      id: uid('cf_'),
      name: ruleForm.value.name,
      scope: ruleForm.value.scope,
      rules: [rule]
    }
    report.currentTemplate.conditionFormats.push(fmt)
  }
  report.markDirty()
  ruleDialogVisible.value = false
  if (directEditor.value) {
    emit('update:visible', false)
  }
  message.success('已保存')
}

function removeFormat(id: string) {
  if (!report.currentTemplate) return
  report.currentTemplate.conditionFormats = report.currentTemplate.conditionFormats.filter((f) => f.id !== id)
  report.markDirty()
}

function inScope(scope: string, cellName: string): boolean {
  if (!scope || !cellName) return false
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
  for (let i = 0; i < upper.length; i++) col = col * 26 + (upper.charCodeAt(i) - 64)
  return { row: Number(m[2]) - 1, col: col - 1 }
}
</script>

<style scoped>
.cond-header {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.scope-presets {
  margin-top: 6px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.scope-tip {
  margin-top: 6px;
  color: #8c8c8c;
  font-size: 12px;
}
</style>
