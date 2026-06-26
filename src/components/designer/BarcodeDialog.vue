<template>
  <a-modal
    :open="visible"
    title="插入条码"
    width="500px"
    :destroyOnClose="true"
    @ok="onOk"
    @cancel="onCancel"
  >
    <a-form layout="vertical">
      <a-form-item label="条码类型">
        <a-select v-model:value="form.format">
          <a-select-option value="CODE128">CODE128 (通用)</a-select-option>
          <a-select-option value="CODE39">CODE39</a-select-option>
          <a-select-option value="EAN13">EAN13 (13位)</a-select-option>
          <a-select-option value="EAN8">EAN8 (8位)</a-select-option>
          <a-select-option value="UPC">UPC</a-select-option>
          <a-select-option value="ITF14">ITF14</a-select-option>
          <a-select-option value="MSI">MSI</a-select-option>
          <a-select-option value="pharmacode">Pharmacode</a-select-option>
          <a-select-option value="codabar">Codabar</a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item label="数据内容">
        <a-input
          v-model:value="form.data"
          placeholder="静态文本,或 ${ds1.sku} / ${param.code} 表达式"
        />
        <div class="tip">支持 ${ds1.field} 引用数据集字段,${param.name} 引用参数</div>
      </a-form-item>

      <a-row :gutter="12">
        <a-col :span="8">
          <a-form-item label="宽度(px)">
            <a-input-number v-model:value="form.width" :min="40" :max="600" style="width: 100%" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="高度(px)">
            <a-input-number v-model:value="form.height" :min="20" :max="200" style="width: 100%" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="显示文本">
            <a-switch v-model:checked="form.displayValue" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="前景色">
            <div class="color-row">
              <input type="color" v-model="form.foreground" class="color-input" />
              <a-input v-model:value="form.foreground" size="small" style="flex: 1" />
            </div>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="背景色">
            <div class="color-row">
              <input type="color" v-model="form.background" class="color-input" />
              <a-input v-model:value="form.background" size="small" style="flex: 1" />
            </div>
          </a-form-item>
        </a-col>
      </a-row>

      <div class="preview-block">
        <div class="preview-title">预览</div>
        <svg ref="previewSvgRef" class="preview-svg"></svg>
      </div>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { reactive, ref, watch, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import JsBarcode from 'jsbarcode'
import type { BarcodeConfig } from '@/types'

const props = defineProps<{ visible: boolean; initial?: BarcodeConfig }>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'confirm', config: BarcodeConfig): void
}>()

const form = reactive<BarcodeConfig>({
  data: '',
  format: 'CODE128',
  width: 200,
  height: 60,
  displayValue: true,
  foreground: '#000000',
  background: '#ffffff'
})

const previewSvgRef = ref<SVGSVGElement | null>(null)

watch(
  () => props.visible,
  (v) => {
    if (v) {
      Object.assign(form, {
        data: '',
        format: 'CODE128',
        width: 200,
        height: 60,
        displayValue: true,
        foreground: '#000000',
        background: '#ffffff',
        ...(props.initial ?? {})
      })
      nextTick(renderPreview)
    }
  },
  { immediate: true }
)

watch(form, renderPreview, { deep: true })

function renderPreview() {
  const svg = previewSvgRef.value
  if (!svg) return
  const data = resolveForPreview(form.data)
  if (!data) {
    svg.innerHTML =
      '<text x="50%" y="50%" text-anchor="middle" fill="#999" font-size="12">请输入数据</text>'
    return
  }
  try {
    JsBarcode(svg, data, {
      format: form.format,
      width: 2,
      height: form.height,
      displayValue: form.displayValue,
      lineColor: form.foreground,
      background: form.background
    })
  } catch (e) {
    svg.innerHTML = `<text x="50%" y="50%" text-anchor="middle" fill="#ff4d4f" font-size="12">数据格式不符: ${(e as Error).message}</text>`
  }
}

function resolveForPreview(text: string): string {
  if (!text) return ''
  return text.replace(/\$\{[^}]+\}/g, '1234567890')
}

function onOk() {
  if (!form.data?.trim()) {
    message.warning('请填写条码数据内容')
    return
  }
  emit('confirm', { ...form })
  emit('update:visible', false)
}

function onCancel() {
  emit('update:visible', false)
}
</script>

<style scoped>
.tip {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.color-input {
  width: 32px;
  height: 28px;
  padding: 0;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  cursor: pointer;
  background: none;
}

.preview-block {
  margin-top: 12px;
  padding: 12px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  text-align: center;
}

.preview-title {
  font-size: 12px;
  color: #595959;
  margin-bottom: 8px;
}

.preview-svg {
  max-width: 100%;
  height: 80px;
  background: #fff;
  border: 1px solid #d9d9d9;
}
</style>
