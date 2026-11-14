import { createTypstCompiler, loadFonts } from '@myriaddreamin/typst.ts'
import type { TypstCompiler } from '@myriaddreamin/typst.ts'
import { nt } from '../nt'

export interface TypstShadowAsset {
  path: string
  bytes: Uint8Array
}

export interface TypstCompileInput {
  main: string
  chapters: { path: string; source: string }[]
  assets: TypstShadowAsset[]
}

/**
 * Every face the export can reference. Typst has no system fonts inside the
 * WASM sandbox, so a glyph that no loaded font covers prints as a tofu box:
 * the serif face carries the body text, the emoji face carries icons and
 * symbols, and the mono face carries code.
 */
const assetUrl = (file: string) => new URL('./runtime/typesetting/' + file, document.baseURI).href
async function fontFilesFor(_family: string): Promise<string[]> {
  return ['NotoSerifSC_400Regular.ttf', 'NotoSerifSC_700Bold.ttf']
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(nt('export.errorLoadFont', { status: response.status }))
  return new Uint8Array(await response.arrayBuffer())
}

let compilerPromise: Promise<TypstCompiler> | null = null
let compilerKey = ''
let queue: Promise<void> = Promise.resolve()

async function getCompiler(family: string): Promise<TypstCompiler> {
  const files = await fontFilesFor(family)
  const key = `${family}\n${files.slice().sort().join('\n')}`
  if (!compilerPromise || compilerKey !== key) {
    compilerKey = key
    compilerPromise = (async () => {
      const fonts = await Promise.all([
        ...files.map((name) => fetchBytes(assetUrl(name))),
        fetchBytes(assetUrl('NotoEmoji_400Regular.ttf')),
        fetchBytes(assetUrl('NotoSansMono_400Regular.ttf')),
      ])
      const compiler = createTypstCompiler()
      await compiler.init({
        beforeBuild: [loadFonts(fonts, { assets: false })],
        getModule: () => assetUrl('typst_ts_web_compiler_bg.wasm'),
      })
      return compiler
    })().catch((error) => {
      compilerPromise = null
      compilerKey = ''
      throw error
    })
  }
  return compilerPromise
}

function diagnosticsText(diagnostics: unknown): string {
  const list = Array.isArray(diagnostics)
    ? diagnostics.map((item) => String(item)).filter(Boolean)
    : []
  if (list.length > 0) console.error('[PDF] Typst diagnostics:', list)
  return list.slice(0, 3).join('\n')
}

async function compileNow(input: TypstCompileInput, family: string): Promise<Uint8Array> {
  const compiler = await getCompiler(family)
  compiler.addSource('/main.typ', input.main)
  for (const chapter of input.chapters) compiler.addSource(chapter.path, chapter.source)
  // Never call resetShadow(): in this compiler build, once resetShadow has run,
  // every later mapShadow entry fails to load with "access denied". Unused stale
  // entries are harmless — only paths the document references are ever read.
  for (const asset of input.assets) compiler.mapShadow(asset.path, asset.bytes)

  // compiler.compile() snapshots a Typst world per call and never frees it, so
  // every preview left its whole document (text plus every mapped image) in the
  // 4 GiB WASM heap. After a few hundred compiles the heap ran out and the next
  // export trapped or spun forever. runWithWorld frees the world once the
  // artifact is exported.
  let failure: Error | null = null
  const bytes = await compiler.runWithWorld({ mainFilePath: '/main.typ' }, async (world) => {
    const result = await world.pdf({ diagnostics: 'unix' })
    if (!result.result || result.result.length < 5) {
      const detail = diagnosticsText(result.diagnostics)
      failure = new Error(detail ? nt('export.errorCompileFailedDetail', { detail }) : nt('export.errorCompileFailed'))
      return null
    }
    return result.result
  })
  if (failure) throw failure
  if (!bytes) throw new Error(nt('export.errorCompileFailed'))
  const signature = String.fromCharCode(...bytes.subarray(0, 5))
  if (signature !== '%PDF-') throw new Error(nt('export.errorInvalidPdf'))
  return bytes
}

/** Compiler instances are stateful, so compiles are serialized. */
export async function compileTypstPdf(input: TypstCompileInput, family = 'Noto Serif SC'): Promise<Uint8Array> {
  const run = queue.then(() => compileNow(input, family))
  queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
