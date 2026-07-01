/**
 * CSV 数据源 Provider
 * 使用 PapaParse 解析 CSV 文本
 */
import Papa from 'papaparse'
import type { DataProvider, DataRow } from './types'
import type { DataSource, DataSet } from '@/types'

export class CsvProvider implements DataProvider {
  readonly type = 'csv'

  async fetch(source: DataSource, _dataSet: DataSet): Promise<DataRow[]> {
    const raw = source.config.rawCsv ?? ''
    if (!raw.trim()) return []
    const hasHeader = source.config.hasHeader ?? true
    const delimiter = source.config.delimiter || ','
    const result = Papa.parse(raw, {
      header: hasHeader,
      delimiter,
      skipEmptyLines: true,
      dynamicTyping: true
    })
    if (result.errors?.length) {
      const first = result.errors[0]
      const detail = `第 ${(first.row ?? 0) + 1} 行：${first.message}`
      // 完全无法解析出任何数据时抛出明确错误，避免静默丢数据
      if (!result.data || result.data.length === 0) {
        throw new Error(`CSV 解析失败（${detail}）`)
      }
      // 部分行异常但仍有数据：保留可用数据并告警，便于排查
      console.warn(
        `[CsvProvider] ${result.errors.length} 处解析告警，已跳过异常行。首条：${detail}`
      )
    }
    return (result.data as DataRow[]) ?? []
  }
}
