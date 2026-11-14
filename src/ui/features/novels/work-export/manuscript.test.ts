import '../test-i18n'
import { describe, expect, it } from 'vitest'
import type { WorkExportManuscript } from '../../../types/models'
import { createDefaultWorkExportSettings } from './presets'
import {
  applyChapterOrder,
  buildWorkBook,
  docPreviewText,
  isJsonDocEmpty,
  scopeFromContent,
  stripDuplicateLeadingHeading,
  stripManualFirstLineIndent,
} from './manuscript'

const wrapper = (content: unknown[]) =>
  JSON.stringify({
    type: 'biglazycat_editor_content',
    version: 3,
    doc: { type: 'doc', content },
  })

const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const heading = (text: string, level = 1) => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
})

function fixture(): WorkExportManuscript {
  return {
    novel_id: 'novel-1',
    title: '合集标题',
    synopsis: '合集简介',
    workspace_kind: 'writing',
    word_count: 300,
    volumes: [
      { path: 'vol-1', parent_path: '', title: '第一卷', chapter_count: 2, word_count: 200 },
      { path: 'vol-1/sub', parent_path: 'vol-1', title: '子卷', chapter_count: 1, word_count: 50 },
    ],
    chapters: [
      {
        id: 'root-1',
        volume_path: '',
        title: '序章',
        synopsis: '序章梗概',
        content: wrapper([heading('序章'), paragraph('这是序章正文。')]),
        word_count: 50,
        created_at: '',
        updated_at: '2026-10-20T10:00:00Z',
      },
      {
        id: 'ch-1',
        volume_path: 'vol-1',
        title: '第一章',
        synopsis: '第一章梗概',
        content: wrapper([heading('第一章'), paragraph('第一章正文。')]),
        word_count: 100,
        created_at: '',
        updated_at: '2026-10-20T11:00:00Z',
      },
      {
        id: 'ch-2',
        volume_path: 'vol-1',
        title: '第二章',
        synopsis: '',
        content: JSON.stringify({
          type: 'doc',
          content: [
            { type: 'image', attrs: { src: '/localimg/a.png', alt: '插图' } },
          ],
        }),
        word_count: 100,
        created_at: '',
        updated_at: '2026-10-20T12:00:00Z',
      },
      {
        id: 'ch-3',
        volume_path: 'vol-1/sub',
        title: '子章',
        synopsis: '',
        content: '# 子章\n\n子卷正文。',
        word_count: 50,
        created_at: '',
        updated_at: '2026-10-20T13:00:00Z',
      },
      {
        id: 'empty-1',
        volume_path: 'vol-1',
        title: '空章',
        synopsis: '',
        content: wrapper([paragraph('   ')]),
        word_count: 0,
        created_at: '',
        updated_at: '2026-10-20T14:00:00Z',
      },
    ],
  }
}

function common() {
  const settings = createDefaultWorkExportSettings({ title: '合集标题', author: '作者', today: '2026-10-20' })
  settings.common.publisher = '出版社'
  settings.common.keywords = '小说, 连载'
  return settings.common
}

describe('chapter document normalization', () => {
  it('strips only a leading heading that repeats the chapter title', () => {
    const doc = {
      type: 'doc',
      content: [heading('第一章'), paragraph('正文')],
    }
    const stripped = stripDuplicateLeadingHeading(doc, '第一章')
    expect(stripped.content).toHaveLength(1)
    expect(stripDuplicateLeadingHeading(doc, '第二章')).toBe(doc)
  })

  it('ignores the chapter number when comparing the repeated title', () => {
    // Chapter titles carry a number the body's repeated H1 usually omits; the
    // pair printed as two near-identical headings on the first page.
    const doc = {
      type: 'doc',
      content: [heading('动手：跑起来 + 写插件'), paragraph('正文')],
    }
    expect(stripDuplicateLeadingHeading(doc, '11 动手：跑起来 + 写插件').content).toHaveLength(1)
    expect(stripDuplicateLeadingHeading(doc, '第11章 动手：跑起来 + 写插件').content).toHaveLength(1)
    // A different section heading in the same chapter must survive.
    const section = { type: 'doc', content: [heading('装环境'), paragraph('正文')] }
    expect(stripDuplicateLeadingHeading(section, '11 动手：跑起来 + 写插件')).toBe(section)
  })

  it('does not treat an image-only chapter as empty', () => {
    expect(isJsonDocEmpty({ type: 'doc', content: [{ type: 'image', attrs: { src: 'a.png' } }] })).toBe(false)
    expect(isJsonDocEmpty({ type: 'doc', content: [paragraph('  ')] })).toBe(true)
    expect(isJsonDocEmpty({ type: 'doc', content: [{ type: 'table', content: [] }] })).toBe(false)
  })

  it('reads preview text without flattening markup', () => {
    expect(
      docPreviewText({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '你好' }] }, { type: 'paragraph', content: [{ type: 'text', text: '世界' }] }],
      }),
    ).toBe('你好 世界')
  })
})

describe('buildWorkBook', () => {
  it('keeps manuscript order, dedupes titles and assigns volumes to nested paths', () => {
    const settings = createDefaultWorkExportSettings({ title: '合集标题', author: '作者', today: '2026-10-20' })
    const book = buildWorkBook({
      manuscript: fixture(),
      common: common(),
      content: { ...settings.content, includeChapterSynopsis: true },
    })

    expect(book.chapters.map((chapter) => chapter.id)).toEqual([
      'root-1',
      'ch-1',
      'ch-2',
      'ch-3',
      'empty-1',
    ])
    expect((book.chapters[1].doc as { content: unknown[] }).content).toHaveLength(1)
    expect(book.rootChapters.map((chapter) => chapter.id)).toEqual(['root-1'])
    expect(book.volumes.map((volume) => volume.path)).toEqual(['vol-1', 'vol-1/sub'])
    expect(book.volumes[1].parentPath).toBe('vol-1')
    expect(book.volumes[1].depth).toBe(1)
    expect(book.chapters[1].synopsis).toBe('第一章梗概')
    expect(book.wordCount).toBe(300)
    expect(book.meta.publisher).toBe('出版社')
    expect(book.meta.keywords).toEqual(['小说', '连载'])
    expect(book.meta.author).toBe('作者')
  })

  it('skips empty chapters only when asked', () => {
    const settings = createDefaultWorkExportSettings({ title: '合集标题' })
    const book = buildWorkBook({
      manuscript: fixture(),
      common: settings.common,
      content: { ...settings.content, skipEmpty: true },
    })
    expect(book.chapters.some((chapter) => chapter.id === 'empty-1')).toBe(false)
    expect(book.wordCount).toBe(300)
  })

  it('applies the hand-tuned chapter order and repositions volumes with it', () => {
    const settings = createDefaultWorkExportSettings({ title: '合集标题' })
    const book = buildWorkBook({
      manuscript: fixture(),
      common: settings.common,
      // 子章（vol-1/sub）被提到最前，根章节排在最后。书稿平铺顺序完全跟随
      // 调整结果；分类标题保持目录树结构（PDF/EPUB 按分类树走稿），
      // 分类自身不带章节时才由其子分类的内容位置决定先后。
      content: { ...settings.content, chapterOrder: ['ch-3', 'ch-1', 'root-1'] },
    })

    expect(book.chapters.map((chapter) => chapter.id)).toEqual([
      'ch-3',
      'ch-1',
      'root-1',
      'ch-2',
      'empty-1',
    ])
    expect(book.rootChapters.map((chapter) => chapter.id)).toEqual(['root-1'])
    expect(book.volumes.map((volume) => volume.path)).toEqual(['vol-1', 'vol-1/sub'])
    expect(book.volumes[0].chapters.map((chapter) => chapter.id)).toEqual(['ch-1', 'ch-2', 'empty-1'])
    expect(book.volumes[1].chapters.map((chapter) => chapter.id)).toEqual(['ch-3'])
  })

  it('reorders top-level volumes by where their chapters land in the tuned order', () => {
    const manuscript = fixture()
    manuscript.volumes = [
      { path: 'vol-1', parent_path: '', title: '第一卷', chapter_count: 1, word_count: 100 },
      { path: 'vol-2', parent_path: '', title: '第二卷', chapter_count: 1, word_count: 50 },
    ]
    manuscript.chapters = [
      { id: 'a', volume_path: 'vol-1', title: '甲', synopsis: '', content: wrapper([paragraph('甲正文。')]), word_count: 100, created_at: '2026-10-01T00:00:00Z', updated_at: '' },
      { id: 'b', volume_path: 'vol-2', title: '乙', synopsis: '', content: wrapper([paragraph('乙正文。')]), word_count: 50, created_at: '2026-10-02T00:00:00Z', updated_at: '' },
    ]
    const settings = createDefaultWorkExportSettings({ title: '合集标题' })
    const book = buildWorkBook({
      manuscript,
      common: settings.common,
      content: { ...settings.content, chapterOrder: ['b', 'a'] },
    })
    expect(book.chapters.map((chapter) => chapter.id)).toEqual(['b', 'a'])
    expect(book.volumes.map((volume) => volume.path)).toEqual(['vol-2', 'vol-1'])
  })

  it('treats an empty chapter order as the manuscript order', () => {
    const settings = createDefaultWorkExportSettings({ title: '合集标题' })
    const book = buildWorkBook({
      manuscript: fixture(),
      common: settings.common,
      content: { ...settings.content, chapterOrder: [] },
    })
    expect(book.chapters.map((chapter) => chapter.id)).toEqual(['root-1', 'ch-1', 'ch-2', 'ch-3', 'empty-1'])
    expect(book.volumes.map((volume) => volume.path)).toEqual(['vol-1', 'vol-1/sub'])
  })

  it('appends chapters missing from the order list after the tuned ones', () => {
    expect(applyChapterOrder(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      ['c'],
    ).map((chapter) => chapter.id)).toEqual(['c', 'a', 'b'])
    // 顺序列表里指向已删除章节的残留 id 不产生空位。
    expect(applyChapterOrder(
      [{ id: 'a' }, { id: 'b' }],
      ['gone', 'b'],
    ).map((chapter) => chapter.id)).toEqual(['b', 'a'])
    expect(applyChapterOrder([{ id: 'a' }], ['a', 'b'])).toEqual([{ id: 'a' }])
  })

  it('refuses a book with no renderable content', () => {
    const manuscript = fixture()
    manuscript.chapters = [manuscript.chapters[4]]
    const settings = createDefaultWorkExportSettings({ title: '合集标题' })
    expect(() =>
      buildWorkBook({
        manuscript,
        common: settings.common,
        content: { ...settings.content, skipEmpty: true },
      }),
    ).toThrow('没有可导出的正文内容')
  })

  it('turns chapter selection into the chapters scope', () => {
    const settings = createDefaultWorkExportSettings({ title: '合集标题' })
    expect(scopeFromContent(settings.content)).toEqual({ type: 'all' })
    expect(
      scopeFromContent({ ...settings.content, scopeType: 'chapters', chapterIds: ['a', 'b'] }),
    ).toEqual({ type: 'chapters', chapter_ids: ['a', 'b'] })
    expect(scopeFromContent({ ...settings.content, scopeType: 'chapters', chapterIds: [] })).toEqual({ type: 'chapters', chapter_ids: [] })
  })

  it('drops the manual indent so the export setting is the only one applied', () => {
    const settings = createDefaultWorkExportSettings({ title: '合集标题' })
    const manuscript: WorkExportManuscript = {
      ...fixture(),
      volumes: [],
      chapters: [
        {
          id: 'indented',
          volume_path: '',
          title: '第一回',
          synopsis: '',
          content: wrapper([
            paragraph('　　自从盘古破鸿蒙，开辟从兹清浊辨。'),
            paragraph('没有缩进的一段。'),
          ]),
          word_count: 20,
          created_at: '',
          updated_at: '2026-10-20T00:00:00Z',
        },
      ],
    }
    const book = buildWorkBook({
      manuscript,
      common: settings.common,
      content: settings.content,
    })
    const paragraphs = (book.chapters[0].doc.content as { content?: { text?: string }[] }[]).map(
      (node) => node.content?.[0]?.text,
    )
    expect(paragraphs).toEqual(['自从盘古破鸿蒙，开辟从兹清浊辨。', '没有缩进的一段。'])
  })
})

describe('stripManualFirstLineIndent', () => {
  const doc = (content: unknown[]) => ({ type: 'doc', content })

  it('removes ideographic, ASCII and no-break leading spaces', () => {
    const result = stripManualFirstLineIndent(
      doc([
        paragraph('　　两个全角空格'),
        paragraph('  两个半角空格'),
        paragraph(' 不换行空格'),
        paragraph('\t制表符'),
      ]),
    ) as { content: { content: { text: string }[] }[] }
    expect(result.content.map((node) => node.content[0].text)).toEqual([
      '两个全角空格',
      '两个半角空格',
      '不换行空格',
      '制表符',
    ])
  })

  it('leaves text that has no leading indent untouched', () => {
    const input = doc([paragraph('正文第一句。')])
    expect(stripManualFirstLineIndent(input)).toBe(input)
  })

  it('never touches spaces inside the line or a later text node', () => {
    const result = stripManualFirstLineIndent(
      doc([
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '　　前面' },
            { type: 'text', text: '　　后面' },
          ],
        },
      ]),
    ) as { content: { content: { text: string }[] }[] }
    expect(result.content[0].content.map((node) => node.text)).toEqual([
      '前面',
      '　　后面',
    ])
  })

  it('keeps a code block indent, which is content rather than typography', () => {
    const block = {
      type: 'codeBlock',
      content: [{ type: 'text', text: '    indented = True' }],
    }
    const result = stripManualFirstLineIndent(doc([block])) as {
      content: { content: { text: string }[] }[]
    }
    expect(result.content[0].content[0].text).toBe('    indented = True')
  })

  it('empties a paragraph that holds nothing but indent spaces', () => {
    const result = stripManualFirstLineIndent(doc([paragraph('　　')])) as {
      content: { content: unknown[] }[]
    }
    expect(result.content[0].content).toEqual([])
  })
})
