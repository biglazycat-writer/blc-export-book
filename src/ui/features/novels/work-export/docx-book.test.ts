import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import type { WorkExportManuscript } from '../../../types/models'
import { buildDocxBook } from './docx-book'
import { buildWorkBook } from './manuscript'
import { applyDocxPreset } from './presets'
import { createPageFooter, createPageHeader } from './page-band'
import type {
  BookAssets,
  DocxExportSettings,
  ExportAsset,
  WorkBookModel,
  WorkExportCommonSettings,
  WorkExportContentSettings,
} from './types'

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])

function common(): WorkExportCommonSettings {
  return {
    title: '测试书',
    subtitle: '一个副标题',
    author: '测试作者',
    language: 'zh-CN',
    publisher: '测试出版社',
    isbn: '9780306406157',
    publicationDate: '2026-10-20',
    description: '这是内容简介。\n第二段简介。',
    rights: '© 2026 测试作者。保留所有权利。',
    keywords: '小说,测试',
    filename: '',
  }
}

function content(): WorkExportContentSettings {
  return {
    scopeType: 'all',
    chapterIds: [],
    chapterOrder: [],
    includeSynopsis: true,
    includeVolumeTitles: true,
    includeChapterSynopsis: true,
    includeToc: true,
    skipEmpty: false,
  }
}

function text(value: string) {
  return { type: 'text', text: value }
}

function paragraph(...children: unknown[]) {
  return { type: 'paragraph', content: children }
}

function heading(level: number, value: string) {
  return { type: 'heading', attrs: { level }, content: [text(value)] }
}

function docJson(...blocks: unknown[]) {
  return { type: 'doc', content: blocks }
}

function manuscript(): WorkExportManuscript {
  const firstDoc = docJson(
    heading(1, '章内标题'),
    paragraph(text('第一章正文。')),
    {
      type: 'paragraph',
      content: [
        text('带公式：'),
        { type: 'formula', attrs: { latex: 'E = mc^2', displayMode: false } },
      ],
    },
    {
      type: 'image',
      attrs: { src: 'asset://cover-inner', width: 320, height: 200, alt: '插图' },
    },
  )
  const secondDoc = docJson(
    paragraph(text('第二章正文。')),
    {
      type: 'codeBlock',
      attrs: { language: 'mermaid' },
      content: [text('graph TD; A-->B;')],
    },
  )
  return {
    novel_id: 'novel-1',
    title: '原始标题',
    synopsis: '',
    workspace_kind: 'novel',
    word_count: 1200,
    volumes: [
      { path: 'v1', parent_path: '', title: '第一卷', chapter_count: 2, word_count: 1200 },
    ],
    chapters: [
      {
        id: 'c1',
        volume_path: 'v1',
        title: '第一章',
        synopsis: '第一章梗概',
        content: JSON.stringify({ type: 'biglazycat_editor_content', doc: firstDoc }),
        word_count: 700,
        created_at: '',
        updated_at: '2026-10-20 10:00:00',
      },
      {
        id: 'c2',
        volume_path: 'v1',
        title: '第二章',
        synopsis: '',
        content: JSON.stringify({ type: 'biglazycat_editor_content', doc: secondDoc }),
        word_count: 500,
        created_at: '',
        updated_at: '2026-10-20 11:00:00',
      },
    ],
  }
}

function book(): WorkBookModel {
  return buildWorkBook({ manuscript: manuscript(), common: common(), content: content() })
}

function imageAsset(fileName: string, width = 320, height = 200): ExportAsset {
  const bytes = new Uint8Array([...PNG_BYTES, ...new TextEncoder().encode(fileName)])
  return { id: fileName, fileName, mime: 'image/png', bytes, width, height }
}

function assets(): BookAssets {
  const inner = imageAsset('inner.png')
  const mermaid = imageAsset('mermaid.png', 400, 240)
  const formula = imageAsset('formula.png', 160, 60)
  return {
    images: new Map([['asset://cover-inner', inner]]),
    mermaid: new Map([['graph TD; A-->B;', mermaid]]),
    formulas: new Map([['inline:E = mc^2', formula]]),
    all: [inner, mermaid, formula],
    warnings: [],
  }
}

async function unpack(blob: Blob) {
  const zip = await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()))
  const files: Record<string, string> = {}
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue
    if (/\.(xml|rels)$/.test(name)) files[name] = await file.async('string')
  }
  return { zip, files }
}

function joined(files: Record<string, string>, pattern: RegExp): string {
  return Object.entries(files)
    .filter(([name]) => pattern.test(name))
    .map(([, body]) => body)
    .join('\n')
}

function docxSettings(overrides: Partial<DocxExportSettings> = {}): DocxExportSettings {
  return { ...applyDocxPreset('manuscript'), ...overrides }
}

describe('buildDocxBook', () => {
  it('writes front matter, a filled table of contents, metadata and section page settings', async () => {
    const blob = await buildDocxBook({ book: book(), settings: docxSettings(), assets: assets() })
    const { files } = await unpack(blob)
    const document = files['word/document.xml'] || ''
    const settings = files['word/settings.xml'] || ''
    const core = files['docProps/core.xml'] || ''

    // The footer page numbers are still fields, so the refresh flag stays.
    expect(settings).toContain('updateFields')
    expect(document).toContain('目录')
    // The entries are real paragraphs, not a TOC field a reader has to update.
    expect(document).toContain('w:anchor="chapter_1"')
    expect(document).toContain('<w:bookmarkStart w:name="chapter_1"')
    expect(document).toContain('内容简介')
    expect(document).toContain('测试出版社')
    expect(document).toContain('9780306406157')
    expect(document).toContain('<w:pgSz w:w="11906" w:h="16838"')
    expect(document).toContain('<w:pgMar w:top="1417"')
    expect(document).toContain('<w:pgNumType w:start="1"')
    expect(document.match(/<w:sectPr/g)?.length).toBe(2)

    expect(core).toContain('<dc:title>测试书</dc:title>')
    expect(core).toContain('<dc:creator>测试作者</dc:creator>')
    expect(core).toContain('小说, 测试')
    expect(core).toContain('<dc:description>这是内容简介。')
  })

  it('starts every chapter on a new page and offsets headings around volumes', async () => {
    const blob = await buildDocxBook({ book: book(), settings: docxSettings(), assets: assets() })
    const { files } = await unpack(blob)
    const document = files['word/document.xml'] || ''

    expect(document).toContain('第一卷')
    expect(document).toContain('<w:pStyle w:val="Heading1"/>')
    expect(document).toContain('<w:pStyle w:val="Heading2"/>')
    expect(document).toContain('<w:pStyle w:val="Heading3"/>')
    expect(document.match(/<w:pageBreakBefore/g)?.length).toBeGreaterThanOrEqual(2)
    expect(document).toContain('第一章梗概')
  })

  it('adds headers, footers and page number fields from the preset', async () => {
    const blob = await buildDocxBook({
      book: book(),
      settings: docxSettings({
        header: createPageHeader(true, { left: '{title}', right: '{author}' }),
        footer: createPageFooter(true, { pageNumberFormat: 'page-x' }),
      }),
      assets: assets(),
    })
    const { files } = await unpack(blob)
    const header = joined(files, /word\/header\d+\.xml$/)
    const footer = joined(files, /word\/footer\d+\.xml$/)

    expect(header).toContain('测试书')
    expect(header).toContain('测试作者')
    expect(footer).toContain('PAGE')
    expect(footer).toContain('第 ')
    expect(footer).toContain(' 页')
    // The page number sits in the band. The other edges stay clear, so Word
    // does not draw the three-cell box that used to run past the page.
    expect(footer).toContain('w:val="none"')
    expect(footer).not.toContain('w:val="single"')
  })

  it('lays the band out in three columns with the header logo', async () => {
    const logo = imageAsset('logo.png', 200, 100)
    const blob = await buildDocxBook({
      book: book(),
      settings: docxSettings({
        header: createPageHeader(true, { left: '{title}', separator: 'double' }),
      }),
      assets: assets(),
      logo: { asset: logo, heightMm: 8 },
    })
    const { files } = await unpack(blob)
    const header = joined(files, /word\/header\d+\.xml$/)

    expect(header).toContain('测试书')
    expect(header.match(/<w:gridCol/g)?.length).toBe(3)
    expect(header).toContain('<w:tblBorders>')
    expect(header).toContain('w:val="double"')
    expect(header).toContain('<w:drawing>')
  })

  it('creates a zero-margin cover section and embeds cover, images, formulas and mermaid', async () => {
    const cover = imageAsset('cover.png', 800, 1120)
    const blob = await buildDocxBook({
      book: book(),
      settings: docxSettings({ includeCover: true }),
      assets: assets(),
      cover,
    })
    const { zip, files } = await unpack(blob)
    const document = files['word/document.xml'] || ''
    const media = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'))

    expect(document.match(/<w:sectPr/g)?.length).toBe(3)
    expect(document).toContain('<w:pgMar w:top="0"')
    expect(media.length).toBeGreaterThanOrEqual(4)
  })

  it('keeps readable LaTeX when no formula image was prepared', async () => {
    const emptyAssets: BookAssets = {
      images: new Map(),
      mermaid: new Map(),
      formulas: new Map(),
      all: [],
      warnings: [],
    }
    const blob = await buildDocxBook({ book: book(), settings: docxSettings(), assets: emptyAssets })
    const { files } = await unpack(blob)
    expect(files['word/document.xml']).toContain('$E = mc^2$')
  })

  it('can hide the TOC and title page', async () => {
    const plain = book()
    plain.meta.description = ''
    const blob = await buildDocxBook({
      book: plain,
      settings: docxSettings({
        includeToc: false,
        includeTitlePage: false,
        includeCopyright: false,
        footer: createPageFooter(false),
      }),
      assets: assets(),
    })
    const { files } = await unpack(blob)
    const document = files['word/document.xml'] || ''
    expect(document).not.toContain('TOC')
    expect(document).not.toContain('测试出版社')
    expect(document.match(/<w:sectPr/g)?.length).toBe(1)
  })
})
