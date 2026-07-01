<template>
  <div class="data-panel">
    <!-- 数据源区（可折叠） -->
    <div class="panel-section">
      <div class="section-header" @click="dsCollapsed = !dsCollapsed">
        <span class="section-title">
          <DownOutlined v-if="!dsCollapsed" />
          <RightOutlined v-else />
          数据源
          <a-tag size="small" class="count-tag">{{ dataSources.length }}</a-tag>
        </span>
        <a-button size="small" type="link" @click.stop="openDsDialog">
          <template #icon><PlusOutlined /></template>新建
        </a-button>
      </div>
      <div v-show="!dsCollapsed" class="section-body">
        <a-list size="small" :data-source="dataSources" :locale="{ emptyText: '暂无数据源' }">
          <template #renderItem="{ item }">
            <a-list-item class="list-item">
              <a-list-item-meta :title="item.name" :description="dsTypeLabel(item.type)" />
              <template #actions>
                <a-tooltip title="编辑">
                  <a-button size="small" type="text" @click="editDs(item)">
                    <template #icon><EditOutlined /></template>
                  </a-button>
                </a-tooltip>
                <a-tooltip title="测试连接">
                  <a-button size="small" type="text" @click="testDs(item)">
                    <template #icon><ApiOutlined /></template>
                  </a-button>
                </a-tooltip>
                <a-tooltip title="删除">
                  <a-button size="small" type="text" danger @click="removeDs(item.id)">
                    <template #icon><DeleteOutlined /></template>
                  </a-button>
                </a-tooltip>
              </template>
            </a-list-item>
          </template>
        </a-list>
      </div>
    </div>

    <!-- 数据集区（可折叠） -->
    <div class="panel-section">
      <div class="section-header" @click="setCollapsed = !setCollapsed">
        <span class="section-title">
          <DownOutlined v-if="!setCollapsed" />
          <RightOutlined v-else />
          数据集
          <a-tag size="small" class="count-tag">{{ dataSets.length }}</a-tag>
        </span>
        <a-button size="small" type="link" :disabled="!dataSources.length" @click.stop="openSetDialog">
          <template #icon><PlusOutlined /></template>新建
        </a-button>
      </div>
      <div v-show="!setCollapsed" class="section-body">
        <div v-if="!dataSets.length" class="empty-tip">暂无数据集</div>
        <div v-for="item in dataSets" :key="item.id" class="set-wrapper">
          <!-- 数据集行：点击展开/收起字段 -->
          <div class="set-row">
            <div class="set-info" @click="toggleSetExpand(item)">
              <RightOutlined v-if="!isSetExpanded(item.id)" class="expand-arrow" />
              <DownOutlined v-else class="expand-arrow" />
              <span class="set-name">{{ item.name }}</span>
              <a-tag v-if="item.cachedRows?.length" color="green" class="row-count-tag">
                {{ item.cachedRows.length }} 行
              </a-tag>
              <span class="set-source">{{ sourceName(item.sourceId) }}</span>
            </div>
            <div class="set-actions" @click.stop>
              <a-tooltip title="编辑">
                <a-button size="small" type="text" @click="editSet(item)">
                  <template #icon><EditOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="预览数据">
                <a-button size="small" type="text" @click="previewSet(item)">
                  <template #icon><EyeOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="刷新数据">
                <a-button size="small" type="text" @click="refreshSet(item)">
                  <template #icon><ReloadOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="删除">
                <a-button size="small" type="text" danger @click="removeSet(item.id)">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </a-tooltip>
            </div>
          </div>
          <!-- 字段子列表：点击字段插入变量到当前单元格 -->
          <div v-if="isSetExpanded(item.id)" class="fields-sublist">
            <div v-if="!getSetFields(item).length" class="field-empty">
              无字段数据，请先
              <a-button type="link" size="small" @click="refreshSet(item)">刷新</a-button>
            </div>
            <div
              v-for="field in getSetFields(item)"
              :key="field.name"
              class="field-item"
              @mousedown.prevent="insertFieldVar(item.name, field.name)"
              :title="`点击插入 ${'$'}{${item.name}.${field.name}} 到当前单元格`"
            >
              <TagOutlined class="field-icon" />
              <span class="field-name">{{ field.name }}</span>
              <span class="field-type">{{ field.type }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据源对话框（新建/编辑） -->
    <a-modal
      v-model:open="showDsDialog"
      :title="editingDs ? '编辑数据源' : '新建数据源'"
      @ok="saveDs"
      width="560px"
      :confirm-loading="dsLoading"
    >
      <a-form layout="vertical">
        <a-form-item label="名称">
          <a-input v-model:value="dsForm.name" placeholder="如 userSource" />
        </a-form-item>
        <a-form-item label="类型">
          <a-radio-group v-model:value="dsForm.type">
            <a-radio value="excel">Excel 上传</a-radio>
            <a-radio value="json">JSON</a-radio>
            <a-radio value="csv">CSV</a-radio>
          </a-radio-group>
        </a-form-item>

        <template v-if="dsForm.type === 'excel'">
          <a-form-item label="上传 Excel 文件">
            <input type="file" accept=".xlsx,.xls" @change="onExcelUpload" />
            <span v-if="dsForm.config.fileName" class="file-tip">已选：{{ dsForm.config.fileName }}</span>
          </a-form-item>
          <a-form-item label="Sheet 名">
            <a-input v-model:value="dsForm.config.sheet" placeholder="留空取第一个" />
          </a-form-item>
          <a-form-item>
            <a-checkbox v-model:checked="dsForm.config.hasHeader">首行为表头</a-checkbox>
          </a-form-item>
        </template>

        <template v-if="dsForm.type === 'json'">
          <a-form-item label="JSON 内容">
            <a-textarea v-model:value="dsForm.config.rawJson" :rows="6" placeholder='[{"name":"张三","age":20}]' />
          </a-form-item>
          <a-form-item label="取数路径">
            <a-input v-model:value="dsForm.config.dataPath" placeholder="如 data.list，留空取根" />
          </a-form-item>
        </template>

        <template v-if="dsForm.type === 'csv'">
          <a-form-item label="CSV 内容">
            <a-textarea v-model:value="dsForm.config.rawCsv" :rows="6" placeholder="name,age&#10;张三,20" />
          </a-form-item>
          <a-form-item label="分隔符">
            <a-input v-model:value="dsForm.config.delimiter" placeholder="," style="width: 80px" />
          </a-form-item>
          <a-form-item>
            <a-checkbox v-model:checked="dsForm.config.hasHeader">首行为表头</a-checkbox>
          </a-form-item>
        </template>

        <a-button v-if="dsForm.type !== 'excel' || dsForm.config.fileName" @click="testDsForm" :loading="dsLoading">
          测试取数
        </a-button>
      </a-form>
    </a-modal>

    <!-- 数据集对话框（新建/编辑） -->
    <a-modal
      v-model:open="showSetDialog"
      :title="editingSet ? '编辑数据集' : '新建数据集'"
      @ok="saveSet"
      width="520px"
    >
      <a-form layout="vertical">
        <a-form-item label="名称">
          <a-input v-model:value="setForm.name" placeholder="如 ds1，表达式中用 ${ds1.字段名}" />
        </a-form-item>
        <a-form-item label="数据源">
          <a-select v-model:value="setForm.sourceId">
            <a-select-option v-for="ds in dataSources" :key="ds.id" :value="ds.id">{{ ds.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="取数路径（JSON）">
          <a-input v-model:value="setForm.path" placeholder="覆盖数据源默认路径，可留空" />
        </a-form-item>
        <a-form-item label="Sheet 名（Excel）">
          <a-input v-model:value="setForm.sheet" placeholder="覆盖数据源默认 sheet，可留空" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 数据预览对话框 -->
    <a-modal v-model:open="showPreviewDialog" :title="`数据预览 - ${previewTitle}`" width="800px" :footer="null">
      <a-alert v-if="previewFields.length" :message="`共 ${previewRows.length} 行，字段：${previewFields.map(f => f.name).join(', ')}`" type="info" style="margin-bottom:12px" />
      <a-table
        v-if="previewRows.length"
        :columns="previewColumns"
        :data-source="previewRows"
        :pagination="{ pageSize: 10 }"
        size="small"
        :scroll="{ x: 'max-content' }"
      />
      <a-empty v-else description="无数据" />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  ApiOutlined,
  DownOutlined,
  RightOutlined,
  TagOutlined
} from '@ant-design/icons-vue'
import { useReportStore } from '@/stores/report'
import { useDesignerStore } from '@/stores/designer'
import { uid } from '@/utils/id'
import { fetchData, fetchFields } from '@/core/datasource/ProviderRegistry'
import { fileToBase64 } from '@/core/datasource/ExcelProvider'
import type { DataSource, DataSourceType, DataSet } from '@/types'
import type { DataRow, FieldInfo } from '@/core/datasource/types'

const report = useReportStore()
const designer = useDesignerStore()

// 分组折叠状态
const dsCollapsed = ref(false)
const setCollapsed = ref(false)

// 数据集字段展开状态（记录已展开的数据集 id）
const expandedSetIds = ref<string[]>([])

function isSetExpanded(id: string): boolean {
  return expandedSetIds.value.includes(id)
}

/** 展开/收起数据集字段；首次展开若无缓存数据则自动取数 */
async function toggleSetExpand(ds: DataSet) {
  const idx = expandedSetIds.value.indexOf(ds.id)
  if (idx >= 0) {
    expandedSetIds.value.splice(idx, 1)
    return
  }
  expandedSetIds.value.push(ds.id)
  // 首次展开且无缓存时自动取数
  if (!ds.cachedRows?.length) {
    await refreshSet(ds)
  }
}

/** 从缓存行中提取字段列表 */
function getSetFields(ds: DataSet): FieldInfo[] {
  return extractFieldsFromRows(ds.cachedRows ?? [])
}

/** 点击字段，请求将 ${dsName.fieldName} 插入到当前单元格(编辑中在光标位置插入) */
function insertFieldVar(dsName: string, fieldName: string) {
  if (!report.grid) {
    message.warning('请先打开报表')
    return
  }
  designer.requestFieldInsert(dsName, fieldName)
}

const dataSources = computed(() => report.currentTemplate?.dataSources ?? [])
const dataSets = computed(() => report.currentTemplate?.dataSets ?? [])

function dsTypeLabel(t: DataSourceType): string {
  return { excel: 'Excel', json: 'JSON', csv: 'CSV', file: '文件' }[t]
}

function sourceName(id: string): string {
  return dataSources.value.find((d) => d.id === id)?.name ?? '-'
}

// ===== 数据源表单 =====
const showDsDialog = ref(false)
const dsLoading = ref(false)
const editingDs = ref<DataSource | null>(null)
const dsForm = ref<{
  name: string
  type: DataSourceType
  config: any
}>({
  name: '',
  type: 'excel',
  config: { hasHeader: true, delimiter: ',', sheet: '', dataPath: '', rawJson: '', rawCsv: '', fileName: '', fileData: '' }
})

function openDsDialog() {
  editingDs.value = null
  dsForm.value = {
    name: '',
    type: 'excel',
    config: { hasHeader: true, delimiter: ',', sheet: '', dataPath: '', rawJson: '', rawCsv: '', fileName: '', fileData: '' }
  }
  showDsDialog.value = true
}

/** 编辑数据源：填充表单 */
function editDs(ds: DataSource) {
  editingDs.value = ds
  dsForm.value = {
    name: ds.name,
    type: ds.type,
    config: { ...ds.config }
  }
  showDsDialog.value = true
}

async function onExcelUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  dsForm.value.config.fileName = file.name
  dsLoading.value = true
  try {
    dsForm.value.config.fileData = await fileToBase64(file)
    message.success(`已读取文件：${file.name}`)
  } catch {
    message.error('文件读取失败')
  } finally {
    dsLoading.value = false
  }
}

/** 测试表单中的数据源（未保存前） */
async function testDsForm() {
  if (!dsForm.value.name) {
    message.warning('请先填写名称')
    return
  }
  dsLoading.value = true
  try {
    const tempSource: DataSource = {
      id: 'temp',
      name: dsForm.value.name,
      type: dsForm.value.type,
      config: { ...dsForm.value.config },
      createdAt: Date.now()
    }
    const tempSet: DataSet = {
      id: 'temp',
      name: 'temp',
      sourceId: 'temp',
      extractor: {}
    }
    const { fields, sampleRows } = await fetchFields(tempSource, tempSet)
    showPreviewDialog.value = true
    previewTitle.value = dsForm.value.name
    previewFields.value = fields
    previewRows.value = sampleRows
    message.success(`取数成功，共 ${sampleRows.length} 条示例`)
  } catch (e: any) {
    message.error(e.message || '取数失败')
  } finally {
    dsLoading.value = false
  }
}

/** 保存数据源（新建或更新） */
async function saveDs() {
  if (!report.currentTemplate) return
  if (!dsForm.value.name) {
    message.warning('请填写名称')
    return
  }
  if (dsForm.value.type === 'excel' && !dsForm.value.config.fileData) {
    message.warning('请上传 Excel 文件')
    return
  }
  if (editingDs.value) {
    // 更新
    const ds = editingDs.value
    ds.name = dsForm.value.name
    ds.type = dsForm.value.type
    ds.config = { ...dsForm.value.config }
    // 清除关联数据集缓存（配置可能已变）
    report.currentTemplate.dataSets.forEach((s) => {
      if (s.sourceId === ds.id) s.cachedRows = undefined
    })
    message.success('数据源已更新')
  } else {
    // 新建
    const ds: DataSource = {
      id: uid('ds_'),
      name: dsForm.value.name,
      type: dsForm.value.type,
      config: { ...dsForm.value.config },
      createdAt: Date.now()
    }
    report.currentTemplate.dataSources.push(ds)
    message.success('数据源已创建')
  }
  report.markDirty()
  showDsDialog.value = false
}

async function testDs(ds: DataSource) {
  dsLoading.value = true
  try {
    const tempSet: DataSet = { id: 'temp', name: 'temp', sourceId: ds.id, extractor: {} }
    const { fields, sampleRows } = await fetchFields(ds, tempSet)
    showPreviewDialog.value = true
    previewTitle.value = ds.name
    previewFields.value = fields
    previewRows.value = sampleRows
  } catch (e: any) {
    message.error(e.message || '取数失败')
  } finally {
    dsLoading.value = false
  }
}

function removeDs(id: string) {
  if (!report.currentTemplate) return
  // 同时删除关联数据集
  report.currentTemplate.dataSets = report.currentTemplate.dataSets.filter((d) => d.sourceId !== id)
  report.currentTemplate.dataSources = report.currentTemplate.dataSources.filter((d) => d.id !== id)
  report.markDirty()
}

// ===== 数据集表单 =====
const showSetDialog = ref(false)
const editingSet = ref<DataSet | null>(null)
const setForm = ref<{ name: string; sourceId: string; path: string; sheet: string }>({
  name: '',
  sourceId: '',
  path: '',
  sheet: ''
})

function openSetDialog() {
  editingSet.value = null
  setForm.value = { name: '', sourceId: dataSources.value[0]?.id ?? '', path: '', sheet: '' }
  showSetDialog.value = true
}

/** 编辑数据集：填充表单 */
function editSet(ds: DataSet) {
  editingSet.value = ds
  setForm.value = {
    name: ds.name,
    sourceId: ds.sourceId,
    path: ds.extractor.path ?? '',
    sheet: ds.extractor.sheet ?? ''
  }
  showSetDialog.value = true
}

/** 保存数据集（新建或更新） */
async function saveSet() {
  if (!report.currentTemplate) return
  if (!setForm.value.name || !setForm.value.sourceId) {
    message.warning('请填写完整')
    return
  }
  if (editingSet.value) {
    // 更新
    const ds = editingSet.value
    ds.name = setForm.value.name
    ds.sourceId = setForm.value.sourceId
    ds.extractor = {
      path: setForm.value.path || undefined,
      sheet: setForm.value.sheet || undefined
    }
    ds.cachedRows = undefined // 清缓存
    message.success('数据集已更新')
  } else {
    // 新建
    const ds: DataSet = {
      id: uid('set_'),
      name: setForm.value.name,
      sourceId: setForm.value.sourceId,
      extractor: {
        path: setForm.value.path || undefined,
        sheet: setForm.value.sheet || undefined
      }
    }
    // 创建后立即取数缓存
    try {
      const source = dataSources.value.find((d) => d.id === setForm.value.sourceId)
      if (source) {
        ds.cachedRows = await fetchData(source, ds)
      }
    } catch (e: any) {
      message.warning(`数据集已创建，但取数失败：${e.message}`)
    }
    report.currentTemplate.dataSets.push(ds)
    message.success('数据集已创建')
  }
  report.markDirty()
  showSetDialog.value = false
}

async function refreshSet(ds: DataSet) {
  const source = dataSources.value.find((d) => d.id === ds.sourceId)
  if (!source) {
    message.warning('关联数据源不存在')
    return
  }
  dsLoading.value = true
  try {
    ds.cachedRows = await fetchData(source, ds)
    report.markDirty()
    message.success(`已刷新，共 ${ds.cachedRows.length} 行`)
  } catch (e: any) {
    message.error(e.message || '刷新失败')
  } finally {
    dsLoading.value = false
  }
}

async function previewSet(ds: DataSet) {
  if (!ds.cachedRows?.length) {
    await refreshSet(ds)
  }
  showPreviewDialog.value = true
  previewTitle.value = ds.name
  previewRows.value = ds.cachedRows ?? []
  previewFields.value = extractFieldsFromRows(ds.cachedRows ?? [])
}

function removeSet(id: string) {
  if (!report.currentTemplate) return
  report.currentTemplate.dataSets = report.currentTemplate.dataSets.filter((d) => d.id !== id)
  report.markDirty()
}

// ===== 预览对话框 =====
const showPreviewDialog = ref(false)
const previewTitle = ref('')
const previewRows = ref<DataRow[]>([])
const previewFields = ref<FieldInfo[]>([])

const previewColumns = computed(() =>
  previewFields.value.map((f) => ({
    title: f.name,
    dataIndex: f.name,
    key: f.name,
    ellipsis: true,
    width: 120
  }))
)

function extractFieldsFromRows(rows: DataRow[]): FieldInfo[] {
  if (!rows.length) return []
  return Object.keys(rows[0]).map((name) => ({ name, type: 'string' as const }))
}
</script>

<style scoped>
.data-panel {
  padding: 4px 0;
}

.panel-section {
  margin-bottom: 0;
  border-bottom: 1px solid #f0f0f0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.section-header:hover {
  background: #f5f5f5;
}

.section-title {
  font-size: 12px;
  font-weight: 500;
  color: #1f2329;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.count-tag {
  margin-left: 2px;
  font-size: 11px;
  line-height: 14px;
  padding: 0 4px;
  border-radius: 8px;
}

.section-body {
  padding: 0 4px;
}

.list-item {
  padding: 4px 6px !important;
  border-bottom: 1px solid #f5f5f5 !important;
}

.list-item :deep(.ant-list-item-meta-title) {
  font-size: 12px !important;
  margin-bottom: 0 !important;
  line-height: 20px !important;
}

.list-item :deep(.ant-list-item-meta-description) {
  font-size: 11px !important;
  line-height: 16px !important;
}

.file-tip {
  margin-left: 12px;
  color: #52c41a;
  font-size: 12px;
}

/* 数据集自定义列表 */
.empty-tip {
  padding: 12px;
  text-align: center;
  color: #999;
  font-size: 12px;
}

.set-wrapper {
  border-bottom: 1px solid #f5f5f5;
}

.set-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  transition: background 0.2s;
}

.set-row:hover {
  background: #f5f5f5;
}

.set-info {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  flex: 1;
  min-width: 0;
  user-select: none;
}

.expand-arrow {
  font-size: 10px;
  color: #888;
  flex-shrink: 0;
}

.set-name {
  font-size: 12px;
  font-weight: 500;
  color: #1f2329;
}

.row-count-tag {
  margin-left: 2px;
  font-size: 11px;
  line-height: 14px;
  padding: 0 4px;
  border-radius: 8px;
}

.set-source {
  font-size: 11px;
  color: #999;
  margin-left: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.set-actions {
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
}

.set-actions :deep(.ant-btn) {
  padding: 0 4px;
  height: 22px;
}

/* 字段子列表 */
.fields-sublist {
  padding: 2px 6px 6px 22px;
  background: #fafafa;
  border-top: 1px solid #f0f0f0;
}

.field-empty {
  padding: 6px 0;
  font-size: 11px;
  color: #999;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.field-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  cursor: pointer;
  border-radius: 3px;
  font-size: 12px;
  color: #1f2329;
  transition: background 0.15s;
}

.field-item:hover {
  background: #e6f4ff;
  color: #1677ff;
}

.field-icon {
  font-size: 11px;
  color: #1677ff;
  flex-shrink: 0;
}

.field-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-type {
  font-size: 10px;
  color: #bbb;
  text-transform: uppercase;
  flex-shrink: 0;
}
</style>
