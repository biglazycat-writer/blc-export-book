// @vitest-environment jsdom
import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkExportManuscript } from '../../../types/models'
import { buildEpubBook } from './epub-book'
import { renderDocXhtml, type XhtmlJsonNode } from './epub-xhtml'
import { buildWorkBook } from './manuscript'
import { applyEpubPreset } from './presets'
import type {
  BookAssets,
  EpubExportSettings,
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

function content(overrides: Partial<WorkExportContentSettings> = {}): WorkExportContentSettings {
  return {
    scopeType: 'all',
    chapterIds: [],
    chapterOrder: [],
    includeSynopsis: true,
    includeVolumeTitles: true,
    includeChapterSynopsis: true,
    includeToc: true,
    skipEmpty: false,
    ...overrides,
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
  const rootDoc = docJson(
    paragraph(
      text('安全 < 文本 & 内容'),
      {
        type: 'text',
        text: '外部链接',
        marks: [{ type: 'link', attrs: { href: 'https://example.com/a?b=1&c=2' } }],
      },
      {
        type: 'text',
        text: '危险链接',
        marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
      },
    ),
    {
      type: 'image',
      attrs: { src: 'javascript:alert(2)', alt: '缺失图' },
    },
  )
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
      attrs: {
        src: 'asset://inner',
        width: 320,
        height: 200,
        alt: '插图',
        caption: '插图说明',
      },
    },
  )
  const secondDoc = docJson(
    paragraph(text('第二章正文。')),
    {
      type: 'image',
      attrs: { src: 'asset://second', alt: '第二图', caption: '第二张' },
    },
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
        id: 'c-root',
        volume_path: '',
        title: '根章',
        synopsis: '根章梗概',
        content: JSON.stringify({ type: 'biglazycat_editor_content', doc: rootDoc }),
        word_count: 300,
        created_at: '',
        updated_at: '2026-10-20 09:00:00',
      },
      {
        id: 'c1',
        volume_path: 'v1',
        title: '第一章',
        synopsis: '第一章梗概',
        content: JSON.stringify({ type: 'biglazycat_editor_content', doc: firstDoc }),
        word_count: 500,
        created_at: '',
        updated_at: '2026-10-20 10:00:00',
      },
      {
        id: 'c2',
        volume_path: 'v1',
        title: '第二章',
        synopsis: '',
        content: JSON.stringify({ type: 'biglazycat_editor_content', doc: secondDoc }),
        word_count: 400,
        created_at: '',
        updated_at: '2026-10-20 11:00:00',
      },
    ],
  }
}

function book(contentOverrides: Partial<WorkExportContentSettings> = {}): WorkBookModel {
  return buildWorkBook({
    manuscript: manuscript(),
    common: common(),
    content: content(contentOverrides),
  })
}

function imageAsset(id: string, width = 320, height = 200): ExportAsset {
  const bytes = new Uint8Array([...PNG_BYTES, ...new TextEncoder().encode(id)])
  return { id, fileName: `${id}.png`, mime: 'image/png', bytes, width, height }
}

function assets(): Pick<BookAssets, 'images' | 'mermaid'> {
  return {
    images: new Map([
      ['asset://inner', imageAsset('img-001')],
      ['asset://second', imageAsset('img-002')],
    ]),
    mermaid: new Map([['graph TD; A-->B;', imageAsset('mermaid-001', 400, 240)]]),
  }
}

async function unpack(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const zip = await JSZip.loadAsync(bytes)
  const files: Record<string, string> = {}
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue
    if (/\.(xhtml|opf|ncx|xml|css)$/.test(name)) files[name] = await file.async('string')
  }
  return { zip, files, bytes }
}

function xml(source: string): Document {
  const doc = new DOMParser().parseFromString(source, 'application/xml')
  const error = doc.getElementsByTagName('parsererror')[0]
  if (error) throw new Error(`XML 解析失败：${error.textContent || '未知错误'}`)
  return doc
}

function elements(node: Document | Element, tag: string): Element[] {
  return Array.from(node.getElementsByTagName(tag))
}

function childElements(node: Element, tag: string): Element[] {
  return Array.from(node.childNodes).filter(
    (child): child is Element => child.nodeType === 1 && child.nodeName === tag,
  )
}

function epubSettings(overrides: Partial<EpubExportSettings> = {}): EpubExportSettings {
  return { ...applyEpubPreset('literary'), ...overrides }
}

async function build(
  overrides: Partial<EpubExportSettings> = {},
  options: { cover?: ExportAsset | null; content?: Partial<WorkExportContentSettings> } = {},
) {
  const blob = await buildEpubBook({
    book: book(options.content),
    settings: epubSettings(overrides),
    assets: assets(),
    cover: options.cover,
    now: new Date('2026-10-20T12:34:56Z'),
    randomUUID: () => '00000000-0000-4000-8000-000000000000',
  })
  return unpack(blob)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildEpubBook', () => {
  it('exports a standalone document without a book title or copyright page', async () => {
    const source = manuscript()
    source.workspace_kind = 'standalone'
    source.chapters = [source.chapters[0]]
    source.volumes = []
    const single = buildWorkBook({ manuscript: source, common: common(), content: content({ includeToc: false, includeVolumeTitles: false, includeSynopsis: false }) })
    const { zip, files } = await unpack(await buildEpubBook({ book: single, settings: epubSettings({ includeCover: false, includeSynopsisPage: false }), assets: assets() }))
    expect(zip.file('OEBPS/titlepage.xhtml')).toBeNull()
    expect(zip.file('OEBPS/copyright.xhtml')).toBeNull()
    expect(zip.file('OEBPS/toc.xhtml')).toBeNull()
    expect(files['OEBPS/nav.xhtml']).not.toContain('copyright.xhtml')
    expect(Object.keys(files).filter(name => /chapter-.*\.xhtml$/.test(name))).toHaveLength(1)
  })
  it('writes a valid EPUB 3 package with complete metadata', async () => {
    const { zip, files, bytes } = await build({}, { cover: imageAsset('cover', 800, 1200) })
    const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir)

    expect(names[0]).toBe('mimetype')
    const method = bytes[8] | (bytes[9] << 8)
    const nameLength = bytes[26] | (bytes[27] << 8)
    expect(method).toBe(0)
    expect(new TextDecoder().decode(bytes.slice(30, 30 + nameLength))).toBe('mimetype')
    expect(await zip.file('mimetype')!.async('string')).toBe('application/epub+zip')
    expect(await zip.file('META-INF/container.xml')!.async('string')).toContain(
      'OEBPS/content.opf',
    )

    xml(files['META-INF/container.xml'])
    const opf = xml(files['OEBPS/content.opf'])
    expect(opf.documentElement.getAttribute('unique-identifier')).toBe('book-id')

    const metadata = elements(opf, 'dc:identifier')[0]
    expect(metadata.textContent).toBe('urn:isbn:9780306406157')
    expect(elements(opf, 'dc:title').map((node) => node.textContent)).toEqual([
      '测试书',
      '一个副标题',
    ])
    expect(elements(opf, 'meta').find((node) => node.getAttribute('refines') === '#subtitle')?.textContent).toBe(
      'subtitle',
    )
    expect(elements(opf, 'dc:creator')[0].textContent).toBe('测试作者')
    expect(elements(opf, 'dc:language')[0].textContent).toBe('zh-CN')
    expect(elements(opf, 'dc:publisher')[0].textContent).toBe('测试出版社')
    expect(elements(opf, 'dc:date')[0].textContent).toBe('2026-10-20')
    expect(elements(opf, 'dc:description')[0].textContent).toContain('这是内容简介。')
    expect(elements(opf, 'dc:subject').map((node) => node.textContent)).toEqual(['小说', '测试'])
    expect(elements(opf, 'dc:rights')[0].textContent).toContain('保留所有权利')
    expect(elements(opf, 'meta').find((node) => node.getAttribute('property') === 'dcterms:modified')?.textContent).toBe(
      '2026-10-20T12:34:56Z',
    )

    const items = elements(opf, 'item')
    const manifest = new Map(items.map((item) => [item.getAttribute('id'), item]))
    expect(manifest.get('nav')?.getAttribute('properties')).toBe('nav')
    expect(manifest.get('cover-image')?.getAttribute('properties')).toBe('cover-image')
    expect(manifest.get('cover-image')?.getAttribute('href')).toBe('images/cover.png')

    for (const item of items) {
      expect(zip.file(`OEBPS/${item.getAttribute('href')}`), item.getAttribute('href') || '').toBeTruthy()
    }
    const spine = elements(opf, 'itemref')
    expect(spine.length).toBeGreaterThan(5)
    for (const itemref of spine) expect(manifest.has(itemref.getAttribute('idref'))).toBe(true)
    expect(spine[0].getAttribute('idref')).toBe('cover-page')

    const coverMeta = elements(opf, 'meta').find((node) => node.getAttribute('name') === 'cover')
    expect(coverMeta?.getAttribute('content')).toBe('cover-image')

    for (const name of Object.keys(files).filter((name) => name.endsWith('.xhtml'))) {
      xml(files[name])
    }
  })

  it('nests volumes in nav and mirrors the tree in NCX', async () => {
    const { files } = await build({}, { cover: imageAsset('cover', 800, 1200) })
    const nav = xml(files['OEBPS/nav.xhtml'])
    const tocNav = elements(nav, 'nav').find(
      (node) => node.getAttribute('epub:type') === 'toc',
    )
    expect(tocNav).toBeTruthy()

    const list = elements(tocNav!, 'ol')[0]
    const topLevel = childElements(list, 'li')
    expect(topLevel).toHaveLength(7)
    expect(topLevel.map((item) => elements(item, 'a')[0].textContent)).toEqual([
      '封面',
      '扉页',
      '版权信息',
      '内容简介',
      '目录',
      '根章',
      '第一卷',
    ])
    expect(elements(topLevel[5], 'a')[0].getAttribute('href')).toBe('chapter-001.xhtml')

    const volumeChildren = childElements(childElements(topLevel[6], 'ol')[0], 'li')
    expect(volumeChildren.map((item) => elements(item, 'a')[0].textContent)).toEqual([
      '第一章',
      '第二章',
    ])
    expect(elements(topLevel[6], 'a')[0].getAttribute('href')).toBe('volume-001.xhtml')

    const ncx = xml(files['OEBPS/toc.ncx'])
    const navMap = elements(ncx, 'navMap')[0]
    expect(elements(navMap, 'text').map((node) => node.textContent)).toEqual([
      '封面',
      '扉页',
      '版权信息',
      '内容简介',
      '目录',
      '根章',
      '第一卷',
      '第一章',
      '第二章',
    ])
    const uid = elements(ncx, 'meta').find((node) => node.getAttribute('name') === 'dtb:uid')
    expect(uid?.getAttribute('content')).toBe('urn:isbn:9780306406157')
    const orders = elements(ncx, 'navPoint').map((node) => Number(node.getAttribute('playOrder')))
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])

    // The in-book 目录 page still lists the body only.
    const tocPage = xml(files['OEBPS/toc.xhtml'])
    expect(elements(tocPage, 'a').map((node) => node.textContent)).toEqual([
      '根章',
      '第一卷',
      '第一章',
      '第二章',
    ])
  })

  it('renders rich text, continuous figure numbers and MathML safely', async () => {
    const { files, zip } = await build({}, { cover: imageAsset('cover', 800, 1200) })
    const root = xml(files['OEBPS/chapter-001.xhtml'])
    expect(elements(root, 'h1')[0].textContent).toBe('根章')
    expect(root.documentElement.textContent).toContain('安全 < 文本 & 内容')

    const anchors = elements(root, 'a')
    expect(anchors).toHaveLength(1)
    expect(anchors[0].getAttribute('href')).toBe('https://example.com/a?b=1&c=2')
    expect(files['OEBPS/chapter-001.xhtml']).not.toContain('javascript:')
    expect(root.documentElement.textContent).toContain('[图片缺失：缺失图]')

    const first = xml(files['OEBPS/chapter-002.xhtml'])
    expect(elements(first, 'h1')[0].textContent).toBe('第一章')
    expect(elements(first, 'h2')[0].textContent).toBe('章内标题')
    expect(elements(first, 'math').length).toBeGreaterThan(0)
    const firstImage = elements(first, 'img')[0]
    expect(firstImage.getAttribute('src')).toBe('images/img-001.png')
    expect(elements(first, 'figcaption')[0].textContent).toBe('图 1 插图说明')

    const second = xml(files['OEBPS/chapter-003.xhtml'])
    expect(elements(second, 'img').map((node) => node.getAttribute('src'))).toEqual([
      'images/img-002.png',
      'images/mermaid-001.png',
    ])
    expect(elements(second, 'figcaption')[0].textContent).toBe('图 2 第二张')
    expect(zip.file('OEBPS/images/img-001.png')).toBeTruthy()
    expect(zip.file('OEBPS/images/mermaid-001.png')).toBeTruthy()

    for (const name of Object.keys(files).filter((name) => name.endsWith('.xhtml'))) {
      const page = xml(files[name])
      for (const image of elements(page, 'img')) {
        const src = image.getAttribute('src') || ''
        expect(src.startsWith('data:') || /^https?:/i.test(src)).toBe(false)
        expect(zip.file(`OEBPS/${src}`), src).toBeTruthy()
      }
    }
  })

  it('uses a text cover when no canvas cover can be generated', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const { files } = await build({ includeCover: true })
    const cover = xml(files['OEBPS/cover.xhtml'])
    expect(cover.documentElement.textContent).toContain('测试书')
    expect(cover.documentElement.textContent).toContain('大懒猫创作平台')
    const opf = xml(files['OEBPS/content.opf'])
    expect(elements(opf, 'meta').some((node) => node.getAttribute('name') === 'cover')).toBe(false)
    expect(elements(opf, 'item').some((node) => node.getAttribute('properties') === 'cover-image')).toBe(false)
  })

  it('flattens the nav when volume titles are disabled', async () => {
    const { zip, files } = await build(
      {},
      { cover: imageAsset('cover', 800, 1200), content: { includeVolumeTitles: false } },
    )
    expect(zip.file('OEBPS/volume-001.xhtml')).toBeNull()
    const nav = xml(files['OEBPS/nav.xhtml'])
    const list = elements(nav, 'ol')[0]
    const topLevel = childElements(list, 'li')
    expect(topLevel.map((item) => elements(item, 'a')[0].textContent)).toEqual([
      '封面',
      '扉页',
      '版权信息',
      '内容简介',
      '目录',
      '根章',
      '第一章',
      '第二章',
    ])
  })

  it('styles emoji spans with their own advance and font stack', async () => {
    const { files } = await build({}, { cover: imageAsset('cover', 800, 1200) })
    const css = files['OEBPS/style.css']
    expect(css).toMatch(/\.emoji \{\s*display: inline-block;\s*width: 1\.25em;/)
    expect(css).toMatch(/\.emoji \{[^}]*text-indent: 0;/)
    expect(css).toContain(
      'font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;',
    )
  })

  it('falls back to a UUID and honours page toggles', async () => {
    const plain = book()
    plain.meta.isbn = ''
    const blob = await buildEpubBook({
      book: plain,
      settings: epubSettings({ includeSynopsisPage: false }),
      assets: assets(),
      cover: imageAsset('cover', 800, 1200),
      now: new Date('2026-10-20T12:34:56Z'),
      randomUUID: () => '00000000-0000-4000-8000-000000000000',
    })
    const { zip, files } = await unpack(blob)
    const opf = xml(files['OEBPS/content.opf'])
    expect(elements(opf, 'dc:identifier')[0].textContent).toBe(
      'urn:uuid:00000000-0000-4000-8000-000000000000',
    )
    expect(zip.file('OEBPS/synopsis.xhtml')).toBeNull()
    expect(zip.file('OEBPS/toc.xhtml')).toBeTruthy()
    const nav = xml(files['OEBPS/nav.xhtml'])
    expect(nav.documentElement.textContent).not.toContain('内容简介')
    expect(nav.documentElement.textContent).toContain('扉页')
  })
})

describe('renderDocXhtml', () => {
  it('escapes text, drops unsafe links and offsets headings', () => {
    const body = renderDocXhtml(
      {
        type: 'doc',
        content: [
          heading(1, '标题 <x>'),
          paragraph(
            text('正文 <script>alert(1)</script>'),
            {
              type: 'text',
              text: '危险',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
            {
              type: 'text',
              text: '安全',
              marks: [{ type: 'link', attrs: { href: 'mailto:a@example.com' } }],
            },
          ),
        ],
      } as XhtmlJsonNode,
      { headingOffset: 1, imageSrc: () => null },
    )
    expect(body).toContain('<h2>标题 &lt;x&gt;</h2>')
    expect(body).toContain('正文 &lt;script&gt;alert(1)&lt;/script&gt;')
    expect(body).not.toContain('javascript:')
    expect(body).toContain('<a href="mailto:a@example.com">安全</a>')
    expect(body.match(/<a /g)).toHaveLength(1)
  })

  it('puts every emoji in a fixed-width inline box and leaves symbols alone', () => {
    const body = renderDocXhtml(
      {
        type: 'doc',
        content: [
          paragraph(
            text('图标 😂 贴纸 👨‍👩‍👧‍👦 旗帜 🇨🇳 按键 1️⃣ 手势 👍🏽 箭头 ↔ 版权 ©'),
            {
              type: 'text',
              text: '加粗 ❤️',
              marks: [{ type: 'bold' }],
            },
          ),
          {
            type: 'codeBlock',
            attrs: { language: 'js' },
            content: [text('const e = "😂"')],
          },
        ],
      } as XhtmlJsonNode,
      { headingOffset: 1, imageSrc: () => null },
    )
    expect(body.match(/class="emoji"/g)).toHaveLength(6)
    expect(body).toContain('<span class="emoji">😂</span>')
    expect(body).toContain('<span class="emoji">👨‍👩‍👧‍👦</span>')
    expect(body).toContain('<span class="emoji">🇨🇳</span>')
    expect(body).toContain('<span class="emoji">1️⃣</span>')
    expect(body).toContain('<span class="emoji">👍🏽</span>')
    expect(body).toContain('<strong>加粗 <span class="emoji">❤️</span></strong>')
    // Symbols with a text presentation are ordinary glyphs, not icons.
    expect(body).toContain('箭头 ↔ 版权 ©')
    // A code block is literal source and must stay copyable text.
    const code = body.slice(body.indexOf('<pre'))
    expect(code).toContain('const e = &quot;😂&quot;')
    expect(code).not.toContain('class="emoji"')
  })
})
