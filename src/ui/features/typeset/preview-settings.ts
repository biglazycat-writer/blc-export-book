import type { PdfExportSettings, WorkExportSettings } from '../novels/work-export/types'
import type { TypesetFormat } from './TypesetSettings'

/**
 * The paper settings used for the live preview.
 *
 * The preview is always a real PDF render. DOCX has no PDF twin, so its page
 * geometry is mapped onto the PDF settings; that keeps margins, paper, bands
 * and front matter faithful instead of showing the PDF preset while the user
 * is editing Word settings. EPUB is reflowable, so the print preview is an
 * approximation and keeps the PDF settings.
 */
export function previewPdfSettings(
  settings: WorkExportSettings,
  format: TypesetFormat,
): PdfExportSettings {
  if (format !== 'docx') return settings.pdf
  const docx = settings.docx
  return {
    ...settings.pdf,
    paper: docx.paper,
    marginsMm: {
      top: docx.marginsMm.top,
      bottom: docx.marginsMm.bottom,
      inside: docx.marginsMm.left,
      outside: docx.marginsMm.right,
    },
    gutterMm: 0,
    bodySizePt: docx.bodySizePt,
    lineSpacing: docx.lineSpacing,
    firstLineIndentChars: docx.firstLineIndentChars,
    includeCover: docx.includeCover,
    includeTitlePage: docx.includeTitlePage,
    includeCopyright: docx.includeCopyright,
    includeToc: docx.includeToc,
    header: docx.header,
    footer: docx.footer,
    chapterStart: 'next',
  }
}
