import { exportApi } from '../../../bridge/export-api'
import type { WorkExportFormat, WorkExportManuscript } from '../../../types/models'
import { nt } from '../nt'
import { prepareBookAssets, type ImageProfile } from './assets'
import { buildDocxBook } from './docx-book'
import { buildEpubBook } from './epub-book'
import { exportFileName } from './file-name'
import { buildWorkBook, scopeFromContent } from './manuscript'
import { buildPdfBook } from './pdf-book'
import { createStageReporter, throwIfAborted } from './progress'
import type {
  BookAssetTarget,
  BookAssets,
  ExportAsset,
  WorkBookModel,
  WorkExportProgressReporter,
  WorkExportSettings,
} from './types'

/** Injectable source reader for the plugin export pipeline. */
export interface WorkExportBridge {
  loadWorkExportManuscript: typeof exportApi.loadWorkExportManuscript
  readImageAsDataURL: (src: string) => Promise<string>
}

function resolveBridge(bridge?: Partial<WorkExportBridge>): WorkExportBridge {
  return {
    loadWorkExportManuscript: bridge?.loadWorkExportManuscript || exportApi.loadWorkExportManuscript,
    readImageAsDataURL: bridge?.readImageAsDataURL || exportApi.readImageAsDataURL,
  }
}

export interface LoadWorkExportBookInput {
  novelId: string
  manuscript?: WorkExportManuscript
  settings: WorkExportSettings
  signal?: AbortSignal
  report?: WorkExportProgressReporter
  bridge?: Partial<WorkExportBridge>
}

export interface LoadedWorkExportBook {
  manuscript: WorkExportManuscript
  book: WorkBookModel
}

/**
 * Read the manuscript and turn it into the book model. The studio caches this
 * per scope: metadata edits reuse it, and only a scope change reloads the disk.
 */
export async function loadWorkExportBook(input: LoadWorkExportBookInput): Promise<LoadedWorkExportBook> {
  const { settings, novelId } = input
  const report = input.report || (() => undefined)
  const stage = createStageReporter(report)
  const bridge = resolveBridge(input.bridge)

  stage.stage('reading', nt('export.readingChapters'))
  const source = input.manuscript || await bridge.loadWorkExportManuscript(novelId, scopeFromContent(settings.content))
  const selected = new Set(settings.content.chapterIds)
  const manuscript = settings.content.scopeType === 'chapters'
    ? { ...source, chapters: source.chapters.filter(chapter => selected.has(chapter.id)) }
    : source
  throwIfAborted(input.signal)

  const book = buildWorkBook({ manuscript, common: settings.common, content: settings.content })
  const { resolveEmbeddedResources } = await import('../../../lib/embedded-resource-export')
  for (const chapter of book.chapters) {
    throwIfAborted(input.signal)
    try {
      chapter.doc = await resolveEmbeddedResources(chapter.doc)
    } catch (error) {
      throw new Error(nt('export.embeddedResourceFailed', { title: chapter.title, error: error instanceof Error ? error.message : String(error) }))
    }
  }
  return { manuscript, book }
}

/**
 * Rebuild the book model from the cached manuscript after a metadata/content
 * change. The resolved chapter docs are carried over, so only the scope
 * selection waits for a fresh disk read.
 */
export function rebuildWorkBook(loaded: LoadedWorkExportBook, settings: WorkExportSettings): WorkBookModel {
  const book = buildWorkBook({
    manuscript: loaded.manuscript,
    common: settings.common,
    content: settings.content,
  })
  const docs = new Map(loaded.book.chapters.map((chapter) => [chapter.id, chapter.doc]))
  for (const chapter of book.chapters) {
    const doc = docs.get(chapter.id)
    if (doc) chapter.doc = doc
  }
  return book
}

export interface PrepareWorkExportAssetsInput {
  book: WorkBookModel
  target: BookAssetTarget
  imageProfile?: ImageProfile
  signal?: AbortSignal
  report?: WorkExportProgressReporter
  bridge?: Partial<WorkExportBridge>
}

export async function prepareWorkExportAssets(input: PrepareWorkExportAssetsInput): Promise<BookAssets> {
  const report = input.report || (() => undefined)
  const stage = createStageReporter(report)
  stage.stage('assets', nt('export.processingAssetsShort'))
  const assets = await prepareBookAssets(input.book.chapters, {
    target: input.target,
    imageProfile: input.imageProfile,
    readImage: resolveBridge(input.bridge).readImageAsDataURL,
    onProgress: (done, total) => stage.step('assets', done, total),
  })
  throwIfAborted(input.signal)
  return assets
}

export interface RenderWorkExportInput {
  book: WorkBookModel
  settings: WorkExportSettings
  assets: BookAssets
  cover?: ExportAsset | null
  logo?: { asset: ExportAsset; heightMm: number } | null
  format?: WorkExportFormat
  signal?: AbortSignal
  report?: WorkExportProgressReporter
}

/** Render the PDF bytes consumed by the document preview. */
export async function renderWorkExportPdfBytes(input: RenderWorkExportInput): Promise<Uint8Array> {
  const { book, settings, assets } = input
  const report = input.report || (() => undefined)
  const stage = createStageReporter(report)
  stage.stage('chapters', nt('export.layingOutFirst', { total: book.chapters.length }))
  const bytes = await buildPdfBook({
    book,
    settings: settings.pdf,
    assets,
    cover: input.cover || null,
    logo: input.logo || undefined,
    includeSynopsis: settings.content.includeSynopsis,
    signal: input.signal,
    onChapter: (done, total) => stage.step('chapters', done, total),
    onCompile: () => stage.stage('compile', nt('export.compilingPdf')),
  })
  throwIfAborted(input.signal)
  return bytes
}

/** Render one format from an already prepared book and asset set. */
export async function renderWorkExportBlob(input: RenderWorkExportInput): Promise<Blob> {
  const { book, settings, assets } = input
  const format = input.format || settings.lastFormat
  const report = input.report || (() => undefined)
  const stage = createStageReporter(report)

  if (format === 'pdf') {
    const bytes = await renderWorkExportPdfBytes(input)
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    stage.stage('save', nt('export.waitingSave'))
    return new Blob([buffer], { type: 'application/pdf' })
  }

  stage.stage('chapters', nt('export.layingOutFirst', { total: book.chapters.length }))
  const onChapter = (done: number, total: number) => stage.step('chapters', done, total)
  const cover = input.cover || null

  let blob: Blob
  if (format === 'docx') {
    blob = await buildDocxBook({
      book,
      settings: settings.docx,
      assets,
      cover: cover || undefined,
      logo: input.logo || undefined,
      onChapter,
    })
  } else if (format === 'html') {
    const { buildHtmlBook } = await import('./html-book')
    blob = await buildHtmlBook({ book, settings, assets, cover, onChapter, signal: input.signal })
  } else {
    blob = await buildEpubBook({
      book,
      settings: settings.epub,
      assets,
      cover,
      onChapter,
      signal: input.signal,
    })
  }
  throwIfAborted(input.signal)

  stage.stage('save', nt('export.waitingSave'))
  return blob
}

export function workExportFilename(settings: WorkExportSettings, format?: WorkExportFormat): string {
  return exportFileName(settings.common.filename || settings.common.title, format || settings.lastFormat)
}
