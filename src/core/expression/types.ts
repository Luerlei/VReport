/**
 * 表达式引擎类型定义
 */

/** Token 类型 */
export enum TokenType {
  Number = 'Number',
  String = 'String',
  Boolean = 'Boolean',
  Identifier = 'Identifier',     // 函数名或变量名
  CellRef = 'CellRef',           // 单元格引用 A1, $A$1
  FieldRef = 'FieldRef',         // 字段引用 ${xxx} 内部内容
  LParen = 'LParen',             // (
  RParen = 'RParen',             // )
  Comma = 'Comma',               // ,
  Colon = 'Colon',               // : (区域)
  OpPlus = 'OpPlus',
  OpMinus = 'OpMinus',
  OpMul = 'OpMul',
  OpDiv = 'OpDiv',
  OpMod = 'OpMod',
  OpConcat = 'OpConcat',         // &
  OpEq = 'OpEq',
  OpNe = 'OpNe',
  OpGt = 'OpGt',
  OpLt = 'OpLt',
  OpGe = 'OpGe',
  OpLe = 'OpLe',
  EOF = 'EOF'
}

/** Token */
export interface Token {
  type: TokenType
  value: string
  pos: number
}

/** AST 节点类型 */
export enum AstType {
  Number = 'Number',
  String = 'String',
  Boolean = 'Boolean',
  FieldRef = 'FieldRef',
  CellRef = 'CellRef',
  CellRange = 'CellRange',
  BinaryOp = 'BinaryOp',
  UnaryOp = 'UnaryOp',
  FunctionCall = 'FunctionCall'
}

/** AST 节点 */
export type AstNode =
  | { type: AstType.Number; value: number }
  | { type: AstType.String; value: string }
  | { type: AstType.Boolean; value: boolean }
  | { type: AstType.FieldRef; path: string }
  | { type: AstType.CellRef; col: number; row: number; colAbs: boolean; rowAbs: boolean; raw: string }
  | { type: AstType.CellRange; start: AstNode; end: AstNode }
  | { type: AstType.BinaryOp; op: TokenType; left: AstNode; right: AstNode }
  | { type: AstType.UnaryOp; op: TokenType; operand: AstNode }
  | { type: AstType.FunctionCall; name: string; args: AstNode[] }

/** 求值上下文 */
export interface EvalContext {
  /** 当前数据行（字段取值来源） */
  rowData?: Record<string, unknown>
  /** 所有数据集行缓存（用于 ${ds.field} 动态聚合） */
  datasetRows?: Record<string, Record<string, unknown>[]>
  /** 参数值 */
  params?: Record<string, unknown>
  /** 单元格取值回调（用于单元格引用） */
  getCell?: (col: number, row: number) => unknown
  /** 区域取值回调（用于聚合） */
  getRange?: (startCol: number, startRow: number, endCol: number, endRow: number) => unknown[]
  /** 父级上下文（字段沿父链向上查找） */
  parent?: EvalContext
}

/** 表达式分类 */
export type ExprType = 'text' | 'simple' | 'formula'

/** 分析表达式类型 */
export function classifyExpr(content: string): ExprType {
  if (!content) return 'text'
  if (content.startsWith('=')) return 'formula'
  if (content.includes('${')) return 'simple'
  return 'text'
}
