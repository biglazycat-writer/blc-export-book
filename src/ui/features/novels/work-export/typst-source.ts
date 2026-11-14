import { collectJsonFigureNumbers, figureCaptionLabel } from '../../../lib/figure-caption'
import { calloutStyle, COLLAPSIBLE_DEFAULT_SUMMARY } from '../../../lib/rich-blocks'
import type {
  BookChapter,
  BookMetadata,
  BookVolume,
  PageBandSettings,
  PageFooterSettings,
  PageRuleStyle,
  PdfExportSettings,
  WorkBookModel,
} from './types'
import { bandSlotTemplates, parseBandTemplate } from './page-band'
import { paperSizeMm, pdfBodyFontName } from './presets'
import { COVER_PALETTES, type CoverPalette } from './cover'
import { throwIfAborted } from './progress'
import { nt } from '../nt'

export type TypstJsonNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: TypstJsonNode[]
  marks?: { type?: string; attrs?: Record<string, unknown> }[]
}

export interface TypstAssetRef {
  /** Compiler shadow path, e.g. `/assets/img-001.png`. */
  path: string
  width: number
  height: number
}

export interface TypstRenderOptions {
  headingOffset: number
  contentWidthPt: number
  tableSizePt: number
  /** Original src → embedded picture. Returns null for missing pictures. */
  imageSrc: (src: string) => TypstAssetRef | null
  mermaidSrc: (source: string) => TypstAssetRef | null
  formulaSrc: (latex: string, display: boolean) => TypstAssetRef | null
  figureNumbers: Map<TypstJsonNode, number>
}

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g
const PX_TO_PT = 72 / 96
const PT_PER_MM = 72 / 25.4

/** Escape user text as a complete Typst string literal. Never emit raw markup. */
export function typstString(value: unknown): string {
  const escaped = String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS, '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
  return `"${escaped}"`
}

const BREAK_CHAR = /[/\\._~:?#@!$&*+=,;|%-]/
const LONG_TOKEN = /[A-Za-z0-9](?:[A-Za-z0-9/\\._~:?#@!$&*+=,;|%-]){11,}/g

/**
 * A long identifier has no line-break opportunity, so Typst paints it past the
 * table cell and past the page, and a justified line that cannot fit it is
 * stretched until the characters sit far apart. `#sym.zws` is not a break
 * this Typst honours. A soft hyphen between the pieces is, once hyphenation
 * is on, and it only draws a hyphen where the line actually breaks.
 * A plain number such as an ISBN is left whole.
 */
function text(value: unknown): string {
  const raw = String(value ?? '')
  let out = ''
  let cursor = 0
  let broke = false
  for (const match of raw.matchAll(LONG_TOKEN)) {
    const token = match[0]
    const index = match.index ?? 0
    if (!BREAK_CHAR.test(token) && token.length < 24) continue
    if (index > cursor) out += textPiece(raw.slice(cursor, index))
    out += breakableToken(token)
    cursor = index + token.length
    broke = true
  }
  if (!broke) return textPiece(raw)
  if (cursor < raw.length) out += textPiece(raw.slice(cursor))
  return out
}

function textPiece(value: string): string {
  return value ? `#text(${typstString(value)})` : ''
}

function breakableToken(token: string): string {
  const parts: string[] = []
  let buf = ''
  const flush = () => {
    if (!buf) return
    if (buf.length > 8) {
      for (let index = 0; index < buf.length; index += 8) parts.push(buf.slice(index, index + 8))
    } else {
      parts.push(buf)
    }
    buf = ''
  }
  for (const char of token) {
    buf += char
    if (BREAK_CHAR.test(char)) flush()
  }
  flush()
  return parts.filter(Boolean).map((part) => textPiece(part)).join('#text("\\u{ad}")')
}

function textOf(node: TypstJsonNode | null | undefined): string {
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  return (node.content || []).map(textOf).join('')
}

function safeLinkHref(value: unknown): string | null {
  const href = String(value ?? '').trim()
  if (!href || /[\u0000-\u0020]/.test(href)) return null
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href
  return null
}

function renderText(node: TypstJsonNode): string {
  const raw = typeof node.text === 'string' ? node.text : ''
  if (!raw) return ''
  const names = (node.marks || []).map((mark) => mark?.type || '')
  let source: string
  if (names.includes('code')) {
    // Inline code is one unbreakable box. Keep the monospace pieces, and put
    // the soft hyphen outside them so a long URL can still wrap in a cell.
    source = text(raw).replace(/#text\("((?:\\.|[^"\\])*)"\)/g, (full, inner: string) =>
      inner === '\\u{ad}' ? full : `#raw("${inner}")`)
  } else {
    source = raw
      .split('\n')
      .map((line, index) => `${index > 0 ? '#linebreak()' : ''}${text(line)}`)
      .join('')
  }
  if (names.includes('highlight')) source = `#highlight[${source}]`
  if (names.includes('underline')) source = `#underline[${source}]`
  if (names.includes('strike')) source = `#strike[${source}]`
  if (names.includes('italic')) source = `#emph[${source}]`
  if (names.includes('bold')) source = `#strong[${source}]`
  if (names.includes('superscript')) source = `#super[${source}]`
  if (names.includes('subscript')) source = `#sub[${source}]`

  const link = (node.marks || []).find((mark) => mark?.type === 'link')
  if (link) {
    const href = safeLinkHref(link.attrs?.href)
    if (href) source = `#link(${typstString(href)})[${source}]`
  }
  return source
}

function imageWidth(ref: TypstAssetRef, contentWidthPt: number): string {
  const width = ref.width > 0 ? ref.width * PX_TO_PT : contentWidthPt
  if (width >= contentWidthPt || width <= 0) return '100%'
  return `${Math.round(width)}pt`
}

function imageCall(ref: TypstAssetRef, width: string): string {
  return `#image(${typstString(ref.path)}, width: ${width}, alt: "图片")`
}

function missingImage(alt: string): string {
  return `#block(width: 100%, fill: luma(242), inset: 10pt, radius: 2pt)[#align(center)[#text(fill: luma(110))[#text(${typstString(`[图片缺失：${alt || '图片'}]`)})]]]`
}

function renderFormula(node: TypstJsonNode, options: TypstRenderOptions): string {
  const latex = String(node.attrs?.latex || '')
  if (!latex) return ''
  const display = Boolean(node.attrs?.displayMode)
  const ref = options.formulaSrc(latex, display)
  if (ref) {
    if (display) {
      return `#block(above: 0.7em, below: 0.7em, width: 100%)[#align(center)[${imageCall(ref, imageWidth(ref, options.contentWidthPt))}]]`
    }
    return `#image(${typstString(ref.path)}, height: 1.15em, alt: "公式")`
  }
  const fallback = display ? `$$${latex}$$` : `$${latex}$`
  if (display) {
    return `#block(width: 100%)[#set par(first-line-indent: 0em)\n#raw(${typstString(fallback)}, block: true)]`
  }
  return `#raw(${typstString(fallback)})`
}

function renderInline(node: TypstJsonNode, options: TypstRenderOptions): string {
  if (!node) return ''
  if (node.type === 'text') return renderText(node)
  if (node.type === 'hardBreak') return '#linebreak()'
  if (node.type === 'formula') return renderFormula(node, options)
  return (node.content || []).map((child) => renderInline(child, options)).join('')
}

function renderImage(node: TypstJsonNode, options: TypstRenderOptions): string {
  const src = typeof node.attrs?.src === 'string' ? node.attrs.src : ''
  const alt = String(node.attrs?.alt || '图片')
  const ref = src ? options.imageSrc(src) : null
  if (!ref) return missingImage(alt)
  const caption = figureCaptionLabel(node.attrs?.caption, options.figureNumbers.get(node) ?? null)
  const image = imageCall(ref, imageWidth(ref, options.contentWidthPt))
  if (caption) {
    // figure(...) arguments are code mode: drop the leading # from the image call.
    return `#figure(${image.slice(1)}, caption: [${text(caption)}], numbering: none)`
  }
  return `#block(above: 0.8em, below: 0.8em, width: 100%)[#align(center)[${image}]]`
}

function renderList(node: TypstJsonNode, options: TypstRenderOptions, ordered: boolean): string {
  const items = node.content || []
  const calls = items.map((item) => {
    const checked = item.attrs?.checked
    // A plain space after a drawn box collapses; the gap has to be explicit.
    const task = typeof checked === 'boolean' ? `${taskMarker(checked)}#h(0.35em)` : ''
    const body = (item.content || [])
      .map((child) => renderBlock(child, options))
      .join('\n\n')
    // A list item is not an indented paragraph, so the document's first-line
    // indent is cancelled inside the item. Cancelling it here rather than
    // around the list keeps the list → item → list chain intact, which is what
    // Typst counts nesting depth from: wrapped in a block, a sub-list prints at
    // its parent's indent and reuses the parent's marker.
    return `[#set par(first-line-indent: 0em)\n${task}${body || text('')}]`
  })
  const start = Number(node.attrs?.start)
  const head = ordered
    ? `#enum(${Number.isFinite(start) && start > 1 ? `start: ${Math.round(start)}, ` : ''}${calls.join(', ')})`
    : `#list(${calls.join(', ')})`
  // A checklist carries its own box, so the bullet is suppressed and the body
  // sits at the margin instead of at a marker indent.
  if (node.type === 'taskList') {
    return `#[#set list(indent: 0.2em, body-indent: 0.2em, spacing: 0.3em, marker: none)\n${head}]`
  }
  return head
}

function cellSource(cell: TypstJsonNode, options: TypstRenderOptions, header: boolean): string {
  const body = (cell.content || []).map((child) => renderBlock(child, options)).join('\n\n')
  const content = body || text('')
  const wrapped = header ? `#strong[${content}]` : content
  const params: string[] = []
  // A faint header band separates the head from the body without a heavy rule.
  if (header) params.push('fill: luma(247)')
  const colspan = Number(cell.attrs?.colspan)
  const rowspan = Number(cell.attrs?.rowspan)
  if (Number.isFinite(colspan) && colspan > 1) params.push(`colspan: ${Math.round(colspan)}`)
  if (Number.isFinite(rowspan) && rowspan > 1) params.push(`rowspan: ${Math.round(rowspan)}`)
  if (params.length > 0) return `table.cell(${params.join(', ')})[${wrapped}]`
  return `[${wrapped}]`
}

function renderTable(node: TypstJsonNode, options: TypstRenderOptions): string {
  const rows = node.content || []
  if (rows.length === 0) return ''
  const headerCount = rows.findIndex((row) =>
    (row.content || []).every((cell) => cell.type !== 'tableHeader'),
  )
  const headRows = headerCount === -1 ? rows : rows.slice(0, headerCount)
  const bodyRows = headerCount === -1 ? [] : rows.slice(headerCount)
  let columns = 1
  for (const row of rows) {
    const width = (row.content || []).reduce(
      (sum, cell) => sum + Math.max(1, Number(cell.attrs?.colspan) || 1),
      0,
    )
    columns = Math.max(columns, width)
  }
  const renderRow = (row: TypstJsonNode, header: boolean) =>
    (row.content || []).map((cell) => cellSource(cell, options, header)).join(', ')
  const parts: string[] = []
  if (headRows.length > 0) {
    parts.push(`table.header(${headRows.map((row) => renderRow(row, true)).join(', ')})`)
  }
  for (const row of bodyRows) parts.push(renderRow(row, false))
  // Equal columns that fill the measure: a content-sized table is centred by
  // Typst and leaves an uneven gap at the right edge of the page.
  const columnSpec = Array.from({ length: columns }, () => '1fr').join(', ')
  return `#block(width: 100%, above: 0.9em, below: 0.9em)[#set par(first-line-indent: 0em, spacing: 0.35em, justify: false)\n#set text(size: ${options.tableSizePt}pt, hyphenate: true)\n#align(left)[#table(columns: (${columnSpec}), stroke: 0.5pt + luma(200), inset: (x: 7pt, y: 5.5pt), ${parts.join(', ')})]]`
}

function renderBlock(node: TypstJsonNode, options: TypstRenderOptions): string {
  if (!node) return ''
  switch (node.type) {
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level || 1) + options.headingOffset))
      const body = renderInline(node, options)
      const align = node.attrs?.textAlign
      const content =
        align === 'center' || align === 'right'
          ? `#align(${align})[${body || text('')}]`
          : body || text('')
      return `#heading(level: ${level}, outlined: true)[${content}]`
    }
    case 'paragraph': {
      const body = renderInline(node, options) || text('')
      const align = node.attrs?.textAlign
      const indent = Number(node.attrs?.indent)
      const rules: string[] = []
      if (align === 'center' || align === 'right') {
        rules.push('#set par(first-line-indent: 0em)')
      } else if (align === 'left') {
        rules.push('#set par(justify: false)')
      } else if (align === 'justify') {
        rules.push('#set par(justify: true)')
      }
      if (Number.isFinite(indent) && indent > 0) {
        rules.push(`#set par(first-line-indent: ${Math.min(10, Math.round(indent))}em)`)
      }
      let source = body
      if (rules.length > 0) {
        source = `#block(width: 100%)[${rules.join('\n')}\n${body}]`
      }
      if (align === 'center' || align === 'right') source = `#align(${align})[${source}]`
      return source
    }
    case 'horizontalRule':
      return '#line(length: 100%, stroke: 0.5pt + luma(180))'
    case 'hardBreak':
      return '#linebreak()'
    case 'blockquote': {
      const body = (node.content || []).map((child) => renderBlock(child, options)).join('\n\n')
      return `#block(width: 100%, inset: (left: 12pt), stroke: (left: 2pt + luma(180)), above: 0.8em, below: 0.8em)[#set par(first-line-indent: 0em, spacing: 0.55em)\n${body}]`
    }
    case 'bulletList':
      return renderList(node, options, false)
    case 'orderedList':
      return renderList(node, options, true)
    case 'taskList':
      return renderList(node, options, false)
    case 'listItem':
    case 'taskItem':
      return (node.content || []).map((child) => renderBlock(child, options)).join('\n\n')
    case 'codeBlock': {
      const source = textOf(node)
      if (String(node.attrs?.language || '').toLowerCase() === 'mermaid') {
        const ref = options.mermaidSrc(source.trim())
        if (ref) {
          return `#block(above: 0.8em, below: 0.8em, width: 100%)[#align(center)[${imageCall(ref, imageWidth(ref, options.contentWidthPt))}]]`
        }
      }
      const language = String(node.attrs?.language || '').toLowerCase().replace(/[^a-z0-9_+-]/g, '')
      const raw = language
        ? `#raw(${typstString(source)}, lang: ${typstString(language)}, block: true)`
        : `#raw(${typstString(source)}, block: true)`
      // `raw(block: true)` centres itself; code has to start at the block's
      // left edge like every other line on the page. Its size comes from the
      // `show raw` rules, not from a local `#text`, because Typst multiplies a
      // raw element's size by 0.8 on its own.
      return `#block(width: 100%, fill: luma(246), inset: (x: 9pt, y: 7pt), radius: 2pt, above: 0.85em, below: 0.85em)[#set par(first-line-indent: 0em, leading: 0.55em, justify: false)\n#align(left)[${raw}]]`
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
        .join('\n\n')
    case 'pageBreak':
      return '#pagebreak()'
    case 'callout': {
      const style = calloutStyle(node.attrs?.kind)
      const body = (node.content || []).map((child) => renderBlock(child, options)).join('\n\n')
      return `#block(width: 100%, fill: rgb("${style.background}"), stroke: (left: 3pt + rgb("${style.accent}")), inset: 10pt, radius: 3pt, above: 0.9em, below: 0.9em)[#set par(first-line-indent: 0em, spacing: 0.5em)\n#text(weight: "bold", fill: rgb("${style.accent}"))[${text(style.label)}]${body ? `\n#parbreak()\n${body}` : ''}]`
    }
    case 'collapsible': {
      const children = node.content || []
      const summary = children[0]?.type === 'collapsibleSummary' ? textOf(children[0]).trim() : ''
      const body = children
        .filter((child) => child.type !== 'collapsibleSummary')
        .map((child) => renderBlock(child, options))
        .join('\n\n')
      return `#block(width: 100%, stroke: 0.5pt + luma(185), inset: 10pt, radius: 3pt, above: 0.9em, below: 0.9em)[#set par(first-line-indent: 0em, spacing: 0.5em)\n#text(weight: "bold")[${text(summary || COLLAPSIBLE_DEFAULT_SUMMARY)}]${body ? `\n#parbreak()\n${body}` : ''}]`
    }
    case 'formula':
      return renderFormula(node, options)
    case 'flowCanvas':
      return `#block(width: 100%, fill: luma(245), inset: 10pt, radius: 2pt)[#align(center)[#text(fill: luma(110))[#text(${typstString(`[流程画布] ${String(node.attrs?.title || '未命名画布')}`)})]]]`
    case 'mindMapEmbed':
      return `#block(width: 100%, fill: luma(245), inset: 10pt, radius: 2pt)[#align(center)[#text(fill: luma(110))[#text(${typstString(`[思维导图] ${String(node.attrs?.title || '未命名思维导图')}`)})]]]`
    case 'tocBlock':
      return ''
    case 'text':
      return renderText(node)
    default:
      return (node.content || []).map((child) => renderBlock(child, options)).join('\n\n')
  }
}

export function renderDocTypst(
  doc: TypstJsonNode | null | undefined,
  options: TypstRenderOptions,
): string {
  if (!doc) return ''
  return (doc.content || [])
    .map((child) => renderBlock(child, options))
    .filter(Boolean)
    .join('\n\n')
}

export function collectTypstFigureNumbers(book: {
  chapters: { doc: Record<string, unknown> }[]
}): Map<TypstJsonNode, number> {
  const content = book.chapters.flatMap((chapter) =>
    Array.isArray(chapter.doc.content) ? (chapter.doc.content as TypstJsonNode[]) : [],
  )
  return collectJsonFigureNumbers({ type: 'doc', content }) as Map<TypstJsonNode, number>
}

export interface BuildTypstBookSourceInput {
  book: WorkBookModel
  settings: PdfExportSettings
  contentWidthPt: number
  includeSynopsis?: boolean
  coverPath?: string | null
  /** Palette for the default cover; ignored when `coverPath` is set. */
  coverPalette?: CoverPalette
  /** Header logo registered as a compiler asset. */
  branding?: TypstBrandingAsset | null
  imageSrc: (src: string) => TypstAssetRef | null
  mermaidSrc: (source: string) => TypstAssetRef | null
  formulaSrc: (latex: string, display: boolean) => TypstAssetRef | null
  signal?: AbortSignal
  onChapter?: (done: number, total: number) => void
}

export interface TypstChapterFile {
  path: string
  source: string
}

export interface TypstBookSource {
  main: string
  chapters: TypstChapterFile[]
}

type VolumeNode = {
  volume: BookVolume
  children: VolumeNode[]
}

function volumeTree(volumes: BookVolume[]): VolumeNode[] {
  const nodes = new Map<string, VolumeNode>()
  for (const volume of volumes) nodes.set(volume.path, { volume, children: [] })
  const roots: VolumeNode[] = []
  for (const volume of volumes) {
    const node = nodes.get(volume.path)
    if (!node) continue
    const parent = volume.parentPath ? nodes.get(volume.parentPath) : undefined
    if (parent && parent !== node) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0')
}

function paperArg(settings: PdfExportSettings): string {
  // 16开 is not one of Typst's named papers. `paper: (width: ..., height: ...)`
  // is rejected ("found dictionary"); the size has to be two page arguments.
  if (settings.paper === '16k') return 'width: 185mm, height: 260mm'
  // Typst has no paper named "b5". The size this app calls B5 is ISO B5 (176×250).
  const name = settings.paper === 'b5' ? 'iso-b5' : settings.paper
  return `paper: ${typstString(name)}`
}

function mm(value: number): string {
  return `${Math.round(value * 10) / 10}mm`
}

function frontMargin(settings: PdfExportSettings): string {
  const { top, bottom, inside, outside } = settings.marginsMm
  return `(top: ${mm(top)}, bottom: ${mm(bottom)}, left: ${mm(inside)}, right: ${mm(outside)})`
}

function bodyMargin(settings: PdfExportSettings): string {
  const { top, bottom, inside, outside } = settings.marginsMm
  const binding = inside + Math.max(0, settings.gutterMm)
  return `(top: ${mm(top)}, bottom: ${mm(bottom)}, inside: ${mm(binding)}, outside: ${mm(outside)})`
}

export interface TypstWatermarkStyle {
  /** `#rrggbb`，非法值退回默认浅灰。 */
  color?: string
  /** 0–1；Typst 用 `transparentize` 表达，传进来的是不透明度。 */
  opacity?: number
  /** pt。 */
  fontSize?: number
  /** 度，顺时针为正。 */
  angle?: number
}

function watermarkArg(settings: PdfExportSettings, style?: TypstWatermarkStyle): string | null {
  const text = settings.watermark.trim()
  if (!text) return null
  const color = /^#[0-9a-f]{6}$/i.test(style?.color || '') ? style!.color! : null
  const opacity = Math.min(0.5, Math.max(0.04, style?.opacity ?? 0.16))
  const size = Math.min(96, Math.max(16, style?.fontSize ?? 60))
  const angle = Math.min(75, Math.max(-75, style?.angle ?? -30))
  const fill = color ? `rgb("${color}").transparentize(${(1 - opacity).toFixed(2)})` : 'luma(225)'
  return `place(center + horizon, rotate(${angle}deg, text(size: ${size}pt, fill: ${fill})[${typstString(text)}]))`
}

export interface TypstBrandingAsset {
  /** Compiler shadow path of the header logo. */
  path: string
  heightMm: number
}

/**
 * Header/footer layout shared by the book and single-chapter exports: three
 * equal columns, an optional rule on the side facing the text, and a page
 * counter. Metadata tokens are resolved here; `{page}` / `{pages}` become the
 * Typst page counter so the number stays live in the reader.
 */
function bandTemplateSource(template: string, meta: BookMetadata): string {
  return parseBandTemplate(template, meta)
    .map((segment) => {
      if (segment.kind === 'text') return text(segment.text)
      if (segment.kind === 'page') return '#counter(page).display()'
      return '#counter(page).final().first()'
    })
    .join('')
}

function bandRule(style: PageRuleStyle): string {
  if (style === 'none') return ''
  if (style === 'dashed') {
    return '#line(length: 100%, stroke: (paint: luma(190), thickness: 0.5pt, dash: "dashed"))'
  }
  if (style === 'double') {
    return '#stack(spacing: 2pt, line(length: 100%, stroke: 0.5pt + luma(190)), line(length: 100%, stroke: 0.5pt + luma(190)))'
  }
  return '#line(length: 100%, stroke: 0.5pt + luma(190))'
}

function logoCall(logo: TypstBrandingAsset | null | undefined): string {
  if (!logo) return ''
  const height = Math.min(30, Math.max(3, logo.heightMm))
  return `#image(${typstString(logo.path)}, height: ${mm(height)})`
}

function pageBandArg(
  band: PageBandSettings,
  meta: BookMetadata,
  kind: 'header' | 'footer',
  logo?: TypstBrandingAsset | null,
): string | null {
  if (!band.enabled) return null

  const slots = bandSlotTemplates(
    band,
    kind === 'footer'
      ? {
          position: (band as PageFooterSettings).pageNumberPosition,
          format: (band as PageFooterSettings).pageNumberFormat,
        }
      : undefined,
  )

  const logoMarkup = logoCall(logo)
  const left = bandTemplateSource(slots.left, meta)
  const cells = [
    logoMarkup && left ? `${logoMarkup}#h(0.6em)${left}` : logoMarkup || left,
    bandTemplateSource(slots.center, meta),
    bandTemplateSource(slots.right, meta),
  ]
  const empty = cells.every((cell) => !cell)
  if (empty) return null

  // An empty slot used to keep a full third of the measure, so a title wrapped
  // onto two lines while the rest of the band sat blank, and a slot that could
  // not shrink pushed the band past the page edge. The longest slot takes the
  // leftover width; an empty one takes none.
  const weights = [
    (logoMarkup ? 4 : 0) + bandPlainLength(slots.left, meta),
    bandPlainLength(slots.center, meta),
    bandPlainLength(slots.right, meta),
  ]
  const widest = Math.max(...weights)
  const columns = weights.map((weight) => (weight <= 0 ? '0pt' : weight === widest ? '1fr' : 'auto')).join(', ')
  const grid = `#grid(columns: (${columns}), column-gutter: 0.9em, align(left)[${cells[0]}], align(center)[${cells[1]}], align(right)[${cells[2]}])`
  const rule = bandRule(band.separator)
  // The rule sits under the words. Justify must be turned off inside the
  // content: a set in the code block is overridden by the body's paragraph
  // settings, and a full-width cell then stretches a short title apart.
  const body = rule
    ? (kind === 'header' ? `${grid}\n#v(2pt)\n${rule}` : `${rule}\n#v(2pt)\n${grid}`)
    : grid
  return `${kind}: context {
    set text(size: 9pt, fill: luma(120))
    block(width: 100%)[
      #set par(justify: false, first-line-indent: 0em, spacing: 0.2em)
      ${body}
    ]
  }`
}

function bandPlainLength(template: string, meta: BookMetadata): number {
  return parseBandTemplate(template, meta).reduce(
    (sum, segment) => sum + (segment.kind === 'text' ? segment.text.length : 2),
    0,
  )
}

function pageArgs(parts: Array<string | null | false | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(', ')
}

function parseDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return { year, month, day }
}

function typstLanguage(language: string): { lang: string; region?: string } {
  const [lang, region] = String(language || '')
    .trim()
    .toLowerCase()
    .split('-')
  return {
    lang: /^[a-z]{2,3}$/.test(lang) ? lang : 'zh',
    region: region && /^[a-z]{2}$/.test(region) ? region : lang === 'zh' ? 'cn' : undefined,
  }
}

function documentSource(book: WorkBookModel): string {
  const meta = book.meta
  const args: string[] = [`title: ${typstString(meta.title)}`]
  if (meta.author) args.push(`author: ${typstString(meta.author)}`)
  if (meta.keywords.length > 0) {
    args.push(`keywords: (${meta.keywords.map(typstString).join(', ')},)`)
  }
  const date = parseDate(meta.publicationDate)
  if (date) {
    args.push(`date: datetime(year: ${date.year}, month: ${date.month}, day: ${date.day})`)
  }
  return `#set document(${args.join(', ')})`
}

/**
 * Typst measures a line box from the tallest glyph's box, and Noto Serif SC
 * reports 0.73em, so the baseline pitch is `0.73em + par.leading`. `lineSpacing`
 * is a line-height multiplier (1.5 = one and a half lines), therefore the
 * leading is the *difference* between the two — passing the multiplier straight
 * to `leading` yields 2.4 lines for a 1.7 setting.
 */
const LINE_BOX_EM = 0.73

interface LineMetrics {
  /** Target baseline-to-baseline distance in points. */
  pitch: number
  /** `par.leading`, in em. */
  leading: number
  /** `par.spacing`, in em. */
  spacing: number
}

function lineMetrics(settings: PdfExportSettings): LineMetrics {
  const leading = Math.max(0.2, settings.lineSpacing - LINE_BOX_EM)
  return {
    pitch: settings.bodySizePt * settings.lineSpacing,
    leading,
    // A paragraph break needs at least one full pitch, otherwise it reads
    // tighter than a line break. The extra 0.25em keeps the break visible
    // when paragraphs are not indented.
    spacing: leading + 0.25,
  }
}

/**
 * Heading sizes relative to the body text, with the space above and below in
 * units of one body line pitch. The gap above is always clearly larger than
 * the gap below: that asymmetry is what makes a heading look attached to the
 * text it introduces instead of floating between two paragraphs.
 */
const HEADINGS = [
  { size: 1.9, above: 1.3, below: 0.9, center: true },
  { size: 1.5, above: 1.1, below: 0.5, center: false },
  { size: 1.28, above: 0.95, below: 0.42, center: false },
  { size: 1.14, above: 0.8, below: 0.35, center: false },
  { size: 1.0, above: 0.7, below: 0.3, center: false },
  { size: 1.0, above: 0.7, below: 0.3, center: false },
]

function pt(value: number): string {
  return `${Math.round(value * 10) / 10}pt`
}

function pdfFontTuple(names: string[]): string {
  const unique: string[] = []
  for (const name of names) {
    if (name && !unique.includes(name)) unique.push(name)
  }
  return `(${unique.map((name) => typstString(name)).join(', ')})`
}

function pdfTextFont(settings: PdfExportSettings): string {
  const body = pdfBodyFontName(settings.bodyFont)
  return pdfFontTuple([body, 'Noto Emoji', 'Noto Serif SC'])
}

function pdfRawFont(settings: PdfExportSettings): string {
  const body = pdfBodyFontName(settings.bodyFont)
  return pdfFontTuple(['Noto Sans Mono', 'Noto Emoji', body, 'Noto Serif SC'])
}

function headingShows(settings: PdfExportSettings): string {
  const { pitch } = lineMetrics(settings)
  return HEADINGS.map((spec, index) => {
    const level = index + 1
    const size = Math.round(settings.bodySizePt * spec.size * 10) / 10
    const body = `#text(size: ${pt(size)}, weight: "bold")[#it.body]`
    const content = spec.center ? `#align(center)[${body}]` : body
    // `sticky` keeps a heading from being orphaned at the bottom of a page;
    // `leading` is tightened because a wrapped heading is not running text.
    return `#show heading.where(level: ${level}): it => block(above: ${pt(pitch * spec.above)}, below: ${pt(pitch * spec.below)}, width: 100%, sticky: true)[#set par(leading: 0.45em, justify: false)\n${content}]`
  }).join('\n')
}

/**
 * List markers are drawn, not typed. The bullet glyph in Noto Serif SC is a
 * thin, high dot that all but disappears at body size; a small circle scales
 * with the text and keeps its weight at every font size.
 *
 * `move(dy:)` is what puts the circle at the optical middle of a CJK line:
 * a marker is baseline-aligned, which leaves any box ~2pt above the centre.
 */
const BULLET_MARKERS = [
  'box(move(dy: 0.18em, circle(radius: 0.12em, fill: black)))',
  'box(move(dy: 0.18em, circle(radius: 0.09em, stroke: 0.55pt)))',
  '[–]',
]

function listShows(): string {
  return [
    `#set list(indent: 1.5em, body-indent: 0.55em, spacing: 0.35em, marker: (${BULLET_MARKERS.join(', ')}))`,
    '#set enum(indent: 1.8em, body-indent: 0.55em, spacing: 0.35em)',
  ].join('\n')
}

/**
 * A checkbox drawn with a box and a check mark. `☐` (U+2610) has no glyph in
 * the bundled fonts and prints as tofu, while the drawn box always renders.
 */
function taskMarker(checked: boolean): string {
  const frame = `#box(width: 0.92em, height: 0.92em, stroke: 0.6pt + luma(120), radius: 1.5pt, baseline: 0.12em${checked ? ', fill: luma(245)' : ''})`
  if (!checked) return frame
  return `${frame}[#align(center + horizon)[#text(size: 0.72em, weight: "bold")[✓]]]`
}

/**
 * A PDF bookmark without visible text.
 *
 * `bookmarked: true, outlined: false` puts the heading in the bookmark tree
 * only, so front matter shows in readers' 书签 panel without leaking into the
 * printed 目录. `place` keeps the zero-height anchor out of the page layout.
 */
function bookmarkAnchor(level: number, title: string): string {
  return `#place(top + left)[#heading(level: ${level}, outlined: false, bookmarked: true)[#hide[${text(title)}]]]`
}

function coverSource(
  book: WorkBookModel,
  coverPath: string | null,
  palette: CoverPalette,
  settings: PdfExportSettings,
): string {
  if (coverPath) {
    return `#image(${typstString(coverPath)}, width: 100%, height: 100%, fit: "cover")`
  }
  return vectorCoverSource(book, palette, settings)
}

/**
 * The default cover as Typst content, not a bitmap.
 *
 * It reproduces the 1200×1800 design from `cover.ts` (the one EPUB still paints
 * onto a canvas) with the same projection the old `fit: "cover"` image used:
 * width fills the page and the vertical overflow is cropped evenly. Everything
 * stays a text or path object, so the page is vector at any print size and the
 * PDF editor can touch each line instead of one full-page image.
 */
function vectorCoverSource(
  book: WorkBookModel,
  palette: CoverPalette,
  settings: PdfExportSettings,
): string {
  const meta = book.meta
  const paper = paperSizeMm(settings.paper)
  const pageWidth = paper.width * PT_PER_MM
  const pageHeight = paper.height * PT_PER_MM
  const scale = Math.max(pageWidth / 1200, pageHeight / 1800)
  const offsetY = (pageHeight - 1800 * scale) / 2
  const x = (px: number) => px * scale
  const y = (px: number) => px * scale + offsetY

  const titleSize = x(92)
  const subtitleSize = x(42)
  const authorSize = x(46)
  const titleTop = y(640) - titleSize * 0.8
  const titleBottom = titleTop + titleSize * 1.26
  const subtitle = meta.subtitle.trim()
  const subtitleTop = y(774) - subtitleSize * 0.8
  const subtitleBottom = subtitleTop + subtitleSize * 1.38
  const lineY = y(subtitle ? 902 : 826)
  const authorTop = y(subtitle ? 1002 : 926) - authorSize * 0.8

  const lines = [
    `#block(width: 100%, height: 100%, fill: rgb("${palette.background}"))[`,
    `  #place(top + left, dx: ${pt(x(72))}, dy: ${pt(y(72))})[#block(width: ${pt(x(1056))}, height: ${pt(x(1656))}, stroke: ${pt(x(3))} + rgb("${palette.accent}"))]`,
    `  #place(top + center, dy: ${pt(y(190) - x(30) * 0.8)})[#text(size: ${pt(x(30))}, weight: "medium", fill: rgb("${palette.accent}"))[大懒猫创作平台]]`,
    `  #place(top + center, dy: ${pt(titleTop)})[`,
    `    #block(width: ${pt(x(900))})[`,
    `      #block(width: 100%)[`,
    '        #set par(leading: 0.53em, justify: false, first-line-indent: 0em)',
    `        #align(center)[#text(size: ${pt(titleSize)}, weight: "bold", fill: rgb("${palette.foreground}"))[${text(meta.title || '未命名内容')}]]`,
    '      ]',
  ]
  if (subtitle) {
    lines.push(
      `      #v(${pt(subtitleTop - titleBottom)})`,
      `      #align(center)[#text(size: ${pt(subtitleSize)}, fill: rgb("${palette.muted}"))[${text(subtitle)}]]`,
    )
  }
  lines.push(
    `      #v(${pt(lineY - (subtitle ? subtitleBottom : titleBottom))})`,
    `      #align(center)[#line(length: ${pt(x(140))}, stroke: ${pt(x(2))} + rgb("${palette.accent}"))]`,
  )
  if (meta.author.trim()) {
    lines.push(
      `      #v(${pt(authorTop - lineY)})`,
      `      #align(center)[#text(size: ${pt(authorSize)}, fill: rgb("${palette.foreground}"))[${text(meta.author)}]]`,
    )
  }
  lines.push('    ]', '  ]', ']')
  return lines.join('\n')
}

function titlePageSource(book: WorkBookModel, body: number): string {
  const meta = book.meta
  const lines = [
    // Full-height block so the imprint can be pushed to the bottom edge with
    // `1fr`; without it the imprint trails the title into the middle of the page.
    '#block(width: 100%, height: 100%)[',
    '#set par(first-line-indent: 0em)',
    '#v(28%)',
    `#align(center)[#text(size: ${pt(body * 2.2)}, weight: "bold")[${text(meta.title)}]]`,
  ]
  if (meta.subtitle) {
    lines.push(
      `#v(0.7em)\n#align(center)[#text(size: ${pt(body * 1.2)}, fill: luma(90))[${text(meta.subtitle)}]]`,
    )
  }
  lines.push('#v(3em)')
  if (meta.author) {
    lines.push(`#align(center)[#text(size: ${pt(body * 1.1)})[${text(meta.author)}]]`)
  }
  if (meta.publisher) {
    lines.push(
      `#v(0.9em)\n#align(center)[#text(size: ${pt(body * 0.95)}, fill: luma(100))[${text(meta.publisher)}]]`,
    )
  }
  lines.push('#v(1fr)')
  lines.push(`#align(center)[#text(size: 9pt, fill: luma(150))[${text('大懒猫创作平台')}]]`)
  lines.push(']')
  return lines.join('\n')
}

function copyrightPageSource(book: WorkBookModel, body: number): string {
  const meta = book.meta
  const lines = [
    '#block(width: 100%, height: 100%)[',
    '#set par(first-line-indent: 0em)',
    '#v(12%)',
    `#text(size: ${pt(body * 1.5)}, weight: "bold")[${text(meta.title)}]`,
    '#v(0.9em)',
    '#line(length: 32%, stroke: 0.8pt + luma(170))',
    '#v(1.4em)',
  ]
  const entry = (label: string, value: string) =>
    `#text(size: ${pt(body * 0.95)}, fill: luma(70))[${text(`${label}：${value}`)}]`
  if (meta.author) lines.push(entry('作者', meta.author), '#parbreak()')
  if (meta.publisher) lines.push(entry('出版方', meta.publisher), '#parbreak()')
  if (meta.isbn) lines.push(entry('ISBN', meta.isbn), '#parbreak()')
  if (meta.publicationDate) lines.push(entry('出版日期', meta.publicationDate), '#parbreak()')
  // Rights notice belongs at the foot of the page, not under the metadata.
  if (meta.rights) {
    lines.push('#v(1fr)')
    lines.push(`#text(size: ${pt(body * 0.85)}, fill: luma(110))[${text(meta.rights)}]`)
  }
  lines.push(']')
  return lines.join('\n')
}

function synopsisPageSource(book: WorkBookModel, body: number): string {
  const paragraphs = book.meta.description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const content = paragraphs.flatMap((line, index) => [
    ...(index > 0 ? ['#parbreak()'] : []),
    text(line),
  ])
  return `#block(width: 100%)[#set par(first-line-indent: 0em)\n#text(size: ${pt(body * 1.5)}, weight: "bold")[${text('内容简介')}]\n#v(1.2em)\n${content.join('\n')}]`
}

function chapterSynopsisSource(synopsis: string): string {
  const paragraphs = synopsis
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (paragraphs.length === 0) return ''
  const body = paragraphs
    .map((line, index) => `${index > 0 ? '#parbreak()\n' : ''}${text(line)}`)
    .join('')
  return `#block(width: 100%, inset: 9pt, fill: luma(247), radius: 2pt)[#set par(first-line-indent: 0em)\n#text(fill: luma(90))[${body}]]`
}

function chapterSource(
  chapter: BookChapter,
  chapterLevel: number,
  options: TypstRenderOptions,
): string {
  const heading = `#heading(level: ${chapterLevel}, outlined: true)[${text(chapter.title)}]`
  const synopsis = chapter.synopsis ? chapterSynopsisSource(chapter.synopsis) : ''
  const body = renderDocTypst(chapter.doc as TypstJsonNode, options)
  return [heading, synopsis, body].filter(Boolean).join('\n\n') + '\n'
}

export async function buildTypstBookSource(
  input: BuildTypstBookSourceInput,
): Promise<TypstBookSource> {
  const { book, settings } = input
  if (book.chapters.length === 0) throw new Error(nt('export.errorNoExportableContent'))
  const withVolumes = book.options.includeVolumeTitles && book.volumes.length > 0
  const chapterLevel = withVolumes ? 2 : 1
  const headingOffset = withVolumes ? 2 : 1
  const figureNumbers = collectTypstFigureNumbers(book)
  const renderOptions: TypstRenderOptions = {
    headingOffset,
    contentWidthPt: input.contentWidthPt,
    tableSizePt: Math.max(8.5, Math.round(settings.bodySizePt * 0.9 * 10) / 10),
    imageSrc: input.imageSrc,
    mermaidSrc: input.mermaidSrc,
    formulaSrc: input.formulaSrc,
    figureNumbers,
  }

  const language = typstLanguage(book.meta.language)
  const indent = settings.firstLineIndentChars > 0 ? settings.firstLineIndentChars : 0
  const watermark = watermarkArg(settings)
  const header = pageBandArg(settings.header, book.meta, 'header', input.branding)
  const footer = pageBandArg(settings.footer, book.meta, 'footer')
  // Front matter carries its own page settings; the band only appears there
  // when the user explicitly turns off the "hide on front matter" option.
  const frontPage = `#set page(${pageArgs([
    paperArg(settings),
    `margin: ${frontMargin(settings)}`,
    'numbering: none',
    settings.header.hideOnFrontMatter ? 'header: none' : header,
    settings.footer.hideOnFrontMatter ? 'footer: none' : footer,
    watermark ? `background: ${watermark}` : null,
  ])})`
  const bodyPage = `#set page(${pageArgs([
    paperArg(settings),
    `margin: ${bodyMargin(settings)}`,
    settings.preset === 'print' ? 'binding: left' : null,
    'numbering: none',
    header,
    footer,
    watermark ? `background: ${watermark}` : null,
  ])})`

  const metrics = lineMetrics(settings)
  const meta = [
    documentSource(book),
    frontPage,
    // "Noto Emoji" is the fallback for icons: without it every emoji prints as
    // a tofu box, because the serif face has no emoji glyphs.
    `#set text(font: ${pdfTextFont(settings)}, size: ${pt(settings.bodySizePt)}, hyphenate: true, lang: ${typstString(language.lang)}${language.region ? `, region: ${typstString(language.region)}` : ''})`,
    `#set par(justify: ${settings.justify}, leading: ${metrics.leading}em, first-line-indent: (amount: ${indent}em, all: true), spacing: ${metrics.spacing}em)`,
    listShows(),
    // `raw` does not pick a monospace face out of the body font stack; it has
    // to be shown explicitly or code prints in the serif body font. Typst also
    // shrinks a raw element to 0.8em by default, so 1.12em lands at ~0.9em of
    // the surrounding text.
    `#show raw: set text(font: ${pdfRawFont(settings)})`,
    '#show raw.where(block: true): set text(size: 1.12em)',
    '#show raw.where(block: false): set text(size: 1.12em)',
    headingShows(settings),
  ].join('\n')

  const front: string[] = []
  if (settings.includeCover) {
    front.push(
      `#set page(${pageArgs([
        'margin: 0pt',
        'numbering: none',
        'header: none',
        'footer: none',
        watermark ? `background: ${watermark}` : null,
      ])})`,
      bookmarkAnchor(chapterLevel, '封面'),
      coverSource(
        book,
        input.coverPath || null,
        input.coverPalette ?? COVER_PALETTES.literary,
        settings,
      ),
      '#pagebreak()',
      frontPage,
    )
  }
  if (settings.includeTitlePage) {
    front.push(bookmarkAnchor(chapterLevel, '扉页'), titlePageSource(book, settings.bodySizePt), '#pagebreak()')
  }
  if (settings.includeCopyright) {
    front.push(bookmarkAnchor(chapterLevel, '版权信息'), copyrightPageSource(book, settings.bodySizePt), '#pagebreak()')
  }
  if (input.includeSynopsis !== false && book.meta.description.trim()) {
    front.push(bookmarkAnchor(chapterLevel, '内容简介'), synopsisPageSource(book, settings.bodySizePt), '#pagebreak()')
  }
  if (book.options.includeToc) {
    front.push(
      bookmarkAnchor(chapterLevel, '目录'),
      '#outline(title: [目录], depth: 2, indent: auto)',
      '#pagebreak()',
    )
  }

  const total = book.chapters.length
  const chapterFiles: TypstChapterFile[] = []
  const bodyParts: string[] = []
  let done = 0
  const addChapter = async (chapter: BookChapter): Promise<void> => {
    throwIfAborted(input.signal)
    const filePath = `/chapters/${pad(done + 1, 4)}.typ`
    chapterFiles.push({
      path: filePath,
      source: chapterSource(chapter, chapterLevel, renderOptions),
    })
    bodyParts.push(`#include ${typstString(filePath.slice(1))}`)
    done += 1
    input.onChapter?.(done, total)
    if (done % 8 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }
  const walkVolume = async (node: VolumeNode): Promise<void> => {
    if (withVolumes) {
      bodyParts.push(`#v(30%)\n#heading(level: 1, outlined: true)[${text(node.volume.title)}]`)
    }
    for (const chapter of node.volume.chapters) await addChapter(chapter)
    for (const child of node.children) await walkVolume(child)
  }

  for (const chapter of book.rootChapters) await addChapter(chapter)
  for (const node of volumeTree(book.volumes)) await walkVolume(node)
  if (bodyParts.length === 0) throw new Error(nt('export.errorNoExportableContent'))
  throwIfAborted(input.signal)

  const separator = settings.chapterStart === 'recto' ? '#pagebreak(to: "odd")' : '#pagebreak()'
  const body = [bodyPage, '#counter(page).update(1)', bodyParts.join(`\n${separator}\n`)].join('\n')
  const main = [meta, front.join('\n'), body].filter(Boolean).join('\n\n') + '\n'
  return { main, chapters: chapterFiles }
}

export interface BuildTypstChapterSourceInput {
  doc: TypstJsonNode
  /** 只进 PDF 元数据（阅读器的标题栏），不排进正文。 */
  title: string
  settings: PdfExportSettings
  contentWidthPt: number
  /** 水印样式。书籍导出只有文字，单章导出按用户在弹窗里调的颜色/字号/角度走。 */
  watermarkStyle?: TypstWatermarkStyle
  branding?: TypstBrandingAsset | null
  imageSrc: (src: string) => TypstAssetRef | null
  mermaidSrc: (source: string) => TypstAssetRef | null
  formulaSrc: (latex: string, display: boolean) => TypstAssetRef | null
}

/**
 * 单章导出：正文按编辑器的 TipTap JSON 重新排版，产出可选中、可搜索的真文字 PDF。
 *
 * 和书籍导出的差别只在「壳」：没有封面 / 扉页 / 目录，也不替用户补一个章节标题
 * （正文里本来就有他自己写的一级标题），标题层级原样保留（`headingOffset: 0`）。
 */
export function buildTypstChapterSource(input: BuildTypstChapterSourceInput): string {
  const { settings, doc } = input
  // The chapter shell has no book metadata, so band tokens resolve against the
  // chapter title; `{author}` and friends stay empty rather than leak "undefined".
  const bandMeta: BookMetadata = {
    title: input.title,
    subtitle: '',
    author: '',
    language: 'zh-CN',
    publisher: '',
    isbn: '',
    publicationDate: '',
    description: '',
    rights: '',
    keywords: [],
  }
  const figureNumbers = collectJsonFigureNumbers(doc) as Map<TypstJsonNode, number>
  const renderOptions: TypstRenderOptions = {
    headingOffset: 0,
    contentWidthPt: input.contentWidthPt,
    tableSizePt: Math.max(8.5, Math.round(settings.bodySizePt * 0.9 * 10) / 10),
    imageSrc: input.imageSrc,
    mermaidSrc: input.mermaidSrc,
    formulaSrc: input.formulaSrc,
    figureNumbers,
  }
  const metrics = lineMetrics(settings)
  const watermark = watermarkArg(settings, input.watermarkStyle)
  const indent = settings.firstLineIndentChars > 0 ? settings.firstLineIndentChars : 0
  const meta = [
    `#set document(title: ${typstString(input.title)})`,
    `#set page(${pageArgs([
      paperArg(settings),
      `margin: ${bodyMargin(settings)}`,
      'numbering: none',
      pageBandArg(settings.header, bandMeta, 'header', input.branding),
      pageBandArg(settings.footer, bandMeta, 'footer'),
      watermark ? `background: ${watermark}` : null,
    ])})`,
    // "Noto Emoji" 兜底图标：正文里的 emoji 在衬线字里没有字形，不兜底就是豆腐块。
    `#set text(font: ${pdfTextFont(settings)}, size: ${pt(settings.bodySizePt)}, hyphenate: true, lang: "zh", region: "cn")`,
    `#set par(justify: ${settings.justify}, leading: ${metrics.leading}em, first-line-indent: (amount: ${indent}em, all: true), spacing: ${metrics.spacing}em)`,
    listShows(),
    // `raw` 不会自己从正文字体栈里挑等宽字体，必须显式 show 一次；1.12em 是为了
    // 抵消 Typst 给 raw 默认的 0.8 倍缩字。
    `#show raw: set text(font: ${pdfRawFont(settings)})`,
    '#show raw.where(block: true): set text(size: 1.12em)',
    '#show raw.where(block: false): set text(size: 1.12em)',
    headingShows(settings),
  ].join('\n')
  const body = renderDocTypst(doc, renderOptions)
  return [meta, body].filter(Boolean).join('\n\n') + '\n'
}

export function typstContentWidthPt(settings: PdfExportSettings): number {
  const paper = paperSizeMm(settings.paper)
  const widthMm =
    paper.width - settings.marginsMm.inside - settings.marginsMm.outside - settings.gutterMm
  return Math.max(80, widthMm * PT_PER_MM)
}
