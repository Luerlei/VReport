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

/** 公式测试数据集（JSON）：名称/类别/数量/单价/日期 */
const FORMULA_TEST_JSON = `[
  {"name":"苹果","cat":"水果","spec":"12个/箱","qty":10,"price":3.5,"date":"2024-01-15"},
  {"name":"香蕉","cat":"水果","spec":"8把/箱","qty":20,"price":2.0,"date":"2024-02-20"},
  {"name":"萝卜","cat":"蔬菜","spec":"10kg/筐","qty":15,"price":1.5,"date":"2024-03-10"},
  {"name":"白菜","cat":"蔬菜","spec":"20kg/袋","qty":25,"price":1.0,"date":"2024-04-05"}
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

/** 构建公式功能测试模板（覆盖全部 40 个内置函数） */
function buildFormulaTestTemplate(): ReportTemplate {
  // 标量函数测试用例：[类别, 函数, 参数1, 参数2, 参数3, 公式(占位 {C}{D}{E}→本行单元格), 预期]
  // 参数值写入本行 C/D/E 数据单元格，公式以单元格地址引用它们（Excel 风格）
  const SCALAR_TESTS: [string, string, string, string, string, string, string][] = [
    // 数学
    ['数学', 'abs', '-7', '', '', '=abs({C})', '7'],
    ['数学', 'round', '3.14159', '2', '', '=round({C},{D})', '3.14'],
    ['数学', 'ceil', '4.2', '', '', '=ceil({C})', '5'],
    ['数学', 'floor', '4.8', '', '', '=floor({C})', '4'],
    ['数学', 'sqrt', '16', '', '', '=sqrt({C})', '4'],
    ['数学', 'pow', '2', '10', '', '=pow({C},{D})', '1024'],
    ['数学', 'mod', '17', '5', '', '=mod({C},{D})', '2'],
    ['数学', 'rand', '—', '', '', '=if(and(rand()>=0,rand()<1),"OK","NG")', 'OK'],
    // 字符串
    ['字符串', 'concat', 'Hello', 'World', '', '=concat({C},{D})', 'HelloWorld'],
    ['字符串', 'len', 'hello', '', '', '=len({C})', '5'],
    ['字符串', 'upper', 'abc', '', '', '=upper({C})', 'ABC'],
    ['字符串', 'lower', 'XYZ', '', '', '=lower({C})', 'xyz'],
    ['字符串', 'substring', 'abcdef', '1', '3', '=substring({C},{D},{E})', 'bcd'],
    ['字符串', 'replace', 'a-b-c', '-', '_', '=replace({C},{D},{E})', 'a_b_c'],
    ['字符串', 'trim', ' hi ', '', '', '=trim({C})', 'hi'],
    ['字符串', 'indexOf', 'hello', 'll', '', '=indexOf({C},{D})', '2'],
    // 聚合（横向区域引用 {C}:{E}，对本行 3 个数据单元格求值）
    ['聚合', 'sum', '10', '20', '30', '=sum({C}:{E})', '60'],
    ['聚合', 'avg', '2', '4', '6', '=avg({C}:{E})', '4'],
    ['聚合', 'count', '1', '2', '3', '=count({C}:{E})', '3'],
    ['聚合', 'max', '3', '9', '5', '=max({C}:{E})', '9'],
    ['聚合', 'min', '3', '9', '5', '=min({C}:{E})', '3'],
    ['聚合', 'distinct', 'a', 'b', 'a', '=distinct({C}:{E})', '2'],
    // 日期
    ['日期', 'now', '—', '', '', '=if(year(now())>=2024,"OK","NG")', 'OK'],
    ['日期', 'today', '—', '', '', '=dateDiff(today(),now(),"day")', '0'],
    ['日期', 'year', '2024-05-15', '', '', '=year({C})', '2024'],
    ['日期', 'month', '2024-05-15', '', '', '=month({C})', '5'],
    ['日期', 'day', '2024-05-15', '', '', '=day({C})', '15'],
    ['日期', 'formatDate', '2024-05-15', 'YYYY/MM/DD', '', '=formatDate({C},{D})', '2024/05/15'],
    ['日期', 'dateDiff', '2024-01-01', '2024-01-11', 'day', '=dateDiff({C},{D},{E})', '10'],
    // 逻辑
    ['逻辑', 'if', '5', '3', '', '=if({C}>{D},"是","否")', '是'],
    ['逻辑', 'and', '1', '2', '', '=if(and({C}>0,{D}>0),"T","F")', 'T'],
    ['逻辑', 'or', '-1', '2', '', '=if(or({C}>0,{D}>0),"T","F")', 'T'],
    ['逻辑', 'not', '1', '2', '', '=if(not({C}>{D}),"T","F")', 'T'],
    ['逻辑', 'case', '2', '', '', '=case({C},"1","一","2","二","其他")', '二'],
    ['逻辑', 'isnull', '', '', '', '=if(isnull({C}),"是null","非null")', '非null'],
    ['逻辑', 'isempty', '', '', '', '=if(isempty({C}),"空","非空")', '空'],
    // 格式化
    ['格式化', 'format', '1234567.891', '#,##0.00', '', '=format({C},{D})', '1,234,567.89'],
    ['格式化', 'numberFormat', '3.14159', '2', '', '=numberFormat({C},{D})', '3.14'],
    ['格式化', 'currency', '99.5', '', '', '=currency({C})', '¥99.50'],
    ['格式化', 'percent', '0.1234', '', '', '=percent({C})', '12.34%']
  ]

  const INPUT_STYLE: CellStyle = { ...DATA_STYLE, background: '#e6f7ff', color: '#0958d9' }
  const FORMULA_TEXT_STYLE: CellStyle = { ...DATA_STYLE, hAlign: 'left', color: '#666666' }
  const FORMULA_RESULT_STYLE: CellStyle = { ...DATA_STYLE, bold: true, background: '#f6ffed', color: '#389e0d' }
  const EXPECT_STYLE: CellStyle = { ...DATA_STYLE, color: '#8c8c8c' }
  const SECTION_STYLE: CellStyle = { ...HEADER_STYLE, hAlign: 'left' }

  const SCALAR_START = 3 // 标量数据行起始 grid index（第 4 行）
  const DATA_HEADER = SCALAR_START + SCALAR_TESTS.length + 2 // 数据表头 grid index
  const rowCount = DATA_HEADER + 6
  const grid = new Grid(rowCount, 8)
  grid.columns[0].width = 64 // 类别
  grid.columns[1].width = 96 // 函数
  grid.columns[2].width = 96 // 参数1
  grid.columns[3].width = 96 // 参数2
  grid.columns[4].width = 96 // 参数3
  grid.columns[5].width = 250 // 公式
  grid.columns[6].width = 140 // 结果
  grid.columns[7].width = 110 // 预期

  // 大标题
  const title = grid.cells[0][0]!
  title.content = '公式功能测试模板（参数取自单元格，Excel 风格）'
  style(title, TITLE_STYLE)
  grid.merge(0, 0, 0, 7)

  // 一、标量函数测试标题
  const sec1 = grid.cells[1][0]!
  sec1.content = '一、标量函数测试（参数写入 C/D/E 单元格，公式以单元格地址引用；“结果”应等于“预期”）'
  style(sec1, SECTION_STYLE)
  grid.merge(1, 0, 1, 7)

  // 标量表头
  ;['类别', '函数', '参数1', '参数2', '参数3', '公式（引用单元格）', '结果', '预期'].forEach((h, i) => {
    const c = grid.cells[2][i]!
    c.content = h
    style(c, HEADER_STYLE)
  })

  // 标量测试行：参数填入 C/D/E，公式引用本行单元格地址
  SCALAR_TESTS.forEach((t, idx) => {
    const r = SCALAR_START + idx
    const rn = r + 1 // 1-based 行号
    const formula = t[5].replace(/\{C\}/g, `C${rn}`).replace(/\{D\}/g, `D${rn}`).replace(/\{E\}/g, `E${rn}`)
    const cells = [t[0], t[1], t[2], t[3], t[4], formula.replace(/^=/, ''), formula, t[6]]
    cells.forEach((val, i) => {
      const c = grid.cells[r][i]!
      c.content = val
      if (i === 6 && val.startsWith('=')) c.cellType = 'formula'
      const st =
        i === 6
          ? FORMULA_RESULT_STYLE
          : i === 7
            ? EXPECT_STYLE
            : i === 5
              ? FORMULA_TEXT_STYLE
              : i >= 2 && i <= 4
                ? INPUT_STYLE
                : DATA_STYLE
      style(c, st)
    })
  })

  // 二、数据集字段引用与区域聚合（放底部，向下展开不影响上方标量区的单元格引用）
  const sec2 = grid.cells[DATA_HEADER - 1][0]!
  sec2.content = '二、数据集字段引用与区域聚合（数据集 ds1，共 4 行；聚合以区域引用展开后的数据单元格）'
  style(sec2, SECTION_STYLE)
  grid.merge(DATA_HEADER - 1, 0, DATA_HEADER - 1, 7)

  const dh = DATA_HEADER
  const expandRow = dh + 1
  const a = expandRow + 1 // 展开后首行 1-based 行号
  const b = a + 3 // 展开后末行 1-based 行号
  // 数据表头
  ;['名称', '类别', '数量', '单价', '日期'].forEach((h, i) => {
    const c = grid.cells[dh][i]!
    c.content = h
    style(c, HEADER_STYLE)
  })
  // 数据展开行（向下展开 4 行：渲染行 a..b）
  const masterRef = `A${a}`
  ;['name', 'cat', 'qty', 'price', 'date'].forEach((f, i) => {
    const c = grid.cells[expandRow][i]!
    c.content = `\${ds1.${f}}`
    c.dataset = 'ds1'
    c.fieldName = f
    c.expandDirection = i === 0 ? 'down' : 'none'
    c.leftMasterCell = i === 0 ? undefined : masterRef
    style(c, DATA_STYLE)
  })
  // 聚合行 1：去重/求和/最大/最小
  ;['去重/汇总', `=distinct(B${a}:B${b})`, `=sum(C${a}:C${b})`, `=max(C${a}:C${b})`, `=min(C${a}:C${b})`].forEach((s, i) => {
    const c = grid.cells[expandRow + 1][i]!
    c.content = s
    if (s.startsWith('=')) c.cellType = 'formula'
    style(c, SUM_STYLE)
  })
  ;['预期值', '2', '70', '25', '10'].forEach((s, i) => {
    const c = grid.cells[expandRow + 2][i]!
    c.content = s
    style(c, EXPECT_STYLE)
  })
  // 聚合行 2：均值/计数（数量列）/单价均值/单价合计
  ;['均值/计数', `=avg(C${a}:C${b})`, `=count(C${a}:C${b})`, `=avg(D${a}:D${b})`, `=sum(D${a}:D${b})`].forEach((s, i) => {
    const c = grid.cells[expandRow + 3][i]!
    c.content = s
    if (s.startsWith('=')) c.cellType = 'formula'
    style(c, SUM_STYLE)
  })
  ;['预期值', '17.5', '4', '2', '8'].forEach((s, i) => {
    const c = grid.cells[expandRow + 4][i]!
    c.content = s
    style(c, EXPECT_STYLE)
  })

  const ds: DataSource = {
    id: uid('ds_'),
    name: 'testSource',
    type: 'json',
    config: { rawJson: FORMULA_TEST_JSON, dataPath: '' },
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
    name: '公式功能测试·单元格引用',
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,
    page: { ...DEFAULT_PAGE },
    dataSources: [ds],
    dataSets: [dataSet],
    parameters: [],
    rows: grid.rows,
    columns: grid.columns,
    cells: grid.cells,
    styles: [],
    conditionFormats: [],
    description: '覆盖全部 40 个内置函数：标量函数参数取自数据单元格（Excel 风格，公式以单元格地址引用），并含数据集字段引用与区域聚合，每行附预期值用于核对',
    tags: ['测试', '公式', '内置函数']
  }
}

/** 构建公式功能测试模板·字面量参数版（参数直接写在公式里） */
function buildFormulaLiteralTemplate(): ReportTemplate {
  // 标量函数测试用例：[类别, 函数, 表达式(展示), 公式, 预期值]
  const SCALAR_TESTS: [string, string, string, string, string][] = [
    // 数学
    ['数学', 'abs', 'abs(-7)', '=abs(-7)', '7'],
    ['数学', 'round', 'round(3.14159,2)', '=round(3.14159,2)', '3.14'],
    ['数学', 'ceil', 'ceil(4.2)', '=ceil(4.2)', '5'],
    ['数学', 'floor', 'floor(4.8)', '=floor(4.8)', '4'],
    ['数学', 'sqrt', 'sqrt(16)', '=sqrt(16)', '4'],
    ['数学', 'pow', 'pow(2,10)', '=pow(2,10)', '1024'],
    ['数学', 'mod', 'mod(17,5)', '=mod(17,5)', '2'],
    ['数学', 'rand', 'if(and(rand()>=0,rand()<1),"OK","NG")', '=if(and(rand()>=0,rand()<1),"OK","NG")', 'OK'],
    // 字符串
    ['字符串', 'concat', 'concat("AB","CD")', '=concat("AB","CD")', 'ABCD'],
    ['字符串', 'len', 'len("hello")', '=len("hello")', '5'],
    ['字符串', 'upper', 'upper("abc")', '=upper("abc")', 'ABC'],
    ['字符串', 'lower', 'lower("XYZ")', '=lower("XYZ")', 'xyz'],
    ['字符串', 'substring', 'substring("abcdef",1,3)', '=substring("abcdef",1,3)', 'bcd'],
    ['字符串', 'replace', 'replace("a-b-c","-","_")', '=replace("a-b-c","-","_")', 'a_b_c'],
    ['字符串', 'trim', 'trim(" hi ")', '=trim(" hi ")', 'hi'],
    ['字符串', 'indexOf', 'indexOf("hello","ll")', '=indexOf("hello","ll")', '2'],
    // 聚合（字面量）
    ['聚合', 'sum', 'sum(1,2,3,4)', '=sum(1,2,3,4)', '10'],
    ['聚合', 'avg', 'avg(2,4,6)', '=avg(2,4,6)', '4'],
    ['聚合', 'count', 'count(1,2,3)', '=count(1,2,3)', '3'],
    ['聚合', 'max', 'max(3,9,5)', '=max(3,9,5)', '9'],
    ['聚合', 'min', 'min(3,9,5)', '=min(3,9,5)', '3'],
    ['聚合', 'distinct', 'distinct("a","b","a","c")', '=distinct("a","b","a","c")', '3'],
    // 日期
    ['日期', 'now', 'if(year(now())>=2024,"OK","NG")', '=if(year(now())>=2024,"OK","NG")', 'OK'],
    ['日期', 'today', 'dateDiff(today(),now(),"day")', '=dateDiff(today(),now(),"day")', '0'],
    ['日期', 'year', 'year("2024-05-15")', '=year("2024-05-15")', '2024'],
    ['日期', 'month', 'month("2024-05-15")', '=month("2024-05-15")', '5'],
    ['日期', 'day', 'day("2024-05-15")', '=day("2024-05-15")', '15'],
    ['日期', 'formatDate', 'formatDate("2024-05-15","YYYY/MM/DD")', '=formatDate("2024-05-15","YYYY/MM/DD")', '2024/05/15'],
    ['日期', 'dateDiff', 'dateDiff("2024-01-01","2024-01-11","day")', '=dateDiff("2024-01-01","2024-01-11","day")', '10'],
    // 逻辑
    ['逻辑', 'if', 'if(5>3,"是","否")', '=if(5>3,"是","否")', '是'],
    ['逻辑', 'and', 'if(and(1>0,2>0),"T","F")', '=if(and(1>0,2>0),"T","F")', 'T'],
    ['逻辑', 'or', 'if(or(1<0,2>0),"T","F")', '=if(or(1<0,2>0),"T","F")', 'T'],
    ['逻辑', 'not', 'if(not(1>2),"T","F")', '=if(not(1>2),"T","F")', 'T'],
    ['逻辑', 'case', 'case(2,1,"一",2,"二","其他")', '=case(2,1,"一",2,"二","其他")', '二'],
    ['逻辑', 'isnull', 'if(isnull(A100),"NULL","NOTNULL")', '=if(isnull(A100),"NULL","NOTNULL")', 'NULL'],
    ['逻辑', 'isempty', 'if(isempty(""),"EMPTY","NO")', '=if(isempty(""),"EMPTY","NO")', 'EMPTY'],
    // 格式化
    ['格式化', 'format', 'format(1234567.891,"#,##0.00")', '=format(1234567.891,"#,##0.00")', '1,234,567.89'],
    ['格式化', 'numberFormat', 'numberFormat(3.14159,2)', '=numberFormat(3.14159,2)', '3.14'],
    ['格式化', 'currency', 'currency(99.5)', '=currency(99.5)', '¥99.50'],
    ['格式化', 'percent', 'percent(0.1234)', '=percent(0.1234)', '12.34%']
  ]

  const FORMULA_RESULT_STYLE: CellStyle = { ...DATA_STYLE, bold: true, background: '#f6ffed', color: '#389e0d' }
  const EXPECT_STYLE: CellStyle = { ...DATA_STYLE, color: '#8c8c8c' }
  const SECTION_STYLE: CellStyle = { ...HEADER_STYLE, hAlign: 'left' }

  const rowCount = 11 + SCALAR_TESTS.length
  const grid = new Grid(rowCount, 5)
  grid.columns[0].width = 90
  grid.columns[1].width = 110
  grid.columns[2].width = 300
  grid.columns[3].width = 160
  grid.columns[4].width = 140

  const title = grid.cells[0][0]!
  title.content = '公式功能测试模板·字面量参数'
  style(title, TITLE_STYLE)
  grid.merge(0, 0, 0, 4)

  const sec1 = grid.cells[1][0]!
  sec1.content = '一、数据集字段引用与区域聚合（数据集 ds1，共 4 行）'
  style(sec1, SECTION_STYLE)
  grid.merge(1, 0, 1, 4)

  ;['名称', '类别', '数量', '单价', '日期'].forEach((h, i) => {
    const c = grid.cells[2][i]!
    c.content = h
    style(c, HEADER_STYLE)
  })

  ;['name', 'cat', 'qty', 'price', 'date'].forEach((f, i) => {
    const c = grid.cells[3][i]!
    c.content = `\${ds1.${f}}`
    c.dataset = 'ds1'
    c.fieldName = f
    c.expandDirection = i === 0 ? 'down' : 'none'
    c.leftMasterCell = i === 0 ? undefined : 'A4'
    style(c, DATA_STYLE)
  })

  ;['去重/汇总', '=distinct(B4:B7)', '=sum(C4:C7)', '=max(C4:C7)', '=min(C4:C7)'].forEach((s, i) => {
    const c = grid.cells[4][i]!
    c.content = s
    if (s.startsWith('=')) c.cellType = 'formula'
    style(c, SUM_STYLE)
  })
  ;['预期值', '2', '70', '25', '10'].forEach((s, i) => {
    const c = grid.cells[5][i]!
    c.content = s
    style(c, EXPECT_STYLE)
  })
  ;['均值/计数', '=avg(C4:C7)', '=count(C4:C7)', '=avg(D4:D7)', '=sum(D4:D7)'].forEach((s, i) => {
    const c = grid.cells[6][i]!
    c.content = s
    if (s.startsWith('=')) c.cellType = 'formula'
    style(c, SUM_STYLE)
  })
  ;['预期值', '17.5', '4', '2', '8'].forEach((s, i) => {
    const c = grid.cells[7][i]!
    c.content = s
    style(c, EXPECT_STYLE)
  })

  const sec2 = grid.cells[9][0]!
  sec2.content = '二、标量函数测试（字面量参数；“结果”列应与“预期”列一致）'
  style(sec2, SECTION_STYLE)
  grid.merge(9, 0, 9, 4)

  ;['类别', '函数', '表达式', '结果', '预期'].forEach((h, i) => {
    const c = grid.cells[10][i]!
    c.content = h
    style(c, HEADER_STYLE)
  })

  SCALAR_TESTS.forEach((t, idx) => {
    const r = 11 + idx
    t.forEach((val, i) => {
      const c = grid.cells[r][i]!
      c.content = val
      if (i === 3 && val.startsWith('=')) c.cellType = 'formula'
      const st =
        i === 3
          ? FORMULA_RESULT_STYLE
          : i === 4
            ? EXPECT_STYLE
            : i === 2
              ? { ...DATA_STYLE, hAlign: 'left' as const }
              : DATA_STYLE
      style(c, st)
    })
  })

  const ds: DataSource = {
    id: uid('ds_'),
    name: 'testSource',
    type: 'json',
    config: { rawJson: FORMULA_TEST_JSON, dataPath: '' },
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
    name: '公式功能测试·字面量',
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,
    page: { ...DEFAULT_PAGE },
    dataSources: [ds],
    dataSets: [dataSet],
    parameters: [],
    rows: grid.rows,
    columns: grid.columns,
    cells: grid.cells,
    styles: [],
    conditionFormats: [],
    description: '覆盖全部 40 个内置函数（字面量参数版）：含数据集字段引用、区域聚合与字面量标量函数，每行附预期值用于核对',
    tags: ['测试', '公式', '内置函数']
  }
}

/** 公式·数据集变量·向下展开 的测试数据（4 行） */
const DV_DOWN_JSON = `[
  {"grp":"X","word":"apple","sval":-8.5,"sq":16,"pa":2,"pb":7,"day":"2020-06-15","frac":0.25,"pad":"  hi  ","dash":"a-b-c","ef":""},
  {"grp":"X","word":"Box","sval":15.0,"sq":9,"pa":3,"pb":5,"day":"2021-09-20","frac":0.5,"pad":" yo ","dash":"x-y-z","ef":""},
  {"grp":"Y","word":"cat","sval":-6.0,"sq":25,"pa":4,"pb":9,"day":"2019-03-10","frac":0.75,"pad":"  z","dash":"1-2-3","ef":""},
  {"grp":"Y","word":"Dog","sval":21.0,"sq":4,"pa":5,"pb":8,"day":"2022-12-01","frac":1.0,"pad":"q  ","dash":"p-q-r","ef":""}
]`

/** 构建公式·数据集变量·向下展开模板（公式参数取自 ${dvData.字段}，每行对一条数据求值） */
function buildFormulaDatasetDownTemplate(): ReportTemplate {
  // [表头, 单元格内容]；参数取自数据集字段 ${dvData.xxx}
  const COLS: [string, string][] = [
    ['word', '${dvData.word}'],
    ['grp', '${dvData.grp}'],
    ['sval', '${dvData.sval}'],
    ['upper', '=upper(${dvData.word})'],
    ['lower', '=lower(${dvData.word})'],
    ['len', '=len(${dvData.word})'],
    ['substring', '=substring(${dvData.word},0,2)'],
    ['indexOf', '=indexOf(${dvData.word},"o")'],
    ['trim', '=trim(${dvData.pad})'],
    ['replace', '=replace(${dvData.dash},"-","_")'],
    ['concat', '=concat(${dvData.grp},${dvData.word})'],
    ['abs', '=abs(${dvData.sval})'],
    ['round', '=round(${dvData.sval},0)'],
    ['ceil', '=ceil(${dvData.sval})'],
    ['floor', '=floor(${dvData.sval})'],
    ['sqrt', '=sqrt(${dvData.sq})'],
    ['pow', '=pow(${dvData.pa},2)'],
    ['mod', '=mod(${dvData.pb},${dvData.pa})'],
    ['max', '=max(${dvData.pa},${dvData.pb})'],
    ['min', '=min(${dvData.pa},${dvData.pb})'],
    ['加法', '=${dvData.sval}+${dvData.pb}'],
    ['if', '=if(${dvData.sval}>0,"正","负")'],
    ['and', '=if(and(${dvData.sval}>0,${dvData.pa}>0),"T","F")'],
    ['or', '=if(or(${dvData.sval}>100,${dvData.pa}>0),"T","F")'],
    ['not', '=if(not(${dvData.sval}>0),"T","F")'],
    ['case', '=case(${dvData.grp},"X","甲","Y","乙","其他")'],
    ['isnull', '=if(isnull(${dvData.missing}),"NULL","notnull")'],
    ['isempty', '=if(isempty(${dvData.ef}),"EMPTY","no")'],
    ['year', '=year(${dvData.day})'],
    ['month', '=month(${dvData.day})'],
    ['day', '=day(${dvData.day})'],
    ['formatDate', '=formatDate(${dvData.day},"YYYY/MM/DD")'],
    ['dateDiff', '=dateDiff(${dvData.day},"2025-01-01","day")'],
    ['format', '=format(${dvData.sq},"#,##0.00")'],
    ['numberFormat', '=numberFormat(${dvData.sval},1)'],
    ['currency', '=currency(${dvData.sq})'],
    ['percent', '=percent(${dvData.frac})'],
    ['rand', '=if(and(rand()>=0,rand()<1),"OK","NG")'],
    ['now', '=if(year(now())>=2024,"OK","NG")'],
    ['today', '=if(dateDiff(today(),now(),"day")=0,"OK","NG")']
  ]

  const FORMULA_STYLE: CellStyle = { ...DATA_STYLE, color: '#389e0d' }
  const FIELD_STYLE: CellStyle = { ...DATA_STYLE, background: '#e6f7ff', color: '#0958d9' }
  const SECTION_STYLE: CellStyle = { ...HEADER_STYLE, hAlign: 'left' }

  const ncol = COLS.length
  const grid = new Grid(7, ncol)
  for (let i = 0; i < ncol; i++) grid.columns[i].width = i < 3 ? 84 : 96

  const title = grid.cells[0][0]!
  title.content = '公式·数据集变量·向下展开（每行对一条数据求值，参数取自数据集字段）'
  style(title, TITLE_STYLE)
  grid.merge(0, 0, 0, ncol - 1)

  const sec1 = grid.cells[1][0]!
  sec1.content = '一、向下展开（down）：4 条数据展开为 4 行，每列一个函数，参数为数据集变量'
  style(sec1, SECTION_STYLE)
  grid.merge(1, 0, 1, ncol - 1)

  COLS.forEach((c, i) => {
    const cell = grid.cells[2][i]!
    cell.content = c[0]
    style(cell, HEADER_STYLE)
  })

  COLS.forEach((c, i) => {
    const cell = grid.cells[3][i]!
    cell.content = c[1]
    if (i === 0) {
      cell.dataset = 'dvData'
      cell.fieldName = 'word'
      cell.expandDirection = 'down'
    } else if (c[1].startsWith('=')) {
      cell.cellType = 'formula'
    }
    style(cell, c[1].startsWith('=') ? FORMULA_STYLE : FIELD_STYLE)
  })

  const sec2 = grid.cells[4][0]!
  sec2.content = '二、区域聚合（对展开后的数据列：grp 去重、sval 求和/均值/计数/最值）'
  style(sec2, SECTION_STYLE)
  grid.merge(4, 0, 4, ncol - 1)

  const aggDefs: [number, string][] = [
    [0, '聚合'],
    [1, '=distinct(B4:B7)'],
    [2, '=sum(C4:C7)'],
    [3, '=avg(C4:C7)'],
    [4, '=count(C4:C7)'],
    [5, '=max(C4:C7)'],
    [6, '=min(C4:C7)']
  ]
  aggDefs.forEach(([i, s]) => {
    const cell = grid.cells[5][i]!
    cell.content = s
    if (s.startsWith('=')) cell.cellType = 'formula'
    style(cell, SUM_STYLE)
  })
  const expDefs: [number, string][] = [
    [0, '预期'],
    [1, '2'],
    [2, '21.5'],
    [3, '5.375'],
    [4, '4'],
    [5, '21'],
    [6, '-8.5']
  ]
  expDefs.forEach(([i, s]) => {
    const cell = grid.cells[6][i]!
    cell.content = s
    style(cell, { ...DATA_STYLE, color: '#8c8c8c' })
  })

  const ds: DataSource = {
    id: uid('ds_'),
    name: 'dvSource',
    type: 'json',
    config: { rawJson: DV_DOWN_JSON, dataPath: '' },
    createdAt: Date.now()
  }
  const dataSet: DataSet = { id: uid('set_'), name: 'dvData', sourceId: ds.id, extractor: {} }

  const now = Date.now()
  return {
    id: uid('tpl_'),
    name: '公式·数据集变量·向下展开',
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,
    page: { ...DEFAULT_PAGE },
    dataSources: [ds],
    dataSets: [dataSet],
    parameters: [],
    rows: grid.rows,
    columns: grid.columns,
    cells: grid.cells,
    styles: [],
    conditionFormats: [],
    description: '数据集变量作公式参数·向下展开：4 条数据展开为 4 行，每列一个内置函数（参数取自数据集字段），并含区域聚合，覆盖全部函数',
    tags: ['测试', '公式', '数据集', '向下展开']
  }
}

/** 公式·数据集变量·向右展开 的测试数据（4 列） */
const RV_RIGHT_JSON = `[
  {"hd":"列1","wd":"hello","iv":10,"fr":0.2,"dz":"2024-01-05","pd":"  Aa  ","dsh":"m-n-o"},
  {"hd":"列2","wd":"World","iv":25,"fr":0.5,"dz":"2024-02-10","pd":" Bb ","dsh":"p-q-r"},
  {"hd":"列3","wd":"Foo","iv":8,"fr":0.75,"dz":"2024-03-15","pd":"Cc  ","dsh":"s-t-u"},
  {"hd":"列4","wd":"BAR","iv":17,"fr":1.0,"dz":"2024-04-20","pd":"  Dd","dsh":"v-w-x"}
]`

/** 上方展开占位数据集：专门制造下方静态区域的坐标漂移 */
const SHIFT_TOP_JSON = `[
  {"label":"上移一"},
  {"label":"上移二"},
  {"label":"上移三"}
]`

/** 构建公式·数据集变量·向右展开模板（主格列向右展开，下方公式按列对一条数据求值） */
function buildFormulaDatasetRightTemplate(): ReportTemplate {
  const ROWS: [string, string][] = [
    ['表头(主格)', '${rightData.hd}'],
    ['upper', '=upper(${rightData.wd})'],
    ['lower', '=lower(${rightData.wd})'],
    ['len', '=len(${rightData.wd})'],
    ['trim', '=trim(${rightData.pd})'],
    ['replace', '=replace(${rightData.dsh},"-","/")'],
    ['abs', '=abs(${rightData.iv})'],
    ['iv乘2', '=${rightData.iv}*2'],
    ['round', '=round(${rightData.fr},2)'],
    ['if', '=if(${rightData.iv}>10,"大","小")'],
    ['year', '=year(${rightData.dz})'],
    ['month', '=month(${rightData.dz})'],
    ['concat', '=concat(${rightData.hd},":",${rightData.wd})'],
    ['currency', '=currency(${rightData.iv})'],
    ['percent', '=percent(${rightData.fr})']
  ]

  const FORMULA_STYLE: CellStyle = { ...DATA_STYLE, color: '#389e0d' }
  const FIELD_STYLE: CellStyle = { ...DATA_STYLE, background: '#e6f7ff', color: '#0958d9' }
  const LABEL_STYLE: CellStyle = { ...HEADER_STYLE, hAlign: 'left' }

  const grid = new Grid(ROWS.length + 2, 2)
  grid.columns[0].width = 120
  grid.columns[1].width = 120

  const title = grid.cells[0][0]!
  title.content = '公式·数据集变量·向右展开（每列对一条数据求值，参数取自数据集字段）'
  style(title, TITLE_STYLE)
  grid.merge(0, 0, 0, 1)

  const sec = grid.cells[1][0]!
  sec.content = '向右展开（right）：4 条数据展开为 4 列，每行一个函数，参数为数据集变量'
  style(sec, LABEL_STYLE)
  grid.merge(1, 0, 1, 1)

  ROWS.forEach(([label, formula], i) => {
    const r = i + 2
    const lc = grid.cells[r][0]!
    lc.content = label
    style(lc, LABEL_STYLE)
    const fc = grid.cells[r][1]!
    fc.content = formula
    if (i === 0) {
      fc.dataset = 'rightData'
      fc.fieldName = 'hd'
      fc.expandDirection = 'right'
    } else if (formula.startsWith('=')) {
      fc.cellType = 'formula'
    }
    style(fc, formula.startsWith('=') ? FORMULA_STYLE : FIELD_STYLE)
  })

  const ds: DataSource = {
    id: uid('ds_'),
    name: 'rvSource',
    type: 'json',
    config: { rawJson: RV_RIGHT_JSON, dataPath: '' },
    createdAt: Date.now()
  }
  const dataSet: DataSet = { id: uid('set_'), name: 'rightData', sourceId: ds.id, extractor: {} }

  const now = Date.now()
  return {
    id: uid('tpl_'),
    name: '公式·数据集变量·向右展开',
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,
    page: { ...DEFAULT_PAGE },
    dataSources: [ds],
    dataSets: [dataSet],
    parameters: [],
    rows: grid.rows,
    columns: grid.columns,
    cells: grid.cells,
    styles: [],
    conditionFormats: [],
    description: '数据集变量作公式参数·向右展开：4 条数据展开为 4 列，每行一个内置函数，参数取自数据集字段',
    tags: ['测试', '公式', '数据集', '向右展开']
  }
}

/**
 * 构建公式功能测试·动态引用目标模板
 * 目标：同时覆盖
 * 1. 数据集字段变量作公式参数（静态汇总格动态聚合）
 * 2. 普通单元格引用 / 普通公式单元格引用在上方数据集展开后仍自动跟随
 * 3. 普通单元格范围引用在上方数据集展开后仍自动跟随
 */
function buildFormulaDynamicReferenceTemplate(): ReportTemplate {
  const SCALAR_TESTS: [string, string, string, string, string, string, string][] = [
    ['数学', 'abs', '-7', '', '', '=abs({C})', '7'],
    ['数学', 'round', '3.14159', '2', '', '=round({C},{D})', '3.14'],
    ['数学', 'ceil', '4.2', '', '', '=ceil({C})', '5'],
    ['数学', 'floor', '4.8', '', '', '=floor({C})', '4'],
    ['数学', 'sqrt', '16', '', '', '=sqrt({C})', '4'],
    ['数学', 'pow', '2', '10', '', '=pow({C},{D})', '1024'],
    ['数学', 'mod', '17', '5', '', '=mod({C},{D})', '2'],
    ['数学', 'rand', '—', '', '', '=if(and(rand()>=0,rand()<1),"OK","NG")', 'OK'],
    ['字符串', 'concat', 'Hello', 'World', '', '=concat({C},{D})', 'HelloWorld'],
    ['字符串', 'len', 'hello', '', '', '=len({C})', '5'],
    ['字符串', 'upper', 'abc', '', '', '=upper({C})', 'ABC'],
    ['字符串', 'lower', 'XYZ', '', '', '=lower({C})', 'xyz'],
    ['字符串', 'substring', 'abcdef', '1', '3', '=substring({C},{D},{E})', 'bcd'],
    ['字符串', 'replace', 'a-b-c', '-', '_', '=replace({C},{D},{E})', 'a_b_c'],
    ['字符串', 'trim', ' hi ', '', '', '=trim({C})', 'hi'],
    ['字符串', 'indexOf', 'hello', 'll', '', '=indexOf({C},{D})', '2'],
    ['聚合', 'sum', '10', '20', '30', '=sum({C}:{E})', '60'],
    ['聚合', 'avg', '2', '4', '6', '=avg({C}:{E})', '4'],
    ['聚合', 'count', '1', '2', '3', '=count({C}:{E})', '3'],
    ['聚合', 'max', '3', '9', '5', '=max({C}:{E})', '9'],
    ['聚合', 'min', '3', '9', '5', '=min({C}:{E})', '3'],
    ['聚合', 'distinct', 'a', 'b', 'a', '=distinct({C}:{E})', '2'],
    ['日期', 'now', '—', '', '', '=if(year(now())>=2024,"OK","NG")', 'OK'],
    ['日期', 'today', '—', '', '', '=dateDiff(today(),now(),"day")', '0'],
    ['日期', 'year', '2024-05-15', '', '', '=year({C})', '2024'],
    ['日期', 'month', '2024-05-15', '', '', '=month({C})', '5'],
    ['日期', 'day', '2024-05-15', '', '', '=day({C})', '15'],
    ['日期', 'formatDate', '2024-05-15', 'YYYY/MM/DD', '', '=formatDate({C},{D})', '2024/05/15'],
    ['日期', 'dateDiff', '2024-01-01', '2024-01-11', 'day', '=dateDiff({C},{D},{E})', '10'],
    ['逻辑', 'if', '5', '3', '', '=if({C}>{D},"是","否")', '是'],
    ['逻辑', 'and', '1', '2', '', '=if(and({C}>0,{D}>0),"T","F")', 'T'],
    ['逻辑', 'or', '-1', '2', '', '=if(or({C}>0,{D}>0),"T","F")', 'T'],
    ['逻辑', 'not', '1', '2', '', '=if(not({C}>{D}),"T","F")', 'T'],
    ['逻辑', 'case', '2', '', '', '=case({C},"1","一","2","二","其他")', '二'],
    ['逻辑', 'isnull', '', '', '', '=if(isnull({C}),"是null","非null")', '非null'],
    ['逻辑', 'isempty', '', '', '', '=if(isempty({C}),"空","非空")', '空'],
    ['格式化', 'format', '1234567.891', '#,##0.00', '', '=format({C},{D})', '1,234,567.89'],
    ['格式化', 'numberFormat', '3.14159', '2', '', '=numberFormat({C},{D})', '3.14'],
    ['格式化', 'currency', '99.5', '', '', '=currency({C})', '¥99.50'],
    ['格式化', 'percent', '0.1234', '', '', '=percent({C})', '12.34%']
  ]

  const INPUT_STYLE: CellStyle = { ...DATA_STYLE, background: '#e6f7ff', color: '#0958d9' }
  const FORMULA_TEXT_STYLE: CellStyle = { ...DATA_STYLE, hAlign: 'left', color: '#666666' }
  const FORMULA_RESULT_STYLE: CellStyle = { ...DATA_STYLE, bold: true, background: '#f6ffed', color: '#389e0d' }
  const EXPECT_STYLE: CellStyle = { ...DATA_STYLE, color: '#8c8c8c' }
  const SECTION_STYLE: CellStyle = { ...HEADER_STYLE, hAlign: 'left' }

  const SHIFT_HEADER_ROW = 2
  const SHIFT_DATA_ROW = 3
  const DATASET_SECTION_ROW = 6
  const DATASET_HEADER_ROW = 7
  const DATASET_START_ROW = 8
  const DATASET_SUMMARY_ROW = 15
  const ORDINARY_SECTION_ROW = 18
  const ORDINARY_HEADER_ROW = 19
  const ORDINARY_DATA_ROW = 20
  const SCALAR_SECTION_ROW = 23
  const SCALAR_HEADER_ROW = 24
  const SCALAR_START_ROW = 25
  const RIGHT_EXPAND_SECTION_ROW = SCALAR_START_ROW + SCALAR_TESTS.length + 1
  const RIGHT_EXPAND_SAME_ROW = RIGHT_EXPAND_SECTION_ROW + 1
  const RIGHT_EXPAND_REPEAT_HEADER_ROW = RIGHT_EXPAND_SECTION_ROW + 2
  const RIGHT_EXPAND_REPEAT_ROW_1 = RIGHT_EXPAND_SECTION_ROW + 3
  const RIGHT_EXPAND_REPEAT_ROW_2 = RIGHT_EXPAND_SECTION_ROW + 4
  const rowCount = RIGHT_EXPAND_SECTION_ROW + 6
  const grid = new Grid(rowCount, 8)

  ;[90, 120, 100, 100, 100, 240, 140, 120].forEach((w, i) => {
    grid.columns[i].width = w
  })

  const title = grid.cells[0][0]!
  title.content = '公式功能测试·动态引用目标'
  style(title, TITLE_STYLE)
  grid.merge(0, 0, 0, 7)

  const intro = grid.cells[1][0]!
  intro.content = '覆盖：数据集字段动态聚合、普通单元格引用跟随、普通公式单元格引用跟随、范围引用跟随。'
  style(intro, SECTION_STYLE)
  grid.merge(1, 0, 1, 7)

  const shiftSec = grid.cells[SHIFT_HEADER_ROW][0]!
  shiftSec.content = '一、上方展开占位块（用于制造下方静态区域的坐标漂移）'
  style(shiftSec, SECTION_STYLE)
  grid.merge(SHIFT_HEADER_ROW, 0, SHIFT_HEADER_ROW, 7)
  const shiftMaster = grid.cells[SHIFT_DATA_ROW][0]!
  shiftMaster.content = '${shiftData.label}'
  shiftMaster.dataset = 'shiftData'
  shiftMaster.fieldName = 'label'
  shiftMaster.expandDirection = 'down'
  style(shiftMaster, DATA_STYLE)
  const shiftInfo = grid.cells[SHIFT_DATA_ROW][1]!
  shiftInfo.content = '此块会展开 3 行，验证下方引用是否自动跟随'
  style(shiftInfo, DATA_STYLE)
  grid.merge(SHIFT_DATA_ROW, 1, SHIFT_DATA_ROW, 7)

  const dsSec = grid.cells[DATASET_SECTION_ROW][0]!
  dsSec.content = '二、数据集字段变量作公式参数（静态汇总格应随数据集行数自动适配）'
  style(dsSec, SECTION_STYLE)
  grid.merge(DATASET_SECTION_ROW, 0, DATASET_SECTION_ROW, 7)
  ;['指标', '公式', '结果', '预期'].forEach((h, i) => {
    const c = grid.cells[DATASET_HEADER_ROW][i]!
    c.content = h
    style(c, HEADER_STYLE)
  })
  const dsCases: [string, string, string][] = [
    ['数量求和', '=sum(${calcData.qty})', '70'],
    ['数量平均', '=avg(${calcData.qty})', '17.5'],
    ['数量计数', '=count(${calcData.qty})', '4'],
    ['数量最大', '=max(${calcData.qty})', '25'],
    ['数量最小', '=min(${calcData.qty})', '10'],
    ['类别去重', '=distinct(${calcData.cat})', '2'],
    ['组合计算', '=sum(${calcData.qty})*avg(${calcData.price})', '140']
  ]
  dsCases.forEach((item, idx) => {
    const r = DATASET_START_ROW + idx
    const label = grid.cells[r][0]!
    label.content = item[0]
    style(label, DATA_STYLE)
    const formulaText = grid.cells[r][1]!
    formulaText.content = item[1].slice(1)
    style(formulaText, FORMULA_TEXT_STYLE)
    const result = grid.cells[r][2]!
    result.content = item[1]
    result.cellType = 'formula'
    style(result, FORMULA_RESULT_STYLE)
    const expected = grid.cells[r][3]!
    expected.content = item[2]
    style(expected, EXPECT_STYLE)
  })
  const dsHint = grid.cells[DATASET_SUMMARY_ROW][0]!
  dsHint.content = '说明：上面这些公式若通过选择绑定字段单元格录入，应自动得到 ${calcData.xxx} 变量，而非固定坐标。'
  style(dsHint, DATA_STYLE)
  grid.merge(DATASET_SUMMARY_ROW, 0, DATASET_SUMMARY_ROW, 7)

  const ordSec = grid.cells[ORDINARY_SECTION_ROW][0]!
  ordSec.content = '三、普通单元格 / 普通公式单元格引用跟随（上方展开后仍应引用正确目标）'
  style(ordSec, SECTION_STYLE)
  grid.merge(ORDINARY_SECTION_ROW, 0, ORDINARY_SECTION_ROW, 7)
  ;['原值1', '原值2', '中间公式', '引用中间公式', '范围求和', '预期1', '预期2'].forEach((h, i) => {
    const c = grid.cells[ORDINARY_HEADER_ROW][i]!
    c.content = h
    style(c, HEADER_STYLE)
  })
  const bRow = ORDINARY_DATA_ROW + 1
  const base1 = grid.cells[ORDINARY_DATA_ROW][0]!
  base1.content = '5'
  style(base1, INPUT_STYLE)
  const base2 = grid.cells[ORDINARY_DATA_ROW][1]!
  base2.content = '7'
  style(base2, INPUT_STYLE)
  const mid = grid.cells[ORDINARY_DATA_ROW][2]!
  mid.content = `=A${bRow}+B${bRow}`
  mid.cellType = 'formula'
  style(mid, FORMULA_RESULT_STYLE)
  const follow = grid.cells[ORDINARY_DATA_ROW][3]!
  follow.content = `=C${bRow}*2`
  follow.cellType = 'formula'
  style(follow, FORMULA_RESULT_STYLE)
  const range = grid.cells[ORDINARY_DATA_ROW][4]!
  range.content = `=sum(A${bRow}:C${bRow})`
  range.cellType = 'formula'
  style(range, FORMULA_RESULT_STYLE)
  const exp1 = grid.cells[ORDINARY_DATA_ROW][5]!
  exp1.content = '24'
  style(exp1, EXPECT_STYLE)
  const exp2 = grid.cells[ORDINARY_DATA_ROW][6]!
  exp2.content = '17'
  style(exp2, EXPECT_STYLE)

  const scalarSec = grid.cells[SCALAR_SECTION_ROW][0]!
  scalarSec.content = '四、全量 40 函数普通单元格引用测试（该区位于上方展开块下方，用于验证单元格/范围引用自动跟随）'
  style(scalarSec, SECTION_STYLE)
  grid.merge(SCALAR_SECTION_ROW, 0, SCALAR_SECTION_ROW, 7)
  ;['类别', '函数', '参数1', '参数2', '参数3', '公式（引用单元格）', '结果', '预期'].forEach((h, i) => {
    const c = grid.cells[SCALAR_HEADER_ROW][i]!
    c.content = h
    style(c, HEADER_STYLE)
  })

  SCALAR_TESTS.forEach((t, idx) => {
    const r = SCALAR_START_ROW + idx
    const rn = r + 1
    const formula = t[5].replace(/\{C\}/g, `C${rn}`).replace(/\{D\}/g, `D${rn}`).replace(/\{E\}/g, `E${rn}`)
    const cells = [t[0], t[1], t[2], t[3], t[4], formula.replace(/^=/, ''), formula, t[6]]
    cells.forEach((val, i) => {
      const c = grid.cells[r][i]!
      c.content = val
      if (i === 6 && val.startsWith('=')) c.cellType = 'formula'
      const st =
        i === 6
          ? FORMULA_RESULT_STYLE
          : i === 7
            ? EXPECT_STYLE
            : i === 5
              ? FORMULA_TEXT_STYLE
              : i >= 2 && i <= 4
                ? INPUT_STYLE
                : DATA_STYLE
      style(c, st)
    })
  })

  const rightSec = grid.cells[RIGHT_EXPAND_SECTION_ROW][0]!
  rightSec.content = '五、右展开回归样例（同一行多 right + 跨行同字段重复 right）'
  style(rightSec, SECTION_STYLE)
  grid.merge(RIGHT_EXPAND_SECTION_ROW, 0, RIGHT_EXPAND_SECTION_ROW, 7)

  const sameRowHint = grid.cells[RIGHT_EXPAND_SAME_ROW][0]!
  sameRowHint.content = '同一行多 right：F/G 同时绑定 shiftData.label（应连续展开，不重叠）'
  style(sameRowHint, DATA_STYLE)
  grid.merge(RIGHT_EXPAND_SAME_ROW, 0, RIGHT_EXPAND_SAME_ROW, 4)

  const sameRowRightA = grid.cells[RIGHT_EXPAND_SAME_ROW][5]!
  sameRowRightA.content = '${shiftData.label}'
  sameRowRightA.dataset = 'shiftData'
  sameRowRightA.fieldName = 'label'
  sameRowRightA.expandDirection = 'right'
  style(sameRowRightA, DATA_STYLE)

  const sameRowRightB = grid.cells[RIGHT_EXPAND_SAME_ROW][6]!
  sameRowRightB.content = '${shiftData.label}'
  sameRowRightB.dataset = 'shiftData'
  sameRowRightB.fieldName = 'label'
  sameRowRightB.expandDirection = 'right'
  style(sameRowRightB, DATA_STYLE)

  const crossRowHint = grid.cells[RIGHT_EXPAND_REPEAT_HEADER_ROW][0]!
  crossRowHint.content = '跨行同字段重复 right：F 两行重复绑定 shiftData.label（两行都应可展开）'
  style(crossRowHint, DATA_STYLE)
  grid.merge(RIGHT_EXPAND_REPEAT_HEADER_ROW, 0, RIGHT_EXPAND_REPEAT_HEADER_ROW, 4)

  const repeatRight1 = grid.cells[RIGHT_EXPAND_REPEAT_ROW_1][5]!
  repeatRight1.content = '${shiftData.label}'
  repeatRight1.dataset = 'shiftData'
  repeatRight1.fieldName = 'label'
  repeatRight1.expandDirection = 'right'
  style(repeatRight1, DATA_STYLE)

  const repeatRight2 = grid.cells[RIGHT_EXPAND_REPEAT_ROW_2][5]!
  repeatRight2.content = '${shiftData.label}'
  repeatRight2.dataset = 'shiftData'
  repeatRight2.fieldName = 'label'
  repeatRight2.expandDirection = 'right'
  style(repeatRight2, DATA_STYLE)

  const shiftDs: DataSource = {
    id: uid('ds_'),
    name: 'shiftSource',
    type: 'json',
    config: { rawJson: SHIFT_TOP_JSON, dataPath: '' },
    createdAt: Date.now()
  }
  const calcDs: DataSource = {
    id: uid('ds_'),
    name: 'calcSource',
    type: 'json',
    config: { rawJson: FORMULA_TEST_JSON, dataPath: '' },
    createdAt: Date.now()
  }
  const shiftSet: DataSet = { id: uid('set_'), name: 'shiftData', sourceId: shiftDs.id, extractor: {} }
  const calcSet: DataSet = { id: uid('set_'), name: 'calcData', sourceId: calcDs.id, extractor: {} }

  // 条件格式示例：
  // - C9:C15 数据集动态聚合结果列：大于 50 高亮橙色，小于等于 10 高亮浅蓝
  // - C21:E21 普通公式结果区：大于 20 高亮浅绿
  // - G26:G65 全量公式结果列：包含 "OK" 高亮绿色；包含 "%" 高亮紫色
  const conditionFormats = [
    {
      id: uid('cf_'),
      name: '动态聚合结果高亮',
      scope: 'C9:C15',
      rules: [
        {
          id: uid('rule_'),
          type: 'cellValue' as const,
          operator: 'gt' as const,
          value: 50,
          style: { background: '#fff7e6', color: '#d46b08', bold: true }
        },
        {
          id: uid('rule_'),
          type: 'cellValue' as const,
          operator: 'le' as const,
          value: 10,
          style: { background: '#e6f4ff', color: '#0958d9', bold: true }
        }
      ]
    },
    {
      id: uid('cf_'),
      name: '普通公式结果高亮',
      scope: 'C21:E21',
      rules: [
        {
          id: uid('rule_'),
          type: 'cellValue' as const,
          operator: 'gt' as const,
          value: 20,
          style: { background: '#f6ffed', color: '#389e0d', bold: true }
        }
      ]
    },
    {
      id: uid('cf_'),
      name: '公式结果文本高亮',
      scope: 'G26:G65',
      rules: [
        {
          id: uid('rule_'),
          type: 'cellValue' as const,
          operator: 'contains' as const,
          value: 'OK',
          style: { background: '#f6ffed', color: '#237804', bold: true }
        },
        {
          id: uid('rule_'),
          type: 'cellValue' as const,
          operator: 'contains' as const,
          value: '%',
          style: { background: '#f9f0ff', color: '#722ed1', bold: true }
        }
      ]
    }
  ]

  const now = Date.now()
  return {
    id: uid('tpl_'),
    name: '公式功能测试·动态引用目标',
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,
    page: { ...DEFAULT_PAGE },
    dataSources: [shiftDs, calcDs],
    dataSets: [shiftSet, calcSet],
    parameters: [],
    rows: grid.rows,
    columns: grid.columns,
    cells: grid.cells,
    styles: [],
    conditionFormats,
    description:
      '同时覆盖数据集字段动态引用、普通单元格引用跟随、普通公式单元格引用跟随、范围引用跟随、全量 40 函数普通单元格参数场景，以及同一行多 right 与跨行同字段重复 right 回归样例。',
    tags: ['测试', '公式', '动态引用', '回归']
  }
}

/**
 * 构建“数据绑定聚合与条件格式示例”模板：
 * - 覆盖右侧属性栏数据绑定中的聚合选项
 * - 覆盖高级里条件格式常见规则（含表达式/between）
 */
function buildBindingAggregateAndConditionTemplate(): ReportTemplate {
  const grid = new Grid(34, 8)
  ;[140, 140, 140, 120, 120, 160, 160, 160].forEach((w, i) => {
    grid.columns[i].width = w
  })

  const title = grid.cells[0][0]!
  title.content = '数据绑定聚合与条件格式示例'
  style(title, TITLE_STYLE)
  grid.merge(0, 0, 0, 7)

  const intro = grid.cells[1][0]!
  intro.content = '用于演示：右侧属性->数据绑定(聚合全部选项) 与 高级->条件格式(常见规则全覆盖)。'
  style(intro, HEADER_STYLE)
  grid.merge(1, 0, 1, 7)

  const sec1 = grid.cells[3][0]!
  sec1.content = '一、数据绑定聚合选项示例'
  style(sec1, HEADER_STYLE)
  grid.merge(3, 0, 3, 7)

  ;['聚合选项', '绑定内容', '数据集', '字段', '说明'].forEach((h, i) => {
    const c = grid.cells[4][i]!
    c.content = h
    style(c, HEADER_STYLE)
  })

  const aggregateRows: Array<{ label: string; aggregate: any; field: string; note: string }> = [
    { label: 'none(无)', aggregate: 'none', field: 'qty', note: '基础字段绑定，不聚合' },
    { label: 'sum(求和)', aggregate: 'sum', field: 'qty', note: '数值字段求和' },
    { label: 'avg(平均)', aggregate: 'avg', field: 'qty', note: '数值字段均值' },
    { label: 'count(计数)', aggregate: 'count', field: 'qty', note: '记录条数统计' },
    { label: 'max(最大)', aggregate: 'max', field: 'qty', note: '最大值' },
    { label: 'min(最小)', aggregate: 'min', field: 'qty', note: '最小值' },
    { label: 'group(分组)', aggregate: 'group', field: 'cat', note: '按类别分组标识' },
    { label: 'distinct(去重)', aggregate: 'distinct', field: 'cat', note: '类别去重集合' },
    { label: 'group(规格分组)', aggregate: 'group', field: 'spec', note: '按规格文本分组' },
    { label: 'distinct(规格去重)', aggregate: 'distinct', field: 'spec', note: '规格文本去重集合' }
  ]

  aggregateRows.forEach((row, idx) => {
    const r = 5 + idx
    const a = grid.cells[r][0]!
    a.content = row.label
    style(a, DATA_STYLE)

    const b = grid.cells[r][1]!
    b.content = `\${bindDemo.${row.field}}`
    b.dataset = 'bindDemo'
    b.fieldName = row.field
    b.aggregate = row.aggregate
    b.expandDirection = 'none'
    style(b, { ...DATA_STYLE, color: '#0958d9', background: '#e6f7ff' })

    const c = grid.cells[r][2]!
    c.content = 'bindDemo'
    style(c, DATA_STYLE)

    const d = grid.cells[r][3]!
    d.content = row.field
    style(d, DATA_STYLE)

    const e = grid.cells[r][4]!
    e.content = row.note
    style(e, DATA_STYLE)

    const f = grid.cells[r][5]!
    f.content = row.aggregate === 'none' ? '原始值' : `${row.aggregate}(${row.field})`
    style(f, { ...DATA_STYLE, color: '#8c8c8c' })
  })

  const sec2 = grid.cells[15][0]!
  sec2.content = '二、条件格式规则全覆盖示例（规则 -> 管理全局条件格式）'
  style(sec2, HEADER_STYLE)
  grid.merge(15, 0, 15, 7)

  ;['规则类型/操作符', '测试值单元格', '说明'].forEach((h, i) => {
    const c = grid.cells[16][i]!
    c.content = h
    style(c, HEADER_STYLE)
  })

  const condRows: Array<{ r: number; title: string; value: string; note: string }> = [
    { r: 17, title: 'cellValue.gt', value: '95', note: '大于 90 高亮' },
    { r: 18, title: 'cellValue.lt', value: '40', note: '小于 50 高亮' },
    { r: 19, title: 'cellValue.eq', value: 'OK', note: '等于 OK 高亮' },
    { r: 20, title: 'cellValue.ne', value: 'NG', note: '不等于 OK 高亮' },
    { r: 21, title: 'cellValue.ge', value: '80', note: '大于等于 80 高亮' },
    { r: 22, title: 'cellValue.le', value: '60', note: '小于等于 60 高亮' },
    { r: 23, title: 'cellValue.contains', value: 'A-2026-OK', note: '包含 OK 高亮' },
    { r: 24, title: 'cellValue.between', value: '75', note: '70~80 区间高亮' },
    { r: 25, title: 'expression', value: '88', note: '表达式 =C26>85 高亮' }
  ]

  condRows.forEach((item) => {
    const a = grid.cells[item.r][0]!
    a.content = item.title
    style(a, DATA_STYLE)

    const b = grid.cells[item.r][1]!
    b.content = item.value
    style(b, { ...DATA_STYLE, hAlign: 'right' })

    const c = grid.cells[item.r][2]!
    c.content = item.note
    style(c, DATA_STYLE)
  })

  const sec3 = grid.cells[27][0]!
  sec3.content = '三、数据集变量单元格规则示例（点击 B30/C30/D30 查看右侧栏规则）'
  style(sec3, HEADER_STYLE)
  grid.merge(27, 0, 27, 7)

  ;['示例', '变量主格(向下)', '规格变量', '分类变量', '说明'].forEach((h, i) => {
    const c = grid.cells[28][i]!
    c.content = h
    style(c, HEADER_STYLE)
  })

  const dsa = grid.cells[29][0]!
  dsa.content = '变量规则示例'
  style(dsa, DATA_STYLE)

  const dsb = grid.cells[29][1]!
  dsb.content = '${bindDemo.qty}'
  dsb.dataset = 'bindDemo'
  dsb.fieldName = 'qty'
  dsb.expandDirection = 'down'
  style(dsb, { ...DATA_STYLE, color: '#0958d9', background: '#e6f7ff' })

  const dsc = grid.cells[29][2]!
  dsc.content = '${bindDemo.spec}'
  dsc.dataset = 'bindDemo'
  dsc.fieldName = 'spec'
  dsc.leftMasterCell = 'B30'
  style(dsc, { ...DATA_STYLE, color: '#0958d9', background: '#e6f7ff' })

  const dsd = grid.cells[29][3]!
  dsd.content = '${bindDemo.cat}'
  dsd.dataset = 'bindDemo'
  dsd.fieldName = 'cat'
  dsd.leftMasterCell = 'B30'
  style(dsd, { ...DATA_STYLE, color: '#0958d9', background: '#e6f7ff' })

  const dse = grid.cells[29][4]!
  dse.content = 'qty 向下展开，spec/cat 跟随同一行数据，覆盖数值与规格文本规则'
  style(dse, DATA_STYLE)

  const dsf = grid.cells[29][5]!
  dsf.content = '规格示例值: 12个/箱, 8把/箱, 10kg/筐, 20kg/袋'
  style(dsf, { ...DATA_STYLE, hAlign: 'left', color: '#8c8c8c' })

  const ds: DataSource = {
    id: uid('ds_'),
    name: 'bindDemoSource',
    type: 'json',
    config: {
      rawJson: FORMULA_TEST_JSON,
      dataPath: ''
    },
    createdAt: Date.now()
  }

  const dataSet: DataSet = {
    id: uid('set_'),
    name: 'bindDemo',
    sourceId: ds.id,
    extractor: {}
  }

  const conditionFormats = [
    {
      id: uid('cf_'), name: 'gt-大于', scope: 'B18', rules: [{ id: uid('rule_'), type: 'cellValue' as const, operator: 'gt' as const, value: 90, style: { background: '#fff1f0', color: '#cf1322', bold: true } }]
    },
    {
      id: uid('cf_'), name: 'lt-小于', scope: 'B19', rules: [{ id: uid('rule_'), type: 'cellValue' as const, operator: 'lt' as const, value: 50, style: { background: '#fffbe6', color: '#d48806', bold: true } }]
    },
    {
      id: uid('cf_'), name: 'eq-等于', scope: 'B20', rules: [{ id: uid('rule_'), type: 'cellValue' as const, operator: 'eq' as const, value: 'OK', style: { background: '#f6ffed', color: '#389e0d', bold: true } }]
    },
    {
      id: uid('cf_'), name: 'ne-不等于', scope: 'B21', rules: [{ id: uid('rule_'), type: 'cellValue' as const, operator: 'ne' as const, value: 'OK', style: { background: '#fff2e8', color: '#d4380d', bold: true } }]
    },
    {
      id: uid('cf_'), name: 'ge-大于等于', scope: 'B22', rules: [{ id: uid('rule_'), type: 'cellValue' as const, operator: 'ge' as const, value: 80, style: { background: '#e6f4ff', color: '#0958d9', bold: true } }]
    },
    {
      id: uid('cf_'), name: 'le-小于等于', scope: 'B23', rules: [{ id: uid('rule_'), type: 'cellValue' as const, operator: 'le' as const, value: 60, style: { background: '#f9f0ff', color: '#722ed1', bold: true } }]
    },
    {
      id: uid('cf_'), name: 'contains-包含', scope: 'B24', rules: [{ id: uid('rule_'), type: 'cellValue' as const, operator: 'contains' as const, value: 'OK', style: { background: '#f6ffed', color: '#237804', bold: true } }]
    },
    {
      id: uid('cf_'), name: 'between-区间', scope: 'B25', rules: [{ id: uid('rule_'), type: 'cellValue' as const, operator: 'between' as const, value: [70, 80] as any, style: { background: '#e6fffb', color: '#08979c', bold: true } }]
    },
    {
      id: uid('cf_'), name: 'expression-表达式', scope: 'B26', rules: [{ id: uid('rule_'), type: 'expression' as const, expression: '=B26>85', style: { background: '#fff0f6', color: '#c41d7f', bold: true } }]
    },
    {
      id: uid('cf_'), name: 'dataset-var-qty-高值', scope: 'B30:B33', rules: [{ id: uid('rule_'), type: 'cellValue' as const, operator: 'gt' as const, value: 20, style: { background: '#fff1f0', color: '#cf1322', bold: true } }]
    },
    {
      id: uid('cf_'), name: 'dataset-var-spec-含kg', scope: 'C30:C33', rules: [{ id: uid('rule_'), type: 'cellValue' as const, operator: 'contains' as const, value: 'kg', style: { background: '#fff7e6', color: '#d46b08', bold: true } }]
    },
    {
      id: uid('cf_'), name: 'dataset-var-cat-蔬菜', scope: 'D30:D33', rules: [{ id: uid('rule_'), type: 'cellValue' as const, operator: 'eq' as const, value: '蔬菜', style: { background: '#f6ffed', color: '#237804', bold: true } }]
    }
  ]

  const now = Date.now()
  return {
    id: uid('tpl_'),
    name: '数据绑定聚合与条件格式示例',
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,
    page: { ...DEFAULT_PAGE },
    dataSources: [ds],
    dataSets: [dataSet],
    parameters: [],
    rows: grid.rows,
    columns: grid.columns,
    cells: grid.cells,
    styles: [],
    conditionFormats,
    description: '覆盖数据绑定聚合全部选项，并提供条件格式规则（cellValue/expression）完整示例。',
    tags: ['示例', '数据绑定', '聚合', '条件格式']
  }
}

/** 内置预制模板清单（以 name 作为去重判据） */
const BUILTIN_TEMPLATES: { name: string; build: () => ReportTemplate }[] = [
  { name: '销售明细报表', build: buildSalesTemplate },
  { name: '学生成绩统计表', build: buildScoreTemplate },
  { name: '公式功能测试·字面量', build: buildFormulaLiteralTemplate },
  { name: '公式功能测试·单元格引用', build: buildFormulaTestTemplate },
  { name: '公式功能测试·动态引用目标', build: buildFormulaDynamicReferenceTemplate },
  { name: '数据绑定聚合与条件格式示例', build: buildBindingAggregateAndConditionTemplate },
  { name: '公式·数据集变量·向下展开', build: buildFormulaDatasetDownTemplate },
  { name: '公式·数据集变量·向右展开', build: buildFormulaDatasetRightTemplate }
]

/**
 * 确保内置预制模板存在：
 * - 首次（空库）写入全部
 * - 已有数据时仅补齐缺失的内置模板（按 name 判断），不重复、不覆盖用户其他模板
 */
export async function seedTemplatesIfEmpty(): Promise<void> {
  const existing = await listTemplates()
  const names = new Set(existing.map((t) => t.name))
  for (const { name, build } of BUILTIN_TEMPLATES) {
    if (!names.has(name)) {
      await saveTemplate(build())
    }
  }
}

/** 重新写入种子数据（开发调试用，清空后重建全部内置模板） */
export async function reseedTemplates(): Promise<void> {
  await db.templates.clear()
  for (const { build } of BUILTIN_TEMPLATES) {
    await saveTemplate(build())
  }
}
