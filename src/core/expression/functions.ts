/**
 * 内置函数库（40+ 常用函数）
 * 对齐 UReport 函数语义
 */
import dayjs from 'dayjs'

/** 函数实现签名：接收参数数组与上下文，返回值 */
export type FuncImpl = (args: unknown[], ctx?: unknown) => unknown

/** 函数定义 */
export interface FuncDef {
  name: string
  impl: FuncImpl
  desc: string
  /** 参数数量，-1 表示可变参 */
  argCount: number
  /** 示例用法 */
  example?: string
}

const num = (v: unknown): number => {
  if (typeof v === 'number') return v
  if (v == null || v === '') return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

const str = (v: unknown): string => {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

const bool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v !== '' && v !== '0' && v.toLowerCase() !== 'false'
  return !!v
}

/** 从数组中提取数值（用于聚合） */
const toNumArray = (arr: unknown[]): number[] => {
  return arr.filter((v) => v != null && v !== '').map(num)
}

/** 函数注册表 */
const functions = new Map<string, FuncDef>()

function register(def: FuncDef) {
  functions.set(def.name.toLowerCase(), def)
}

// ===== 聚合函数 =====
// sum/avg/count/max/min 支持可变参数(Excel 风格):sum(A1,A2)、sum(A1:A3)、sum(A1+A2) 均可
register({ name: 'sum', argCount: -1, desc: '求和', example: '=sum(A1:A10) 或 =sum(A1,B2,C3)', impl: (a) => toNumArray(a.flatMap(flatten)).reduce((s, n) => s + n, 0) })
register({ name: 'avg', argCount: -1, desc: '平均', example: '=avg(A1:A10)', impl: (a) => { const arr = toNumArray(a.flatMap(flatten)); return arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0 } })
register({ name: 'count', argCount: -1, desc: '计数', example: '=count(A1:A10)', impl: (a) => a.flatMap(flatten).filter((v) => v != null && v !== '').length })
register({ name: 'max', argCount: -1, desc: '最大', example: '=max(A1:A10)', impl: (a) => { const arr = toNumArray(a.flatMap(flatten)); return arr.length ? Math.max(...arr) : 0 } })
register({ name: 'min', argCount: -1, desc: '最小', example: '=min(A1:A10)', impl: (a) => { const arr = toNumArray(a.flatMap(flatten)); return arr.length ? Math.min(...arr) : 0 } })
register({ name: 'distinct', argCount: -1, desc: '去重计数', example: '=distinct(A1:A10)', impl: (a) => new Set(a.flatMap(flatten).map(str)).size })

// ===== 数学函数 =====
register({ name: 'abs', argCount: 1, desc: '绝对值', example: '=abs(A1)', impl: (a) => Math.abs(num(a[0])) })
register({ name: 'round', argCount: 2, desc: '四舍五入', example: '=round(A1,2)', impl: (a) => { const d = num(a[1]); const f = Math.pow(10, d); return Math.round(num(a[0]) * f) / f } })
register({ name: 'ceil', argCount: 1, desc: '向上取整', example: '=ceil(A1)', impl: (a) => Math.ceil(num(a[0])) })
register({ name: 'floor', argCount: 1, desc: '向下取整', example: '=floor(A1)', impl: (a) => Math.floor(num(a[0])) })
register({ name: 'sqrt', argCount: 1, desc: '平方根', example: '=sqrt(A1)', impl: (a) => Math.sqrt(num(a[0])) })
register({ name: 'pow', argCount: 2, desc: '幂运算', example: '=pow(A1,2)', impl: (a) => Math.pow(num(a[0]), num(a[1])) })
register({ name: 'mod', argCount: 2, desc: '取模', example: '=mod(A1,3)', impl: (a) => num(a[0]) % num(a[1]) })
register({ name: 'rand', argCount: 0, desc: '随机数', example: '=rand()', impl: () => Math.random() })

// ===== 字符串函数 =====
register({ name: 'concat', argCount: -1, desc: '拼接', example: '=concat(A1,B1)', impl: (a) => a.map(str).join('') })
register({ name: 'len', argCount: 1, desc: '长度', example: '=len(A1)', impl: (a) => str(a[0]).length })
register({ name: 'upper', argCount: 1, desc: '大写', example: '=upper(A1)', impl: (a) => str(a[0]).toUpperCase() })
register({ name: 'lower', argCount: 1, desc: '小写', example: '=lower(A1)', impl: (a) => str(a[0]).toLowerCase() })
register({ name: 'substring', argCount: 3, desc: '截取', example: '=substring(A1,0,5)', impl: (a) => str(a[0]).substr(num(a[1]), num(a[2])) })
register({ name: 'replace', argCount: 3, desc: '替换', example: '=replace(A1,"-","")', impl: (a) => str(a[0]).split(str(a[1])).join(str(a[2])) })
register({ name: 'trim', argCount: 1, desc: '去空格', example: '=trim(A1)', impl: (a) => str(a[0]).trim() })
register({ name: 'indexOf', argCount: 2, desc: '查找位置', example: '=indexOf(A1,"ab")', impl: (a) => str(a[0]).indexOf(str(a[1])) })

// ===== 日期函数 =====
register({ name: 'now', argCount: 0, desc: '当前时间', example: '=now()', impl: () => new Date() })
register({ name: 'today', argCount: 0, desc: '当前日期', example: '=today()', impl: () => dayjs().startOf('day').toDate() })
register({ name: 'year', argCount: 1, desc: '年份', example: '=year(A1)', impl: (a) => dayjs(toDate(a[0])).year() })
register({ name: 'month', argCount: 1, desc: '月份', example: '=month(A1)', impl: (a) => dayjs(toDate(a[0])).month() + 1 })
register({ name: 'day', argCount: 1, desc: '日', example: '=day(A1)', impl: (a) => dayjs(toDate(a[0])).date() })
register({ name: 'formatDate', argCount: 2, desc: '格式化日期', example: '=formatDate(A1,"YYYY-MM-DD")', impl: (a) => dayjs(toDate(a[0])).format(str(a[1])) })
register({
  name: 'dateDiff',
  argCount: 3,
  desc: '日期差值',
  example: '=dateDiff(A1,B1,"day")',
  impl: (a) => {
    const d1 = dayjs(toDate(a[0]))
    const d2 = dayjs(toDate(a[1]))
    const unit = str(a[2]) as dayjs.UnitType
    return d2.diff(d1, unit)
  }
})

// ===== 逻辑函数 =====
register({ name: 'if', argCount: 3, desc: '条件判断', example: '=if(A1>0,"正","负")', impl: (a) => (bool(a[0]) ? a[1] : a[2]) })
register({ name: 'and', argCount: -1, desc: '与', example: '=and(A1>0,B1>0)', impl: (a) => a.every(bool) })
register({ name: 'or', argCount: -1, desc: '或', example: '=or(A1>0,B1>0)', impl: (a) => a.some(bool) })
register({ name: 'not', argCount: 1, desc: '非', example: '=not(A1)', impl: (a) => !bool(a[0]) })
register({
  name: 'case',
  argCount: -1,
  desc: '多分支',
  example: '=case(A1,1,"一",2,"二","其他")',
  impl: (a) => {
    const v = a[0]
    for (let i = 1; i + 1 < a.length; i += 2) {
      if (v === a[i]) return a[i + 1]
    }
    // 奇数个参数时最后一个是 default
    if (a.length % 2 === 0) return a[a.length - 1]
    return null
  }
})
register({ name: 'isnull', argCount: 1, desc: '是否为空', example: '=isnull(A1)', impl: (a) => a[0] == null })
register({ name: 'isempty', argCount: 1, desc: '是否空字符串', example: '=isempty(A1)', impl: (a) => a[0] == null || str(a[0]) === '' })

// ===== 格式化函数 =====
register({
  name: 'format',
  argCount: 2,
  desc: '数字格式化',
  example: '=format(A1,"#,##0.00")',
  impl: (a) => {
    const n = num(a[0])
    const fmt = str(a[1])
    return formatNumber(n, fmt)
  }
})
register({ name: 'numberFormat', argCount: 2, desc: '保留小数', example: '=numberFormat(A1,2)', impl: (a) => num(a[0]).toFixed(num(a[1])) })
register({ name: 'currency', argCount: 1, desc: '货币格式', example: '=currency(A1)', impl: (a) => '¥' + num(a[0]).toFixed(2) })
register({ name: 'percent', argCount: 1, desc: '百分比', example: '=percent(A1)', impl: (a) => (num(a[0]) * 100).toFixed(2) + '%' })

/** 获取函数定义 */
export function getFunction(name: string): FuncDef | undefined {
  return functions.get(name.toLowerCase())
}

/** 列出所有函数（按分类） */
export function listFunctions(): { category: string; funcs: FuncDef[] }[] {
  const categories: { category: string; funcs: FuncDef[] }[] = [
    { category: '聚合', funcs: [] },
    { category: '数学', funcs: [] },
    { category: '字符串', funcs: [] },
    { category: '日期', funcs: [] },
    { category: '逻辑', funcs: [] },
    { category: '格式化', funcs: [] }
  ]
  const catMap: Record<string, string> = {
    sum: '聚合', avg: '聚合', count: '聚合', max: '聚合', min: '聚合', distinct: '聚合',
    abs: '数学', round: '数学', ceil: '数学', floor: '数学', sqrt: '数学', pow: '数学', mod: '数学', rand: '数学',
    concat: '字符串', len: '字符串', upper: '字符串', lower: '字符串', substring: '字符串', replace: '字符串', trim: '字符串', indexOf: '字符串',
    now: '日期', today: '日期', year: '日期', month: '日期', day: '日期', formatDate: '日期', dateDiff: '日期',
    if: '逻辑', and: '逻辑', or: '逻辑', not: '逻辑', case: '逻辑', isnull: '逻辑', isempty: '逻辑',
    format: '格式化', numberFormat: '格式化', currency: '格式化', percent: '格式化'
  }
  functions.forEach((f) => {
    const cat = catMap[f.name] ?? '其他'
    const c = categories.find((c) => c.category === cat)
    if (c) c.funcs.push(f)
  })
  return categories.filter((c) => c.funcs.length > 0)
}

/** 工具：扁平化数组（聚合函数支持区域参数） */
function flatten(v: unknown): unknown[] {
  if (Array.isArray(v)) return v.flat(Infinity)
  return [v]
}

/** 工具：转日期 */
function toDate(v: unknown): Date {
  if (v instanceof Date) return v
  if (typeof v === 'number') return new Date(v)
  if (typeof v === 'string') {
    const d = dayjs(v)
    if (d.isValid()) return d.toDate()
  }
  return new Date()
}

/** 工具：简单数字格式化（支持 #,##0.00 等） */
function formatNumber(n: number, fmt: string): string {
  // 解析格式：#,##0.00
  const dotIdx = fmt.indexOf('.')
  let decimals = 0
  if (dotIdx >= 0) decimals = fmt.length - dotIdx - 1
  const hasGroup = fmt.includes(',')
  let s = n.toFixed(decimals)
  if (hasGroup) {
    const [intPart, decPart] = s.split('.')
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    s = decPart ? `${grouped}.${decPart}` : grouped
  }
  return s
}
