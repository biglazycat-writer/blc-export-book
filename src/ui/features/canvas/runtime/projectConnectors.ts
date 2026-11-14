import type { Edge } from '@xyflow/react'
import type { CanvasConnector, ID, JsonObject, JsonValue } from '../domain/types'

export type ConnectorControlPoint = { x: number; y: number }
export type ConnectorMarker =
  | 'none' | 'arrow' | 'open-arrow' | 'circle' | 'diamond'
  | 'open-triangle' | 'open-diamond' | 'open-circle' | 'bar' | 'cross' | 'block' | 'half-arrow'
  | 'crow-many' | 'crow-one' | 'crow-zero-one' | 'crow-one-many' | 'crow-zero-many'

export const connectorMarkers: readonly ConnectorMarker[] = [
  'none', 'arrow', 'open-arrow', 'block', 'half-arrow', 'circle', 'open-circle', 'diamond', 'open-diamond', 'open-triangle', 'bar', 'cross',
  'crow-one', 'crow-many', 'crow-zero-one', 'crow-one-many', 'crow-zero-many',
]

export type ConnectorMarkerLabelKey =
  | 'connector.marker.none' | 'connector.marker.arrow' | 'connector.marker.openArrow' | 'connector.marker.block'
  | 'connector.marker.halfArrow' | 'connector.marker.circle' | 'connector.marker.openCircle' | 'connector.marker.bar' | 'connector.marker.cross'
  | 'connector.marker.openTriangle' | 'connector.marker.diamond' | 'connector.marker.openDiamond'
  | 'connector.marker.crowOne' | 'connector.marker.crowMany' | 'connector.marker.crowZeroOne' | 'connector.marker.crowOneMany' | 'connector.marker.crowZeroMany'

/** Grouped for the inspector: general arrows, UML relations, ER cardinalities. */
export const connectorMarkerGroups: ReadonlyArray<{ titleKey: 'connector.group.common' | 'connector.group.uml' | 'connector.group.er'; markers: ReadonlyArray<{ value: ConnectorMarker; labelKey: ConnectorMarkerLabelKey }> }> = [
  { titleKey: 'connector.group.common', markers: [
    { value: 'none', labelKey: 'connector.marker.none' }, { value: 'arrow', labelKey: 'connector.marker.arrow' }, { value: 'open-arrow', labelKey: 'connector.marker.openArrow' }, { value: 'block', labelKey: 'connector.marker.block' },
    { value: 'half-arrow', labelKey: 'connector.marker.halfArrow' }, { value: 'circle', labelKey: 'connector.marker.circle' }, { value: 'open-circle', labelKey: 'connector.marker.openCircle' }, { value: 'bar', labelKey: 'connector.marker.bar' }, { value: 'cross', labelKey: 'connector.marker.cross' },
  ] },
  { titleKey: 'connector.group.uml', markers: [
    { value: 'open-triangle', labelKey: 'connector.marker.openTriangle' }, { value: 'diamond', labelKey: 'connector.marker.diamond' }, { value: 'open-diamond', labelKey: 'connector.marker.openDiamond' },
  ] },
  { titleKey: 'connector.group.er', markers: [
    { value: 'crow-one', labelKey: 'connector.marker.crowOne' }, { value: 'crow-many', labelKey: 'connector.marker.crowMany' }, { value: 'crow-zero-one', labelKey: 'connector.marker.crowZeroOne' }, { value: 'crow-one-many', labelKey: 'connector.marker.crowOneMany' }, { value: 'crow-zero-many', labelKey: 'connector.marker.crowZeroMany' },
  ] },
]

/** Markers drawn as an outline that must hide the line running beneath them. */
export function connectorMarkerIsHollow(marker: ConnectorMarker): boolean {
  return marker === 'open-triangle' || marker === 'open-diamond' || marker === 'open-circle' || marker === 'crow-zero-one' || marker === 'crow-zero-many'
}

/** Markers drawn with strokes only, so they take no fill at all. */
export function connectorMarkerIsStrokeOnly(marker: ConnectorMarker): boolean {
  return marker === 'open-arrow' || marker === 'half-arrow' || marker === 'bar' || marker === 'cross' || marker === 'crow-one' || marker === 'crow-many' || marker === 'crow-one-many'
}

export interface ConnectorStyle {
  color: string
  width: number
  lineStyle: 'solid' | 'dashed' | 'dotted'
  opacity: number
  startMarker: ConnectorMarker
  endMarker: ConnectorMarker
  animated: boolean
  label: string
  labelColor: string
  labelFontSize: number
  labelFontWeight: number
  labelPosition: 'above' | 'center' | 'below'
  labelBackground: string
  controlPoint?: ConnectorControlPoint
}

export interface ConnectorEdgeData extends Record<string, unknown> {
  connector: CanvasConnector
  style: ConnectorStyle
  handDrawn: boolean
  onMoveControlPoint?: (connectorId: ID, point: ConnectorControlPoint) => void
  onChangeLabel?: (connectorId: ID, label: string) => void
}

export type ConnectorEdge = Edge<ConnectorEdgeData, 'canvas-connector'>

export const defaultConnectorStyle: ConnectorStyle = {
  color: '#64748b',
  width: 2,
  lineStyle: 'solid',
  opacity: 1,
  startMarker: 'none',
  endMarker: 'arrow',
  animated: false,
  label: '',
  labelColor: '#475569',
  labelFontSize: 14,
  labelFontWeight: 400,
  labelPosition: 'above',
  labelBackground: 'transparent',
}

// The backend rejects an empty style object, and the domain keeps `style` as
// free-form JSON, so every read has to tolerate partial or foreign values.
export function readConnectorStyle(style: JsonObject): ConnectorStyle {
  const controlPoint = readControlPoint(style.controlPoint)
  return {
    color: stringOr(style.color, defaultConnectorStyle.color),
    width: clampWidth(style.width),
    lineStyle: oneOf(style.lineStyle, ['solid', 'dashed', 'dotted'], defaultConnectorStyle.lineStyle),
    opacity: typeof style.opacity === 'number' && style.opacity >= 0 && style.opacity <= 1 ? style.opacity : 1,
    startMarker: oneOf(style.startMarker, connectorMarkers, defaultConnectorStyle.startMarker),
    endMarker: oneOf(style.endMarker, connectorMarkers, defaultConnectorStyle.endMarker),
    animated: style.animated === true,
    label: stringOr(style.label, ''),
    labelColor: stringOr(style.labelColor, defaultConnectorStyle.labelColor),
    labelFontSize: boundedNumber(style.labelFontSize, 10, 72, defaultConnectorStyle.labelFontSize),
    labelFontWeight: boundedNumber(style.labelFontWeight, 100, 900, defaultConnectorStyle.labelFontWeight),
    labelPosition: oneOf(style.labelPosition, ['above', 'center', 'below'], defaultConnectorStyle.labelPosition),
    labelBackground: stringOr(style.labelBackground, defaultConnectorStyle.labelBackground),
    ...(controlPoint ? { controlPoint } : {}),
  }
}

export function connectorStyleToJson(style: ConnectorStyle): JsonObject {
  const { controlPoint, ...base } = style
  return { ...base, ...(controlPoint ? { controlPoint } : {}) }
}

export function createConnector(input: {
  canvasId: ID
  sourceId: ID
  targetId: ID
  sourceAnchor?: string | null
  targetAnchor?: string | null
}): CanvasConnector {
  return {
    id: createId('connector'),
    canvas_id: input.canvasId,
    source: { kind: 'element', element_id: input.sourceId, ...(input.sourceAnchor ? { anchor_id: input.sourceAnchor } : {}) },
    target: { kind: 'element', element_id: input.targetId, ...(input.targetAnchor ? { anchor_id: input.targetAnchor } : {}) },
    routing: 'straight',
    style: connectorStyleToJson(defaultConnectorStyle),
    revision: 0,
  }
}

const dashArrays: Record<ConnectorStyle['lineStyle'], string | undefined> = {
  solid: undefined,
  dashed: '8 5',
  dotted: '2 5',
}

/**
 * Projects persisted connectors onto React Flow edges. Only element-to-element
 * connectors can be drawn: React Flow has no concept of a free-floating endpoint,
 * so `point` endpoints are skipped rather than rendered at the wrong place.
 */
export function projectConnectors(
  connectors: readonly CanvasConnector[],
  selectedIds: readonly ID[],
  handDrawn: boolean,
  onMoveControlPoint?: (connectorId: ID, point: ConnectorControlPoint) => void,
  onChangeLabel?: (connectorId: ID, label: string) => void,
): ConnectorEdge[] {
  const edges: ConnectorEdge[] = []
  for (const connector of connectors) {
    if (connector.source.kind !== 'element' || connector.target.kind !== 'element') continue
    const style = readConnectorStyle(connector.style)
    edges.push({
      id: connector.id,
      type: 'canvas-connector',
      source: connector.source.element_id,
      target: connector.target.element_id,
      ...(connector.source.anchor_id ? { sourceHandle: connector.source.anchor_id } : {}),
      ...(connector.target.anchor_id ? { targetHandle: connector.target.anchor_id } : {}),
      selected: selectedIds.includes(connector.id),
      animated: style.animated,
      style: { stroke: style.color, strokeWidth: style.width, opacity: style.opacity, strokeDasharray: dashArrays[style.lineStyle] },
      data: { connector, style, handDrawn, onMoveControlPoint, onChangeLabel },
    })
  }
  return edges
}

function stringOr(value: JsonValue | undefined, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function clampWidth(value: JsonValue | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultConnectorStyle.width
  return Math.max(1, Math.min(12, value))
}

function boundedNumber(value: JsonValue | undefined, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
}

/** Offset from the route midpoint to the center of the text's line box. */
export function connectorTextOffset(style: ConnectorStyle): number {
  const distance = style.labelFontSize * 0.7 + style.width / 2 + 6
  return style.labelPosition === 'above' ? -distance : style.labelPosition === 'below' ? distance : 0
}

function oneOf<T extends string>(value: JsonValue | undefined, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback
}

function createId(prefix: string): ID {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${suffix}`
}

function readControlPoint(value: JsonValue | undefined): ConnectorControlPoint | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const { x, y } = value
  return typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y) ? { x, y } : undefined
}
