import { storedDocFromRaw } from '../../../lib/content-model'
import type {
  WorkExportChapter,
  WorkExportManuscript,
  WorkExportScope,
} from '../../../types/models'
import { parseKeywords } from './presets'
import { nt } from '../nt'
import type {
  BookChapter,
  BookMetadata,
  BookVolume,
  WorkBookModel,
  WorkExportCommonSettings,
  WorkExportContentSettings,
} from './types'

type JsonNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: JsonNode[]
}

const CONTENT_NODE_TYPES = new Set([
  'image',
  'resizableImage',
  'table',
  'formula',
  'flowCanvas',
  'mindMapEmbed',
])

export function jsonText(node: JsonNode | null | undefined): string {
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  return (node.content || []).map(jsonText).join('')
}

export function isJsonDocEmpty(doc: JsonNode | null | undefined): boolean {
  if (!doc) return true
  const walk = (node: JsonNode): boolean => {
    if (node.type && CONTENT_NODE_TYPES.has(node.type)) return true
    if (node.type === 'codeBlock' && jsonText(node).trim()) return true
    if (typeof node.text === 'string' && node.text.trim()) return true
    return (node.content || []).some(walk)
  }
  return !walk(doc)
}

/**
 * Chapter numbers are written in the chapter title ("11 动手") but usually not
 * in the body's repeated H1 ("动手"), so the comparison ignores a leading
 * ordinal: digits or Chinese numerals, an optional 章/节/回 unit, and any
 * separator that follows.
 */
const LEADING_ORDINAL =
  /^(?:第?[0-9零一二三四五六七八九十百千两]+[章节回卷篇话集部]?|[（(][0-9]+[)）])[、.．,，:：·・\-—\s]*/

function collapseTitle(value: string): string {
  return value.replace(/[\s\u3000]+/g, '').trim()
}

function normalizeTitle(value: string): string {
  return collapseTitle(value).replace(LEADING_ORDINAL, '').trim()
}

/**
 * Two titles name the same chapter when they match once the numbering is
 * dropped. A title that is nothing but its number ("第一章") normalizes to an
 * empty string, so that case falls back to a plain text comparison instead of
 * matching every other numbered title.
 */
function sameTitle(left: string, right: string): boolean {
  const a = normalizeTitle(left)
  const b = normalizeTitle(right)
  if (a && b) return a === b
  return collapseTitle(left) === collapseTitle(right)
}

/**
 * Leading spaces a plain-text novel uses as a manual indent: the ideographic
 * space (U+3000) Chinese typesetting uses, the no-break and en/em space family,
 * tab and ASCII space.
 */
const LEADING_INDENT_SPACES = /^[\u3000\u00a0\u2002-\u200a\t ]+/

/**
 * Drop the manual first-line indent a paragraph carries in its own text.
 *
 * Chinese plain-text novels write the indent into the body as two ideographic
 * spaces. Every renderer also applies the export's own first-line indent, so
 * keeping both makes the setting unusable: 2 characters renders as four, and 0
 * still renders as two. The indent setting is the one typographic authority, so
 * the literal spaces are removed here: once, for EPUB, PDF and Word alike.
 *
 * Only paragraphs are touched. A code block's leading spaces are its content.
 */
export function stripManualFirstLineIndent(
  doc: Record<string, unknown>,
): Record<string, unknown> {
  const content = Array.isArray(doc.content) ? (doc.content as JsonNode[]) : null
  if (!content) return doc
  let changed = false
  const next = content.map((node) => {
    if (node?.type !== 'paragraph' || !Array.isArray(node.content)) return node
    const [first, ...rest] = node.content
    if (!first || first.type !== 'text' || typeof first.text !== 'string') return node
    const text = first.text.replace(LEADING_INDENT_SPACES, '')
    if (text === first.text) return node
    changed = true
    // A paragraph of nothing but indent spaces keeps an empty text node out of
    // the document, which would make some readers drop the paragraph entirely.
    if (!text && rest.length === 0) return { ...node, content: [] }
    return { ...node, content: [{ ...first, text }, ...rest] }
  })
  return changed ? { ...doc, content: next } : doc
}

/**
 * Drop a leading H1 that repeats the chapter title. Older chapters often saved
 * the title into the body as well; printing both is the most visible export bug.
 */
export function stripDuplicateLeadingHeading(
  doc: Record<string, unknown>,
  title: string,
): Record<string, unknown> {
  const content = Array.isArray(doc.content) ? (doc.content as JsonNode[]) : []
  const first = content[0]
  if (!first || first.type !== 'heading') return doc
  if (!sameTitle(jsonText(first), title)) return doc
  return { ...doc, content: content.slice(1) }
}

export function metadataFromSettings(common: WorkExportCommonSettings, fallbackTitle: string): BookMetadata {
  const title = common.title.trim() || fallbackTitle.trim() || nt('unnamed.content')
  return {
    title,
    subtitle: common.subtitle.trim(),
    author: common.author.trim(),
    language: common.language.trim() || 'zh-CN',
    publisher: common.publisher.trim(),
    isbn: common.isbn.trim(),
    publicationDate: common.publicationDate.trim(),
    description: common.description.trim(),
    rights: common.rights.trim(),
    keywords: parseKeywords(common.keywords),
  }
}

function chapterFromSource(
  chapter: WorkExportChapter,
  volumeTitle: string,
  options: Pick<WorkExportContentSettings, 'includeChapterSynopsis'>,
): BookChapter {
  const title = chapter.title.trim() || nt('unnamed.chapter')
  const doc = stripManualFirstLineIndent(
    stripDuplicateLeadingHeading(storedDocFromRaw(chapter.content), title),
  )
  return {
    id: chapter.id,
    volumePath: chapter.volume_path || '',
    volumeTitle,
    title,
    synopsis: options.includeChapterSynopsis ? chapter.synopsis.trim() : '',
    doc,
    wordCount: chapter.word_count,
    updatedAt: chapter.updated_at,
    empty: isJsonDocEmpty(doc),
  }
}

function volumeDepth(path: string, parentPath: string): number {
  if (!path) return -1
  if (parentPath) return parentPath.split('/').length
  return path.split('/').length - 1
}

export interface BuildWorkBookOptions {
  manuscript: WorkExportManuscript
  common: WorkExportCommonSettings
  content: WorkExportContentSettings
}

/**
 * Apply the hand-tuned article order. Chapters named in the list come first, in
 * list order; chapters the list does not mention (created after the last
 * adjustment, or stale ids) keep the manuscript order behind them. An empty
 * list is the default: the manuscript's own order, which the backend builds as
 * creation time.
 */
export function applyChapterOrder<T extends { id: string }>(chapters: readonly T[], order: readonly string[]): T[] {
  if (order.length === 0 || chapters.length < 2) return [...chapters]
  const rank = new Map<string, number>()
  order.forEach((id, index) => {
    if (!rank.has(id)) rank.set(id, index)
  })
  const ordered = chapters.filter((chapter) => rank.has(chapter.id))
    .sort((a, b) => (rank.get(a.id) as number) - (rank.get(b.id) as number))
  const rest = chapters.filter((chapter) => !rank.has(chapter.id))
  return [...ordered, ...rest]
}

export function buildWorkBook({ manuscript, common, content }: BuildWorkBookOptions): WorkBookModel {
  const volumeTitles = new Map<string, string>()
  const volumeParents = new Map<string, string>()
  for (const volume of manuscript.volumes) {
    volumeTitles.set(volume.path, volume.title.trim() || nt('unnamed.category'))
    volumeParents.set(volume.path, volume.parent_path || '')
  }

  const sourceChapters = applyChapterOrder(
    manuscript.chapters
      .map((chapter) =>
        chapterFromSource(chapter, volumeTitles.get(chapter.volume_path) || nt('manuscript.rootVolume'), content),
      )
      .filter((chapter) => !(content.skipEmpty && chapter.empty)),
    content.chapterOrder,
  )

  if (sourceChapters.length === 0) {
    throw new Error(nt('export.errorNoExportableContent'))
  }

  // 分类标题跟随内容：一个分类的位置 = 它（含子分类）第一篇文章在最终顺序里
  // 的位置。默认顺序下这与后端的分类分组一致，只有手工调整过顺序时才会重排。
  const firstAppearance = new Map<string, number>()
  for (let index = sourceChapters.length - 1; index >= 0; index--) {
    const volumePath = sourceChapters[index].volumePath
    if (volumePath) firstAppearance.set(volumePath, index)
  }
  const appearanceOf = (volumePath: string): number => {
    let min = firstAppearance.get(volumePath) ?? Number.POSITIVE_INFINITY
    const prefix = `${volumePath}/`
    for (const [path, index] of firstAppearance) {
      if (path.startsWith(prefix) && index < min) min = index
    }
    return min
  }
  const orderedVolumes = manuscript.volumes
    .map((volume, index) => ({ volume, index, key: volume.path ? appearanceOf(volume.path) : index }))
    .sort((a, b) => a.key - b.key || a.index - b.index)

  const volumes: BookVolume[] = []
  for (const { volume } of orderedVolumes) {
    if (!volume.path) continue
    const chapters = sourceChapters.filter((chapter) => chapter.volumePath === volume.path)
    if (chapters.length === 0 && !sourceChapters.some(chapter => chapter.volumePath.startsWith(`${volume.path}/`))) continue
    const entry: BookVolume = {
      path: volume.path,
      parentPath: volume.parent_path || '',
      title: volumeTitles.get(volume.path) || volume.title || nt('unnamed.category'),
      depth: volumeDepth(volume.path, volumeParents.get(volume.path) || ''),
      chapters,
    }
    volumes.push(entry)
  }

  const rootChapters = sourceChapters.filter((chapter) => !chapter.volumePath)
  const wordCount = sourceChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0)

  return {
    standalone: manuscript.workspace_kind === 'standalone',
    meta: metadataFromSettings(common, manuscript.title),
    options: {
      includeVolumeTitles: content.includeVolumeTitles,
      includeChapterSynopsis: content.includeChapterSynopsis,
      includeToc: content.includeToc,
    },
    chapters: sourceChapters,
    volumes,
    rootChapters,
    wordCount,
  }
}

export function scopeFromContent(content: WorkExportContentSettings): WorkExportScope {
  if (content.scopeType === 'chapters') {
    return { type: 'chapters', chapter_ids: [...content.chapterIds] }
  }
  return { type: 'all' }
}

export function chapterIdsOfManuscript(manuscript: WorkExportManuscript): string[] {
  return manuscript.chapters.map((chapter) => chapter.id)
}

/** First non-empty text, for the live preview and for test fixtures. */
export function docPreviewText(doc: JsonNode | null | undefined, limit = 160): string {
  if (!doc) return ''
  const blocks = (doc.content || [])
    .filter((node) => node.type === 'paragraph' || node.type === 'heading')
    .map((node) => jsonText(node).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return blocks.join(' ').slice(0, limit)
}
