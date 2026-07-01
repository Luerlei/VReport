/**
 * IndexedDB 封装（基于 Dexie）
 * 存储报表模板
 */
import Dexie, { type Table } from 'dexie'
import type { ReportTemplate } from '@/types'

class VReportDB extends Dexie {
  templates!: Table<ReportTemplate, string>

  constructor() {
    super('vreport')
    this.version(1).stores({
      templates: 'id, name, updatedAt'
    })
  }
}

export const db = new VReportDB()

/** 获取所有模板 */
export async function listTemplates(): Promise<ReportTemplate[]> {
  return db.templates.orderBy('updatedAt').reverse().toArray()
}

/** 获取单个模板 */
export async function getTemplate(id: string): Promise<ReportTemplate | undefined> {
  return db.templates.get(id)
}

/** 深拷贝并剥离 Vue/Pinia 的 Proxy，保留 Date/Map/Set 等结构 */
function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // 如包含 function/non-serializable 对象则回退自定义实现
    }
  }
  return customDeepClone(value)
}

/** 自定义深拷贝：支持基本对象、数组、Date、Map、Set，跳过函数 */
function customDeepClone<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value
  if (typeof value === 'function') return undefined as T

  if (value instanceof Date) return new Date(value.getTime()) as T
  if (value instanceof Map) {
    const copy = new Map()
    seen.set(value, copy)
    value.forEach((v, k) => copy.set(customDeepClone(k, seen), customDeepClone(v, seen)))
    return copy as T
  }
  if (value instanceof Set) {
    const copy = new Set()
    seen.set(value, copy)
    value.forEach((v) => copy.add(customDeepClone(v, seen)))
    return copy as T
  }

  // 处理数组或普通对象
  if (seen.has(value)) return seen.get(value) as T
  const copy: any = Array.isArray(value) ? [] : {}
  seen.set(value, copy)
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      copy[key] = customDeepClone((value as any)[key], seen)
    }
  }
  return copy as T
}

/** 保存（新增或更新）模板 */
export async function saveTemplate(template: ReportTemplate): Promise<void> {
  template.updatedAt = Date.now()
  // 深拷贝为纯对象:Pinia/Vue 的响应式 Proxy 无法被 IndexedDB structured clone
  // 优先使用 structuredClone，回退自定义深拷贝以保留 Date/Map/Set
  const plain = deepClone(template)
  await db.templates.put(plain)
}

/** 删除模板 */
export async function deleteTemplate(id: string): Promise<void> {
  await db.templates.delete(id)
}
