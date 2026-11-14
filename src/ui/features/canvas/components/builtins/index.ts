import type { ComponentDefinition, ComponentRenderer, ComponentSchema } from '../registry/types'
import type { JsonObject, JsonValue } from '../../domain/types'
import { rendererFor } from './CoreComponentRenderers'
import { isCanvasShapeKind } from '../shapes/CanvasShapeGlyph'
import { isDrawingProps } from '../../runtime/freehand'
const definitions: Array<[string, string, JsonObject, number, number]> = [
  ['core.text', 'Text', { content: '', format: 'rich-text' }, 320, 120],
  ['core.shape', 'Shape', { shape: 'roundedRectangle', fill: '#ffffff', stroke: '#334155', strokeWidth: 1, label: '' }, 200, 120],
  ['core.drawing', 'Drawing', { points: [], color: '#202536', width: 3 }, 200, 200],
]
export const coreComponentDefinitions: readonly ComponentDefinition[] = definitions.map(([type, name, props, width, height]) =>
  createDefinition(type, name, props, { width, height }),
)
export function registerCoreComponents(registry: { register: (definition: ComponentDefinition) => () => void }): () => void {
  const disposers = coreComponentDefinitions.map((item) => registry.register(item))
  return () => disposers.reverse().forEach((dispose) => dispose())
}
function createDefinition(type: string, displayName: string, defaults: JsonObject, size: { width: number; height: number }): ComponentDefinition {
  const renderer: ComponentRenderer = rendererFor(type, displayName)
  // A drawing carries its own path: there is no text to edit inline, and a
  // connector anchored to a freehand scribble has nothing meaningful to point at.
  const drawing = type === 'core.drawing'
  return {
    type, version: 1, displayName, schema: objectSchema(`${type}-props`, validatorFor(type)), defaultProps: () => clone(defaults),
    capabilities: { connectable: !drawing, editable: !drawing, resizable: true, rotatable: true, printable: true },
    size: { default: size, min: minSizeFor(type) },
    lod: { summaryBelowPixels: 96, thumbnailBelowPixels: 32, placeholderBelowPixels: 8 },
    ports: [
      { id: 'top', role: 'bidirectional', x: 0.5, y: 0 }, { id: 'right', role: 'bidirectional', x: 1, y: 0.5 },
      { id: 'bottom', role: 'bidirectional', x: 0.5, y: 1 }, { id: 'left', role: 'bidirectional', x: 0, y: 0.5 },
    ],
    renderers: { interactive: renderer, readonly: renderer, thumbnail: renderer, print: renderer },
    ai: { summary: `${displayName} canvas component`, writableProps: Object.keys(defaults) },
  }
}
function objectSchema(name: string, validateProps: (value: JsonObject) => boolean): ComponentSchema {
  return { name, validate: (value): value is JsonObject => isJsonObject(value) && validateProps(value) }
}
function isJsonObject(value: JsonValue): value is JsonObject { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function minSizeFor(type: string): { width: number; height: number } {
  // A stroke is only as big as the pen went: a single tap is a dot, and a
  // resizer floor of 80×32 would refuse to let one stay that small.
  if (type === 'core.drawing') return { width: 8, height: 8 }
  return { width: 80, height: 32 }
}
function validatorFor(type: string): (props: JsonObject) => boolean {
  switch (type) {
    case 'core.text': return (props) => typeof props.content === 'string' && props.format === 'rich-text'
    case 'core.shape': return (props) => isCanvasShapeKind(props.shape) && typeof props.fill === 'string' && typeof props.stroke === 'string'
    case 'core.drawing': return (props) => isDrawingProps(props)
    default: return () => false
  }
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
