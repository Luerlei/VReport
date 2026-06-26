/**
 * JSON 数据源 Provider
 * 从粘贴的 JSON 文本解析数组，支持按路径取数
 */
import type { DataProvider, DataRow } from './types'
import type { DataSource, DataSet } from '@/types'
import { getByPath, toArray } from './types'

export class JsonProvider implements DataProvider {
  readonly type = 'json'

  async fetch(source: DataSource, dataSet: DataSet): Promise<DataRow[]> {
    const raw = source.config.rawJson ?? ''
    if (!raw.trim()) return []
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error('JSON 格式错误，无法解析')
    }
    // 数据集可覆盖取数路径
    const path = dataSet.extractor.path ?? source.config.dataPath
    const value = getByPath(parsed, path)
    return toArray(value)
  }
}
