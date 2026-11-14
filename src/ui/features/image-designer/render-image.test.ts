// @vitest-environment jsdom
import '../novels/test-i18n'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyImageLayout, defaultImageDesign, IMAGE_LAYOUTS, imageHeight, imageOutputSize } from './design'
import { prepareImageHtml, renderDesignImage } from './render-image'
import { domToBlob } from 'modern-screenshot'

vi.mock('modern-screenshot', () => ({ domToBlob: vi.fn() }))
vi.mock('../../lib/embedded-resource-export', () => ({ resolveEmbeddedResourceElements: vi.fn(async () => {}), resolveEmbeddedResources: vi.fn(async () => ({type:'doc',content:[{type:'image',attrs:{src:'data:image/png;base64,AA==',alt:'原始画布'}}]})) }))
vi.mock('../../lib/mermaid-render', () => ({ renderMermaidPng: vi.fn(async () => { throw new Error('invalid diagram') }) }))

const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
afterEach(() => {
  vi.restoreAllMocks(); document.body.innerHTML = ''
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts)
  else Reflect.deleteProperty(document, 'fonts')
})

describe('image layout and raster bounds', () => {
  it('starts in WenKai and keeps it across every layout preset', () => {
    const design = { ...defaultImageDesign(), theme: 'midnight' as const, background: '#123456', width: 880, ratio: '1:1' as const }
    expect(defaultImageDesign().font).toBe('wenkai')
    for (const layout of IMAGE_LAYOUTS) {
      const next = applyImageLayout(design, layout)
      expect(next.font).toBe('wenkai')
      expect(next).toMatchObject({ layout, theme: 'midnight', background: '#123456', width: 880, ratio: '1:1', scale: 2 })
    }
    expect(design.layout).toBe('essay')
  })
  it('uses content height for long images and pixel ratios for posters', () => {
    const design = defaultImageDesign()
    expect(imageHeight(design)).toBeUndefined()
    expect(imageHeight({ ...design, ratio: '3:4' })).toBe(960)
    expect(imageHeight({ ...design, ratio: '1:1' })).toBe(720)
    expect(imageHeight({ ...design, ratio: '16:9' })).toBe(405)
  })

  it('rejects oversize images without silently scaling or cropping content', () => {
    expect(imageOutputSize(720, 15000, 2)).toEqual({ width: 1440, height: 30000, valid: false })
    expect(imageOutputSize(720, 15000, 1).valid).toBe(true)
    expect(imageOutputSize(720, 30001, 1).valid).toBe(false)
    expect(imageOutputSize(720, 0, 2).valid).toBe(false)
  })
})

describe('image content', () => {
  it('resolves editable resource comments before HTML preview would omit them',async()=>{
    const html=await prepareImageHtml('<!-- blc:node {"type":"flowCanvas","attrs":{"flowCanvasId":"canvas"}} -->',vi.fn());
    const host=document.createElement('div');host.innerHTML=html;
    expect(host.querySelector('img')?.alt).toBe('原始画布');
    expect(html).not.toContain('blc:node');
  })
  it('keeps rich Markdown, expands folded content and embeds local pictures', async () => {
    const read = vi.fn(async () => 'data:image/png;base64,AA==')
    const html = await prepareImageHtml('# 标题\n\n**重点**与 $x^2$\n\n| 列 |\n| --- |\n| 值 |\n\n![插图](/localimg/photo.png)\n\n<details>\n<summary>补充</summary>\n\n完整的末尾文字\n\n</details>', read)
    const host = document.createElement('div')
    host.innerHTML = html
    expect(host.querySelector('h1')?.textContent).toBe('标题')
    expect(host.querySelector('strong')?.textContent).toBe('重点')
    expect(host.querySelector('.katex')).toBeTruthy()
    expect(host.querySelector('table')?.textContent).toContain('值')
    expect(host.querySelector('details')?.open).toBe(true)
    expect(host.textContent).toContain('完整的末尾文字')
    expect(host.querySelector('img')?.src).toBe('data:image/png;base64,AA==')
    expect(read).toHaveBeenCalledWith('/localimg/photo.png')
  })

  it('does not accept active HTML or javascript links in an editable draft', async () => {
    const html = await prepareImageHtml('<script>alert(1)</script>\n\n[恶意](javascript:alert(1))\n\n<img src=x onerror=alert(1)>', vi.fn())
    const host = document.createElement('div')
    host.innerHTML = html
    expect(host.querySelector('script,[onerror],a[href^="javascript:"]')).toBeNull()
  })

  it('stops on failed pictures or diagrams instead of exporting an incomplete image', async () => {
    await expect(prepareImageHtml('![图](/missing.png)', vi.fn(async () => ''))).rejects.toThrow('图片加载失败')
    await expect(prepareImageHtml('```mermaid\nbroken\n```', vi.fn())).rejects.toThrow('invalid diagram')
  })
})

function canvas(height = 960, overflow = false) {
  const node = document.createElement('div')
  node.innerHTML = '<article class="imageDesignCard"><p>正文</p></article>'
  Object.defineProperties(node, { offsetWidth: { value: 720 }, offsetHeight: { value: height } })
  Object.defineProperties(node.firstElementChild!, {
    clientHeight: { value: 880 }, scrollHeight: { value: overflow ? 1800 : 880 },
    clientWidth: { value: 640 }, scrollWidth: { value: 640 },
  })
  document.body.append(node)
  return node
}

describe('PNG generation', () => {
  it('loads real regular and medium WenKai faces before capturing', async () => {
    const load = vi.fn(async () => [{}])
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load, ready: Promise.resolve() } })
    const node = canvas()
    node.dataset.font = 'wenkai'
    vi.mocked(domToBlob).mockResolvedValue(new Blob(['png']))
    await renderDesignImage(node, 2)
    expect(load).toHaveBeenCalledWith('400 20px "LXGW WenKai"', '霞鹜文楷')
    expect(load).toHaveBeenCalledWith('500 20px "LXGW WenKai"', '霞鹜文楷')
  })

  it('blocks export if the chosen WenKai font is unavailable', async () => {
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load: vi.fn(async () => []), ready: Promise.resolve() } })
    const node = canvas()
    node.dataset.font = 'wenkai'
    vi.mocked(domToBlob).mockClear()
    await expect(renderDesignImage(node, 2)).rejects.toThrow('霞鹜文楷加载失败')
    expect(domToBlob).not.toHaveBeenCalled()
  })
  it('captures the preview at its natural dimensions and requested resolution', async () => {
    const node = canvas()
    const blob = new Blob(['png'], { type: 'image/png' })
    vi.mocked(domToBlob).mockResolvedValue(blob)
    expect(await renderDesignImage(node, 2)).toBe(blob)
    expect(domToBlob).toHaveBeenCalledWith(node, expect.objectContaining({ width: 720, height: 960, scale: 2, type: 'image/png' }))
  })

  it('blocks clipped posters and oversized long images before allocation', async () => {
    vi.mocked(domToBlob).mockClear()
    await expect(renderDesignImage(canvas(960, true), 2)).rejects.toThrow('内容超出')
    await expect(renderDesignImage(canvas(30001), 1)).rejects.toThrow('尺寸上限')
    expect(domToBlob).not.toHaveBeenCalled()
  })

  it('waits for images and fails if they cannot decode', async () => {
    const node = canvas()
    const img = document.createElement('img')
    img.decode = vi.fn().mockRejectedValue(new Error('decode'))
    node.append(img)
    await expect(renderDesignImage(node, 1)).rejects.toThrow('图片加载失败')
  })
})
