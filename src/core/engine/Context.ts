/**
 * 迭代展开上下文
 * 维护展开过程中的数据行、父级链、坐标范围
 */
import type { DataRow } from '@/core/datasource/types'
import type { EvalContext } from '@/core/expression/types'

/** 展开上下文 */
export interface ExpandContext extends EvalContext {
  /** 当前迭代层的数据行 */
  rowData?: DataRow
  /** 数据集名 */
  datasetName?: string
  /** 父级上下文 */
  parent?: ExpandContext
  /** 当前展开后在结果网格中的行范围 */
  rowRange: [number, number]
  /** 当前展开后在结果网格中的列范围 */
  colRange: [number, number]
}

/** 创建根上下文 */
export function createRootContext(params?: Record<string, unknown>): ExpandContext {
  return {
    rowRange: [0, 0],
    colRange: [0, 0],
    params
  }
}

/** 派生子上下文 */
export function deriveContext(
  parent: ExpandContext,
  rowData: DataRow,
  datasetName: string,
  rowRange: [number, number],
  colRange: [number, number]
): ExpandContext {
  return {
    rowData,
    datasetName,
    parent,
    rowRange,
    colRange
  }
}
