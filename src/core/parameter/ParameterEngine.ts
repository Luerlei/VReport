/**
 * 参数引擎
 * 管理参数默认值、校验、数据集过滤
 */
import type { Parameter, DataSet } from '@/types'
import type { DataRow } from '@/core/datasource/types'

export class ParameterEngine {
  /** 生成参数默认值表 */
  static getDefaultValues(params: Parameter[]): Record<string, unknown> {
    const values: Record<string, unknown> = {}
    for (const p of params) {
      values[p.name] = p.defaultValue ?? null
    }
    return values
  }

  /** 校验参数 */
  static validate(params: Parameter[], values: Record<string, unknown>): string[] {
    const errors: string[] = []
    for (const p of params) {
      if (p.required && (values[p.name] == null || values[p.name] === '')) {
        errors.push(`${p.label}(${p.name}) 为必填项`)
      }
    }
    return errors
  }

  /**
   * 按参数过滤数据集行（v0.1 本地过滤）
   * 约定：参数名匹配字段名时按相等过滤
   */
  static filterRows(rows: DataRow[], params: Parameter[], values: Record<string, unknown>): DataRow[] {
    let result = rows
    for (const p of params) {
      const val = values[p.name]
      if (val == null || val === '') continue
      result = result.filter((row) => {
        const cellVal = row[p.name]
        if (cellVal == null) return true
        return String(cellVal) === String(val)
      })
    }
    return result
  }

  /** 将参数值应用到数据集缓存（保留原始数据，避免重复过滤导致数据丢失） */
  static applyToDataSets(dataSets: DataSet[], params: Parameter[], values: Record<string, unknown>): void {
    for (const ds of dataSets) {
      // 首次应用：备份原始数据
      if (!ds.originalRows && ds.cachedRows) {
        ds.originalRows = ds.cachedRows
      }
      // 始终从原始数据过滤，避免基于已过滤数据再过滤
      const source = ds.originalRows ?? ds.cachedRows
      if (source) {
        ds.cachedRows = ParameterEngine.filterRows(source, params, values)
      }
    }
  }
}
