/**
 * VReport 公式函数完整测试
 * 覆盖全部 40+ 函数：聚合/数学/字符串/日期/逻辑/格式化
 * 以及运算符：+ - * / % = <> > < >= <= &
 */
import { Aggregator } from '../src/core/engine/Aggregator'
import type { RenderedCell } from '../src/core/engine/ExpandEngine'
import type { ExpandContext } from '../src/core/engine/Context'
import type { Cell } from '../src/core/cell/types'
import { createRootContext } from '../src/core/engine/Context'

/** 构造单个渲染单元格 */
function makeCell(content: string, row = 0, col = 0): RenderedCell {
  const ctx = createRootContext() as ExpandContext
  ctx.rowData = {}
  ctx.rowRange = [0, 0]
  ctx.colRange = [0, 0]
  const cell: Cell = {
    row, col, rowSpan: 1, colSpan: 1,
    content, cellType: content.startsWith('=') ? 'formula' : 'text', style: {}
  }
  return { source: cell, row, col, rowSpan: 1, colSpan: 1, context: ctx }
}

/** 构建测试网格 */
function buildTestGrid(params?: Record<string, unknown>): (RenderedCell | null)[][] {
  const g: (RenderedCell | null)[][] = [
    [
      makeCell('10'),   // A1=10
      makeCell('20'),   // B1=20
      makeCell('30'),   // C1=30
      makeCell('Hello'),// D1="Hello"
      makeCell('World'),// E1="World"
    ],
    [
      makeCell('5'),    // A2=5
      makeCell('8'),    // B2=8
      makeCell('15'),   // C2=15
      makeCell('  trimmed  '), // D2="  trimmed  "
      makeCell(''),     // E2=""
    ],
    [
      makeCell('2'),    // A3=2
      makeCell('3'),    // B3=3
      makeCell('4'),    // C3=4
      makeCell('true'), // D3=true (as string)
      makeCell('0'),    // E3=0
    ],
    [
      makeCell('100'),  // A4=100
      makeCell('25'),   // B4=25
      makeCell('-8'),   // C4=-8
      makeCell('Hello World'), // D4
      makeCell('HELLO'),// E4
    ],
    [
      makeCell('1'),    // A5=1
      makeCell('2'),    // B5=2
      makeCell('3'),    // C5=3
      makeCell('nullVal'),// D5
      makeCell('abc123'),// E5=数据（保留）
    ],
    [
      makeCell('', '', 5, 0),  // A6=空（公式区）
      makeCell('', '', 5, 1),  // B6=空
      makeCell('', '', 5, 2),  // C6=空
      makeCell('', '', 5, 3),  // D6=空
      makeCell('', '', 5, 4),  // E6=空（公式主测试格）
    ],
  ]
  // 设置 params
  if (params) {
    for (const row of g) {
      for (const cell of row) {
        if (cell) cell.context!.params = params
      }
    }
  }
  return g
}

/** 对网格中指定位置设置公式并求值 */
function evalFormulaCell(
  grid: (RenderedCell | null)[][],
  formula: string,
  row = 0, col = 0
): unknown {
  const formulaCell: Cell = {
    row, col, rowSpan: 1, colSpan: 1,
    content: formula, cellType: 'formula', style: {}
  }
  const formulaCtx = createRootContext() as ExpandContext
  formulaCtx.rowData = {}
  formulaCtx.rowRange = [0, 0]
  formulaCtx.colRange = [0, 0]
  if (grid[0]?.[0]?.context?.params) {
    formulaCtx.params = grid[0][0]!.context!.params
  }
  const formulaRC: RenderedCell = {
    source: formulaCell, row, col,
    rowSpan: 1, colSpan: 1,
    context: formulaCtx
  }
  grid[row][col] = formulaRC
  const agg = new Aggregator(grid)
  agg.evaluateAll()
  return grid[row][col]!.value
}

/** 快捷测试：构建网格，在指定位置求值公式 */
function evalFormula(formula: string, params?: Record<string, unknown>): unknown {
  const grid = buildTestGrid(params)
  return evalFormulaCell(grid, formula, 5, 4) // 在 E6 位置求公式（公式区独立，不覆盖数据）
}

let passCount = 0
let failCount = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✅ ${name}`)
    passCount++
  } catch (e: unknown) {
    console.log(`  ❌ ${name}: ${(e as Error).message}`)
    failCount++
  }
}

function assertEqual(actual: unknown, expected: unknown, message = '') {
  if (actual === expected) return
  // 处理浮点数比较
  if (typeof actual === 'number' && typeof expected === 'number' && isNaN(actual) && isNaN(expected)) return
  if (typeof actual === 'number' && typeof expected === 'number') {
    if (Math.abs(actual - expected) < 1e-9) return
  }
  throw new Error(`${message || '断言失败'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

function assertTrue(actual: unknown, message = '') {
  if (actual === true) return
  throw new Error(`${message || '断言失败'}: expected true, got ${JSON.stringify(actual)}`)
}

function assertFalse(actual: unknown, message = '') {
  if (actual === false) return
  throw new Error(`${message || '断言失败'}: expected false, got ${JSON.stringify(actual)}`)
}

function assertString(actual: unknown, expected: string) {
  if (actual === expected) return
  throw new Error(`字符串断言失败: expected "${expected}", got "${actual}"`)
}

function assertNumber(actual: unknown, expected: number, tolerance = 0) {
  if (typeof actual !== 'number') throw new Error(`期望 number, got ${typeof actual}: ${actual}`)
  if (tolerance > 0) {
    if (Math.abs(actual - expected) <= tolerance) return
    throw new Error(`数字断言失败: expected ~${expected}, got ${actual}`)
  }
  if (actual === expected) return
  throw new Error(`数字断言失败: expected ${expected}, got ${actual}`)
}

// ============================================================
// 运行测试
// ============================================================
console.log('\n=== VReport 公式函数完整测试 ===\n')

// ----- 运算符 -----
console.log('[运算符]')
test('加法: A1+B1=30', () => assertEqual(evalFormula('=A1+B1'), 30))
test('减法: A1-B1=-10', () => assertEqual(evalFormula('=A1-B1'), -10))
test('乘法: A1*B1=200', () => assertEqual(evalFormula('=A1*B1'), 200))
test('除法: B1/A1=2', () => assertEqual(evalFormula('=B1/A1'), 2))
test('取模: B1%A2=0 (20%5)', () => assertEqual(evalFormula('=B1%A2'), 0))
test('取模: 7%3=1', () => assertEqual(evalFormula('=7%3'), 1))
test('等于(A1=B1): false', () => assertFalse(evalFormula('=A1=B1')))
test('等于(A1=A1): true', () => assertTrue(evalFormula('=A1=A1')))
test('不等于(A1<>B1): true', () => assertTrue(evalFormula('=A1<>B1')))
test('大于(B1>A1): true', () => assertTrue(evalFormula('=B1>A1')))
test('小于(A1<B1): true', () => assertTrue(evalFormula('=A1<B1')))
test('大于等于(B1>=A1): true', () => assertTrue(evalFormula('=B1>=A1')))
test('小于等于(A1<=B1): true', () => assertTrue(evalFormula('=A1<=B1')))
test('字符串连接(D1&E1): HelloWorld', () => assertString(evalFormula('=D1&E1'), 'HelloWorld'))
test('负数: -A1=-10', () => assertEqual(evalFormula('=-A1'), -10))
test('正数: +A1=10', () => assertEqual(evalFormula('=+A1'), 10))
test('混合运算: (A1+B1)*C1=900', () => assertEqual(evalFormula('=(A1+B1)*C1'), 900))

// ----- 聚合函数 -----
console.log('\n[聚合函数 sum/avg/count/max/min/distinct]')
test('sum(A1:A3)=10+5+2=17', () => assertEqual(evalFormula('=sum(A1:A3)'), 17))
test('sum(A1,B1,C1)=10+20+30=60', () => assertEqual(evalFormula('=sum(A1,B1,C1)'), 60))
test('sum(A1+A2)=10+5=15', () => assertEqual(evalFormula('=sum(A1+A2)'), 15))
test('sum(A1:C1)=10+20+30=60', () => assertEqual(evalFormula('=sum(A1:C1)'), 60))
test('avg(A1:A3)=(10+5+2)/3≈5.67', () => assertNumber(evalFormula('=avg(A1:A3)'), 17/3, 0.01))
test('count(A1:A5)=5', () => assertEqual(evalFormula('=count(A1:A5)'), 5))
test('count(A1:C1)=3', () => assertEqual(evalFormula('=count(A1:C1)'), 3))
test('max(A1:A5)=100', () => assertEqual(evalFormula('=max(A1:A5)'), 100))
test('min(A1:A5)=1', () => assertEqual(evalFormula('=min(A1:A5)'), 1))
test('distinct(A1:A5)=5(全部不同)', () => assertEqual(evalFormula('=distinct(A1:A5)'), 5))
test('distinct(B1:B5)=5(B列:20,8,15,25,2全不同)', () => assertEqual(evalFormula('=distinct(B1:B5)'), 5))

// ----- 数学函数 -----
console.log('\n[数学函数 abs/round/ceil/floor/sqrt/pow/mod/rand]')
test('abs(C4)=abs(-8)=8', () => assertEqual(evalFormula('=abs(C4)'), 8))
test('abs(A1)=abs(10)=10', () => assertEqual(evalFormula('=abs(A1)'), 10))
test('round(B4/A1,0)=round(25/10,0)=3', () => assertEqual(evalFormula('=round(B4/A1,0)'), 3))
test('round(2.5,0)=3(四舍五入)', () => assertEqual(evalFormula('=round(2.5,0)'), 3))
test('round(2.4,0)=2', () => assertEqual(evalFormula('=round(2.4,0)'), 2))
test('ceil(B4/A1)=ceil(2.5)=3', () => assertEqual(evalFormula('=ceil(B4/A1)'), 3))
test('floor(B4/A1)=floor(2.5)=2', () => assertEqual(evalFormula('=floor(B4/A1)'), 2))
test('sqrt(A3)=sqrt(2)≈1.414', () => assertNumber(evalFormula('=sqrt(A3)'), Math.SQRT2, 0.01))
test('pow(A3,B3)=2^3=8', () => assertEqual(evalFormula('=pow(A3,B3)'), 8))
test('pow(2,10)=1024', () => assertEqual(evalFormula('=pow(2,10)'), 1024))
test('mod(A1,A2)=10%5=0', () => assertEqual(evalFormula('=mod(A1,A2)'), 0))
test('mod(7,3)=1', () => assertEqual(evalFormula('=mod(7,3)'), 1))
test('rand()在[0,1)之间', () => {
  const v = evalFormula('=rand()')
  assertTrue(typeof v === 'number' && v >= 0 && v < 1)
})

// ----- 字符串函数 -----
console.log('\n[字符串函数 concat/len/upper/lower/substring/replace/trim/indexOf]')
test('concat(D1,E1)=HelloWorld', () => assertString(evalFormula('=concat(D1,E1)'), 'HelloWorld'))
test('concat(A1,B1)=1020', () => assertString(evalFormula('=concat(A1,B1)'), '1020'))
test('len(D1)=length("Hello")=5', () => assertEqual(evalFormula('=len(D1)'), 5))
test('len(E2)=0(空字符串)', () => assertEqual(evalFormula('=len(E2)'), 0))
test('upper(E4)="HELLO"', () => assertString(evalFormula('=upper(E4)'), 'HELLO'))
test('lower(E4)="hello"', () => assertString(evalFormula('=lower(E4)'), 'hello'))
test('substring(D1,0,3)="Hel"(substr(0,3))', () => assertString(evalFormula('=substring(D1,0,3)'), 'Hel'))
test('substring(D1,1,4)="ello"(substr(1,4))', () => assertString(evalFormula('=substring(D1,1,4)'), 'ello'))
test('replace(E5,"123","")="abc"', () => assertString(evalFormula('=replace(E5,"123","")'), 'abc'))
test('replace("hello world","world","vreport")="hello vreport"', () => assertString(evalFormula('=replace("hello world","world","vreport")'), 'hello vreport'))
test('trim(D2)="trimmed"(去空格)', () => assertString(evalFormula('=trim(D2)'), 'trimmed'))
test('indexOf(D4,"World")=6', () => assertEqual(evalFormula('=indexOf(D4,"World")'), 6))
test('indexOf(D4,"X")=-1(未找到)', () => assertEqual(evalFormula('=indexOf(D4,"X")'), -1))

// ----- 日期函数 -----
console.log('\n[日期函数 now/today/year/month/day/formatDate/dateDiff]')
test('today()返回Date对象', () => assertTrue(evalFormula('=today()') instanceof Date))
test('now()返回Date对象', () => assertTrue(evalFormula('=now()') instanceof Date))
test('year("2024-01-15")=2024', () => assertEqual(evalFormula('=year("2024-01-15")'), 2024))
test('month("2024-01-15")=1', () => assertEqual(evalFormula('=month("2024-01-15")'), 1))
test('day("2024-01-15")=15', () => assertEqual(evalFormula('=day("2024-01-15")'), 15))
test('formatDate("2024-01-15","YYYY-MM-DD")', () => assertString(evalFormula('=formatDate("2024-01-15","YYYY-MM-DD")'), '2024-01-15'))
test('formatDate("2024-03-05","YYYY年MM月DD日")', () => assertString(evalFormula('=formatDate("2024-03-05","YYYY年MM月DD日")'), '2024年03月05日'))
test('dateDiff("2024-01-01","2024-01-15","day")=14', () => assertEqual(evalFormula('=dateDiff("2024-01-01","2024-01-15","day")'), 14))
test('dateDiff("2024-01-01","2024-02-01","month")=1', () => assertEqual(evalFormula('=dateDiff("2024-01-01","2024-02-01","month")'), 1))
test('dateDiff("2024-01-01","2024-12-31","year")=0', () => assertEqual(evalFormula('=dateDiff("2024-01-01","2024-12-31","year")'), 0))

// ----- 逻辑函数 -----
console.log('\n[逻辑函数 if/and/or/not/case/isnull/isempty]')
test('if(A1>15,"大","小")="小"(10不>15)', () => assertString(evalFormula('=if(A1>15,"大","小")'), '小'))
test('if(A2>3,"大","小")="大"(5>3)', () => assertString(evalFormula('=if(A2>3,"大","小")'), '大'))
test('if(B1=20,"正确","错误")="正确"', () => assertString(evalFormula('=if(B1=20,"正确","错误")'), '正确'))
test('and(A1>5,A2>3)=true(10>5且5>3)', () => assertTrue(evalFormula('=and(A1>5,A2>3)')))
test('and(A1>5,A2<3)=false(5不<3)', () => assertFalse(evalFormula('=and(A1>5,A2<3)')))
test('and(A1>15,A2>3)=false(10不>15)', () => assertFalse(evalFormula('=and(A1>15,A2>3)')))
test('or(A1>15,A2>3)=true(A2>3为真)', () => assertTrue(evalFormula('=or(A1>15,A2>3)')))
test('or(A1>15,A2<3)=false(全假)', () => assertFalse(evalFormula('=or(A1>15,A2<3)')))
test('not(A1>15)=true(10不大于15)', () => assertTrue(evalFormula('=not(A1>15)')))
test('not(A1>5)=false(10>5)', () => assertFalse(evalFormula('=not(A1>5)')))
test('case(A3,"1","一","2","二","3","三","其他")="二"(A3="2")', () => assertString(evalFormula('=case(A3,"1","一","2","二","3","三","其他")'), '二'))
test('case(A5,"1","一","2","二","其他")="一"(A5="1")', () => assertString(evalFormula('=case(A5,"1","一","2","二","其他")'), '一'))
test('case(9,1,"一",2,"二","其他")="其他"(无匹配)', () => assertString(evalFormula('=case(9,1,"一",2,"二","其他")'), '其他'))
test('isnull(A1)=false(A1有值)', () => assertFalse(evalFormula('=isnull(A1)')))
test('isempty(E2)=true(空字符串)', () => assertTrue(evalFormula('=isempty(E2)')))
test('isempty(D1)=false(Hello非空)', () => assertFalse(evalFormula('=isempty(D1)')))

// ----- 格式化函数 -----
console.log('\n[格式化函数 format/numberFormat/currency/percent]')
test('numberFormat(3.14159,2)="3.14"', () => assertString(evalFormula('=numberFormat(3.14159,2)'), '3.14'))
test('numberFormat(2.5,0)="3"', () => assertString(evalFormula('=numberFormat(2.5,0)'), '3'))
test('currency(1234.5)="¥1234.50"', () => assertString(evalFormula('=currency(1234.5)'), '¥1234.50'))
test('currency(100)="¥100.00"', () => assertString(evalFormula('=currency(100)'), '¥100.00'))
test('percent(0.255)="25.50%"', () => assertString(evalFormula('=percent(0.255)'), '25.50%'))
test('percent(1)="100.00%"', () => assertString(evalFormula('=percent(1)'), '100.00%'))
test('format(A1,"#,##0.00")="10.00"', () => assertString(evalFormula('=format(A1,"#,##0.00")'), '10.00'))
test('format(1234567,"#,##0")="1,234,567"', () => assertString(evalFormula('=format(1234567,"#,##0")'), '1,234,567'))

// ----- 参数引用 -----
console.log('\n[参数引用 ${param.xxx}]')
test('${param.region}=华东', () => assertString(evalFormula('=${param.region}', { region: '华东' }), '华东'))
test('${param.count}=42', () => assertEqual(evalFormula('=${param.count}', { count: 42 }), 42))
test('${param.count}+10=52', () => assertEqual(evalFormula('=${param.count}+10', { count: 42 }), 52))
test('if(${param.count}>50,"高","低")="低"(42不大于50)', () => assertString(evalFormula('=if(${param.count}>50,"高","低")', { count: 42 }), '低'))

// ----- 字段引用 -----
console.log('\n[字段引用 ${ds1.xxx}]')
// 公式格放在公式区(5,4)，但需要共享有数据的 rowData 上下文
const formulaRowCtx = createRootContext() as ExpandContext
formulaRowCtx.rowData = { name: '张三', price: 25, qty: 4 }
formulaRowCtx.rowRange = [0, 0]
formulaRowCtx.colRange = [0, 0]
const formulaRowCtx2 = createRootContext() as ExpandContext
formulaRowCtx2.rowData = { name: '张三', price: 25, qty: 4 }
formulaRowCtx2.rowRange = [0, 0]
formulaRowCtx2.colRange = [0, 0]

const gridWithField = buildTestGrid()
const fCell: RenderedCell = {
  source: { row: 5, col: 4, rowSpan: 1, colSpan: 1, content: '=${ds1.name}', cellType: 'formula', style: {} },
  row: 5, col: 4, rowSpan: 1, colSpan: 1, context: formulaRowCtx
}
gridWithField[5]![4] = fCell
const agg1 = new Aggregator(gridWithField)
agg1.evaluateAll()
test('${ds1.name}="张三"', () => assertString(gridWithField[5]![4]!.value, '张三'))

const gridWithField2 = buildTestGrid()
const fCell2: RenderedCell = {
  source: { row: 5, col: 4, rowSpan: 1, colSpan: 1, content: '=${ds1.price}*${ds1.qty}', cellType: 'formula', style: {} },
  row: 5, col: 4, rowSpan: 1, colSpan: 1, context: formulaRowCtx2
}
gridWithField2[5]![4] = fCell2
const agg2 = new Aggregator(gridWithField2)
agg2.evaluateAll()
test('${ds1.price}*${ds1.qty}=100', () => assertEqual(gridWithField2[5]![4]!.value, 100))

// ----- 嵌套函数 -----
console.log('\n[嵌套函数]')
test('嵌套: round(avg(A1:A3),1)≈5.7', () => assertNumber(evalFormula('=round(avg(A1:A3),1)'), 5.7, 0.1))
test('嵌套: upper(concat(D1,E1))="HELLOWORLD"', () => assertString(evalFormula('=upper(concat(D1,E1))'), 'HELLOWORLD'))
test('嵌套: if(avg(A1:A3)>5,"通过","不通过")="通过"', () => assertString(evalFormula('=if(avg(A1:A3)>5,"通过","不通过")'), '通过'))
test('嵌套: case(A2,"5","五","8","八","其他")="五"(A2="5")', () => assertString(evalFormula('=case(A2,"5","五","8","八","其他")'), '五'))
test('嵌套: and(A1>5,B1>5,C1>25)=true(10>5且20>5且30>25)', () => assertTrue(evalFormula('=and(A1>5,B1>5,C1>25)')))

// ----- 错误与边界 -----
console.log('\n[错误处理与边界情况]')
test('除以0: B1/0=Infinity', () => assertEqual(evalFormula('=B1/0'), Infinity))
test('除以0.5: 1/0.5=2', () => assertEqual(evalFormula('=1/0.5'), 2))
test('空值运算: A1+0=10', () => assertEqual(evalFormula('=A1+0'), 10))
test('字符串当数字: "abc"+1=1', () => assertEqual(evalFormula('="abc"+1'), 1))
test('0值判断: if(0,"真","假")="假"', () => assertString(evalFormula('=if(0,"真","假")'), '假'))
test('空字符串判断: if("","空","非空")="非空"', () => assertString(evalFormula('=if("","空","非空")'), '非空'))

// ----- 循环引用检测 -----
console.log('\n[循环引用检测 #CIRC!]')
const circGrid: (RenderedCell | null)[][] = [
  [
    makeCell('=B1'), // A1=B1
    makeCell('=A1'), // B1=A1 → 循环
    makeCell('', '', 1, 0),
    makeCell('', '', 1, 1),
  ],
]
const circAgg = new Aggregator(circGrid)
circAgg.evaluateAll()
const circVal = circGrid[0][0]!.value
test('A1=B1,B1=A1 循环引用 → #CIRC!', () => assertString(circVal, '#CIRC!'))

// ----- 输出结果 -----
console.log(`\n=== 测试结果: ${passCount} 通过, ${failCount} 失败 ===`)
if (failCount > 0) process.exit(1)
