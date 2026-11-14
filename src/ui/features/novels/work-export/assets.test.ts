import '../test-i18n'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bytesToDataUrl,
  formulaKey,
  imageSizeFromBytes,
  missingImageText,
  normalizeImage,
  parseDataUrl,
} from './assets'

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

/** A JPEG whose SOF0 header reports `width` x `height`, for canvas stub output. */
function jpegDataUrl(width: number, height: number): string {
  const bytes = new Uint8Array(12)
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x07, 0x08], 0)
  const view = new DataView(bytes.buffer)
  view.setUint16(7, height)
  view.setUint16(9, width)
  return `data:image/jpeg;base64,${btoa(String.fromCharCode(...bytes))}`
}

interface CanvasCall {
  mime: string
  quality: number
  width: number
  height: number
}

/** Minimal DOM so the canvas pass can run in the node test environment. */
function stubCanvas(source: { width: number; height: number }): CanvasCall[] {
  const calls: CanvasCall[] = []
  class FakeImage {
    naturalWidth = source.width
    naturalHeight = source.height
    onload: (() => void) | null = null
    set src(_value: string) {
      Promise.resolve().then(() => this.onload?.())
    }
  }
  vi.stubGlobal('Image', FakeImage)
  vi.stubGlobal('document', {
    createElement: () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({ fillStyle: '', fillRect: () => undefined, drawImage: () => undefined }),
        toDataURL: (mime: string, quality: number) => {
          calls.push({ mime, quality, width: canvas.width, height: canvas.height })
          return jpegDataUrl(canvas.width, canvas.height)
        },
      }
      return canvas
    },
  })
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('export assets', () => {
  it('parses base64 and percent-encoded data URLs', () => {
    const base64 = parseDataUrl('data:image/png;base64,aGVsbG8=')
    expect(base64?.mime).toBe('image/png')
    expect(new TextDecoder().decode(base64?.bytes)).toBe('hello')

    const plain = parseDataUrl('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')
    expect(plain?.mime).toBe('image/svg+xml')
    expect(new TextDecoder().decode(plain?.bytes)).toBe('<svg></svg>')
  })

  it('round-trips bytes through a data URL', () => {
    const bytes = pngHeader(640, 480)
    const url = bytesToDataUrl(bytes, 'image/png')
    const parsed = parseDataUrl(url)
    expect(parsed?.mime).toBe('image/png')
    expect(Array.from(parsed?.bytes || [])).toEqual(Array.from(bytes))
    expect(imageSizeFromBytes(bytes, 'image/png')).toEqual({ width: 640, height: 480 })
  })

  it('passes a normal PNG through for EPUB without a DOM', async () => {
    const bytes = pngHeader(320, 200)
    const normalized = await normalizeImage(bytesToDataUrl(bytes, 'image/png'), 'epub')
    expect(normalized.mime).toBe('image/png')
    expect(normalized.width).toBe(320)
    expect(normalized.height).toBe(200)
    expect(Array.from(normalized.bytes)).toEqual(Array.from(bytes))
  })

  it('rejects an unsupported image when no canvas exists', async () => {
    await expect(
      normalizeImage('data:image/webp;base64,aGVsbG8=', 'docx'),
    ).rejects.toThrow()
  })

  it('keys formulas by mode and latex', () => {
    expect(formulaKey('x^2', false)).not.toBe(formulaKey('x^2', true))
    expect(missingImageText('封面')).toContain('封面')
  })

  it('re-encodes every preview picture to a small jpeg', async () => {
    const bytes = pngHeader(4000, 3000)
    const calls = stubCanvas({ width: 4000, height: 3000 })

    const normalized = await normalizeImage(bytesToDataUrl(bytes, 'image/png'), 'pdf', 'preview')

    // A photographic PNG stays megabytes even at 1200px, so the preview forces JPEG.
    expect(calls).toEqual([{ mime: 'image/jpeg', quality: 0.72, width: 1200, height: 900 }])
    expect(normalized.mime).toBe('image/jpeg')
    expect(normalized.width).toBe(1200)
    expect(normalized.height).toBe(900)
  })

  it('keeps original bytes for the exported file', async () => {
    const bytes = pngHeader(320, 200)
    const calls = stubCanvas({ width: 320, height: 200 })

    const normalized = await normalizeImage(bytesToDataUrl(bytes, 'image/png'), 'pdf')

    expect(calls).toHaveLength(0)
    expect(normalized.mime).toBe('image/png')
    expect(Array.from(normalized.bytes)).toEqual(Array.from(bytes))
  })

  it('falls back to the original picture when the preview canvas is missing', async () => {
    const bytes = pngHeader(320, 200)
    const normalized = await normalizeImage(bytesToDataUrl(bytes, 'image/png'), 'pdf', 'preview')
    expect(normalized.mime).toBe('image/png')
  })
})
