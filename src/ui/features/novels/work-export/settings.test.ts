import { describe, expect, it, vi } from 'vitest'
import {
  MAX_STORED_WORK_EXPORTS,
  filterStaleChapterSelection,
  getLastWorkExportAuthor,
  loadWorkExportSettings,
  saveWorkExportSettings,
  setLastWorkExportAuthor,
  WORK_EXPORT_AUTHOR_KEY,
  WORK_EXPORT_SETTINGS_KEY,
} from './settings'
import { applyPdfPreset, createDefaultWorkExportSettings } from './presets'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  get length(): number {
    return this.data.size
  }

  clear(): void {
    this.data.clear()
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

const defaultsInput = { title: '默认书名', author: '原作者', today: '2026-10-20' }

describe('work export settings storage', () => {
  it('restores the HTML format for a folder export', () => {
    const storage = new MemoryStorage()
    const settings = createDefaultWorkExportSettings(defaultsInput)
    settings.lastFormat = 'html'
    saveWorkExportSettings('folder:书稿', settings, defaultsInput.title, storage)
    expect(loadWorkExportSettings('folder:书稿', defaultsInput, storage).lastFormat).toBe('html')
  })
  it('returns defaults when nothing is stored', () => {
    const storage = new MemoryStorage()
    const settings = loadWorkExportSettings('novel-1', defaultsInput, storage)
    expect(settings.common.title).toBe('默认书名')
    expect(settings.lastFormat).toBe('epub')
    expect(settings.docx.preset).toBe('manuscript')
  })

  it('saves and restores per-collection settings without a cover', () => {
    const storage = new MemoryStorage()
    const settings = createDefaultWorkExportSettings(defaultsInput)
    settings.lastFormat = 'pdf'
    settings.common.subtitle = '副标题'
    settings.pdf = applyPdfPreset('print')
    settings.content.scopeType = 'chapters'
    settings.content.chapterIds = ['ch-1']
    expect(saveWorkExportSettings('novel-1', settings, defaultsInput.title, storage)).toBe(true)

    const loaded = loadWorkExportSettings('novel-1', defaultsInput, storage)
    expect(loaded.lastFormat).toBe('pdf')
    expect(loaded.common.subtitle).toBe('副标题')
    expect(loaded.pdf.preset).toBe('print')
    expect(loaded.pdf.paper).toBe('16k')
    expect(loaded.content.chapterIds).toEqual(['ch-1'])
    expect(storage.getItem(WORK_EXPORT_SETTINGS_KEY)).not.toContain('data:image')
  })

  it('follows a collection rename while the book title is still the default', () => {
    const storage = new MemoryStorage()
    const settings = createDefaultWorkExportSettings({ ...defaultsInput, title: '旧书名' })
    saveWorkExportSettings('novel-1', settings, '旧书名', storage)

    const renamed = loadWorkExportSettings('novel-1', { ...defaultsInput, title: '新书名' }, storage)
    expect(renamed.common.title).toBe('新书名')
    expect(renamed.common.filename).toBe('新书名')
  })

  it('keeps a book title the user typed when the collection is renamed', () => {
    const storage = new MemoryStorage()
    const settings = createDefaultWorkExportSettings(defaultsInput)
    settings.common.title = '自定义书名'
    settings.common.filename = '自定义文件名'
    saveWorkExportSettings('novel-1', settings, '旧书名', storage)

    const renamed = loadWorkExportSettings('novel-1', { ...defaultsInput, title: '新书名' }, storage)
    expect(renamed.common.title).toBe('自定义书名')
    expect(renamed.common.filename).toBe('自定义文件名')
  })

  it('repairs saved settings that predate the source title record', () => {
    const storage = new MemoryStorage()
    const settings = createDefaultWorkExportSettings({ ...defaultsInput, title: '旧书名' })
    storage.setItem(WORK_EXPORT_SETTINGS_KEY, JSON.stringify({
      version: 1,
      entries: { 'novel-1': { updatedAt: 1, settings } },
    }))

    const loaded = loadWorkExportSettings('novel-1', { ...defaultsInput, title: '新书名' }, storage)
    expect(loaded.common.title).toBe('新书名')
    expect(loaded.common.filename).toBe('新书名')
  })

  it('drops unknown fields and survives corrupted JSON', () => {
    const storage = new MemoryStorage()
    storage.setItem(WORK_EXPORT_SETTINGS_KEY, '{not json')
    expect(loadWorkExportSettings('novel-1', defaultsInput, storage).common.title).toBe('默认书名')
    storage.setItem(WORK_EXPORT_SETTINGS_KEY, JSON.stringify({ version: 99, entries: {} }))
    expect(loadWorkExportSettings('novel-1', defaultsInput, storage).common.title).toBe('默认书名')
  })

  it('filters stale chapter ids and falls back to all when none remain', () => {
    const base = createDefaultWorkExportSettings(defaultsInput)
    base.content.scopeType = 'chapters'
    base.content.chapterIds = ['gone-1', 'ok-1', 'gone-2']
    const filtered = filterStaleChapterSelection(base, ['ok-1', 'ok-2'])
    expect(filtered.content.chapterIds).toEqual(['ok-1'])
    expect(filtered.content.scopeType).toBe('chapters')

    const gone = filterStaleChapterSelection(base, ['ok-2'])
    expect(gone.content.scopeType).toBe('all')
    expect(gone.content.chapterIds).toEqual([])
  })

  it('saves and restores the hand-tuned chapter order, pruning stale ids', () => {
    const storage = new MemoryStorage()
    const settings = createDefaultWorkExportSettings(defaultsInput)
    settings.content.chapterOrder = ['ch-3', 'ch-1', 'ch-2']
    saveWorkExportSettings('novel-1', settings, defaultsInput.title, storage)
    const restored = loadWorkExportSettings('novel-1', defaultsInput, storage)
    expect(restored.content.chapterOrder).toEqual(['ch-3', 'ch-1', 'ch-2'])

    // 删除章节后，顺序列表里指向它的残留 id 必须被清理。
    const filtered = filterStaleChapterSelection(restored, ['ch-1', 'ch-2', 'ch-new'])
    expect(filtered.content.chapterOrder).toEqual(['ch-1', 'ch-2'])
  })

  it('keeps at most 50 collections, newest first', () => {
    const storage = new MemoryStorage()
    const now = vi.spyOn(Date, 'now')
    const settings = createDefaultWorkExportSettings(defaultsInput)
    for (let i = 0; i < MAX_STORED_WORK_EXPORTS + 5; i += 1) {
      now.mockReturnValue(1_000 + i)
      saveWorkExportSettings(`novel-${i}`, settings, defaultsInput.title, storage)
    }
    now.mockRestore()
    const parsed = JSON.parse(storage.getItem(WORK_EXPORT_SETTINGS_KEY) || '{}') as {
      entries: Record<string, unknown>
    }
    expect(Object.keys(parsed.entries).length).toBe(MAX_STORED_WORK_EXPORTS)
    expect(parsed.entries['novel-0']).toBeUndefined()
    expect(parsed.entries[`novel-${MAX_STORED_WORK_EXPORTS + 4}`]).toBeTruthy()
  })

  it('remembers the last author globally', () => {
    const storage = new MemoryStorage()
    setLastWorkExportAuthor('  张三  ', storage)
    expect(getLastWorkExportAuthor(storage)).toBe('张三')
    expect(storage.getItem(WORK_EXPORT_AUTHOR_KEY)).toBe('张三')
  })
})
