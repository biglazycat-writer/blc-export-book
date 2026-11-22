import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { CompileFormatEnum } from '@myriaddreamin/typst.ts/compiler'
import type { TypstCompiler } from '@myriaddreamin/typst.ts'
import { PDFDict, PDFName, PDFDocument, PDFRawStream } from 'pdf-lib'
import { buildPdfBook } from './pdf-book'
import { COVER_PALETTES } from './cover'
import type { TypstCompileInput } from './typst-runtime'
import { applyPdfPreset } from './presets'
import { formulaKey } from './assets'
import { isCancelError } from './progress'
import type {
  BookAssets,
  BookChapter,
  BookVolume,
  ExportAsset,
  PdfExportSettings,
  WorkBookModel,
} from './types'

/** Valid 1x1 transparent PNG: Typst decodes real dimensions from the bytes. */
const REAL_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
])

function imageAsset(id: string, fileName: string, width = 320, height = 200): ExportAsset {
  return { id, fileName, mime: 'image/png', bytes: REAL_PNG, width, height }
}

function textNode(value: string) {
  return { type: 'text', text: value }
}

function paragraph(...children: unknown[]) {
  return { type: 'paragraph', content: children }
}

function docJson(...blocks: unknown[]) {
  return { type: 'doc', content: blocks }
}

function chapter(
  id: string,
  volumePath: string,
  title: string,
  doc: Record<string, unknown>,
  synopsis = '',
): BookChapter {
  return {
    id,
    volumePath,
    volumeTitle: '',
    title,
    synopsis,
    doc,
    wordCount: 100,
    updatedAt: '2026-10-20 10:00:00',
    empty: false,
  }
}

function bookFixture(): WorkBookModel {
  const root = chapter(
    'c0',
    '',
    '根章',
    docJson(
      paragraph(textNode('根章正文。')),
      { type: 'image', attrs: { src: 'asset://inner', alt: '插图', caption: '插图说明' } },
      paragraph(
        textNode('带公式：'),
        { type: 'formula', attrs: { latex: 'E = mc^2', displayMode: false } },
      ),
    ),
    '根章梗概',
  )
  const first = chapter(
    'c1',
    'v1',
    '第一章',
    docJson(
      { type: 'heading', attrs: { level: 1 }, content: [textNode('章内标题')] },
      paragraph(textNode('第一章正文。')),
      { type: 'callout', attrs: { kind: 'warn' }, content: [paragraph(textNode('小心'))] },
    ),
    '第一章梗概',
  )
  const second = chapter('c2', 'v1', '第二章', docJson(paragraph(textNode('第二章正文。'))))
  const volume: BookVolume = {
    path: 'v1',
    parentPath: '',
    title: '第一卷',
    depth: 1,
    chapters: [first, second],
  }
  return {
    meta: {
      title: '测试书',
      subtitle: '副标题',
      author: '作者甲',
      language: 'zh-CN',
      publisher: '测试出版社',
      isbn: '9780306406157',
      publicationDate: '2026-10-20',
      description: '简介第一段。\n简介第二段。',
      rights: '© 2026 作者甲',
      keywords: ['小说', '测试'],
    },
    options: { includeVolumeTitles: true, includeChapterSynopsis: true, includeToc: true },
    chapters: [root, first, second],
    volumes: [volume],
    rootChapters: [root],
    wordCount: 300,
  }
}

function assetMaps(overrides: Partial<Pick<BookAssets, 'images' | 'mermaid' | 'formulas'>> = {}) {
  return {
    images: new Map([['asset://inner', imageAsset('img-001', 'photo.png')]]),
    mermaid: new Map<string, ExportAsset>(),
    formulas: new Map<string, ExportAsset>(),
    ...overrides,
  }
}

function pdfSettings(overrides: Partial<PdfExportSettings> = {}): PdfExportSettings {
  return { ...applyPdfPreset('reading'), ...overrides }
}

describe('buildPdfBook 打包', () => {
  it('registers assets once, reports progress and returns PDF bytes', async () => {
    const captured: TypstCompileInput[] = []
    const order: string[] = []
    const chapters: Array<[number, number]> = []
    const bytes = await buildPdfBook({
      book: bookFixture(),
      settings: pdfSettings(),
      assets: assetMaps(),
      cover: imageAsset('cover', 'cover.png', 800, 1200),
      onChapter: (done, total) => chapters.push([done, total]),
      onCompile: () => order.push('callback'),
      compile: async (input) => {
        captured.push(input)
        order.push('compile')
        return new TextEncoder().encode('%PDF-1.7 fake')
      },
    })

    expect(String.fromCharCode(...bytes.subarray(0, 5))).toBe('%PDF-')
    expect(order).toEqual(['callback', 'compile'])
    expect(chapters).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ])

    const input = captured[0]
    const paths = input.assets.map((asset) => asset.path)
    expect(paths).toContain('/assets/cover.png')
    expect(paths).toContain('/assets/photo.png')
    expect(new Set(paths).size).toBe(paths.length)
    expect(input.main).toContain('#image("/assets/cover.png", width: 100%, height: 100%, fit: "cover")')
    expect(input.chapters.map((chapterFile) => chapterFile.path)).toEqual([
      '/chapters/0001.typ',
      '/chapters/0002.typ',
      '/chapters/0003.typ',
    ])
    expect(input.chapters[0].source).toContain('image("/assets/photo.png", width: 240pt')
  })

  it('deduplicates colliding asset file names and maps formulas by key', async () => {
    const formula = imageAsset('f1', 'formula.png', 200, 60)
    const book = bookFixture()
    book.chapters = [
      chapter(
        'only',
        '',
        '唯一章',
        docJson(
          { type: 'image', attrs: { src: 'asset://a' } },
          { type: 'formula', attrs: { latex: 'x^2', displayMode: true } },
          { type: 'image', attrs: { src: 'asset://b' } },
        ),
      ),
    ]
    book.rootChapters = book.chapters
    book.volumes = []

    const captured: TypstCompileInput[] = []
    await buildPdfBook({
      book,
      settings: pdfSettings({ includeCover: false }),
      assets: assetMaps({
        images: new Map([
          ['asset://a', imageAsset('a', 'same.png')],
          ['asset://b', imageAsset('b', 'same.png')],
        ]),
        formulas: new Map([[formulaKey('x^2', true), formula]]),
      }),
      compile: async (input) => {
        captured.push(input)
        return new TextEncoder().encode('%PDF-1.7 fake')
      },
    })

    const input = captured[0]
    const paths = input.assets.map((asset) => asset.path).sort()
    expect(paths).toEqual(['/assets/formula.png', '/assets/same-2.png', '/assets/same.png'])
    expect(input.main).not.toContain('margin: 0pt')
    expect(input.chapters[0].source).toContain(
      '#align(center)[#image("/assets/formula.png", width: 150pt, alt: "图片")]',
    )
  })

  it('draws the default cover as vector objects, not a canvas image', async () => {
    const captured: TypstCompileInput[] = []
    await buildPdfBook({
      book: bookFixture(),
      settings: pdfSettings({ includeCover: true }),
      assets: assetMaps(),
      compile: async (input) => {
        captured.push(input)
        return new TextEncoder().encode('%PDF-1.7 fake')
      },
    })
    const main = captured[0].main
    expect(main).toContain('margin: 0pt')
    expect(main).toContain('大懒猫写作')
    // Palette background, border and divider are Typst shapes/text, so page 1
    // is made of real objects instead of one 1200×1800 PNG.
    expect(main).toContain(
      `#block(width: 100%, height: 100%, fill: rgb("${COVER_PALETTES.literary.background}"))`,
    )
    expect(main).toContain('#place(top + center')
    expect(main).toContain('#line(length:')
    expect(captured[0].assets.map((asset) => asset.path)).not.toContain('/assets/cover.png')
  })

  it('cancels before compiling when the signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      buildPdfBook({
        book: bookFixture(),
        settings: pdfSettings(),
        assets: assetMaps(),
        signal: controller.signal,
        compile: async () => {
          throw new Error('不应执行到编译')
        },
      }),
    ).rejects.toSatisfy(isCancelError)
  })
})

describe('buildPdfBook 真实 Typst 编译', () => {
  const require = createRequire(import.meta.url)
  const WASM_PATH = require.resolve(
    '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
  )
  const FONT_PATHS = [
    require.resolve('@expo-google-fonts/noto-serif-sc/400Regular/NotoSerifSC_400Regular.ttf'),
    require.resolve('@expo-google-fonts/noto-serif-sc/700Bold/NotoSerifSC_700Bold.ttf'),
  ]

  let compilerPromise: Promise<TypstCompiler> | null = null

  function testCompiler(): Promise<TypstCompiler> {
    if (!compilerPromise) {
      compilerPromise = (async () => {
        const { createTypstCompiler, loadFonts } = await import('@myriaddreamin/typst.ts')
        const compiler = createTypstCompiler()
        await compiler.init({
          beforeBuild: [
            loadFonts(
              FONT_PATHS.map((path) => new Uint8Array(readFileSync(path))),
              { assets: false },
            ),
          ],
          getModule: () => new Uint8Array(readFileSync(WASM_PATH)),
        })
        return compiler
      })()
    }
    return compilerPromise
  }

  async function compileForTest(input: TypstCompileInput): Promise<Uint8Array> {
    const compiler = await testCompiler()
    compiler.addSource('/main.typ', input.main)
    for (const chapterFile of input.chapters) compiler.addSource(chapterFile.path, chapterFile.source)
    for (const asset of input.assets) compiler.mapShadow(asset.path, asset.bytes)
    const result = await compiler.compile({
      mainFilePath: '/main.typ',
      format: CompileFormatEnum.pdf,
      diagnostics: 'unix',
    })
    if (!result.result) {
      throw new Error(`Typst 编译失败：\n${(result.diagnostics || []).join('\n')}`)
    }
    return result.result
  }

  it(
    'produces a real PDF with metadata, bookmarks, fonts and numbered body pages',
    async () => {
      const bytes = await buildPdfBook({
        book: bookFixture(),
        settings: pdfSettings(),
        assets: assetMaps(),
        cover: imageAsset('cover', 'cover.png', 800, 1200),
        compile: compileForTest,
      })
      expect(String.fromCharCode(...bytes.subarray(0, 5))).toBe('%PDF-')
      expect(bytes.length).toBeGreaterThan(20_000)

      // pdf-lib：页面数、文档信息与嵌入字体。
      const doc = await PDFDocument.load(bytes, { updateMetadata: false })
      expect(doc.getTitle()).toBe('测试书')
      expect(doc.getAuthor()).toBe('作者甲')
      const fonts = new Set<string>()
      for (const [, object] of doc.context.enumerateIndirectObjects()) {
        if (object instanceof PDFDict && String(object.get(PDFName.of('Type'))) === '/Font') {
          const base = object.get(PDFName.of('BaseFont'))
          if (base) fonts.add(String(base))
        }
      }
      expect([...fonts].some((name) => name.includes('NotoSerifSC'))).toBe(true)

      // PDF.js：书签大纲与正文文本。
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const pdf = await getDocument({ data: bytes }).promise
      expect(pdf.numPages).toBe(doc.getPageCount())

      const outline = (await pdf.getOutline()) as Array<{
        title: string
        items: Array<{ title: string }>
      }> | null
      expect(outline?.map((node) => node.title)).toEqual([
        '封面',
        '扉页',
        '版权信息',
        '内容简介',
        '目录',
        '根章',
        '第一卷',
      ])
      expect(outline?.[6].items.map((node) => node.title)).toEqual(['第一章', '第二章'])

      const pageText = async (pageNumber: number): Promise<string> => {
        const page = await pdf.getPage(pageNumber)
        const content = await page.getTextContent()
        return content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join('')
          .replace(/\s+/g, '')
      }
      const allText: string[] = []
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        allText.push(await pageText(pageNumber))
      }
      const joined = allText.join('\n')
      expect(joined).toContain('测试书')
      expect(joined).toContain('ISBN：9780306406157')
      expect(joined).toContain('目录')
      expect(joined).toContain('第一卷')
      expect(joined).toContain('第一章梗概')
      expect(joined).toContain('图1插图说明')

      // Hidden front-matter bookmarks must not leak into page text or the printed 目录 page.
      expect(allText[1]).not.toContain('扉页')
      expect(allText[4]).toContain('目录')
      expect(allText[4]).not.toContain('版权信息')
      expect(allText[4]).not.toContain('内容简介')

      // 正文第一页（物理第 6 页：封面/扉页/版权/简介/目录之后）页码从 1 开始。
      expect(allText[5]).toContain('根章正文')
      expect(allText[5]).toContain('1')
      expect(allText[0]).not.toContain('1')
    },
    120_000,
  )

  it(
    'keeps the default cover vector: text objects and no image XObject',
    async () => {
      const bytes = await buildPdfBook({
        book: bookFixture(),
        settings: pdfSettings(),
        assets: assetMaps(),
        compile: compileForTest,
      })
      const doc = await PDFDocument.load(bytes, { updateMetadata: false })

      // Page 1 is the generated cover. If it were still a canvas PNG it would
      // carry an image XObject; the vector cover only carries the text font.
      const resources = doc.getPage(0).node.Resources()
      const xobjects = resources?.has(PDFName.of('XObject'))
        ? resources.lookup(PDFName.of('XObject'), PDFDict)
        : undefined
      let images = 0
      for (const [, ref] of xobjects?.entries() ?? []) {
        const object = doc.context.lookup(ref)
        const dict =
          object instanceof PDFRawStream ? object.dict : object instanceof PDFDict ? object : null
        if (dict && String(dict.get(PDFName.of('Subtype'))) === '/Image') images += 1
      }
      expect(images).toBe(0)

      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const pdf = await getDocument({ data: bytes }).promise
      const page = await pdf.getPage(1)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join('')
        .replace(/\s+/g, '')
      expect(text).toContain('测试书')
      expect(text).toContain('副标题')
      expect(text).toContain('作者甲')
      expect(text).toContain('大懒猫写作')
    },
    120_000,
  )
})
