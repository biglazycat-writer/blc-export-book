// @vitest-environment jsdom
import '../novels/test-i18n'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({ openAppPage: vi.fn() }))
vi.mock('../../bridge/sdk', () => ({ getSDK: () => ({ onSave: () => () => {}, setState: async () => {} }), getSession: () => ({ state: {} }) }))
vi.mock('../../bridge/persistent-settings', async () => {
  const local = await import('../novels/work-export/settings')
  return { loadPersistedSettings: async (key: string, defaults: any) => local.loadWorkExportSettings(key, defaults), savePersistedSettings: async (key: string, value: any) => { local.saveWorkExportSettings(key, value, value.common.title) } }
})

const mocks = vi.hoisted(() => ({
  loadWorkExportManuscript: vi.fn(),
  getNovel: vi.fn(),
  listVolumes: vi.fn(),
  listChapterSummaries: vi.fn(),
  loadWorkExportBook: vi.fn(),
  prepareWorkExportAssets: vi.fn(),
  rebuildWorkBook: vi.fn(),
  renderWorkExportBlob: vi.fn(),
  renderWorkExportPdfBytes: vi.fn(),
  workExportFilename: vi.fn(),
  saveExportBlob: vi.fn(),
}))

vi.mock('../../bridge/export-api', () => ({
  exportApi: {
    loadWorkExportManuscript: mocks.loadWorkExportManuscript,
    getNovel: mocks.getNovel,
    listVolumes: mocks.listVolumes,
    listChapterSummaries: mocks.listChapterSummaries,
  },
}))
vi.mock('../../lib/save-export', () => ({ saveExportBlob: mocks.saveExportBlob }))
vi.mock('../../lib/app-navigation', () => ({ openAppPage: navigation.openAppPage }))

vi.mock('./TypesetPreview', () => ({ TypesetPreview: () => <div data-testid="typeset-preview" /> }))
vi.mock('../image-designer/ImageDesigner', () => ({ ImageDesigner: ({ onBack }: { onBack: () => void }) => <div data-testid="image-designer"><button onClick={onBack}>文档导出</button></div> }))
vi.mock('../novels/work-export/run-export', () => ({
  loadWorkExportBook: mocks.loadWorkExportBook,
  prepareWorkExportAssets: mocks.prepareWorkExportAssets,
  rebuildWorkBook: mocks.rebuildWorkBook,
  renderWorkExportBlob: mocks.renderWorkExportBlob,
  renderWorkExportPdfBytes: mocks.renderWorkExportPdfBytes,
  workExportFilename: mocks.workExportFilename,
}))

import { TypesetPage } from './TypesetPage'

const CHAPTERS = [
  { id: 'ch-1', title: '第一章 起因', synopsis: '开篇', word_count: 1200, volume_id: 'v-1' },
  { id: 'ch-2', title: '第二章 转折', synopsis: '', word_count: 900, volume_id: 'v-1' },
]

beforeEach(() => {
  window.localStorage.clear()
  mocks.getNovel.mockResolvedValue({
    id: 'novel-1',
    title: '测试合集',
    synopsis: '简介',
    workspace_kind: 'collection',
  })
  mocks.listVolumes.mockResolvedValue([{ id: 'v-1', title: '第一卷' }])
  mocks.listChapterSummaries.mockResolvedValue(CHAPTERS)
  mocks.loadWorkExportManuscript.mockImplementation(async (_novelId, scope) => ({
    novel_id: 'novel-1', title: scope.folder_path ?? '测试合集', synopsis: '简介',
    workspace_kind: scope.type === 'chapters' ? 'standalone' : 'collection',
    word_count: 2100,
    volumes: [{ path: 'v-1', parent_path: '', title: '第一卷', chapter_count: 2, word_count: 2100 }],
    chapters: CHAPTERS.filter(chapter => scope.type !== 'chapters' || scope.chapter_ids.includes(chapter.id))
      .map(chapter => ({ ...chapter, volume_path: 'v-1', content: '正文', updated_at: '' })),
  }))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TypesetPage', () => {
  it('opens a collection as a book and only offers document formats', async () => {
    render(<TypesetPage novelId="novel-1" title="测试合集" active={false} />)

    await waitFor(() => expect(screen.getByRole('heading', { name: '测试合集' })).toBeTruthy())
    expect(screen.getByText('文件夹')).toBeTruthy()
    expect(screen.getByTestId('typeset-preview')).toBeTruthy()
    expect(screen.getByText('已选 2 章 · 2,100 字')).toBeTruthy()

    expect(screen.getByText('PDF')).toBeTruthy()
    expect(screen.getByText('Word')).toBeTruthy()
    expect(screen.getByText('EPUB')).toBeTruthy()
    expect(screen.getByText('HTML')).toBeTruthy()
    expect(screen.queryByText('PNG 长图')).toBeNull()
    expect(screen.queryByText('PNG 海报')).toBeNull()
  })

  it('opens a chapter with a separate image designer instead of PNG document formats', async () => {
    render(<TypesetPage novelId="novel-1" chapterId="ch-1" title="第一章 起因" active={false} />)

    await waitFor(() => expect(screen.getByRole('heading', { name: '第一章 起因' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '返回文章' }))
    expect(navigation.openAppPage).toHaveBeenCalledWith('novels', {
      novelId: 'novel-1',
      chapterId: 'ch-1',
      folderPath: undefined,
      title: '第一章 起因',
    })
    expect(screen.getByText('章节')).toBeTruthy()
    expect(screen.getByText('本章 · 1,200 字')).toBeTruthy()

    expect(screen.queryByText('PNG 长图')).toBeNull()
    expect(screen.queryByText('PNG 海报')).toBeNull()
    expect(screen.getByText('单章导出只包含当前章节正文，目录、卷标题与简介页不会出现。')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '图片设计器' }))
    await waitFor(() => expect(screen.getByTestId('image-designer')).toBeTruthy())
    expect(screen.queryByTestId('typeset-preview')).toBeNull()
    expect(mocks.renderWorkExportPdfBytes).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '文档导出' }))
    await waitFor(() => expect(screen.getByTestId('typeset-preview')).toBeTruthy())
  })

  it('reports a missing work instead of rendering an empty studio', async () => {
    render(<TypesetPage active={false} />)
    expect(screen.getByText('没有指定要排版的作品')).toBeTruthy()
  })

  it.each(['', '书稿/第二部'])('opens folder %s as a book without requiring a novel ID', async (folderPath) => {
    render(<TypesetPage folderPath={folderPath} active={false} />)
    await waitFor(() => expect(screen.getByText('已选 2 章 · 2,100 字')).toBeTruthy())
    expect(mocks.loadWorkExportManuscript).toHaveBeenCalledWith('', { type: 'all', folder_path: folderPath, chapter_ids: undefined })
    expect(mocks.getNovel).not.toHaveBeenCalled()
    expect(screen.getByText('文件夹')).toBeTruthy()
  })

  it('loads only a requested file even when no novel ID was supplied', async () => {
    render(<TypesetPage chapterId="ch-1" active={false} />)
    await waitFor(() => expect(screen.getByText('本章 · 1,200 字')).toBeTruthy())
    expect(mocks.loadWorkExportManuscript).toHaveBeenCalledWith('', { type: 'chapters', chapter_ids: ['ch-1'], folder_path: undefined })
    expect(mocks.listChapterSummaries).not.toHaveBeenCalled()
  })

  it('treats a standalone work opened from its file card as a single file', async () => {
    mocks.loadWorkExportManuscript.mockResolvedValueOnce({
      novel_id: 'single', title: '单篇', synopsis: '', workspace_kind: 'standalone', word_count: 1200,
      volumes: [], chapters: [{ ...CHAPTERS[0], volume_path: '', content: '正文', updated_at: '' }],
    })
    render(<TypesetPage novelId="single" active={false} />)
    await waitFor(() => expect(screen.getByText('本章 · 1,200 字')).toBeTruthy())
    expect(screen.getByText('章节')).toBeTruthy()
    expect(screen.queryByText('文件夹')).toBeNull()
  })

  it('exports HTML through the native save path using HTML assets', async () => {
    mocks.loadWorkExportBook.mockResolvedValue({ manuscript: { chapters: [] }, book: { chapters: [] } })
    mocks.rebuildWorkBook.mockReturnValue({ chapters: [] })
    mocks.prepareWorkExportAssets.mockResolvedValue({ images: new Map(), mermaid: new Map(), formulas: new Map(), all: [], warnings: [] })
    const blob = new Blob(['<!DOCTYPE html>'], { type: 'text/html' })
    mocks.renderWorkExportBlob.mockResolvedValue(blob)
    mocks.workExportFilename.mockReturnValue('第一章.html')
    mocks.saveExportBlob.mockResolvedValue({ path: '/exports/第一章.html', cancelled: false })
    render(<TypesetPage chapterId="ch-1" active={false} />)
    await screen.findByRole('heading', { name: '第一章 起因' })
    fireEvent.click(screen.getByRole('button', { name: /^HTML/ }))
    fireEvent.click(screen.getByRole('button', { name: '导出 HTML' }))
    await waitFor(() => expect(mocks.saveExportBlob).toHaveBeenCalledWith(blob, '第一章.html'))
    expect(mocks.prepareWorkExportAssets).toHaveBeenCalledWith(expect.objectContaining({ target: 'html', imageProfile: 'full' }))
    expect(mocks.renderWorkExportBlob).toHaveBeenCalledWith(expect.objectContaining({ format: 'html' }))
  })

  it('previews through the PDF-bytes path with reduced pictures', async () => {
    mocks.loadWorkExportBook.mockResolvedValue({ manuscript: { chapters: [] }, book: { chapters: [] } })
    mocks.rebuildWorkBook.mockReturnValue({ chapters: [] })
    mocks.prepareWorkExportAssets.mockResolvedValue({
      images: new Map(),
      mermaid: new Map(),
      formulas: new Map(),
      all: [],
      warnings: [],
    })
    mocks.renderWorkExportPdfBytes.mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]))

    render(<TypesetPage novelId="novel-1" chapterId="ch-1" title="第一章 起因" active />)

    await waitFor(() => expect(mocks.renderWorkExportPdfBytes).toHaveBeenCalled(), { timeout: 4000 })
    expect(mocks.prepareWorkExportAssets).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'pdf', imageProfile: 'preview' }),
    )
    // The preview must stay off the export path, which reported 「等待选择保存位置」 in this pane.
    expect(mocks.renderWorkExportBlob).not.toHaveBeenCalled()
  })
})
