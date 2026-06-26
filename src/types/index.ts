/**
 * 报表模板与数据源相关类型
 */
import { Cell, CellStyle, ColumnConfig, RowConfig } from '@/core/cell/types'

/** 数据源类型 */
export type DataSourceType = 'json' | 'csv' | 'excel' | 'file'

/** 数据源配置 */
export interface DataSourceConfig {
  /** JSON 粘贴内容 */
  rawJson?: string
  /** CSV 粘贴内容 */
  rawCsv?: string
  /** 上传文件名 */
  fileName?: string
  /** 文件格式 */
  format?: 'json' | 'csv' | 'xlsx'
  /** Excel sheet 名 */
  sheet?: string
  /** 首行是否表头 */
  hasHeader?: boolean
  /** CSV 分隔符 */
  delimiter?: string
  /** JSON 取数路径 */
  dataPath?: string
}

/** 数据源 */
export interface DataSource {
  id: string
  name: string
  type: DataSourceType
  config: DataSourceConfig
  createdAt: number
}

/** 字段映射 */
export interface FieldMapping {
  field: string
  alias?: string
  type?: 'string' | 'number' | 'date'
}

/** 数据集 */
export interface DataSet {
  id: string
  name: string
  sourceId: string
  extractor: {
    path?: string
    sheet?: string
    fields?: FieldMapping[]
  }
  /** 缓存的取数结果（经参数过滤后） */
  cachedRows?: Record<string, unknown>[]
  /** 原始取数结果（未经参数过滤，用于重复查询时还原） */
  originalRows?: Record<string, unknown>[]
}

/** 参数类型 */
export type ParamType =
  | 'string'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiSelect'

/** 报表参数 */
export interface Parameter {
  id: string
  name: string
  label: string
  type: ParamType
  defaultValue?: unknown
  required?: boolean
  options?: { value: string | number; label: string }[]
  width?: number
}

/** 命名样式 */
export interface StyleDef {
  id: string
  name: string
  style: CellStyle
}

/** 条件格式规则 */
export interface ConditionRule {
  id: string
  type: 'cellValue' | 'expression'
  operator?: 'gt' | 'lt' | 'eq' | 'ge' | 'le' | 'ne' | 'between' | 'contains'
  value?: unknown
  expression?: string
  style: Partial<CellStyle>
}

/** 条件格式 */
export interface ConditionFormat {
  id: string
  name: string
  scope: string
  rules: ConditionRule[]
}

/** 页面配置 */
export interface PageConfig {
  paper: 'A4' | 'A3' | 'B5' | 'letter' | 'custom'
  width?: number
  height?: number
  orientation: 'portrait' | 'landscape'
  margin: { top: number; right: number; bottom: number; left: number }
  headerRows?: number
}

/** 报表模板 */
export interface ReportTemplate {
  id: string
  name: string
  version: string
  createdAt: number
  updatedAt: number
  page: PageConfig
  dataSources: DataSource[]
  dataSets: DataSet[]
  parameters: Parameter[]
  rows: RowConfig[]
  columns: ColumnConfig[]
  cells: (Cell | null)[][]
  styles: StyleDef[]
  conditionFormats: ConditionFormat[]
  description?: string
  tags?: string[]
}

/** 默认页面配置 */
export const DEFAULT_PAGE: PageConfig = {
  paper: 'A4',
  orientation: 'portrait',
  margin: { top: 20, right: 20, bottom: 20, left: 20 },
  headerRows: 0
}

/** 图表类型 */
export type ChartType = 'bar' | 'line' | 'pie' | 'radar' | 'scatter' | 'area' | 'funnel'

/** 图表系列 */
export interface ChartSeries {
  name: string
  valueField: string
  type?: string
  stack?: string
}

/** 图表配置 */
export interface ChartConfig {
  type: ChartType
  dataset?: string
  categoryField?: string
  series: ChartSeries[]
  title?: string
  legend?: boolean
  width?: number
  height?: number
  echartsOption?: object
}

/** 图片配置 */
export interface ImageConfig {
  /** 图片来源:本地(base64嵌入) 或 URL */
  source: 'url' | 'base64'
  /** URL 引用(可使用 ${param.xxx} 表达式) */
  url?: string
  /** base64 数据(不含 data: 前缀) */
  base64?: string
  /** MIME 类型,如 image/png */
  mimeType?: string
  /** 显示宽度(px),0 表示自适应单元格 */
  width?: number
  /** 显示高度(px),0 表示自适应单元格 */
  height?: number
  /** 缩放模式 */
  fit?: 'fill' | 'contain' | 'cover' | 'none'
}

/** 二维码配置 */
export interface QRConfig {
  /** 数据来源(静态文本或 ${ds1.field} / ${param.name} 表达式) */
  data: string
  /** 纠错等级 */
  errorCorrectLevel?: 'L' | 'M' | 'Q' | 'H'
  /** 像素大小(px),默认 4 */
  size?: number
  /** 前景色 */
  foreground?: string
  /** 背景色 */
  background?: string
  /** 边距(px) */
  margin?: number
}

/** 条码类型(对齐 JsBarcode 支持的常见类型) */
export type BarcodeFormat =
  | 'CODE128'
  | 'CODE39'
  | 'EAN13'
  | 'EAN8'
  | 'UPC'
  | 'ITF14'
  | 'MSI'
  | 'pharmacode'
  | 'codabar'

/** 条码配置 */
export interface BarcodeConfig {
  /** 数据来源(静态文本或 ${ds1.field} / ${param.name} 表达式) */
  data: string
  /** 条码类型 */
  format: BarcodeFormat
  /** 显示宽度(px) */
  width?: number
  /** 显示高度(px) */
  height?: number
  /** 是否在底部显示文本 */
  displayValue?: boolean
  /** 前景色 */
  foreground?: string
  /** 背景色 */
  background?: string
}
