import type { WorkExportFormat } from '../../../types/models'

export type { WorkExportFormat }

export type WorkExportPaper = 'a5' | 'a4' | 'b5' | '16k'

export interface WorkExportMargins {
  top: number
  right: number
  bottom: number
  left: number
}

/** PDF margins are mirrored for print: inside is the binding side. */
export interface PdfMargins {
  top: number
  inside: number
  bottom: number
  outside: number
}

export interface WorkExportCommonSettings {
  title: string
  subtitle: string
  author: string
  language: string
  publisher: string
  isbn: string
  publicationDate: string
  description: string
  rights: string
  keywords: string
  filename: string
}

export interface WorkExportContentSettings {
  scopeType: 'all' | 'chapters'
  chapterIds: string[]
  /**
   * 手工调整过的文章顺序（章节 id 列表）。空数组表示使用默认顺序——后端返回的
   * 创建时间序。列表之外的章节按稿件原顺序排在末尾。
   */
  chapterOrder: string[]
  includeSynopsis: boolean
  includeVolumeTitles: boolean
  includeChapterSynopsis: boolean
  includeToc: boolean
  skipEmpty: boolean
}

export type PageRuleStyle = 'none' | 'solid' | 'dashed' | 'double'
export type PageBandSlot = 'left' | 'center' | 'right'
export type PageNumberFormat = 'x' | 'x-of-y' | 'page-x' | 'page-x-of-y'

/** 页眉与页脚共用的三段式布局。`{title}` 等占位符在渲染时替换。 */
export interface PageBandSettings {
  enabled: boolean
  left: string
  center: string
  right: string
  separator: PageRuleStyle
  /** 封面、扉页、版权页、目录等前置页不显示这条边栏。 */
  hideOnFrontMatter: boolean
}

export interface PageHeaderSettings extends PageBandSettings {}

export interface PageFooterSettings extends PageBandSettings {
  pageNumberPosition: PageBandSlot
  pageNumberFormat: PageNumberFormat
}

/** 封面与页眉标志图。Data URL 只保存在本次排版会话与本地设置里。 */
export interface WorkExportBrandingSettings {
  coverDataUrl: string
  coverName: string
  logoDataUrl: string
  logoHeightMm: number
}

export type EpubPresetId = 'literary' | 'modern' | 'minimal' | 'technical'

export interface EpubExportSettings {
  preset: EpubPresetId
  paragraphIndent: 0 | 2
  chapterPageBreak: boolean
  includeCover: boolean
  includeSynopsisPage: boolean
}

export type DocxPresetId = 'manuscript' | 'publish' | 'modern'

export interface DocxExportSettings {
  preset: DocxPresetId
  paper: WorkExportPaper
  marginsMm: WorkExportMargins
  bodyFont: string
  bodySizePt: number
  lineSpacing: number
  firstLineIndentChars: 0 | 2
  includeCover: boolean
  includeTitlePage: boolean
  includeCopyright: boolean
  includeToc: boolean
  header: PageHeaderSettings
  footer: PageFooterSettings
  chapterPageBreak: boolean
}

export type PdfPresetId = 'reading' | 'manuscript' | 'print'

export interface PdfExportSettings {
  preset: PdfPresetId
  paper: WorkExportPaper
  marginsMm: PdfMargins
  gutterMm: number
  bodyFont: string
  bodySizePt: number
  lineSpacing: number
  firstLineIndentChars: 0 | 2
  justify: boolean
  includeCover: boolean
  includeTitlePage: boolean
  includeCopyright: boolean
  includeToc: boolean
  header: PageHeaderSettings
  footer: PageFooterSettings
  chapterStart: 'next' | 'recto'
  includeChapterSynopsis: boolean
  watermark: string
}

export interface WorkExportSettings {
  lastFormat: WorkExportFormat
  common: WorkExportCommonSettings
  content: WorkExportContentSettings
  branding: WorkExportBrandingSettings
  epub: EpubExportSettings
  docx: DocxExportSettings
  pdf: PdfExportSettings
}

/** Stored settings migration input: every section may be a partial object. */
export interface WorkExportSettingsPatch {
  lastFormat?: WorkExportFormat
  common?: Partial<WorkExportCommonSettings>
  content?: Partial<WorkExportContentSettings>
  branding?: Partial<WorkExportBrandingSettings>
  epub?: Partial<EpubExportSettings>
  docx?: Partial<DocxExportSettings>
  pdf?: Partial<PdfExportSettings>
}

export interface WorkExportCover {
  /** Data URL as chosen by the user. Never written to localStorage. */
  dataUrl: string
  name: string
  width: number
  height: number
  warning?: string
}

export interface BookMetadata {
  title: string
  subtitle: string
  author: string
  language: string
  publisher: string
  isbn: string
  publicationDate: string
  description: string
  rights: string
  keywords: string[]
}

export interface BookContentOptions {
  includeVolumeTitles: boolean
  includeChapterSynopsis: boolean
  includeToc: boolean
}

export interface BookChapter {
  id: string
  volumePath: string
  volumeTitle: string
  title: string
  synopsis: string
  doc: Record<string, unknown>
  wordCount: number
  updatedAt: string
  empty: boolean
}

export interface BookVolume {
  path: string
  parentPath: string
  title: string
  depth: number
  chapters: BookChapter[]
}

export interface WorkBookModel {
  standalone?: boolean
  meta: BookMetadata
  options: BookContentOptions
  chapters: BookChapter[]
  volumes: BookVolume[]
  /** Root-path chapters are not assigned to any volume. */
  rootChapters: BookChapter[]
  wordCount: number
}

export interface ExportAsset {
  id: string
  fileName: string
  mime: string
  bytes: Uint8Array
  width: number
  height: number
}

export type BookAssetTarget = 'docx' | 'epub' | 'pdf' | 'html'

export interface BookAssets {
  /** Original `src` → normalized asset. */
  images: Map<string, ExportAsset>
  /** Mermaid source text → PNG asset. */
  mermaid: Map<string, ExportAsset>
  /** Formula cache key → PNG asset. */
  formulas: Map<string, ExportAsset>
  /** Every asset that must be written into the package, without duplicates. */
  all: ExportAsset[]
  warnings: string[]
}

export type WorkExportStage = 'reading' | 'assets' | 'chapters' | 'compile' | 'save'

export interface WorkExportProgressUpdate {
  stage: WorkExportStage
  percent: number
  message: string
}

export type WorkExportProgressReporter = (update: WorkExportProgressUpdate) => void
