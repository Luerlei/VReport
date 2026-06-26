<template>
  <a-modal
    :open="visible"
    title="插入图表"
    width="780px"
    :destroyOnClose="true"
    @ok="onOk"
    @cancel="onCancel"
  >
    <div class="chart-dialog-body">
      <div class="config-side">
        <a-form layout="vertical" size="small">
          <a-form-item label="图表类型">
            <a-select v-model:value="form.type" @change="onTypeChange">
              <a-select-option value="bar">柱状图</a-select-option>
              <a-select-option value="line">折线图</a-select-option>
              <a-select-option value="area">面积图</a-select-option>
              <a-select-option value="pie">饼图</a-select-option>
              <a-select-option value="radar">雷达图</a-select-option>
              <a-select-option value="scatter">散点图</a-select-option>
              <a-select-option value="funnel">漏斗图</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="标题">
            <a-input v-model:value="form.title" placeholder="可选" />
          </a-form-item>

          <a-form-item label="数据集">
            <a-select
              v-model:value="form.dataset"
              placeholder="选择数据集"
              allow-clear
              @change="onDatasetChange"
            >
              <a-select-option
                v-for="ds in report.currentTemplate?.dataSets ?? []"
                :key="ds.id"
                :value="ds.name"
              >{{ ds.name }}</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item v-if="form.type !== 'pie' && form.type !== 'funnel'" label="分类字段">
            <a-select
              v-model:value="form.categoryField"
              placeholder="X轴/分类字段"
              allow-clear
            >
              <a-select-option v-for="f in fields" :key="f" :value="f">{{ f }}</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="系列(数值字段)">
            <div v-for="(s, i) in form.series" :key="i" class="series-row">
              <a-input v-model:value="s.name" placeholder="系列名" style="flex: 0 0 90px" />
              <a-select v-model:value="s.valueField" placeholder="字段" style="flex: 1">
                <a-select-option v-for="f in fields" :key="f" :value="f">{{ f }}</a-select-option>
              </a-select>
              <a-button size="small" danger @click="removeSeries(i)">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <a-button size="small" type="dashed" block @click="addSeries">
              <template #icon><PlusOutlined /></template>
              添加系列
            </a-button>
          </a-form-item>

          <a-row :gutter="8">
            <a-col :span="12">
              <a-form-item label="宽度(px)">
                <a-input-number v-model:value="form.width" :min="100" :max="1200" style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="高度(px)">
                <a-input-number v-model:value="form.height" :min="80" :max="800" style="width: 100%" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item>
            <a-checkbox v-model:checked="form.legend">显示图例</a-checkbox>
          </a-form-item>
        </a-form>
      </div>

      <div class="preview-side">
        <div class="preview-title">实时预览</div>
        <div ref="previewRef" class="preview-chart" :style="{ width: '100%', height: '280px' }"></div>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import * as echarts from 'echarts'
import { useReportStore } from '@/stores/report'
import type { ChartConfig, ChartSeries, ChartType } from '@/types'

const props = defineProps<{ visible: boolean; initial?: ChartConfig }>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'confirm', config: ChartConfig): void
}>()

const report = useReportStore()

const form = reactive<ChartConfig>({
  type: 'bar',
  dataset: undefined,
  categoryField: undefined,
  series: [],
  title: '',
  legend: true,
  width: 360,
  height: 240
})

const previewRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

/** 当前数据集的字段列表 */
const fields = computed<string[]>(() => {
  if (!form.dataset) return []
  const ds = report.currentTemplate?.dataSets.find((d) => d.name === form.dataset)
  if (ds?.extractor.fields?.length) {
    return ds.extractor.fields.map((f) => f.alias ?? f.field)
  }
  // 从缓存行推断字段
  if (ds?.cachedRows?.length) {
    return Object.keys(ds.cachedRows[0])
  }
  return []
})

watch(
  () => props.visible,
  (v) => {
    if (v) {
      Object.assign(form, {
        type: 'bar',
        dataset: undefined,
        categoryField: undefined,
        series: [],
        title: '',
        legend: true,
        width: 360,
        height: 240,
        ...(props.initial ?? {})
      })
      nextTick(() => {
        initChart()
        renderPreview()
      })
    }
  },
  { immediate: true }
)

watch(form, renderPreview, { deep: true })

onMounted(() => {
  if (props.visible) {
    nextTick(() => {
      initChart()
      renderPreview()
    })
  }
})

onUnmounted(() => {
  chart?.dispose()
  chart = null
})

function initChart() {
  if (previewRef.value && !chart) {
    chart = echarts.init(previewRef.value)
  }
}

function onTypeChange() {
  renderPreview()
}

function onDatasetChange() {
  form.categoryField = undefined
  form.series = []
  renderPreview()
}

function addSeries() {
  form.series.push({ name: `系列${form.series.length + 1}`, valueField: '' } as ChartSeries)
}

function removeSeries(i: number) {
  form.series.splice(i, 1)
}

function renderPreview() {
  if (!chart) return
  const ds = report.currentTemplate?.dataSets.find((d) => d.name === form.dataset)
  const rows = ds?.cachedRows ?? []
  const option = buildOption(form, rows)
  chart.setOption(option, true)
}

function buildOption(config: ChartConfig, rows: Record<string, unknown>[]) {
  const sampleRows = rows.length ? rows : generateSampleRows()
  const categories = config.categoryField
    ? sampleRows.map((r) => String(r[config.categoryField!] ?? ''))
    : sampleRows.map((_, i) => `类别${i + 1}`)

  const baseTitle = config.title ? { title: { text: config.title, left: 'center', textStyle: { fontSize: 14 } } } : {}
  const baseLegend = config.legend && config.series.length > 1 ? { legend: { bottom: 0, textStyle: { fontSize: 11 } } } : {}
  const baseTooltip = { tooltip: { trigger: config.type === 'pie' || config.type === 'funnel' ? 'item' : 'axis' } }

  if (config.type === 'pie') {
    const valueField = config.series[0]?.valueField
    return {
      ...baseTitle,
      ...baseLegend,
      ...baseTooltip,
      series: [
        {
          type: 'pie',
          radius: '60%',
          data: sampleRows.map((r) => ({
            name: String(r[config.categoryField ?? ''] ?? ''),
            value: Number(r[valueField ?? ''] ?? 0)
          }))
        }
      ]
    }
  }

  if (config.type === 'funnel') {
    const valueField = config.series[0]?.valueField
    return {
      ...baseTitle,
      ...baseLegend,
      ...baseTooltip,
      series: [
        {
          type: 'funnel',
          data: sampleRows.map((r) => ({
            name: String(r[config.categoryField ?? ''] ?? ''),
            value: Number(r[valueField ?? ''] ?? 0)
          }))
        }
      ]
    }
  }

  if (config.type === 'radar') {
    const indicators = config.series.map((s) => ({ name: s.name, max: 100 }))
    const values = config.series.map((s) =>
      sampleRows.map((r) => Number(r[s.valueField] ?? 0))
    )
    return {
      ...baseTitle,
      ...baseLegend,
      ...baseTooltip,
      radar: { indicator: indicators.length ? indicators : [{ name: 'A', max: 100 }] },
      series: [{ type: 'radar', data: [{ value: values.flat() || [40, 60, 80, 70, 50] }] }]
    }
  }

  if (config.type === 'scatter') {
    return {
      ...baseTitle,
      ...baseLegend,
      ...baseTooltip,
      xAxis: { type: 'value' },
      yAxis: { type: 'value' },
      series: config.series.length
        ? config.series.map((s) => ({
            name: s.name,
            type: 'scatter',
            data: sampleRows.map((r) => [Number(r[config.categoryField ?? ''] ?? 0), Number(r[s.valueField] ?? 0)])
          }))
        : [{ type: 'scatter', data: [[10, 20], [30, 40]] }]
    }
  }

  // bar / line / area
  const seriesType = config.type === 'area' ? 'line' : config.type
  return {
    ...baseTitle,
    ...baseLegend,
    ...baseTooltip,
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value' },
    series: config.series.length
      ? config.series.map((s) => ({
          name: s.name,
          type: seriesType as 'bar' | 'line',
          areaStyle: config.type === 'area' ? {} : undefined,
          data: sampleRows.map((r) => Number(r[s.valueField] ?? 0))
        }))
      : [
          {
            type: seriesType as 'bar' | 'line',
            areaStyle: config.type === 'area' ? {} : undefined,
            data: sampleRows.map((_, i) => 20 + i * 10)
          }
        ]
  }
}

function generateSampleRows(): Record<string, unknown>[] {
  return [
    { category: 'A', value: 30, value2: 20 },
    { category: 'B', value: 50, value2: 40 },
    { category: 'C', value: 70, value2: 60 },
    { category: 'D', value: 90, value2: 80 }
  ]
}

function onOk() {
  if (form.series.length === 0) {
    message.warning('请至少添加一个系列')
    return
  }
  if (form.series.some((s) => !s.valueField)) {
    message.warning('请为每个系列选择字段')
    return
  }
  emit('confirm', JSON.parse(JSON.stringify(form)))
  emit('update:visible', false)
}

function onCancel() {
  emit('update:visible', false)
}
</script>

<style scoped>
.chart-dialog-body {
  display: flex;
  gap: 16px;
}

.config-side {
  flex: 1;
  min-width: 0;
}

.preview-side {
  width: 320px;
  flex-shrink: 0;
  padding: 12px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
}

.preview-title {
  font-size: 12px;
  color: #595959;
  margin-bottom: 8px;
}

.preview-chart {
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 2px;
}

.series-row {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
  align-items: center;
}
</style>
