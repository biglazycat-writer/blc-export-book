import {
  applyDocxPreset,
  applyEpubPreset,
  applyPdfPreset,
  createDefaultWorkExportSettings,
  normalizeDocxSettings,
  normalizePdfSettings,
  type WorkExportDefaultsInput,
} from './presets'
import { PAGE_NUMBER_FORMATS, PAGE_NUMBER_POSITIONS, PAGE_RULE_STYLES } from './page-band'
import type {
  DocxExportSettings,
  EpubExportSettings,
  PageBandSettings,
  PageBandSlot,
  PageFooterSettings,
  PageNumberFormat,
  PageRuleStyle,
  PdfExportSettings,
  WorkExportBrandingSettings,
  WorkExportCommonSettings,
  WorkExportContentSettings,
  WorkExportFormat,
  WorkExportSettings,
  WorkExportSettingsPatch,
} from './types'

export const WORK_EXPORT_SETTINGS_KEY = 'blc.workExportSettings.v1'
export const WORK_EXPORT_AUTHOR_KEY = 'blc.workExportAuthor'
export const MAX_STORED_WORK_EXPORTS = 50

interface StoredEntry {
  updatedAt: number
  /**
   * The collection title at the time these settings were saved. A collection is
   * renamed on disk, so the stored book title may simply be out of date; this
   * record is what tells an untouched default apart from a title the user typed.
   */
  sourceTitle?: string
  settings: WorkExportSettings
}

interface StoredShape {
  version: 1
  entries: Record<string, StoredEntry>
}

function getStorage(storage?: Storage): Storage | null {
  if (storage) return storage
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readShape(storage?: Storage): StoredShape {
  const target = getStorage(storage)
  if (!target) return { version: 1, entries: {} }
  try {
    const raw = target.getItem(WORK_EXPORT_SETTINGS_KEY)
    if (!raw) return { version: 1, entries: {} }
    const parsed = JSON.parse(raw) as Partial<StoredShape>
    if (!parsed || parsed.version !== 1 || !parsed.entries || typeof parsed.entries !== 'object') {
      return { version: 1, entries: {} }
    }
    return { version: 1, entries: parsed.entries }
  } catch {
    return { version: 1, entries: {} }
  }
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function validFormat(value: unknown, fallback: WorkExportFormat): WorkExportFormat {
  return value === 'epub' || value === 'docx' || value === 'pdf' || value === 'html' ? value : fallback
}

function mergeCommon(
  value: Partial<WorkExportCommonSettings> | undefined,
  defaults: WorkExportCommonSettings,
): WorkExportCommonSettings {
  const source = value || {}
  return {
    title: text(source.title, defaults.title),
    subtitle: text(source.subtitle, defaults.subtitle),
    author: text(source.author, defaults.author),
    language: text(source.language, defaults.language),
    publisher: text(source.publisher, defaults.publisher),
    isbn: text(source.isbn, defaults.isbn),
    publicationDate: text(source.publicationDate, defaults.publicationDate),
    description: text(source.description, defaults.description),
    rights: text(source.rights, defaults.rights),
    keywords: text(source.keywords, defaults.keywords),
    filename: text(source.filename, defaults.filename),
  }
}

function mergeContent(
  value: Partial<WorkExportContentSettings> | undefined,
  defaults: WorkExportContentSettings,
): WorkExportContentSettings {
  const source = value || {}
  return {
    scopeType: source.scopeType === 'chapters' ? 'chapters' : 'all',
    chapterIds: Array.isArray(source.chapterIds)
      ? source.chapterIds.filter((id): id is string => typeof id === 'string')
      : [],
    chapterOrder: Array.isArray(source.chapterOrder)
      ? source.chapterOrder.filter((id): id is string => typeof id === 'string')
      : [],
    includeSynopsis: bool(source.includeSynopsis, defaults.includeSynopsis),
    includeVolumeTitles: bool(source.includeVolumeTitles, defaults.includeVolumeTitles),
    includeChapterSynopsis: bool(source.includeChapterSynopsis, defaults.includeChapterSynopsis),
    includeToc: bool(source.includeToc, defaults.includeToc),
    skipEmpty: bool(source.skipEmpty, defaults.skipEmpty),
  }
}

function mergeBranding(
  value: Partial<WorkExportBrandingSettings> | undefined,
  defaults: WorkExportBrandingSettings,
): WorkExportBrandingSettings {
  const source = value || {}
  return {
    coverDataUrl: text(source.coverDataUrl, defaults.coverDataUrl),
    coverName: text(source.coverName, defaults.coverName),
    logoDataUrl: text(source.logoDataUrl, defaults.logoDataUrl),
    logoHeightMm:
      typeof source.logoHeightMm === 'number' && Number.isFinite(source.logoHeightMm)
        ? Math.min(24, Math.max(4, source.logoHeightMm))
        : defaults.logoHeightMm,
  }
}

function mergeBand(
  value: Partial<PageBandSettings> | undefined,
  defaults: PageBandSettings,
): PageBandSettings {
  const source = value || {}
  const separator = PAGE_RULE_STYLES.includes(source.separator as PageRuleStyle)
    ? (source.separator as PageRuleStyle)
    : defaults.separator
  return {
    enabled: bool(source.enabled, defaults.enabled),
    left: text(source.left, defaults.left),
    center: text(source.center, defaults.center),
    right: text(source.right, defaults.right),
    separator,
    hideOnFrontMatter: bool(source.hideOnFrontMatter, defaults.hideOnFrontMatter),
  }
}

function mergeFooter(
  value: Partial<PageFooterSettings> | undefined,
  defaults: PageFooterSettings,
): PageFooterSettings {
  const base = mergeBand(value, defaults)
  const source = value || {}
  return {
    ...base,
    pageNumberPosition: PAGE_NUMBER_POSITIONS.includes(source.pageNumberPosition as PageBandSlot)
      ? (source.pageNumberPosition as PageBandSlot)
      : defaults.pageNumberPosition,
    pageNumberFormat: PAGE_NUMBER_FORMATS.includes(source.pageNumberFormat as PageNumberFormat)
      ? (source.pageNumberFormat as PageNumberFormat)
      : defaults.pageNumberFormat,
  }
}

function mergeEpub(
  value: Partial<EpubExportSettings> | undefined,
  defaults: EpubExportSettings,
): EpubExportSettings {
  const source = value || {}
  const preset =
    source.preset === 'modern' || source.preset === 'minimal' || source.preset === 'technical'
      ? source.preset
      : source.preset === 'literary'
        ? 'literary'
        : defaults.preset
  const base = source.preset ? applyEpubPreset(preset) : defaults
  return {
    ...base,
    paragraphIndent: source.paragraphIndent === 2 ? 2 : source.paragraphIndent === 0 ? 0 : base.paragraphIndent,
    chapterPageBreak: bool(source.chapterPageBreak, base.chapterPageBreak),
    includeCover: bool(source.includeCover, base.includeCover),
    includeSynopsisPage: bool(source.includeSynopsisPage, base.includeSynopsisPage),
  }
}

function mergeDocx(
  value: Partial<DocxExportSettings> | undefined,
  defaults: DocxExportSettings,
): DocxExportSettings {
  const source = value || {}
  const preset =
    source.preset === 'manuscript' || source.preset === 'publish' || source.preset === 'modern'
      ? source.preset
      : defaults.preset
  const base = source.preset ? applyDocxPreset(preset) : defaults
  return normalizeDocxSettings({
    ...base,
    paper: source.paper ?? base.paper,
    marginsMm: { ...base.marginsMm, ...(source.marginsMm || {}) },
    bodyFont: text(source.bodyFont, base.bodyFont),
    bodySizePt: typeof source.bodySizePt === 'number' ? source.bodySizePt : base.bodySizePt,
    lineSpacing: typeof source.lineSpacing === 'number' ? source.lineSpacing : base.lineSpacing,
    firstLineIndentChars:
      source.firstLineIndentChars === 0 || source.firstLineIndentChars === 2
        ? source.firstLineIndentChars
        : base.firstLineIndentChars,
    includeCover: bool(source.includeCover, base.includeCover),
    includeTitlePage: bool(source.includeTitlePage, base.includeTitlePage),
    includeCopyright: bool(source.includeCopyright, base.includeCopyright),
    includeToc: bool(source.includeToc, base.includeToc),
    header: mergeBand(source.header, base.header),
    footer: mergeFooter(source.footer, base.footer),
    chapterPageBreak: bool(source.chapterPageBreak, base.chapterPageBreak),
  })
}

function mergePdf(
  value: Partial<PdfExportSettings> | undefined,
  defaults: PdfExportSettings,
): PdfExportSettings {
  const source = value || {}
  const preset =
    source.preset === 'reading' || source.preset === 'manuscript' || source.preset === 'print'
      ? source.preset
      : defaults.preset
  const base = source.preset ? applyPdfPreset(preset) : defaults
  return normalizePdfSettings({
    ...base,
    paper: source.paper ?? base.paper,
    marginsMm: { ...base.marginsMm, ...(source.marginsMm || {}) },
    gutterMm: typeof source.gutterMm === 'number' ? source.gutterMm : base.gutterMm,
    bodyFont: typeof source.bodyFont === 'string' ? source.bodyFont : base.bodyFont,
    bodySizePt: typeof source.bodySizePt === 'number' ? source.bodySizePt : base.bodySizePt,
    lineSpacing: typeof source.lineSpacing === 'number' ? source.lineSpacing : base.lineSpacing,
    firstLineIndentChars:
      source.firstLineIndentChars === 0 || source.firstLineIndentChars === 2
        ? source.firstLineIndentChars
        : base.firstLineIndentChars,
    justify: bool(source.justify, base.justify),
    includeCover: bool(source.includeCover, base.includeCover),
    includeTitlePage: bool(source.includeTitlePage, base.includeTitlePage),
    includeCopyright: bool(source.includeCopyright, base.includeCopyright),
    includeToc: bool(source.includeToc, base.includeToc),
    header: mergeBand(source.header, base.header),
    footer: mergeFooter(source.footer, base.footer),
    chapterStart:
      source.chapterStart === 'next' || source.chapterStart === 'recto'
        ? source.chapterStart
        : base.chapterStart,
    includeChapterSynopsis: bool(source.includeChapterSynopsis, base.includeChapterSynopsis),
    watermark: text(source.watermark, base.watermark),
  })
}

export function mergeWorkExportSettings(
  stored: WorkExportSettingsPatch | undefined,
  defaults: WorkExportSettings,
): WorkExportSettings {
  return {
    lastFormat: validFormat(stored?.lastFormat, defaults.lastFormat),
    common: mergeCommon(stored?.common, defaults.common),
    content: mergeContent(stored?.content, defaults.content),
    branding: mergeBranding(stored?.branding, defaults.branding),
    epub: mergeEpub(stored?.epub, defaults.epub),
    docx: mergeDocx(stored?.docx, defaults.docx),
    pdf: mergePdf(stored?.pdf, defaults.pdf),
  }
}

/** Drop chapter ids that no longer exist; a fully stale custom scope falls back to all. */
export function filterStaleChapterSelection(
  settings: WorkExportSettings,
  availableChapterIds: Iterable<string>,
): WorkExportSettings {
  const available = new Set(availableChapterIds)
  const selected = settings.content.chapterIds.filter((id) => available.has(id))
  const ordered = settings.content.chapterOrder.filter((id) => available.has(id))
  if (settings.content.scopeType === 'chapters' && selected.length === 0) {
    return { ...settings, content: { ...settings.content, scopeType: 'all', chapterIds: [], chapterOrder: ordered } }
  }
  if (selected.length === settings.content.chapterIds.length && ordered.length === settings.content.chapterOrder.length) {
    return settings
  }
  return { ...settings, content: { ...settings.content, chapterIds: selected, chapterOrder: ordered } }
}

export function loadWorkExportSettings(
  novelId: string,
  defaultsInput: WorkExportDefaultsInput,
  storage?: Storage,
): WorkExportSettings {
  const defaults = createDefaultWorkExportSettings(defaultsInput)
  const entry = readShape(storage).entries[novelId]
  const merged = mergeWorkExportSettings(entry?.settings, defaults)
  if (!entry) return merged
  const currentTitle = defaults.common.title
  // Entries written before the source title was recorded only carry the book
  // title they saved, so that is the best available hint of the old default.
  const storedTitle = typeof entry.settings.common?.title === 'string'
    ? entry.settings.common.title.trim()
    : ''
  const sourceTitle = (entry.sourceTitle || storedTitle).trim()
  // The title and the default file name belong to the collection, whose only
  // name is its folder. They follow a rename unless the user typed a different
  // value into the export dialog, which must survive the rename.
  const followRename = (value: string) => value.trim() === sourceTitle ? currentTitle : value
  return {
    ...merged,
    common: {
      ...merged.common,
      title: followRename(merged.common.title),
      filename: followRename(merged.common.filename),
    },
  }
}

export function saveWorkExportSettings(
  novelId: string,
  settings: WorkExportSettings,
  sourceTitle: string,
  storage?: Storage,
): boolean {
  const target = getStorage(storage)
  if (!target) return false
  const shape = readShape(storage)
  shape.entries[novelId] = { updatedAt: Date.now(), sourceTitle: sourceTitle.trim(), settings }
  const kept = Object.entries(shape.entries)
    .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_STORED_WORK_EXPORTS)
  shape.entries = Object.fromEntries(kept)
  try {
    target.setItem(WORK_EXPORT_SETTINGS_KEY, JSON.stringify(shape))
    return true
  } catch {
    return false
  }
}

export function getLastWorkExportAuthor(storage?: Storage): string {
  const target = getStorage(storage)
  if (!target) return ''
  try {
    return (target.getItem(WORK_EXPORT_AUTHOR_KEY) || '').trim()
  } catch {
    return ''
  }
}

export function setLastWorkExportAuthor(author: string, storage?: Storage): void {
  const target = getStorage(storage)
  if (!target) return
  try {
    target.setItem(WORK_EXPORT_AUTHOR_KEY, author.trim())
  } catch {
    // A full quota must not break an export.
  }
}
