import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildEpubBook } from './epub-book'
import { buildDocxBook } from './docx-book'
import { buildWorkBook } from './manuscript'
import { createDefaultWorkExportSettings } from './presets'
import type { WorkExportManuscript } from '../../../types/models'

const wrap = (content: unknown[]) =>
  JSON.stringify({ type: 'biglazycat_editor_content', version: 3, doc: { type: 'doc', content } })
const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

function manuscript(): WorkExportManuscript {
  return {
    novel_id: 'n',
    title: '西游记',
    synopsis: '',
    workspace_kind: 'writing',
    word_count: 40,
    volumes: [],
    chapters: [
      {
        id: 'c1',
        volume_path: '',
        title: '第一回',
        synopsis: '',
        content: wrap([p('　　自从盘古破鸿蒙，开辟从兹清浊辨。'), p('　　覆载群生仰至仁。')]),
        word_count: 40,
        created_at: '',
        updated_at: '2026-10-20T00:00:00Z',
      },
    ],
  }
}

describe('the manual indent is gone from every format', () => {
  it('epub', async () => {
    const settings = createDefaultWorkExportSettings({ title: '西游记' })
    const book = buildWorkBook({
      manuscript: manuscript(),
      common: settings.common,
      content: settings.content,
    })
    const blob = await buildEpubBook({
      book,
      settings: settings.epub,
      assets: { images: new Map(), mermaid: new Map() },
    })
    const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()))
    const name = Object.keys(zip.files).find((f) => /chapter-0*1\.xhtml$/.test(f))!
    const xhtml = await zip.file(name)!.async('string')
    const paragraphs = [...xhtml.matchAll(/<p>(.*?)<\/p>/g)].map((m) => m[1])
    console.log('EPUB paragraphs:', JSON.stringify(paragraphs))
    for (const text of paragraphs) expect(text.startsWith('　')).toBe(false)
  })

  it('docx', async () => {
    const settings = createDefaultWorkExportSettings({ title: '西游记' })
    const book = buildWorkBook({
      manuscript: manuscript(),
      common: settings.common,
      content: settings.content,
    })
    const blob = await buildDocxBook({
      book,
      settings: settings.docx,
      assets: { images: new Map(), mermaid: new Map(), formulas: new Map() },
    })
    const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()))
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).not.toContain('>　　自从盘古')
    expect(xml).toContain('自从盘古破鸿蒙')
    // The indent is the style's, so the run text starts at the first glyph.
    const indentRuns = [...xml.matchAll(/<w:t[^>]*>　　/g)]
    console.log('docx runs still starting with an ideographic space:', indentRuns.length)
    expect(indentRuns.length).toBe(0)
  })
})
