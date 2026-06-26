/**
 * 新增元素(图片/二维码/条码/图表)功能测试
 * 验证类型扩展、配置写入、序列化、特殊类型保护等
 */
import 'fake-indexeddb/auto'
import { Grid } from '../src/core/cell/Grid'
import { createCell, type Cell } from '../src/core/cell/types'
import { createEmptyTemplate, gridFromTemplate, gridToTemplate } from '../src/core/serializer/Serializer'
import { saveTemplate, getTemplate } from '../src/utils/db'
import type { ImageConfig, QRConfig, BarcodeConfig, ChartConfig } from '../src/types'
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
    console.error(new Error(`Assertion failed: ${msg}`).stack)
  }
}

/** 测试1: CellType 类型扩展 */
function testCellTypeExtension() {
  console.log('\n[测试1] CellType 类型扩展')
  const cell = createCell(0, 0)
  cell.cellType = 'qrcode'
  assert(cell.cellType === 'qrcode', '应支持 qrcode 类型')
  cell.cellType = 'barcode'
  assert(cell.cellType === 'barcode', '应支持 barcode 类型')
  cell.cellType = 'image'
  assert(cell.cellType === 'image', '应支持 image 类型')
  cell.cellType = 'chart'
  assert(cell.cellType === 'chart', '应支持 chart 类型')
}

/** 测试2: 二维码配置写入与读取 */
function testQRConfig() {
  console.log('\n[测试2] 二维码配置写入与读取')
  const grid = new Grid(5, 5)
  const cell = grid.getCell(0, 0)!
  const qrConfig: QRConfig = {
    data: '${ds1.id}',
    errorCorrectLevel: 'H',
    size: 6,
    foreground: '#ff0000',
    background: '#ffffff',
    margin: 4
  }
  cell.cellType = 'qrcode'
  cell.qrConfig = qrConfig
  cell.content = qrConfig.data

  const read = grid.getCell(0, 0)!
  assert(read.cellType === 'qrcode', 'cellType 应为 qrcode')
  assert(read.qrConfig?.data === '${ds1.id}', '数据应保留表达式')
  assert(read.qrConfig?.errorCorrectLevel === 'H', '纠错等级应为 H')
  assert(read.qrConfig?.size === 6, '像素大小应为 6')
  assert(read.qrConfig?.foreground === '#ff0000', '前景色应为红色')
  assert(read.qrConfig?.margin === 4, '边距应为 4')
  assert(read.content === '${ds1.id}', 'content 应与 data 一致(用于运行时求值)')
}

/** 测试3: 条码配置写入与读取 */
function testBarcodeConfig() {
  console.log('\n[测试3] 条码配置写入与读取')
  const grid = new Grid(5, 5)
  const cell = grid.getCell(1, 1)!
  const barcodeConfig: BarcodeConfig = {
    data: '${param.sku}',
    format: 'CODE128',
    width: 240,
    height: 80,
    displayValue: true,
    foreground: '#000000',
    background: '#ffffff'
  }
  cell.cellType = 'barcode'
  cell.barcodeConfig = barcodeConfig
  cell.content = barcodeConfig.data

  const read = grid.getCell(1, 1)!
  assert(read.cellType === 'barcode', 'cellType 应为 barcode')
  assert(read.barcodeConfig?.format === 'CODE128', '格式应为 CODE128')
  assert(read.barcodeConfig?.data === '${param.sku}', '数据应保留参数表达式')
  assert(read.barcodeConfig?.width === 240, '宽度应为 240')
  assert(read.barcodeConfig?.height === 80, '高度应为 80')
  assert(read.barcodeConfig?.displayValue === true, '应显示文本')
}

/** 测试4: 图片配置 - URL 模式 */
function testImageConfigUrl() {
  console.log('\n[测试4] 图片配置 - URL 模式')
  const grid = new Grid(5, 5)
  const cell = grid.getCell(2, 2)!
  const imageConfig: ImageConfig = {
    source: 'url',
    url: 'https://example.com/${param.logo}.png',
    width: 200,
    height: 100,
    fit: 'contain'
  }
  cell.cellType = 'image'
  cell.imageConfig = imageConfig
  cell.content = imageConfig.url!

  const read = grid.getCell(2, 2)!
  assert(read.cellType === 'image', 'cellType 应为 image')
  assert(read.imageConfig?.source === 'url', '来源应为 url')
  assert(read.imageConfig?.url === 'https://example.com/${param.logo}.png', 'URL 应保留表达式')
  assert(read.imageConfig?.width === 200, '宽度应为 200')
  assert(read.imageConfig?.fit === 'contain', '缩放模式应为 contain')
  assert(read.content === imageConfig.url, 'content 应等于 URL(运行时求值为图片地址)')
}

/** 测试5: 图片配置 - base64 模式 */
function testImageConfigBase64() {
  console.log('\n[测试5] 图片配置 - base64 模式')
  const grid = new Grid(5, 5)
  const cell = grid.getCell(3, 3)!
  const imageConfig: ImageConfig = {
    source: 'base64',
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    mimeType: 'image/png',
    width: 0,
    height: 0,
    fit: 'cover'
  }
  cell.cellType = 'image'
  cell.imageConfig = imageConfig
  cell.content = '[image:base64]'

  const read = grid.getCell(3, 3)!
  assert(read.imageConfig?.source === 'base64', '来源应为 base64')
  assert(!!read.imageConfig?.base64, '应有 base64 数据')
  assert(read.imageConfig?.mimeType === 'image/png', 'MIME 应为 image/png')
  assert(read.imageConfig?.fit === 'cover', '缩放模式应为 cover')
}

/** 测试6: 图表配置写入与读取 */
function testChartConfig() {
  console.log('\n[测试6] 图表配置写入与读取')
  const grid = new Grid(5, 5)
  const cell = grid.getCell(4, 4)!
  const chartConfig: ChartConfig = {
    type: 'bar',
    dataset: 'ds1',
    categoryField: 'region',
    series: [
      { name: '销售额', valueField: 'amount', type: 'bar' },
      { name: '订单数', valueField: 'orders', type: 'bar', stack: 'total' }
    ],
    title: '区域销售统计',
    legend: true,
    width: 480,
    height: 320
  }
  cell.cellType = 'chart'
  cell.chartConfig = chartConfig
  cell.content = '[chart] 区域销售统计'

  const read = grid.getCell(4, 4)!
  assert(read.cellType === 'chart', 'cellType 应为 chart')
  assert(read.chartConfig?.type === 'bar', '图表类型应为 bar')
  assert(read.chartConfig?.dataset === 'ds1', '数据集应为 ds1')
  assert(read.chartConfig?.categoryField === 'region', '分类字段应为 region')
  assert(read.chartConfig?.series.length === 2, '应有 2 个系列')
  assert(read.chartConfig?.series[0].valueField === 'amount', '第1个系列字段应为 amount')
  assert(read.chartConfig?.series[1].stack === 'total', '第2个系列 stack 应为 total')
  assert(read.chartConfig?.title === '区域销售统计', '标题应匹配')
  assert(read.chartConfig?.legend === true, '应显示图例')
  assert(read.chartConfig?.width === 480, '宽度应为 480')
}

/** 测试7: setCellContent 不破坏特殊类型 */
function testSetCellContentPreservesSpecialType() {
  console.log('\n[测试7] setCellContent 不破坏特殊类型')
  const grid = new Grid(5, 5)
  const cell = grid.getCell(0, 0)!
  cell.cellType = 'qrcode'
  cell.qrConfig = { data: '${ds1.id}' }

  // 调用 setCellContent(模拟重新编辑内容)
  grid.setCellContent(0, 0, '${ds1.sku}')
  const read = grid.getCell(0, 0)!
  assert(read.cellType === 'qrcode', 'setCellContent 后 cellType 应保持 qrcode(不被覆盖为 text)')
  assert(read.content === '${ds1.sku}', 'content 应更新为新表达式')

  // 对普通文本单元格,setCellContent 仍应自动推断为 text/formula
  grid.setCellContent(1, 1, '普通文本')
  assert(grid.getCell(1, 1)!.cellType === 'text', '普通文本应自动识别为 text')
  grid.setCellContent(2, 2, '=sum(A1:A10)')
  assert(grid.getCell(2, 2)!.cellType === 'formula', '= 开头应自动识别为 formula')
}

/** 测试8: 序列化/反序列化保留所有配置 */
async function testSerializationRoundTrip() {
  console.log('\n[测试8] 序列化/反序列化保留所有配置')
  const tpl = createEmptyTemplate()
  tpl.name = '元素测试模板'

  const grid = new Grid(8, 8)
  // 配置4种特殊单元格
  const a1 = grid.getCell(0, 0)!
  a1.cellType = 'image'
  a1.imageConfig = { source: 'url', url: 'https://example.com/logo.png', width: 120, height: 60, fit: 'contain' }
  a1.content = a1.imageConfig.url!

  const b2 = grid.getCell(1, 1)!
  b2.cellType = 'qrcode'
  b2.qrConfig = { data: '${ds1.id}', errorCorrectLevel: 'M', size: 4, margin: 2 }
  b2.content = b2.qrConfig.data

  const c3 = grid.getCell(2, 2)!
  c3.cellType = 'barcode'
  c3.barcodeConfig = { data: '${param.sku}', format: 'EAN13', width: 200, height: 60, displayValue: true }
  c3.content = c3.barcodeConfig.data

  const d4 = grid.getCell(3, 3)!
  d4.cellType = 'chart'
  d4.chartConfig = {
    type: 'pie',
    dataset: 'ds1',
    categoryField: 'region',
    series: [{ name: '销售额', valueField: 'amount' }],
    title: '区域占比',
    legend: true
  }
  d4.content = '[chart] 区域占比'

  Object.assign(tpl, gridToTemplate(grid, tpl))

  await saveTemplate(tpl)
  const loaded = await getTemplate(tpl.id)
  if (!loaded) {
    assert(false, '应能读取保存的模板')
    return
  }

  const grid2 = gridFromTemplate(loaded)
  const la1 = grid2.getCell(0, 0)!
  assert(la1.cellType === 'image', '反序列化后 A1 应为 image')
  assert(la1.imageConfig?.url === 'https://example.com/logo.png', 'A1 URL 应保留')
  assert(la1.imageConfig?.fit === 'contain', 'A1 缩放模式应保留')

  const lb2 = grid2.getCell(1, 1)!
  assert(lb2.cellType === 'qrcode', '反序列化后 B2 应为 qrcode')
  assert(lb2.qrConfig?.data === '${ds1.id}', 'B2 数据表达式应保留')
  assert(lb2.qrConfig?.errorCorrectLevel === 'M', 'B2 纠错等级应保留')

  const lc3 = grid2.getCell(2, 2)!
  assert(lc3.cellType === 'barcode', '反序列化后 C3 应为 barcode')
  assert(lc3.barcodeConfig?.format === 'EAN13', 'C3 格式应为 EAN13')
  assert(lc3.barcodeConfig?.data === '${param.sku}', 'C3 数据应保留')

  const ld4 = grid2.getCell(3, 3)!
  assert(ld4.cellType === 'chart', '反序列化后 D4 应为 chart')
  assert(ld4.chartConfig?.type === 'pie', 'D4 图表类型应为 pie')
  assert(ld4.chartConfig?.series.length === 1, 'D4 应有 1 个系列')
  assert(ld4.chartConfig?.series[0].valueField === 'amount', 'D4 系列字段应为 amount')
}

/** 测试9: 清除特殊类型恢复为文本 */
function testClearSpecialType() {
  console.log('\n[测试9] 清除特殊类型恢复为文本')
  const grid = new Grid(5, 5)
  const cell = grid.getCell(0, 0)!
  cell.cellType = 'qrcode'
  cell.qrConfig = { data: '${ds1.id}' }
  cell.content = '${ds1.id}'

  // 模拟 PropertyPanel.clearSpecialType 行为
  cell.cellType = 'text'
  cell.qrConfig = undefined
  cell.barcodeConfig = undefined
  cell.imageConfig = undefined
  cell.chartConfig = undefined
  cell.content = ''

  const read = grid.getCell(0, 0)!
  assert(read.cellType === 'text', '应恢复为 text 类型')
  assert(read.qrConfig === undefined, 'qrConfig 应被清除')
  assert(read.content === '', 'content 应为空')
}

/** 测试10: 各种条码格式支持 */
function testBarcodeFormats() {
  console.log('\n[测试10] 各种条码格式支持')
  const formats: Array<{ format: BarcodeConfig['format']; validData: string }> = [
    { format: 'CODE128', validData: 'ABC123' },
    { format: 'CODE39', validData: 'ABC123' },
    { format: 'EAN13', validData: '6901234567892' },
    { format: 'EAN8', validData: '96385074' },
    { format: 'UPC', validData: '036000291452' },
    { format: 'ITF14', validData: '15412345678905' },
    { format: 'MSI', validData: '1234567' },
    { format: 'pharmacode', validData: '1234' },
    { format: 'codabar', validData: 'A40156B' }
  ]
  const grid = new Grid(formats.length, 1)
  for (let i = 0; i < formats.length; i++) {
    const cell = grid.getCell(i, 0)!
    cell.cellType = 'barcode'
    cell.barcodeConfig = {
      data: formats[i].validData,
      format: formats[i].format,
      displayValue: true
    }
    cell.content = formats[i].validData
  }

  for (let i = 0; i < formats.length; i++) {
    const read = grid.getCell(i, 0)!
    assert(
      read.barcodeConfig?.format === formats[i].format,
      `行 ${i} 应为 ${formats[i].format} 格式`
    )
  }
}

/** 测试11: 图表所有类型支持 */
function testChartTypes() {
  console.log('\n[测试11] 图表所有类型支持')
  const types: ChartConfig['type'][] = ['bar', 'line', 'pie', 'radar', 'scatter', 'area', 'funnel']
  const grid = new Grid(types.length, 1)
  for (let i = 0; i < types.length; i++) {
    const cell = grid.getCell(i, 0)!
    cell.cellType = 'chart'
    cell.chartConfig = {
      type: types[i],
      series: [{ name: '系列1', valueField: 'value' }]
    }
  }
  for (let i = 0; i < types.length; i++) {
    const read = grid.getCell(i, 0)!
    assert(read.chartConfig?.type === types[i], `行 ${i} 应为 ${types[i]} 图表`)
  }
}

// ===== 执行所有测试 =====
async function main() {
  console.log('=== VReport 新增元素(图片/二维码/条码/图表)功能测试 ===')

  testCellTypeExtension()
  testQRConfig()
  testBarcodeConfig()
  testImageConfigUrl()
  testImageConfigBase64()
  testChartConfig()
  testSetCellContentPreservesSpecialType()
  await testSerializationRoundTrip()
  testClearSpecialType()
  testBarcodeFormats()
  testChartTypes()

  console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`)
  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
