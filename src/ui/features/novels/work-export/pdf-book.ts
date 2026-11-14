import type {
  BookAssets,
  ExportAsset,
  PdfExportSettings,
  WorkBookModel,
} from './types'
import {
  buildTypstBookSource,
  typstContentWidthPt,
  type TypstAssetRef,
} from './typst-source'
import {
  compileTypstPdf,
  type TypstCompileInput,
  type TypstShadowAsset,
} from './typst-runtime'
import { COVER_PALETTES } from './cover'
import { formulaKey } from './assets'
import { throwIfAborted } from './progress'

export interface BuildPdfBookInput {
  book: WorkBookModel
  settings: PdfExportSettings
  assets: Pick<BookAssets, 'images' | 'mermaid' | 'formulas'>
  cover?: ExportAsset | null
  /** Header logo, already normalized to a raster asset. */
  logo?: { asset: ExportAsset; heightMm: number } | null
  includeSynopsis?: boolean
  signal?: AbortSignal
  onChapter?: (done: number, total: number) => void
  onCompile?: () => void
  /** Test seam; production uses the Typst WASM compiler. */
  compile?: (input: TypstCompileInput) => Promise<Uint8Array>
}

function safeAssetName(asset: ExportAsset): string {
  return (
    String(asset.fileName || asset.id || 'asset')
      .replace(/[^A-Za-z0-9._-]/g, '-')
      .replace(/^\.+/, '')
      .slice(0, 120) || 'asset'
  )
}

function defaultCoverPalette(settings: PdfExportSettings) {
  if (settings.preset === 'print') return COVER_PALETTES.technical
  if (settings.preset === 'manuscript') return COVER_PALETTES.minimal
  return COVER_PALETTES.literary
}

export interface TypstAssetRegistry {
  /** 要写进编译器 shadow 的文件，按注册顺序。 */
  shadows: TypstShadowAsset[]
  register: (asset: ExportAsset) => TypstAssetRef
  imageSrc: (src: string) => TypstAssetRef | null
  mermaidSrc: (source: string) => TypstAssetRef | null
  formulaSrc: (latex: string, display: boolean) => TypstAssetRef | null
}

/**
 * 把导出资产映射成 Typst 的 shadow 路径。
 *
 * 书籍导出和单章导出用的是同一套规则（路径要避开 Typst 不接受的字符，重名要加序号），
 * 所以收在一处，别在两处各写一份。
 */
export function createTypstAssetRegistry(
  assets: Pick<BookAssets, 'images' | 'mermaid' | 'formulas'>,
): TypstAssetRegistry {
  const shadows: TypstShadowAsset[] = []
  const paths = new Map<ExportAsset, string>()
  const usedPaths = new Set<string>()

  const register = (asset: ExportAsset): TypstAssetRef => {
    const existing = paths.get(asset)
    if (existing) return { path: existing, width: asset.width, height: asset.height }
    const base = safeAssetName(asset)
    let path = `/assets/${base}`
    let suffix = 1
    while (usedPaths.has(path)) {
      suffix += 1
      path = `/assets/${base.replace(/(\.[^.]+)?$/, '')}-${suffix}${base.match(/(\.[^.]+)$/)?.[1] || ''}`
    }
    usedPaths.add(path)
    paths.set(asset, path)
    shadows.push({ path, bytes: asset.bytes })
    return { path, width: asset.width, height: asset.height }
  }

  return {
    shadows,
    register,
    imageSrc: (src) => {
      const asset = assets.images.get(src)
      return asset ? register(asset) : null
    },
    mermaidSrc: (source) => {
      const asset = assets.mermaid.get(source.trim())
      return asset ? register(asset) : null
    },
    formulaSrc: (latex, display) => {
      const asset = assets.formulas.get(formulaKey(latex, display))
      return asset ? register(asset) : null
    },
  }
}

export async function buildPdfBook(input: BuildPdfBookInput): Promise<Uint8Array> {
  const { book, settings } = input
  const registry = createTypstAssetRegistry(input.assets)
  const { register, imageSrc, mermaidSrc, formulaSrc, shadows } = registry

  let coverPath: string | null = null
  if (settings.includeCover && input.cover) coverPath = register(input.cover).path
  const branding = input.logo
    ? { path: register(input.logo.asset).path, heightMm: input.logo.heightMm }
    : null
  throwIfAborted(input.signal)

  const source = await buildTypstBookSource({
    book,
    settings,
    contentWidthPt: typstContentWidthPt(settings),
    includeSynopsis: input.includeSynopsis,
    coverPath,
    coverPalette: defaultCoverPalette(settings),
    branding,
    imageSrc,
    mermaidSrc,
    formulaSrc,
    signal: input.signal,
    onChapter: input.onChapter,
  })
  throwIfAborted(input.signal)

  input.onCompile?.()
  const compile = input.compile || ((payload) => compileTypstPdf(payload, settings.bodyFont))
  const bytes = await compile({
    main: source.main,
    chapters: source.chapters,
    assets: shadows,
  })
  throwIfAborted(input.signal)
  return bytes
}
