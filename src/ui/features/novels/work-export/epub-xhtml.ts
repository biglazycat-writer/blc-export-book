import { collectJsonFigureNumbers, figureCaptionLabel } from '../../../lib/figure-caption'
import {
  calloutStyle,
  COLLAPSIBLE_DEFAULT_SUMMARY,
} from '../../../lib/rich-blocks'

export type XhtmlJsonNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: XhtmlJsonNode[]
  marks?: { type?: string; attrs?: Record<string, unknown> }[]
}

export interface XhtmlRenderOptions {
  /** 章标题固定 h1，章内标题顺延一级。 */
  headingOffset: number
  /** 原图 src → 包内路径；返回 null 表示素材缺失。 */
  imageSrc: (src: string) => string | null
  /** Mermaid 源码 → 包内位图路径；返回 null 时保留代码块。 */
  mermaidSrc?: (source: string) => string | null
  /** JSON 图片节点 → 全文图号。 */
  figureNumbers?: Map<XhtmlJsonNode, number>
  /** 返回 MathML；失败返回 null，调用方退回 LaTeX 原文。 */
  formula?: (latex: string, display: boolean) => string | null
}

const INVALID_XML_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g

export function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(INVALID_XML_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function safeLinkHref(value: unknown): string | null {
  const href = String(value ?? '').trim()
  if (!href || /[\u0000-\u0020]/.test(href)) return null
  if (href.startsWith('#')) return href
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href
  return null
}

function textOf(node: XhtmlJsonNode | null | undefined): string {
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  return (node.content || []).map(textOf).join('')
}

function applyMarks(html: string, marks: XhtmlJsonNode['marks']): string {
  if (!html) return ''
  const names = (marks || []).map((mark) => mark?.type || '')
  if (names.includes('code')) html = `<code>${html}</code>`
  const safeColor = (value: unknown) => typeof value === 'string' && /^(?:#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\))$/i.test(value) ? value : ''
  const highlight = (marks || []).find(mark => mark.type === 'highlight')
  if (highlight) {
    const color = safeColor(highlight.attrs?.color)
    html = `<mark${color ? ` style="background-color:${escapeXml(color)}"` : ''}>${html}</mark>`
  }
  const style = (marks || []).find(mark => mark.type === 'textStyle')?.attrs
  if (style) {
    const css: string[] = []
    const color = safeColor(style.color)
    if (color) css.push(`color:${color}`)
    if (typeof style.fontSize === 'string' && /^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/.test(style.fontSize)) css.push(`font-size:${style.fontSize}`)
    if (typeof style.fontFamily === 'string' && /^[\p{L}\p{N}\s,"'_-]+$/u.test(style.fontFamily)) css.push(`font-family:${style.fontFamily}`)
    if (css.length) html = `<span style="${escapeXml(css.join(';'))}">${html}</span>`
  }
  if (names.includes('underline')) html = `<u>${html}</u>`
  if (names.includes('strike')) html = `<s>${html}</s>`
  if (names.includes('italic')) html = `<em>${html}</em>`
  if (names.includes('bold')) html = `<strong>${html}</strong>`
  if (names.includes('superscript')) html = `<sup>${html}</sup>`
  if (names.includes('subscript')) html = `<sub>${html}</sub>`

  const link = (marks || []).find((mark) => mark?.type === 'link')
  if (link) {
    const href = safeLinkHref(link.attrs?.href)
    if (href) html = `<a href="${escapeXml(href)}">${html}</a>`
  }
  return html
}

/**
 * Some readers lay an emoji out with a narrower advance than the glyph they
 * paint, so the icon lands on the next character. Each emoji gets its own
 * fixed-width inline box: CSS decides the advance, not the reader's font
 * metrics. Text symbols such as © or ↔ stay plain text.
 */
const EMOJI_SEQUENCE = new RegExp(
  [
    '[\\u{1F1E6}-\\u{1F1FF}]{2}',
    '[0-9#*]\\uFE0F?\\u20E3',
    '(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F)(?:\\p{Emoji_Modifier})?(?:\\u200D(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F)(?:\\p{Emoji_Modifier})?)*',
  ].join('|'),
  'gu',
)

function renderText(node: XhtmlJsonNode): string {
  const text = node.text || ''
  if (!text) return ''
  let html = ''
  let cursor = 0
  for (const match of text.matchAll(EMOJI_SEQUENCE)) {
    const index = match.index ?? 0
    if (index > cursor) html += escapeXml(text.slice(cursor, index))
    html += `<span class="emoji">${escapeXml(match[0])}</span>`
    cursor = index + match[0].length
  }
  if (cursor < text.length) html += escapeXml(text.slice(cursor))
  return applyMarks(html, node.marks)
}

function textAlignStyle(node: XhtmlJsonNode): string {
  const align = node.attrs?.textAlign
  if (align === 'center' || align === 'right' || align === 'justify') {
    return ` style="text-align:${align}"`
  }
  return ''
}

function paragraphStyle(node: XhtmlJsonNode): string {
  const parts: string[] = []
  const align = node.attrs?.textAlign
  if (align === 'center' || align === 'right' || align === 'justify') parts.push(`text-align:${align}`)
  const rawIndent = Number(node.attrs?.indent)
  if (Number.isFinite(rawIndent) && rawIndent > 0) {
    parts.push(`text-indent:${Math.min(10, Math.round(rawIndent))}em`)
  }
  return parts.length > 0 ? ` style="${parts.join(';')}"` : ''
}

function formulaMarkup(node: XhtmlJsonNode, options: XhtmlRenderOptions): string {
  const latex = String(node.attrs?.latex || '')
  const display = Boolean(node.attrs?.displayMode)
  if (!latex) return ''
  const mathml = options.formula?.(latex, display)
  if (mathml) {
    return `<span class="formula${display ? ' formula-block' : ''}">${mathml}</span>`
  }
  const source = display ? `$$${latex}$$` : `$${latex}$`
  return `<code class="formula-fallback">${escapeXml(source)}</code>`
}

function renderInline(node: XhtmlJsonNode, options: XhtmlRenderOptions): string {
  if (!node) return ''
  if (node.type === 'text') return renderText(node)
  if (node.type === 'hardBreak') return '<br/>'
  if (node.type === 'formula') return formulaMarkup(node, options)
  return (node.content || []).map((child) => renderInline(child, options)).join('')
}

function renderImage(node: XhtmlJsonNode, options: XhtmlRenderOptions): string {
  const src = typeof node.attrs?.src === 'string' ? node.attrs.src : ''
  const alt = String(node.attrs?.alt || '图片')
  const href = src ? options.imageSrc(src) : null
  if (!href) {
    return `<p class="missing-image">[图片缺失：${escapeXml(alt)}]</p>`
  }
  const caption = figureCaptionLabel(
    node.attrs?.caption,
    options.figureNumbers?.get(node) ?? null,
  )
  const image = `<img src="${escapeXml(href)}" alt="${escapeXml(alt)}"/>`
  if (caption) {
    return `<figure class="figure">${image}<figcaption>${escapeXml(caption)}</figcaption></figure>`
  }
  return `<figure class="figure">${image}</figure>`
}

function renderList(node: XhtmlJsonNode, options: XhtmlRenderOptions, ordered: boolean): string {
  const tag = ordered ? 'ol' : 'ul'
  const start = ordered ? Number(node.attrs?.start) : 0
  const startAttr = Number.isFinite(start) && start > 1 ? ` start="${Math.round(start)}"` : ''
  const items = (node.content || [])
    .map((item) => {
      const checked = item.attrs?.checked
      const task = typeof checked === 'boolean' ? `<span class="task-checkbox">${checked ? '☑' : '☐'}</span> ` : ''
      return `<li>${task}${(item.content || []).map((child) => renderBlock(child, options)).join('')}</li>`
    })
    .join('')
  return `<${tag}${startAttr}>${items}</${tag}>`
}

function renderTable(node: XhtmlJsonNode, options: XhtmlRenderOptions): string {
  const rows = node.content || []
  const headerCount = rows.findIndex((row) =>
    (row.content || []).every((cell) => cell.type !== 'tableHeader'),
  )
  const headRows = headerCount === -1 ? rows : rows.slice(0, headerCount)
  const bodyRows = headerCount === -1 ? [] : rows.slice(headerCount)
  const renderRow = (row: XhtmlJsonNode) =>
    `<tr>${(row.content || [])
      .map((cell) => {
        const header = cell.type === 'tableHeader'
        const tag = header ? 'th' : 'td'
        const attrs: string[] = []
        const colspan = Number(cell.attrs?.colspan)
        const rowspan = Number(cell.attrs?.rowspan)
        if (Number.isFinite(colspan) && colspan > 1) attrs.push(` colspan="${Math.round(colspan)}"`)
        if (Number.isFinite(rowspan) && rowspan > 1) attrs.push(` rowspan="${Math.round(rowspan)}"`)
        const background = String(cell.attrs?.backgroundColor || '')
        const styles: string[] = []
        if (/^#[0-9a-f]{3,8}$/i.test(background)) styles.push(`background-color:${background}`)
        if (cell.attrs?.verticalAlign === 'middle') styles.push('vertical-align:middle')
        if (cell.attrs?.verticalAlign === 'bottom') styles.push('vertical-align:bottom')
        if (styles.length > 0) attrs.push(` style="${styles.join(';')}"`)
        const body = (cell.content || []).map((child) => renderBlock(child, options)).join('')
        return `<${tag}${attrs.join('')}>${body || '<p></p>'}</${tag}>`
      })
      .join('')}</tr>`
  const thead = headRows.length > 0 ? `<thead>${headRows.map(renderRow).join('')}</thead>` : ''
  const tbody = bodyRows.length > 0 ? `<tbody>${bodyRows.map(renderRow).join('')}</tbody>` : ''
  return `<table>${thead}${tbody}</table>`
}

function renderBlock(node: XhtmlJsonNode, options: XhtmlRenderOptions): string {
  if (!node) return ''
  switch (node.type) {
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level || 1) + options.headingOffset))
      return `<h${level}${textAlignStyle(node)}>${renderInline(node, options)}</h${level}>`
    }
    case 'paragraph':
      return `<p${paragraphStyle(node)}>${renderInline(node, options)}</p>`
    case 'horizontalRule':
      return '<hr/>'
    case 'hardBreak':
      return '<br/>'
    case 'blockquote':
      return `<blockquote>${(node.content || []).map((child) => renderBlock(child, options)).join('')}</blockquote>`
    case 'bulletList':
      return renderList(node, options, false)
    case 'orderedList':
      return renderList(node, options, true)
    case 'taskList':
      return renderList(node, options, false)
    case 'listItem':
    case 'taskItem':
      return `<li>${(node.content || []).map((child) => renderBlock(child, options)).join('')}</li>`
    case 'codeBlock': {
      const source = textOf(node)
      if (String(node.attrs?.language || '').toLowerCase() === 'mermaid') {
        const image = options.mermaidSrc?.(source.trim())
        if (image) {
          return `<figure class="figure mermaid"><img src="${escapeXml(image)}" alt="Mermaid 图表"/></figure>`
        }
      }
      const language = String(node.attrs?.language || '').toLowerCase().replace(/[^a-z0-9_+-]/g, '')
      const className = language ? ` class="language-${language}"` : ''
      return `<pre class="code-block"><code${className}>${escapeXml(source)}</code></pre>`
    }
    case 'table':
      return renderTable(node, options)
    case 'image':
    case 'resizableImage':
      return renderImage(node, options)
    case 'mediaRow':
      // Legacy mediaRow: flatten cell children as sibling blocks.
      return (node.content || [])
        .flatMap((cell) =>
          (cell.content || []).map((child) =>
            child.type === 'image' || child.type === 'resizableImage'
              ? renderImage(child, options)
              : renderBlock(child, options),
          ),
        )
        .filter(Boolean)
        .join('')
    case 'pageBreak':
      return '<div class="page-break"></div>'
    case 'callout': {
      const style = calloutStyle(node.attrs?.kind)
      return `<aside class="callout callout-${style.kind}"><p class="callout-label">${escapeXml(style.label)}</p>${(node.content || [])
        .map((child) => renderBlock(child, options))
        .join('')}</aside>`
    }
    case 'collapsible': {
      const children = node.content || []
      const summary = children[0]?.type === 'collapsibleSummary' ? textOf(children[0]).trim() : ''
      const body = children
        .filter((child) => child.type !== 'collapsibleSummary')
        .map((child) => renderBlock(child, options))
        .join('')
      return `<section class="note"><p class="note-title">${escapeXml(summary || COLLAPSIBLE_DEFAULT_SUMMARY)}</p>${body}</section>`
    }
    case 'formula':
      return formulaMarkup(node, options)
    case 'flowCanvas':
      return `<div class="embed-placeholder">[流程画布] ${escapeXml(node.attrs?.title || '未命名画布')}</div>`
    case 'mindMapEmbed':
      return `<div class="embed-placeholder">[思维导图] ${escapeXml(node.attrs?.title || '未命名思维导图')}</div>`
    case 'tocBlock':
      return ''
    case 'text':
      return renderInline(node, options)
    default:
      return (node.content || []).map((child) => renderBlock(child, options)).join('')
  }
}

export function renderDocXhtml(
  doc: XhtmlJsonNode | null | undefined,
  options: XhtmlRenderOptions,
): string {
  if (!doc) return ''
  return (doc.content || []).map((child) => renderBlock(child, options)).join('\n')
}

/** 给合集用：把各章正文合并起来派图号，保证跨章连续。 */
export function collectBookFigureNumbers(book: {
  chapters: { doc: Record<string, unknown> }[]
}): Map<XhtmlJsonNode, number> {
  const content = book.chapters.flatMap((chapter) =>
    Array.isArray(chapter.doc.content) ? (chapter.doc.content as XhtmlJsonNode[]) : [],
  )
  return collectJsonFigureNumbers({ type: 'doc', content }) as Map<XhtmlJsonNode, number>
}

export interface XhtmlPageOptions {
  title: string
  lang: string
  body: string
  bodyClass?: string
  stylesheet?: string
}

export function xhtmlPage({ title, lang, body, bodyClass, stylesheet = 'style.css' }: XhtmlPageOptions): string {
  const bodyAttr = bodyClass ? ` class="${escapeXml(bodyClass)}"` : ''
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<!DOCTYPE html>',
    `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(lang)}" lang="${escapeXml(lang)}">`,
    '<head>',
    '<meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
    `<title>${escapeXml(title)}</title>`,
    `<link rel="stylesheet" type="text/css" href="${escapeXml(stylesheet)}"/>`,
    '</head>',
    `<body${bodyAttr}>`,
    body,
    '</body>',
    '</html>',
  ].join('\n')
}
