/**
 * 样式解析：将 CellStyle 转为 CSS 属性
 */
import type { CellStyle, BorderEdge } from '@/core/cell/types'

export function styleToCss(s: CellStyle): Record<string, string> {
  const css: Record<string, string> = {}
  if (s.fontFamily) css['font-family'] = s.fontFamily
  if (s.fontSize) css['font-size'] = s.fontSize + 'px'
  if (s.bold) css['font-weight'] = 'bold'
  if (s.italic) css['font-style'] = 'italic'
  if (s.underline) css['text-decoration'] = 'underline'
  if (s.color) css['color'] = s.color
  if (s.background) css['background-color'] = s.background
  if (s.hAlign) css['text-align'] = s.hAlign
  if (s.vAlign) css['vertical-align'] = s.vAlign
  css['white-space'] = s.wrap ? 'normal' : 'nowrap'
  css['overflow'] = 'hidden'
  if (s.paddingTop != null) css['padding-top'] = s.paddingTop + 'px'
  if (s.paddingRight != null) css['padding-right'] = s.paddingRight + 'px'
  if (s.paddingBottom != null) css['padding-bottom'] = s.paddingBottom + 'px'
  if (s.paddingLeft != null) css['padding-left'] = s.paddingLeft + 'px'
  const b = (e?: BorderEdge) =>
    e && e.style !== 'none' ? `${e.width}px ${e.style} ${e.color}` : ''
  if (s.borderTop && s.borderTop.style !== 'none') css['border-top'] = b(s.borderTop)
  if (s.borderRight && s.borderRight.style !== 'none') css['border-right'] = b(s.borderRight)
  if (s.borderBottom && s.borderBottom.style !== 'none') css['border-bottom'] = b(s.borderBottom)
  if (s.borderLeft && s.borderLeft.style !== 'none') css['border-left'] = b(s.borderLeft)
  return css
}

/** 合并样式（后者覆盖前者） */
export function mergeStyle(base: CellStyle, override: Partial<CellStyle>): CellStyle {
  return { ...base, ...override }
}
