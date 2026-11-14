import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildDocxBook } from './docx-book'
import { buildWorkBook } from './manuscript'
import { createDefaultWorkExportSettings } from './presets'
import type { WorkExportChapter, WorkExportManuscript } from '../../../types/models'

const wrapper = (content: unknown[]) =>
  JSON.stringify({
    type: 'biglazycat_editor_content',
    version: 3,
    doc: { type: 'doc', content },
  })

const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

function chapter(id: string, title: string, volumePath = ''): WorkExportChapter {
  return {
    id,
    volume_path: volumePath,
    title,
    synopsis: '',
    content: wrapper([paragraph(`正文 ${id}。`)]),
    word_count: 20,
    created_at: '',
    updated_at: '2026-10-20T00:00:00Z',
  }
}

function manuscript(overrides: Partial<WorkExportManuscript> = {}): WorkExportManuscript {
  return {
    novel_id: 'novel-1',
    title: '西游记',
    synopsis: '',
    workspace_kind: 'writing',
    word_count: 40,
    volumes: [],
    chapters: [
      chapter('c1', '第一回　灵根育孕源流出'),
      chapter('c2', '第二回　悟彻菩提真妙理'),
    ],
    ...overrides,
  }
}

async function buildZip(source: WorkExportManuscript): Promise<JSZip> {
  const settings = createDefaultWorkExportSettings({ title: '西游记' })
  const book = buildWorkBook({
    manuscript: source,
    common: settings.common,
    content: settings.content,
  })
  const blob = await buildDocxBook({
    book,
    settings: settings.docx,
    assets: { images: new Map(), mermaid: new Map(), formulas: new Map() },
  })
  return JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()))
}

async function documentXml(source: WorkExportManuscript): Promise<string> {
  const zip = await buildZip(source)
  return zip.file('word/document.xml')!.async('string')
}

async function stylesXml(source: WorkExportManuscript): Promise<string> {
  const zip = await buildZip(source)
  return zip.file('word/styles.xml')!.async('string')
}

function bookmarkNames(xml: string): string[] {
  return [...xml.matchAll(/<w:bookmarkStart[^>]*w:name="([^"]*)"/g)].map((match) => match[1])
}

function hyperlinkAnchors(xml: string): string[] {
  return [...xml.matchAll(/<w:hyperlink[^>]*w:anchor="([^"]*)"/g)].map((match) => match[1])
}

/**
 * The 目录 needs both halves. A `TOC` field with an empty result prints a blank
 * page in LibreOffice, WPS, Google Docs and every preview tool; static text
 * alone is not a table of contents Word can rebuild with 更新域.
 */
describe('docx table of contents', () => {
  it('keeps a real TOC field that Word can update', async () => {
    const xml = await documentXml(manuscript())
    // The field switches Word writes itself: \o builds from the built-in
    // headings, \h makes entries clickable, \z hides tabs in web view. \u is
    // deliberately absent: front matter carries outline levels for the
    // 导航窗格 only and must stay out of the printed 目录.
    expect(xml).toContain('TOC \\o &quot;1-1&quot; \\h \\z')
    expect(xml).toContain('w:fldCharType="begin" w:dirty="true"')
    expect(xml).toContain('w:fldCharType="separate"')
    // The field closes after the cached entries, not inside the first entry.
    const lastEntry = xml.indexOf('第二回　悟彻菩提真妙理')
    const lastHyperlink = xml.indexOf('</w:hyperlink>', lastEntry)
    expect(xml.indexOf('w:fldCharType="end"', lastHyperlink)).toBeGreaterThan(lastHyperlink)
  })

  it('ships a cached result so the page is never blank', async () => {
    const xml = await documentXml(manuscript())
    const separate = xml.indexOf('w:fldCharType="separate"')
    const body = xml.indexOf('<w:pStyle w:val="Heading1"/>')
    expect(separate).toBeGreaterThan(0)
    expect(body).toBeGreaterThan(separate)
    // The entries live between separate and the body: that is the cached result.
    const cached = xml.slice(separate, body)
    expect(cached).toContain('第一回　灵根育孕源流出')
    expect(cached).toContain('第二回　悟彻菩提真妙理')
  })

  it('links every entry to a bookmark that exists', async () => {
    const xml = await documentXml(manuscript())
    const anchors = hyperlinkAnchors(xml)
    const names = bookmarkNames(xml)
    expect(anchors).toEqual(['chapter_1', 'chapter_2'])
    for (const anchor of anchors) expect(names).toContain(anchor)
  })

  it('adds front matter to the navigation outline but not the printed TOC', async () => {
    const xml = await documentXml(manuscript())
    const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((match) => match[0])
    const outlineTexts = paragraphs
      .filter((paragraph) => paragraph.includes('<w:outlineLvl w:val="0"/>'))
      .map((paragraph) =>
        [...paragraph.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
          .map((match) => match[1])
          .join(''),
      )
    expect(outlineTexts).toEqual(expect.arrayContaining(['西游记', '版权信息', '目录']))

    const separate = xml.indexOf('w:fldCharType="separate"')
    const body = xml.indexOf('<w:pStyle w:val="Heading1"/>')
    const cached = xml.slice(separate, body)
    expect(cached).not.toContain('版权信息')
    expect(cached).not.toContain('目录')
  })

  it('gives every bookmark a unique numeric id', async () => {
    const xml = await documentXml(manuscript())
    const ids = [...xml.matchAll(/<w:bookmarkStart[^>]*w:id="(\d+)"/g)].map((match) => match[1])
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('references the page of every cached entry with a PAGEREF field', async () => {
    const xml = await documentXml(manuscript())
    for (const anchor of ['chapter_1', 'chapter_2']) {
      const hyperlink = new RegExp(
        `<w:hyperlink[^>]*w:anchor="${anchor}"[\\s\\S]*?</w:hyperlink>`,
      ).exec(xml)?.[0] || ''
      // 只更新页码 in Word updates these references without rebuilding the TOC.
      expect(hyperlink).toContain(`PAGEREF ${anchor} \\h`)
    }
  })

  it('uses the TOC paragraph styles so an update keeps the same look', async () => {
    const xml = await documentXml(manuscript())
    const styles = await stylesXml(manuscript())
    expect(xml).toContain('<w:pStyle w:val="TOC1"/>')
    expect(styles).toContain('w:styleId="TOC1"')
    expect(styles).toContain('w:styleId="TOC2"')
  })

  it('lists volumes and their chapters when the work has categories', async () => {
    const xml = await documentXml(
      manuscript({
        volumes: [
          { path: 'vol-1', parent_path: '', title: '第一卷', chapter_count: 1, word_count: 20 },
          { path: 'vol-2', parent_path: '', title: '第二卷', chapter_count: 1, word_count: 20 },
        ],
        chapters: [
          chapter('c1', '第一回', 'vol-1'),
          chapter('c2', '第二回', 'vol-2'),
        ],
      }),
    )
    const anchors = hyperlinkAnchors(xml)
    const names = bookmarkNames(xml)
    expect(anchors).toEqual(['volume_1', 'chapter_1', 'volume_2', 'chapter_2'])
    for (const anchor of anchors) expect(names).toContain(anchor)
    expect(xml.split('第一卷').length - 1).toBe(2)
  })

  it('leaves the 目录 page out when the setting is off', async () => {
    const settings = createDefaultWorkExportSettings({ title: '西游记' })
    const book = buildWorkBook({
      manuscript: manuscript(),
      common: settings.common,
      content: { ...settings.content, includeToc: false },
    })
    const blob = await buildDocxBook({
      book,
      settings: settings.docx,
      assets: { images: new Map(), mermaid: new Map(), formulas: new Map() },
    })
    const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()))
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(hyperlinkAnchors(xml)).toEqual([])
    expect(xml).not.toContain('目录')
  })
})
