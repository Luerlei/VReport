<template>
  <div class="template-list-view">
    <!-- 顶部导航 -->
    <header class="page-header">
      <div class="header-left">
        <div class="logo">
          <span class="logo-icon">📊</span>
          <span class="logo-text">VReport</span>
        </div>
        <span class="subtitle">报表设计器</span>
      </div>
      <div class="header-right">
        <a-input-search
          v-model:value="keyword"
          placeholder="搜索报表名称或标签"
          style="width: 240px"
          allow-clear
        />
        <a-button @click="onImport">
          <template #icon><ImportOutlined /></template>
          导入
        </a-button>
        <a-button type="primary" @click="onNew">
          <template #icon><PlusOutlined /></template>
          新建报表
        </a-button>
      </div>
    </header>

    <!-- 内容区 -->
    <main class="page-content">
      <div class="content-header">
        <h2 class="page-title">我的报表</h2>
        <span class="count-tip">共 {{ filteredTemplates.length }} 个</span>
      </div>

      <a-empty
        v-if="!filteredTemplates.length"
        description="暂无报表模板"
        style="margin-top: 80px"
      >
        <a-button type="primary" @click="onNew">
          <template #icon><PlusOutlined /></template>
          新建第一个报表
        </a-button>
      </a-empty>

      <div v-else class="card-grid">
        <div
          v-for="tpl in filteredTemplates"
          :key="tpl.id"
          class="tpl-card"
          @click="onOpen(tpl.id)"
        >
          <div class="card-cover">
            <div class="cover-icon">📋</div>
            <a-tag v-if="tpl.tags?.length" color="blue" class="cover-tag">{{ tpl.tags[0] }}</a-tag>
          </div>
          <div class="card-body">
            <div class="card-name" :title="tpl.name">{{ tpl.name }}</div>
            <div class="card-desc">{{ tpl.description || '暂无描述' }}</div>
            <div class="card-meta">
              <span class="meta-item">
                <CalendarOutlined />
                {{ formatDate(tpl.updatedAt) }}
              </span>
              <span class="meta-item">
                <TableOutlined />
                {{ countCells(tpl) }} 格
              </span>
            </div>
          </div>
          <div class="card-actions" @click.stop>
            <a-tooltip title="设计编辑">
              <a-button type="text" size="small" @click="onOpen(tpl.id)">
                <template #icon><EditOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="预览">
              <a-button type="text" size="small" @click="onPreview(tpl.id)">
                <template #icon><EyeOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="重命名">
              <a-button type="text" size="small" @click="onRename(tpl)">
                <template #icon><FileTextOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="复制">
              <a-button type="text" size="small" @click="onDuplicate(tpl)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="导出文件">
              <a-button type="text" size="small" @click="onExport(tpl)">
                <template #icon><DownloadOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="删除">
              <a-button type="text" size="small" danger @click="onDelete(tpl)">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </div>
      </div>
    </main>

    <input
      ref="fileInputRef"
      type="file"
      accept=".json"
      style="display: none"
      @change="onImportFile"
    />

    <!-- 重命名对话框 -->
    <a-modal v-model:open="renameVisible" title="重命名报表" @ok="confirmRename" width="420px">
      <a-form layout="vertical">
        <a-form-item label="报表名称" required>
          <a-input v-model:value="renameForm.name" placeholder="请输入报表名称" />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model:value="renameForm.description" :rows="3" placeholder="报表用途说明" />
        </a-form-item>
        <a-form-item label="标签（逗号分隔）">
          <a-input v-model:value="renameForm.tagsText" placeholder="如：销售, 月报" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined,
  ImportOutlined,
  EditOutlined,
  EyeOutlined,
  CopyOutlined,
  DownloadOutlined,
  DeleteOutlined,
  CalendarOutlined,
  TableOutlined,
  FileTextOutlined
} from '@ant-design/icons-vue'
import { useReportStore } from '@/stores/report'
import { exportTemplateFile, importTemplateFile } from '@/core/serializer/Serializer'
import { saveTemplate } from '@/utils/db'
import dayjs from 'dayjs'
import type { ReportTemplate } from '@/types'

const router = useRouter()
const report = useReportStore()

const templates = ref<ReportTemplate[]>([])
const keyword = ref('')
const fileInputRef = ref<HTMLInputElement>()

const filteredTemplates = computed(() => {
  if (!keyword.value.trim()) return templates.value
  const kw = keyword.value.toLowerCase()
  return templates.value.filter((t) => {
    const inName = t.name.toLowerCase().includes(kw)
    const inDesc = (t.description || '').toLowerCase().includes(kw)
    const inTags = (t.tags || []).some((tag) => tag.toLowerCase().includes(kw))
    return inName || inDesc || inTags
  })
})

onMounted(async () => {
  await report.loadList()
  templates.value = report.templateList
})

function onNew() {
  router.push('/designer')
}

function onOpen(id: string) {
  router.push(`/designer/${id}`)
}

function onPreview(id: string) {
  router.push(`/preview/${id}`)
}

function onExport(tpl: ReportTemplate) {
  exportTemplateFile(tpl)
  message.success('已导出')
}

function onDelete(tpl: ReportTemplate) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除报表「${tpl.name}」吗？此操作不可恢复。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await report.remove(tpl.id)
      templates.value = report.templateList
      message.success('已删除')
    }
  })
}

function onImport() {
  fileInputRef.value?.click()
}

async function onImportFile(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  try {
    const tpl = await importTemplateFile(file)
    await saveTemplate(tpl)
    await report.loadList()
    templates.value = report.templateList
    message.success('导入成功')
  } catch {
    message.error('导入失败，请检查文件格式')
  }
  target.value = ''
}

// ===== 重命名/编辑元信息 =====
const renameVisible = ref(false)
const renameForm = ref<{ id: string; name: string; description: string; tagsText: string }>({
  id: '',
  name: '',
  description: '',
  tagsText: ''
})

function onRename(tpl: ReportTemplate) {
  renameForm.value = {
    id: tpl.id,
    name: tpl.name,
    description: tpl.description || '',
    tagsText: (tpl.tags || []).join(', ')
  }
  renameVisible.value = true
}

async function confirmRename() {
  if (!renameForm.value.name.trim()) {
    message.warning('请输入报表名称')
    return
  }
  const tags = renameForm.value.tagsText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  await report.updateMeta(renameForm.value.id, {
    name: renameForm.value.name.trim(),
    description: renameForm.value.description,
    tags
  })
  templates.value = report.templateList
  renameVisible.value = false
  message.success('已更新')
}

// ===== 复制 =====
async function onDuplicate(tpl: ReportTemplate) {
  const newId = await report.duplicate(tpl.id)
  templates.value = report.templateList
  if (newId) {
    message.success('已复制')
  } else {
    message.error('复制失败')
  }
}

function formatDate(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DD HH:mm')
}

function countCells(tpl: ReportTemplate): number {
  return tpl.cells.flat().filter((c) => c !== null).length
}
</script>

<style scoped>
.template-list-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f0f2f5;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 24px;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: #1677ff;
  letter-spacing: 0.5px;
}

.subtitle {
  font-size: 13px;
  color: #999;
  padding-left: 16px;
  border-left: 1px solid #e8e8e8;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-content {
  flex: 1;
  padding: 24px;
  overflow: auto;
}

.content-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 20px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #1f2329;
}

.count-tip {
  font-size: 13px;
  color: #999;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.tpl-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
}

.tpl-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
  border-color: #91caff;
}

.card-cover {
  height: 80px;
  background: linear-gradient(135deg, #e6f4ff 0%, #bae0ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.cover-icon {
  font-size: 36px;
}

.cover-tag {
  position: absolute;
  top: 8px;
  right: 8px;
  margin: 0;
}

.card-body {
  padding: 14px 16px;
  flex: 1;
}

.card-name {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #1f2329;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-desc {
  font-size: 12px;
  color: #999;
  margin-bottom: 10px;
  height: 36px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #bbb;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.card-actions {
  display: flex;
  justify-content: space-around;
  border-top: 1px solid #f5f5f5;
  padding: 4px 0;
}

.card-actions :deep(.ant-btn-text) {
  color: #595959;
}

.card-actions :deep(.ant-btn-text:hover) {
  background: #f0f5ff;
  color: #1677ff;
}
</style>
