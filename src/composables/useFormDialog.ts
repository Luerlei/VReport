/**
 * 表单弹窗通用骨架：统一“可见时重置表单 + 合并初始值 + 关闭”逻辑。
 * 各弹窗的字段定义、校验、预览仍由各自实现，这里只消除重复的样板代码。
 */
import { reactive, watch } from 'vue'

export interface FormDialogOptions<T extends object> {
  /** 响应式读取弹窗可见性，通常为 () => props.visible */
  isVisible: () => boolean
  /** 生成一份全新的默认表单值 */
  createDefaults: () => T
  /** 读取初始覆盖值，通常为 () => props.initial */
  getInitial?: () => Partial<T> | undefined
  /** 关闭弹窗，通常为 () => emit('update:visible', false) */
  onClose: () => void
  /** 弹窗打开后的副作用（如渲染预览），在表单重置后调用 */
  onOpen?: () => void
}

export interface FormDialogResult<T extends object> {
  /** 响应式表单对象，可直接用于 v-model */
  form: T
  /** 关闭弹窗 */
  close: () => void
}

export function useFormDialog<T extends object>(
  options: FormDialogOptions<T>
): FormDialogResult<T> {
  const form = reactive(options.createDefaults()) as T

  watch(
    options.isVisible,
    (visible) => {
      if (!visible) return
      Object.assign(form, options.createDefaults(), options.getInitial?.() ?? {})
      options.onOpen?.()
    },
    { immediate: true }
  )

  function close() {
    options.onClose()
  }

  return { form, close }
}
