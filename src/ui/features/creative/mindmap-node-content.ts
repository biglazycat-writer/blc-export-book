import { renderFormulaHtml } from '../inserts/formula-utils'
import 'katex/dist/katex.min.css'
import { iconDefinition, renderIconSvg } from '../inserts/icon-catalog'

type ContentNode = { getData: (key: string) => unknown; getStyle: (key: string) => unknown }

/** Extra node content participates in simple-mind-map's layout and SVG export. */
export function mindMapNodeIcon(node: ContentNode) {
  const definition = iconDefinition(String(node.getData('lingbiIcon') || ''))
  if (!definition) return null
  const size = Math.max(16, Number(node.getStyle('fontSize')) || 16)
  const el = document.createElement('span')
  el.innerHTML = renderIconSvg(definition, String(node.getData('iconColor') || node.getStyle('color') || '#356AE6'), { size })
  return { el, width: size, height: size }
}

export function mindMapNodeFormula(node: ContentNode) {
  const latex = node.getData('formulaLatex')
  if (typeof latex !== 'string' || !latex.trim()) return null
  const el = document.createElement('div')
  el.className = 'mindMapNodeFormula'
  el.style.cssText = 'display:inline-block;white-space:nowrap;padding:4px;line-height:normal;'
  el.style.fontSize = `${Number(node.getStyle('fontSize')) || 16}px`
  el.style.color = String(node.getStyle('color') || '#202431')
  el.innerHTML = renderFormulaHtml(latex)
  // Measure the unscaled formula before giving its box to the SVG layout.
  const measure = document.createElement('div')
  measure.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;width:max-content;'
  measure.append(el)
  document.body.append(measure)
  try {
    const rect = el.getBoundingClientRect()
    return { el, width: Math.ceil(rect.width), height: Math.ceil(rect.height) }
  } finally {
    el.remove()
    measure.remove()
  }
}
