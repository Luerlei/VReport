/**
 * 新功能回归测试
 * 测试单元格样式工具栏、批量样式应用、数据源编辑、参数示例等
 */
// 必须最先导入 fake-indexeddb
import 'fake-indexeddb/auto'
import { it, expect } from 'vitest'
import { Grid } from '../src/core/cell/Grid'
import { DEFAULT_STYLE } from '../src/core/cell/types'
import { seedTemplatesIfEmpty, reseedTemplates } from '../src/utils/seed'
import { listTemplates, getTemplate } from '../src/utils/db'
import { createEmptyTemplate, gridFromTemplate, gridToTemplate } from '../src/core/serializer/Serializer'
import { saveTemplate } from '../src/utils/db'

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

/** 测试 Grid.applyStyleToRange 批量样式应用 */
function testApplyStyleToRange() {
  console.log('\n[测试1] 批量样式应用 applyStyleToRange')
  const grid = new Grid(5, 5)
  // 选区 A1:C3 (0,0)-(2,2)
  grid.applyStyleToRange(0, 0, 2, 2, { bold: true, color: '#ff0000' })

  for (let r = 0; r <= 2; r++) {
    for (let c = 0; c <= 2; c++) {
      const cell = grid.getRealCell(r, c)!
      assert(cell.style.bold === true, `单元格 (${r},${c}) 应为加粗`)
      assert(cell.style.color === '#ff0000', `单元格 (${r},${c}) 颜色应为 #ff0000`)
    }
  }
  // 选区外不应受影响
  const d4 = grid.getRealCell(3, 3)!
  assert(d4.style.bold !== true, '选区外单元格 (3,3) 不应加粗')
}

/** 测试 Grid.setBorderToRange 批量边框 */
function testSetBorderToRange() {
  console.log('\n[测试2] 批量边框设置 setBorderToRange')
  const grid = new Grid(4, 4)

  // 全部边框
  grid.setBorderToRange(0, 0, 2, 2, 'all')
  const a1 = grid.getRealCell(0, 0)!
  assert(a1.style.borderTop?.style === 'solid', 'A1 上边框应为 solid')
  assert(a1.style.borderBottom?.style === 'solid', 'A1 下边框应为 solid')
  assert(a1.style.borderLeft?.style === 'solid', 'A1 左边框应为 solid')
  assert(a1.style.borderRight?.style === 'solid', 'A1 右边框应为 solid')

  // 外边框
  const grid2 = new Grid(4, 4)
  grid2.setBorderToRange(0, 0, 2, 2, 'outer')
  const b2 = grid2.getRealCell(1, 1)!
  // 中间单元格不应有外边框
  assert(b2.style.borderTop?.style !== 'solid' || b2.style.borderTop === undefined, 'B2 中间单元格不应有上边框')
  // 边缘单元格应有
  const a1g2 = grid2.getRealCell(0, 0)!
  assert(a1g2.style.borderTop?.style === 'solid', 'A1 外边框上应为 solid')
  assert(a1g2.style.borderLeft?.style === 'solid', 'A1 外边框左应为 solid')

  // 无边框
  grid.setBorderToRange(0, 0, 2, 2, 'none')
  const a1none = grid.getRealCell(0, 0)!
  assert(a1none.style.borderTop?.style === 'none', 'A1 边框清除后应为 none')
}

/** 测试预制报表参数示例 */
async function testSeedParameters() {
  console.log('\n[测试3] 预制报表参数示例')
  await reseedTemplates()
  const list = await listTemplates()
  assert(list.length === 8, `应有 8 个预制模板，实际 ${list.length}`)

  const sales = list.find((t) => t.name === '销售明细报表')!
  assert(!!sales, '应存在销售明细报表')
  assert(sales.parameters.length === 2, `销售报表应有 2 个参数，实际 ${sales.parameters.length}`)
  const regionParam = sales.parameters.find((p) => p.name === 'region')
  assert(!!regionParam, '应有 region 参数')
  assert(regionParam!.type === 'select', 'region 参数应为 select 类型')
  assert(regionParam!.options!.length === 5, `region 参数应有 5 个选项，实际 ${regionParam!.options!.length}`)
  const minAmountParam = sales.parameters.find((p) => p.name === 'minAmount')
  assert(!!minAmountParam, '应有 minAmount 参数')
  assert(minAmountParam!.type === 'number', 'minAmount 参数应为 number 类型')

  const score = list.find((t) => t.name === '学生成绩统计表')!
  assert(!!score, '应存在学生成绩统计表')
  assert(score.parameters.length === 3, `成绩报表应有 3 个参数，实际 ${score.parameters.length}`)
  const classParam = score.parameters.find((p) => p.name === 'class')
  assert(!!classParam, '应有 class 参数')
  assert(classParam!.options!.length === 3, `class 参数应有 3 个选项，实际 ${classParam!.options!.length}`)
  const passScoreParam = score.parameters.find((p) => p.name === 'passScore')
  assert(!!passScoreParam, '应有 passScore 参数')
  assert(passScoreParam!.defaultValue === '60', 'passScore 默认值应为 60')

  const bindingDemo = list.find((t) => t.name === '数据绑定聚合与条件格式示例')
  assert(!!bindingDemo, '应存在数据绑定聚合与条件格式示例模板')
  assert((bindingDemo?.conditionFormats?.length ?? 0) >= 12, '条件格式示例应覆盖常见规则、数据集变量规则与规格示例')
  const bindingText = JSON.stringify(bindingDemo?.cells ?? [])
  assert(bindingText.includes('group(规格分组)'), '应包含规格分组聚合示例')
  assert(bindingText.includes('distinct(规格去重)'), '应包含规格去重聚合示例')
}

/** 测试空模板保存（回归） */
async function testEmptyTemplateSave() {
  console.log('\n[测试4] 空模板保存回归')
  const tpl = createEmptyTemplate()
  tpl.name = '测试空模板'
  assert(tpl.rows.length === 30, `空模板应有 30 行，实际 ${tpl.rows.length}`)
  assert(tpl.columns.length === 12, `空模板应有 12 列，实际 ${tpl.columns.length}`)
  await saveTemplate(tpl)
  const loaded = await getTemplate(tpl.id)
  assert(!!loaded, '保存后应能读取')
  assert(loaded!.name === '测试空模板', '名称应匹配')
}

/** 测试 Excel 风格公式（= 前缀 + 函数） */
function testExcelStyleFormulas() {
  console.log('\n[测试5] Excel 风格公式兼容性')
  const grid = new Grid(5, 3)
  // 设置一些值
  grid.setCellContent(0, 0, '10')
  grid.setCellContent(1, 0, '20')
  grid.setCellContent(2, 0, '30')
  // SUM 公式
  grid.setCellContent(3, 0, '=sum(A1:A3)')
  const cell = grid.getRealCell(3, 0)!
  assert(cell.cellType === 'formula', '以 = 开头应识别为 formula 类型')
  assert(cell.content === '=sum(A1:A3)', '公式内容应保留')

  // 大小写不敏感
  grid.setCellContent(3, 1, '=SUM(A1:A3)')
  const cell2 = grid.getRealCell(3, 1)!
  assert(cell2.cellType === 'formula', '大写 SUM 也应识别为 formula')

  // IF 公式
  grid.setCellContent(4, 0, '=if(A1>5,"大","小")')
  const cell3 = grid.getRealCell(4, 0)!
  assert(cell3.cellType === 'formula', 'IF 公式应识别为 formula')
}

/** 测试多选区域样式应用后序列化/反序列化 */
function testStyleSerializationWithRange() {
  console.log('\n[测试6] 批量样式序列化/反序列化')
  const grid = new Grid(3, 3)
  grid.applyStyleToRange(0, 0, 1, 1, { bold: true, fontSize: 14, background: '#ffff00' })

  const json = grid.toJSON()
  const restored = Grid.fromJSON(json)

  const a1 = restored.getRealCell(0, 0)!
  assert(a1.style.bold === true, '反序列化后 A1 应为加粗')
  assert(a1.style.fontSize === 14, '反序列化后 A1 字号应为 14')
  assert(a1.style.background === '#ffff00', '反序列化后 A1 背景应为 #ffff00')

  const b2 = restored.getRealCell(1, 1)!
  assert(b2.style.bold === true, '反序列化后 B2 应为加粗')
}

/** 测试合并单元格后样式应用 */
function testStyleOnMergedCell() {
  console.log('\n[测试7] 合并单元格样式应用')
  const grid = new Grid(4, 4)
  // 合并 A1:B2
  grid.merge(0, 0, 1, 1)
  // 对选区应用样式
  grid.applyStyleToRange(0, 0, 1, 1, { bold: true })
  const main = grid.getRealCell(0, 0)!
  assert(main.style.bold === true, '合并主格应应用样式')
  assert(main.rowSpan === 2, '合并行跨度应为 2')
}

/** 测试插入行列后公式引用自动平移 */
function testFormulaRefsFollowInsert() {
  console.log('\n[测试8] 插入行列后公式引用自动跟随')
  const grid = new Grid(6, 6)
  grid.setCellContent(0, 0, '1')
  grid.setCellContent(1, 0, '2')
  grid.setCellContent(2, 1, '=A1+A2')
  grid.setCellContent(3, 1, '=sum(A1:A2)')

  grid.insertRow(1)
  assert(grid.getRealCell(3, 1)!.content === '=A1+A3', `插入行后单格引用应变为 =A1+A3，实际 ${grid.getRealCell(3, 1)!.content}`)
  assert(grid.getRealCell(4, 1)!.content === '=sum(A1:A3)', `插入行后范围引用应变为 =sum(A1:A3)，实际 ${grid.getRealCell(4, 1)!.content}`)

  const grid2 = new Grid(6, 6)
  grid2.setCellContent(0, 0, '1')
  grid2.setCellContent(0, 1, '2')
  grid2.setCellContent(1, 2, '=A1+B1')
  grid2.setCellContent(2, 2, '=sum(A1:B1)')

  grid2.insertCol(1)
  assert(grid2.getRealCell(1, 3)!.content === '=A1+C1', `插入列后单格引用应变为 =A1+C1，实际 ${grid2.getRealCell(1, 3)!.content}`)
  assert(grid2.getRealCell(2, 3)!.content === '=sum(A1:C1)', `插入列后范围引用应变为 =sum(A1:C1)，实际 ${grid2.getRealCell(2, 3)!.content}`)
}

/** 测试删除行列后公式引用自动收缩/修正 */
function testFormulaRefsFollowDelete() {
  console.log('\n[测试9] 删除行列后公式引用自动跟随')
  const grid = new Grid(6, 6)
  grid.setCellContent(0, 0, '1')
  grid.setCellContent(1, 0, '2')
  grid.setCellContent(2, 0, '3')
  grid.setCellContent(3, 1, '=A1+A3')
  grid.setCellContent(4, 1, '=sum(A1:A3)')

  grid.deleteRow(1)
  assert(grid.getRealCell(2, 1)!.content === '=A1+A2', `删除行后单格引用应变为 =A1+A2，实际 ${grid.getRealCell(2, 1)!.content}`)
  assert(grid.getRealCell(3, 1)!.content === '=sum(A1:A2)', `删除行后范围引用应变为 =sum(A1:A2)，实际 ${grid.getRealCell(3, 1)!.content}`)

  const grid2 = new Grid(6, 6)
  grid2.setCellContent(0, 0, '1')
  grid2.setCellContent(0, 1, '2')
  grid2.setCellContent(0, 2, '3')
  grid2.setCellContent(1, 3, '=A1+C1')
  grid2.setCellContent(2, 3, '=sum(A1:C1)')

  grid2.deleteCol(1)
  assert(grid2.getRealCell(1, 2)!.content === '=A1+B1', `删除列后单格引用应变为 =A1+B1，实际 ${grid2.getRealCell(1, 2)!.content}`)
  assert(grid2.getRealCell(2, 2)!.content === '=sum(A1:B1)', `删除列后范围引用应变为 =sum(A1:B1)，实际 ${grid2.getRealCell(2, 2)!.content}`)
}

/** 测试绝对引用在插删行列时保持固定 */
function testAbsoluteRefsRemainStable() {
  console.log('\n[测试10] 绝对引用在结构编辑后保持固定')
  const grid = new Grid(6, 6)
  grid.setCellContent(2, 2, '=sum($A$1,A$2,$B1,B2)')

  grid.insertRow(1)
  grid.insertCol(1)
  assert(grid.getRealCell(3, 3)!.content === '=sum($A$1,A$2,$B1,C3)', `插入行列后绝对/相对混合引用应正确，实际 ${grid.getRealCell(3, 3)!.content}`)

  grid.deleteRow(1)
  grid.deleteCol(1)
  assert(grid.getRealCell(2, 2)!.content === '=sum($A$1,A$2,$B1,B2)', `删除回退后绝对/相对混合引用应恢复，实际 ${grid.getRealCell(2, 2)!.content}`)
}

/** 测试主格引用在插删行列后自动跟随 */
function testMasterRefsFollowStructureChanges() {
  console.log('\n[测试11] 主格引用在结构编辑后自动跟随')
  const grid = new Grid(6, 6)
  const master = grid.getRealCell(1, 1)!
  master.expandDirection = 'down'
  const child = grid.getRealCell(1, 2)!
  child.leftMasterCell = 'B2'
  const topChild = grid.getRealCell(2, 1)!
  topChild.topMasterCell = 'B2'

  grid.insertRow(0)
  grid.insertCol(0)
  assert(grid.getRealCell(2, 3)!.leftMasterCell === 'C3', `插入后 leftMasterCell 应为 C3，实际 ${grid.getRealCell(2, 3)!.leftMasterCell}`)
  assert(grid.getRealCell(3, 2)!.topMasterCell === 'C3', `插入后 topMasterCell 应为 C3，实际 ${grid.getRealCell(3, 2)!.topMasterCell}`)

  grid.deleteRow(0)
  grid.deleteCol(0)
  assert(grid.getRealCell(1, 2)!.leftMasterCell === 'B2', `删除后 leftMasterCell 应恢复 B2，实际 ${grid.getRealCell(1, 2)!.leftMasterCell}`)
  assert(grid.getRealCell(2, 1)!.topMasterCell === 'B2', `删除后 topMasterCell 应恢复 B2，实际 ${grid.getRealCell(2, 1)!.topMasterCell}`)
}

async function main() {
  console.log('=== VReport 新功能回归测试 ===')

  testApplyStyleToRange()
  testSetBorderToRange()
  await testSeedParameters()
  await testEmptyTemplateSave()
  testExcelStyleFormulas()
  testStyleSerializationWithRange()
  testStyleOnMergedCell()
  testFormulaRefsFollowInsert()
  testFormulaRefsFollowDelete()
  testAbsoluteRefsRemainStable()
  testMasterRefsFollowStructureChanges()

  console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`)
}

it('新功能回归', async () => {
  await main()
  expect(failed, `存在 ${failed} 个失败断言`).toBe(0)
})
