import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { ComponentHostAPI } from '../components/registry/types'
import { ComponentHost } from '../components/ComponentHost'
import type { CanvasConnector, CanvasElement, CanvasSnapshot } from '../domain/types'
import './structured-canvas-preview.css'
import './structured-canvas.css'
import { Position } from '@xyflow/react'
import { worldBounds } from '../runtime/worldBounds'
import { ComponentRegistry } from '../components/registry/ComponentRegistry'
import { registerCoreComponents } from '../components/builtins'
import { readConnectorStyle, connectorMarkerIsHollow, connectorMarkerIsStrokeOnly, connectorTextOffset } from '../runtime/projectConnectors'
import { routeConnectorPath, connectorMarkerPath } from './CanvasConnectorEdge'
import { canvasShapePortPosition, type CanvasShapeKind } from '../components/shapes/shape-geometry'
import { CanvasConnectorText, CanvasConnectorTextMask, type ConnectorTextSize } from './CanvasConnectorText'

export const CANVAS_SNAPSHOT_CHANGED_EVENT = 'biglazycat:canvas-snapshot-changed'

type Props = { snapshot: CanvasSnapshot; minHeight?: number; onReady?: (element: HTMLElement) => void }
type Bounds = { x: number; y: number; width: number; height: number }
type PreviewLayout = { scale: number; width: number; height: number }

const PREVIEW_PADDING = 24
const MIN_PREVIEW_HEIGHT = 200
const MAX_PREVIEW_SCALE = 1

export function canvasContentBounds(elements: readonly CanvasElement[]): Bounds {
  if (elements.length === 0) return { x: 0, y: 0, width: 640, height: 320 }
  const boxes = elements.map(worldBounds)
  const left = Math.min(...boxes.map((e) => e.x))
  const top = Math.min(...boxes.map((e) => e.y))
  const right = Math.max(...boxes.map((e) => e.x + e.width))
  const bottom = Math.max(...boxes.map((e) => e.y + e.height))
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }
}

export function canvasPreviewLayout(bounds: Bounds, availableWidth: number, availableHeight: number): PreviewLayout {
  const innerWidth = Math.max(1, availableWidth - PREVIEW_PADDING * 2)
  const innerHeight = Math.max(1, availableHeight - PREVIEW_PADDING * 2)
  const scale = Math.min(MAX_PREVIEW_SCALE, innerWidth / bounds.width, innerHeight / bounds.height)
  return { scale, width: bounds.width * scale, height: bounds.height * scale }
}

function endpoint(connector: CanvasConnector, which: 'source' | 'target', elements: Map<string, CanvasElement>) {
  const value = connector[which]
  const fallback = which === 'source' ? Position.Right : Position.Left
  if (value.kind === 'point') return { ...value.point, side: fallback }
  const element = elements.get(value.element_id)
  if (!element) return undefined
  const side = (value.anchor_id || fallback) as Position
  const point = canvasShapePortPosition(element.props.shape as CanvasShapeKind, side)
    || { left: { x: 0, y: .5 }, right: { x: 1, y: .5 }, top: { x: .5, y: 0 }, bottom: { x: .5, y: 1 } }[side] || { x: .5, y: .5 }
  const width = element.bounds.width * element.transform.scale_x, height = element.bounds.height * element.transform.scale_y
  const angle = element.transform.rotation * Math.PI / 180, dx = (point.x - .5) * width, dy = (point.y - .5) * height
  return { x: element.transform.x + width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle), y: element.transform.y + height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle), side }
}

function PreviewCanvas({ snapshot, runtime, minHeight, onReady }: { snapshot: CanvasSnapshot; runtime: {registry: ComponentRegistry}; minHeight: number; onReady?: Props['onReady'] }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [availableWidth, setAvailableWidth] = useState(720)
  const [textSizes, setTextSizes] = useState<Record<string, ConnectorTextSize>>({})
  const maskPrefix = `preview-text-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const visibleElements = snapshot.elements.filter(element => element.visibility.mode !== 'hidden' && snapshot.layers.find(layer => layer.id === element.layer_id)?.visible !== false)
    .sort((left, right) => left.z_order.localeCompare(right.z_order))
  const bounds = canvasContentBounds(visibleElements)
  const elements = new Map(visibleElements.map((element) => [element.id, element]))
  const connectors = snapshot.connectors.flatMap(connector => {
    const source = endpoint(connector, 'source', elements)
    const target = endpoint(connector, 'target', elements)
    if (!source || !target) return []
    const style = readConnectorStyle(connector.style)
    const path = routeConnectorPath({ sourceX: source.x, sourceY: source.y, targetX: target.x, targetY: target.y, sourcePosition: source.side, targetPosition: target.side, routing: connector.routing, controlPoint: style.controlPoint })
    return [{ connector, source, target, style, path }]
  })
  for (const { connector, style, path } of connectors) {
    const size = textSizes[connector.id]
    if (!size || !style.label) continue
    const y = path.labelY + connectorTextOffset(style)
    const left = Math.min(bounds.x, path.labelX - size.width / 2)
    const top = Math.min(bounds.y, y - size.height / 2)
    const right = Math.max(bounds.x + bounds.width, path.labelX + size.width / 2)
    const bottom = Math.max(bounds.y + bounds.height, y + size.height / 2)
    Object.assign(bounds, { x: left, y: top, width: right - left, height: bottom - top })
  }
  const viewportLimit = Math.max(280, Math.min(520, minHeight))
  const { scale, width, height } = canvasPreviewLayout(bounds, availableWidth, viewportLimit)
  const viewportHeight = Math.max(MIN_PREVIEW_HEIGHT, Math.min(viewportLimit, height + PREVIEW_PADDING * 2))
  const host = useMemo<ComponentHostAPI>(() => ({
    mode: 'readonly', interactionMode: 'Select', lod: 'detail', selected: false,
    handDrawn: snapshot.document.settings.hand_drawn,
    dispatch: () => undefined,
    requestEdit: () => undefined,
  }), [snapshot.document.settings.hand_drawn])
  const sceneStyle = { width, height } as CSSProperties
  const contentStyle = { width: bounds.width, height: bounds.height, transform: `scale(${scale})` } as CSSProperties
  useEffect(() => { if (viewportRef.current) onReady?.(viewportRef.current) }, [snapshot, availableWidth, textSizes, onReady])

  // Measure before paint: the fallback width would otherwise flash a different
  // scale for one frame every time the chapter opens.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const updateWidth = () => setAvailableWidth(viewport.clientWidth || 720)
    updateWidth()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(updateWidth)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  return <div ref={viewportRef} className={`structuredCanvasPreviewViewport structuredCanvasStage${snapshot.document.settings.hand_drawn ? ' handDrawn' : ''}`} style={{ height: viewportHeight, '--editor-page-bg': snapshot.document.settings.background } as CSSProperties}>
    <div className="structuredCanvasPreviewScene" style={sceneStyle}>
      <div className="structuredCanvasPreviewContent" style={contentStyle}>
        <svg className="structuredCanvasPreviewConnectors" width={bounds.width} height={bounds.height} aria-hidden="true">
          {connectors.map(({ connector, source, target, style, path }, index) => {
            const direction = { x: target.x - source.x, y: target.y - source.y }
            const maskId = `${maskPrefix}-${index}`
            const size = textSizes[connector.id]
            const maskText = style.label && style.labelPosition === 'center' && size?.width > 0
            return <g key={connector.id} transform={`translate(${-bounds.x},${-bounds.y})`} opacity={style.opacity}>
              {maskText && <defs><CanvasConnectorTextMask id={maskId} x={path.labelX} y={path.labelY} size={size} source={source} target={target} control={style.controlPoint} /></defs>}
              <path d={path.path} fill="none" stroke={style.color} strokeWidth={style.width} strokeDasharray={style.lineStyle === 'dotted' ? '2 5' : style.lineStyle === 'dashed' ? '8 5' : undefined} mask={maskText ? `url(#${maskId})` : undefined} />
              {([[style.startMarker, source, { x: -direction.x, y: -direction.y }], [style.endMarker, target, direction]] as const).map(([marker, point, vector], index) => <path key={index} d={connectorMarkerPath(marker, point, vector, style.width)} stroke={style.color} strokeWidth={style.width} fill={connectorMarkerIsStrokeOnly(marker) ? 'none' : connectorMarkerIsHollow(marker) ? snapshot.document.settings.background : style.color} />)}
            </g>
          })}
        </svg>
        {visibleElements.map((element) => <div key={element.id} className="structuredCanvasPreviewElement" style={{ left: element.transform.x - bounds.x, top: element.transform.y - bounds.y, width: element.bounds.width, height: element.bounds.height, transform: `translate(${element.bounds.width * (element.transform.scale_x - 1) / 2}px,${element.bounds.height * (element.transform.scale_y - 1) / 2}px) rotate(${element.transform.rotation}deg) scale(${element.transform.scale_x},${element.transform.scale_y})` }}><ComponentHost element={element} registry={runtime.registry} host={host} /></div>)}
        {connectors.filter(({ style }) => style.label).map(({ connector, style, path }) => <CanvasConnectorText key={connector.id} style={style} x={path.labelX - bounds.x} y={path.labelY - bounds.y} handDrawn={snapshot.document.settings.hand_drawn} onMeasure={size => setTextSizes(current => current[connector.id]?.width === size.width && current[connector.id]?.height === size.height ? current : { ...current, [connector.id]: size })} />)}
      </div>
    </div>
  </div>
}

export function StructuredCanvasPreview({snapshot,minHeight=520,onReady}:Props) {
  const runtime=useMemo(()=>{const registry=new ComponentRegistry();registerCoreComponents(registry);return {registry}},[]);
  return <PreviewCanvas snapshot={snapshot} runtime={runtime} minHeight={minHeight} onReady={onReady}/>
}
