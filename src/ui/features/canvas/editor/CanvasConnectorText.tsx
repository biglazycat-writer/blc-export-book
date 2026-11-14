import { useLayoutEffect, useRef, type MouseEventHandler } from 'react'
import { connectorTextOffset, type ConnectorStyle } from '../runtime/projectConnectors'

// The editor, embedded preview and image export share this text rendering.
export type ConnectorTextSize = { width: number; height: number }

export function CanvasConnectorText({ style, x, y, handDrawn, selected, onDoubleClick, onMeasure }: {
  style: ConnectorStyle
  x: number
  y: number
  handDrawn: boolean
  selected?: boolean
  onDoubleClick?: MouseEventHandler<HTMLDivElement>
  onMeasure?: (size: ConnectorTextSize) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const measureRef = useRef(onMeasure)
  measureRef.current = onMeasure
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    let active = true
    const measure = () => { if (active) measureRef.current?.({ width: element.offsetWidth, height: element.offsetHeight }) }
    measure()
    void document.fonts?.ready.then(measure)
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : undefined
    observer?.observe(element)
    return () => { active = false; observer?.disconnect() }
  }, [style.label, style.labelFontSize, style.labelFontWeight, handDrawn])
  return <div
    ref={ref}
    className={`structuredCanvasEdgeLabel${handDrawn ? ' handDrawn' : ''}${selected ? ' selected' : ''}`}
    style={{
      transform: `translate(-50%, -50%) translate(${x}px, ${y + connectorTextOffset(style)}px)`,
      color: style.labelColor,
      fontSize: style.labelFontSize,
      fontWeight: style.labelFontWeight,
      background: style.labelBackground,
      opacity: style.opacity,
    }}
    onDoubleClick={onDoubleClick}
  >{style.label}</div>
}

/** Cut the line under centered text without painting a background rectangle. */
export function CanvasConnectorTextMask({ id, x, y, size, source, target, control }: {
  id: string; x: number; y: number; size: ConnectorTextSize
  source: { x: number; y: number }; target: { x: number; y: number }; control?: { x: number; y: number }
}) {
  const left = Math.min(source.x, target.x, control?.x ?? x, x - size.width / 2) - 160
  const top = Math.min(source.y, target.y, control?.y ?? y, y - size.height / 2) - 160
  const right = Math.max(source.x, target.x, control?.x ?? x, x + size.width / 2) + 160
  const bottom = Math.max(source.y, target.y, control?.y ?? y, y + size.height / 2) + 160
  return <mask id={id} maskUnits="userSpaceOnUse" x={left} y={top} width={right - left} height={bottom - top}>
    <rect x={left} y={top} width={right - left} height={bottom - top} fill="white" />
    <rect x={x - size.width / 2 - 2} y={y - size.height / 2} width={size.width + 4} height={size.height} fill="black" />
  </mask>
}
