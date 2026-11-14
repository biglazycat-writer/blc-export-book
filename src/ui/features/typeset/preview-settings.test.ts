import { describe, expect, it } from 'vitest'
import { createDefaultWorkExportSettings } from '../novels/work-export/presets'
import { previewPdfSettings } from './preview-settings'

function settings() {
  return createDefaultWorkExportSettings({ title: '测试合集' })
}

describe('previewPdfSettings', () => {
  it('leaves the PDF settings untouched when previewing a PDF', () => {
    const value = settings()
    expect(previewPdfSettings(value, 'pdf')).toBe(value.pdf)
  })

  it('uses EPUB reflowable layout as-is: the print preview stays the PDF settings', () => {
    const value = settings()
    expect(previewPdfSettings(value, 'epub')).toBe(value.pdf)
  })

  it('maps the Word page geometry onto the preview so it matches the DOCX export', () => {
    const value = settings()
    value.docx.paper = 'b5'
    value.docx.marginsMm = { top: 21, bottom: 19, left: 23, right: 17 }
    value.docx.bodySizePt = 11
    value.docx.lineSpacing = 1.6
    value.docx.firstLineIndentChars = 0
    value.docx.header = { ...value.docx.header, enabled: true, left: '第 {title} 章' }
    value.docx.footer = { ...value.docx.footer, enabled: true, pageNumberFormat: 'x-of-y' }
    value.docx.includeCover = false
    value.docx.includeTitlePage = false
    value.docx.includeCopyright = false
    value.docx.includeToc = false

    const preview = previewPdfSettings(value, 'docx')
    expect(preview.paper).toBe('b5')
    expect(preview.marginsMm).toEqual({ top: 21, bottom: 19, inside: 23, outside: 17 })
    expect(preview.gutterMm).toBe(0)
    expect(preview.bodySizePt).toBe(11)
    expect(preview.lineSpacing).toBe(1.6)
    expect(preview.firstLineIndentChars).toBe(0)
    expect(preview.header).toBe(value.docx.header)
    expect(preview.footer).toBe(value.docx.footer)
    expect(preview.includeCover).toBe(false)
    expect(preview.includeTitlePage).toBe(false)
    expect(preview.includeCopyright).toBe(false)
    expect(preview.includeToc).toBe(false)
  })

  it('keeps PDF-only settings from the PDF panel', () => {
    const value = settings()
    value.pdf.watermark = '内部样张'
    value.pdf.justify = false
    const preview = previewPdfSettings(value, 'docx')
    expect(preview.watermark).toBe('内部样张')
    expect(preview.justify).toBe(false)
    expect(preview.chapterStart).toBe('next')
  })
})
