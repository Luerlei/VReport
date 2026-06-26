/**
 * 通用文件上传 Provider
 * 根据文件格式委托给对应解析器
 */
import type { DataProvider, DataRow } from './types'
import type { DataSource, DataSet } from '@/types'
import { JsonProvider } from './JsonProvider'
import { CsvProvider } from './CsvProvider'
import { ExcelProvider } from './ExcelProvider'

export class FileProvider implements DataProvider {
  readonly type = 'file'

  private jsonProvider = new JsonProvider()
  private csvProvider = new CsvProvider()
  private excelProvider = new ExcelProvider()

  async fetch(source: DataSource, dataSet: DataSet): Promise<DataRow[]> {
    const format = source.config.format ?? inferFormat(source.config.fileName)
    switch (format) {
      case 'json':
        return this.jsonProvider.fetch(source, dataSet)
      case 'csv':
        return this.csvProvider.fetch(source, dataSet)
      case 'xlsx':
        return this.excelProvider.fetch(source, dataSet)
      default:
        throw new Error(`不支持的文件格式：${format}`)
    }
  }
}

function inferFormat(fileName?: string): 'json' | 'csv' | 'xlsx' {
  if (!fileName) return 'json'
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
  return 'json'
}
