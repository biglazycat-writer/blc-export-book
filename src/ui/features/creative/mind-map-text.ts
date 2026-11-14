const BLOCK_ELEMENTS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'FIGCAPTION', 'FOOTER',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'LI', 'MAIN', 'NAV', 'P',
  'SECTION', 'TD', 'TH', 'TR',
])

/** Convert SimpleMindMap rich-text HTML into the plain label used by the editor. */
export function normalizeMindMapText(value: unknown, fallback = '未命名想法'): string {
  const raw = typeof value === 'string' ? value : value == null ? '' : String(value)
  if (!raw.trim()) return fallback
  if (typeof DOMParser === 'undefined') return raw.trim()

  const documentNode = new DOMParser().parseFromString(raw, 'text/html')
  const output: string[] = []
  const walk = (node: globalThis.Node) => {
    if (node.nodeType === globalThis.Node.TEXT_NODE) {
      output.push(node.textContent || '')
      return
    }
    if (!(node instanceof Element)) return
    if (node.tagName === 'BR') {
      output.push('\n')
      return
    }
    Array.from(node.childNodes).forEach(walk)
    if (BLOCK_ELEMENTS.has(node.tagName)) output.push('\n')
  }
  Array.from(documentNode.body.childNodes).forEach(walk)
  const text = output
    .join('')
    .replace(/[\u200b\ufeff]/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
  return text || fallback
}
