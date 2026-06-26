/**
 * Provider 注册中心
 * 根据数据源类型获取对应 Provider，并提供统一取数入口
 */
import type { DataProvider, DataRow, FieldInfo } from './types'
import { applyFieldMapping, extractFields } from './types'
import { JsonProvider } from './JsonProvider'
import { CsvProvider } from './CsvProvider'
import { ExcelProvider } from './ExcelProvider'
import { FileProvider } from './FileProvider'
import type { DataSource, DataSet } from '@/types'

const providers = new Map<string, DataProvider>()

function register(provider: DataProvider) {
  providers.set(provider.type, provider)
}

register(new JsonProvider())
register(new CsvProvider())
register(new ExcelProvider())
register(new FileProvider())

/** 取数：按数据源类型查找 Provider，应用字段映射后返回 */
export async function fetchData(
  source: DataSource,
  dataSet: DataSet
): Promise<DataRow[]> {
  const provider = providers.get(source.type)
  if (!provider) {
    throw new Error(`未注册的数据源类型：${source.type}`)
  }
  const rows = await provider.fetch(source, dataSet)
  return applyFieldMapping(rows, dataSet.extractor.fields)
}

/** 仅取数并返回字段元信息（供数据集配置时预览字段） */
export async function fetchFields(
  source: DataSource,
  dataSet: DataSet
): Promise<{ fields: FieldInfo[]; sampleRows: DataRow[] }> {
  const provider = providers.get(source.type)
  if (!provider) {
    throw new Error(`未注册的数据源类型：${source.type}`)
  }
  const rows = await provider.fetch(source, dataSet)
  return {
    fields: extractFields(rows),
    sampleRows: rows.slice(0, 10)
  }
}
