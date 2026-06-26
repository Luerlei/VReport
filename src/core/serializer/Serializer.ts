/**
 * 模板序列化/反序列化
 */
import { Grid } from '@/core/cell/Grid'
import { DEFAULT_PAGE, type ReportTemplate } from '@/types'
import { uid } from '@/utils/id'
import {
  DEFAULT_COL_COUNT,
  DEFAULT_ROW_COUNT,
  createCell
} from '@/core/cell/types'

/** 创建空白模板 */
export function createEmptyTemplate(name = '未命名报表'): ReportTemplate {
  const grid = new Grid(DEFAULT_ROW_COUNT, DEFAULT_COL_COUNT)
  const now = Date.now()
  return {
    id: uid('tpl_'),
    name,
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,
    page: { ...DEFAULT_PAGE },
    dataSources: [],
    dataSets: [],
    parameters: [],
    rows: grid.rows,
    columns: grid.columns,
    cells: grid.cells,
    styles: [],
    conditionFormats: [],
    description: '',
    tags: []
  }
}

/** 从模板恢复 Grid 实例 */
export function gridFromTemplate(template: ReportTemplate): Grid {
  return Grid.fromJSON({
    rows: template.rows,
    columns: template.columns,
    cells: template.cells
  })
}

/** 将 Grid 写回模板 */
export function gridToTemplate(grid: Grid, template: ReportTemplate): void {
  const data = grid.toJSON()
  template.rows = data.rows
  template.columns = data.columns
  template.cells = data.cells
}

/** 导出为 JSON 文件 */
export function exportTemplateFile(template: ReportTemplate): void {
  const json = JSON.stringify(template, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${template.name}.vreport.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** 从 JSON 文件导入模板 */
export function importTemplateFile(file: File): Promise<ReportTemplate> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as ReportTemplate
        // 重新生成 ID 避免冲突
        data.id = uid('tpl_')
        data.updatedAt = Date.now()
        resolve(data)
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}
