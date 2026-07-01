/**
 * 公式联想与参数筛选测试
 */
import 'fake-indexeddb/auto'
import { it, expect } from 'vitest'
import { matchSuggestions, getParamHint, getAllSuggestions } from '../src/core/expression/Autocomplete'
import { ParameterEngine } from '../src/core/parameter/ParameterEngine'
import type { Parameter, DataSet } from '../types'
import type { DataRow } from '../src/core/datasource/types'

let passed = 0
let failed = 0

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✅ ${msg}`)
    passed++
  } else {
    console.log(`  ❌ ${msg}`)
    failed++
  }
}

/** 测试公式联想 */
function testFormulaSuggestions() {
  console.log('\n[测试1] 公式联想 matchSuggestions')
  const all = getAllSuggestions()
  assert(all.length >= 30, `应有 30+ 函数建议，实际 ${all.length}`)

  // 输入 =su 应匹配 sum
  const sug1 = matchSuggestions('=su', 3)
  assert(sug1.length >= 1, `=su 应有建议，实际 ${sug1.length}`)
  assert(sug1.some((s) => s.name === 'sum'), '=su 应包含 sum')

  // 输入 =av 应匹配 avg
  const sug2 = matchSuggestions('=av', 3)
  assert(sug2.some((s) => s.name === 'avg'), '=av 应包含 avg')

  // 输入 =if 应匹配 if
  const sug3 = matchSuggestions('=if', 3)
  assert(sug3.some((s) => s.name === 'if'), '=if 应包含 if')

  // 非公式模式不联想
  const sug4 = matchSuggestions('hello', 5)
  assert(sug4.length === 0, '非公式模式不应联想')

  // 完整函数名后不联想
  const sug5 = matchSuggestions('=sum(', 5)
  assert(sug5.length === 0, '=sum( 后不应联想')
}

/** 测试参数提示 */
function testParamHint() {
  console.log('\n[测试2] 参数提示 getParamHint')
  // =sum( 光标在括号内
  const hint1 = getParamHint('=sum()', 5)
  assert(!!hint1, '=sum( 应有参数提示')
  assert(hint1!.name === 'sum', '提示应为 sum')

  // =if( 光标在括号内
  const hint2 = getParamHint('=if(A1>5,', 9)
  assert(!!hint2, '=if(... 内应有参数提示')
  assert(hint2!.name === 'if', '提示应为 if')

  // 当前参数高亮：=if(A1>5, 光标在第一个逗号后 -> activeArg=1
  assert(hint2!.activeArg === 1, `if 第二参数 activeArg 应为 1，实际 ${hint2!.activeArg}`)
  assert(Array.isArray(hint2!.args) && hint2!.args!.length === 3, 'if 应返回 3 个参数名')

  // =sum( 光标紧贴左括号 -> activeArg=0
  assert(hint1!.activeArg === 0, `sum 首参数 activeArg 应为 0，实际 ${hint1!.activeArg}`)

  // 嵌套括号不误计逗号：=if(max(1,2), 外层第一逗号后 -> activeArg=1
  const hint4 = getParamHint('=if(max(1,2),', 13)
  assert(!!hint4 && hint4.name === 'if', '嵌套场景应识别外层 if')
  assert(hint4!.activeArg === 1, `嵌套场景 activeArg 应为 1(忽略内层逗号)，实际 ${hint4!.activeArg}`)

  // 非公式无提示
  const hint3 = getParamHint('hello', 5)
  assert(!hint3, '非公式无参数提示')
}

/** 测试参数数据筛选 */
function testParameterFilter() {
  console.log('\n[测试3] 参数数据筛选 filterRows')
  const rows: DataRow[] = [
    { region: '华东', product: 'A', amount: 100 },
    { region: '华南', product: 'B', amount: 200 },
    { region: '华东', product: 'C', amount: 150 },
    { region: '华北', product: 'A', amount: 300 }
  ]

  const params: Parameter[] = [
    { id: 'p1', name: 'region', label: '区域', type: 'select', defaultValue: '', options: [] }
  ]

  // 空值 = 全部
  const all = ParameterEngine.filterRows(rows, params, { region: '' })
  assert(all.length === 4, `空参数应返回全部 4 行，实际 ${all.length}`)

  // 筛选华东
  const east = ParameterEngine.filterRows(rows, params, { region: '华东' })
  assert(east.length === 2, `华东应返回 2 行，实际 ${east.length}`)
  assert(east.every((r) => r.region === '华东'), '筛选结果应全为华东')

  // 筛选华南
  const south = ParameterEngine.filterRows(rows, params, { region: '华南' })
  assert(south.length === 1, `华南应返回 1 行，实际 ${south.length}`)
}

/** 测试多参数组合筛选 */
function testMultiParamFilter() {
  console.log('\n[测试4] 多参数组合筛选')
  const rows: DataRow[] = [
    { region: '华东', class: '一班', score: 85 },
    { region: '华东', class: '二班', score: 90 },
    { region: '华南', class: '一班', score: 78 },
    { region: '华南', class: '二班', score: 92 }
  ]

  const params: Parameter[] = [
    { id: 'p1', name: 'region', label: '区域', type: 'select', defaultValue: '', options: [] },
    { id: 'p2', name: 'class', label: '班级', type: 'select', defaultValue: '', options: [] }
  ]

  // 两个参数都为空 = 全部
  const all = ParameterEngine.filterRows(rows, params, { region: '', class: '' })
  assert(all.length === 4, `双空参数应返回全部 4 行，实际 ${all.length}`)

  // 只筛区域
  const eastOnly = ParameterEngine.filterRows(rows, params, { region: '华东', class: '' })
  assert(eastOnly.length === 2, `仅华东应返回 2 行，实际 ${eastOnly.length}`)

  // 筛区域+班级
  const east1 = ParameterEngine.filterRows(rows, params, { region: '华东', class: '一班' })
  assert(east1.length === 1, `华东一班应返回 1 行，实际 ${east1.length}`)
  assert(east1[0].score === 85, '应为 85 分')
}

/** 测试 applyToDataSets */
function testApplyToDataSets() {
  console.log('\n[测试5] applyToDataSets 数据集过滤')
  const ds: DataSet = {
    id: 'ds1',
    name: 'ds1',
    sourceId: 'src1',
    extractor: {},
    cachedRows: [
      { region: '华东', amount: 100 },
      { region: '华南', amount: 200 },
      { region: '华东', amount: 300 }
    ]
  }

  const params: Parameter[] = [
    { id: 'p1', name: 'region', label: '区域', type: 'select', defaultValue: '', options: [] }
  ]

  ParameterEngine.applyToDataSets([ds], params, { region: '华东' })
  assert(ds.cachedRows!.length === 2, `过滤后应有 2 行，实际 ${ds.cachedRows!.length}`)
  assert(ds.cachedRows!.every((r) => r.region === '华东'), '应全为华东')
}

/** 测试参数默认值 */
function testDefaultValues() {
  console.log('\n[测试6] 参数默认值')
  const params: Parameter[] = [
    { id: 'p1', name: 'region', label: '区域', type: 'select', defaultValue: '', options: [] },
    { id: 'p2', name: 'minAmount', label: '最低额', type: 'number', defaultValue: '0' },
    { id: 'p3', name: 'passScore', label: '及格线', type: 'number', defaultValue: '60' }
  ]

  const defaults = ParameterEngine.getDefaultValues(params)
  assert(defaults.region === '', 'region 默认值应为空')
  assert(defaults.minAmount === '0', 'minAmount 默认值应为 0')
  assert(defaults.passScore === '60', 'passScore 默认值应为 60')
}

async function main() {
  console.log('=== VReport 公式联想与参数筛选测试 ===')

  testFormulaSuggestions()
  testParamHint()
  testParameterFilter()
  testMultiParamFilter()
  testApplyToDataSets()
  testDefaultValues()

  console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`)
}

it('公式联想与参数筛选', async () => {
  await main()
  expect(failed, `存在 ${failed} 个失败断言`).toBe(0)
})
