/**
 * 端到端测试脚本
 * 测试 ExpandEngine、Aggregator、Serializer 等核心流程
 */
// 必须最先导入 fake-indexeddb，让 Dexie 能检测到
import 'fake-indexeddb/auto'
import { it, expect } from 'vitest'
import { Grid } from '../src/core/cell/Grid'
import { createCell, DEFAULT_STYLE } from '../src/core/cell/types'
import { ExpandEngine } from '../src/core/engine/ExpandEngine'
import { Aggregator } from '../src/core/engine/Aggregator'
import { createEmptyTemplate, gridFromTemplate, gridToTemplate } from '../src/core/serializer/Serializer'
import { saveTemplate, getTemplate, deleteTemplate, listTemplates } from '../src/utils/db'
import { seedTemplatesIfEmpty } from '../src/utils/seed'
import type { DataSource, DataSet } from '../src/types'
import { uid } from '../src/utils/id'

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

async function testSeed() {
  console.log('\n[测试] 种子数据')
  await seedTemplatesIfEmpty()
  const list = await listTemplates()
  assert(list.length === 8, `应有八个预制模板，实际 ${list.length}`)
  assert(list.some((t) => t.name === '销售明细报表'), '应包含销售明细报表')
  assert(list.some((t) => t.name === '学生成绩统计表'), '应包含学生成绩统计表')
  assert(list.some((t) => t.name === '公式功能测试·单元格引用'), '应包含公式功能测试·单元格引用')
  assert(list.some((t) => t.name === '公式功能测试·动态引用目标'), '应包含公式功能测试·动态引用目标')
  assert(list.some((t) => t.name === '数据绑定聚合与条件格式示例'), '应包含数据绑定聚合与条件格式示例')
  assert(list.some((t) => t.name === '公式功能测试·字面量'), '应包含公式功能测试·字面量')
  assert(list.some((t) => t.name === '公式·数据集变量·向下展开'), '应包含公式·数据集变量·向下展开')
  assert(list.some((t) => t.name === '公式·数据集变量·向右展开'), '应包含公式·数据集变量·向右展开')
}

async function testEmptyTemplateSave() {
  console.log('\n[测试] 空模板保存')
  const tpl = createEmptyTemplate('测试空模板')
  assert(tpl.cells.length > 0, `空模板应有行，实际 ${tpl.cells.length}`)
  assert(tpl.cells[0].length > 0, `空模板应有列，实际 ${tpl.cells[0].length}`)
  await saveTemplate(tpl)
  const loaded = await getTemplate(tpl.id)
  assert(!!loaded, '保存后应能读取')
  assert(loaded?.name === '测试空模板', '名称应匹配')
  await deleteTemplate(tpl.id)
}

async function testExpandEngine() {
  console.log('\n[测试] 展开引擎')
  // 加载销售模板
  const list = await listTemplates()
  const sales = list.find((t) => t.name === '销售明细报表')!
  const grid = gridFromTemplate(sales)
  assert(grid.cells.length === 8, `Grid 行数应为 8，实际 ${grid.cells.length}`)
  assert(grid.cells[0].length === 6, `Grid 列数应为 6，实际 ${grid.cells[0].length}`)

  // 展开前先填充数据集缓存
  const ds = sales.dataSources[0]
  const dataSet = sales.dataSets[0]
  // 模拟取数
  const data = JSON.parse(ds.config.rawJson)
  dataSet.cachedRows = data

  const engine = new ExpandEngine(
    grid.cells,
    grid.rows.map((r) => r.height),
    grid.columns.map((c) => c.width),
    sales.dataSets
  )
  const result = engine.expand()
  // 10 条数据，原 8 行，数据行 row=2 展开为 10 行，总行数 = 8 + 9 = 17
  assert(result.grid.length === 17, `展开后行数应为 17，实际 ${result.grid.length}`)
  assert(result.grid[0].length === 6, `列数应保持 6，实际 ${result.grid[0].length}`)

  // 聚合求值
  const aggregator = new Aggregator(result.grid)
  aggregator.evaluateAll()

  // 检查数据行（row=2 应是第一条数据）
  const dataCell = result.grid[2][0]
  assert(!!dataCell, '数据行第一格应存在')
  assert(dataCell?.value === '华东', `第一条数据 region 应为华东，实际 ${dataCell?.value}`)

  // 检查汇总行（row=12 应是合计行）
  const sumCell = result.grid[12][3]
  assert(!!sumCell, '汇总行 D 列应存在')
  const sumVal = sumCell?.value
  console.log(`  汇总值: ${sumVal}`)
  // 调试：输出 D 列所有值
  const dColValues: unknown[] = []
  for (let r = 2; r < result.grid.length; r++) {
    const c = result.grid[r]?.[3]
    if (c) dColValues.push(c.value)
  }
  console.log(`  D列所有值: ${JSON.stringify(dColValues)}`)
  // 10 条数据 amount 总和应为 113500
  assert(sumVal === 113500, `汇总应为 113500，实际 ${sumVal}`)

  // 检查平均单价（F 列 col=5，第一条数据 12500/5=2500）
  const avgCell = result.grid[2][5]
  assert(!!avgCell, '平均单价单元格应存在')
  console.log(`  第一条平均单价: ${avgCell?.value}`)
  assert(avgCell?.value === 2500, `第一条平均单价应为 2500，实际 ${avgCell?.value}`)
}

async function testScoreTemplate() {
  console.log('\n[测试] 成绩模板')
  const list = await listTemplates()
  const score = list.find((t) => t.name === '学生成绩统计表')!
  const grid = gridFromTemplate(score)

  const ds = score.dataSources[0]
  const dataSet = score.dataSets[0]
  dataSet.cachedRows = JSON.parse(ds.config.rawJson)

  const engine = new ExpandEngine(
    grid.cells,
    grid.rows.map((r) => r.height),
    grid.columns.map((c) => c.width),
    score.dataSets
  )
  const result = engine.expand()
  // 12 条数据，原 7 行，数据行 row=2 展开为 12 行，总行数 = 7 + 11 = 18
  assert(result.grid.length === 18, `展开后行数应为 18，实际 ${result.grid.length}`)

  const aggregator = new Aggregator(result.grid)
  aggregator.evaluateAll()

  // 检查等级判定（row=2 第一条数据，score=88，应为"良好"）
  const gradeCell = result.grid[2][4]
  assert(!!gradeCell, '等级单元格应存在')
  console.log(`  第一条数据等级: ${gradeCell?.value}`)
  assert(gradeCell?.value === '良好', `88 分应为良好，实际 ${gradeCell?.value}`)
}

async function testDynamicReferenceTemplate() {
  console.log('\n[测试] 动态引用目标模板')
  const list = await listTemplates()
  const tpl = list.find((t) => t.name === '公式功能测试·动态引用目标')!
  assert(!!tpl, '应存在公式功能测试·动态引用目标模板')

  tpl.dataSets.forEach((set) => {
    const source = tpl.dataSources.find((s) => s.id === set.sourceId)!
    set.cachedRows = JSON.parse(source.config.rawJson)
  })

  const grid = gridFromTemplate(tpl)
  const result = new ExpandEngine(
    grid.cells,
    grid.rows.map((r) => r.height),
    grid.columns.map((c) => c.width),
    tpl.dataSets
  ).expand()
  const aggregator = new Aggregator(result.grid)
  aggregator.evaluateAll()

  // section 二: 数据集字段动态聚合
  assert(result.grid[10][2]?.value === 70, `sum(${'{'}calcData.qty}) 应为 70，实际 ${result.grid[10][2]?.value}`)
  assert(result.grid[16][2]?.value === 140, `组合计算应为 140，实际 ${result.grid[16][2]?.value}`)

  // section 三: 普通单元格/普通公式/范围引用自动跟随
  assert(result.grid[22][2]?.value === 12, `中间公式应为 12，实际 ${result.grid[22][2]?.value}`)
  assert(result.grid[22][3]?.value === 24, `引用中间公式应为 24，实际 ${result.grid[22][3]?.value}`)
  assert(result.grid[22][4]?.value === 24, `范围求和应为 24，实际 ${result.grid[22][4]?.value}`)

  // section 四: 40 函数普通单元格引用区，抽样校验一条数学和一条聚合
  assert(result.grid[32][6]?.value === 1024, `pow 测试结果应为 1024，实际 ${result.grid[32][6]?.value}`)
  assert(result.grid[43][6]?.value === 60, `sum 范围测试结果应为 60，实际 ${result.grid[43][6]?.value}`)

  // section 五: 右展开回归样例
  const bySource = (name: string) => {
    const hits: Array<{ row: number; col: number; value: unknown }> = []
    for (let r = 0; r < result.grid.length; r++) {
      for (let c = 0; c < result.grid[r].length; c++) {
        const cell = result.grid[r][c]
        if (cell?.source.name === name) {
          hits.push({ row: r, col: c, value: cell.value })
        }
      }
    }
    return hits.sort((a, b) => a.col - b.col)
  }

  // 同一行多 right（F68 / G68）
  const f68 = bySource('F68')
  const g68 = bySource('G68')
  assert(f68.length === 3, `F68 应展开 3 列，实际 ${f68.length}`)
  assert(g68.length === 3, `G68 应展开 3 列，实际 ${g68.length}`)
  assert(f68[0].row === g68[0].row, `F68/G68 应在同一渲染行，实际 ${f68[0].row}/${g68[0].row}`)
  assert(g68[0].col > f68[f68.length - 1].col, `G68 应位于 F68 展开区域右侧，实际 ${g68[0].col} <= ${f68[f68.length - 1].col}`)
  assert(
    JSON.stringify(f68.map((x) => x.value)) === JSON.stringify(['上移一', '上移二', '上移三']),
    `F68 展开值不符合预期：${JSON.stringify(f68.map((x) => x.value))}`
  )
  assert(
    JSON.stringify(g68.map((x) => x.value)) === JSON.stringify(['上移一', '上移二', '上移三']),
    `G68 展开值不符合预期：${JSON.stringify(g68.map((x) => x.value))}`
  )

  // 跨行同字段重复 right（F70 / F71）
  const f70 = bySource('F70')
  const f71 = bySource('F71')
  assert(f70.length === 3, `F70 应展开 3 列，实际 ${f70.length}`)
  assert(f71.length === 3, `F71 应展开 3 列，实际 ${f71.length}`)
  assert(f70[0].row < f71[0].row, `F71 应位于 F70 的下方，实际 ${f70[0].row}/${f71[0].row}`)
  assert(
    JSON.stringify(f70.map((x) => x.value)) === JSON.stringify(['上移一', '上移二', '上移三']),
    `F70 展开值不符合预期：${JSON.stringify(f70.map((x) => x.value))}`
  )
  assert(
    JSON.stringify(f71.map((x) => x.value)) === JSON.stringify(['上移一', '上移二', '上移三']),
    `F71 展开值不符合预期：${JSON.stringify(f71.map((x) => x.value))}`
  )
}

async function main() {
  console.log('=== VReport 端到端测试 ===')
  try {
    await testSeed()
    await testEmptyTemplateSave()
    await testExpandEngine()
    await testScoreTemplate()
    await testDynamicReferenceTemplate()
  } catch (e) {
    console.error('测试异常:', e)
    failed++
  }
  console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`)
}

it('端到端核心流程', async () => {
  await main()
  expect(failed, `存在 ${failed} 个失败断言`).toBe(0)
})
