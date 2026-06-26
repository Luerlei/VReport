/**
 * 浏览器流程模拟测试
 * 模拟用户在浏览器中的完整操作流程：新建 -> 编辑 -> 保存 -> 列表 -> 预览 -> 导出
 */
// 必须最先导入 fake-indexeddb，让 Dexie 能检测到
import 'fake-indexeddb/auto'
import { createEmptyTemplate, gridFromTemplate, gridToTemplate, exportTemplateFile, importTemplateFile } from '../src/core/serializer/Serializer'
import { saveTemplate, getTemplate, deleteTemplate, listTemplates } from '../src/utils/db'
import { seedTemplatesIfEmpty } from '../src/utils/seed'
import { Grid } from '../src/core/cell/Grid'
import { ExpandEngine } from '../src/core/engine/ExpandEngine'
import { Aggregator } from '../src/core/engine/Aggregator'
import { fetchData } from '../src/core/datasource/ProviderRegistry'
import { createExporter } from '../src/core/export/ExporterRegistry'
import type { ReportTemplate } from '../src/types'

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

/** 测试1: 完整的新建空模板 -> 保存 -> 读取 -> 删除流程 */
async function testNewEmptyTemplateLifecycle() {
  console.log('\n[测试1] 新建空模板完整生命周期')
  // 1. 新建（模拟 report.newTemplate）
  const tpl = createEmptyTemplate('我的空模板')
  assert(!!tpl.id, '新模板应有 ID')
  assert(tpl.cells.length === 30, `应有 30 行，实际 ${tpl.cells.length}`)
  assert(tpl.cells[0].length === 12, `应有 12 列，实际 ${tpl.cells[0].length}`)
  assert(tpl.dataSources.length === 0, '空模板无数据源')
  assert(tpl.dataSets.length === 0, '空模板无数据集')

  // 2. 模拟设计器编辑：修改单元格内容
  const grid = gridFromTemplate(tpl)
  grid.setCellContent(0, 0, '标题')
  grid.setCellContent(1, 0, '=sum(A3:A10)')
  grid.merge(0, 0, 0, 5)

  // 3. 保存（模拟 report.save）
  gridToTemplate(grid, tpl)
  await saveTemplate(tpl)
  assert(true, '保存不应抛出异常')

  // 4. 读取验证
  const loaded = await getTemplate(tpl.id)
  assert(!!loaded, '保存后应能读取')
  assert(loaded?.name === '我的空模板', '名称应匹配')
  assert(loaded?.cells[0][0]?.content === '标题', `A1 内容应为"标题"，实际 "${loaded?.cells[0][0]?.content}"`)
  assert(loaded?.cells[0][0]?.colSpan === 6, `A1 合并跨度应为 6，实际 ${loaded?.cells[0][0]?.colSpan}`)
  assert(loaded?.cells[1][0]?.content === '=sum(A3:A10)', `A2 应为公式，实际 "${loaded?.cells[1][0]?.content}"`)
  assert(loaded?.cells[1][0]?.cellType === 'formula', `A2 类型应为 formula，实际 ${loaded?.cells[1][0]?.cellType}`)

  // 5. 列表中应能找到
  const list = await listTemplates()
  assert(list.some((t) => t.id === tpl.id), '列表中应包含新模板')

  // 6. 删除
  await deleteTemplate(tpl.id)
  const deleted = await getTemplate(tpl.id)
  assert(!deleted, '删除后应读取不到')
}

/** 测试2: 模板 CRUD 全流程 */
async function testTemplateCRUD() {
  console.log('\n[测试2] 模板 CRUD 全流程')
  // Create
  const tpl = createEmptyTemplate('CRUD 测试')
  tpl.description = '测试描述'
  tpl.tags = ['测试', 'CRUD']
  await saveTemplate(tpl)

  // Read
  let loaded = await getTemplate(tpl.id)
  assert(!!loaded, 'C: 创建后应能读取')
  assert(loaded?.description === '测试描述', 'C: 描述应匹配')
  assert(loaded?.tags?.length === 2, `C: 标签数应为 2，实际 ${loaded?.tags?.length}`)

  // Update
  loaded!.name = 'CRUD 测试-已修改'
  loaded!.description = '已修改的描述'
  await saveTemplate(loaded!)
  const updated = await getTemplate(tpl.id)
  assert(updated?.name === 'CRUD 测试-已修改', 'U: 名称应已修改')
  assert(updated?.description === '已修改的描述', 'U: 描述应已修改')

  // Delete
  await deleteTemplate(tpl.id)
  const deleted = await getTemplate(tpl.id)
  assert(!deleted, 'D: 删除后应读取不到')
}

/** 测试3: 复制模板 */
async function testDuplicateTemplate() {
  console.log('\n[测试3] 复制模板')
  const original = createEmptyTemplate('原模板')
  original.tags = ['原']
  await saveTemplate(original)

  // 复制
  const copy: ReportTemplate = {
    ...JSON.parse(JSON.stringify(original)),
    id: 'tpl_copy_' + Date.now(),
    name: original.name + ' - 副本',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  await saveTemplate(copy)

  const loadedCopy = await getTemplate(copy.id)
  assert(!!loadedCopy, '复制后应能读取')
  assert(loadedCopy?.name === '原模板 - 副本', '复制名称应正确')
  assert(loadedCopy?.id !== original.id, 'ID 应不同')
  assert(loadedCopy?.tags?.length === 1, '标签应保留')

  // 清理
  await deleteTemplate(original.id)
  await deleteTemplate(copy.id)
}

/** 测试4: 预制模板预览渲染（模拟 PreviewView 完整流程） */
async function testPreviewFlow() {
  console.log('\n[测试4] 预览渲染流程')
  await seedTemplatesIfEmpty()
  const list = await listTemplates()
  const sales = list.find((t) => t.name === '销售明细报表')!
  assert(!!sales, '应有销售模板')

  // 模拟打开模板
  const grid = gridFromTemplate(sales)

  // 模拟 fetchData（取数）
  for (const ds of sales.dataSets) {
    const source = sales.dataSources.find((s) => s.id === ds.sourceId)!
    ds.cachedRows = await fetchData(source, ds)
  }
  assert(sales.dataSets[0].cachedRows?.length === 10, `应有 10 条数据，实际 ${sales.dataSets[0].cachedRows?.length}`)

  // 展开引擎
  const engine = new ExpandEngine(
    grid.cells,
    grid.rows.map((r) => r.height),
    grid.columns.map((c) => c.width),
    sales.dataSets
  )
  const result = engine.expand()
  assert(result.grid.length === 17, `展开后应有 17 行，实际 ${result.grid.length}`)

  // 聚合求值
  const aggregator = new Aggregator(result.grid)
  aggregator.evaluateAll()

  // 验证关键数据
  assert(result.grid[2][0]?.value === '华东', '首行 region 应为华东')
  assert(result.grid[2][3]?.value === 12500, `首行 amount 应为 12500，实际 ${result.grid[2][3]?.value}`)
  assert(result.grid[12][3]?.value === 113500, `合计应为 113500，实际 ${result.grid[12][3]?.value}`)
  assert(result.grid[2][5]?.value === 2500, `首行平均单价应为 2500，实际 ${result.grid[2][5]?.value}`)
}

/** 测试5: 导出流程（HTML/Excel/PDF） */
async function testExportFlow() {
  console.log('\n[测试5] 导出流程')
  await seedTemplatesIfEmpty()
  const list = await listTemplates()
  const sales = list.find((t) => t.name === '销售明细报表')!

  const grid = gridFromTemplate(sales)
  for (const ds of sales.dataSets) {
    const source = sales.dataSources.find((s) => s.id === ds.sourceId)!
    ds.cachedRows = await fetchData(source, ds)
  }
  const engine = new ExpandEngine(
    grid.cells,
    grid.rows.map((r) => r.height),
    grid.columns.map((c) => c.width),
    sales.dataSets
  )
  const result = engine.expand()
  const aggregator = new Aggregator(result.grid)
  aggregator.evaluateAll()

  // 测试 HTML 导出
  try {
    const htmlExporter = createExporter('html', sales.conditionFormats)
    // Node 环境无 document/Blob，跳过实际导出，仅验证 exporter 创建成功
    assert(!!htmlExporter, 'HTML 导出器应创建成功')
  } catch (e) {
    assert(false, `HTML 导出器创建失败: ${(e as Error).message}`)
  }

  // 测试 Excel 导出
  try {
    const excelExporter = createExporter('excel', sales.conditionFormats)
    assert(!!excelExporter, 'Excel 导出器应创建成功')
  } catch (e) {
    assert(false, `Excel 导出器创建失败: ${(e as Error).message}`)
  }

  // 测试 PDF 导出
  try {
    const pdfExporter = createExporter('pdf', sales.conditionFormats)
    assert(!!pdfExporter, 'PDF 导出器应创建成功')
  } catch (e) {
    assert(false, `PDF 导出器创建失败: ${(e as Error).message}`)
  }
}

/** 测试6: 导入/导出模板文件 */
async function testImportExportFile() {
  console.log('\n[测试6] 导入/导出模板文件')
  const tpl = createEmptyTemplate('导入导出测试')
  tpl.description = '测试导入导出'

  // 导出（模拟 exportTemplateFile，但不实际下载）
  const json = JSON.stringify(tpl, null, 2)
  assert(json.includes('导入导出测试'), '导出 JSON 应包含模板名')
  assert(json.includes('"cells"'), '导出 JSON 应包含 cells 字段')

  // 导入（模拟 importTemplateFile）
  const imported = JSON.parse(json) as ReportTemplate
  imported.id = 'tpl_imported_' + Date.now()
  imported.updatedAt = Date.now()
  await saveTemplate(imported)

  const loaded = await getTemplate(imported.id)
  assert(!!loaded, '导入后应能读取')
  assert(loaded?.name === '导入导出测试', '导入名称应匹配')
  assert(loaded?.cells.length === tpl.cells.length, '行数应一致')

  // 清理
  await deleteTemplate(imported.id)
}

/** 测试7: 表达式引擎（各种公式） */
async function testExpressionEngine() {
  console.log('\n[测试7] 表达式引擎')
  await seedTemplatesIfEmpty()
  const list = await listTemplates()
  const score = list.find((t) => t.name === '学生成绩统计表')!

  const grid = gridFromTemplate(score)
  for (const ds of score.dataSets) {
    const source = score.dataSources.find((s) => s.id === ds.sourceId)!
    ds.cachedRows = await fetchData(source, ds)
  }
  const engine = new ExpandEngine(
    grid.cells,
    grid.rows.map((r) => r.height),
    grid.columns.map((c) => c.width),
    score.dataSets
  )
  const result = engine.expand()
  const aggregator = new Aggregator(result.grid)
  aggregator.evaluateAll()

  // 验证等级判定（嵌套 if）
  // 第一条 score=88 -> 良好
  assert(result.grid[2][4]?.value === '良好', `88 分应为良好，实际 ${result.grid[2][4]?.value}`)

  // 验证平均分
  const avgCell = result.grid[14][3]
  assert(!!avgCell, '平均分单元格应存在')
  console.log(`  平均分: ${avgCell?.value}`)

  // 检查所有等级值
  const grades: unknown[] = []
  for (let r = 2; r < 14; r++) {
    const c = result.grid[r]?.[4]
    if (c) grades.push(c.value)
  }
  console.log(`  所有等级: ${JSON.stringify(grades)}`)
  const validGrades = ['优秀', '良好', '及格', '不及格']
  assert(grades.every((g) => validGrades.includes(g as string)), '所有等级应为有效值')
}

/** 测试8: 空数据集展开 */
async function testEmptyDatasetExpand() {
  console.log('\n[测试8] 空数据集展开')
  const tpl = createEmptyTemplate('空数据集测试')
  // 添加一个空数据集
  tpl.dataSources = [{
    id: 'ds_empty',
    name: 'emptySource',
    type: 'json',
    config: { rawJson: '[]' },
    createdAt: Date.now()
  }]
  tpl.dataSets = [{
    id: 'set_empty',
    name: 'ds1',
    sourceId: 'ds_empty',
    extractor: {}
  }]
  // 设置一个展开单元格
  const grid = gridFromTemplate(tpl)
  const cell = grid.cells[0][0]!
  cell.content = '${ds1.name}'
  cell.dataset = 'ds1'
  cell.expandDirection = 'down'
  gridToTemplate(grid, tpl)

  // 取数
  tpl.dataSets[0].cachedRows = await fetchData(tpl.dataSources[0], tpl.dataSets[0])
  assert(tpl.dataSets[0].cachedRows?.length === 0, '空数据集应返回 0 行')

  // 展开（不应崩溃）
  const engine = new ExpandEngine(
    grid.cells,
    grid.rows.map((r) => r.height),
    grid.columns.map((c) => c.width),
    tpl.dataSets
  )
  const result = engine.expand()
  assert(result.grid.length >= 1, `空数据集展开后至少 1 行，实际 ${result.grid.length}`)

  // 聚合（不应崩溃）
  const aggregator = new Aggregator(result.grid)
  aggregator.evaluateAll()
  assert(true, '空数据集聚合不应崩溃')
}

async function main() {
  console.log('=== VReport 浏览器流程模拟测试 ===')
  try {
    await testNewEmptyTemplateLifecycle()
    await testTemplateCRUD()
    await testDuplicateTemplate()
    await testPreviewFlow()
    await testExportFlow()
    await testImportExportFile()
    await testExpressionEngine()
    await testEmptyDatasetExpand()
  } catch (e) {
    console.error('测试异常:', e)
    failed++
  }
  console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
