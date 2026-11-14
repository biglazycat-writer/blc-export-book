export const IMAGE_THEMES = {
  paper: { background: 'linear-gradient(135deg, #e8e0d2, #f5efe4)', card: '#fffdf8', ink: '#302e29', accent: '#90704c' },
  sky: { background: 'linear-gradient(135deg, #b9d8ee, #deeaf7 48%, #abbfe0)', card: '#ffffff', ink: '#25364a', accent: '#437fb2' },
  peach: { background: 'linear-gradient(135deg, #efb8a4, #f6dcd0 55%, #e7b6b8)', card: '#fffaf7', ink: '#49352f', accent: '#ba6954' },
  forest: { background: 'linear-gradient(135deg, #9bb6a0, #d7e1cf 55%, #a9c1b4)', card: '#fbfdf8', ink: '#2e4136', accent: '#527c61' },
  lilac: { background: 'linear-gradient(135deg, #b9aedb, #e6dff2 55%, #c3bfdf)', card: '#fefcff', ink: '#403653', accent: '#8872ac' },
  midnight: { background: 'linear-gradient(135deg, #172b43, #3d516c 55%, #26344e)', card: '#192537', ink: '#e5edf5', accent: '#a9c7ea' },
} as const

export type ImageTheme = keyof typeof IMAGE_THEMES

/** The card already has a title; remove only an identical leading H1. */
export function withoutRepeatedTitle(markdown: string, title: string): string {
  const match = /^\s*#\s+([^\r\n]+)(?:\r?\n|$)/.exec(markdown)
  if (!match) return markdown
  const heading = match[1].replace(/\s+#+\s*$/, '').trim()
  return heading === title.trim() ? markdown.slice(match[0].length).replace(/^\s*\n/, '') : markdown
}
export const IMAGE_LAYOUTS = ['essay', 'editorial', 'poetry', 'minimal'] as const
export type ImageLayout = typeof IMAGE_LAYOUTS[number]
export type ImageRatio = 'auto' | '3:4' | '1:1' | '16:9'
export const IMAGE_FONTS = {
  sans: '"Microsoft YaHei", "PingFang SC", sans-serif',
  serif: '"Songti SC", "SimSun", serif',
  wenkai: '"LXGW WenKai", "KaiTi", serif',
} as const

export interface ImageDesign {
  theme: ImageTheme
  layout: ImageLayout
  ratio: ImageRatio
  width: number
  inset: number
  padding: number
  radius: number
  shadow: boolean
  font: keyof typeof IMAGE_FONTS
  fontSize: number
  lineHeight: number
  align: 'left' | 'center'
  scale: number
  background: string
  showTitle: boolean
}

const LAYOUT_PRESETS: Record<ImageLayout, Pick<ImageDesign, 'fontSize' | 'lineHeight' | 'align' | 'padding' | 'inset' | 'radius' | 'shadow'>> = {
  essay: { fontSize: 22, lineHeight: 1.9, align: 'left', padding: 44, inset: 36, radius: 12, shadow: true },
  editorial: { fontSize: 20, lineHeight: 1.8, align: 'left', padding: 40, inset: 28, radius: 4, shadow: false },
  poetry: { fontSize: 24, lineHeight: 2, align: 'center', padding: 48, inset: 40, radius: 20, shadow: true },
  minimal: { fontSize: 20, lineHeight: 1.7, align: 'left', padding: 32, inset: 24, radius: 8, shadow: false },
}

/** A layout changes typography and spacing; the user's copy, colors and canvas stay intact. */
export function applyImageLayout(design: ImageDesign, layout: ImageLayout): ImageDesign {
  return { ...design, ...LAYOUT_PRESETS[layout], layout, font: 'wenkai' }
}

export function defaultImageDesign(): ImageDesign {
  return { theme: 'paper', layout: 'essay', ratio: 'auto', width: 720, ...LAYOUT_PRESETS.essay,
    font: 'wenkai', scale: 2,
    background: '', showTitle: true }
}

export function imageHeight(design: Pick<ImageDesign, 'width' | 'ratio'>): number | undefined {
  if (design.ratio === 'auto') return undefined
  const [w, h] = design.ratio.split(':').map(Number)
  return Math.round(design.width * h / w)
}

// Do not silently shrink long articles or let the screenshot library truncate them.
export function imageOutputSize(width: number, height: number, scale: number) {
  const w = Math.ceil(width * scale), h = Math.ceil(height * scale)
  return { width: w, height: h, valid: w > 0 && h > 0 && w <= 30000 && h <= 30000 && w * h <= 40_000_000 }
}
