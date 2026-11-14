import type {
  BookMetadata,
  PageBandSettings,
  PageBandSlot,
  PageFooterSettings,
  PageHeaderSettings,
  PageNumberFormat,
  PageRuleStyle,
} from './types'

export const PAGE_BAND_TOKENS = ['{title}', '{author}', '{publisher}', '{date}'] as const

export const PAGE_NUMBER_FORMATS: PageNumberFormat[] = ['x', 'x-of-y', 'page-x', 'page-x-of-y']
export const PAGE_NUMBER_POSITIONS: PageBandSlot[] = ['left', 'center', 'right']
export const PAGE_RULE_STYLES: PageRuleStyle[] = ['none', 'solid', 'dashed', 'double']

export type BandSegment =
  | { kind: 'text'; text: string }
  | { kind: 'page' }
  | { kind: 'pages' }

export function createPageHeader(
  enabled = false,
  overrides: Partial<PageHeaderSettings> = {},
): PageHeaderSettings {
  return {
    enabled,
    left: '',
    center: '',
    right: '',
    separator: enabled ? 'solid' : 'none',
    hideOnFrontMatter: true,
    ...overrides,
  }
}

export function createPageFooter(
  enabled = false,
  overrides: Partial<PageFooterSettings> = {},
): PageFooterSettings {
  return {
    enabled,
    left: '',
    center: '',
    right: '',
    separator: 'none',
    hideOnFrontMatter: true,
    pageNumberPosition: 'center',
    pageNumberFormat: 'x',
    ...overrides,
  }
}

/**
 * Split a band template into literal text and page counter tokens. Metadata
 * tokens are resolved here; `{page}` / `{pages}` stay symbolic so each renderer
 * can emit its own field/counter object.
 */
export function parseBandTemplate(template: string, meta: BookMetadata): BandSegment[] {
  const values: Record<string, string> = {
    '{title}': meta.title,
    '{author}': meta.author,
    '{publisher}': meta.publisher,
    '{date}': meta.publicationDate,
  }
  const pattern = /\{(title|author|publisher|date|page|pages)\}/gi
  const segments: BandSegment[] = []
  let cursor = 0
  for (const match of template.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) segments.push({ kind: 'text', text: template.slice(cursor, index) })
    const token = match[1].toLowerCase()
    if (token === 'page') segments.push({ kind: 'page' })
    else if (token === 'pages') segments.push({ kind: 'pages' })
    else segments.push({ kind: 'text', text: values[`{${token}}`] || '' })
    cursor = index + match[0].length
  }
  if (cursor < template.length) segments.push({ kind: 'text', text: template.slice(cursor) })
  return segments
}

export function resolveBandText(template: string, meta: BookMetadata): string {
  return parseBandTemplate(template, meta)
    .map((segment) => (segment.kind === 'text' ? segment.text : segment.kind === 'page' ? '{page}' : '{pages}'))
    .join('')
}

/** Human-readable page number used by the studio preview and DOCX samples. */
export function pageNumberText(format: PageNumberFormat, current: number, total: number): string {
  if (format === 'x-of-y') return `${current} / ${total}`
  if (format === 'page-x') return `第 ${current} 页`
  if (format === 'page-x-of-y') return `第 ${current} 页 / 共 ${total} 页`
  return String(current)
}

export function pageNumberExample(format: PageNumberFormat): string {
  return pageNumberText(format, 7, 128)
}

/** `{page}` / `{pages}` template for a page-number format, shared by every renderer. */
export function pageNumberTemplate(format: PageNumberFormat): string {
  if (format === 'x-of-y') return '{page} / {pages}'
  if (format === 'page-x') return '第 {page} 页'
  if (format === 'page-x-of-y') return '第 {page} 页 / 共 {pages} 页'
  return '{page}'
}

export interface BandSlotTemplates {
  left: string
  center: string
  right: string
}

/**
 * The three slots with the automatic page number folded in.
 *
 * A template that already uses `{page}` / `{pages}` keeps full control: putting
 * the number in the left slot and picking "right" as its position must not print
 * it twice, so the automatic number only appears when no slot uses a counter.
 */
export function bandSlotTemplates(
  band: PageBandSettings,
  pageNumber?: { position: PageBandSlot; format: PageNumberFormat },
): BandSlotTemplates {
  const slots: BandSlotTemplates = {
    left: band.left,
    center: band.center,
    right: band.right,
  }
  if (!pageNumber) return slots
  const hasCounter = Object.values(slots).some((value) => /\{(page|pages)\}/i.test(value))
  if (hasCounter) return slots
  const template = pageNumberTemplate(pageNumber.format)
  const slot = pageNumber.position
  slots[slot] = slots[slot].trim() ? `${slots[slot]} ${template}` : template
  return slots
}

export function bandHasContent(band: PageBandSettings): boolean {
  return Boolean(band.left.trim() || band.center.trim() || band.right.trim())
}

export function normalizePageBand<T extends PageBandSettings>(band: T): T {
  return {
    ...band,
    enabled: Boolean(band.enabled),
    left: String(band.left ?? '').slice(0, 120),
    center: String(band.center ?? '').slice(0, 120),
    right: String(band.right ?? '').slice(0, 120),
    separator: PAGE_RULE_STYLES.includes(band.separator) ? band.separator : 'none',
    hideOnFrontMatter: Boolean(band.hideOnFrontMatter),
  }
}

export function normalizePageFooter(band: PageFooterSettings): PageFooterSettings {
  const base = normalizePageBand(band)
  return {
    ...base,
    pageNumberPosition: PAGE_NUMBER_POSITIONS.includes(band.pageNumberPosition)
      ? band.pageNumberPosition
      : 'center',
    pageNumberFormat: PAGE_NUMBER_FORMATS.includes(band.pageNumberFormat)
      ? band.pageNumberFormat
      : 'x',
  }
}
