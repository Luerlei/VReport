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
      // 不抛错，仅记录，部分行可能仍可用
      console.warn('[CsvProvider] 解析警告', result.errors)
    }
    return (result.data as DataRow[]) ?? []
  }
}
