import '../test-i18n'
import { describe, expect, it } from 'vitest'
import {
  buildTypstBookSource,
  collectTypstFigureNumbers,
  renderDocTypst,
  typstContentWidthPt,
  typstString,
  type BuildTypstBookSourceInput,
  type TypstAssetRef,
  type TypstJsonNode,
  type TypstRenderOptions,
} from './typst-source'
import { isCancelError } from './progress'
import { applyPdfPreset } from './presets'
import { createPageFooter, createPageHeader } from './page-band'
import type {
  BookChapter,
  BookMetadata,
  BookVolume,
  PdfExportSettings,
  WorkBookModel,
} from './types'

const FIGURE: TypstAssetRef = { path: '/assets/img.png', width: 320, height: 200 }

function textNode(value: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) {
  return marks ? { type: 'text', text: value, marks } : { type: 'text', text: value }
}

function paragraph(...children: unknown[]) {
  return { type: 'paragraph', content: children }
}

function docJson(...blocks: unknown[]) {
  return { type: 'doc', content: blocks }
}

function renderOptions(overrides: Partial<TypstRenderOptions> = {}): TypstRenderOptions {
  return {
    headingOffset: 1,
    contentWidthPt: 300,
    tableSizePt: 9.5,
    imageSrc: (src) => (src === 'asset://inner' ? FIGURE : null),
    mermaidSrc: () => null,
    formulaSrc: () => null,
    figureNumbers: new Map(),
    ...overrides,
  }
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

interface BookOverrides {
  meta?: Partial<BookMetadata>
  includeVolumeTitles?: boolean
  includeToc?: boolean
  chapters?: BookChapter[]
  volumes?: BookVolume[]
  rootChapters?: BookChapter[]
}

function bookFixture(overrides: BookOverrides = {}): WorkBookModel {
  const root = chapter('c0', '', '根章', docJson(paragraph(textNode('根章正文。'))), '根章梗概')
  const first = chapter(
    'c1',
    'v1',
    '第一章',
    docJson(
      { type: 'heading', attrs: { level: 1 }, content: [textNode('章内标题')] },
      paragraph(textNode('第一章正文。')),
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
      ...overrides.meta,
    },
    options: {
      includeVolumeTitles: overrides.includeVolumeTitles ?? true,
      includeChapterSynopsis: true,
      includeToc: overrides.includeToc ?? true,
    },
    chapters: overrides.chapters ?? [root, first, second],
    volumes: overrides.volumes ?? [volume],
    rootChapters: overrides.rootChapters ?? [root],
    wordCount: 300,
  }
}

async function buildSource(
  settings: Partial<PdfExportSettings> = {},
  bookOverrides: BookOverrides = {},
  input: Partial<BuildTypstBookSourceInput> = {},
) {
  const pdfSettings: PdfExportSettings = { ...applyPdfPreset('reading'), ...settings }
  return buildTypstBookSource({
    book: bookFixture(bookOverrides),
    settings: pdfSettings,
    contentWidthPt: typstContentWidthPt(pdfSettings),
    imageSrc: () => null,
    mermaidSrc: () => null,
    formulaSrc: () => null,
    ...input,
  })
}

describe('typstString', () => {
  it('escapes backslashes, quotes, newlines, tabs and strips control characters', () => {
    expect(typstString('反斜杠\\引号"换行\n制表\t控制')).toBe(
      '"反斜杠\\\\引号\\"换行\\n制表\\t控制"',
    )
    expect(typstString('a\r\nb')).toBe('"a\\nb"')
    expect(typstString(null)).toBe('""')
  })
})

describe('renderDocTypst', () => {
  it('lets a long identifier break instead of running past the margin', () => {
    const output = renderDocTypst(
      docJson(paragraph(textNode('platform/v1/airspace-applications/status'))) as TypstJsonNode,
      renderOptions(),
    )
    expect(output).toContain('#text("\\u{ad}")')
    expect(output).toContain('#text("platform")#text("\\u{ad}")#text("/")')
    expect(output).not.toContain('#text("platform/v1/airspace-applications/status")')
    const plain = renderDocTypst(
      docJson(paragraph(textNode('短句。'))) as TypstJsonNode,
      renderOptions(),
    )
    expect(plain).not.toContain('#text("\\u{ad}")')
  })

  it('renders inline marks with Typst functions and keeps code literal', () => {
    const output = renderDocTypst(
      docJson(
        paragraph(
          textNode('粗体', [{ type: 'bold' }]),
          textNode('斜体', [{ type: 'italic' }]),
          textNode('删除', [{ type: 'strike' }]),
          textNode('下划', [{ type: 'underline' }]),
          textNode('高亮', [{ type: 'highlight' }]),
          textNode('代码"x"', [{ type: 'code' }]),
          textNode('上标', [{ type: 'superscript' }]),
          textNode('下标', [{ type: 'subscript' }]),
        ),
      ) as TypstJsonNode,
      renderOptions(),
    )
    expect(output).toContain('#strong[#text("粗体")]')
    expect(output).toContain('#emph[#text("斜体")]')
    expect(output).toContain('#strike[#text("删除")]')
    expect(output).toContain('#underline[#text("下划")]')
    expect(output).toContain('#highlight[#text("高亮")]')
    expect(output).toContain('#raw("代码\\"x\\"")')
    expect(output).toContain('#super[#text("上标")]')
    expect(output).toContain('#sub[#text("下标")]')
  })

  it('only emits http/https/mailto links', () => {
    const output = renderDocTypst(
      docJson(
        paragraph(
          textNode('安全', [{ type: 'link', attrs: { href: 'https://example.com/a?b=1' } }]),
          textNode('邮件', [{ type: 'link', attrs: { href: 'mailto:a@example.com' } }]),
          textNode('危险', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]),
        ),
      ) as TypstJsonNode,
      renderOptions(),
    )
    expect(output).toContain('#link("https://example.com/a?b=1")[#text("安全")]')
    expect(output).toContain('#link("mailto:a@example.com")[#text("邮件")]')
    expect(output).toContain('#text("危险")')
    expect(output).not.toContain('javascript:')
    expect(output.match(/#link\(/g)).toHaveLength(2)
  })

  it('offsets and clamps heading levels', () => {
    const output = renderDocTypst(
      docJson(
        { type: 'heading', attrs: { level: 1 }, content: [textNode('一')] },
        { type: 'heading', attrs: { level: 6 }, content: [textNode('六')] },
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'center' },
          content: [textNode('中')],
        },
      ) as TypstJsonNode,
      renderOptions({ headingOffset: 2 }),
    )
    expect(output).toContain('#heading(level: 3, outlined: true)[#text("一")]')
    expect(output).toContain('#heading(level: 6, outlined: true)[#text("六")]')
    expect(output).toContain('#heading(level: 4, outlined: true)[#align(center)[#text("中")]]')
  })

  it('renders paragraph alignment and indent as scoped set rules', () => {
    const output = renderDocTypst(
      docJson(
        { type: 'paragraph', attrs: { textAlign: 'center' }, content: [textNode('居中')] },
        { type: 'paragraph', attrs: { textAlign: 'justify' }, content: [textNode('齐行')] },
        { type: 'paragraph', attrs: { indent: 4 }, content: [textNode('缩进')] },
      ) as TypstJsonNode,
      renderOptions(),
    )
    expect(output).toContain('#align(center)[#block(width: 100%)[#set par(first-line-indent: 0em)')
    expect(output).toContain('#set par(justify: true)')
    expect(output).toContain('#set par(first-line-indent: 4em)')
  })

  it('embeds images with figure captions and falls back for missing ones', () => {
    const captioned = { type: 'image', attrs: { src: 'asset://inner', alt: '插图', caption: '说明' } }
    const figureNumbers = new Map<TypstJsonNode, number>([[captioned as TypstJsonNode, 2]])
    const output = renderDocTypst(
      docJson(
        captioned,
        { type: 'image', attrs: { src: 'asset://missing', alt: '缺失图' } },
        { type: 'image', attrs: { src: 'asset://inner', alt: '无说明' } },
      ) as TypstJsonNode,
      renderOptions({ figureNumbers }),
    )
    expect(output).toContain(
      '#figure(image("/assets/img.png", width: 240pt, alt: "图片"), caption: [#text("图 2 说明")], numbering: none)',
    )
    expect(output).toContain('[图片缺失：缺失图]')
    expect(output).toContain('#align(center)[#image("/assets/img.png", width: 240pt, alt: "图片")]')
  })

  it('uses the full content width for wide images', () => {
    const wide: TypstAssetRef = { path: '/assets/wide.png', width: 800, height: 400 }
    const output = renderDocTypst(
      docJson({ type: 'image', attrs: { src: 'asset://wide' } }) as TypstJsonNode,
      renderOptions({ imageSrc: () => wide }),
    )
    expect(output).toContain('#image("/assets/wide.png", width: 100%, alt: "图片")')
  })

  it('renders formulas as images when rendered, otherwise raw TeX fallback', () => {
    const inline = { type: 'formula', attrs: { latex: 'E = mc^2', displayMode: false } }
    const display = { type: 'formula', attrs: { latex: 'x^2', displayMode: true } }
    const fallback = renderDocTypst(docJson(paragraph(inline), display) as TypstJsonNode, renderOptions())
    expect(fallback).toContain('#raw("$E = mc^2$")')
    expect(fallback).toContain('#raw("$$x^2$$", block: true)')

    const formulaRef: TypstAssetRef = { path: '/assets/formula.png', width: 200, height: 60 }
    const rendered = renderDocTypst(
      docJson(paragraph(inline), display) as TypstJsonNode,
      renderOptions({ formulaSrc: () => formulaRef }),
    )
    expect(rendered).toContain('#image("/assets/formula.png", height: 1.15em, alt: "公式")')
    expect(rendered).toContain('#align(center)[#image("/assets/formula.png", width: 150pt, alt: "图片")]')
  })

  it('renders bullet, ordered and task lists', () => {
    const item = (value: string, attrs?: Record<string, unknown>) => ({
      type: 'listItem',
      attrs,
      content: [paragraph(textNode(value))],
    })
    const output = renderDocTypst(
      docJson(
        { type: 'bulletList', content: [item('甲'), item('乙')] },
        { type: 'orderedList', attrs: { start: 3 }, content: [item('三'), item('四')] },
        {
          type: 'taskList',
          content: [
            { type: 'taskItem', attrs: { checked: true }, content: [paragraph(textNode('做完'))] },
            { type: 'taskItem', attrs: { checked: false }, content: [paragraph(textNode('待办'))] },
          ],
        },
      ) as TypstJsonNode,
      renderOptions(),
    )
    expect(output).toContain('#list([#set par(first-line-indent: 0em)\n#text("甲")]')
    expect(output).toContain('#enum(start: 3,')
    // A checklist draws its box: `☐` (U+2610) has no glyph in the bundled
    // fonts and printed as tofu, and the bullet would double up with the box.
    expect(output).toContain('marker: none')
    expect(output).toMatch(
      /#box\(width: 0\.92em, height: 0\.92em, stroke: 0\.6pt \+ luma\(120\), radius: 1\.5pt, baseline: 0\.12em, fill: luma\(245\)\)\[#align\(center \+ horizon\)\[#text\(size: 0\.72em, weight: "bold"\)\[✓\]\]\]/,
    )
    expect(output).toContain('#text("做完")')
    expect(output).toContain('#text("待办")')
    expect(output).not.toContain('☐')
    expect(output).not.toContain('☑')
  })

  it('renders tables with a header row and colspan cells', () => {
    const output = renderDocTypst(
      docJson({
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [paragraph(textNode('表头一'))] },
              { type: 'tableHeader', content: [paragraph(textNode('表头二'))] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', attrs: { colspan: 2 }, content: [paragraph(textNode('合并'))] },
            ],
          },
        ],
      }) as TypstJsonNode,
      renderOptions(),
    )
    expect(output).toContain(
      'table.header(table.cell(fill: luma(247))[#strong[#text("表头一")]], table.cell(fill: luma(247))[#strong[#text("表头二")]])',
    )
    expect(output).toContain('table.cell(colspan: 2)[#text("合并")]')
    // Equal columns that fill the measure: a content-sized table is centred by
    // Typst and leaves an uneven gap at the right edge.
    expect(output).toContain('#table(columns: (1fr, 1fr),')
  })

  it('renders callouts, collapsibles, quotes, rules and breaks', () => {
    const output = renderDocTypst(
      docJson(
        { type: 'callout', attrs: { kind: 'warn' }, content: [paragraph(textNode('小心'))] },
        {
          type: 'collapsible',
          content: [
            { type: 'collapsibleSummary', content: [textNode('更多')] },
            paragraph(textNode('折叠内容')),
          ],
        },
        { type: 'blockquote', content: [paragraph(textNode('引用'))] },
        { type: 'horizontalRule' },
        { type: 'pageBreak' },
      ) as TypstJsonNode,
      renderOptions(),
    )
    expect(output).toContain('fill: rgb("#fffbeb")')
    expect(output).toContain('#text("注意")')
    expect(output).toContain('#text("更多")')
    expect(output).toContain('stroke: (left: 2pt + luma(180))')
    expect(output).toContain('#line(length: 100%, stroke: 0.5pt + luma(180))')
    expect(output).toContain('#pagebreak()')
  })

  it('renders mermaid blocks as images when rendered, otherwise raw code', () => {
    const mermaid = {
      type: 'codeBlock',
      attrs: { language: 'mermaid' },
      content: [textNode('graph TD; A-->B;')],
    }
    const withImage = renderDocTypst(
      docJson(mermaid) as TypstJsonNode,
      renderOptions({ mermaidSrc: () => ({ path: '/assets/mermaid.png', width: 400, height: 240 }) }),
    )
    expect(withImage).toContain('#image("/assets/mermaid.png", width: 100%, alt: "图片")')
    expect(withImage).not.toContain('#raw')

    const fallback = renderDocTypst(docJson(mermaid) as TypstJsonNode, renderOptions())
    expect(fallback).toContain('#raw("graph TD; A-->B;", lang: "mermaid", block: true)')
  })

  it('renders placeholders for canvas embeds and skips toc blocks', () => {
    const output = renderDocTypst(
      docJson(
        { type: 'flowCanvas', attrs: { title: '画布甲' } },
        { type: 'mindMapEmbed', attrs: {} },
        { type: 'tocBlock' },
      ) as TypstJsonNode,
      renderOptions(),
    )
    expect(output).toContain('[流程画布] 画布甲')
    expect(output).toContain('[思维导图] 未命名思维导图')
    expect(output).not.toContain('tocBlock')
  })
})

describe('collectTypstFigureNumbers', () => {
  it('numbers captioned images across chapters in document order', () => {
    const firstImage = { type: 'image', attrs: { src: 'a', caption: '一' } }
    const unnumbered = { type: 'image', attrs: { src: 'b', caption: '不占号', captionNumbered: false } }
    const secondImage = { type: 'image', attrs: { src: 'c', caption: '二' } }
    const book = {
      chapters: [
        { doc: docJson(firstImage, unnumbered) },
        { doc: docJson(secondImage) },
      ],
    }
    const numbers = collectTypstFigureNumbers(book)
    expect(numbers.get(firstImage as TypstJsonNode)).toBe(1)
    expect(numbers.get(secondImage as TypstJsonNode)).toBe(2)
    expect(numbers.has(unnumbered as TypstJsonNode)).toBe(false)
  })
})

describe('pdf typography defaults', () => {
  it('turns the line-spacing multiplier into the leading Typst expects', async () => {
    // Typst's line pitch is `0.73em + leading`, so a 1.7 multiplier must become
    // 0.97em of leading. Passing 1.7 straight through printed 2.4 lines apart.
    const { main } = await buildSource()
    expect(main).toContain('leading: 0.97em')
    // A paragraph break has to be at least one pitch to read as a break.
    expect(main).toContain('spacing: 1.22em')

    const tight = await buildSource({ lineSpacing: 1.5, bodySizePt: 12 })
    expect(tight.main).toContain('leading: 0.77em')
    expect(tight.main).toContain('spacing: 1.02em')
  })

  it('sizes headings off the body text and keeps the gap above larger', async () => {
    const { main } = await buildSource()
    // 10.5pt body, 1.7 line spacing → 17.85pt pitch.
    expect(main).toContain('#text(size: 20pt, weight: "bold")[#it.body]')
    expect(main).toContain('#text(size: 15.8pt, weight: "bold")[#it.body]')
    expect(main).toContain('#text(size: 13.4pt, weight: "bold")[#it.body]')
    expect(main).toContain('#text(size: 12pt, weight: "bold")[#it.body]')
    // Level 2: 1.1 pitch above, 0.5 pitch below.
    expect(main).toContain('above: 19.6pt, below: 8.9pt, width: 100%, sticky: true')
    // Only the chapter title is centred; section headings stay flush left so a
    // wrapped heading is not centred line by line.
    expect(main).toContain('#align(center)[#text(size: 20pt')
    expect(main).not.toContain('#align(center)[#text(size: 15.8pt')
  })

  it('draws list markers and gives code a monospace face', async () => {
    const { main } = await buildSource()
    expect(main).toContain('circle(radius: 0.12em, fill: black)')
    expect(main).toContain('marker: (')
    expect(main).toContain('#show raw: set text(font: ("Noto Sans Mono", "Noto Emoji", "Noto Serif SC"))')
  })
})

describe('buildTypstBookSource', () => {
  it('writes document metadata, page styles and front matter into the main source', async () => {
    const { main, chapters } = await buildSource()
    expect(main).toContain(
      '#set document(title: "测试书", author: "作者甲", keywords: ("小说", "测试",), date: datetime(year: 2026, month: 10, day: 20))',
    )
    expect(main).toContain(
      '#set page(paper: "a5", margin: (top: 18mm, bottom: 18mm, left: 20mm, right: 16mm), numbering: none, header: none, footer: none)',
    )
    expect(main).toContain(
      '#set page(paper: "a5", margin: (top: 18mm, bottom: 18mm, inside: 20mm, outside: 16mm), numbering: none, header: context {',
    )
    expect(main).toContain('align(left)[#text("测试书")]')
    expect(main).toContain('align(center)[#counter(page).display()]')
    expect(main).toContain('#counter(page).update(1)')
    expect(main).toContain(
      '#set text(font: ("Noto Serif SC", "Noto Emoji"), size: 10.5pt, hyphenate: true, lang: "zh", region: "cn")',
    )
    const custom = await buildSource({ bodyFont: 'Source Han Serif SC' })
    expect(custom.main).toContain(
      '#set text(font: ("Source Han Serif SC", "Noto Emoji", "Noto Serif SC"), size: 10.5pt, hyphenate: true, lang: "zh", region: "cn")',
    )
    expect(main).toContain('#outline(title: [目录], depth: 2, indent: auto)')
    expect(main).toContain('margin: 0pt')
    expect(main).toContain('大懒猫创作平台')
    expect(main).toContain('ISBN：9780306406157')
    expect(main).toContain('#text("内容简介")')
    for (const title of ['封面', '扉页', '版权信息', '内容简介', '目录']) {
      expect(main).toContain(
        `#place(top + left)[#heading(level: 2, outlined: false, bookmarked: true)[#hide[#text("${title}")]]]`,
      )
    }
    expect(chapters.map((file) => file.path)).toEqual([
      '/chapters/0001.typ',
      '/chapters/0002.typ',
      '/chapters/0003.typ',
    ])
  })

  it('orders root chapters before volume groups and offsets headings', async () => {
    const { main, chapters } = await buildSource()
    const positions = [
      main.indexOf('#include "chapters/0001.typ"'),
      main.indexOf('#text("第一卷")'),
      main.indexOf('#include "chapters/0002.typ"'),
      main.indexOf('#include "chapters/0003.typ"'),
    ]
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions]).toEqual([...positions].sort((a, b) => a - b))
    expect(main).toContain('#heading(level: 1, outlined: true)[#text("第一卷")]')

    const first = chapters[1].source
    expect(first).toContain('#heading(level: 2, outlined: true)[#text("第一章")]')
    expect(first).toContain('#heading(level: 3, outlined: true)[#text("章内标题")]')
    expect(first).toContain('#text("第一章梗概")')
    expect(chapters[0].source).toContain('#heading(level: 2, outlined: true)[#text("根章")]')
  })

  it('flattens heading levels when volume titles are disabled', async () => {
    const { main, chapters } = await buildSource({}, { includeVolumeTitles: false })
    expect(main).not.toContain('#heading(level: 1, outlined: true)[#text("第一卷")]')
    expect(main).not.toContain('第一卷')
    expect(main).toContain('#heading(level: 1, outlined: false, bookmarked: true)[#hide[#text("扉页")]]')
    expect(chapters[0].source).toContain('#heading(level: 1, outlined: true)[#text("根章")]')
    expect(chapters[1].source).toContain('#heading(level: 2, outlined: true)[#text("章内标题")]')
  })

  it('honours front matter toggles and synopsis control', async () => {
    const { main } = await buildSource(
      { includeCover: false, includeTitlePage: false, includeCopyright: false },
      { includeToc: false },
      { includeSynopsis: false },
    )
    expect(main).not.toContain('margin: 0pt')
    expect(main).not.toContain('#outline(')
    expect(main).not.toContain('#text("内容简介")')
    expect(main).not.toContain('ISBN：')
    expect(main).not.toContain('bookmarked: true')
    expect(main).toContain('#counter(page).update(1)')
  })

  it('renders configurable header and footer bands', async () => {
    const none = await buildSource({
      header: createPageHeader(false),
      footer: createPageFooter(false),
    })
    const bodySet = none.main.slice(none.main.indexOf('inside:'))
    expect(bodySet).not.toContain('footer:')
    expect(bodySet).not.toContain('header:')

    const total = await buildSource({
      footer: createPageFooter(true, { pageNumberFormat: 'x-of-y' }),
    })
    expect(total.main).toContain('#counter(page).display()')
    expect(total.main).toContain('#counter(page).final().first()')

    const manuscript = await buildSource({
      preset: 'manuscript',
      footer: createPageFooter(true, { pageNumberFormat: 'page-x' }),
    })
    expect(manuscript.main).toContain('#text("第 ")#counter(page).display()#text(" 页")')
  })

  it('resolves metadata tokens and draws the separator in three columns', async () => {
    const { main } = await buildSource({
      header: createPageHeader(true, {
        left: '{author}',
        right: '{title}',
        separator: 'dashed',
      }),
    })
    expect(main).toContain('#text("作者甲")')
    expect(main).toContain('#text("测试书")')
    expect(main).toContain('dash: "dashed"')
    expect(main).toContain('#grid(columns: (1fr, 0pt, 1fr), column-gutter: 0.9em')
    expect(main).toContain('#set par(justify: false, first-line-indent: 0em, spacing: 0.2em)')
    const header = main.slice(main.indexOf('header: context'))
    expect(header.indexOf('#text("测试书")')).toBeLessThan(header.indexOf('#v(2pt)'))
    expect(header.indexOf('#v(2pt)')).toBeLessThan(header.indexOf('#line(length: 100%'))
  })

  it('does not add a second page number when the template already has one', async () => {
    const { main } = await buildSource({
      footer: createPageFooter(true, {
        left: '第 {page} 页',
        pageNumberPosition: 'right',
        pageNumberFormat: 'x-of-y',
      }),
    })
    expect(main).toContain('#text("第 ")#counter(page).display()#text(" 页")')
    expect(main).not.toContain(' / #counter(page).final().first()')
  })

  it('embeds the header logo at the configured height', async () => {
    const { main } = await buildSource({}, {}, {
      branding: { path: '/assets/logo.png', heightMm: 8 },
    })
    expect(main).toContain('#image("/assets/logo.png", height: 8mm)')
  })

  it('adds a watermark to every page style', async () => {
    const { main } = await buildSource({ watermark: '内部资料' })
    const occurrences = main.match(
      /background: place\(center \+ horizon, rotate\(-30deg, text\(size: 60pt, fill: luma\(225\)\)\["内部资料"\]\)\)/g,
    )
    expect(occurrences?.length).toBeGreaterThanOrEqual(2)
  })

  it('asks Typst for ISO B5 instead of the unknown paper name b5', async () => {
    const { main } = await buildSource({ paper: 'b5' })
    expect(main).toContain('paper: "iso-b5"')
    expect(main).not.toContain('paper: "b5"')
  })

  it('uses mirrored margins with a gutter and odd page starts for the print preset', async () => {
    const { main } = await buildSource(applyPdfPreset('print'))
    expect(main).toContain('width: 185mm, height: 260mm')
    expect(main).not.toContain('paper: (width:')
    expect(main).toContain('inside: 27mm, outside: 18mm')
    expect(main).toContain('binding: left')
    expect(main).toContain('#pagebreak(to: "odd")')
  })

  it('separates chapters with plain page breaks by default', async () => {
    const { main } = await buildSource()
    expect(main).toContain('#include "chapters/0001.typ"\n#pagebreak()')
    expect(main).not.toContain('#pagebreak(to: "odd")')
  })

  it('omits invalid metadata fields', async () => {
    const { main } = await buildSource({}, { meta: { publicationDate: '2026-13-40', keywords: [] } })
    expect(main).not.toContain('datetime(')
    expect(main).not.toContain('keywords:')
  })

  it('reports chapter progress and honours cancellation', async () => {
    const seen: Array<[number, number]> = []
    await buildSource({}, {}, { onChapter: (done, total) => seen.push([done, total]) })
    expect(seen).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ])

    const controller = new AbortController()
    controller.abort()
    await expect(buildSource({}, {}, { signal: controller.signal })).rejects.toSatisfy(isCancelError)
  })

  it('rejects a book without chapters', async () => {
    await expect(buildSource({}, { chapters: [], volumes: [], rootChapters: [] })).rejects.toThrow(
      '没有可导出的正文内容',
    )
  })
})
