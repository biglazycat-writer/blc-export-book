import katex from 'katex'
import 'katex/contrib/mhchem'

export interface FormulaSelection {
  latex: string
  displayMode: boolean
  html: string
}

export function renderFormulaHtml(latex: string, displayMode = false): string {
  return katex.renderToString(latex.trim() || '\\square', {
    displayMode,
    throwOnError: false,
    strict: false,
    output: 'htmlAndMathml',
    macros: {
      '\\RR': '\\mathbb{R}',
      '\\NN': '\\mathbb{N}',
      '\\ZZ': '\\mathbb{Z}',
      '\\QQ': '\\mathbb{Q}',
      '\\CC': '\\mathbb{C}',
      '\\dd': '\\mathrm{d}',
    },
  })
}

export function renderFormulaMathml(latex: string, displayMode = false): string {
  return katex.renderToString(latex.trim() || '\\square', {
    displayMode,
    throwOnError: false,
    strict: false,
    output: 'mathml',
    macros: {
      '\\RR': '\\mathbb{R}',
      '\\NN': '\\mathbb{N}',
      '\\ZZ': '\\mathbb{Z}',
      '\\QQ': '\\mathbb{Q}',
      '\\CC': '\\mathbb{C}',
      '\\dd': '\\mathrm{d}',
    },
  })
}

export function validateFormula(latex: string): string | null {
  if (!latex.trim()) return '请输入公式内容'
  try {
    katex.renderToString(latex.trim(), {
      displayMode: true,
      throwOnError: true,
      strict: false,
      output: 'htmlAndMathml',
    })
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : '公式语法无法解析'
    return message.replace(/^KaTeX parse error:\s*/i, '').split('\n')[0]
  }
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char] || char)
}

export function formulaToSvgDataUrl(latex: string, color = '#202431', displayMode = true): string {
  const source = latex.trim() || '\\square'
  // A canvas image is an isolated SVG document and cannot inherit the host
  // page's KaTeX stylesheet or web fonts. MathML keeps the exported asset
  // self-contained, so formulas remain visible after scene persistence/export.
  const mathml = renderFormulaMathml(source, displayMode)
  const width = Math.max(220, Math.min(900, 80 + source.length * 15))
  const height = displayMode ? 112 : 76
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:10px;color:${escapeXml(color)};font-size:28px;background:transparent">${mathml}</div></foreignObject></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function formulaPlainText(latex: string): string {
  return latex.trim() || 'E = mc^2'
}
