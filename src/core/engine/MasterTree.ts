/**
 * 主格关系树
 * 扫描模板中所有展开单元格，构建父子关系
 */
import type { Cell } from '@/core/cell/types'

/** 主格树节点 */
export interface MasterNode {
  /** 对应的模板单元格 */
  cell: Cell
  /** 左主格节点 */
  leftParent?: MasterNode
  /** 上主格节点 */
  topParent?: MasterNode
  /** 子节点（以本节点为左主格的） */
  leftChildren: MasterNode[]
  /** 子节点（以本节点为上主格的） */
  topChildren: MasterNode[]
}

/**
 * 构建主格关系树
 * @param cells 模板单元格（二维数组）
 * @returns 根节点列表（无主格的展开单元格）
 */
export function buildMasterTree(cells: (Cell | null)[][]): MasterNode[] {
  // 1. 收集所有展开单元格，建立 name -> node 映射
  const nodeMap = new Map<string, MasterNode>()
  const allCells: Cell[] = []
  for (const row of cells) {
    for (const cell of row) {
      if (cell && cell.expandDirection !== 'none') {
        const node: MasterNode = {
          cell,
          leftChildren: [],
          topChildren: []
        }
        nodeMap.set(cell.name, node)
        allCells.push(cell)
      }
    }
  }

  // 2. 建立父子关系
  for (const cell of allCells) {
    const node = nodeMap.get(cell.name)!
    if (cell.leftMasterCell) {
      const parent = nodeMap.get(cell.leftMasterCell)
      if (parent) {
        node.leftParent = parent
        parent.leftChildren.push(node)
      }
    }
    if (cell.topMasterCell) {
      const parent = nodeMap.get(cell.topMasterCell)
      if (parent) {
        node.topParent = parent
        parent.topChildren.push(node)
      }
    }
  }

  // 3. 根节点：无左主格且无上主格的展开单元格
  const roots = Array.from(nodeMap.values()).filter((n) => !n.leftParent && !n.topParent)
  return roots
}

/**
 * 按展开方向分组根节点
 * 向下展开的根节点按行排序，向右展开的根节点按列排序
 */
export function sortRoots(roots: MasterNode[]): { downRoots: MasterNode[]; rightRoots: MasterNode[] } {
  const downRoots = roots
    .filter((r) => r.cell.expandDirection === 'down')
    .sort((a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col)
  const rightRoots = roots
    .filter((r) => r.cell.expandDirection === 'right')
    .sort((a, b) => a.cell.col - b.cell.col || a.cell.row - b.cell.row)
  return { downRoots, rightRoots }
}
