import '../test-i18n'
import { describe, expect, it } from 'vitest'
import {
  applyDocxPreset,
  applyPdfPreset,
  createDefaultWorkExportSettings,
  isValidIsbn,
  isValidPublicationDate,
  isDocxPresetModified,
  normalizeDocxSettings,
  normalizePdfSettings,
  parseKeywords,
  validateWorkExportSettings,
} from './presets'
import { mergeWorkExportSettings } from './settings'

describe('export presets', () => {
  it('creates EPUB defaults for a collection and PDF defaults for standalone content', () => {
    const collection = createDefaultWorkExportSettings({ title: '书', author: '作者', today: '2026-10-20' })
    expect(collection.lastFormat).toBe('epub')
    expect(collection.common.rights).toBe('© 2026 作者。保留所有权利。')
    expect(collection.common.publicationDate).toBe('2026-10-20')

    const standalone = createDefaultWorkExportSettings({ title: '文章', standalone: true })
    expect(standalone.lastFormat).toBe('pdf')
  })

  it('applies the Word manuscript preset and detects edits', () => {
    const settings = applyDocxPreset('manuscript')
    expect(settings.paper).toBe('a4')
    expect(settings.bodySizePt).toBe(12)
    expect(isDocxPresetModified(settings)).toBe(false)
    expect(isDocxPresetModified({ ...settings, bodySizePt: 11 })).toBe(true)
  })

  it('clamps out-of-range numeric fields', () => {
    const docx = normalizeDocxSettings({ ...applyDocxPreset('publish'), bodySizePt: 40, lineSpacing: 0.5, marginsMm: { top: 1, right: 80, bottom: 22, left: 22 } })
    expect(docx.bodySizePt).toBe(16)
    expect(docx.lineSpacing).toBe(1.2)
    expect(docx.marginsMm.top).toBe(10)
    expect(docx.marginsMm.right).toBe(50)

    const pdf = normalizePdfSettings({ ...applyPdfPreset('print'), gutterMm: 99 })
    expect(pdf.gutterMm).toBe(20)
  })

  it('round-trips presets through the settings merger', () => {
    const defaults = createDefaultWorkExportSettings({ title: '书' })
    const merged = mergeWorkExportSettings(
      { lastFormat: 'docx', docx: { preset: 'modern', lineSpacing: 2 } },
      defaults,
    )
    expect(merged.lastFormat).toBe('docx')
    expect(merged.docx.preset).toBe('modern')
    expect(merged.docx.bodyFont).toBe('微软雅黑')
    expect(merged.docx.lineSpacing).toBe(2)
    expect(merged.docx.firstLineIndentChars).toBe(0)
  })
})

describe('publication validation', () => {
  it('checks ISBN-10 and ISBN-13 check digits', () => {
    expect(isValidIsbn('9780306406157')).toBe(true)
    expect(isValidIsbn('978-0-306-40615-7')).toBe(true)
    expect(isValidIsbn('0306406152')).toBe(true)
    expect(isValidIsbn('9780306406158')).toBe(false)
    expect(isValidIsbn('123')).toBe(false)
  })

  it('accepts real dates only', () => {
    expect(isValidPublicationDate('2024-02-29')).toBe(true)
    expect(isValidPublicationDate('2023-02-29')).toBe(false)
    expect(isValidPublicationDate('2024-2-9')).toBe(false)
  })

  it('blocks export for a blank title or bad ISBN and warns about a missing author', () => {
    const result = validateWorkExportSettings(
      {
        title: '   ',
        subtitle: '',
        author: '',
        language: 'zh-CN',
        publisher: '',
        isbn: '9780306406158',
        publicationDate: '2026-10-20',
        description: '',
        rights: '',
        keywords: '一,二',
        filename: '',
      },
      2,
    )
    expect(result.errors.title).toBeTruthy()
    expect(result.errors.isbn).toBeTruthy()
    expect(result.warnings.length).toBe(1)
  })

  it('splits keywords on Chinese and ASCII separators', () => {
    expect(parseKeywords('科幻，长篇; 连载、测试')).toEqual(['科幻', '长篇', '连载', '测试'])
  })
})
