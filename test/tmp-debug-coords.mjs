import tpl from './test/fixtures/attachment-dynamic-template-v2.json'
import { gridFromTemplate } from './src/core/serializer/Serializer'
import { ExpandEngine } from './src/core/engine/ExpandEngine'
import { Aggregator } from './src/core/engine/Aggregator'

const t = JSON.parse(JSON.stringify(tpl))
t.dataSets.forEach((set) => {
  const source = t.dataSources.find((s) => s.id === set.sourceId)
  set.cachedRows = source?.config?.rawJson ? JSON.parse(source.config.rawJson) : []
})
const grid = gridFromTemplate(t)
const result = new ExpandEngine(
  grid.cells,
  grid.rows.map((r) => r.height),
  grid.columns.map((c) => c.width),
  t.dataSets
).expand()
new Aggregator(result.grid).evaluateAll()
const coords = [[7,0],[7,1],[7,2],[11,0],[11,1],[11,2],[8,0],[8,1],[8,2]]
for (const [r,c] of coords) {
  const cell = result.grid[r]?.[c]
  console.log(`${String.fromCharCode(65+c)}${r+1}`, 'src=', cell?.source?.name, 'content=', cell?.source?.content, 'val=', cell?.value)
}
console.log('warnings', result.warnings)
