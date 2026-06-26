<template>
  <div class="preview-view">
    <div class="preview-header">
      <a-space>
        <a-button @click="goBack">返回设计器</a-button>
        <span class="title">{{ report.currentTemplate?.name }}</span>
      </a-space>
      <a-space>
        <a-dropdown @click.prevent>
          <a-button :disabled="!renderResult" :loading="exporting">
            导出 <DownOutlined />
          </a-button>
          <template #overlay>
            <a-menu @click="onExport">
              <a-menu-item key="html">导出 HTML</a-menu-item>
              <a-menu-item key="excel">导出 Excel</a-menu-item>
              <a-menu-item key="pdf">导出 PDF</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <a-divider type="vertical" />
        <span>缩放</span>
        <a-slider v-model:value="zoom" :min="50" :max="200" :step="10" style="width: 120px" />
        <span>{{ zoom }}%</span>
      </a-space>
    </div>

    <ParameterForm
      v-if="hasParams"
      :params="params"
      @query="onQuery"
    />

    <div class="preview-body">
      <a-spin :spinning="loading" tip="渲染中...">
        <div v-if="renderResult" class="preview-content">
          <RenderedTable
            :grid="renderResult.grid"
            :row-heights="renderResult.rowHeights"
            :col-widths="renderResult.colWidths"
            :zoom="zoom"
            :condition-formats="conditionFormats"
          />
        </div>
        <a-empty v-else description="正在生成报表..." />
      </a-spin>
    </div>

    <!-- PDF 导出选项对话框 -->
    <a-modal v-model:open="pdfDialogVisible" title="PDF 导出选项" @ok="confirmPdfExport" width="420px">
      <a-form layout="vertical">
        <a-form-item label="纸张大小">
          <a-radio-group v-model:value="pdfOptions.paper">
            <a-radio value="A4">A4</a-radio>
            <a-radio value="A3">A3</a-radio>
            <a-radio value="letter">Letter</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="方向">
          <a-radio-group v-model:value="pdfOptions.landscape">
            <a-radio :value="false">纵向</a-radio>
            <a-radio :value="true">横向</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { DownOutlined } from '@ant-design/icons-vue'
import { useReportStore } from '@/stores/report'
import { ExpandEngine, type ExpandResult } from '@/core/engine/ExpandEngine'
import { Aggregator } from '@/core/engine/Aggregator'
import { ParameterEngine } from '@/core/parameter/ParameterEngine'
import type { ExportFormat } from '@/core/export/types'
import ParameterForm from '@/components/preview/ParameterForm.vue'
import RenderedTable from '@/components/render/RenderedTable.vue'
import { fetchData } from '@/core/datasource/ProviderRegistry'

const route = useRoute()
const router = useRouter()
const report = useReportStore()

const zoom = ref(100)
const loading = ref(false)
const exporting = ref(false)
const renderResult = ref<ExpandResult | null>(null)
const paramValues = ref<Record<string, unknown>>({})

const template = computed(() => report.currentTemplate)
const params = computed(() => template.value?.parameters ?? [])
const hasParams = computed(() => params.value.length > 0)
const conditionFormats = computed(() => template.value?.conditionFormats ?? [])

onMounted(async () => {
  const id = route.params.id as string
  if (id) {
    await report.open(id)
    // 自动渲染：无参数直接渲染；有参数则用默认值渲染（默认"全部"即展示全部数据）
    paramValues.value = ParameterEngine.getDefaultValues(params.value)
    await render()
  }
})

async function onQuery(values: Record<string, unknown>) {
  paramValues.value = values
  await render()
}

async function render() {
  if (!template.value || !report.grid) return
  loading.value = true
  try {
    // 1. 刷新数据集（重新取数），并重置原始数据备份
    for (const ds of template.value.dataSets) {
      const source = template.value.dataSources.find((s) => s.id === ds.sourceId)
      if (source) {
        ds.cachedRows = await fetchData(source, ds)
        ds.originalRows = undefined // 重置，让 applyToDataSets 重新备份
      }
    }
    // 2. 应用参数过滤
    if (hasParams.value) {
      ParameterEngine.applyToDataSets(template.value.dataSets, params.value, paramValues.value)
    }
    // 3. 展开引擎
    const engine = new ExpandEngine(
      report.grid.cells,
      report.grid.rows.map((r) => r.height),
      report.grid.columns.map((c) => c.width),
      template.value.dataSets,
      paramValues.value
    )
    const result = engine.expand()
    // 4. 聚合求值
    const aggregator = new Aggregator(result.grid)
    aggregator.evaluateAll()
    renderResult.value = result
  } catch (e: any) {
    message.error('渲染失败：' + (e.message ?? e))
    console.error(e)
  } finally {
    loading.value = false
  }
}

// ===== 导出 =====
const pdfDialogVisible = ref(false)
const pdfOptions = ref<{ paper: 'A4' | 'A3' | 'letter'; landscape: boolean }>({
  paper: 'A4',
  landscape: false
})
const pendingFormat = ref<ExportFormat | null>(null)

function onExport({ key }: { key: string }) {
  if (!renderResult.value) {
    message.warning('请先生成报表')
    return
  }
  const format = key as ExportFormat
  if (format === 'pdf') {
    pendingFormat.value = format
    pdfDialogVisible.value = true
  } else {
    doExport(format)
  }
}

async function confirmPdfExport() {
  pdfDialogVisible.value = false
  if (pendingFormat.value) {
    await doExport(pendingFormat.value)
    pendingFormat.value = null
  }
}

async function doExport(format: ExportFormat) {
  if (!renderResult.value || !template.value) return
  exporting.value = true
  try {
    // 动态导入导出器，避免首屏加载所有导出库
    const { createExporter } = await import('@/core/export/ExporterRegistry')
    const exporter = createExporter(format, conditionFormats.value)
    await exporter.export(
      renderResult.value.grid,
      renderResult.value.rowHeights,
      renderResult.value.colWidths,
      {
        format,
        fileName: template.value.name,
        title: template.value.name,
        paper: pdfOptions.value.paper,
        landscape: pdfOptions.value.landscape
      }
    )
    message.success(`已导出 ${format.toUpperCase()}`)
  } catch (e: any) {
    message.error('导出失败：' + (e.message ?? e))
    console.error(e)
  } finally {
    exporting.value = false
  }
}

function goBack() {
  const id = route.params.id
  router.push(`/designer/${id}`)
}
</script>

<style scoped>
.preview-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f0f2f5;
}

.preview-header {
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

.title {
  font-size: 16px;
  font-weight: 600;
  margin-left: 8px;
  color: #1f2329;
}

.preview-body {
  flex: 1;
  overflow: auto;
  padding: 24px;
}

.preview-content {
  display: inline-block;
  background: #fff;
  padding: 24px;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
</style>
