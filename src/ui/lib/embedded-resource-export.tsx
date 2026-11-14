import { createRoot } from 'react-dom/client'
import { toPng, getFontEmbedCSS } from 'html-to-image'
import katexCSS from 'katex/dist/katex.min.css?inline'
import {loadEmbeddedResource} from '../bridge/embedded-files'
import 'simple-mind-map/dist/simpleMindMap.esm.css'

type JsonNode = { type?: string; attrs?: Record<string, any>; content?: JsonNode[]; [key: string]: unknown }
export type ResourceImage = { src: string; width: number; height: number }
export type ResourceImageRenderer = (kind: 'flowCanvas' | 'mindMapEmbed', id: string) => Promise<ResourceImage>

async function readyImages(host: HTMLElement) {
  await document.fonts?.ready
  await Promise.all([...host.querySelectorAll('img')].map(async image => {
    if (image.decode) await image.decode()
    if (!image.naturalWidth) throw new Error('图形中的图片加载失败')
  }))
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

/** Render the current resource from disk; device-local thumbnail caches are not authoritative. */
export const renderResourceImage: ResourceImageRenderer = async (kind, id) => {
  if (!id) throw new Error('嵌入图形缺少资源标识')
  const resource = await loadEmbeddedResource(kind,id)
  const host = document.createElement('div')
  Object.assign(host.style, { position: 'fixed', left: '-20000px', top: '0', width: '1200px', height: '800px', background: '#fff', color: '#202536' })
  document.body.append(host)
  let dispose = () => {}
  let exportMindMap: (() => Promise<ResourceImage>) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  try {
    const element = await Promise.race([
      new Promise<HTMLElement>((_, reject) => { timer = setTimeout(() => reject(new Error('嵌入图形渲染超时')), 60_000) }),
      (async () => {
        if (kind === 'flowCanvas') {
          const { StructuredCanvasPreview } = await import('../features/canvas/editor/StructuredCanvasPreview')
          if (disposed) throw new Error('嵌入图形渲染已结束')
          const root = createRoot(host)
          dispose = () => root.unmount()
          return new Promise<HTMLElement>(resolve => root.render(<StructuredCanvasPreview snapshot={resource as import('../features/canvas/domain/types').CanvasSnapshot} minHeight={520} onReady={resolve} />))
        }
        const [{ artifactToTree }, { default: MindMap }, { resolveThemeConfig, rainbowPresetColors }, { mindMapNodeIcon, mindMapNodeFormula }] = await Promise.all([
          import('../features/creative/artifact-tree'),
          import('../features/creative/simple-mind-map'), import('../features/creative/mindmap-presets'), import('../features/creative/mindmap-node-content'),
        ])
        await document.fonts?.ready
        if (disposed) throw new Error('嵌入图形渲染已结束')
        const artifact = resource as import('../features/creative/types').CreativeArtifact
        const content = artifact.content as Record<string, any>
        let exportCSS = ''
        const instance = new MindMap({ el: host, data: artifactToTree(artifact), readonly: true, fit: false,
          layout: content.structure || ({ 'tree-h': 'logicalStructure', 'tree-v': 'mindMap', fishbone: 'fishbone', radial: 'organizationStructure' } as Record<string, string>)[content.viewMode] || 'logicalStructure',
          themeConfig: resolveThemeConfig(content.themeId, content.baseStyle || {}),
          rainbowLinesConfig: { open: content.rainbow?.open === true, colorsList: rainbowPresetColors(content.rainbow?.presetId) },
          createNodePrefixContent: mindMapNodeIcon, createNodePostfixContent: mindMapNodeFormula,
          handleBeingExportSvg: (svg: { node: SVGElement }) => {
            // The library serializes custom HTML nodes without the page's CSS.
            // Embed KaTeX rules and used fonts so PNG keeps the actual formula
            // and never exposes the hidden MathML text as a second formula.
            const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
            style.textContent = exportCSS
            svg.node.prepend(style)
            return svg
          },
        })
        dispose = () => instance.destroy()
        exportMindMap = async () => {
          exportCSS = katexCSS.replace(/@font-face\s*\{[^}]*\}/g, '') + await getFontEmbedCSS(host)
          const src = await instance.export('png', false, artifact.title, true)
          const image = new Image()
          image.src = src
          await image.decode()
          return { src, width: image.naturalWidth, height: image.naturalHeight }
        }
        return new Promise<HTMLElement>(resolve => {
          instance.on('node_tree_render_end', () => { instance.view.fit(undefined, false, 28); resolve(host) })
        })
      })(),
    ])
    await readyImages(element)
    if (exportMindMap) return await exportMindMap()
    const width = element.clientWidth, height = element.clientHeight
    if (element.querySelector('[data-canvas-component-error]')) throw new Error('画布组件渲染失败')
    const src = await toPng(element, { pixelRatio: 2, backgroundColor: '#fff', cacheBust: true, style: { position: 'relative', left: '0', top: '0' } })
    return { src, width, height }
  } finally { disposed = true; clearTimeout(timer); dispose(); host.remove() }
}

/** Convert only an export copy. Stored documents continue to reference editable resources. */
export async function resolveEmbeddedResources<T extends JsonNode>(doc: T, render: ResourceImageRenderer = renderResourceImage): Promise<T> {
  const images = new Map<string, Promise<ResourceImage>>()
  const walk = async (node: JsonNode): Promise<JsonNode> => {
    if (node.type === 'flowCanvas' || node.type === 'mindMapEmbed') {
      const id = String(node.attrs?.[node.type === 'flowCanvas' ? 'flowCanvasId' : 'artifactId'] || '')
      const key = `${node.type}:${id}`
      if (!images.has(key)) images.set(key, render(node.type, id))
      const image = await images.get(key)!
      return { type: 'image', attrs: { src: image.src, alt: node.attrs?.title || '', width: image.width, height: image.height } }
    }
    if (!node.content) return { ...node }
    const content: JsonNode[] = []
    for (const child of node.content) content.push(await walk(child))
    return { ...node, content }
  }
  return await walk(doc) as T
}

export async function resolveEmbeddedResourceElements(root: HTMLElement, render: ResourceImageRenderer = renderResourceImage): Promise<void> {
  const images = new Map<string, Promise<ResourceImage>>()
  for (const element of root.querySelectorAll<HTMLElement>('[data-flow-canvas-id], [data-mindmap-artifact-id]')) {
    if (!root.contains(element)) continue
    const kind = element.hasAttribute('data-flow-canvas-id') ? 'flowCanvas' : 'mindMapEmbed'
    const id = element.getAttribute(kind === 'flowCanvas' ? 'data-flow-canvas-id' : 'data-mindmap-artifact-id') || ''
    const key = `${kind}:${id}`
    if (!images.has(key)) images.set(key, render(kind, id))
    const image = await images.get(key)!
    const img = document.createElement('img')
    img.src = image.src; img.alt = element.getAttribute('data-title') || ''; img.width = image.width; img.height = image.height
    img.style.cssText = 'display:block;max-width:100%;height:auto;margin:12px auto'
    element.replaceWith(img)
  }
}
