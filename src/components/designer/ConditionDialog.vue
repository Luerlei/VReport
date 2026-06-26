<template>
  <a-modal
    v-model:open="visible"
    title="条件格式管理"
    width="720px"
    :footer="null"
    @cancel="onClose"
  >
    <div class="cond-header">
      <a-button type="primary" size="small" @click="openRuleDialog">+ 新建规则</a-button>
    </div>
    <a-list :data-source="formats" :locale="{ emptyText: '暂无条件格式规则' }">
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

    <!-- 规则编辑子对话框 -->
    <a-modal v-model:open="ruleDialogVisible" :title="editing ? '编辑规则' : '新建规则'" @ok="saveRule" width="560px">
      <a-form layout="vertical">
        <a-form-item label="名称" required>
          <a-input v-model:value="ruleForm.name" placeholder="如 高亮高分" />
        </a-form-item>
        <a-form-item label="应用范围" required>
          <a-input v-model:value="ruleForm.scope" placeholder="如 A1:A10 或 B2" />
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
            </a-select>
          </a-form-item>
          <a-form-item label="值">
            <a-input v-model:value="ruleForm.value" placeholder="比较值" />
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
    </a-modal>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import { useReportStore } from '@/stores/report'
import { uid } from '@/utils/id'
import type { ConditionFormat } from '@/types'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>()

const report = useReportStore()
const formats = computed(() => report.currentTemplate?.conditionFormats ?? [])

const visible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v)
})

function onClose() {
  emit('update:visible', false)
}

// 规则编辑
const ruleDialogVisible = ref(false)
const editing = ref<ConditionFormat | null>(null)
const ruleForm = ref({
  name: '',
  scope: '',
  type: 'cellValue' as 'cellValue' | 'expression',
  operator: 'gt' as 'gt' | 'lt' | 'eq' | 'ne' | 'ge' | 'le' | 'contains',
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
    scope: '',
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

function editFormat(f: ConditionFormat) {
  editing.value = f
  const rule = f.rules[0]
  ruleForm.value = {
    name: f.name,
    scope: f.scope,
    type: rule?.type ?? 'cellValue',
    operator: (rule?.operator ?? 'gt') as any,
    value: String(rule?.value ?? ''),
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
  const style = {
    color: ruleForm.value.color,
    background: ruleForm.value.background,
    bold: ruleForm.value.bold
  }
  const rule = {
    id: uid('rule_'),
    type: ruleForm.value.type,
    operator: ruleForm.value.operator as any,
    value: ruleForm.value.value,
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
  message.success('已保存')
}

function removeFormat(id: string) {
  if (!report.currentTemplate) return
  report.currentTemplate.conditionFormats = report.currentTemplate.conditionFormats.filter((f) => f.id !== id)
  report.markDirty()
}
</script>

<style scoped>
.cond-header {
  margin-bottom: 12px;
}
</style>
