/**
 * 报表模板状态
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ReportTemplate } from '@/types'
import { createEmptyTemplate, gridFromTemplate, gridToTemplate } from '@/core/serializer/Serializer'
import { getTemplate, saveTemplate, deleteTemplate as dbDelete, listTemplates } from '@/utils/db'
import { Grid } from '@/core/cell/Grid'
import { uid } from '@/utils/id'
import { useHistoryStore } from './history'
import { ExpandEngine, type ExpandWarning } from '@/core/engine/ExpandEngine'
import { fetchData } from '@/core/datasource/ProviderRegistry'

export const useReportStore = defineStore('report', () => {
  /** 当前编辑的模板 */
  const currentTemplate = ref<ReportTemplate | null>(null)
  /** 当前模板对应的 Grid 实例 */
  const grid = ref<Grid | null>(null)
  /** 模板列表 */
  const templateList = ref<ReportTemplate[]>([])
  /** 是否有未保存修改 */
  const dirty = ref(false)

  /** 加载模板列表 */
  async function loadList() {
    templateList.value = await listTemplates()
  }

  /** 新建模板 */
  function newTemplate(name?: string) {
    const tpl = createEmptyTemplate(name)
    currentTemplate.value = tpl
    grid.value = gridFromTemplate(tpl)
    dirty.value = false
    useHistoryStore().clear()
  }

  /** 打开模板 */
  async function open(id: string) {
    const tpl = await getTemplate(id)
    if (tpl) {
      currentTemplate.value = tpl
      grid.value = gridFromTemplate(tpl)
      dirty.value = false
      useHistoryStore().clear()
    }
  }

  /** 保存当前模板 */
  async function save() {
    if (!currentTemplate.value || !grid.value) return
    gridToTemplate(grid.value, currentTemplate.value)
    await saveTemplate(currentTemplate.value)
    dirty.value = false
    await loadList()
  }

  /**
   * 保存前校验展开冲突/覆盖风险。
   * 返回 warningDetails，用于设计器展示与定位。
   */
  async function checkSaveConflicts(): Promise<ExpandWarning[]> {
    if (!currentTemplate.value || !grid.value) return []
    gridToTemplate(grid.value, currentTemplate.value)

    for (const ds of currentTemplate.value.dataSets) {
      const source = currentTemplate.value.dataSources.find((s) => s.id === ds.sourceId)
      if (source) {
        ds.cachedRows = await fetchData(source, ds)
      }
    }

    const engine = new ExpandEngine(
      grid.value.cells,
      grid.value.rows.map((r) => r.height),
      grid.value.columns.map((c) => c.width),
      currentTemplate.value.dataSets,
      {}
    )
    const result = engine.expand()
    const details = result.warningDetails ?? []
    if (details.length) return details
    return (result.warnings ?? []).map((message) => ({ message }))
  }

  /** 保存前校验并按结果决定是否执行保存 */
  async function saveWithConflictCheck() {
    const warnings = await checkSaveConflicts()
    if (warnings.length) {
      return { ok: false as const, warnings }
    }
    await save()
    return { ok: true as const, warnings: [] as ExpandWarning[] }
  }

  /** 删除模板 */
  async function remove(id: string) {
    await dbDelete(id)
    await loadList()
  }

  /** 重命名模板（列表中直接操作） */
  async function rename(id: string, name: string) {
    const tpl = await getTemplate(id)
    if (!tpl) return
    tpl.name = name
    await saveTemplate(tpl)
    await loadList()
  }

  /** 复制模板 */
  async function duplicate(id: string): Promise<string | null> {
    const tpl = await getTemplate(id)
    if (!tpl) return null
    const now = Date.now()
    const copy: ReportTemplate = {
      ...JSON.parse(JSON.stringify(tpl)),
      id: uid('tpl_'),
      name: tpl.name + ' - 副本',
      createdAt: now,
      updatedAt: now
    }
    await saveTemplate(copy)
    await loadList()
    return copy.id
  }

  /** 更新模板元信息（描述/标签） */
  async function updateMeta(id: string, meta: { name?: string; description?: string; tags?: string[] }) {
    const tpl = await getTemplate(id)
    if (!tpl) return
    if (meta.name !== undefined) tpl.name = meta.name
    if (meta.description !== undefined) tpl.description = meta.description
    if (meta.tags !== undefined) tpl.tags = meta.tags
    await saveTemplate(tpl)
    await loadList()
    // 若是当前模板，同步更新
    if (currentTemplate.value?.id === id) {
      currentTemplate.value.name = tpl.name
      currentTemplate.value.description = tpl.description
      currentTemplate.value.tags = tpl.tags
    }
  }

  /** 标记为已修改 */
  function markDirty() {
    dirty.value = true
  }

  return {
    currentTemplate,
    grid,
    templateList,
    dirty,
    loadList,
    newTemplate,
    open,
    save,
    checkSaveConflicts,
    saveWithConflictCheck,
    remove,
    rename,
    duplicate,
    updateMeta,
    markDirty
  }
})
