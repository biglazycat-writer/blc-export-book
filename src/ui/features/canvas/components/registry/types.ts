import type { ReactNode } from 'react'
import type {
  Bounds,
  CanvasElement,
  CanvasInteractionMode,
  CanvasLOD,
  CanvasRenderMode,
  JsonObject,
  JsonValue,
} from '../../domain/types'

export interface ComponentSchema<Props extends JsonObject = JsonObject> {
  readonly name: string
  readonly validate: (value: JsonValue) => value is Props
}

export interface ComponentCapabilities {
  readonly connectable?: boolean
  readonly container?: boolean
  readonly editable?: boolean
  readonly resizable?: boolean
  readonly rotatable?: boolean
  readonly printable?: boolean
  readonly supportsChildren?: boolean
}

export interface ComponentSizePolicy {
  readonly default: Bounds
  readonly min?: Bounds
  readonly max?: Bounds
  readonly aspectRatio?: number
  readonly autoHeight?: boolean
}

export interface ComponentPort {
  readonly id: string
  readonly role: 'input' | 'output' | 'bidirectional'
  readonly x: number
  readonly y: number
  readonly semanticType?: string
}

export interface ComponentLODPolicy {
  readonly summaryBelowPixels?: number
  readonly thumbnailBelowPixels?: number
  readonly placeholderBelowPixels?: number
}

export interface ComponentHostAPI {
  readonly mode: CanvasRenderMode
  readonly interactionMode: CanvasInteractionMode
  readonly lod: CanvasLOD
  readonly selected: boolean
  /** Canvas-level sketch styling. Presentation only; never persisted per element. */
  readonly handDrawn?: boolean
  readonly dispatch: (commandType: string, payload: JsonObject) => void
  readonly requestEdit: () => void
}

export interface ComponentRenderContext<Props extends JsonObject = JsonObject> {
  readonly element: CanvasElement<Props>
  readonly host: ComponentHostAPI
}

export type ComponentRenderer<Props extends JsonObject = JsonObject> = (
  context: ComponentRenderContext<Props>,
) => ReactNode

export interface ComponentCommandDescriptor {
  readonly id: string
  readonly title: string
  readonly when?: (element: CanvasElement) => boolean
}

export interface ComponentAIContract {
  readonly summary: string
  readonly writableProps?: readonly string[]
  readonly examples?: readonly JsonObject[]
}

export interface ComponentDefinition<Props extends JsonObject = JsonObject> {
  readonly type: string
  readonly version: number
  readonly displayName: string
  readonly schema: ComponentSchema<Props>
  readonly defaultProps: () => Props
  readonly validate?: (props: Props) => readonly string[]
  readonly migrate?: (fromVersion: number, props: JsonObject) => { version: number; props: JsonObject }
  readonly capabilities: ComponentCapabilities
  readonly size: ComponentSizePolicy
  readonly ports?: readonly ComponentPort[] | ((element: CanvasElement<Props>) => readonly ComponentPort[])
  readonly lod?: ComponentLODPolicy
  readonly renderers: Record<CanvasRenderMode, ComponentRenderer<Props>>
  readonly inspector?: ComponentRenderer<Props>
  readonly commands?: readonly ComponentCommandDescriptor[]
  readonly ai?: ComponentAIContract
}

export interface ResolvedComponent<Props extends JsonObject = JsonObject> {
  readonly definition: ComponentDefinition<Props>
  readonly version: number
  readonly props: Props
  readonly migrated: boolean
  readonly unknown: boolean
}
