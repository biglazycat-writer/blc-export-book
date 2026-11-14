// @vitest-environment jsdom
import '../test-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadWorkExportBook } from './run-export'
import { createDefaultWorkExportSettings } from './presets'
import type { WorkExportManuscript } from '../../../types/models'

const resolve = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/embedded-resource-export', () => ({ resolveEmbeddedResources: resolve }))

beforeEach(() => { resolve.mockReset().mockImplementation(async doc => doc) })

function source(): WorkExportManuscript {
  return { novel_id: 'work', title: '书稿', synopsis: '', workspace_kind: 'collection', volumes: [], word_count: 2,
    chapters: [
      { id: 'selected', title: '所选正文', volume_path: '', synopsis: '', word_count: 1, created_at: '', updated_at: '', content: '本次导出' },
      { id: 'other', title: '其他文件', volume_path: '', synopsis: '', word_count: 1, created_at: '', updated_at: '', content: JSON.stringify({ type: 'doc', content: [{ type: 'mindMapEmbed', attrs: { artifactId: 'missing' } }] }) },
    ] }
}

describe('typeset manuscript scope', () => {
  it('resolves embedded resources only in selected documents', async () => {
    const settings = createDefaultWorkExportSettings({ title: '书稿' })
    settings.content.scopeType = 'chapters'
    settings.content.chapterIds = ['selected']
    const loaded = await loadWorkExportBook({ novelId: 'work', manuscript: source(), settings })
    expect(loaded.book.chapters.map(chapter => chapter.id)).toEqual(['selected'])
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(resolve.mock.calls)).not.toContain('missing')
  })

  it('an empty selection cannot export the entire source', async () => {
    const settings = createDefaultWorkExportSettings({ title: '书稿' })
    settings.content.scopeType = 'chapters'
    await expect(loadWorkExportBook({ novelId: 'work', manuscript: source(), settings })).rejects.toThrow('没有可导出的正文内容')
    expect(resolve).not.toHaveBeenCalled()
  })

  it('identifies the document whose embedded resource failed', async () => {
    const settings = createDefaultWorkExportSettings({ title: '书稿' })
    settings.content.scopeType = 'chapters'
    settings.content.chapterIds = ['other']
    resolve.mockRejectedValue(new Error('思维导图 missing 不存在'))
    await expect(loadWorkExportBook({ novelId: 'work', manuscript: source(), settings })).rejects.toThrow('读取《其他文件》中的嵌入图形失败：思维导图 missing 不存在')
  })
})
