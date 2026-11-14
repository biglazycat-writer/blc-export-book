import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { PDFDocument, PDFDict, PDFName } from 'pdf-lib'
import { buildTypstBookSource, typstContentWidthPt } from './typst-source'
import { buildWorkBook } from './manuscript'
import { createDefaultWorkExportSettings } from './presets'
import type { WorkExportManuscript } from '../../../types/models'
import type { PdfExportSettings } from './types'

/**
 * These tests compile the real export source with the real Typst compiler the
 * app ships, then measure the printed pages. A paragraph that prints on top of
 * the one before it, or a line spacing that doubles the setting, is invisible
 * to any assertion about the source.
 */

const require_ = createRequire(import.meta.url)
const font = (rel: string) => new Uint8Array(readFileSync(require_.resolve(rel)))

const BODY_SIZE = 10.5
const LINE_SPACING = 1.7
/** Baseline-to-baseline distance the settings ask for. */
const PITCH = BODY_SIZE * LINE_SPACING

async function compilePdf(
  main: string,
  chapters: readonly { path: string; source: string }[],
): Promise<Uint8Array> {
  const { createTypstCompiler, loadFonts } = await import('@myriaddreamin/typst.ts')
  const { CompileFormatEnum } = await import('@myriaddreamin/typst.ts/compiler')
  const wasm = new Uint8Array(
    readFileSync(
      require_.resolve('@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm'),
    ),
  )
  const compiler = createTypstCompiler()
  await compiler.init({
    beforeBuild: [
      // The same four faces the app loads; a face missing here prints tofu and
      // the assertions below would pass against a broken export.
      loadFonts(
        [
          font('@expo-google-fonts/noto-serif-sc/400Regular/NotoSerifSC_400Regular.ttf'),
          font('@expo-google-fonts/noto-serif-sc/700Bold/NotoSerifSC_700Bold.ttf'),
          font('@expo-google-fonts/noto-emoji/400Regular/NotoEmoji_400Regular.ttf'),
          font('@expo-google-fonts/noto-sans-mono/400Regular/NotoSansMono_400Regular.ttf'),
        ],
        { assets: false },
      ),
    ],
    getModule: () => wasm,
  })
  compiler.addSource('/main.typ', main)
  for (const chapter of chapters) compiler.addSource(chapter.path, chapter.source)
  const result = await compiler.compile({
    mainFilePath: '/main.typ',
    format: CompileFormatEnum.pdf,
    diagnostics: 'unix',
  })
  if (!result.result) throw new Error('typst 编译失败: ' + JSON.stringify(result.diagnostics))
  return result.result
}

type TextLine = {
  page: number
  /** Baseline position, PDF user space (y grows upwards). */
  baseline: number
  top: number
  bottom: number
  x0: number
  x1: number
  text: string
}

/**
 * One entry per printed line. Glyph boxes are approximated from the font size:
 * Typst sets a line box of 0.73em, 0.61em above the baseline and 0.12em below.
 */
async function textLines(pdf: Uint8Array): Promise<TextLine[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loading = pdfjs.getDocument({
    data: pdf.slice(),
    useSystemFonts: false,
    disableFontFace: true,
  })
  const document = await loading.promise
  const lines: TextLine[] = []
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index)
    const content = await page.getTextContent()
    const rows = new Map<number, TextLine>()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const transform = item.transform as number[]
      const size = Math.abs(transform[3]) || item.height
      const x = transform[4]
      const baseline = Math.round(transform[5] * 10) / 10
      const row = rows.get(baseline)
      rows.set(baseline, {
        page: index,
        baseline,
        top: Math.max(row?.top ?? Number.NEGATIVE_INFINITY, baseline + size * 0.61),
        bottom: Math.min(row?.bottom ?? Number.POSITIVE_INFINITY, baseline - size * 0.12),
        x0: Math.min(row?.x0 ?? Number.POSITIVE_INFINITY, x),
        x1: Math.max(row?.x1 ?? 0, x + item.width),
        text: (row?.text ?? '') + item.str,
      })
    }
    lines.push(...[...rows.values()].sort((a, b) => b.baseline - a.baseline))
  }
  await loading.destroy()
  return lines
}

async function textItems(pdf: Uint8Array): Promise<{ text: string; x0: number; x1: number }[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loading = pdfjs.getDocument({ data: pdf.slice(), useSystemFonts: false, disableFontFace: true })
  const document = await loading.promise
  const items: { text: string; x0: number; x1: number }[] = []
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index)
    const content = await page.getTextContent()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const x = (item.transform as number[])[4]
      items.push({ text: item.str, x0: x, x1: x + item.width })
    }
  }
  await loading.destroy()
  return items
}

/** Printed font size of every text run, in document order. */
async function textSizes(pdf: Uint8Array): Promise<{ text: string; size: number }[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loading = pdfjs.getDocument({
    data: pdf.slice(),
    useSystemFonts: false,
    disableFontFace: true,
  })
  const document = await loading.promise
  const sizes: { text: string; size: number }[] = []
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index)
    const content = await page.getTextContent()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      sizes.push({ text: item.str, size: item.height })
    }
  }
  await loading.destroy()
  return sizes
}

/** Base font names embedded per page, in document order. */
async function fontNames(pdf: Uint8Array): Promise<string[][]> {
  const document = await PDFDocument.load(pdf, { updateMetadata: false })
  return document.getPages().map((page) => {
    const fonts = page.node.Resources()?.lookup(PDFName.of('Font'))
    if (!(fonts instanceof PDFDict)) return []
    const names: string[] = []
    for (const [, ref] of fonts.entries()) {
      const font = document.context.lookup(ref)
      if (font instanceof PDFDict) names.push(String(font.lookup(PDFName.of('BaseFont'))))
    }
    return names
  })
}

/** Pairs of lines whose glyph boxes intersect. */
function overlappingLines(lines: readonly TextLine[]): string[] {
  const found: string[] = []
  for (let index = 1; index < lines.length; index += 1) {
    const previous = lines[index - 1]
    const current = lines[index]
    if (previous.page !== current.page) continue
    // 0.3pt of slack absorbs the approximation in the glyph boxes.
    if (current.top > previous.bottom + 0.3) {
      found.push(
        `第${current.page}页 "${previous.text.slice(0, 16)}" 与 "${current.text.slice(0, 16)}" ` +
          `重叠 ${(current.top - previous.bottom).toFixed(1)}pt`,
      )
    }
  }
  return found
}

const wrapper = (content: readonly unknown[]) =>
  JSON.stringify({ type: 'biglazycat_editor_content', version: 3, doc: { type: 'doc', content } })
const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const heading = (text: string, level: number) => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
})

/**
 * Consecutive one-line paragraphs: the shape a poem takes, and the shape that
 * printed on top of itself while paragraph spacing was 0pt.
 */
const POEM = [
  '曰：三阳交泰产群生，仙石胞含日月精。',
  '借卵化猴完大道，假他名姓配丹成。',
  '内观不识因无相，外合明知作有形。',
  '历代人人皆属此，称王称圣任纵横。',
].map(paragraph)

/** One of each block the renderer can emit, each followed by a paragraph. */
const EVERY_BLOCK: unknown[] = [
  paragraph('普通段落，后面紧跟一个标题。'),
  heading('二级标题', 2),
  paragraph('标题后的第一段。'),
  paragraph('紧接的第二段，只有一行。'),
  heading('三级标题', 3),
  paragraph('短段。'),
  { type: 'blockquote', content: [paragraph('引文第一行。'), paragraph('引文第二行。')] },
  paragraph('引文之后的段落。'),
  {
    type: 'bulletList',
    content: [
      { type: 'listItem', content: [paragraph('列表项一')] },
      { type: 'listItem', content: [paragraph('列表项二')] },
    ],
  },
  paragraph('列表之后的段落。'),
  { type: 'codeBlock', content: [{ type: 'text', text: 'const a = 1\nconst b = 2' }] },
  paragraph('代码块之后的段落。'),
  {
    type: 'table',
    content: [
      {
        type: 'tableRow',
        content: [
          { type: 'tableHeader', content: [paragraph('表头一')] },
          { type: 'tableHeader', content: [paragraph('表头二')] },
        ],
      },
      {
        type: 'tableRow',
        content: [
          { type: 'tableCell', content: [paragraph('单元格一')] },
          { type: 'tableCell', content: [paragraph('单元格二')] },
        ],
      },
    ],
  },
  paragraph('表格之后的段落。'),
  { type: 'horizontalRule' },
  paragraph('分隔线之后的段落。'),
  paragraph('很长的一段，用来确认两端对齐与换行不会把文字推出页面边界。'.repeat(6)),
  ...POEM,
]

function manuscriptOf(content: readonly unknown[], withVolume: boolean, title = '西游记'): WorkExportManuscript {
  return {
    novel_id: 'novel-1',
    title,
    synopsis: '',
    workspace_kind: 'writing',
    word_count: 100,
    volumes: withVolume
      ? [{ path: 'v1', parent_path: '', title: '第一卷', chapter_count: 2, word_count: 100 }]
      : [],
    chapters: [
      {
        id: 'c1',
        volume_path: withVolume ? 'v1' : '',
        title: '第一回　灵根育孕源流出',
        synopsis: '',
        content: wrapper(content),
        word_count: 50,
        created_at: '',
        updated_at: '2026-10-20T00:00:00Z',
      },
      {
        id: 'c2',
        volume_path: withVolume ? 'v1' : '',
        title: '第二回　悟彻菩提真妙理',
        synopsis: '',
        content: wrapper(POEM),
        word_count: 50,
        created_at: '',
        updated_at: '2026-10-20T00:00:00Z',
      },
    ],
  }
}

async function renderPdf(
  content: readonly unknown[],
  withVolume = false,
  title = '西游记',
  pdf: Partial<PdfExportSettings> = {},
): Promise<Uint8Array> {
  const settings = createDefaultWorkExportSettings({ title })
  const book = buildWorkBook({
    manuscript: manuscriptOf(content, withVolume, title),
    common: settings.common,
    content: settings.content,
  })
  const pdfSettings = { ...settings.pdf, includeCover: false, ...pdf }
  const source = await buildTypstBookSource({
    book,
    settings: pdfSettings,
    contentWidthPt: typstContentWidthPt(pdfSettings),
    imageSrc: () => null,
    mermaidSrc: () => null,
    formulaSrc: () => null,
  })
  return compilePdf(source.main, source.chapters)
}

async function renderLines(content: readonly unknown[], withVolume = false): Promise<TextLine[]> {
  return textLines(await renderPdf(content, withVolume))
}

describe('pdf prose layout', () => {
  it('never prints consecutive paragraphs on top of each other', async () => {
    const lines = await renderLines(POEM)
    expect(lines.length).toBeGreaterThan(4)
    expect(overlappingLines(lines)).toEqual([])
  }, 180_000)

  it('separates paragraphs by at least one line pitch and no more', async () => {
    const lines = await renderLines(POEM)
    // Both chapters carry the poem; the first four lines are the first chapter.
    const poem = lines.filter((line) => /三阳|借卵|内观|历代/.test(line.text)).slice(0, 4)
    expect(poem.length).toBe(4)
    const pitches = poem.slice(1).map((line, index) => poem[index].baseline - line.baseline)
    // A paragraph break may not be tighter than a line break (that is what
    // printed on top of itself) nor looser than 1.4 lines (that is what the
    // line-spacing multiplier used as a leading produced).
    for (const pitch of pitches) {
      expect(pitch).toBeGreaterThanOrEqual(PITCH - 0.2)
      expect(pitch).toBeLessThanOrEqual(PITCH * 1.4)
    }
    // Every break is the same: a poem must not breathe unevenly.
    expect(Math.max(...pitches) - Math.min(...pitches)).toBeLessThan(1)
  }, 180_000)

  it('sets running text at the requested line spacing', async () => {
    const lines = await renderLines([paragraph('很长的一段，用来确认行距。'.repeat(30))])
    const body = lines.filter((line) => line.text.includes('很长的一段'))
    expect(body.length).toBeGreaterThan(2)
    const pitches = body.slice(1).map((line, index) => body[index].baseline - line.baseline)
    for (const pitch of pitches) expect(pitch).toBeCloseTo(PITCH, 0)
  }, 180_000)

  it('keeps every block off its neighbour, with and without volumes', async () => {
    for (const withVolume of [false, true]) {
      const lines = await renderLines(EVERY_BLOCK, withVolume)
      expect(overlappingLines(lines)).toEqual([])
    }
  }, 240_000)

  it('wraps a long database url inside the table and keeps the running header packed above its rule', async () => {
    const url = 'jdbc:postgresql://172.16.0.1:5432/supervision_uacs?currentSchema=business_data,base_data,public&stringtype=unspecified'
    const title = '飞行服务与监管部署说明'
    const pdf = await renderPdf([
      paragraph('两个独立 database 与独立业务用户，跨库互不可连。'),
      {
        type: 'table',
        content: [
          { type: 'tableRow', content: ['系统', 'JDBC URL', '用户'].map((cell) => ({ type: 'tableHeader', content: [paragraph(cell)] })) },
          { type: 'tableRow', content: ['一网通飞', url, '甲'].map((cell) => ({ type: 'tableCell', content: [paragraph(cell)] })) },
        ],
      },
    ], false, title, {
      includeTitlePage: false,
      includeCopyright: false,
      includeToc: false,
    })
    const lines = await textLines(pdf)
    // A5 is 419.53pt wide and the outside margin is 16mm, so ink past this
    // point has left the text block.
    const overflowing = lines.filter((line) => line.x1 > 380)
    expect(overflowing.map((line) => `${line.text.slice(0, 24)} @${line.x1.toFixed(1)}`)).toEqual([])
    const items = await textItems(pdf)
    const user = items.find((item) => item.text === '用户')
    const leaked = items.filter((item) => /jdbc|Schema|supervision|stringtype|public/.test(item.text) && item.x1 > (user?.x0 ?? 0) - 1)
    expect(leaked.map((item) => `${item.text.slice(0, 32)} ${item.x0.toFixed(0)}-${item.x1.toFixed(0)} user@${user?.x0.toFixed(0)}`)).toEqual([])
    const header = lines.find((line) => line.text.includes(title) && line.text.length < title.length + 4)
    expect(header).toBeTruthy()
    expect((header?.x1 ?? 0) - (header?.x0 ?? 0)).toBeLessThan(160)
  }, 180_000)

  it('keeps every line inside the page', async () => {
    const lines = await renderLines(EVERY_BLOCK)
    // A5 is 419.53pt wide; nothing may reach the trimmed edge.
    const overflowing = lines.filter((line) => line.x1 > 419.53 - 10 || line.x0 < 10)
    expect(overflowing.map((line) => `${line.text.slice(0, 16)} @${line.x1.toFixed(1)}`)).toEqual(
      [],
    )
  }, 180_000)

  it('prints icons with an emoji face instead of a missing-glyph box', async () => {
    const pdf = await renderPdf([
      heading('⛔ 开场：费曼学习法的最后一步', 2),
      paragraph('🚀 一句话讲清楚：装 Node → 配模型密钥。'),
    ])
    const pages = await fontNames(pdf)
    expect(pages.flat().some((name) => name.includes('NotoEmoji'))).toBe(true)
  }, 180_000)

  it('prints code in a monospace face', async () => {
    const pdf = await renderPdf([
      { type: 'codeBlock', attrs: { language: 'bash' }, content: [{ type: 'text', text: 'npm run dev' }] },
    ])
    const pages = await fontNames(pdf)
    expect(pages.flat().some((name) => name.includes('NotoSansMono'))).toBe(true)
  }, 180_000)

  it('keeps code close to body size', async () => {
    // Typst shrinks a raw element to 0.8em on its own; the show rule has to
    // compensate or code prints at 70% of the body and reads like a footnote.
    const pdf = await renderPdf([
      { type: 'codeBlock', attrs: { language: 'bash' }, content: [{ type: 'text', text: 'npm run dev' }] },
    ])
    const sizes = await textSizes(pdf)
    const code = sizes.filter((entry) => /npm|dev/.test(entry.text))
    expect(code.length).toBeGreaterThan(0)
    for (const entry of code) {
      expect(entry.size).toBeGreaterThan(BODY_SIZE * 0.82)
      expect(entry.size).toBeLessThan(BODY_SIZE)
    }
  }, 180_000)
})
