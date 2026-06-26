/**
 * Excel 数据源 Provider
 * 使用 SheetJS (xlsx) 解析 .xlsx 文件
 * 文件内容以 base64 存储在数据源 config.fileName 中（P0 仅存名，P1 改为存内容）
 */
import * as XLSX from 'xlsx'
import type { DataProvider, DataRow } from './types'
import type { DataSource, DataSet } from '@/types'

export class ExcelProvider implements DataProvider {
  readonly type = 'excel'

  async fetch(source: DataSource, dataSet: DataSet): Promise<DataRow[]> {
    // 文件二进制以 base64 存于 config.fileData
    const fileData = (source.config as any).fileData as string | undefined
    if (!fileData) {
      throw new Error('Excel 文件未上传或内容为空')
    }
    const bytes = base64ToUint8Array(fileData)
    const wb = XLSX.read(bytes, { type: 'array' })
    // 数据集可指定 sheet，否则取第一个
    const sheetName = dataSet.extractor.sheet ?? source.config.sheet ?? wb.SheetNames[0]
    const sheet = wb.Sheets[sheetName]
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" 不存在，可用：${wb.SheetNames.join(', ')}`)
    }
    const hasHeader = source.config.hasHeader ?? true
    const rows = XLSX.utils.sheet_to_json<DataRow>(sheet, {
      header: hasHeader ? undefined : 1,
      defval: '',
      raw: true
    })
    // 无表头时，将数组行转为 {col0, col1...}
    if (!hasHeader) {
      return rows.map((row) => {
        if (Array.isArray(row)) {
          const obj: DataRow = {}
          ;(row as unknown[]).forEach((v, i) => (obj[`col${i}`] = v))
          return obj
        }
        return row
      })
    }
    return rows
  }
}

/** base64 转 Uint8Array */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 读取 File 为 base64（供 UI 上传时调用） */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // data:xxx;base64,xxxx
      const base64 = result.split(',')[1] ?? ''
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
