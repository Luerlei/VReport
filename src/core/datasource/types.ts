/**
 * 数据源 Provider 类型定义
 */
import type { DataSource, DataSet } from '@/types'

/** 取数结果行 */
export type DataRow = Record<string, unknown>

/** 数据源 Provider 统一接口 */
export interface DataProvider {
  /** Provider 类型标识 */
  readonly type: string
  /** 从数据源取数，返回对象数组 */
  fetch(source: DataSource, dataSet: DataSet): Promise<DataRow[]>
}

/** 字段元信息 */
export interface FieldInfo {
  name: string
  type: 'string' | 'number' | 'date' | 'boolean'
}

/** 工具：按点分路径取数组，如 "data.list" */
export function getByPath(obj: unknown, path?: string): unknown {
  if (!path) return obj
  let cur: unknown = obj
  for (const seg of path.split('.').filter(Boolean)) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

/** 工具：从任意值中提取数组 */
export function toArray(value: unknown): DataRow[] {
  if (Array.isArray(value)) return value as DataRow[]
  if (value == null) return []
  return [value as DataRow]
}

/** 工具：推断字段类型 */
export function inferType(value: unknown): FieldInfo['type'] {
  if (value == null || value === '') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string') {
    // 尝试识别日期
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(value)) return 'date'
    if (!isNaN(Number(value)) && value.trim() !== '') return 'number'
    return 'string'
  }
  return 'string'
}

/** 工具：从数据行数组提取字段元信息 */
export function extractFields(rows: DataRow[]): FieldInfo[] {
  if (!rows.length) return []
  const first = rows[0]
  return Object.keys(first).map((name) => ({
    name,
    type: inferType((first as Record<string, unknown>)[name])
  }))
}

/** 工具：按字段映射转换数据 */
export function applyFieldMapping(
  rows: DataRow[],
  fields?: { field: string; alias?: string; type?: 'string' | 'number' | 'date' }[]
): DataRow[] {
  if (!fields || !fields.length) return rows
  return rows.map((row) => {
    const out: DataRow = {}
    for (const f of fields) {
      const key = f.alias || f.field
      let val = row[f.field]
      if (f.type === 'number') val = val == null || val === '' ? null : Number(val)
      else if (f.type === 'string') val = val == null ? '' : String(val)
      else if (f.type === 'date') val = val == null ? null : new Date(val as string | number | Date)
      out[key] = val
    }
    return out
  })
}
