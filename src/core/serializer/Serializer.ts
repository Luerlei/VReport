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

/**
 * 当前模板结构版本。每次对持久化结构做不兼容变更时递增，
 * 并在 migrateTemplate 中补充对应迁移逻辑。
 */
export const CURRENT_SCHEMA_VERSION = 1

/** 创建空白模板 */
export function createEmptyTemplate(name = '未命名报表'): ReportTemplate {
  const grid = new Grid(DEFAULT_ROW_COUNT, DEFAULT_COL_COUNT)
  const now = Date.now()
  return {
    id: uid('tpl_'),
    name,
    version: '1.0.0',
    schemaVersion: CURRENT_SCHEMA_VERSION,
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

/**
 * 校验并迁移导入的模板到当前结构版本。
 * 对缺失版本号的旧模板按 v1 处理并补齐必要字段，避免 `as` 强转导致运行时崩溃。
 */
export function migrateTemplate(raw: Partial<ReportTemplate>): ReportTemplate {
  if (!raw || typeof raw !== 'object') {
    throw new Error('模板内容无效')
  }
  if (!Array.isArray(raw.cells) || !Array.isArray(raw.rows) || !Array.isArray(raw.columns)) {
    throw new Error('模板缺少必要的网格数据（rows/columns/cells）')
  }
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `模板版本（v${version}）高于当前支持版本（v${CURRENT_SCHEMA_VERSION}），请升级应用后再导入`
    )
  }
  // 预留逐版本迁移位置：
  // if (version < 2) { ...将 v1 迁移到 v2... }

  const now = Date.now()
  return {
    id: raw.id ?? uid('tpl_'),
    name: raw.name ?? '未命名报表',
    version: raw.version ?? '1.0.0',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    page: raw.page ?? { ...DEFAULT_PAGE },
    dataSources: raw.dataSources ?? [],
    dataSets: raw.dataSets ?? [],
    parameters: raw.parameters ?? [],
    rows: raw.rows,
    columns: raw.columns,
    cells: raw.cells,
    styles: raw.styles ?? [],
    conditionFormats: raw.conditionFormats ?? [],
    description: raw.description ?? '',
    tags: raw.tags ?? []
  }
}

/** 从 JSON 文件导入模板 */
export function importTemplateFile(file: File): Promise<ReportTemplate> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string) as Partial<ReportTemplate>
        const data = migrateTemplate(raw)
        // 重新生成 ID 避免冲突
        data.id = uid('tpl_')
        data.updatedAt = Date.now()
        resolve(data)
      } catch (e) {
        reject(e instanceof Error ? e : new Error('模板文件解析失败'))
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}
