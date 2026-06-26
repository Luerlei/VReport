<template>
  <a-modal
    :open="visible"
    title="插入图片"
    width="560px"
    :destroyOnClose="true"
    @ok="onOk"
    @cancel="onCancel"
  >
    <a-form layout="vertical">
      <a-form-item label="图片来源">
        <a-radio-group v-model:value="form.source">
          <a-radio-button value="url">URL 引用</a-radio-button>
          <a-radio-button value="base64">本地上传</a-radio-button>
        </a-radio-group>
      </a-form-item>

      <a-form-item v-if="form.source === 'url'" label="图片 URL">
        <a-input
          v-model:value="form.url"
          placeholder="https://example.com/logo.png 或 ${param.imageUrl}"
          allow-clear
        />
        <div class="tip">支持 ${param.xxx} 表达式,运行时动态替换</div>
      </a-form-item>

      <a-form-item v-else label="本地图片">
        <a-upload
          :before-upload="onFileSelected"
          :show-upload-list="false"
          accept="image/*"
        >
          <a-button>
            <template #icon><UploadOutlined /></template>
            选择图片
          </a-button>
        </a-upload>
        <div v-if="form.base64" class="preview-wrap">
          <img :src="dataUri" class="preview-img" />
          <span class="preview-info">{{ form.mimeType }} · {{ form.base64.length }} bytes(base64)</span>
          <a-button size="small" danger @click="clearBase64">移除</a-button>
        </div>
        <div v-else class="tip">未选择图片</div>
      </a-form-item>

      <a-row :gutter="12">
        <a-col :span="8">
          <a-form-item label="宽度(px)">
            <a-input-number
              v-model:value="form.width"
              :min="0"
              :max="1000"
              style="width: 100%"
              placeholder="0=自适应"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="高度(px)">
            <a-input-number
              v-model:value="form.height"
              :min="0"
              :max="1000"
              style="width: 100%"
              placeholder="0=自适应"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="缩放模式">
            <a-select v-model:value="form.fit">
              <a-select-option value="contain">包含</a-select-option>
              <a-select-option value="cover">覆盖</a-select-option>
              <a-select-option value="fill">拉伸</a-select-option>
              <a-select-option value="none">原始</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { UploadOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { ImageConfig } from '@/types'

const props = defineProps<{ visible: boolean; initial?: ImageConfig }>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'confirm', config: ImageConfig): void
}>()

const form = reactive<ImageConfig>({
  source: 'url',
  url: '',
  base64: undefined,
  mimeType: undefined,
  width: 0,
  height: 0,
  fit: 'contain'
})

watch(
  () => props.visible,
  (v) => {
    if (v) {
      Object.assign(form, {
        source: 'url',
        url: '',
        base64: undefined,
        mimeType: undefined,
        width: 0,
        height: 0,
        fit: 'contain',
        ...(props.initial ?? {})
      })
    }
  },
  { immediate: true }
)

const dataUri = computed(() => {
  if (!form.base64) return ''
  return `data:${form.mimeType ?? 'image/png'};base64,${form.base64}`
})

/** 文件选择:转 base64 */
function onFileSelected(file: File): boolean {
  if (file.size > 2 * 1024 * 1024) {
    message.warning('图片过大(>2MB),建议使用 URL 引用方式')
  }
  const reader = new FileReader()
  reader.onload = () => {
    const result = reader.result as string
    const match = result.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      form.base64 = match[2]
      form.mimeType = match[1]
      form.source = 'base64'
    }
  }
  reader.readAsDataURL(file)
  return false
}

function clearBase64() {
  form.base64 = undefined
  form.mimeType = undefined
}

function onOk() {
  if (form.source === 'url' && !form.url?.trim()) {
    message.warning('请填写图片 URL')
    return
  }
  if (form.source === 'base64' && !form.base64) {
    message.warning('请选择本地图片')
    return
  }
  const config: ImageConfig = { ...form }
  if (config.source === 'url') {
    config.base64 = undefined
    config.mimeType = undefined
  } else {
    config.url = undefined
  }
  emit('confirm', config)
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

.preview-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
}

.preview-img {
  max-width: 80px;
  max-height: 80px;
  border: 1px solid #d9d9d9;
}

.preview-info {
  font-size: 12px;
  color: #595959;
  flex: 1;
}
</style>
