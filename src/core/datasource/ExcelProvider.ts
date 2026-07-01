/**
 * Excel 数据源 Provider
 * 使用 ExcelJS 解析 .xlsx 文件（与导出共用同一库，移除含 CVE 的 xlsx 依赖）
 * 文件内容以 base64 存于数据源 config.fileData
 */
import ExcelJS from 'exceljs'
import type { DataProvider, DataRow } from './types'
import type { DataSource, DataSet } from '@/types'

/** 单文件解析上限，防止超大文件导致浏览器内存溢出 */
const MAX_EXCEL_MB = 20
const MAX_EXCEL_BYTES = MAX_EXCEL_MB * 1024 * 1024

export class ExcelProvider implements DataProvider {
  readonly type = 'excel'

  async fetch(source: DataSource, dataSet: DataSet): Promise<DataRow[]> {
    // 文件二进制以 base64 存于 config.fileData
    const fileData = (source.config as { fileData?: string }).fileData
    if (!fileData) {
      throw new Error('Excel 文件未上传或内容为空')
    }
    // base64 长度约为字节数的 4/3，提前估算拦截超大文件
    if (Math.floor(fileData.length * 0.75) > MAX_EXCEL_BYTES) {
      throw new Error(`Excel 文件过大，超过 ${MAX_EXCEL_MB}MB 上限`)
    }
    const bytes = base64ToUint8Array(fileData)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(bytes.buffer as ArrayBuffer)

    const sheetName = dataSet.extractor.sheet ?? source.config.sheet
    const sheet = sheetName ? wb.getWorksheet(sheetName) : wb.worksheets[0]
    if (!sheet) {
      const names = wb.worksheets.map((w) => w.name).join(', ')
      throw new Error(`Sheet "${sheetName ?? ''}" 不存在，可用：${names}`)
    }

    const hasHeader = source.config.hasHeader ?? true
    return hasHeader ? readWithHeader(sheet) : readWithoutHeader(sheet)
  }
}

/** 规范化 ExcelJS 单元格值：公式取结果、富文本取文本、超链接取文字 */
function normalizeCellValue(value: ExcelJS.CellValue): unknown {
  if (value == null) return ''
  if (value instanceof Date) return value
  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>
    if ('result' in v) return v.result ?? ''
    if ('richText' in v && Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[]).map((t) => t.text ?? '').join('')
    }
    if ('text' in v) return v.text ?? ''
    if ('hyperlink' in v) return v.text ?? v.hyperlink ?? ''
    return ''
  }
  return value
}

/** 带表头解析：首行作为字段名 */
function readWithHeader(sheet: ExcelJS.Worksheet): DataRow[] {
  const headers: Record<number, string> = {}
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const name = String(normalizeCellValue(cell.value) ?? '').trim()
    headers[col] = name || `col${col - 1}`
  })
  const rows: DataRow[] = []
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const obj: DataRow = {}
    for (const key of Object.keys(headers)) {
      const col = Number(key)
      obj[headers[col]] = normalizeCellValue(row.getCell(col).value)
    }
    rows.push(obj)
  })
  return rows
}

/** 无表头解析：列号映射为 col0, col1... */
function readWithoutHeader(sheet: ExcelJS.Worksheet): DataRow[] {
  const colCount = sheet.actualColumnCount || sheet.columnCount
  const rows: DataRow[] = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const obj: DataRow = {}
    for (let col = 1; col <= colCount; col++) {
      obj[`col${col - 1}`] = normalizeCellValue(row.getCell(col).value)
    }
    rows.push(obj)
  })
  return rows
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
