import { markdownToPreviewHtml, storedDocFromRaw, docToMarkdown } from '../../lib/content-model'
import { resolveEmbeddedResourceElements, resolveEmbeddedResources } from '../../lib/embedded-resource-export'
import { renderMermaidPng } from '../../lib/mermaid-render'
import i18n from '../../i18n'
import { imageOutputSize } from './design'

const error = (key: 'imageFailed' | 'fontFailed' | 'overflow' | 'tooLarge' | 'encodeFailed') => new Error(i18n.t(`imageDesigner.${key}`, { ns: 'novels' }))

/** Prepare a standalone copy, including local images and editable diagram resources. */
export async function prepareImageHtml(markdown: string, readImage: (src: string) => Promise<string>): Promise<string> {
  if (!markdown.trim()) return ''
  // Markdown preserves editable embeds as blc:node comments; resolve those
  // before the HTML preview parser would omit the comments.
  if (markdown.includes('blc:node')) markdown = docToMarkdown(await resolveEmbeddedResources(storedDocFromRaw(markdown)))
  const host = document.createElement('div')
  host.innerHTML = markdownToPreviewHtml(markdown, { pmBlocks: false })
  host.querySelectorAll('.mdPageBreak').forEach((node) => node.remove())
  host.querySelectorAll('details').forEach((node) => { node.open = true })
  await resolveEmbeddedResourceElements(host)
  for (const node of host.querySelectorAll<HTMLElement>('[data-mermaid-source]')) {
    const png = await renderMermaidPng(node.getAttribute('data-mermaid-source') || '', 'light')
    const img = document.createElement('img')
    img.src = png.dataUrl
    img.alt = 'Mermaid'
    node.replaceWith(img)
  }
  await Promise.all([...host.querySelectorAll('img')].map(async (img) => {
    const src = img.getAttribute('src') || ''
    const data = /^data:image\//i.test(src) ? src : await readImage(src)
    if (!/^data:image\//i.test(data)) throw error('imageFailed')
    img.src = data
    img.removeAttribute('srcset')
    img.loading = 'eager'
  }))
  return host.innerHTML
}

export function imageContentOverflows(canvas: HTMLElement): boolean {
  const card = canvas.querySelector<HTMLElement>('.imageDesignCard')
  return Boolean(card && (card.scrollHeight > card.clientHeight + 1 || card.scrollWidth > card.clientWidth + 1))
}

export async function waitForImageContent(canvas: HTMLElement): Promise<void> {
  if (canvas.dataset.font === 'wenkai' && document.fonts) {
    try {
      const faces = await Promise.all([400, 500].map((weight) => document.fonts.load(`${weight} 20px "LXGW WenKai"`, '霞鹜文楷')))
      if (faces.some((loaded) => loaded.length === 0)) throw error('fontFailed')
    } catch { throw error('fontFailed') }
  }
  await document.fonts?.ready
  await Promise.all([...canvas.querySelectorAll('img')].map(async (img) => {
    try { await img.decode() } catch { throw error('imageFailed') }
    if (!img.naturalWidth) throw error('imageFailed')
  }))
}

/** Capture the same DOM the user sees; no book model, PDF, or page stitching. */
export async function renderDesignImage(canvas: HTMLElement, scale: number): Promise<Blob> {
  await waitForImageContent(canvas)
  if (imageContentOverflows(canvas)) throw error('overflow')
  const width = canvas.offsetWidth, height = canvas.offsetHeight
  if (!imageOutputSize(width, height, scale).valid) throw error('tooLarge')
  const { domToBlob } = await import('modern-screenshot')
  const blob = await domToBlob(canvas, {
    width, height, scale, type: 'image/png', timeout: 15000,
    style: { transform: 'none', margin: '0' },
  })
  if (!blob || !blob.size) throw error('encodeFailed')
  return blob
}
