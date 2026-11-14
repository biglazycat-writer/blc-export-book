import { nt } from '../nt'
import { createPageFooter, createPageHeader, normalizePageBand, normalizePageFooter } from './page-band'
import type {
  DocxExportSettings,
  DocxPresetId,
  EpubExportSettings,
  EpubPresetId,
  PageBandSettings,
  PageFooterSettings,
  PdfExportSettings,
  PdfMargins,
  PdfPresetId,
  WorkExportCommonSettings,
  WorkExportMargins,
  WorkExportPaper,
  WorkExportSettings,
} from './types'

export interface PaperSizeMm {
  width: number
  height: number
}

const PAPER_SIZES: Record<WorkExportPaper, PaperSizeMm> = {
  a5: { width: 148, height: 210 },
  a4: { width: 210, height: 297 },
  b5: { width: 176, height: 250 },
  '16k': { width: 185, height: 260 },
}

export function paperSizeMm(paper: WorkExportPaper): PaperSizeMm {
  return PAPER_SIZES[paper] ?? PAPER_SIZES.a4
}

export type MarginPresetId = 'compact' | 'standard' | 'loose' | 'binding'

export interface MarginPreset {
  top: number
  bottom: number
  inside: number
  outside: number
}

/** 打印边距预设：与排版工作台的四张卡片一一对应。 */
export const MARGIN_PRESETS: Record<MarginPresetId, MarginPreset> = {
  compact: { top: 10, bottom: 10, inside: 10, outside: 10 },
  standard: { top: 20, bottom: 20, inside: 15, outside: 15 },
  loose: { top: 25, bottom: 25, inside: 20, outside: 20 },
  binding: { top: 20, bottom: 20, inside: 25, outside: 15 },
}

export const MARGIN_PRESET_IDS: MarginPresetId[] = ['compact', 'standard', 'loose', 'binding']

export function marginPresetId(margins: PdfMargins | WorkExportMargins): MarginPresetId | null {
  const inside = 'inside' in margins ? margins.inside : margins.left
  const outside = 'outside' in margins ? margins.outside : margins.right
  for (const id of MARGIN_PRESET_IDS) {
    const preset = MARGIN_PRESETS[id]
    if (
      preset.top === margins.top &&
      preset.bottom === margins.bottom &&
      preset.inside === inside &&
      preset.outside === outside
    ) {
      return id
    }
  }
  return null
}

export function todayISODate(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function defaultRights(author: string, year = new Date().getFullYear()): string {
  const name = author.trim()
  return name ? nt('rights.withAuthor', { year, name }) : nt('rights.default', { year })
}

export type EpubThemeLabelKey = 'themes.literary' | 'themes.modern' | 'themes.minimal' | 'themes.technical'

export interface EpubTheme {
  id: EpubPresetId
  /** 主题名与描述是 i18n 键，取词交给渲染方（模块常量会把语言冻结在加载那一刻）。 */
  labelKey: EpubThemeLabelKey
  descriptionKey: `${EpubThemeLabelKey}Desc`
  fontFamily: string
  headingFontFamily: string
  lineHeight: number
  textIndent: string
  paragraphSpacing: string
  headingAlign: 'left' | 'center'
  headingWeight: number
  codeBackground: string
  tableBorder: string
}

export const EPUB_THEMES: Record<EpubPresetId, EpubTheme> = {
  literary: {
    id: 'literary',
    labelKey: 'themes.literary',
    descriptionKey: 'themes.literaryDesc',
    fontFamily: '"Songti SC", "SimSun", "Noto Serif CJK SC", serif',
    headingFontFamily: '"Songti SC", "SimSun", serif',
    lineHeight: 1.8,
    textIndent: '2em',
    paragraphSpacing: '0',
    headingAlign: 'center',
    headingWeight: 700,
    codeBackground: '#f5f5f5',
    tableBorder: '#cfcfcf',
  },
  modern: {
    id: 'modern',
    labelKey: 'themes.modern',
    descriptionKey: 'themes.modernDesc',
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
    headingFontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    lineHeight: 1.7,
    textIndent: '0',
    paragraphSpacing: '0.8em',
    headingAlign: 'left',
    headingWeight: 650,
    codeBackground: '#f3f4f6',
    tableBorder: '#d4d4d8',
  },
  minimal: {
    id: 'minimal',
    labelKey: 'themes.minimal',
    descriptionKey: 'themes.minimalDesc',
    fontFamily: '"Songti SC", "SimSun", serif',
    headingFontFamily: '"Songti SC", "SimSun", serif',
    lineHeight: 1.9,
    textIndent: '0',
    paragraphSpacing: '0',
    headingAlign: 'left',
    headingWeight: 600,
    codeBackground: '#fafafa',
    tableBorder: '#dddddd',
  },
  technical: {
    id: 'technical',
    labelKey: 'themes.technical',
    descriptionKey: 'themes.technicalDesc',
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
    headingFontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    lineHeight: 1.65,
    textIndent: '0',
    paragraphSpacing: '0.6em',
    headingAlign: 'left',
    headingWeight: 650,
    codeBackground: '#eef1f5',
    tableBorder: '#c9ced6',
  },
}

export const EPUB_PRESET_IDS: EpubPresetId[] = ['literary', 'modern', 'minimal', 'technical']

export function applyEpubPreset(preset: EpubPresetId): EpubExportSettings {
  return {
    preset,
    paragraphIndent: preset === 'literary' ? 2 : 0,
    chapterPageBreak: true,
    includeCover: true,
    includeSynopsisPage: true,
  }
}

export interface DocxPresetDefaults extends DocxExportSettings {}

const DOCX_PRESETS: Record<DocxPresetId, Omit<DocxExportSettings, 'preset'>> = {
  manuscript: {
    paper: 'a4',
    marginsMm: { top: 25, right: 25, bottom: 25, left: 25 },
    bodyFont: '宋体',
    bodySizePt: 12,
    lineSpacing: 1.5,
    firstLineIndentChars: 2,
    includeCover: false,
    includeTitlePage: true,
    includeCopyright: true,
    includeToc: true,
    header: createPageHeader(false),
    footer: createPageFooter(true, { pageNumberFormat: 'page-x', pageNumberPosition: 'center' }),
    chapterPageBreak: true,
  },
  publish: {
    paper: 'b5',
    marginsMm: { top: 22, right: 18, bottom: 20, left: 22 },
    bodyFont: '宋体',
    bodySizePt: 10.5,
    lineSpacing: 1.75,
    firstLineIndentChars: 2,
    includeCover: true,
    includeTitlePage: true,
    includeCopyright: true,
    includeToc: true,
    header: createPageHeader(true, {
      left: '{title}',
      right: '{author}',
      separator: 'solid',
    }),
    footer: createPageFooter(true, { pageNumberFormat: 'page-x', pageNumberPosition: 'center' }),
    chapterPageBreak: true,
  },
  modern: {
    paper: 'a4',
    marginsMm: { top: 22, right: 22, bottom: 22, left: 22 },
    bodyFont: '微软雅黑',
    bodySizePt: 11,
    lineSpacing: 1.5,
    firstLineIndentChars: 0,
    includeCover: false,
    includeTitlePage: true,
    includeCopyright: true,
    includeToc: true,
    header: createPageHeader(true, { left: '{title}', separator: 'solid' }),
    footer: createPageFooter(true, { pageNumberFormat: 'x-of-y', pageNumberPosition: 'center' }),
    chapterPageBreak: true,
  },
}

export const DOCX_PRESET_IDS: DocxPresetId[] = ['manuscript', 'publish', 'modern']

export const DOCX_PRESET_LABELS: Record<DocxPresetId, { labelKey: 'docxPresets.manuscript' | 'docxPresets.publish' | 'docxPresets.modern'; descriptionKey: `${'docxPresets.manuscript' | 'docxPresets.publish' | 'docxPresets.modern'}Desc` }> = {
  manuscript: { labelKey: 'docxPresets.manuscript', descriptionKey: 'docxPresets.manuscriptDesc' },
  publish: { labelKey: 'docxPresets.publish', descriptionKey: 'docxPresets.publishDesc' },
  modern: { labelKey: 'docxPresets.modern', descriptionKey: 'docxPresets.modernDesc' },
}

export function applyDocxPreset(preset: DocxPresetId): DocxExportSettings {
  return { preset, ...cloneDocxPreset(DOCX_PRESETS[preset] ?? DOCX_PRESETS.manuscript) }
}

function cloneDocxPreset(value: Omit<DocxExportSettings, 'preset'>): Omit<DocxExportSettings, 'preset'> {
  return {
    ...value,
    marginsMm: { ...value.marginsMm },
    header: { ...value.header },
    footer: { ...value.footer },
  }
}

const DOCX_FONT_CHOICES = ['宋体', '微软雅黑', '思源宋体', '黑体']

export function docxFontChoices(): string[] {
  return [...DOCX_FONT_CHOICES]
}

export interface PdfPresetDefaults extends PdfExportSettings {}

const PDF_PRESETS: Record<PdfPresetId, Omit<PdfExportSettings, 'preset'>> = {
  reading: {
    paper: 'a5',
    marginsMm: { top: 18, inside: 20, bottom: 18, outside: 16 },
    gutterMm: 0,
    bodyFont: 'Noto Serif SC',
    bodySizePt: 10.5,
    lineSpacing: 1.7,
    firstLineIndentChars: 2,
    justify: true,
    includeCover: true,
    includeTitlePage: true,
    includeCopyright: true,
    includeToc: true,
    header: createPageHeader(true, { left: '{title}', separator: 'solid' }),
    footer: createPageFooter(true, { pageNumberFormat: 'x', pageNumberPosition: 'center' }),
    chapterStart: 'next',
    includeChapterSynopsis: false,
    watermark: '',
  },
  manuscript: {
    paper: 'a4',
    marginsMm: { top: 25, inside: 25, bottom: 25, outside: 25 },
    gutterMm: 0,
    bodyFont: 'Noto Serif SC',
    bodySizePt: 12,
    lineSpacing: 1.5,
    firstLineIndentChars: 2,
    justify: true,
    includeCover: false,
    includeTitlePage: true,
    includeCopyright: true,
    includeToc: true,
    header: createPageHeader(false),
    footer: createPageFooter(true, { pageNumberFormat: 'page-x', pageNumberPosition: 'center' }),
    chapterStart: 'next',
    includeChapterSynopsis: false,
    watermark: '',
  },
  print: {
    paper: '16k',
    marginsMm: { top: 20, inside: 22, bottom: 20, outside: 18 },
    gutterMm: 5,
    bodyFont: 'Noto Serif SC',
    bodySizePt: 10.5,
    lineSpacing: 1.75,
    firstLineIndentChars: 2,
    justify: true,
    includeCover: true,
    includeTitlePage: true,
    includeCopyright: true,
    includeToc: true,
    header: createPageHeader(true, { right: '{title}', separator: 'solid' }),
    footer: createPageFooter(true, { pageNumberFormat: 'page-x-of-y', pageNumberPosition: 'center' }),
    chapterStart: 'recto',
    includeChapterSynopsis: false,
    watermark: '',
  },
}

export const PDF_PRESET_IDS: PdfPresetId[] = ['reading', 'manuscript', 'print']

export const PDF_PRESET_LABELS: Record<PdfPresetId, { labelKey: 'pdfPresets.reading' | 'pdfPresets.manuscript' | 'pdfPresets.print'; descriptionKey: `${'pdfPresets.reading' | 'pdfPresets.manuscript' | 'pdfPresets.print'}Desc` }> = {
  reading: { labelKey: 'pdfPresets.reading', descriptionKey: 'pdfPresets.readingDesc' },
  manuscript: { labelKey: 'pdfPresets.manuscript', descriptionKey: 'pdfPresets.manuscriptDesc' },
  print: { labelKey: 'pdfPresets.print', descriptionKey: 'pdfPresets.printDesc' },
}

export function applyPdfPreset(preset: PdfPresetId): PdfExportSettings {
  const source = PDF_PRESETS[preset] ?? PDF_PRESETS.reading
  return {
    preset,
    ...source,
    marginsMm: { ...source.marginsMm },
    header: { ...source.header },
    footer: { ...source.footer },
  }
}

export interface WorkExportDefaultsInput {
  title: string
  synopsis?: string
  author?: string
  standalone?: boolean
  today?: string
}

export function createDefaultWorkExportSettings(input: WorkExportDefaultsInput): WorkExportSettings {
  const title = input.title.trim() || nt('unnamed.content')
  const author = (input.author || '').trim()
  const publicationDate = input.today || todayISODate()
  return {
    lastFormat: input.standalone ? 'pdf' : 'epub',
    common: {
      title,
      subtitle: '',
      author,
      language: 'zh-CN',
      publisher: '',
      isbn: '',
      publicationDate,
      description: input.synopsis || '',
      rights: defaultRights(author, Number(publicationDate.slice(0, 4)) || new Date().getFullYear()),
      keywords: '',
      filename: title,
    },
    content: {
      scopeType: 'all',
      chapterIds: [],
      chapterOrder: [],
      includeSynopsis: true,
      includeVolumeTitles: true,
      includeChapterSynopsis: false,
      includeToc: true,
      skipEmpty: false,
    },
    branding: {
      coverDataUrl: '',
      coverName: '',
      logoDataUrl: '',
      logoHeightMm: 8,
    },
    epub: applyEpubPreset('literary'),
    docx: applyDocxPreset('manuscript'),
    pdf: applyPdfPreset('reading'),
  }
}

export function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export function normalizeDocxSettings(settings: DocxExportSettings): DocxExportSettings {
  const papers: WorkExportPaper[] = ['a4', 'b5', '16k']
  const clampMargin = (value: number) => clampNumber(Math.round(value), 10, 50, 25)
  return {
    ...settings,
    paper: papers.includes(settings.paper) ? settings.paper : 'a4',
    marginsMm: {
      top: clampMargin(settings.marginsMm.top),
      right: clampMargin(settings.marginsMm.right),
      bottom: clampMargin(settings.marginsMm.bottom),
      left: clampMargin(settings.marginsMm.left),
    },
    bodySizePt: clampNumber(settings.bodySizePt, 9, 16, 12),
    lineSpacing: clampNumber(settings.lineSpacing, 1.2, 2.2, 1.5),
    firstLineIndentChars: settings.firstLineIndentChars === 2 ? 2 : 0,
    header: normalizePageBand(settings.header),
    footer: normalizePageFooter(settings.footer),
  }
}

export function pdfBodyFontName(value: string | undefined): string {
  const name = (value || '').trim()
  if (!name || name.length > 80 || /["\\\u0000-\u001f]/u.test(name)) return 'Noto Serif SC'
  return name
}

export function normalizePdfSettings(settings: PdfExportSettings): PdfExportSettings {
  const papers: WorkExportPaper[] = ['a5', 'a4', 'b5', '16k']
  const clampMargin = (value: number) => clampNumber(Math.round(value), 10, 50, 20)
  return {
    ...settings,
    paper: papers.includes(settings.paper) ? settings.paper : 'a5',
    marginsMm: {
      top: clampMargin(settings.marginsMm.top),
      inside: clampMargin(settings.marginsMm.inside),
      bottom: clampMargin(settings.marginsMm.bottom),
      outside: clampMargin(settings.marginsMm.outside),
    },
    gutterMm: clampNumber(Math.round(settings.gutterMm), 0, 20, 0),
    bodyFont: pdfBodyFontName(settings.bodyFont),
    bodySizePt: clampNumber(settings.bodySizePt, 9, 16, 10.5),
    lineSpacing: clampNumber(settings.lineSpacing, 1.2, 2.2, 1.7),
    firstLineIndentChars: settings.firstLineIndentChars === 2 ? 2 : 0,
    header: normalizePageBand(settings.header),
    footer: normalizePageFooter(settings.footer),
  }
}

function sameMargins(a: WorkExportMargins | PdfMargins, b: WorkExportMargins | PdfMargins): boolean {
  const left = a as unknown as Record<string, number>
  const right = b as unknown as Record<string, number>
  return Object.keys(right).every((key) => left[key] === right[key])
}

function sameBand(left: PageBandSettings, right: PageBandSettings): boolean {
  return (
    left.enabled === right.enabled &&
    left.left === right.left &&
    left.center === right.center &&
    left.right === right.right &&
    left.separator === right.separator &&
    left.hideOnFrontMatter === right.hideOnFrontMatter
  )
}

function sameFooter(left: PageFooterSettings, right: PageFooterSettings): boolean {
  return (
    sameBand(left, right) &&
    left.pageNumberPosition === right.pageNumberPosition &&
    left.pageNumberFormat === right.pageNumberFormat
  )
}

export function isDocxPresetModified(settings: DocxExportSettings): boolean {
  const preset = applyDocxPreset(settings.preset)
  return (
    settings.paper !== preset.paper ||
    !sameMargins(settings.marginsMm, preset.marginsMm) ||
    settings.bodyFont !== preset.bodyFont ||
    settings.bodySizePt !== preset.bodySizePt ||
    settings.lineSpacing !== preset.lineSpacing ||
    settings.firstLineIndentChars !== preset.firstLineIndentChars ||
    !sameBand(settings.header, preset.header) ||
    !sameFooter(settings.footer, preset.footer)
  )
}

export function isPdfPresetModified(settings: PdfExportSettings): boolean {
  const preset = applyPdfPreset(settings.preset)
  return (
    settings.paper !== preset.paper ||
    !sameMargins(settings.marginsMm, preset.marginsMm) ||
    settings.gutterMm !== preset.gutterMm ||
    settings.bodySizePt !== preset.bodySizePt ||
    settings.lineSpacing !== preset.lineSpacing ||
    settings.firstLineIndentChars !== preset.firstLineIndentChars ||
    settings.justify !== preset.justify ||
    !sameBand(settings.header, preset.header) ||
    !sameFooter(settings.footer, preset.footer)
  )
}

export function isEpubPresetModified(settings: EpubExportSettings): boolean {
  const preset = applyEpubPreset(settings.preset)
  return settings.paragraphIndent !== preset.paragraphIndent
}

export function parseKeywords(raw: string): string[] {
  return String(raw || '')
    .split(/[,，;；、]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function isValidPublicationDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function normalizeIsbn(raw: string): string {
  return String(raw || '')
    .replace(/[\s-]/g, '')
    .toUpperCase()
}

/** ISBN-10 checksum allows X as the check digit; ISBN-13 uses a weighted sum. */
export function isValidIsbn(raw: string): boolean {
  const isbn = normalizeIsbn(raw)
  if (!isbn) return false
  if (isbn.length === 10) {
    if (!/^\d{9}[\dX]$/.test(isbn)) return false
    let sum = 0
    for (let i = 0; i < 10; i += 1) {
      const value = isbn[i] === 'X' ? 10 : Number(isbn[i])
      sum += value * (10 - i)
    }
    return sum % 11 === 0
  }
  if (isbn.length === 13) {
    if (!/^\d{13}$/.test(isbn)) return false
    let sum = 0
    for (let i = 0; i < 12; i += 1) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3)
    return (10 - (sum % 10)) % 10 === Number(isbn[12])
  }
  return false
}

export type WorkExportValidation = {
  errors: Partial<Record<'title' | 'author' | 'isbn' | 'publicationDate' | 'keywords' | 'chapters', string>>
  warnings: string[]
}

export function validateWorkExportSettings(
  common: WorkExportCommonSettings,
  chapterCount: number,
): WorkExportValidation {
  const errors: WorkExportValidation['errors'] = {}
  const warnings: string[] = []
  const title = common.title.trim()
  if (!title) errors.title = nt('validation.titleRequired')
  else if (Array.from(title).length > 120) errors.title = nt('validation.titleTooLong')
  if (Array.from(common.author.trim()).length > 80) errors.author = nt('validation.authorTooLong')
  if (common.isbn.trim() && !isValidIsbn(common.isbn)) errors.isbn = nt('validation.isbnInvalid')
  if (!isValidPublicationDate(common.publicationDate)) errors.publicationDate = nt('validation.dateInvalid')
  const keywords = parseKeywords(common.keywords)
  if (keywords.some((item) => Array.from(item).length > 40)) errors.keywords = nt('validation.keywordTooLong')
  if (chapterCount < 1) errors.chapters = nt('validation.chaptersRequired')
  if (!common.author.trim()) warnings.push(nt('validation.authorMissing'))
  return { errors, warnings }
}

export function estimatePageCount(wordCount: number, charsPerPage: number): number {
  if (!Number.isFinite(wordCount) || wordCount <= 0) return 0
  return Math.max(1, Math.ceil(wordCount / Math.max(120, charsPerPage)))
}
