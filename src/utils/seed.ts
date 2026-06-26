/**
 * 预制模板种子数据
 * 首次启动时若 IndexedDB 为空，自动写入两个示例报表
 */
import type { ReportTemplate, DataSource, DataSet } from '@/types'
import { DEFAULT_PAGE } from '@/types'
import { Grid } from '@/core/cell/Grid'
import { createCell, DEFAULT_STYLE, type CellStyle, type BorderEdge } from '@/core/cell/types'
import { uid } from '@/utils/id'
import { db, listTemplates, saveTemplate } from '@/utils/db'

/** 通用边框 */
const BORDER: BorderEdge = { style: 'solid', color: '#333', width: 1 }
/** 表头样式 */
const HEADER_STYLE: CellStyle = {
  ...DEFAULT_STYLE,
  bold: true,
  hAlign: 'center',
  vAlign: 'middle',
  background: '#e6f4ff',
  color: '#1677ff',
  borderTop: { ...BORDER },
  borderRight: { ...BORDER },
  borderBottom: { ...BORDER },
  borderLeft: { ...BORDER }
}
/** 标题样式 */
const TITLE_STYLE: CellStyle = {
  ...DEFAULT_STYLE,
  bold: true,
  fontSize: 16,
  hAlign: 'center',
  vAlign: 'middle'
}
/** 数据单元格样式 */
const DATA_STYLE: CellStyle = {
  ...DEFAULT_STYLE,
  hAlign: 'center',
  vAlign: 'middle',
  borderTop: { ...BORDER },
  borderRight: { ...BORDER },
  borderBottom: { ...BORDER },
  borderLeft: { ...BORDER }
}
/** 汇总样式 */
const SUM_STYLE: CellStyle = {
  ...DATA_STYLE,
  bold: true,
  background: '#fff7e6',
  color: '#fa8c16'
}

/** 应用样式到单元格 */
function style(cell: ReturnType<typeof createCell>, s: CellStyle): typeof cell {
  cell.style = { ...s }
  return cell
}

/** 销售明细数据集（JSON） */
const SALES_JSON = `[
  {"region":"华东","product":"笔记本","salesperson":"张三","amount":12500,"qty":5},
  {"region":"华东","product":"平板","salesperson":"张三","amount":8800,"qty":8},
  {"region":"华东","product":"手机","salesperson":"李四","amount":15600,"qty":12},
  {"region":"华南","product":"笔记本","salesperson":"王五","amount":9800,"qty":4},
  {"region":"华南","product":"平板","salesperson":"王五","amount":7200,"qty":6},
  {"region":"华南","product":"手机","salesperson":"赵六","amount":18900,"qty":15},
  {"region":"华北","product":"笔记本","salesperson":"孙七","amount":11200,"qty":5},
  {"region":"华北","product":"手机","salesperson":"孙七","amount":13400,"qty":11},
  {"region":"西南","product":"平板","salesperson":"周八","amount":6400,"qty":5},
  {"region":"西南","product":"手机","salesperson":"周八","amount":9700,"qty":8}
]`

/** 成绩统计数据集（JSON） */
const SCORE_JSON = `[
  {"class":"一班","name":"张明","subject":"语文","score":88},
  {"class":"一班","name":"张明","subject":"数学","score":95},
  {"class":"一班","name":"李华","subject":"语文","score":92},
  {"class":"一班","name":"李华","subject":"数学","score":86},
  {"class":"一班","name":"王芳","subject":"语文","score":76},
  {"class":"一班","name":"王芳","subject":"数学","score":91},
  {"class":"二班","name":"刘强","subject":"语文","score":82},
  {"class":"二班","name":"刘强","subject":"数学","score":88},
  {"class":"二班","name":"陈伟","subject":"语文","score":91},
  {"class":"二班","name":"陈伟","subject":"数学","score":79},
  {"class":"二班","name":"黄丽","subject":"语文","score":85},
  {"class":"二班","name":"黄丽","subject":"数学","score":93}
]`

/** 构建销售明细报表模板 */
function buildSalesTemplate(): ReportTemplate {
  const grid = new Grid(8, 6)
  // 列宽
  grid.columns[0].width = 80
  grid.columns[1].width = 100
  grid.columns[2].width = 100
  grid.columns[3].width = 120
  grid.columns[4].width = 100
  grid.columns[5].width = 100

  // 标题行 A1:F1 合并
  const title = grid.cells[0][0]!
  title.content = '销售明细报表'
  style(title, TITLE_STYLE)
  grid.merge(0, 0, 0, 5)

  // 表头行
  const headers = ['区域', '产品', '销售员', '销售额(元)', '数量', '平均单价']
  headers.forEach((h, i) => {
    const c = grid.cells[1][i]!
    c.content = h
    style(c, HEADER_STYLE)
  })

  // 数据行（向下展开，绑定 ds1）
  const fields = ['region', 'product', 'salesperson', 'amount', 'qty', '']
  fields.forEach((f, i) => {
    const c = grid.cells[2][i]!
    if (f) c.content = `\${ds1.${f}}`
    else c.content = '=round(${ds1.amount}/${ds1.qty},2)'
    c.dataset = 'ds1'
    c.fieldName = f || undefined
    c.expandDirection = i === 0 ? 'down' : 'none'
    c.leftMasterCell = i === 0 ? undefined : 'A3'
    c.numberFormat = i === 3 ? '#,##0.00' : undefined
    style(c, DATA_STYLE)
  })

  // 汇总行
  const sumLabels = ['合计', '', '', '=sum(D3:D100)', '=sum(E3:E100)', '']
  sumLabels.forEach((s, i) => {
    const c = grid.cells[3][i]!
    c.content = s
    if (s.startsWith('=')) c.cellType = 'formula'
    if (i === 3) c.numberFormat = '#,##0.00'
    style(c, SUM_STYLE)
  })
  // 合并 A4:C4
  grid.merge(3, 0, 3, 2)

  // 数据源
  const ds: DataSource = {
    id: uid('ds_'),
    name: 'salesSource',
    type: 'json',
    config: { rawJson: SALES_JSON, dataPath: '' },
    createdAt: Date.now()
  }
  const dataSet: DataSet = {
    id: uid('set_'),
    name: 'ds1',
    sourceId: ds.id,
    extractor: {}
  }

  const now = Date.now()
  return {
    id: uid('tpl_'),
    name: '销售明细报表',
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,
    page: { ...DEFAULT_PAGE },
    dataSources: [ds],
    dataSets: [dataSet],
    parameters: [
      {
        id: uid('param_'),
        name: 'region',
        label: '区域',
        type: 'select',
        defaultValue: '',
        required: false,
        options: [
          { value: '', label: '全部' },
          { value: '华东', label: '华东' },
          { value: '华南', label: '华南' },
          { value: '华北', label: '华北' },
          { value: '西南', label: '西南' }
        ]
      },
      {
        id: uid('param_'),
        name: 'minAmount',
        label: '最低销售额',
        type: 'number',
        defaultValue: '0',
        required: false
      }
    ],
    rows: grid.rows,
    columns: grid.columns,
    cells: grid.cells,
    styles: [],
    conditionFormats: [],
    description: '按区域/产品/销售员展示销售明细，含合计与平均单价公式，支持区域和销售额参数筛选',
    tags: ['销售', '明细', '参数']
  }
}

/** 构建成绩统计报表模板 */
function buildScoreTemplate(): ReportTemplate {
  const grid = new Grid(7, 5)
  grid.columns[0].width = 80
  grid.columns[1].width = 100
  grid.columns[2].width = 100
  grid.columns[3].width = 100
  grid.columns[4].width = 100

  // 标题
  const title = grid.cells[0][0]!
  title.content = '学生成绩统计表'
  style(title, TITLE_STYLE)
  grid.merge(0, 0, 0, 4)

  // 表头
  const headers = ['班级', '姓名', '科目', '分数', '等级']
  headers.forEach((h, i) => {
    const c = grid.cells[1][i]!
    c.content = h
    style(c, HEADER_STYLE)
  })

  // 数据行（向下展开）
  const fields = ['class', 'name', 'subject', 'score', '']
  fields.forEach((f, i) => {
    const c = grid.cells[2][i]!
    if (f) c.content = `\${ds1.${f}}`
    else c.content = '=if(${ds1.score}>=90,"优秀",if(${ds1.score}>=80,"良好",if(${ds1.score}>=60,"及格","不及格")))'
    c.dataset = 'ds1'
    c.fieldName = f || undefined
    c.expandDirection = i === 0 ? 'down' : 'none'
    c.leftMasterCell = i === 0 ? undefined : 'A3'
    style(c, DATA_STYLE)
  })

  // 平均分汇总
  const sumCells = ['平均分', '', '', '=round(avg(D3:D100),2)', '']
  sumCells.forEach((s, i) => {
    const c = grid.cells[3][i]!
    c.content = s
    if (s.startsWith('=')) c.cellType = 'formula'
    if (i === 3) c.numberFormat = '0.00'
    style(c, SUM_STYLE)
  })
  grid.merge(3, 0, 3, 2)

  // 数据源
  const ds: DataSource = {
    id: uid('ds_'),
    name: 'scoreSource',
    type: 'json',
    config: { rawJson: SCORE_JSON, dataPath: '' },
    createdAt: Date.now()
  }
  const dataSet: DataSet = {
    id: uid('set_'),
    name: 'ds1',
    sourceId: ds.id,
    extractor: {}
  }

  const now = Date.now()
  return {
    id: uid('tpl_'),
    name: '学生成绩统计表',
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,
    page: { ...DEFAULT_PAGE },
    dataSources: [ds],
    dataSets: [dataSet],
    parameters: [
      {
        id: uid('param_'),
        name: 'class',
        label: '班级',
        type: 'select',
        defaultValue: '',
        required: false,
        options: [
          { value: '', label: '全部' },
          { value: '一班', label: '一班' },
          { value: '二班', label: '二班' }
        ]
      },
      {
        id: uid('param_'),
        name: 'subject',
        label: '科目',
        type: 'select',
        defaultValue: '',
        required: false,
        options: [
          { value: '', label: '全部' },
          { value: '语文', label: '语文' },
          { value: '数学', label: '数学' }
        ]
      },
      {
        id: uid('param_'),
        name: 'passScore',
        label: '及格线',
        type: 'number',
        defaultValue: '60',
        required: false
      }
    ],
    rows: grid.rows,
    columns: grid.columns,
    cells: grid.cells,
    styles: [],
    conditionFormats: [],
    description: '按班级/姓名/科目展示成绩，含等级判定与平均分汇总，支持班级、科目、及格线参数筛选',
    tags: ['教育', '成绩', '参数']
  }
}

/** 检查并写入种子数据 */
export async function seedTemplatesIfEmpty(): Promise<void> {
  const existing = await listTemplates()
  if (existing.length > 0) return
  await saveTemplate(buildSalesTemplate())
  await saveTemplate(buildScoreTemplate())
}

/** 重新写入种子数据（开发调试用） */
export async function reseedTemplates(): Promise<void> {
  await db.templates.clear()
  await saveTemplate(buildSalesTemplate())
  await saveTemplate(buildScoreTemplate())
}
