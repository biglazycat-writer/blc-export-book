import type {
  CanvasConnector,
  CanvasElement,
  CanvasLayer,
  CanvasSettings,
  ID,
} from './types'

export const COMPONENT_TYPE_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/
export const MAX_CANVAS_COORDINATE = 10_000_000
export const MAX_ELEMENT_DIMENSION = 1_000_000
export const MAX_COMPONENT_JSON_BYTES = 1 << 20

export interface NormalizedCanvasRelations {
  canvasId: ID
  layers: ReadonlyMap<ID, CanvasLayer>
  elements: ReadonlyMap<ID, CanvasElement>
}

export function validateCanvasSettings(settings: CanvasSettings): void {
  assertNonEmpty(settings.background, 'canvas background')
  if (!Number.isFinite(settings.grid.size) || settings.grid.size <= 0 || settings.grid.size > 100_000) {
    throw new Error('grid size must be finite and positive')
  }
  assertNonEmpty(settings.grid.color, 'grid color')
}

export function validateCanvasLayer(layer: CanvasLayer): void {
  assertNonEmpty(layer.id, 'layer id')
  assertNonEmpty(layer.canvas_id, 'layer canvas id')
  assertNonEmpty(layer.name, 'layer name')
  assertNonEmpty(layer.order_key, 'layer order key')
  assertRevision(layer.revision, 'layer revision')
}

export function validateCanvasElement(element: CanvasElement): void {
  assertNonEmpty(element.id, 'element id')
  assertNonEmpty(element.canvas_id, 'element canvas id')
  if (!COMPONENT_TYPE_PATTERN.test(element.component_type)) {
    throw new Error(`invalid component type ${element.component_type}`)
  }
  if (!Number.isInteger(element.component_version) || element.component_version < 1) {
    throw new Error('component version must be a positive integer')
  }
  assertFiniteRange(element.transform.x, MAX_CANVAS_COORDINATE, 'element x')
  assertFiniteRange(element.transform.y, MAX_CANVAS_COORDINATE, 'element y')
  assertFiniteRange(element.transform.rotation, 360_000, 'element rotation')
  assertPositiveFinite(element.transform.scale_x, 1_000, 'element scale x')
  assertPositiveFinite(element.transform.scale_y, 1_000, 'element scale y')
  assertPositiveFinite(element.bounds.width, MAX_ELEMENT_DIMENSION, 'element width')
  assertPositiveFinite(element.bounds.height, MAX_ELEMENT_DIMENSION, 'element height')
  assertNonEmpty(element.layer_id, 'element layer id')
  assertNonEmpty(element.z_order, 'element z order')
  if (element.parent_id === element.id) throw new Error('element cannot parent itself')
  if (element.group_id !== undefined) assertNonEmpty(element.group_id, 'element group id')
  if (!['visible', 'hidden'].includes(element.visibility.mode)) {
    throw new Error(`invalid visibility mode ${element.visibility.mode}`)
  }
  const { min_zoom: minZoom, max_zoom: maxZoom } = element.visibility
  if (minZoom !== undefined) assertPositiveFinite(minZoom, 1_000, 'minimum zoom', true)
  if (maxZoom !== undefined) assertPositiveFinite(maxZoom, 1_000, 'maximum zoom', true)
  if (minZoom !== undefined && maxZoom !== undefined && minZoom > maxZoom) {
    throw new Error('minimum zoom cannot exceed maximum zoom')
  }
  if (!['none', 'content', 'all'].includes(element.lock)) {
    throw new Error(`invalid lock state ${element.lock}`)
  }
  if (element.binding) {
    assertNonEmpty(element.binding.kind, 'binding kind')
    assertNonEmpty(element.binding.id, 'binding id')
  }
  const propsJSON = JSON.stringify(element.props)
  if (propsJSON === undefined || new TextEncoder().encode(propsJSON).byteLength > MAX_COMPONENT_JSON_BYTES) {
    throw new Error(`component props must not exceed ${MAX_COMPONENT_JSON_BYTES} bytes`)
  }
  assertRevision(element.revision, 'element revision')
}

export function validateCanvasConnector(connector: CanvasConnector): void {
  assertNonEmpty(connector.id, 'connector id')
  assertNonEmpty(connector.canvas_id, 'connector canvas id')
  validateEndpoint(connector.source, 'source')
  validateEndpoint(connector.target, 'target')
  if (!['straight', 'orthogonal', 'bezier', 'smart'].includes(connector.routing)) {
    throw new Error(`invalid connector routing ${connector.routing}`)
  }
  const styleJSON = JSON.stringify(connector.style)
  if (styleJSON === undefined || new TextEncoder().encode(styleJSON).byteLength > MAX_COMPONENT_JSON_BYTES) {
    throw new Error(`connector style must not exceed ${MAX_COMPONENT_JSON_BYTES} bytes`)
  }
  assertRevision(connector.revision, 'connector revision')
}

export function validateCanvasRelations(relations: NormalizedCanvasRelations): void {
  for (const layer of relations.layers.values()) {
    validateCanvasLayer(layer)
    if (layer.canvas_id !== relations.canvasId) throw new Error(`layer ${layer.id} belongs to another canvas`)
  }
  for (const element of relations.elements.values()) {
    validateCanvasElement(element)
    if (element.canvas_id !== relations.canvasId) throw new Error(`element ${element.id} belongs to another canvas`)
    if (!relations.layers.has(element.layer_id)) throw new Error(`element ${element.id} references missing layer ${element.layer_id}`)
    if (element.parent_id) {
      const parent = relations.elements.get(element.parent_id)
      if (!parent) throw new Error(`element ${element.id} references missing parent ${element.parent_id}`)
      if (parent.canvas_id !== element.canvas_id) throw new Error(`element ${element.id} parent belongs to another canvas`)
    }
    assertNoParentCycle(element.id, relations.elements)
  }
}

export function validateConnectorRelations(
  canvasId: ID,
  connectors: ReadonlyMap<ID, CanvasConnector>,
  elements: ReadonlyMap<ID, CanvasElement>,
): void {
  for (const connector of connectors.values()) {
    validateCanvasConnector(connector)
    if (connector.canvas_id !== canvasId) throw new Error(`connector ${connector.id} belongs to another canvas`)
    for (const endpoint of [connector.source, connector.target]) {
      if (endpoint.kind === 'element' && !elements.has(endpoint.element_id)) {
        throw new Error(`connector ${connector.id} references missing element ${endpoint.element_id}`)
      }
    }
  }
}

function assertNoParentCycle(id: ID, elements: ReadonlyMap<ID, CanvasElement>): void {
  const visited = new Set<ID>([id])
  let current = elements.get(id)?.parent_id
  while (current) {
    if (visited.has(current)) throw new Error(`parent cycle detected at element ${id}`)
    visited.add(current)
    current = elements.get(current)?.parent_id
  }
}

function validateEndpoint(endpoint: CanvasConnector['source'], name: string): void {
  if (endpoint.kind === 'element') {
    assertNonEmpty(endpoint.element_id, `${name} element id`)
    return
  }
  if (endpoint.kind !== 'point') throw new Error(`invalid ${name} endpoint kind`)
  assertFiniteRange(endpoint.point.x, MAX_CANVAS_COORDINATE, `${name} point x`)
  assertFiniteRange(endpoint.point.y, MAX_CANVAS_COORDINATE, `${name} point y`)
}

function assertNonEmpty(value: string, name: string): void {
  if (!value.trim()) throw new Error(`${name} is required`)
}

function assertRevision(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`)
}

function assertFiniteRange(value: number, max: number, name: string): void {
  if (!Number.isFinite(value) || Math.abs(value) > max) throw new Error(`${name} is outside the supported range`)
}

function assertPositiveFinite(value: number, max: number, name: string, allowZero = false): void {
  if (!Number.isFinite(value) || value > max || (allowZero ? value < 0 : value <= 0)) {
    throw new Error(`${name} must be ${allowZero ? 'non-negative' : 'positive'} and finite`)
  }
}
