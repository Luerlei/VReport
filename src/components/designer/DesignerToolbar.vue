<template>
  <div class="designer-toolbar">
    <div class="toolbar-left">
      <a-button @click="goBack">
        <template #icon><ArrowLeftOutlined /></template>
        返回
      </a-button>
      <a-button @click="onPreview" :disabled="!templateId">
        <template #icon><EyeOutlined /></template>
        预览
      </a-button>
      <a-button type="primary" :loading="saving" @click="onSave">
        <template #icon><SaveOutlined /></template>
        保存
      </a-button>
    </div>
    <div class="toolbar-center">
      <span v-if="report.dirty" class="dirty-dot" title="未保存"></span>
      <span class="tpl-name">{{ report.currentTemplate?.name }}</span>
    </div>
    <div class="toolbar-right">
      <a-button @click="onImport">
        <template #icon><ImportOutlined /></template>
        导入
      </a-button>
      <a-button @click="onExport">
        <template #icon><DownloadOutlined /></template>
        导出模板
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  EyeOutlined,
  ImportOutlined,
  DownloadOutlined,
  SaveOutlined
} from '@ant-design/icons-vue'
import { useReportStore } from '@/stores/report'
import { exportTemplateFile, importTemplateFile } from '@/core/serializer/Serializer'

const router = useRouter()
const report = useReportStore()

const saving = ref(false)
const templateId = computed(() => report.currentTemplate?.id)

function goBack() {
  router.push('/')
}

async function onSave() {
  if (!report.currentTemplate) {
    message.warning('请先新建或打开模板')
    return
  }
  saving.value = true
  try {
    await report.save()
    message.success('保存成功')
  } catch (e: any) {
    console.error('保存失败:', e)
    message.error('保存失败：' + (e?.message ?? e))
  } finally {
    saving.value = false
  }
}

function onPreview() {
  if (!templateId.value) return
  if (report.dirty) {
    message.warning('请先保存')
    return
  }
  router.push(`/preview/${templateId.value}`)
}

function onExport() {
  if (!report.currentTemplate) return
  exportTemplateFile(report.currentTemplate)
  message.success('模板已导出')
}

function onImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const tpl = await importTemplateFile(file)
      await report.save()
      message.success('模板已导入')
      router.push(`/designer/${tpl.id}`)
    } catch (e: any) {
      message.error('导入失败：' + (e?.message ?? e))
    }
  }
  input.click()
}
</script>

<style scoped>
.designer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 48px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  z-index: 10;
  flex-shrink: 0;
  position: relative;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: flex-start;
}

.toolbar-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: flex-end;
}

.dirty-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fa8c16;
  display: inline-block;
}

.tpl-name {
  color: #1f2329;
  font-size: 15px;
  font-weight: 600;
}
</style>

