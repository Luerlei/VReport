/**
 * 端到端测试脚本
 * 测试 ExpandEngine、Aggregator、Serializer 等核心流程
 */
// 必须最先导入 fake-indexeddb，让 Dexie 能检测到
import 'fake-indexeddb/auto'
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
  assert(list.length === 3, `应有3个预制模板，实际 ${list.length}`)
  assert(list.some((t) => t.name === '销售明细报表'), '应包含销售明细报表')
  assert(list.some((t) => t.name === '学生成绩统计表'), '应包含学生成绩统计表')
  assert(list.some((t) => t.name === '公式函数完整示例'), '应包含公式函数完整示例')
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

  // 展开前先填充数据集缓存（直接从 JSON 解析后注入，避免序列化丢失）
  const rawData = JSON.parse(sales.dataSources[0].config.rawJson || '[]')
  const dataSet = sales.dataSets[0]
  dataSet.cachedRows = rawData
  dataSet.extractor.fields = { region: 'region', product: 'product', salesperson: 'salesperson', amount: 'amount', qty: 'qty' }

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
  // 10 条数据 amount 总和应为 113500
  assert(sumVal === 113500, `汇总应为 113500，实际 ${sumVal}`)

  // 检查平均单价（F 列 col=5，第一条数据 12500/5=2500）
  const avgCell = result.grid[2][5]
  assert(!!avgCell, '平均单价单元格应存在')
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
  assert(gradeCell?.value === '良好', `88 分应为良好，实际 ${gradeCell?.value}`)
}

async function main() {
  console.log('=== VReport 端到端测试 ===')
  try {
    await testSeed()
    await testEmptyTemplateSave()
    await testExpandEngine()
    await testScoreTemplate()
  } catch (e) {
    console.error('测试异常:', e)
    failed++
  }
  console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
