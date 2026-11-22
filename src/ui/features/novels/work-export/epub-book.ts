import JSZip from 'jszip'
import type {
  BookAssets,
  BookChapter,
  BookVolume,
  EpubExportSettings,
  ExportAsset,
  WorkBookModel,
} from './types'
import type { BookMetadata } from './types'
import {
  EPUB_THEMES,
  isValidIsbn,
  normalizeIsbn,
} from './presets'
import { nt } from '../nt'
import {
  collectBookFigureNumbers,
  escapeXml,
  renderDocXhtml,
  xhtmlPage,
  type XhtmlJsonNode,
} from './epub-xhtml'
import {
  buildContainerXml,
  buildContentOpf,
  buildNavXhtml,
  buildTocNcx,
  buildTocPageXhtml,
  type EpubGuideReference,
  type EpubManifestItem,
  type EpubNavEntry,
  type EpubSpineItem,
} from './epub-package'
import { COVER_PALETTES, createDefaultCover } from './cover'
import { imageExtension } from './assets'
import { throwIfAborted } from './progress'

export interface BuildEpubBookInput {
  book: WorkBookModel
  settings: EpubExportSettings
  assets: Pick<BookAssets, 'images' | 'mermaid'>
  cover?: ExportAsset | null
  onChapter?: (done: number, total: number) => void
  signal?: AbortSignal
  now?: Date
  randomUUID?: () => string
}

type PageFile = {
  id: string
  href: string
  title: string
  body: string
  bodyClass: string
}

type VolumeNode = {
  volume: BookVolume
  children: VolumeNode[]
}

type FormulaRenderer = (latex: string, display: boolean) => string | null

function pad(value: number): string {
  return String(value).padStart(3, '0')
}

function fallbackUuid(): string {
  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function identifierFor(metadata: BookMetadata, randomUUID?: () => string): string {
  if (isValidIsbn(metadata.isbn)) return `urn:isbn:${normalizeIsbn(metadata.isbn)}`
  if (randomUUID) return `urn:uuid:${randomUUID()}`
  const crypto = globalThis.crypto
  if (crypto?.randomUUID) return `urn:uuid:${crypto.randomUUID()}`
  return `urn:uuid:${fallbackUuid()}`
}

function modifiedTimestamp(now: Date): string {
  return `${now.toISOString().slice(0, 19)}Z`
}

function paragraphs(text: string, className?: string): string {
  const cls = className ? ` class="${className}"` : ''
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p${cls}>${escapeXml(line)}</p>`)
    .join('\n')
}

function titlePage(book: WorkBookModel): PageFile {
  const meta = book.meta
  const lines = [`<h1 class="book-title">${escapeXml(meta.title)}</h1>`]
  if (meta.subtitle) lines.push(`<p class="book-subtitle">${escapeXml(meta.subtitle)}</p>`)
  if (meta.author) lines.push(`<p class="book-author">${escapeXml(meta.author)}</p>`)
  if (meta.publisher) lines.push(`<p class="book-publisher">${escapeXml(meta.publisher)}</p>`)
  return {
    id: 'titlepage',
    href: 'titlepage.xhtml',
    title: meta.title,
    bodyClass: 'frontmatter title-page',
    body: `<section epub:type="titlepage" class="title-page-inner">\n${lines.join('\n')}\n</section>`,
    // The page wrapper receives the class through xhtmlPage below.
  }
}

function copyrightPage(book: WorkBookModel): PageFile {
  const meta = book.meta
  const rows: string[] = [`<p class="copyright-title">${escapeXml(meta.title)}</p>`]
  if (meta.author) rows.push(`<p>作者：${escapeXml(meta.author)}</p>`)
  if (meta.publisher) rows.push(`<p>出版方：${escapeXml(meta.publisher)}</p>`)
  if (meta.isbn) rows.push(`<p>ISBN：${escapeXml(meta.isbn)}</p>`)
  if (meta.publicationDate) rows.push(`<p>出版日期：${escapeXml(meta.publicationDate)}</p>`)
  if (meta.rights) rows.push(`<p class="copyright-rights">${escapeXml(meta.rights)}</p>`)
  return {
    id: 'copyright',
    href: 'copyright.xhtml',
    title: '版权信息',
    bodyClass: 'frontmatter copyright-page',
    body: `<section epub:type="copyright-page" class="copyright-page-inner">\n<h1 class="front-title">版权信息</h1>\n${rows.join('\n')}\n</section>`,
  }
}

function synopsisPage(book: WorkBookModel): PageFile {
  return {
    id: 'synopsis',
    href: 'synopsis.xhtml',
    title: '内容简介',
    bodyClass: 'frontmatter synopsis-page',
    body: `<section epub:type="preface" class="synopsis-page-inner">\n<h1 class="front-title">内容简介</h1>\n${paragraphs(book.meta.description)}\n</section>`,
  }
}

function coverPage(book: WorkBookModel, coverHref: string | null): PageFile {
  if (coverHref) {
    return {
      id: 'cover-page',
      href: 'cover.xhtml',
      title: '封面',
      bodyClass: 'cover-page',
      body: `<section epub:type="cover" class="cover">\n<img src="${escapeXml(coverHref)}" alt="${escapeXml(`《${book.meta.title}》封面`)}"/>\n</section>`,
    }
  }
  const lines = [
    '<p class="cover-brand">大懒猫写作</p>',
    `<h1 class="book-title">${escapeXml(book.meta.title)}</h1>`,
  ]
  if (book.meta.subtitle) lines.push(`<p class="book-subtitle">${escapeXml(book.meta.subtitle)}</p>`)
  if (book.meta.author) lines.push(`<p class="book-author">${escapeXml(book.meta.author)}</p>`)
  return {
    id: 'cover-page',
    href: 'cover.xhtml',
    title: '封面',
    bodyClass: 'cover-page text-cover-page',
    body: `<section epub:type="cover" class="text-cover">\n${lines.join('\n')}\n</section>`,
  }
}

function volumePage(volume: BookVolume): PageFile {
  return {
    id: 'volume-page',
    href: '',
    title: volume.title,
    bodyClass: 'volume-page',
    body: `<section epub:type="part" class="volume-page-inner">\n<h1 class="volume-title">${escapeXml(volume.title)}</h1>\n</section>`,
  }
}

function chapterPage(
  chapter: BookChapter,
  lang: string,
  renderBody: (chapter: BookChapter) => string,
): PageFile {
  const synopsis = chapter.synopsis
    ? `<div class="chapter-synopsis">\n${paragraphs(chapter.synopsis)}\n</div>\n`
    : ''
  const body = `<section epub:type="chapter" class="chapter">\n<h1 class="chapter-title">${escapeXml(chapter.title)}</h1>\n${synopsis}${renderBody(chapter)}\n</section>`
  return {
    id: '',
    href: '',
    title: chapter.title,
    bodyClass: 'chapter-page',
    body: xhtmlPage({ title: chapter.title, lang, body, bodyClass: 'chapter-page' }),
  }
}

function pageBodyToXhtml(page: PageFile, lang: string): string {
  return xhtmlPage({ title: page.title, lang, body: page.body, bodyClass: page.bodyClass })
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

function escapeCssValue(value: string): string {
  return value.replace(/[<>{}]/g, '')
}

export function buildEpubStyles(settings: EpubExportSettings): string {
  const theme = EPUB_THEMES[settings.preset] || EPUB_THEMES.literary
  const indent = `${settings.paragraphIndent}em`
  const family = escapeCssValue(theme.fontFamily)
  const headingFamily = escapeCssValue(theme.headingFontFamily)
  const chapterBreak = settings.chapterPageBreak ? 'always' : 'auto'
  return `/* ${theme.descriptionKey} */
html {
  font-size: 100%;
}
body {
  margin: 0 5%;
  font-family: ${family};
  line-height: ${theme.lineHeight};
  color: #1a1a1a;
}
p {
  margin: 0 0 ${theme.paragraphSpacing};
  text-indent: ${indent};
}
body.frontmatter p,
body.cover-page p,
.toc-page p,
.chapter-synopsis p,
figcaption,
.callout p,
.note p,
.media-cell p,
li p,
td p,
th p {
  text-indent: 0;
}
h1, h2, h3, h4, h5, h6 {
  font-family: ${headingFamily};
  font-weight: ${theme.headingWeight};
  line-height: 1.35;
  text-align: ${theme.headingAlign};
  /* The gap above is always clearly larger than the gap below: that asymmetry
     is what attaches a heading to the text it introduces. */
  margin: 1.6em 0 0.6em;
  page-break-after: avoid;
  break-after: avoid;
}
h1 {
  font-size: 2em;
  page-break-before: always;
  break-before: page;
}
h2 { font-size: 1.5em; }
h3 { font-size: 1.28em; }
h4, h5, h6 { font-size: 1.1em; }
/* A chapter opens the page, so it must not push itself down with a top margin. */
h1.chapter-title {
  margin-top: 0;
  page-break-before: ${chapterBreak};
  break-before: ${chapterBreak};
}
body.frontmatter h1,
body.cover-page h1,
body.toc-page h1,
.volume-page h1,
.title-page h1,
.copyright-page h1,
.synopsis-page h1 {
  page-break-before: auto;
  break-before: auto;
}
a {
  color: inherit;
  text-decoration: none;
}
img {
  max-width: 100%;
  height: auto;
}
figure {
  margin: 1.1em 0;
  text-align: center;
  text-indent: 0;
}
figcaption {
  margin-top: 0.4em;
  font-size: 0.85em;
  color: #666666;
}
table {
  max-width: 100%;
  width: 100%;
  margin: 1em 0;
  border-collapse: collapse;
  font-size: 0.9em;
}
th, td {
  border: 1px solid ${theme.tableBorder};
  padding: 0.35em 0.5em;
  text-align: left;
  vertical-align: top;
}
th {
  background: ${theme.codeBackground};
  font-weight: 600;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-wrap: break-word;
  margin: 1em 0;
  padding: 0.7em 0.8em;
  background: ${theme.codeBackground};
  border-radius: 3px;
  font-size: 0.85em;
  line-height: 1.5;
}
code {
  font-family: "SFMono-Regular", "Consolas", "Liberation Mono", monospace;
  font-size: 0.92em;
}
pre code {
  font-size: 1em;
}
/* A fixed advance keeps the icon off the next character in readers whose
   emoji fallback paints wider than it measures. */
.emoji {
  display: inline-block;
  width: 1.25em;
  font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
  font-style: normal;
  font-weight: normal;
  text-align: left;
  text-indent: 0;
}
blockquote {
  margin: 1em 1.2em;
  padding-left: 0.9em;
  border-left: 3px solid ${theme.tableBorder};
  color: #555555;
}
blockquote p {
  text-indent: 0;
}
hr {
  border: none;
  border-top: 1px solid ${theme.tableBorder};
  margin: 1.5em 0;
}
ul, ol {
  margin: 0.8em 0;
  padding-left: 1.6em;
}
li {
  margin: 0.25em 0;
}
li > p {
  margin: 0;
}
/* A nested list belongs to the item above it, not to the paragraph rhythm. */
li > ul,
li > ol {
  margin: 0.2em 0;
}
.callout {
  margin: 1em 0;
  padding: 0.7em 0.9em;
  border-left: 4px solid ${theme.tableBorder};
  background: ${theme.codeBackground};
}
.callout-label {
  font-weight: 600;
  margin-bottom: 0.3em;
  text-indent: 0;
}
.note {
  margin: 1em 0;
  padding: 0.7em 0.9em;
  border: 1px solid ${theme.tableBorder};
}
.note-title {
  font-weight: 600;
  text-indent: 0;
  margin-bottom: 0.3em;
}
.embed-placeholder {
  margin: 1.2em 0;
  padding: 1em;
  text-align: center;
  color: #777777;
  border: 1px dashed ${theme.tableBorder};
}
.missing-image {
  color: #888888;
  text-align: center;
  text-indent: 0;
}
.formula-block {
  display: block;
  margin: 1em 0;
  text-align: center;
  overflow-x: auto;
}
.formula-fallback {
  white-space: pre-wrap;
}
.page-break {
  page-break-after: always;
  break-after: page;
}
.task-checkbox {
  margin-right: 0.3em;
}
.cover {
  margin: 0;
  padding: 0;
  text-align: center;
  page-break-after: always;
  break-after: page;
}
body.cover-page {
  margin: 0;
  padding: 0;
}
.cover img {
  max-width: 100%;
  max-height: 100vh;
  width: auto;
  height: auto;
}
.text-cover {
  min-height: 90vh;
  padding: 16% 10% 10%;
  box-sizing: border-box;
  text-align: center;
}
.text-cover .cover-brand {
  margin-bottom: 3em;
  font-size: 0.9em;
  letter-spacing: 0.12em;
  color: #777777;
  text-indent: 0;
}
.text-cover .book-title {
  font-size: 2.4em;
  line-height: 1.35;
  margin: 0 0 0.6em;
  page-break-before: auto;
}
.text-cover .book-subtitle {
  font-size: 1.15em;
  color: #555555;
  text-indent: 0;
}
.text-cover .book-author {
  margin-top: 4em;
  font-size: 1.05em;
  text-indent: 0;
}
.title-page {
  padding-top: 18%;
  text-align: center;
}
.title-page h1 {
  margin-bottom: 0.5em;
}
.book-subtitle {
  font-size: 1.3em;
  color: #555555;
  text-indent: 0;
}
.book-author {
  margin-top: 3em;
  font-size: 1.1em;
  text-indent: 0;
}
.book-publisher {
  margin-top: 1em;
  font-size: 0.95em;
  color: #666666;
  text-indent: 0;
}
.copyright-page {
  padding-top: 12%;
}
.front-title {
  font-size: 1.4em;
  text-align: left;
  border-bottom: 1px solid ${theme.tableBorder};
  padding-bottom: 0.4em;
}
.copyright-title {
  font-size: 1.2em;
  font-weight: 600;
  text-indent: 0;
}
.copyright-rights {
  margin-top: 2em;
  color: #555555;
  text-indent: 0;
}
.synopsis-page p {
  text-indent: ${indent};
}
.chapter-synopsis {
  margin: 0 0 1.5em;
  padding: 0.6em 0.9em;
  border-left: 3px solid ${theme.tableBorder};
  color: #555555;
  font-size: 0.95em;
}
.chapter-synopsis p {
  margin-bottom: 0.4em;
}
.volume-page {
  text-align: center;
}
.volume-page-inner {
  padding-top: 28%;
}
.volume-title {
  font-size: 2.2em;
  text-align: center;
  page-break-before: auto;
  break-before: auto;
}
.toc-page nav ol {
  list-style: none;
  padding-left: 0;
  margin: 0.8em 0;
}
.toc-page nav ol ol {
  padding-left: 1.5em;
  margin: 0.3em 0;
}
.toc-page nav li {
  margin: 0.45em 0;
  text-indent: 0;
}
.toc-title {
  page-break-before: auto;
  break-before: auto;
}
`
}

function formulaRenderer(katex: {
  renderToString: (latex: string, options: Record<string, unknown>) => string
}): FormulaRenderer {
  return (latex, display) => {
    try {
      return katex.renderToString(latex, {
        output: 'mathml',
        displayMode: display,
        throwOnError: true,
      })
    } catch {
      return null
    }
  }
}

async function loadFormulaRenderer(): Promise<FormulaRenderer | undefined> {
  try {
    const katex = (await import('katex')).default
    return formulaRenderer(katex)
  } catch {
    return undefined
  }
}

function sanitizeAssetBase(asset: ExportAsset, index: number): string {
  const base = String(asset.id || asset.fileName || '')
    .replace(/\.[A-Za-z0-9]+$/, '')
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || `asset-${pad(index + 1)}`
}

function mediaTypeOf(asset: ExportAsset): string {
  const mime = String(asset.mime || '').split(';')[0].trim()
  if (mime.startsWith('image/')) return mime
  return 'image/png'
}

export async function buildEpubBook(input: BuildEpubBookInput): Promise<Blob> {
  const { book, settings, assets } = input
  const lang = book.meta.language.trim() || 'zh-CN'
  const now = input.now || new Date()
  const identifier = identifierFor(book.meta, input.randomUUID)
  const modified = modifiedTimestamp(now)

  let cover = settings.includeCover ? input.cover || null : null
  if (settings.includeCover && !cover) {
    cover = await createDefaultCover({
      title: book.meta.title,
      subtitle: book.meta.subtitle,
      author: book.meta.author,
      palette: COVER_PALETTES[settings.preset] || COVER_PALETTES.literary,
    })
  }

  const assetHrefs = new Map<ExportAsset, string>()
  const hrefAssets = new Map<string, ExportAsset>()
  let assetIndex = 0
  const hrefFor = (asset: ExportAsset): string => {
    const existing = assetHrefs.get(asset)
    if (existing) return existing
    let base = sanitizeAssetBase(asset, assetIndex)
    assetIndex += 1
    let href = `images/${base}.${imageExtension(mediaTypeOf(asset))}`
    let suffix = 1
    while (hrefAssets.has(href)) {
      suffix += 1
      href = `images/${base}-${suffix}.${imageExtension(mediaTypeOf(asset))}`
    }
    assetHrefs.set(asset, href)
    hrefAssets.set(href, asset)
    return href
  }

  const usedImages = new Set<ExportAsset>()
  const usedMermaid = new Set<ExportAsset>()
  const imageSrc = (src: string): string | null => {
    const asset = assets.images.get(src)
    if (!asset) return null
    usedImages.add(asset)
    return hrefFor(asset)
  }
  const mermaidSrc = (source: string): string | null => {
    const asset = assets.mermaid.get(source.trim())
    if (!asset) return null
    usedMermaid.add(asset)
    return hrefFor(asset)
  }

  const coverHref = cover ? hrefFor(cover) : null
  const figureNumbers = collectBookFigureNumbers(book)
  const formula = await loadFormulaRenderer()

  const chapterHrefs = new Map<string, string>()
  book.chapters.forEach((chapter, index) => {
    chapterHrefs.set(chapter.id, `chapter-${pad(index + 1)}.xhtml`)
  })
  const volumeHrefs = new Map<string, string>()
  book.volumes.forEach((volume, index) => {
    volumeHrefs.set(volume.path, `volume-${pad(index + 1)}.xhtml`)
  })

  const renderChapterBody = (chapter: BookChapter): string => {
    const rendered = renderDocXhtml(chapter.doc as XhtmlJsonNode, {
      headingOffset: 1,
      imageSrc,
      mermaidSrc,
      figureNumbers,
      formula,
    })
    return rendered
  }

  const pages: PageFile[] = []
  const navEntries: EpubNavEntry[] = []
  let renderedChapters = 0
  let chaptersSinceYield = 0
  const totalChapters = book.chapters.length

  const addChapter = async (chapter: BookChapter): Promise<EpubNavEntry> => {
    throwIfAborted(input.signal)
    const href = chapterHrefs.get(chapter.id) || `chapter-${pad(renderedChapters + 1)}.xhtml`
    const page = chapterPage(chapter, lang, renderChapterBody)
    pages.push({ ...page, id: href.replace(/\.xhtml$/, ''), href })
    renderedChapters += 1
    input.onChapter?.(renderedChapters, totalChapters)
    chaptersSinceYield += 1
    if (chaptersSinceYield % 6 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
    return { title: chapter.title, href }
  }

  const includeVolumePages = book.options.includeVolumeTitles
  const walkVolume = async (node: VolumeNode): Promise<EpubNavEntry[]> => {
    let volumeHref = ''
    if (includeVolumePages) {
      volumeHref = volumeHrefs.get(node.volume.path) || ''
      if (volumeHref) {
        const page = volumePage(node.volume)
        pages.push({ ...page, id: volumeHref.replace(/\.xhtml$/, ''), href: volumeHref })
      }
    }
    const chapterEntries: EpubNavEntry[] = []
    for (const chapter of node.volume.chapters) chapterEntries.push(await addChapter(chapter))
    const childEntries: EpubNavEntry[] = []
    for (const child of node.children) childEntries.push(...(await walkVolume(child)))
    if (includeVolumePages && volumeHref) {
      return [{ title: node.volume.title, href: volumeHref, children: [...chapterEntries, ...childEntries] }]
    }
    return [...chapterEntries, ...childEntries]
  }

  for (const chapter of book.rootChapters) navEntries.push(await addChapter(chapter))
  for (const node of volumeTree(book.volumes)) navEntries.push(...(await walkVolume(node)))

  if (pages.length === 0) throw new Error(nt('export.errorNoExportableContent'))
  throwIfAborted(input.signal)

  const frontPages: PageFile[] = []
  const coverPageFile = settings.includeCover ? coverPage(book, coverHref) : null
  if (coverPageFile) frontPages.push({ ...coverPageFile, body: pageBodyToXhtml(coverPageFile, lang) })
  const titleFile = titlePage(book)
  if (!book.standalone) frontPages.push({ ...titleFile, body: pageBodyToXhtml(titleFile, lang) })
  const copyright = copyrightPage(book)
  if (!book.standalone) frontPages.push({ ...copyright, body: pageBodyToXhtml(copyright, lang) })
  if (settings.includeSynopsisPage && book.meta.description) {
    const synopsis = synopsisPage(book)
    frontPages.push({ ...synopsis, body: pageBodyToXhtml(synopsis, lang) })
  }
  if (book.options.includeToc) {
    frontPages.push({
      id: 'toc',
      href: 'toc.xhtml',
      title: '目录',
      bodyClass: 'toc-page',
      body: buildTocPageXhtml(navEntries, lang),
    })
  }

  for (const page of pages) {
    if (!page.body.startsWith('<?xml')) page.body = pageBodyToXhtml(page, lang)
  }

  pages.splice(0, 0, ...frontPages)
  const firstTextPage = pages.find((page) => page.bodyClass === 'chapter-page')

  const frontNavEntries: EpubNavEntry[] = []
  if (coverPageFile) frontNavEntries.push({ title: '封面', href: 'cover.xhtml' })
  if (!book.standalone) {
    frontNavEntries.push({ title: '扉页', href: 'titlepage.xhtml' })
    frontNavEntries.push({ title: '版权信息', href: 'copyright.xhtml' })
  }
  if (settings.includeSynopsisPage && book.meta.description) {
    frontNavEntries.push({ title: '内容简介', href: 'synopsis.xhtml' })
  }
  if (book.options.includeToc) frontNavEntries.push({ title: '目录', href: 'toc.xhtml' })
  // Reader navigation gets the front matter; the printed 目录 page stays chapters-only.
  const allNavEntries = [...frontNavEntries, ...navEntries]

  const manifest: EpubManifestItem[] = [
    { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: 'nav' },
    { id: 'ncx', href: 'toc.ncx', mediaType: 'application/x-dtbncx+xml' },
    { id: 'style', href: 'style.css', mediaType: 'text/css' },
  ]
  for (const page of pages) {
    manifest.push({ id: page.id, href: page.href, mediaType: 'application/xhtml+xml' })
  }

  const packagedAssets = new Map<string, ExportAsset>()
  if (cover && coverHref) packagedAssets.set(coverHref, cover)
  for (const asset of usedImages) packagedAssets.set(hrefFor(asset), asset)
  for (const asset of usedMermaid) packagedAssets.set(hrefFor(asset), asset)
  const coverImageId = cover && coverHref ? 'cover-image' : undefined
  for (const [href, asset] of packagedAssets) {
    manifest.push({
      id: href === coverHref ? 'cover-image' : href.replace(/^images\//, '').replace(/\.[^.]+$/, ''),
      href,
      mediaType: mediaTypeOf(asset),
      properties: href === coverHref ? 'cover-image' : undefined,
    })
  }

  const spine: EpubSpineItem[] = pages.map((page) => ({ id: page.id }))

  const guide: EpubGuideReference[] = []
  if (coverPageFile) guide.push({ type: 'cover', title: '封面', href: 'cover.xhtml' })
  if (book.options.includeToc) guide.push({ type: 'toc', title: '目录', href: 'toc.xhtml' })
  if (firstTextPage) guide.push({ type: 'text', title: '正文', href: firstTextPage.href })

  const landmarks: { type: string; href: string; title: string }[] = []
  if (coverPageFile) landmarks.push({ type: 'cover', href: 'cover.xhtml', title: '封面' })
  if (book.options.includeToc) landmarks.push({ type: 'toc', href: 'toc.xhtml', title: '目录' })
  if (firstTextPage) landmarks.push({ type: 'bodymatter', href: firstTextPage.href, title: '正文' })

  const opf = buildContentOpf({
    metadata: {
      identifier,
      title: book.meta.title,
      subtitle: book.meta.subtitle,
      author: book.meta.author,
      language: lang,
      publisher: book.meta.publisher,
      date: book.meta.publicationDate,
      description: book.meta.description,
      subjects: book.meta.keywords,
      rights: book.meta.rights,
      modified,
    },
    manifest,
    spine,
    coverImageId,
    navId: 'nav',
    ncxId: 'ncx',
    guide,
  })

  const nav = buildNavXhtml(allNavEntries, { lang, landmarks })
  const ncx = buildTocNcx({
    identifier,
    title: book.meta.title,
    author: book.meta.author,
    language: lang,
    entries: allNavEntries,
  })

  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', buildContainerXml())
  const oebps = zip.folder('OEBPS')
  if (!oebps) throw new Error(nt('export.errorEpubDir'))
  oebps.file('content.opf', opf)
  oebps.file('nav.xhtml', nav)
  oebps.file('toc.ncx', ncx)
  oebps.file('style.css', buildEpubStyles(settings))
  for (const page of pages) oebps.file(page.href, page.body)
  for (const [href, asset] of packagedAssets) oebps.file(href, asset.bytes)

  throwIfAborted(input.signal)
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}
