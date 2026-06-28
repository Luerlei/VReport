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

  // 数据行（向下展开，绑定 ds）
  const fields = ['region', 'product', 'salesperson', 'amount', 'qty', '']
  fields.forEach((f, i) => {
    const c = grid.cells[2][i]!
    if (f) c.content = `\${ds.${f}}`
    else c.content = '=round(${ds.amount}/${ds.qty},2)'
    c.dataset = 'ds'
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
    name: 'ds',
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
    if (f) c.content = `\${ds.${f}}`
    else c.content = '=if(${ds.score}>=90,"优秀",if(${ds.score}>=80,"良好",if(${ds.score}>=60,"及格","不及格")))'
    c.dataset = 'ds'
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
    name: 'ds',
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

/** 重新写入种子数据（开发调试用） */
export async function reseedTemplates(): Promise<void> {
  await db.templates.clear()
  await saveTemplate(buildSalesTemplate())
  await saveTemplate(buildScoreTemplate())
  await saveTemplate(buildFormulaTemplate())
}

/** 构建公式测试报表模板（覆盖全部 40+ 函数） */
function buildFormulaTemplate(): ReportTemplate {
  const grid = new Grid(52, 7)
  grid.columns[0].width = 110
  grid.columns[1].width = 200
  grid.columns[2].width = 200
  grid.columns[3].width = 140
  grid.columns[4].width = 200
  grid.columns[5].width = 200
  grid.columns[6].width = 140

  // ===== 标题行 =====
  const title = grid.cells[0][0]!
  title.content = 'VReport 公式函数完整示例'
  style(title, TITLE_STYLE)
  grid.merge(0, 0, 0, 6)

  // ===== 列头行 =====
  const colHeaders = ['分类', '函数', '示例公式', '示例结果', '说明', '备选公式', '备选说明']
  colHeaders.forEach((h, i) => {
    const c = grid.cells[1][i]!
    c.content = h
    style(c, HEADER_STYLE)
  })

  // ===== 数据集 =====
  const FORMULA_JSON = JSON.stringify([{
    num1: 10, num2: 20, num3: 30,
    text1: 'Hello', text2: 'World', text3: '  trimmed  ',
    empty: '', neg: -8, price: 25, qty: 4, rate: 0.255,
    date1: '2024-01-15', date2: '2024-01-01'
  }])

  const ds: DataSource = {
    id: uid('ds_'), name: 'formulaDS', type: 'json',
    config: { rawJson: FORMULA_JSON, dataPath: '' }, createdAt: Date.now()
  }
  const dataSet: DataSet = {
    id: uid('set_'), name: 'ds', sourceId: ds.id, extractor: {}
  }

  /** 在指定行写入一个函数示例 */
  function funcRow(rowIdx: number, label: string, formula: string, desc: string,
    altFormula?: string, altDesc?: string) {
    const c0 = grid.cells[rowIdx][0]!
    c0.content = label
    style(c0, DATA_STYLE)
    const c1 = grid.cells[rowIdx][1]!
    c1.content = formula
    c1.cellType = 'formula'
    style(c1, DATA_STYLE)
    const c2 = grid.cells[rowIdx][2]!
    c2.content = desc
    style(c2, DATA_STYLE)
    if (altFormula) {
      grid.cells[rowIdx][3]!.content = altFormula
      grid.cells[rowIdx][3]!.cellType = 'formula'
      style(grid.cells[rowIdx][3]!, DATA_STYLE)
      if (altDesc) {
        grid.cells[rowIdx][4]!.content = altDesc
        style(grid.cells[rowIdx][4]!, DATA_STYLE)
      }
    }
  }

  // ===== 运算符 section header =====
  grid.cells[2][0]!.content = '运算符'
  style(grid.cells[2][0]!, HEADER_STYLE)
  grid.merge(2, 0, 2, 6)

  // 数据行（向下展开，绑定 ds）
  const dataRow = 3
  const numCell = grid.cells[dataRow][0]!
  numCell.content = '${ds.num1}'; numCell.dataset = 'ds'; numCell.fieldName = 'num1'
  numCell.expandDirection = 'down'
  style(numCell, DATA_STYLE)
  const textCell = grid.cells[dataRow][1]!
  textCell.content = '${ds.text1}'; textCell.dataset = 'ds'; textCell.fieldName = 'text1'
  textCell.leftMasterCell = 'A' + (dataRow + 1)
  style(textCell, DATA_STYLE)
  const negCell = grid.cells[dataRow][2]!
  negCell.content = '${ds.neg}'; negCell.dataset = 'ds'; negCell.fieldName = 'neg'
  negCell.leftMasterCell = 'A' + (dataRow + 1)
  style(negCell, DATA_STYLE)

  // 运算符列标签/公式/结果
  const labelRow = 3
  const fRow = 4
  const rRow = 5

  // 标签行
  grid.cells[labelRow][0]!.content = '数据值'; style(grid.cells[labelRow][0]!, DATA_STYLE)
  grid.cells[labelRow][1]!.content = '10（num1）'; style(grid.cells[labelRow][1]!, DATA_STYLE)
  grid.cells[labelRow][2]!.content = 'Hello（text1）'; style(grid.cells[labelRow][2]!, DATA_STYLE)
  grid.cells[labelRow][3]!.content = '20（num2）'; style(grid.cells[labelRow][3]!, DATA_STYLE)
  grid.cells[labelRow][4]!.content = '-8（neg）'; style(grid.cells[labelRow][4]!, DATA_STYLE)
  grid.cells[labelRow][5]!.content = 'true'; style(grid.cells[labelRow][5]!, DATA_STYLE)
  // 公式行
  grid.cells[fRow][0]!.content = '公式'; style(grid.cells[fRow][0]!, HEADER_STYLE)
  grid.cells[fRow][1]!.content = '=${ds.num1}+${ds.num2}'; grid.cells[fRow][1]!.cellType = 'formula'; style(grid.cells[fRow][1]!, DATA_STYLE)
  grid.cells[fRow][2]!.content = '=${ds.text1}&${ds.text2}'; grid.cells[fRow][2]!.cellType = 'formula'; style(grid.cells[fRow][2]!, DATA_STYLE)
  grid.cells[fRow][3]!.content = '=${ds.num2}/${ds.num1}'; grid.cells[fRow][3]!.cellType = 'formula'; style(grid.cells[fRow][3]!, DATA_STYLE)
  grid.cells[fRow][4]!.content = '=abs(${ds.neg})'; grid.cells[fRow][4]!.cellType = 'formula'; style(grid.cells[fRow][4]!, DATA_STYLE)
  grid.cells[fRow][5]!.content = '=if(${ds.num1}>15,"大","小")'; grid.cells[fRow][5]!.cellType = 'formula'; style(grid.cells[fRow][5]!, DATA_STYLE)
  // 结果行
  grid.cells[rRow][0]!.content = '预期结果'; style(grid.cells[rRow][0]!, DATA_STYLE)
  grid.cells[rRow][1]!.content = '30'; style(grid.cells[rRow][1]!, DATA_STYLE)
  grid.cells[rRow][2]!.content = 'HelloWorld'; style(grid.cells[rRow][2]!, DATA_STYLE)
  grid.cells[rRow][3]!.content = '2'; style(grid.cells[rRow][3]!, DATA_STYLE)
  grid.cells[rRow][4]!.content = '8'; style(grid.cells[rRow][4]!, DATA_STYLE)
  grid.cells[rRow][5]!.content = '"小"（10不大于15）'; style(grid.cells[rRow][5]!, DATA_STYLE)

  // ===== 聚合函数 section =====
  grid.cells[6][0]!.content = '聚合函数（基于 ${ds.num1}:${ds.num3} = 10, 20, 30）'; style(grid.cells[6][0]!, HEADER_STYLE)
  grid.merge(6, 0, 6, 6)
  funcRow(7, 'sum', '=sum(${ds.num1},${ds.num2},${ds.num3})', '10+20+30=60')
  funcRow(8, 'avg', '=avg(${ds.num1}:${ds.num3})', '(10+20+30)/3≈20')
  funcRow(9, 'count', '=count(${ds.num1}:${ds.num3})', '计数：3')
  funcRow(10, 'max', '=max(${ds.num1}:${ds.num3})', '最大：30')
  funcRow(11, 'min', '=min(${ds.num1}:${ds.num3})', '最小：10')
  funcRow(12, 'distinct', '=distinct(${ds.num1}:${ds.num3})', '去重：3（全部不同）')

  // ===== 数学函数 section =====
  grid.cells[13][0]!.content = '数学函数'; style(grid.cells[13][0]!, HEADER_STYLE)
  grid.merge(13, 0, 13, 6)
  funcRow(14, 'abs', '=abs(${ds.neg})', '|-8|=8')
  funcRow(15, 'round', '=round(${ds.price}/${ds.num1},1)', '2.5→3')
  funcRow(16, 'ceil', '=ceil(${ds.price}/${ds.num1})', '向上取整：3')
  funcRow(17, 'floor', '=floor(${ds.price}/${ds.num1})', '向下取整：2')
  funcRow(18, 'sqrt', '=round(sqrt(${ds.num1}),2)', '√10≈3.16')
  funcRow(19, 'pow', '=pow(${ds.num1},2)', '10²=100')
  funcRow(20, 'mod', '=mod(${ds.num2},3)', '20%3=2')
  funcRow(21, 'rand', '=rand()', '0~1之间的随机数')

  // ===== 字符串函数 section =====
  grid.cells[22][0]!.content = '字符串函数'; style(grid.cells[22][0]!, HEADER_STYLE)
  grid.merge(22, 0, 22, 6)
  funcRow(23, 'concat', '=concat(${ds.text1},${ds.text2})', 'HelloWorld')
  funcRow(24, 'len', '=len(${ds.text1})', 'Hello长度=5')
  funcRow(25, 'upper', '=upper(${ds.text1})', 'HELLO', '=lower(${ds.text1})', 'hello')
  funcRow(26, 'lower', '=lower(${ds.text1})', 'hello')
  funcRow(27, 'substring', '=substring(${ds.text1},0,3)', 'Hel（substr(0,3)）')
  funcRow(28, 'replace', '=replace("abc123","123","")', 'abc')
  funcRow(29, 'trim', '=trim(${ds.text3})', '"trimmed"（去空格）')
  funcRow(30, 'indexOf', '=indexOf("Hello","ll")', '2（"ll"在位置2）')

  // ===== 逻辑函数 section =====
  grid.cells[31][0]!.content = '逻辑函数'; style(grid.cells[31][0]!, HEADER_STYLE)
  grid.merge(31, 0, 31, 6)
  funcRow(32, 'if', '=if(${ds.num1}>15,"大","小")', '10不大于15→"小"', '=if(${ds.num1}<25,"在范围内","超出")', '10<25→"在范围内"')
  funcRow(33, 'and', '=and(${ds.num1}>5,${ds.num2}>15)', '10>5且20>15→true')
  funcRow(34, 'or', '=or(${ds.num1}>15,${ds.num2}>15)', '20>15→true')
  funcRow(35, 'not', '=not(${ds.num1}>15)', '10不大于15→true')
  funcRow(36, 'case', '=case(${ds.num1},10,"十",20,"二十","其他")', '10→"十"')
  funcRow(37, 'isempty', '=isempty(${ds.empty})', '空字符串→true')
  funcRow(38, 'isnull', '=isnull(${ds.empty})', '非null→false')

  // ===== 格式化函数 section =====
  grid.cells[39][0]!.content = '格式化函数'; style(grid.cells[39][0]!, HEADER_STYLE)
  grid.merge(39, 0, 39, 6)
  funcRow(40, 'numberFormat', '=numberFormat(3.14159,2)', '3.14', '=numberFormat(2.5,0)', '3（四舍五入）')
  funcRow(41, 'currency', '=currency(${ds.price})', '¥25.00', '=currency(1000)', '¥1000.00')
  funcRow(42, 'percent', '=percent(${ds.rate})', '25.50%', '=percent(1)', '100.00%')
  funcRow(43, 'format', '=format(${ds.price},",##0")', '25', '=format(1234567,",##0")', '1,234,567')

  // ===== 日期函数 section =====
  grid.cells[44][0]!.content = '日期函数'; style(grid.cells[44][0]!, HEADER_STYLE)
  grid.merge(44, 0, 44, 6)
  funcRow(45, 'today', '=today()', '当前日期（运行时）')
  funcRow(46, 'year', '=year(${ds.date1})', '2024')
  funcRow(47, 'month', '=month(${ds.date1})', '1（1月）')
  funcRow(48, 'day', '=day(${ds.date1})', '15')
  funcRow(49, 'formatDate', '=formatDate(${ds.date1},"YYYY年MM月DD日")', '2024年01月15日')
  funcRow(50, 'dateDiff', '=dateDiff(${ds.date2},${ds.date1},"day")', '14（天）')

  const now = Date.now()
  return {
    id: uid('tpl_'), name: '公式函数完整示例',
    version: '1.0.0', createdAt: now, updatedAt: now,
    page: { ...DEFAULT_PAGE },
    dataSources: [ds], dataSets: [dataSet],
    parameters: [], rows: grid.rows, columns: grid.columns,
    cells: grid.cells, styles: [], conditionFormats: [],
    description: 'VReport 支持的全部 40+ 公式函数完整示例，覆盖聚合、数学、字符串三大类，每个函数均提供实际公式与预期结果',
    tags: ['公式', '示例', '函数']
  }
}

/** 检查并写入种子数据 */
export async function seedTemplatesIfEmpty(): Promise<void> {
  const existing = await listTemplates()
  if (existing.length > 0) return
  await saveTemplate(buildSalesTemplate())
  await saveTemplate(buildScoreTemplate())
  await saveTemplate(buildFormulaTemplate())
}
