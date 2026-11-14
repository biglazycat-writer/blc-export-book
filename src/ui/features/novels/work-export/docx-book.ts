import {
  AlignmentType,
  BookmarkEnd,
  BookmarkStart,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  InternalHyperlink,
  LeaderType,
  LevelFormat,
  NumberFormat,
  PageNumber,
  PageReference,
  Packer,
  Paragraph,
  Run,
  SectionType,
  Tab,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  XmlAttributeComponent,
  XmlComponent,
} from 'docx'
import type {
  ISectionOptions,
  ParagraphChild,
} from 'docx'
import type { DocxStyleTemplate as Template } from '../../../lib/docx-templates'
import {
  renderDocxBlock,
  withDocxBookRenderContext,
} from '../../../lib/export-utils'
import type { DocxFormulaImage } from '../../../lib/export-utils'
import { collectJsonFigureNumbers } from '../../../lib/figure-caption'
import type { MermaidPng } from '../../../lib/mermaid-render'
import type {
  BookMetadata,
  DocxExportSettings,
  ExportAsset,
  PageBandSettings,
  PageRuleStyle,
  WorkBookModel,
} from './types'
import { bandSlotTemplates, parseBandTemplate, type BandSlotTemplates } from './page-band'
import { bytesToDataUrl } from './assets'
import { paperSizeMm } from './presets'

type JsonNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: JsonNode[]
  marks?: { type?: string; attrs?: Record<string, unknown> }[]
}

type AdapterMark = { type: { name: string }; attrs: Record<string, unknown> }

type AdapterNode = {
  type: { name: string; create: (attrs: Record<string, unknown>, content: AdapterNode[]) => AdapterNode }
  attrs: Record<string, unknown>
  content: AdapterNode[]
  childCount: number
  firstChild: AdapterNode | null
  isText: boolean
  text: string
  textContent: string
  marks: AdapterMark[]
  json: JsonNode
  forEach: (fn: (node: AdapterNode, offset: number, index: number) => void) => void
  descendants: (fn: (node: AdapterNode, pos: number) => boolean | void) => void
}

type ImageSize = { width: number; height: number }

const TWIPS_PER_MM = 1440 / 25.4
const PX_PER_MM = 96 / 25.4

class RawAttributes extends XmlAttributeComponent<Record<string, string>> {}

class FieldChar extends XmlComponent {
  constructor(type: 'begin' | 'separate' | 'end', dirty = false) {
    super('w:fldChar')
    this.root.push(
      new RawAttributes({
        'w:fldCharType': type,
        ...(dirty ? { 'w:dirty': 'true' } : {}),
      }),
    )
  }
}

class InstructionText extends XmlComponent {
  constructor(instruction: string) {
    super('w:instrText')
    this.root.push(new RawAttributes({ 'xml:space': 'preserve' }))
    this.root.push(instruction)
  }
}

function mmToTwips(mm: number): number {
  return Math.round(mm * TWIPS_PER_MM)
}

function mmToPx(mm: number): number {
  return Math.round(mm * PX_PER_MM)
}

function positiveNumber(value: unknown, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

/**
 * ProseMirror-shaped view over stored JSON.
 *
 * The chapter DOCX exporter already knows how to turn a document tree into
 * paragraphs, tables and image runs. Reusing it is cheaper and far less risky
 * than writing a second renderer, so the book exporter only supplies the
 * ProseMirror surface those functions actually touch.
 */
function toAdapter(json: JsonNode, imageSizes: Map<string, ImageSize>): AdapterNode {
  const typeName = json.type || 'unknown'
  const isText = typeName === 'text'
  let attrs: Record<string, unknown> = json.attrs || {}
  if (typeName === 'image' || typeName === 'resizableImage') {
    const src = typeof attrs.src === 'string' ? attrs.src : ''
    const size = imageSizes.get(src)
    attrs = {
      ...attrs,
      width: positiveNumber(attrs.width, size?.width || 0) || undefined,
      height: positiveNumber(attrs.height, size?.height || 0) || undefined,
    }
  }

  const content = (json.content || []).map((child) => toAdapter(child, imageSizes))
  const marks: AdapterMark[] = (json.marks || []).map((mark) => ({
    type: { name: mark.type || '' },
    attrs: mark.attrs || {},
  }))

  let textContent = isText ? json.text || '' : ''
  if (!isText) {
    for (const child of content) textContent += child.textContent
  }

  const node: AdapterNode = {
    type: {
      name: typeName,
      create(nextAttrs: Record<string, unknown>, nextContent: AdapterNode[]) {
        return toAdapter(
          {
            type: typeName,
            attrs: { ...attrs, ...nextAttrs },
            content: nextContent.map((child) => child.json),
            marks: json.marks,
          },
          imageSizes,
        )
      },
    },
    attrs,
    content,
    childCount: content.length,
    firstChild: content[0] || null,
    isText,
    text: isText ? json.text || '' : '',
    textContent,
    marks,
    json,
    forEach(fn) {
      content.forEach((child, index) => fn(child, 0, index))
    },
    descendants(fn) {
      const walk = (parent: AdapterNode): void => {
        for (const child of parent.content) {
          if (fn(child, 0) !== false) walk(child)
        }
      }
      walk(node)
    },
  }
  return node
}

function bookTemplate(settings: DocxExportSettings): Template {
  const bodySize = Math.round(settings.bodySizePt * 2)
  const indent = settings.firstLineIndentChars > 0 ? bodySize * 10 * settings.firstLineIndentChars : 0
  return {
    id: 'book',
    name: '合集',
    description: '',
    headingFont: settings.bodyFont,
    bodyFont: settings.bodyFont,
    headingSizes: {
      h1: Math.round(bodySize * 1.75),
      h2: Math.round(bodySize * 1.4),
      h3: Math.round(bodySize * 1.15),
    },
    bodySize,
    lineSpacing: Math.round(240 * settings.lineSpacing),
    paragraphSpacing: indent > 0 ? 0 : 120,
    firstLineIndent: indent,
    headingColor: '111111',
    bodyColor: '1A1A1A',
  }
}

function spacerParagraphs(count: number, template: Template): Paragraph[] {
  return Array.from(
    { length: count },
    () => new Paragraph({ children: [new TextRun({ text: '', font: template.bodyFont, size: template.bodySize })] }),
  )
}

function textParagraph(
  text: string,
  template: Template,
  options: { size?: number; bold?: boolean; color?: string; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; pageBreakBefore?: boolean; spacingAfter?: number; italics?: boolean; outlineLevel?: number } = {},
): Paragraph {
  return new Paragraph({
    pageBreakBefore: options.pageBreakBefore,
    alignment: options.alignment,
    outlineLevel: options.outlineLevel,
    spacing: { after: options.spacingAfter ?? 120 },
    children: [
      new TextRun({
        text,
        font: template.bodyFont,
        size: options.size || template.bodySize,
        bold: options.bold,
        italics: options.italics,
        color: options.color,
      }),
    ],
  })
}

function metadataParagraphs(book: WorkBookModel, template: Template, pageBreakBefore: boolean): Paragraph[] {
  const { meta } = book
  const paragraphs: Paragraph[] = []
  const add = (text: string, options: Parameters<typeof textParagraph>[2] = {}) => {
    paragraphs.push(
      textParagraph(text, template, {
        ...options,
        alignment: AlignmentType.CENTER,
        pageBreakBefore: paragraphs.length === 0 ? pageBreakBefore : false,
      }),
    )
  }

  add('', { size: template.bodySize })
  add('', { size: template.bodySize })
  add('', { size: template.bodySize })
  add('', { size: template.bodySize })
  add('', { size: template.bodySize })
  // The title page is the book-title entry in Word's 导航窗格.
  add(meta.title, { size: Math.round(template.bodySize * 2.2), bold: true, spacingAfter: 240, outlineLevel: 0 })
  if (meta.subtitle) add(meta.subtitle, { size: Math.round(template.bodySize * 1.25), color: '555555', spacingAfter: 360 })
  if (meta.author) add(meta.author, { size: Math.round(template.bodySize * 1.1), spacingAfter: 120 })
  add('', { size: template.bodySize })
  add('', { size: template.bodySize })
  add('', { size: template.bodySize })
  add('', { size: template.bodySize })
  add('大懒猫创作平台', { size: 20, color: '888888' })
  if (meta.publicationDate) add(meta.publicationDate, { size: 20, color: '888888' })
  return paragraphs
}

function textCoverParagraphs(book: WorkBookModel, template: Template): Paragraph[] {
  const { meta } = book
  const paragraphs = spacerParagraphs(10, template)
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: meta.title,
          font: template.headingFont,
          size: Math.round(template.bodySize * 2.4),
          bold: true,
          color: '111111',
        }),
      ],
    }),
  )
  if (meta.subtitle) {
    paragraphs.push(
      textParagraph(meta.subtitle, template, {
        size: Math.round(template.bodySize * 1.2),
        color: '555555',
        alignment: AlignmentType.CENTER,
        spacingAfter: 480,
      }),
    )
  }
  if (meta.author) {
    paragraphs.push(
      textParagraph(meta.author, template, {
        size: Math.round(template.bodySize * 1.1),
        alignment: AlignmentType.CENTER,
        spacingAfter: 120,
      }),
    )
  }
  paragraphs.push(...spacerParagraphs(6, template))
  paragraphs.push(
    textParagraph('大懒猫创作平台', template, {
      size: 20,
      color: '888888',
      alignment: AlignmentType.CENTER,
    }),
  )
  return paragraphs
}

function copyrightParagraphs(book: WorkBookModel, template: Template): Paragraph[] {
  const { meta } = book
  const paragraphs = spacerParagraphs(4, template)
  paragraphs.push(
    textParagraph('版权信息', template, {
      size: Math.round(template.bodySize * 1.4),
      bold: true,
      alignment: AlignmentType.CENTER,
      spacingAfter: 300,
      outlineLevel: 0,
    }),
  )
  paragraphs.push(...spacerParagraphs(2, template))
  const add = (text: string, size = template.bodySize, color?: string, bold?: boolean) => {
    paragraphs.push(
      textParagraph(text, template, {
        size,
        color,
        bold,
        alignment: AlignmentType.CENTER,
        spacingAfter: 180,
      }),
    )
  }

  add(meta.title, Math.round(template.bodySize * 1.5), undefined, true)
  if (meta.author) add(meta.author, Math.round(template.bodySize * 1.05))
  paragraphs.push(...spacerParagraphs(2, template))
  if (meta.publisher) add(`出版方：${meta.publisher}`, template.bodySize, '444444')
  if (meta.isbn) add(`ISBN ${meta.isbn}`, template.bodySize, '444444')
  if (meta.publicationDate) add(`出版日期：${meta.publicationDate}`, template.bodySize, '444444')
  if (meta.rights) add(meta.rights, Math.round(template.bodySize * 0.95), '666666')
  return paragraphs
}

function synopsisParagraphs(book: WorkBookModel, template: Template, pageBreakBefore: boolean): Paragraph[] {
  const text = book.meta.description.trim()
  if (!text) return []
  const paragraphs: Paragraph[] = [
    new Paragraph({
      pageBreakBefore,
      alignment: AlignmentType.CENTER,
      outlineLevel: 0,
      spacing: { before: 240, after: 360 },
      children: [
        new TextRun({
          text: '内容简介',
          font: template.headingFont,
          size: Math.round(template.bodySize * 1.5),
          bold: true,
          color: '111111',
        }),
      ],
    }),
  ]
  for (const line of text.split(/\n+/).map((item) => item.trim()).filter(Boolean)) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: template.lineSpacing, after: 160 },
        indent: template.firstLineIndent > 0 ? { firstLine: template.firstLineIndent } : undefined,
        children: [
          new TextRun({
            text: line,
            font: template.bodyFont,
            size: template.bodySize,
            color: template.bodyColor,
          }),
        ],
      }),
    )
  }
  return paragraphs
}

/**
 * Bookmark name for a TOC target. A Word bookmark name takes no spaces and no
 * Chinese, so the name is built from a position rather than from the title.
 */
function chapterAnchor(index: number): string {
  return `chapter_${index + 1}`
}

/**
 * Bookmark ids must be unique across the document. Deriving the number from the
 * anchor name keeps the ranges apart without another running counter.
 */
function bookmarkId(anchor: string): number {
  const match = /^(volume|chapter)_(\d+)$/.exec(anchor)
  const index = Number(match?.[2] || 1)
  return match?.[1] === 'volume' ? index * 2 - 1 : index * 2
}

function bookmarkRange(anchor: string, children: ParagraphChild[]): ParagraphChild[] {
  const id = bookmarkId(anchor)
  return [
    // Paragraph accepts every XmlComponent at runtime; the public child type
    // only lists the runs and hyperlinks.
    new BookmarkStart(anchor, id) as unknown as ParagraphChild,
    ...children,
    new BookmarkEnd(id) as unknown as ParagraphChild,
  ]
}

/**
 * Anchor per category, keyed by its path.
 *
 * Deriving the name from the path rather than from a running counter means the
 * table of contents and the body cannot drift apart: both ask this map.
 */
function volumeAnchors(book: WorkBookModel): Map<string, string> {
  const anchors = new Map<string, string>()
  for (const chapter of book.chapters) {
    if (!chapter.volumePath || anchors.has(chapter.volumePath)) continue
    anchors.set(chapter.volumePath, `volume_${anchors.size + 1}`)
  }
  return anchors
}

/**
 * The entries of the table of contents, in the order the body renders them.
 *
 * Volumes own the chapters that name them, so one walk over the chapter list
 * produces both levels: the list is already in body order.
 */
type TocEntry = { title: string; anchor: string; level: 1 | 2 }

function tocEntries(book: WorkBookModel, hasVolumePages: boolean): TocEntry[] {
  const anchors = volumeAnchors(book)
  const entries: TocEntry[] = []
  let lastVolumePath: string | null = null
  book.chapters.forEach((chapter, chapterIndex) => {
    if (hasVolumePages && chapter.volumePath && chapter.volumePath !== lastVolumePath) {
      entries.push({
        title: chapter.volumeTitle || '正文',
        anchor: anchors.get(chapter.volumePath) || '',
        level: 1,
      })
    }
    lastVolumePath = chapter.volumePath
    entries.push({
      title: chapter.title,
      anchor: chapterAnchor(chapterIndex),
      level: hasVolumePages ? 2 : 1,
    })
  })
  return entries
}

function tocEntryParagraph(entry: TocEntry, tabPosition: number): Paragraph {
  return new Paragraph({
    style: entry.level === 1 ? 'TOC1' : 'TOC2',
    tabStops: [
      { type: TabStopType.RIGHT, position: tabPosition, leader: LeaderType.DOT },
    ],
    children: [
      new InternalHyperlink({
        anchor: entry.anchor,
        children: [
          new TextRun({ text: entry.title }),
          new Run({ children: [new Tab()] }),
          // The page number is a field, not literal text: Word fills it in on
          // 更新域, and 只更新页码 updates these references in place.
          new PageReference(entry.anchor, { hyperlink: true }),
        ],
      }),
    ],
  })
}

/**
 * A real Word table of contents: a multi-paragraph `TOC` field with a cached
 * result, written the same way Word writes it.
 *
 * The field is what Word owns — right-click 更新域, F9 or 更新目录 rebuilds it
 * from the Heading 1/2 paragraphs and fills in the page numbers; `w:dirty` and
 * `w:updateFields` ask for that refresh on open. The cached entries keep the
 * page readable in viewers that do not update fields, and stay clickable
 * because every entry links to its bookmark.
 *
 * The page numbers cannot be known before Word paginates the document, so the
 * cache leaves them to the PAGEREF fields instead of printing invented values.
 */
function tableOfContents(
  book: WorkBookModel,
  hasVolumePages: boolean,
  tabPosition: number,
): Paragraph[] {
  const entries = tocEntries(book, hasVolumePages)
  // No \u switch: front matter uses direct outline levels for the 导航窗格;
  // including outline levels here would also pull it into the printed 目录.
  const instruction = ` TOC \\o "1-${hasVolumePages ? 2 : 1}" \\h \\z `
  if (entries.length === 0) {
    return [
      new Paragraph({
        children: [
          new Run({
            children: [
              new FieldChar('begin', true),
              new InstructionText(instruction),
              new FieldChar('separate'),
              new FieldChar('end'),
            ],
          }),
        ],
      }),
    ]
  }

  const paragraphs = entries.map((entry) => tocEntryParagraph(entry, tabPosition))
  paragraphs[0].addRunToFront(new Run({ children: [new FieldChar('separate')] }))
  paragraphs[0].addRunToFront(new Run({ children: [new InstructionText(instruction)] }))
  paragraphs[0].addRunToFront(new Run({ children: [new FieldChar('begin', true)] }))
  paragraphs[paragraphs.length - 1].addChildElement(
    new Run({ children: [new FieldChar('end')] }),
  )
  return paragraphs
}

/** The 目录 page: a centred title, then the field. */
function tocParagraphs(
  book: WorkBookModel,
  template: Template,
  hasVolumePages: boolean,
  pageBreakBefore: boolean,
  tabPosition: number,
): Paragraph[] {
  return [
    new Paragraph({
      pageBreakBefore,
      alignment: AlignmentType.CENTER,
      outlineLevel: 0,
      spacing: { before: 240, after: 360 },
      children: [
        new TextRun({
          text: '目录',
          font: template.headingFont,
          size: Math.round(template.bodySize * 1.6),
          bold: true,
          color: '111111',
        }),
      ],
    }),
    ...tableOfContents(book, hasVolumePages, tabPosition),
  ]
}

function volumePage(
  title: string,
  template: Template,
  startPage: boolean,
  anchor: string,
): Paragraph[] {
  const paragraphs: Paragraph[] = []
  const first = new Paragraph({
    pageBreakBefore: startPage,
    children: [new TextRun({ text: '', font: template.bodyFont, size: template.bodySize })],
  })
  paragraphs.push(first)
  paragraphs.push(...spacerParagraphs(7, template))
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 360 },
      // The bookmark is what the table of contents links to.
      children: bookmarkRange(anchor, [
        new TextRun({
          text: title,
          font: template.headingFont,
          size: Math.round(template.bodySize * 2),
          bold: true,
          color: '111111',
        }),
      ]),
    }),
  )
  paragraphs.push(...spacerParagraphs(4, template))
  return paragraphs
}

function chapterTitleParagraph(
  title: string,
  template: Template,
  hasVolumes: boolean,
  pageBreakBefore: boolean,
  anchor: string,
): Paragraph {
  return new Paragraph({
    heading: hasVolumes ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1,
    pageBreakBefore,
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 300 },
    // The bookmark is what the table of contents links to.
    children: bookmarkRange(anchor, [
      new TextRun({
        text: title,
        font: template.headingFont,
        size: hasVolumes ? template.headingSizes.h2 : template.headingSizes.h1,
        bold: true,
        color: template.headingColor || '111111',
      }),
    ]),
  })
}

function chapterSynopsisParagraph(text: string, template: Template): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 360 },
    children: [
      new TextRun({
        text,
        font: template.bodyFont,
        size: Math.max(18, template.bodySize - 2),
        italics: true,
        color: '666666',
      }),
    ],
  })
}

function imageType(mime: string): 'png' | 'jpg' | 'gif' {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/gif') return 'gif'
  return 'png'
}

function coverSection(cover: ExportAsset, settings: DocxExportSettings) {
  const paper = paperSizeMm(settings.paper)
  const pageWidth = mmToPx(paper.width)
  const pageHeight = mmToPx(paper.height)
  const scale = Math.min(pageWidth / cover.width, pageHeight / cover.height)
  const width = Math.max(1, Math.round(cover.width * scale))
  const height = Math.max(1, Math.round(cover.height * scale))

  return {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        size: { width: mmToTwips(paper.width), height: mmToTwips(paper.height) },
        margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0 },
      },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            data: cover.bytes,
            transformation: { width, height },
            type: imageType(cover.mime),
          }),
        ],
      }),
    ],
  }
}

const noBandBorder = { style: BorderStyle.NONE, size: 0, color: 'auto' }

function docxBandBorder(style: PageRuleStyle) {
  if (style === 'none') return noBandBorder
  return {
    style:
      style === 'dashed'
        ? BorderStyle.DASHED
        : style === 'double'
          ? BorderStyle.DOUBLE
          : BorderStyle.SINGLE,
    size: style === 'double' ? 6 : 4,
    color: 'D0D0D0',
    space: 1,
  }
}

function bandTableBorders(style: PageRuleStyle, kind: 'header' | 'footer') {
  const edge = docxBandBorder(style)
  return {
    top: kind === 'footer' ? edge : noBandBorder,
    bottom: kind === 'header' ? edge : noBandBorder,
    left: noBandBorder,
    right: noBandBorder,
    insideHorizontal: noBandBorder,
    insideVertical: noBandBorder,
  }
}

function bandRunChildren(
  template: string,
  meta: BookMetadata,
  font: string,
): ParagraphChild[] {
  return parseBandTemplate(template, meta).map((segment) => {
    if (segment.kind === 'text') {
      return new TextRun({ text: segment.text, font, size: 18, color: '888888' })
    }
    return new TextRun({
      children: [segment.kind === 'page' ? PageNumber.CURRENT : PageNumber.TOTAL_PAGES],
      font,
      size: 18,
      color: '888888',
    })
  })
}

function logoRun(logo: NonNullable<BuildDocxBookInput['logo']>): ImageRun {
  const height = Math.max(1, Math.round(logo.heightMm * 96 / 25.4))
  const width = Math.max(1, Math.round(height * logo.asset.width / Math.max(1, logo.asset.height)))
  return new ImageRun({
    data: logo.asset.bytes,
    transformation: { width, height },
    type: imageType(logo.asset.mime),
  })
}

function bandTable(
  band: PageBandSettings,
  kind: 'header' | 'footer',
  slots: BandSlotTemplates,
  meta: BookMetadata,
  settings: DocxExportSettings,
  logo?: BuildDocxBookInput['logo'],
): Table | null {
  const logoMarkup = kind === 'header' && logo ? logoRun(logo) : null
  const empty =
    !slots.left.trim() && !slots.center.trim() && !slots.right.trim() && !logoMarkup
  if (empty) return null

  const paper = paperSizeMm(settings.paper)
  const contentTwips = mmToTwips(
    Math.max(40, paper.width - settings.marginsMm.left - settings.marginsMm.right),
  )
  const columnTwips = Math.floor(contentTwips / 3)
  const columnWidths = [columnTwips, columnTwips, contentTwips - columnTwips * 2]
  const slotsOrder: Array<keyof BandSlotTemplates> = ['left', 'center', 'right']

  const cell = (slot: keyof BandSlotTemplates, width: number) => {
    const children: ParagraphChild[] = []
    if (slot === 'left' && logoMarkup) children.push(logoMarkup)
    if (slot === 'left' && logoMarkup && slots.left.trim()) {
      children.push(new TextRun({ text: '  ', font: settings.bodyFont, size: 18 }))
    }
    children.push(...bandRunChildren(slots[slot], meta, settings.bodyFont))
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      borders: bandTableBorders('none', kind),
      children: [
        new Paragraph({
          alignment:
            slot === 'left'
              ? AlignmentType.LEFT
              : slot === 'right'
                ? AlignmentType.RIGHT
                : AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children,
        }),
      ],
    })
  }

  return new Table({
    width: { size: contentTwips, type: WidthType.DXA },
    columnWidths,
    borders: bandTableBorders(band.separator, kind),
    rows: [
      new TableRow({
        children: slotsOrder.map((slot, index) => cell(slot, columnWidths[index])),
      }),
    ],
  })
}

function headerFor(
  book: WorkBookModel,
  settings: DocxExportSettings,
  logo?: BuildDocxBookInput['logo'],
): Header {
  const table = bandTable(
    settings.header,
    'header',
    bandSlotTemplates(settings.header),
    book.meta,
    settings,
    logo,
  )
  return new Header({
    children: [
      table || new Paragraph({ children: [new TextRun({ text: '' })] }),
    ],
  })
}

function footerFor(book: WorkBookModel, settings: DocxExportSettings): Footer {
  const footer = settings.footer
  const table = bandTable(
    footer,
    'footer',
    bandSlotTemplates(footer, {
      position: footer.pageNumberPosition,
      format: footer.pageNumberFormat,
    }),
    book.meta,
    settings,
  )
  return new Footer({
    children: [
      table || new Paragraph({ children: [new TextRun({ text: '' })] }),
    ],
  })
}

function emptyHeaderFooter() {
  return {
    header: new Header({ children: [new Paragraph({ children: [new TextRun({ text: '' })] })] }),
    footer: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: '' })] })] }),
  }
}

export interface BuildDocxBookInput {
  book: WorkBookModel
  settings: DocxExportSettings
  assets: {
    images: Map<string, ExportAsset>
    mermaid: Map<string, ExportAsset>
    formulas: Map<string, ExportAsset>
  }
  cover?: ExportAsset
  logo?: { asset: ExportAsset; heightMm: number }
  onChapter?: (done: number, total: number) => void
}

export async function buildDocxBook(input: BuildDocxBookInput): Promise<Blob> {
  const { book, settings, assets } = input
  const template = bookTemplate(settings)
  const paper = paperSizeMm(settings.paper)
  const pageSize = { width: mmToTwips(paper.width), height: mmToTwips(paper.height) }
  const margins = {
    top: mmToTwips(settings.marginsMm.top),
    right: mmToTwips(settings.marginsMm.right),
    bottom: mmToTwips(settings.marginsMm.bottom),
    left: mmToTwips(settings.marginsMm.left),
    header: mmToTwips(12),
    footer: mmToTwips(12),
  }
  const contentWidthPx = mmToPx(
    Math.max(40, paper.width - settings.marginsMm.left - settings.marginsMm.right),
  )
  const contentWidthTwips = pageSize.width - margins.left - margins.right

  const imageMap = new Map<string, Uint8Array>()
  const imageSizes = new Map<string, ImageSize>()
  for (const [src, asset] of assets.images) {
    imageMap.set(src, asset.bytes)
    imageSizes.set(src, { width: asset.width, height: asset.height })
  }
  const mermaidPngs = new Map<string, MermaidPng>()
  for (const [source, asset] of assets.mermaid) {
    mermaidPngs.set(source, {
      dataUrl: bytesToDataUrl(asset.bytes, asset.mime),
      width: asset.width,
      height: asset.height,
    })
  }
  const formulas = new Map<string, DocxFormulaImage>()
  for (const [key, asset] of assets.formulas) {
    formulas.set(key, {
      data: asset.bytes,
      width: asset.width,
      height: asset.height,
      display: key.startsWith('block:'),
    })
  }

  const hasVolumePages =
    book.options.includeVolumeTitles && book.chapters.some((chapter) => chapter.volumePath !== '')
  const headingOffset = hasVolumePages ? 2 : 1

  const frontMatter: Paragraph[] = []
  if (settings.includeCover && input.cover) {
    // 封面走独立零页边距节，和正文的页眉页脚、页码完全隔离。
  } else if (settings.includeCover) {
    frontMatter.push(...textCoverParagraphs(book, template))
  }
  if (settings.includeTitlePage) {
    frontMatter.push(...metadataParagraphs(book, template, frontMatter.length > 0))
  }
  if (settings.includeCopyright) {
    const copyright = copyrightParagraphs(book, template)
    copyright[0] = new Paragraph({
      pageBreakBefore: frontMatter.length > 0,
      children: [new TextRun({ text: '', font: template.bodyFont, size: template.bodySize })],
    })
    frontMatter.push(...copyright)
  }
  if (book.meta.description.trim()) {
    frontMatter.push(...synopsisParagraphs(book, template, frontMatter.length > 0))
  }
  if (settings.includeToc && book.options.includeToc) {
    frontMatter.push(
      ...tocParagraphs(
        book,
        template,
        hasVolumePages,
        frontMatter.length > 0,
        contentWidthTwips,
      ),
    )
  }

  const body: Array<Paragraph | Table> = []
  const chapterTotal = book.chapters.length
  let lastVolumePath: string | null = null
  const bookFigureNumbers = collectJsonFigureNumbers({
    type: 'doc',
    content: book.chapters.flatMap((chapter) =>
      Array.isArray(chapter.doc.content) ? (chapter.doc.content as JsonNode[]) : [],
    ),
  })

  withDocxBookRenderContext(
    { headingOffset, maxImageWidth: contentWidthPx, formulas },
    () => {
      // The same anchors the table of contents linked to.
      const anchors = volumeAnchors(book)
      book.chapters.forEach((chapter, chapterIndex) => {
        if (hasVolumePages && chapter.volumePath && chapter.volumePath !== lastVolumePath) {
          body.push(
            ...volumePage(
              chapter.volumeTitle || '正文',
              template,
              body.length > 0,
              anchors.get(chapter.volumePath) || '',
            ),
          )
        }
        lastVolumePath = chapter.volumePath

        body.push(
          chapterTitleParagraph(
            chapter.title,
            template,
            hasVolumePages,
            settings.chapterPageBreak && body.length > 0,
            chapterAnchor(chapterIndex),
          ),
        )
        if (book.options.includeChapterSynopsis && chapter.synopsis) {
          body.push(chapterSynopsisParagraph(chapter.synopsis, template))
        }

        const doc = toAdapter(chapter.doc as JsonNode, imageSizes)
        const figureNumbers = new Map<unknown, number>()
        doc.descendants((node) => {
          if (node.type.name !== 'image' && node.type.name !== 'resizableImage') return true
          const number = bookFigureNumbers.get(node.json)
          if (number) figureNumbers.set(node, number)
          return true
        })
        for (const block of doc.content) {
          body.push(...renderDocxBlock(block, template, imageMap, figureNumbers, mermaidPngs))
        }
        input.onChapter?.(chapterIndex + 1, chapterTotal)
      })
    },
  )

  const sections: ISectionOptions[] = []
  if (settings.includeCover && input.cover) {
    sections.push(coverSection(input.cover, settings))
  }

  if (frontMatter.length > 0) {
    const blank = emptyHeaderFooter()
    sections.push({
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pageSize, margin: margins },
      },
      headers:
        settings.header.enabled && !settings.header.hideOnFrontMatter
          ? { default: headerFor(book, settings, input.logo) }
          : { first: blank.header, default: blank.header },
      footers:
        settings.footer.enabled && !settings.footer.hideOnFrontMatter
          ? { default: footerFor(book, settings) }
          : { first: blank.footer, default: blank.footer },
      children: frontMatter,
    })
  }

  sections.push({
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        size: pageSize,
        margin: margins,
        pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
      },
    },
    headers: settings.header.enabled
      ? { default: headerFor(book, settings, input.logo) }
      : undefined,
    footers: settings.footer.enabled ? { default: footerFor(book, settings) } : undefined,
    children: body,
  })

  const document = new Document({
    title: book.meta.title,
    subject: book.meta.subtitle || undefined,
    creator: book.meta.author || '大懒猫创作平台',
    description: book.meta.description || undefined,
    keywords: book.meta.keywords.join(', ') || undefined,
    lastModifiedBy: '大懒猫创作平台',
    revision: 1,
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: {
            font: template.bodyFont,
            size: template.bodySize,
            color: template.bodyColor,
          },
          paragraph: {
            spacing: { line: template.lineSpacing, after: template.paragraphSpacing },
          },
        },
        heading1: {
          run: { font: template.headingFont, size: template.headingSizes.h1, bold: true, color: template.headingColor },
          paragraph: { spacing: { before: 240, after: 160 } },
        },
        heading2: {
          run: { font: template.headingFont, size: template.headingSizes.h2, bold: true, color: template.headingColor },
          paragraph: { spacing: { before: 200, after: 120 } },
        },
        heading3: {
          run: { font: template.headingFont, size: template.headingSizes.h3, bold: true, color: template.headingColor },
          paragraph: { spacing: { before: 160, after: 100 } },
        },
      },
      // Word rebuilds the TOC with these styles on 更新域; defining them here
      // keeps an updated field looking the same as the cached result.
      paragraphStyles: [
        {
          id: 'TOC1',
          name: 'toc 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: template.bodyFont, size: template.bodySize },
          paragraph: { spacing: { line: template.lineSpacing, after: 60 } },
        },
        {
          id: 'TOC2',
          name: 'toc 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: template.bodyFont, size: template.bodySize },
          paragraph: {
            spacing: { line: template.lineSpacing, after: 60 },
            indent: { left: 420 },
          },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT },
            { level: 1, format: LevelFormat.DECIMAL, text: '%2.', alignment: AlignmentType.LEFT },
            { level: 2, format: LevelFormat.DECIMAL, text: '%3.', alignment: AlignmentType.LEFT },
          ],
        },
      ],
    },
    sections,
  })

  return Packer.toBlob(document)
}
