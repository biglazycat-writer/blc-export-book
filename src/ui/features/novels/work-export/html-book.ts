import katex from 'katex'
import { buildEpubStyles } from './epub-book'
import { collectBookFigureNumbers, escapeXml, renderDocXhtml } from './epub-xhtml'
import { throwIfAborted } from './progress'
import type { BookAssets, ExportAsset, WorkBookModel, WorkExportSettings } from './types'

interface BuildHtmlBookInput {
  book: WorkBookModel
  settings: WorkExportSettings
  assets: BookAssets
  cover?: ExportAsset | null
  signal?: AbortSignal
  onChapter?: (done: number, total: number) => void
}

// FileReader encodes off the JS string heap, including in macOS JavaScriptCore.
function assetDataUrl(asset: ExportAsset): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error || new Error('图片编码失败'))
    reader.readAsDataURL(new Blob([asset.bytes.slice().buffer as ArrayBuffer], { type: asset.mime }))
  })
}

/** A complete offline document: CSS, pictures, diagrams and MathML stay inline. */
export async function buildHtmlBook(input: BuildHtmlBookInput): Promise<Blob> {
  const { book, settings, assets } = input
  const urls = new Map<ExportAsset, string>()
  const all = new Set([...assets.images.values(), ...assets.mermaid.values()])
  if (input.cover) all.add(input.cover)
  for (const asset of all) {
    throwIfAborted(input.signal)
    urls.set(asset, await assetDataUrl(asset))
  }
  const urlFor = (asset: ExportAsset | undefined) => asset ? urls.get(asset) || null : null
  const paragraphs = (value: string) => value.split(/\r?\n/).filter(Boolean).map(line => `<p>${escapeXml(line)}</p>`).join('\n')
  const sections: string[] = []
  if (settings.epub.includeCover) {
    sections.push(`<section class="cover">${input.cover
      ? `<img src="${escapeXml(urlFor(input.cover))}" alt="${escapeXml(book.meta.title)}"/>`
      : `<h1>${escapeXml(book.meta.title)}</h1><p>${escapeXml(book.meta.author)}</p>`}</section>`)
  }
  if (settings.content.includeSynopsis && settings.epub.includeSynopsisPage && book.meta.description) {
    sections.push(`<section class="synopsis-page"><h1>内容简介</h1>${paragraphs(book.meta.description)}</section>`)
  }
  const toc: string[] = []
  const figureNumbers = collectBookFigureNumbers(book)
  const emittedVolumes = new Set<string>()
  const volumes = new Map(book.volumes.map(volume => [volume.path, volume]))
  const emitVolume = (path: string) => {
    if (!book.options.includeVolumeTitles || emittedVolumes.has(path)) return
    const volume = volumes.get(path)
    if (!volume) return
    emittedVolumes.add(path)
    if (volume.parentPath) emitVolume(volume.parentPath)
    const id = `volume-${emittedVolumes.size}-${sections.length}`
    sections.push(`<section class="volume-page" id="${id}"><h1>${escapeXml(volume.title)}</h1></section>`)
    toc.push(`<li class="toc-volume"><a href="#${id}">${escapeXml(volume.title)}</a></li>`)
  }
  for (const [index, chapter] of book.chapters.entries()) {
    throwIfAborted(input.signal)
    if (chapter.volumePath) emitVolume(chapter.volumePath)
    const id = `chapter-${index + 1}`
    const body = renderDocXhtml(chapter.doc, {
      headingOffset: 1,
      imageSrc: src => urlFor(assets.images.get(src)),
      mermaidSrc: source => urlFor(assets.mermaid.get(source)),
      figureNumbers,
      formula: (latex, displayMode) => katex.renderToString(latex, { output: 'mathml', displayMode, throwOnError: false, trust: false }),
    })
    const synopsis = book.options.includeChapterSynopsis && chapter.synopsis
      ? `<div class="chapter-synopsis">${paragraphs(chapter.synopsis)}</div>` : ''
    sections.push(`<article class="chapter" id="${id}"><h1 class="chapter-title">${escapeXml(chapter.title)}</h1>${synopsis}${body}</article>`)
    toc.push(`<li><a href="#${id}">${escapeXml(chapter.title)}</a></li>`)
    input.onChapter?.(index + 1, book.chapters.length)
  }
  const navigation = book.options.includeToc ? `<nav class="toc-page" aria-label="目录"><h1>目录</h1><ol>${toc.join('\n')}</ol></nav>` : ''
  const css = `${buildEpubStyles(settings.epub)}
body { max-width: 52rem; margin: 0 auto; padding: 2rem; overflow-wrap: anywhere; }
.chapter, .volume-page, .cover, .synopsis-page, .toc-page { margin-bottom: 3rem; }
.toc-volume { font-weight: bold; margin-top: 1em; }
a { text-decoration: underline; }
.cover p, .synopsis-page p { text-indent: 0; }
@media (max-width: 600px) { body { padding: 1rem; } }
@media print { body { max-width: none; padding: 0; } .toc-page { break-after: page; } }
`
  const html = `<!DOCTYPE html>
<html lang="${escapeXml(book.meta.language || 'zh-CN')}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeXml(book.meta.title)}</title>
<meta name="author" content="${escapeXml(book.meta.author)}"/>
<meta name="description" content="${escapeXml(book.meta.description)}"/>
<style>${css}</style></head>
<body><main>${navigation}${sections.join('\n')}</main></body></html>`
  return new Blob([html], { type: 'text/html;charset=utf-8' })
}
