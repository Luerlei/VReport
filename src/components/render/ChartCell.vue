<template>
  <div ref="chartRef" class="chart-cell-render" :style="style"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as echarts from 'echarts'
import type { ChartConfig } from '@/types'
import type { ExpandContext } from '@/core/engine/Context'
import type { DataRow } from '@/core/datasource/types'
import { useReportStore } from '@/stores/report'

const props = defineProps<{
  config?: ChartConfig
  context?: ExpandContext
  width?: number
  height?: number
}>()

const report = useReportStore()
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

const width = computed(() => props.width ?? props.config?.width ?? 300)
const height = computed(() => props.height ?? props.config?.height ?? 200)
const style = computed(() => ({ width: width.value + 'px', height: height.value + 'px' }))

onMounted(() => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
    renderChart()
  }
})

onUnmounted(() => {
  chart?.dispose()
  chart = null
})

// config 变化时用 setOption(notMerge=true) 清理旧 series,无需销毁实例
watch(() => props.config, renderChart, { deep: true })

// 尺寸变化时 resize
watch([width, height], () => {
  chart?.resize({ width: width.value, height: height.value })
})

function renderChart() {
  if (!chart || !props.config) return
  const rows = getDatasetRows()
  const option = buildOption(props.config, rows)
  chart.setOption(option, true)
}

/** 获取图表绑定数据集的所有行 */
function getDatasetRows(): DataRow[] {
  const dsName = props.config?.dataset
  if (!dsName) return []
  // 1. 从当前模板的数据集中查找
  const ds = report.currentTemplate?.dataSets.find((d) => d.name === dsName)
  if (ds?.cachedRows?.length) return ds.cachedRows
  // 2. 兜底:从上下文链中查找
  let ctx: ExpandContext | undefined = props.context
  while (ctx) {
    if (ctx.rowData && ctx.datasetName === dsName) return [ctx.rowData]
    ctx = ctx.parent
  }
  return []
}

function buildOption(config: ChartConfig, rows: DataRow[]): echarts.EChartsOption {
  // 无数据时使用样例数据,避免图表空白
  const data = rows.length ? rows : generateSampleData()
  const categories = config.categoryField
    ? data.map((row) => String(row[config.categoryField!] ?? ''))
    : data.map((_, i) => `类别${i + 1}`)

  const baseTitle = config.title ? { title: { text: config.title, left: 'center', textStyle: { fontSize: 14 } } } : {}
  const baseLegend = config.legend && config.series.length > 1
    ? { legend: { bottom: 0, textStyle: { fontSize: 11 } } }
    : {}
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
          data: data.map((row) => ({
            name: String(row[config.categoryField ?? ''] ?? ''),
            value: Number(row[valueField ?? ''] ?? 0)
          }))
        }
      ]
    } as echarts.EChartsOption
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
          data: data.map((row) => ({
            name: String(row[config.categoryField ?? ''] ?? ''),
            value: Number(row[valueField ?? ''] ?? 0)
          }))
        }
      ]
    } as echarts.EChartsOption
  }

  if (config.type === 'radar') {
    const indicators = config.series.map((s) => ({ name: s.name, max: 100 }))
    const values = config.series.map((s) =>
      data.map((row) => Number(row[s.valueField] ?? 0))
    )
    return {
      ...baseTitle,
      ...baseLegend,
      ...baseTooltip,
      radar: { indicator: indicators.length ? indicators : [{ name: 'A', max: 100 }] },
      series: [{ type: 'radar', data: [{ value: values.flat() || [40, 60, 80, 70, 50] }] }]
    } as echarts.EChartsOption
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
            data: data.map((row) => [
              Number(row[config.categoryField ?? ''] ?? 0),
              Number(row[s.valueField] ?? 0)
            ])
          }))
        : [{ type: 'scatter', data: [[10, 20], [30, 40]] }]
    } as echarts.EChartsOption
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
          data: data.map((row) => Number(row[s.valueField] ?? 0))
        }))
      : [
          {
            type: seriesType as 'bar' | 'line',
            areaStyle: config.type === 'area' ? {} : undefined,
            data: data.map((_, i) => 20 + i * 10)
          }
        ]
  } as echarts.EChartsOption
}

function generateSampleData(): DataRow[] {
  return [
    { category: 'A', value: 30, value2: 20 },
    { category: 'B', value: 50, value2: 40 },
    { category: 'C', value: 70, value2: 60 },
    { category: 'D', value: 90, value2: 80 }
  ]
}
</script>

<style scoped>
.chart-cell-render {
  width: 100%;
  height: 100%;
}
</style>
