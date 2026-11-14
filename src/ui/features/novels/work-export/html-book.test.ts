// @vitest-environment jsdom
import '../test-i18n'
import { describe, expect, it } from 'vitest'
import { buildHtmlBook } from './html-book'
import { buildWorkBook } from './manuscript'
import { createDefaultWorkExportSettings } from './presets'
import { renderWorkExportBlob } from './run-export'
import type { BookAssets, ExportAsset } from './types'

const image: ExportAsset = { id: 'image', fileName: 'image.png', mime: 'image/png', bytes: new Uint8Array([137, 80, 78, 71]), width: 10, height: 10 }

function fixture() {
  const settings = createDefaultWorkExportSettings({ title: '一本 <书>', author: '作者' })
  settings.lastFormat = 'html'
  const book = buildWorkBook({
    common: settings.common, content: settings.content,
    manuscript: {
      novel_id: '', title: '一本书', synopsis: '', workspace_kind: 'collection', word_count: 20,
      volumes: [{ path: 'part', parent_path: '', title: '第一部', chapter_count: 0, word_count: 0 }, { path: 'part/sub', parent_path: 'part', title: '子目录', chapter_count: 1, word_count: 20 }],
      chapters: [{ id: '1', title: '第一章', volume_path: 'part/sub', synopsis: '', word_count: 20, created_at: '', updated_at: '', content: JSON.stringify({ type: 'doc', content: [
        { type: 'paragraph', attrs: { textAlign: 'right', indent: 2 }, content: [{ type: 'text', text: '带样式 <正文>', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { color: '#ff0000', fontSize: '20px', fontFamily: '宋体' } }, { type: 'highlight', attrs: { color: '#ffff00' } }] }] },
        { type: 'image', attrs: { src: '/localimg/picture.png', caption: '图注', alt: '插图' } },
        { type: 'codeBlock', attrs: { language: 'mermaid' }, content: [{ type: 'text', text: 'graph TD; A-->B;' }] },
        { type: 'paragraph', content: [{ type: 'formula', attrs: { latex: 'x^2', displayMode: false } }] },
        { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: '表格' }] }] }] }] },
        { type: 'paragraph', content: [{ type: 'text', text: '危险链接', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
      ] }) }],
    },
  })
  const assets: BookAssets = { images: new Map([['/localimg/picture.png', image]]), mermaid: new Map([['graph TD; A-->B;', image]]), formulas: new Map(), all: [image], warnings: [] }
  return { book, settings, assets, cover: image }
}

function readText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsText(blob)
  })
}

describe('single-file HTML export', () => {
  it('renders the HTML format with embedded CSS, images, diagrams and formulas', async () => {
    const blob = await renderWorkExportBlob(fixture())
    expect(blob.type).toBe('text/html;charset=utf-8')
    const html = await readText(blob)
    const doc = new DOMParser().parseFromString(html, 'text/html')
    expect(doc.title).toBe('一本 <书>')
    expect(doc.querySelector('style')?.textContent).toContain('border-collapse: collapse')
    expect(doc.querySelectorAll('img')).toHaveLength(3)
    for (const img of doc.querySelectorAll('img')) expect(img.getAttribute('src')).toBe('data:image/png;base64,iVBORw==')
    expect(doc.querySelectorAll('link,script')).toHaveLength(0)
    expect(html).not.toContain('/localimg/')
    expect(html).not.toContain('javascript:')
    expect(doc.querySelector('math')).toBeTruthy()
    expect(doc.querySelector('th')?.textContent).toBe('表格')
    expect(doc.querySelector('strong')?.textContent).toBe('带样式 <正文>')
    expect(html).toContain('color:#ff0000;font-size:20px;font-family:宋体')
    expect(html).toContain('background-color:#ffff00')
    expect(html).toContain('text-align:right;text-indent:2em')
  })

  it('keeps nested directory titles and every TOC link points inside the same file', async () => {
    const doc = new DOMParser().parseFromString(await readText(await buildHtmlBook(fixture())), 'text/html')
    expect([...doc.querySelectorAll('.volume-page h1')].map(node => node.textContent)).toEqual(['第一部', '子目录'])
    const links = [...doc.querySelectorAll('nav a')]
    expect(links).toHaveLength(3)
    for (const link of links) {
      const href = link.getAttribute('href')!
      expect(href.startsWith('#')).toBe(true)
      expect(doc.getElementById(href.slice(1))).toBeTruthy()
    }
  })

  it('exports a single document without book front matter and honors cancellation', async () => {
    const input = fixture()
    input.settings.epub.includeCover = false
    input.settings.content.includeSynopsis = false
    input.book.options.includeToc = false
    input.book.options.includeVolumeTitles = false
    const html = await readText(await buildHtmlBook(input))
    const doc = new DOMParser().parseFromString(html, 'text/html')
    expect(doc.querySelectorAll('nav, .cover, .synopsis-page, .volume-page')).toHaveLength(0)
    expect(doc.querySelectorAll('article')).toHaveLength(1)
    const controller = new AbortController()
    controller.abort()
    await expect(buildHtmlBook({ ...input, signal: controller.signal })).rejects.toThrow()
  })
})
