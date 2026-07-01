<template>
  <div class="param-panel">
    <!-- 使用说明 -->
    <a-alert
      v-if="!params.length"
      type="info"
      show-icon
      banner
      message="参数用于预览时筛选数据或在公式中引用"
      description="1. 参数名与数据集字段名相同时，预览自动按参数值过滤数据行。 2. 公式中用 ${param.参数名} 引用参数值，如 =if(${param.minAmount}>0, ${param.minAmount}, 0)"
      style="margin-bottom: 8px; font-size: 12px"
    />

    <div class="section-header">
      <span class="section-title">报表参数</span>
      <a-button size="small" type="link" @click="openDialog">
        <template #icon><PlusOutlined /></template>新建
      </a-button>
    </div>
    <a-list size="small" :data-source="params" :locale="{ emptyText: '暂无参数，点击新建添加' }">
      <template #renderItem="{ item }">
        <a-list-item class="list-item">
          <a-list-item-meta>
            <template #title>
              <span>{{ item.name }}</span>
              <a-tag v-if="item.required" color="red" size="small" style="margin-left:6px">必填</a-tag>
            </template>
            <template #description>
              {{ item.label }} ·
              <a-tag size="small">{{ typeLabel(item.type) }}</a-tag>
              <span v-if="item.defaultValue" class="default-val">默认：{{ item.defaultValue }}</span>
            </template>
          </a-list-item-meta>
          <template #actions>
            <a-tooltip title="编辑">
              <a-button size="small" type="text" @click="editParam(item)">
                <template #icon><EditOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="删除">
              <a-button size="small" type="text" danger @click="removeParam(item.id)">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </template>
        </a-list-item>
      </template>
    </a-list>

    <a-modal v-model:open="showDialog" :title="editing ? '编辑参数' : '新建参数'" @ok="saveParam" width="480px">
      <a-form layout="vertical">
        <a-form-item label="参数名" required>
          <a-input v-model:value="form.name" placeholder="如 region，与数据集字段同名可自动筛选" />
        </a-form-item>
        <a-form-item label="标签" required>
          <a-input v-model:value="form.label" placeholder="显示文字，如 区域" />
        </a-form-item>
        <a-form-item label="类型">
          <a-select v-model:value="form.type">
            <a-select-option value="string">字符串</a-select-option>
            <a-select-option value="number">数字</a-select-option>
            <a-select-option value="date">日期</a-select-option>
            <a-select-option value="datetime">日期时间</a-select-option>
            <a-select-option value="select">下拉单选</a-select-option>
            <a-select-option value="multiSelect">下拉多选</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="默认值">
          <a-input v-model:value="form.defaultValue" placeholder="预览初始值，留空表示展示全部" />
        </a-form-item>
        <a-form-item>
          <a-checkbox v-model:checked="form.required">必填</a-checkbox>
        </a-form-item>
        <template v-if="form.type === 'select' || form.type === 'multiSelect'">
          <a-form-item label="下拉选项（每行一个，格式：值|标签）">
            <a-textarea
              v-model:value="optionsText"
              :rows="4"
              placeholder="1|部门一&#10;2|部门二"
            />
          </a-form-item>
        </template>
        <a-divider />
        <div class="param-tip">
          <p><strong>使用方式：</strong></p>
          <p>1. <strong>数据筛选</strong>：参数名与数据集字段名相同（如 region），预览时自动按参数值过滤数据行。默认值留空表示展示全部。</p>
          <p>2. <strong>公式引用</strong>：在单元格公式中用 <code>${param.参数名}</code> 引用，如 <code>=if(${param.minAmount}&gt;0, "达标", "未达标")</code></p>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { useReportStore } from '@/stores/report'
import { uid } from '@/utils/id'
import type { Parameter, ParamType } from '@/types'

const report = useReportStore()
const params = computed(() => report.currentTemplate?.parameters ?? [])

const showDialog = ref(false)
const editing = ref<Parameter | null>(null)
const optionsText = ref('')
const form = ref<{
  name: string
  label: string
  type: ParamType
  defaultValue: string
  required: boolean
}>({
  name: '',
  label: '',
  type: 'string',
  defaultValue: '',
  required: false
})

function typeLabel(t: ParamType): string {
  const map: Record<ParamType, string> = {
    string: '字符串',
    number: '数字',
    date: '日期',
    datetime: '日期时间',
    select: '下拉单选',
    multiSelect: '下拉多选'
  }
  return map[t] ?? t
}

function openDialog() {
  editing.value = null
  form.value = { name: '', label: '', type: 'string', defaultValue: '', required: false }
  optionsText.value = ''
  showDialog.value = true
}

function editParam(p: Parameter) {
  editing.value = p
  form.value = {
    name: p.name,
    label: p.label,
    type: p.type,
    defaultValue: String(p.defaultValue ?? ''),
    required: p.required ?? false
  }
  optionsText.value = p.options?.map((o) => `${o.value}|${o.label}`).join('\n') ?? ''
  showDialog.value = true
}

function saveParam() {
  if (!report.currentTemplate) return
  if (!form.value.name || !form.value.label) {
    message.warning('请填写参数名和标签')
    return
  }
  const options = optionsText.value
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const [value, label] = line.split('|')
      return { value: value?.trim() ?? '', label: label?.trim() || value?.trim() || '' }
    })

  if (editing.value) {
    const p = editing.value
    p.name = form.value.name
    p.label = form.value.label
    p.type = form.value.type
    p.defaultValue = form.value.defaultValue || undefined
    p.required = form.value.required
    p.options = options.length ? options : undefined
  } else {
    const p: Parameter = {
      id: uid('param_'),
      name: form.value.name,
      label: form.value.label,
      type: form.value.type,
      defaultValue: form.value.defaultValue || undefined,
      required: form.value.required,
      options: options.length ? options : undefined
    }
    report.currentTemplate.parameters.push(p)
  }
  report.markDirty()
  showDialog.value = false
  message.success('已保存')
}

function removeParam(id: string) {
  if (!report.currentTemplate) return
  report.currentTemplate.parameters = report.currentTemplate.parameters.filter((p) => p.id !== id)
  report.markDirty()
}
</script>

<style scoped>
.param-panel {
  padding: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-title {
  font-size: 13px;
  font-weight: 500;
  color: #1f2329;
}

.list-item {
  padding: 6px 8px !important;
  border-bottom: 1px solid #f0f0f0 !important;
}

.default-val {
  color: #999;
  font-size: 12px;
  margin-left: 4px;
}

.param-tip {
  font-size: 12px;
  color: #666;
  background: #f6f8fa;
  padding: 8px 12px;
  border-radius: 4px;
  line-height: 1.8;
}

.param-tip p {
  margin: 0;
}

.param-tip code {
  background: #e8e8e8;
  padding: 1px 4px;
  border-radius: 2px;
  font-family: Consolas, monospace;
  color: #c41d7f;
}
</style>
