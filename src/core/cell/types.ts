/**
 * 单元格模型类型定义
 * 对齐 UReport 的单元格概念：坐标、合并、展开方向、主格关系、数据绑定、样式
 */

/** 单元格类型 */
export type CellType = 'text' | 'image' | 'chart' | 'formula' | 'qrcode' | 'barcode'

/** 展开方向 */
export type ExpandDirection = 'none' | 'down' | 'right'

/** 聚合方式 */
export type Aggregate = 'none' | 'sum' | 'avg' | 'count' | 'max' | 'min' | 'group' | 'distinct'

/** 水平对齐 */
export type HAlign = 'left' | 'center' | 'right'
/** 垂直对齐 */
export type VAlign = 'top' | 'middle' | 'bottom'

/** 边框样式 */
export interface BorderEdge {
  style: 'none' | 'solid' | 'dashed' | 'dotted'
  color: string
  width: number
}

/** 单元格样式 */
export interface CellStyle {
  fontFamily?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string
  background?: string
  hAlign?: HAlign
  vAlign?: VAlign
  wrap?: boolean
  indent?: number
  borderTop?: BorderEdge
  borderRight?: BorderEdge
  borderBottom?: BorderEdge
  borderLeft?: BorderEdge
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
}

/** 默认样式 */
export const DEFAULT_STYLE: CellStyle = {
  fontFamily: 'Microsoft YaHei',
  fontSize: 12,
  bold: false,
  italic: false,
  underline: false,
  color: '#1f2329',
  background: '#ffffff',
  hAlign: 'left',
  vAlign: 'middle',
  wrap: false,
  indent: 0,
  paddingTop: 2,
  paddingRight: 4,
  paddingBottom: 2,
  paddingLeft: 4
}

/** 单元格数据模型 */
export interface Cell {
  id: string
  /** 显示名 A1, B2（由坐标计算得出，不持久化） */
  name: string
  /** 行索引 0-based */
  row: number
  /** 列索引 0-based */
  col: number
  /** 行合并数（含自身，1 表示未合并） */
  rowSpan: number
  /** 列合并数 */
  colSpan: number
  /** 原始内容（文本或表达式） */
  content: string
  cellType: CellType
  expandDirection: ExpandDirection
  /** 左主格名，控制向下展开时的分组父级 */
  leftMasterCell?: string
  /** 上主格名，控制向右展开时的分组父级 */
  topMasterCell?: string
  /** 绑定的数据集名 */
  dataset?: string
  /** 绑定字段名 */
  fieldName?: string
  /** 聚合方式 */
  aggregate?: Aggregate
  /** 单元格局部样式（覆盖命名样式） */
  style: CellStyle
  /** 引用的命名样式 ID */
  styleId?: string
  /** 数字格式 "#,##0.00" */
  numberFormat?: string
  /** 日期格式 "yyyy-MM-dd" */
  dateFormat?: string
  /** 条件格式 ID 列表 */
  conditionIds?: string[]
  /** 图表配置 */
  chartConfig?: import('@/types').ChartConfig
  /** 图片配置 */
  imageConfig?: import('@/types').ImageConfig
  /** 二维码配置 */
  qrConfig?: import('@/types').QRConfig
  /** 条码配置 */
  barcodeConfig?: import('@/types').BarcodeConfig
  /** 备注 */
  remark?: string
}

/** 行配置 */
export interface RowConfig {
  index: number
  /** 行高 px */
  height: number
  hidden?: boolean
  pageBreakBefore?: boolean
  repeat?: boolean
}

/** 列配置 */
export interface ColumnConfig {
  index: number
  /** 列宽 px */
  width: number
  hidden?: boolean
  freeze?: boolean
}

/** 默认行高 */
export const DEFAULT_ROW_HEIGHT = 28
/** 默认列宽 */
export const DEFAULT_COL_WIDTH = 100
/** 初始行数 */
export const DEFAULT_ROW_COUNT = 30
/** 初始列数 */
export const DEFAULT_COL_COUNT = 12

/**
 * 列索引转字母名（0 -> A, 25 -> Z, 26 -> AA）
 */
export function colIndexToName(col: number): string {
  let name = ''
  let n = col
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name
    n = Math.floor(n / 26) - 1
  }
  return name
}

/**
 * 行列索引转单元格名（0,0 -> A1）
 */
export function cellName(row: number, col: number): string {
  return `${colIndexToName(col)}${row + 1}`
}

/**
 * 创建默认单元格
 */
export function createCell(row: number, col: number): Cell {
  return {
    id: `${cellName(row, col)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: cellName(row, col),
    row,
    col,
    rowSpan: 1,
    colSpan: 1,
    content: '',
    cellType: 'text',
    expandDirection: 'none',
    style: { ...DEFAULT_STYLE }
  }
}
