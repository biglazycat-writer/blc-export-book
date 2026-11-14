// @vitest-environment jsdom
import '../novels/test-i18n'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getChapter: vi.fn(), prepare: vi.fn(), render: vi.fn(), save: vi.fn(), overflow: vi.fn() }))
vi.mock('../../bridge/export-api', () => ({ exportApi: { getChapter: mocks.getChapter, readImageAsDataURL: vi.fn() } }))
vi.mock('../../lib/save-export', () => ({ saveExportBlob: mocks.save }))
vi.mock('./render-image', () => ({ prepareImageHtml: mocks.prepare, renderDesignImage: mocks.render, imageContentOverflows: mocks.overflow, waitForImageContent: vi.fn(async () => {}) }))
import { ImageDesigner } from './ImageDesigner'

beforeEach(() => {
  mocks.getChapter.mockResolvedValue({ title: '秋日来信', content: '完整章节正文' })
  mocks.prepare.mockImplementation(async (text: string) => `<p>${text}</p>`)
  mocks.render.mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
  mocks.save.mockResolvedValue({ path: 'D:/秋日来信.png', cancelled: false })
  mocks.overflow.mockReturnValue(false)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(720)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(960)
})
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function open() {
  render(<ImageDesigner chapterId="chapter-1" onBack={vi.fn()} />)
  await waitFor(() => expect((screen.getByRole('button', { name: '导出 PNG' }) as HTMLButtonElement).disabled).toBe(false))
}

describe('ImageDesigner', () => {
  it('turns the SDK normalized document into Markdown instead of printing JSON',async()=>{
    mocks.getChapter.mockResolvedValue({title:'秋日来信',content:JSON.stringify({type:'doc',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:'秋日来信'}]},{type:'paragraph',content:[{type:'text',text:'正文内容'}]},{type:'image',attrs:{src:'/creation-image/workspace/image.png',alt:'插图'}}]})});
    await open();
    const value=(screen.getByLabelText('分享文案（Markdown）') as HTMLTextAreaElement).value;
    expect(value).toContain('正文内容');expect(value).toContain('![插图](/creation-image/workspace/image.png)');
    expect(value).not.toContain('"type"');expect(value).not.toContain('# 秋日来信');
  })
  it('loads just the current chapter and edits only the sharing draft', async () => {
    await open()
    expect(mocks.getChapter).toHaveBeenCalledWith('chapter-1')
    expect((screen.getByLabelText('字体') as HTMLSelectElement).value).toBe('wenkai')
    expect(screen.queryByText('页眉')).toBeNull()
    expect(screen.getByRole('option', { name: '竖版海报 · 3:4' })).toBeTruthy()
    expect(screen.getByRole('option', { name: '横版海报 · 16:9' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('分享文案（Markdown）'), { target: { value: '用于海报的短文' } })
    expect((screen.getByRole('button', { name: '导出 PNG' }) as HTMLButtonElement).disabled).toBe(true)
    await waitFor(() => expect(document.querySelector('.imageDesignContent')?.textContent).toBe('用于海报的短文'))
    fireEvent.click(screen.getByRole('button', { name: '恢复章节正文' }))
    await waitFor(() => expect(document.querySelector('.imageDesignContent')?.textContent).toBe('完整章节正文'))
    expect(mocks.getChapter).toHaveBeenCalledTimes(1)
  })

  it('applies layout typography while preserving the draft, palette and canvas ratio', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: '深蓝' }))
    fireEvent.change(screen.getByLabelText('图片比例'), { target: { value: '3:4' } })
    fireEvent.change(screen.getByLabelText('字体'), { target: { value: 'sans' } })
    fireEvent.click(screen.getByRole('button', { name: '诗意摘录' }))
    const canvas = document.querySelector<HTMLElement>('.imageDesignerPreview .imageDesignCanvas')!
    expect(canvas.dataset.layout).toBe('poetry')
    expect(canvas.dataset.font).toBe('wenkai')
    expect((screen.getByLabelText('对齐') as HTMLSelectElement).value).toBe('center')
    expect((screen.getByLabelText('正文字号 · 24 px') as HTMLInputElement).value).toBe('24')
    expect((screen.getByLabelText('图片比例') as HTMLSelectElement).value).toBe('3:4')
    expect(screen.getByRole('button', { name: '深蓝' }).getAttribute('aria-pressed')).toBe('true')
    expect(canvas.querySelector('.imageDesignContent')?.textContent).toBe('完整章节正文')
    expect(mocks.getChapter).toHaveBeenCalledTimes(1)
    expect(mocks.prepare).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText('正文字号 · 24 px'), { target: { value: '26' } })
    expect(canvas.style.getPropertyValue('--image-font-size')).toBe('26px')
    fireEvent.click(screen.getByRole('button', { name: '杂志专栏' }))
    expect(canvas.dataset.layout).toBe('editorial')
    expect(canvas.style.getPropertyValue('--image-font-size')).toBe('20px')
  })

  it('shows the entire draft in long mode and blocks an overflowing poster', async () => {
    await open()
    mocks.overflow.mockReturnValue(true)
    fireEvent.change(screen.getByLabelText('图片比例'), { target: { value: '3:4' } })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('内容超出'))
    fireEvent.click(screen.getByRole('button', { name: '导出 PNG' }))
    expect(mocks.render).not.toHaveBeenCalled()
    mocks.overflow.mockReturnValue(false)
    fireEvent.change(screen.getByLabelText('图片比例'), { target: { value: 'auto' } })
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(document.querySelector('.imageDesignContent')?.textContent).toBe('完整章节正文')
  })

  it('saves the preview and distinguishes a cancelled native save', async () => {
    await open()
    mocks.save.mockResolvedValueOnce({ path: '', cancelled: true })
    fireEvent.click(screen.getByRole('button', { name: '导出 PNG' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('已取消保存'))
    expect(mocks.render).toHaveBeenCalledWith(document.querySelector('.imageDesignCanvas'), 2)
    expect(mocks.save).toHaveBeenCalledWith(expect.any(Blob), '秋日来信.png')
    expect(screen.queryByText('图片已保存')).toBeNull()
  })

  it('ignores late HTML from an earlier draft', async () => {
    await open()
    let finishOld!: (value: string) => void
    mocks.prepare.mockImplementationOnce(() => new Promise<string>((resolve) => { finishOld = resolve }))
    fireEvent.change(screen.getByLabelText('分享文案（Markdown）'), { target: { value: '旧文案' } })
    await waitFor(() => expect(finishOld).toBeTruthy())
    fireEvent.change(screen.getByLabelText('分享文案（Markdown）'), { target: { value: '新文案' } })
    await waitFor(() => expect(document.querySelector('.imageDesignContent')?.textContent).toBe('新文案'))
    finishOld('<p>旧文案</p>')
    await waitFor(() => expect((screen.getByRole('button', { name: '导出 PNG' }) as HTMLButtonElement).disabled).toBe(false))
    expect(document.querySelector('.imageDesignContent')?.textContent).toBe('新文案')
  })
})
