import type { EpubPresetId, ExportAsset } from './types'
import { parseDataUrl } from './assets'
import { nt } from '../nt'

export interface CoverPalette {
  background: string
  foreground: string
  muted: string
  accent: string
}

export const COVER_PALETTES: Record<EpubPresetId, CoverPalette> = {
  // Paper white, not cream: the default cover sits behind the user's own image
  // upload, so it should read as a blank sheet rather than impose a warm tint.
  literary: { background: '#fbfbfa', foreground: '#1f1f1f', muted: '#666666', accent: '#9a9a9a' },
  modern: { background: '#f5f7f9', foreground: '#1f2933', muted: '#66727e', accent: '#3d6f8e' },
  minimal: { background: '#fbfaf7', foreground: '#262626', muted: '#737373', accent: '#4d4d4d' },
  technical: { background: '#edf2f7', foreground: '#16283a', muted: '#5a6b7b', accent: '#2f6690' },
}

export interface DefaultCoverInput {
  title: string
  subtitle?: string
  author?: string
  palette: CoverPalette
}

const WIDTH = 1200
const HEIGHT = 1800

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const source = text.trim()
  if (!source) return []
  const lines: string[] = []
  for (const paragraph of source.split(/\r?\n/)) {
    let line = ''
    for (const char of Array.from(paragraph)) {
      const next = line + char
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line.trimEnd())
        line = char.trimStart()
        if (lines.length >= maxLines) return lines
      } else {
        line = next
      }
    }
    if (line.trim()) lines.push(line.trimEnd())
    if (lines.length >= maxLines) return lines.slice(0, maxLines)
  }
  return lines
}

function drawCenteredLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  y: number,
  lineHeight: number,
): number {
  let cursor = y
  for (const line of lines) {
    ctx.fillText(line, WIDTH / 2, cursor)
    cursor += lineHeight
  }
  return cursor
}

/**
 * Default 2:3 cover drawn at export time. Returns null when Canvas is
 * unavailable (tests) so the caller can fall back to a text cover page.
 */
export async function createDefaultCover(input: DefaultCoverInput): Promise<ExportAsset | null> {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const { background, foreground, muted, accent } = input.palette
  ctx.fillStyle = background
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.strokeStyle = accent
  ctx.lineWidth = 3
  ctx.strokeRect(72, 72, WIDTH - 144, HEIGHT - 144)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = accent
  ctx.font = '500 30px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('大懒猫创作平台', WIDTH / 2, 190)

  const serif = '"Songti SC", "SimSun", "Noto Serif CJK SC", serif'
  ctx.fillStyle = foreground
  ctx.font = `700 92px ${serif}`
  const titleLines = wrapText(ctx, input.title || nt('unnamed.content'), WIDTH - 300, 4)

  let cursor = 640
  ctx.fillStyle = foreground
  cursor = drawCenteredLines(ctx, titleLines, cursor, 116)

  if (input.subtitle?.trim()) {
    ctx.fillStyle = muted
    ctx.font = `400 42px ${serif}`
    cursor += 18
    const subtitleLines = wrapText(ctx, input.subtitle, WIDTH - 380, 3)
    cursor = drawCenteredLines(ctx, subtitleLines, cursor, 58)
  }

  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(WIDTH / 2 - 70, cursor + 70)
  ctx.lineTo(WIDTH / 2 + 70, cursor + 70)
  ctx.stroke()

  if (input.author?.trim()) {
    ctx.fillStyle = foreground
    ctx.font = `400 46px ${serif}`
    ctx.fillText(input.author.trim(), WIDTH / 2, cursor + 170)
  }

  const parsed = parseDataUrl(canvas.toDataURL('image/png'))
  if (!parsed) return null
  return {
    id: 'cover',
    fileName: 'cover.png',
    mime: 'image/png',
    bytes: parsed.bytes,
    width: WIDTH,
    height: HEIGHT,
  }
}
