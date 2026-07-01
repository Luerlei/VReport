<template>
  <div class="parameter-form">
    <a-form layout="inline" :model="formState">
      <a-form-item v-for="p in params" :key="p.id" :label="p.label" :required="p.required">
        <a-input
          v-if="p.type === 'string'"
          v-model:value="formState[p.name]"
          :placeholder="`请输入${p.label}`"
          style="width: 160px"
        />
        <a-input-number
          v-else-if="p.type === 'number'"
          v-model:value="formState[p.name]"
          style="width: 160px"
        />
        <a-date-picker
          v-else-if="p.type === 'date'"
          v-model:value="formState[p.name]"
          style="width: 160px"
        />
        <a-select
          v-else-if="p.type === 'select'"
          v-model:value="formState[p.name]"
          :options="p.options"
          allowClear
          style="width: 160px"
        />
        <a-select
          v-else-if="p.type === 'multiSelect'"
          v-model:value="formState[p.name]"
          :options="p.options"
          mode="multiple"
          allowClear
          style="width: 200px"
        />
        <a-input v-else v-model:value="formState[p.name]" style="width: 160px" />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" @click="onQuery">查询</a-button>
        <a-button style="margin-left: 8px" @click="onReset">重置</a-button>
      </a-form-item>
    </a-form>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import type { Parameter } from '@/types'
import { ParameterEngine } from '@/core/parameter/ParameterEngine'

const props = defineProps<{
  params: Parameter[]
  modelValue?: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'query', values: Record<string, unknown>): void
  (e: 'update:modelValue', values: Record<string, unknown>): void
}>()

const formState = reactive<Record<string, unknown>>(ParameterEngine.getDefaultValues(props.params))

watch(
  () => props.params,
  () => {
    Object.assign(formState, ParameterEngine.getDefaultValues(props.params))
  }
)

function normalizeValue(p: Parameter, value: unknown): unknown {
  if (p.type === 'date') {
    // Dayjs 对象统一转为 YYYY-MM-DD 字符串,再参与过滤
    if (value && typeof value === 'object' && 'format' in value && typeof (value as any).format === 'function') {
      return (value as any).format('YYYY-MM-DD')
    }
    if (typeof value === 'string') return value.slice(0, 10)
  }
  return value
}

function getNormalizedValues(): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const p of props.params) {
    result[p.name] = normalizeValue(p, formState[p.name])
  }
  return result
}

function onQuery() {
  const values = getNormalizedValues()
  emit('update:modelValue', values)
  emit('query', values)
}

function onReset() {
  Object.assign(formState, ParameterEngine.getDefaultValues(props.params))
  onQuery()
}
</script>

<style scoped>
.parameter-form {
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
}
</style>
