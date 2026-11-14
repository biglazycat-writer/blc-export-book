export type ID = string
export type Timestamp = string
export type OrderKey = string
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject
export type JsonObject = { [key: string]: JsonValue }

export interface Workspace {
  id: ID
  title: string
  settings: JsonObject
}

export type ResourceKind = 'document' | 'canvas' | 'asset'

export interface Resource {
  id: ID
  workspace_id: ID
  parent_resource_id?: ID
  kind: ResourceKind
  role?: string
  title: string
  icon?: JsonObject
  cover_asset_id?: ID
  order_key: OrderKey
  revision: number
  created_at: Timestamp
  updated_at: Timestamp
}

export type BlockKind =
  | 'paragraph' | 'heading' | 'bulletedList' | 'numberedList' | 'todo'
  | 'quote' | 'callout' | 'code' | 'divider' | 'image' | 'file'
  | 'audio' | 'video' | 'bookmark' | 'formula' | 'embed'
  | 'syncedBlock' | 'collectionView'

export interface Block {
  id: ID
  resource_id: ID
  parent_id?: ID
  kind: BlockKind
  version: number
  props: JsonObject
  order_key: OrderKey
  revision: number
}

export interface EntityRef { kind: string; id: ID }

export interface KnowledgeReference {
  id: ID
  source: EntityRef
  target: EntityRef
  kind: 'mention' | 'relation' | 'embed' | 'semantic'
  label?: string
  metadata?: JsonObject
}

export interface GridConfig {
  visible: boolean
  size: number
  color: string
}

export interface CanvasSettings {
  background: string
  grid: GridConfig
  snap_to_grid: boolean
  hand_drawn: boolean
}

export interface CanvasDocument {
  id: ID
  resource_id: ID
  schema_version: number
  settings: CanvasSettings
  revision: number
}

export interface Transform2D {
  x: number
  y: number
  scale_x: number
  scale_y: number
  rotation: number
}

export interface Bounds { width: number; height: number }
export interface Rect extends Bounds { x: number; y: number }

export interface VisibilityRule {
  mode: 'visible' | 'hidden'
  min_zoom?: number
  max_zoom?: number
}

export type LockState = 'none' | 'content' | 'all'

export interface EntityBinding {
  kind: 'resource' | 'block' | 'asset' | string
  id: ID
}

export interface CanvasElement<Props extends JsonObject = JsonObject> {
  id: ID
  canvas_id: ID
  component_type: string
  component_version: number
  transform: Transform2D
  bounds: Bounds
  layer_id: ID
  parent_id?: ID
  group_id?: ID
  z_order: OrderKey
  visibility: VisibilityRule
  lock: LockState
  binding?: EntityBinding
  props: Props
  revision: number
}

export interface CanvasPoint { x: number; y: number }

export type ConnectorEndpoint =
  | { kind: 'element'; element_id: ID; anchor_id?: ID }
  | { kind: 'point'; point: CanvasPoint }

export interface CanvasConnector {
  id: ID
  canvas_id: ID
  source: ConnectorEndpoint
  target: ConnectorEndpoint
  routing: 'straight' | 'orthogonal' | 'bezier' | 'smart'
  style: JsonObject
  label_block_id?: ID
  semantic_reference_id?: ID
  revision: number
}

export interface CanvasLayer {
  id: ID
  canvas_id: ID
  name: string
  order_key: OrderKey
  visible: boolean
  locked: boolean
  revision: number
}

export interface InteractionTrigger {
  type: 'click' | 'doubleClick' | 'submit' | 'valueChange' | 'checkChange' | 'recordMove' | 'selectionChange' | 'timerEnd' | 'presentationEnter'
  config?: JsonObject
}

export type InteractionActionType =
  | 'open.resource' | 'open.url' | 'focus.element' | 'view.switch'
  | 'session.set' | 'record.update-field' | 'element.set-visibility'
  | 'element.set-expanded' | 'ai.run-workflow'

export interface InteractionAction {
  type: InteractionActionType
  payload: JsonObject
  requires_confirmation?: boolean
}

export interface CanvasInteraction {
  id: ID
  canvas_id: ID
  element_id?: ID
  trigger: InteractionTrigger
  condition?: JsonValue
  actions: InteractionAction[]
  revision: number
}

export interface CameraState { x: number; y: number; zoom: number }

export interface CanvasUserViewState {
  canvas_id: ID
  user_id: ID
  camera: CameraState
  active_layer_id?: ID
  minimap_visible: boolean
  panel_state?: JsonObject
  updated_at: Timestamp
}

export interface CanvasSnapshot {
  resource: Resource
  document: CanvasDocument
  layers: CanvasLayer[]
  elements: CanvasElement[]
  connectors: CanvasConnector[]
  interactions: CanvasInteraction[]
}

export interface CreateCanvasInput {
  canvas_id?: ID
  workspace_id?: ID
  workspace_title?: string
  parent_resource_id?: ID
  title: string
  role?: string
}

/** A named copy of the whole scene, saved on demand and restorable later. */
export interface CanvasVersion {
  id: ID
  canvas_id: ID
  name: string
  /** Document revision the copy was taken at; restoring rewinds the canvas to it. */
  revision: number
  element_count: number
  connector_count: number
  created_at: Timestamp
}

export interface SaveCanvasVersionInput {
  canvas_id: ID
  name: string
}

export type CanvasInteractionMode = 'Navigate' | 'Select' | 'Draw' | 'EditContent' | 'Present'
export type CanvasRenderMode = 'interactive' | 'readonly' | 'thumbnail' | 'print'
export type CanvasLOD = 'detail' | 'summary' | 'thumbnail' | 'placeholder'

