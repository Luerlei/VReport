<template>
  <a-modal
    :open="visible"
    title="插入二维码"
    width="500px"
    :destroyOnClose="true"
    @ok="onOk"
    @cancel="onCancel"
  >
    <a-form layout="vertical">
      <a-form-item label="数据内容">
        <a-textarea
          v-model:value="form.data"
          :rows="3"
          placeholder="静态文本,或使用 ${ds1.id} / ${param.code} 表达式"
        />
        <div class="tip">支持 ${ds1.field} 引用数据集字段,${param.name} 引用参数</div>
      </a-form-item>

      <a-row :gutter="12">
        <a-col :span="8">
          <a-form-item label="纠错等级">
            <a-select v-model:value="form.errorCorrectLevel">
              <a-select-option value="L">L (7%)</a-select-option>
              <a-select-option value="M">M (15%)</a-select-option>
              <a-select-option value="Q">Q (25%)</a-select-option>
              <a-select-option value="H">H (30%)</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="像素大小">
            <a-input-number v-model:value="form.size" :min="1" :max="20" style="width: 100%" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="边距">
            <a-input-number v-model:value="form.margin" :min="0" :max="10" style="width: 100%" />
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
        <canvas ref="previewCanvasRef" class="preview-canvas"></canvas>
      </div>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { reactive, ref, watch, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import QRCode from 'qrcode'
import type { QRConfig } from '@/types'

const props = defineProps<{ visible: boolean; initial?: QRConfig }>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'confirm', config: QRConfig): void
}>()

const form = reactive<QRConfig>({
  data: '',
  errorCorrectLevel: 'M',
  size: 4,
  foreground: '#000000',
  background: '#ffffff',
  margin: 2
})

const previewCanvasRef = ref<HTMLCanvasElement | null>(null)

watch(
  () => props.visible,
  (v) => {
    if (v) {
      Object.assign(form, {
        data: '',
        errorCorrectLevel: 'M',
        size: 4,
        foreground: '#000000',
        background: '#ffffff',
        margin: 2,
        ...(props.initial ?? {})
      })
      nextTick(renderPreview)
    }
  },
  { immediate: true }
)

watch(form, renderPreview, { deep: true })

function renderPreview() {
  const canvas = previewCanvasRef.value
  if (!canvas) return
  const data = resolveForPreview(form.data)
  if (!data) {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      canvas.width = 128
      canvas.height = 128
      ctx.clearRect(0, 0, 128, 128)
      ctx.fillStyle = '#f5f5f5'
      ctx.fillRect(0, 0, 128, 128)
      ctx.fillStyle = '#999'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('请输入数据', 64, 64)
    }
    return
  }
  QRCode.toCanvas(
    canvas,
    data,
    {
      errorCorrectionLevel: form.errorCorrectLevel,
      margin: form.margin,
      width: 160,
      color: {
        dark: form.foreground,
        light: form.background
      }
    },
    (err) => {
      if (err) console.warn('QR preview error:', err)
    }
  )
}

/** 预览时把表达式替换为占位文本(运行时再实际求值) */
function resolveForPreview(text: string): string {
  if (!text) return ''
  return text.replace(/\$\{[^}]+\}/g, 'SAMPLE')
}

function onOk() {
  if (!form.data?.trim()) {
    message.warning('请填写二维码数据内容')
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

.preview-canvas {
  max-width: 200px;
  max-height: 200px;
  border: 1px solid #d9d9d9;
  background: #fff;
}
</style>
