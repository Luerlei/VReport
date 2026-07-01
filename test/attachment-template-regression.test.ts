import { describe, it, expect } from 'vitest'
import templateFixture from './fixtures/attachment-dynamic-template.json'
import templateFixtureV2 from './fixtures/attachment-dynamic-template-v2.json'
import { gridFromTemplate } from '@/core/serializer/Serializer'
import { ExpandEngine } from '@/core/engine/ExpandEngine'
import { Aggregator } from '@/core/engine/Aggregator'
import type { ReportTemplate } from '@/types'

function evaluateTemplate(template: ReportTemplate) {
  const tpl = JSON.parse(JSON.stringify(template)) as ReportTemplate

  tpl.dataSets.forEach((set) => {
    const source = tpl.dataSources.find((s) => s.id === set.sourceId)
    set.cachedRows = source?.config?.rawJson ? JSON.parse(source.config.rawJson) : []
  })

  const grid = gridFromTemplate(tpl)
  const result = new ExpandEngine(
    grid.cells,
    grid.rows.map((r) => r.height),
    grid.columns.map((c) => c.width),
    tpl.dataSets
  ).expand()

  new Aggregator(result.grid).evaluateAll()

  const getFirstValueByContent = (content: string): unknown => {
    for (const row of result.grid) {
      for (const cell of row) {
        if (cell && cell.source.content === content) {
          return cell.value
        }
      }
    }
    return undefined
  }

  return { result, getFirstValueByContent }
}

describe('user attachment template regression', () => {
  it('renders with stable formula results and structured warnings payload', () => {
    const { result, getFirstValueByContent } = evaluateTemplate(templateFixture as ReportTemplate)

    // 核心动态公式区:避免再次出现“展示结果漂移/空值”。
    expect(getFirstValueByContent('=sum(${calcData.qty})')).toBe(70)
    expect(getFirstValueByContent('=sum(${calcData.qty})*avg(${calcData.price})')).toBe(140)
    expect(getFirstValueByContent('=A24+B24')).toBe(12)
    expect(getFirstValueByContent('=C24*2')).toBe(24)
    expect(getFirstValueByContent('=sum(A24:C24)')).toBe(24)

    // 告警详情字段应稳定存在，供预览页点击定位。
    expect(Array.isArray(result.warningDetails)).toBe(true)
    if ((result.warningDetails?.length ?? 0) > 0) {
      expect(typeof result.warningDetails?.[0]?.message).toBe('string')
    }
  })

  it('does not produce overlap warnings for latest user attachment v2', () => {
    const { result, getFirstValueByContent } = evaluateTemplate(templateFixtureV2 as ReportTemplate)

    expect((result.warnings ?? []).every((w) => !w.includes('覆盖冲突'))).toBe(true)
    expect((result.warningDetails ?? []).every((w) => !w.message.includes('覆盖冲突'))).toBe(true)

    // v2 截图回归：B8/C8 不应出现游离右展开数据。
    expect(result.grid[7][1]?.value).toBe('')
    expect(result.grid[7][2]?.value).toBe('')
    // 被抑制的重复右展开根不应再输出变量值。
    expect(result.grid[11][0]?.value).toBe('')

    expect(getFirstValueByContent('=sum(${calcData.qty})')).toBe(70)
    expect(getFirstValueByContent('=sum(${calcData.qty})*avg(${calcData.price})')).toBe(140)
  })
})
