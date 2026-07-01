import type { ReportTemplate } from '@/types'

/** 获取指定数据集可选字段(去重,保序) */
export function getDatasetFieldOptions(template: ReportTemplate | null, dsName?: string): string[] {
  if (!template || !dsName) return []
  const ds = template.dataSets.find((item) => item.name === dsName)
  if (!ds) return []

  const fromMapping = (ds.extractor.fields ?? [])
    .map((f) => f.alias || f.field)
    .filter((f): f is string => Boolean(f))
  const fromCached = ds.cachedRows?.length ? Object.keys(ds.cachedRows[0]) : []

  return Array.from(new Set([...fromMapping, ...fromCached]))
}

/** 字段值若不属于当前数据集字段，返回空字符串 */
export function normalizeFieldValueForDataset(fieldValue: string, fields: string[]): string {
  return fields.includes(fieldValue) ? fieldValue : ''
}

/**
 * 判断单元格是否为“数据集变量”单元格，并返回其 `dataset.field`。
 * 优先取显式绑定(dataset/fieldName)，否则回退解析内容中的单个 `${ds.field}`。
 * 用于条件格式范围：数据集变量的范围随数据量动态适配，应显示为变量而非固定坐标。
 */
export function datasetVarOfCell(
  cell: { dataset?: string; fieldName?: string; content?: string } | null | undefined
): string | null {
  if (!cell) return null
  if (cell.dataset && cell.fieldName) return `${cell.dataset}.${cell.fieldName}`
  const content = (cell.content ?? '').trim()
  const m = content.match(/^\$\{([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\}$/)
  if (m) return `${m[1]}.${m[2]}`
  return null
}
