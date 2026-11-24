// @vitest-environment jsdom
import '../novels/test-i18n'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImageLibraryPicker } from './image-library-picker'

const bridge = vi.hoisted(() => ({ list: vi.fn(), readImage: vi.fn(), preview: vi.fn(), close: vi.fn(), pick: vi.fn() }))
vi.mock('../../bridge/export-api', () => ({
  exportApi: { listImageAssets: bridge.list, readImageAsDataURL: bridge.readImage },
}))
vi.mock('./image-preview', () => ({ imagePreview: bridge.preview }))

let root: Root, element: HTMLDivElement
const image = (id: string, name = id) => ({ id, name, src: `/creation-image/${id}.png`, width: 1200, height: 800 })
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  bridge.list.mockResolvedValue({ items: [image('cat', '猫咪封面'), image('dog', '狗狗封面')], total: 2 })
  bridge.readImage.mockImplementation(async (src: string) => `data:image/png;base64,original-${src}`)
  bridge.preview.mockResolvedValue({ url: 'data:image/png;base64,preview', width: 1200, height: 800 })
  element = document.createElement('div'); document.body.append(element); root = createRoot(element)
})
afterEach(async () => { await act(async () => root.unmount()); element.remove(); vi.useRealTimers() })
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('.coverPickerDialog button')]
const button = (text: string) => buttons().find(button => button.textContent?.trim() === text)!
const card = (name: string) => buttons().find(button => button.getAttribute('aria-label') === `预览 ${name}`)!
async function mount(open = true) { await act(async () => root.render(<ImageLibraryPicker open={open} onPick={bridge.pick} onClose={bridge.close} />)) }
async function click(target: HTMLElement) { await act(async () => target.click()) }
async function search(value: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>('input[type=search]')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 280)) })
}

describe('cover image picker', () => {
  it('mounts a gallery on the body and applies the original image only after confirmation', async () => {
    await mount()
    const dialog = document.querySelector('[role=dialog]')!
    expect(element.contains(dialog)).toBe(false)
    expect(document.querySelectorAll('.coverPickerThumb img')).toHaveLength(2)
    expect(button('使用此封面').disabled).toBe(true)
    await click(card('猫咪封面'))
    expect(card('猫咪封面').getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('.coverPickerSelectedImage img')?.getAttribute('alt')).toBe('已选：猫咪封面')
    expect(bridge.pick).not.toHaveBeenCalled()
    bridge.readImage.mockClear()
    await click(button('使用此封面'))
    expect(bridge.readImage).toHaveBeenCalledWith('/creation-image/cat.png')
    expect(bridge.pick).toHaveBeenCalledWith({ asset: image('cat', '猫咪封面'), dataUrl: 'data:image/png;base64,original-/creation-image/cat.png' })
    expect(bridge.close).toHaveBeenCalledOnce()
  })

  it('searches the workspace and starts pagination at the current result count', async () => {
    bridge.list.mockResolvedValueOnce({ items: [image('cat', '猫咪封面')], total: 2 })
    await mount()
    expect(bridge.list).toHaveBeenCalledWith('', 0, 12)
    bridge.list.mockResolvedValueOnce({ items: [image('dog', '狗狗封面')], total: 2 })
    await click(button('加载更多'))
    expect(bridge.list).toHaveBeenLastCalledWith('', 1, 12)
    expect(document.querySelectorAll('.coverPickerCard')).toHaveLength(2)
    bridge.list.mockResolvedValueOnce({ items: [image('cat', '猫咪封面')], total: 1 })
    await search(' 猫咪 ')
    expect(bridge.list).toHaveBeenLastCalledWith('猫咪', 0, 12)
    expect(document.querySelectorAll('.coverPickerCard')).toHaveLength(1)
    expect(card('狗狗封面')).toBeUndefined()
    expect(button('加载更多')).toBeUndefined()
  })

  it('ignores a stale response when a search changes before loading finishes', async () => {
    let finish!: (page: unknown) => void
    bridge.list.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await mount()
    bridge.list.mockResolvedValueOnce({ items: [image('dog', '狗狗封面')], total: 1 })
    await search('狗狗')
    await act(async () => finish({ items: [image('cat', '猫咪封面')], total: 1 }))
    expect(card('狗狗封面')).toBeTruthy()
    expect(card('猫咪封面')).toBeUndefined()
  })

  it('shows empty results and recovers from a list failure', async () => {
    bridge.list.mockRejectedValueOnce(new Error('素材库暂时不可用'))
    await mount()
    expect(document.querySelector('[role=alert]')?.textContent).toContain('素材库暂时不可用')
    bridge.list.mockResolvedValueOnce({ items: [], total: 0 })
    await click(button('重试'))
    expect(document.querySelector('[role=alert]')).toBeNull()
    expect(document.body.textContent).toContain('素材库暂无图片')
    bridge.list.mockResolvedValueOnce({ items: [], total: 0 })
    await search('不存在')
    expect(document.body.textContent).toContain('没有匹配的图片')
  })

  it('displays unreadable images without applying them and retains the selection on confirmation failure', async () => {
    bridge.readImage.mockRejectedValueOnce(new Error('图片已删除'))
    await mount()
    expect(card('猫咪封面').disabled).toBe(true)
    expect(card('猫咪封面').textContent).toContain('图片无法读取')
    await click(card('狗狗封面'))
    bridge.readImage.mockRejectedValueOnce(new Error('原图读取失败'))
    await click(button('使用此封面'))
    expect(document.querySelector('[role=alert]')?.textContent).toContain('原图读取失败')
    expect(bridge.pick).not.toHaveBeenCalled()
    expect(bridge.close).not.toHaveBeenCalled()
    expect(card('狗狗封面').getAttribute('aria-pressed')).toBe('true')
  })

  it('rejects cover-unsupported formats inside the dialog instead of applying them', async () => {
    bridge.readImage.mockResolvedValue('data:image/gif;base64,animated')
    await mount()
    await click(card('猫咪封面'))
    await click(button('使用此封面'))
    expect(document.querySelector('[role=alert]')?.textContent).toContain('封面只支持 JPG、PNG 或 WebP')
    expect(bridge.pick).not.toHaveBeenCalled()
    expect(bridge.close).not.toHaveBeenCalled()
  })

  it('renders nothing while closed', async () => {
    await mount(false)
    expect(document.querySelector('[role=dialog]')).toBeNull()
    expect(bridge.list).not.toHaveBeenCalled()
  })
})
