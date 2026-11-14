import { exportApi } from '../../../bridge/export-api'
import { collectMermaidPngsFromJson } from '../../../lib/mermaid-inline'
import { nt } from '../nt'
import type { BookAssetTarget, BookAssets, BookChapter, ExportAsset } from './types'

type JsonNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: JsonNode[]
}

const MAX_EDGE = 2000
/**
 * The live preview only ever paints one page at screen size, so it gets its own
 * lighter picture pass. A picture-heavy chapter otherwise lands in the preview
 * as a 16 MB PDF, and holding that across a render is what froze the WebView.
 */
const PREVIEW_MAX_EDGE = 1200
const PREVIEW_JPEG_QUALITY = 0.72
/** How faithfully a picture has to be reproduced: the file, or only the page. */
export type ImageProfile = 'full' | 'preview'
const ALLOWED: Record<BookAssetTarget, Set<string>> = {
  html: new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']),
  docx: new Set(['image/png', 'image/jpeg', 'image/gif']),
  epub: new Set(['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml']),
  pdf: new Set(['image/png', 'image/jpeg', 'image/svg+xml']),
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
}

export function imageExtension(mime: string): string {
  return EXTENSIONS[mime] || 'png'
}

export function parseDataUrl(value: string): { mime: string; bytes: Uint8Array } | null {
  const raw = String(value || '').trim()
  if (!raw.startsWith('data:')) return null
  const comma = raw.indexOf(',')
  if (comma < 0) return null
  const header = raw.slice(5, comma)
  const body = raw.slice(comma + 1)
  const mime = header.split(';')[0] || 'application/octet-stream'
  try {
    if (/;base64/i.test(header)) {
      const binary = atob(body)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
      return { mime, bytes }
    }
    return { mime, bytes: new TextEncoder().encode(decodeURIComponent(body)) }
  } catch {
    return null
  }
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${mime};base64,${btoa(binary)}`
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1]
}

/** Header-only image size; avoids decoding a big image just to reserve layout space. */
export function imageSizeFromBytes(bytes: Uint8Array, mime: string): { width: number; height: number } {
  try {
    if (mime === 'image/png' && bytes.length >= 24) {
      return { width: readUint32(bytes, 16), height: readUint32(bytes, 20) }
    }
    if (mime === 'image/gif' && bytes.length >= 10) {
      return { width: readUint16(bytes, 6), height: readUint16(bytes, 8) }
    }
    if (mime === 'image/jpeg') {
      let offset = 2
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1
          continue
        }
        const marker = bytes[offset + 1]
        const length = readUint16(bytes, offset + 2)
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { width: readUint16(bytes, offset + 7), height: readUint16(bytes, offset + 5) }
        }
        offset += 2 + length
      }
    }
    if (mime === 'image/svg+xml') {
      const text = new TextDecoder().decode(bytes)
      const width = /\bwidth=["']([\d.]+)(?:px)?["']/i.exec(text)
      const height = /\bheight=["']([\d.]+)(?:px)?["']/i.exec(text)
      if (width && height) return { width: Number(width[1]), height: Number(height[1]) }
      const viewBox = /\bviewBox=["'][\d.\s-]*?([\d.]+)[\s,]+([\d.]+)["']/i.exec(text)
      if (viewBox) return { width: Number(viewBox[1]), height: Number(viewBox[2]) }
    }
  } catch {
    // Fall through to a sane placeholder size.
  }
  return { width: 0, height: 0 }
}

function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(nt('assets.decodeFailed')))
    image.src = dataUrl
  })
}

async function rasterize(
  dataUrl: string,
  mime: string,
  maxEdge: number,
  profile: ImageProfile = 'full',
): Promise<{ dataUrl: string; mime: string } | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null
  try {
    const image = await loadHtmlImage(dataUrl)
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    if (!width || !height) return null
    const scale = Math.min(1, maxEdge / Math.max(width, height))
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const nextMime = profile === 'preview' || mime === 'image/jpeg' ? 'image/jpeg' : 'image/png'
    if (nextMime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, targetWidth, targetHeight)
    }
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight)
    return {
      dataUrl: canvas.toDataURL(nextMime, profile === 'preview' ? PREVIEW_JPEG_QUALITY : 0.85),
      mime: nextMime,
    }
  } catch {
    return null
  }
}

/**
 * Re-encode one picture for the preview, whatever its original size.
 *
 * Cropping the long edge alone would leave a photographic PNG of a thousand
 * pixels still costing megabytes each, and the preview pays for all of them on
 * every settings change.
 */
async function previewRaster(dataUrl: string, mime: string): Promise<NormalizedImage | null> {
  const converted = await rasterize(dataUrl, mime, PREVIEW_MAX_EDGE, 'preview')
  const next = converted ? parseDataUrl(converted.dataUrl) : null
  if (!next) return null
  const size = imageSizeFromBytes(next.bytes, next.mime)
  return {
    dataUrl: converted!.dataUrl,
    mime: next.mime,
    bytes: next.bytes,
    width: size.width || 800,
    height: size.height || 600,
  }
}

export interface NormalizedImage {
  dataUrl: string
  mime: string
  bytes: Uint8Array
  width: number
  height: number
}

/**
 * Normalize one picture for a target format.
 *
 * WebP/SVG/AVIF cannot be embedded by every renderer, and a 6000px photo makes
 * the book unwinnable to open, so unsupported or oversized pictures go through
 * a canvas once. Normal PNG/JPEG bytes are passed through untouched.
 *
 * The `preview` profile is the exception: it re-encodes every picture to a
 * small JPEG because the preview PDF is thrown away and rebuilt on every
 * settings change, while the file a user exports keeps the original bytes.
 */
export async function normalizeImage(
  dataUrl: string,
  target: BookAssetTarget,
  profile: ImageProfile = 'full',
): Promise<NormalizedImage> {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed || !parsed.mime.startsWith('image/')) throw new Error(nt('assets.invalidImageData'))
  if (profile === 'preview') {
    const shrunk = await previewRaster(dataUrl, parsed.mime)
    if (shrunk) return shrunk
  }
  let mime = parsed.mime
  let bytes = parsed.bytes
  let size = imageSizeFromBytes(bytes, mime)
  const tooLarge = Math.max(size.width, size.height) > MAX_EDGE
  const unsupported = !ALLOWED[target].has(mime)
  // GIFs may animate; shrinking one would silently turn it into a still frame.
  if ((unsupported || (tooLarge && mime !== 'image/gif')) && mime !== 'image/svg+xml') {
    const converted = await rasterize(dataUrl, mime, MAX_EDGE)
    if (converted) {
      const next = parseDataUrl(converted.dataUrl)
      if (next) {
        dataUrl = converted.dataUrl
        mime = next.mime
        bytes = next.bytes
        size = imageSizeFromBytes(bytes, mime)
      }
    } else if (unsupported) {
      throw new Error(nt('assets.unsupportedMime', { mime }))
    }
  } else if (unsupported && target === 'docx' && mime === 'image/svg+xml') {
    const converted = await rasterize(dataUrl, mime, MAX_EDGE)
    if (converted) {
      const next = parseDataUrl(converted.dataUrl)
      if (next) {
        dataUrl = converted.dataUrl
        mime = next.mime
        bytes = next.bytes
        size = imageSizeFromBytes(bytes, mime)
      }
    } else {
      throw new Error(nt('assets.svgConvertFailed'))
    }
  }
  if (!size.width || !size.height) size = { width: 800, height: 600 }
  return { dataUrl, mime, bytes, width: size.width, height: size.height }
}

export interface PreparedCover extends ExportAsset {
  dataUrl: string
}

export async function prepareCoverAsset(
  dataUrl: string,
  target: BookAssetTarget,
  name = 'cover',
  profile: ImageProfile = 'full',
): Promise<PreparedCover> {
  const normalized = await normalizeImage(dataUrl, target, profile)
  return {
    id: name,
    fileName: `${name}.${imageExtension(normalized.mime)}`,
    mime: normalized.mime,
    bytes: normalized.bytes,
    width: normalized.width,
    height: normalized.height,
    dataUrl: normalized.dataUrl,
  }
}

export function formulaKey(latex: string, displayMode: boolean): string {
  return `${displayMode ? 'block' : 'inline'}:${latex}`
}

function collectSources(docs: JsonNode[]): { images: string[]; formulas: { key: string; latex: string; display: boolean }[] } {
  const images: string[] = []
  const seenImages = new Set<string>()
  const formulas: { key: string; latex: string; display: boolean }[] = []
  const seenFormulas = new Set<string>()
  const walk = (node: JsonNode) => {
    if (node.type === 'image' || node.type === 'resizableImage') {
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src : ''
      if (src && !seenImages.has(src)) {
        seenImages.add(src)
        images.push(src)
      }
    }
    if (node.type === 'formula') {
      const latex = typeof node.attrs?.latex === 'string' ? node.attrs.latex : ''
      if (latex) {
        const display = Boolean(node.attrs?.displayMode)
        const key = formulaKey(latex, display)
        if (!seenFormulas.has(key)) {
          seenFormulas.add(key)
          formulas.push({ key, latex, display })
        }
      }
    }
    for (const child of node.content || []) walk(child)
  }
  for (const doc of docs) walk(doc)
  return { images, formulas }
}

async function renderFormulaPng(latex: string, display: boolean): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (typeof document === 'undefined') return null
  try {
    const katex = (await import('katex')).default
    const html = katex.renderToString(latex, {
      displayMode: display,
      throwOnError: true,
      output: 'html',
    })
    const host = document.createElement('div')
    host.style.position = 'fixed'
    host.style.left = '-100000px'
    host.style.top = '0'
    host.style.display = 'inline-block'
    host.style.padding = '6px'
    host.style.background = '#ffffff'
    host.style.color = '#000000'
    host.style.fontSize = display ? '24px' : '20px'
    host.innerHTML = html
    document.body.appendChild(host)
    const rect = host.getBoundingClientRect()
    const { domToPng } = await import('modern-screenshot')
    const dataUrl = await domToPng(host, { scale: 2, backgroundColor: '#ffffff' })
    host.remove()
    return {
      dataUrl,
      width: Math.max(1, Math.round(rect.width * 2)),
      height: Math.max(1, Math.round(rect.height * 2)),
    }
  } catch {
    return null
  }
}

export interface PrepareAssetsOptions {
  target: BookAssetTarget
  /** `'preview'` trades picture fidelity for a PDF small enough to re-render live. */
  imageProfile?: ImageProfile
  readImage?: (src: string) => Promise<string>
  onProgress?: (done: number, total: number) => void
}

function addAsset(
  map: Map<string, ExportAsset>,
  all: ExportAsset[],
  key: string,
  asset: ExportAsset,
): void {
  if (map.has(key)) return
  map.set(key, asset)
  all.push(asset)
}

export async function prepareBookAssets(
  chapters: BookChapter[],
  options: PrepareAssetsOptions,
): Promise<BookAssets> {
  const docs = chapters.map((chapter) => chapter.doc as JsonNode)
  const { images, formulas } = collectSources(docs)
  const readImage = options.readImage || ((src: string) => exportApi.readImageAsDataURL(src))
  const imagesMap = new Map<string, ExportAsset>()
  const mermaidMap = new Map<string, ExportAsset>()
  const formulasMap = new Map<string, ExportAsset>()
  const all: ExportAsset[] = []
  const warnings: string[] = []
  const total = images.length + formulas.length + 1
  let done = 0
  const step = () => {
    done += 1
    options.onProgress?.(done, total)
  }

  for (let index = 0; index < images.length; index += 1) {
    const src = images[index]
    try {
      const dataUrl = src.startsWith('data:') ? src : await readImage(src)
      const normalized = await normalizeImage(dataUrl, options.target, options.imageProfile)
      const asset: ExportAsset = {
        id: `img-${String(index + 1).padStart(3, '0')}`,
        fileName: `img-${String(index + 1).padStart(3, '0')}.${imageExtension(normalized.mime)}`,
        mime: normalized.mime,
        bytes: normalized.bytes,
        width: normalized.width,
        height: normalized.height,
      }
      addAsset(imagesMap, all, src, asset)
    } catch {
      warnings.push(nt('assets.readFailed', { src }))
    }
    step()
  }

  try {
    const merged = { type: 'doc', content: docs.flatMap((doc) => doc.content || []) }
    const rendered = await collectMermaidPngsFromJson(merged, 'light')
    let mermaidIndex = 0
    for (const [source, png] of rendered) {
      mermaidIndex += 1
      const parsed = parseDataUrl(png.dataUrl)
      if (!parsed) continue
      addAsset(mermaidMap, all, source, {
        id: `mermaid-${String(mermaidIndex).padStart(3, '0')}`,
        fileName: `mermaid-${String(mermaidIndex).padStart(3, '0')}.png`,
        mime: parsed.mime || 'image/png',
        bytes: parsed.bytes,
        width: png.width,
        height: png.height,
      })
    }
  } catch {
    warnings.push(nt('assets.mermaidFailed'))
  }
  step()

  let formulaIndex = 0
  for (const formula of formulas) {
    const png = await renderFormulaPng(formula.latex, formula.display)
    if (png) {
      formulaIndex += 1
      const parsed = parseDataUrl(png.dataUrl)
      if (parsed) {
        addAsset(formulasMap, all, formula.key, {
          id: `math-${String(formulaIndex).padStart(3, '0')}`,
          fileName: `math-${String(formulaIndex).padStart(3, '0')}.${imageExtension(parsed.mime)}`,
          mime: parsed.mime || 'image/png',
          bytes: parsed.bytes,
          width: png.width,
          height: png.height,
        })
      }
    } else {
      warnings.push(nt('assets.formulaFailed'))
    }
    step()
  }

  return { images: imagesMap, mermaid: mermaidMap, formulas: formulasMap, all, warnings }
}

export function assetSrc(asset: ExportAsset): string {
  return asset.fileName
}

export function missingImageText(alt: string): string {
  return nt('assets.missingImage', { alt: alt || nt('assets.image') })
}

export function formulaFallbackText(latex: string, display: boolean): string {
  return display ? `$$${latex}$$` : `$${latex}$`
}
