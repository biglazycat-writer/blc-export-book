/**
 * Shape geometry shared by the plain SVG renderer and the hand-drawn (rough.js)
 * renderer. Every shape resolves to a list of primitives: the first one is the
 * filled outline, the rest are unfilled decorations (dividers, rims, the second
 * line of a double border). Authoring them once keeps both render modes and
 * the palette preview showing the exact same figure.
 */

export type CanvasShapeGroup = 'basic' | 'flowchart' | 'uml' | 'er'

export type CanvasShapeKind =
  // basic
  | 'rectangle' | 'roundedRectangle' | 'square' | 'ellipse' | 'circle' | 'diamond' | 'triangle' | 'rightTriangle' | 'hexagon' | 'pentagon' | 'octagon'
  | 'parallelogram' | 'trapezoid' | 'star' | 'cross' | 'cloud' | 'callout' | 'arrowRight' | 'arrowDouble' | 'chevron' | 'cube' | 'pill' | 'doubleRectangle' | 'internalStorage'
  | 'andGate' | 'orGate' | 'xorGate' | 'heart' | 'moon' | 'lightning'
  // flowchart
  | 'process' | 'terminator' | 'decision' | 'data' | 'document' | 'multiDocument' | 'predefinedProcess' | 'manualInput'
  | 'preparation' | 'delay' | 'storedData' | 'display' | 'offPage' | 'merge' | 'extract' | 'or' | 'summingJunction' | 'card' | 'tape' | 'cylinder' | 'manualOperation' | 'collate' | 'sort'
  | 'connector' | 'sequentialData' | 'directData' | 'annotation' | 'loopLimit' | 'parallelMode' | 'transfer'
  // uml
  | 'umlClass' | 'umlInterface' | 'umlObject' | 'umlPackage' | 'umlActor' | 'umlUseCase' | 'umlNote' | 'umlComponent' | 'umlNode' | 'umlState' | 'umlInitial' | 'umlFinal' | 'umlLifeline' | 'umlActivation'
  | 'umlBoundary' | 'umlControl' | 'umlEntity' | 'umlFork' | 'umlFlowFinal' | 'umlHistory' | 'umlSendSignal' | 'umlReceiveSignal' | 'umlFrame' | 'umlSwimlane' | 'umlSwimlaneH' | 'umlLollipop' | 'umlSocket' | 'umlDestruction'
  // er
  | 'erEntity' | 'erWeakEntity' | 'erRelationship' | 'erWeakRelationship' | 'erAttribute' | 'erKeyAttribute' | 'erMultiAttribute' | 'erDerivedAttribute' | 'erAssociativeEntity' | 'erTable'

export interface CanvasShapeOption {
  kind: CanvasShapeKind
  labelKey: `shapes.${CanvasShapeKind}`
  group: CanvasShapeGroup
  /** Default bounds when the shape is inserted from the library. */
  size?: { width: number; height: number }
  /** Default label so a fresh UML/ER shape reads as what it is. */
  labelPreset?: string
}

export const canvasShapeGroupTitleKeys: Record<CanvasShapeGroup, `shapes.group.${CanvasShapeGroup}`> = {
  basic: 'shapes.group.basic',
  flowchart: 'shapes.group.flowchart',
  uml: 'shapes.group.uml',
  er: 'shapes.group.er',
}

export const canvasShapeOptions: readonly CanvasShapeOption[] = [
  { kind: 'rectangle', labelKey: 'shapes.rectangle', group: 'basic' },
  { kind: 'roundedRectangle', labelKey: 'shapes.roundedRectangle', group: 'basic' },
  { kind: 'square', labelKey: 'shapes.square', group: 'basic', size: { width: 100, height: 100 } },
  { kind: 'doubleRectangle', labelKey: 'shapes.doubleRectangle', group: 'basic' },
  { kind: 'pill', labelKey: 'shapes.pill', group: 'basic', size: { width: 160, height: 60 } },
  { kind: 'ellipse', labelKey: 'shapes.ellipse', group: 'basic' },
  { kind: 'circle', labelKey: 'shapes.circle', group: 'basic', size: { width: 100, height: 100 } },
  { kind: 'diamond', labelKey: 'shapes.diamond', group: 'basic' },
  { kind: 'triangle', labelKey: 'shapes.triangle', group: 'basic' },
  { kind: 'rightTriangle', labelKey: 'shapes.rightTriangle', group: 'basic' },
  { kind: 'pentagon', labelKey: 'shapes.pentagon', group: 'basic', size: { width: 120, height: 120 } },
  { kind: 'hexagon', labelKey: 'shapes.hexagon', group: 'basic' },
  { kind: 'octagon', labelKey: 'shapes.octagon', group: 'basic', size: { width: 120, height: 120 } },
  { kind: 'parallelogram', labelKey: 'shapes.parallelogram', group: 'basic' },
  { kind: 'trapezoid', labelKey: 'shapes.trapezoid', group: 'basic' },
  { kind: 'star', labelKey: 'shapes.star', group: 'basic', size: { width: 120, height: 120 } },
  { kind: 'cross', labelKey: 'shapes.cross', group: 'basic', size: { width: 120, height: 120 } },
  { kind: 'arrowRight', labelKey: 'shapes.arrowRight', group: 'basic', size: { width: 160, height: 80 } },
  { kind: 'arrowDouble', labelKey: 'shapes.arrowDouble', group: 'basic', size: { width: 180, height: 80 } },
  { kind: 'chevron', labelKey: 'shapes.chevron', group: 'basic', size: { width: 160, height: 72 } },
  { kind: 'callout', labelKey: 'shapes.callout', group: 'basic', size: { width: 160, height: 110 } },
  { kind: 'cloud', labelKey: 'shapes.cloud', group: 'basic', size: { width: 160, height: 110 } },
  { kind: 'cube', labelKey: 'shapes.cube', group: 'basic', size: { width: 120, height: 120 } },
  { kind: 'internalStorage', labelKey: 'shapes.internalStorage', group: 'basic' },
  { kind: 'andGate', labelKey: 'shapes.andGate', group: 'basic', size: { width: 110, height: 80 } },
  { kind: 'orGate', labelKey: 'shapes.orGate', group: 'basic', size: { width: 110, height: 80 } },
  { kind: 'xorGate', labelKey: 'shapes.xorGate', group: 'basic', size: { width: 110, height: 80 } },
  { kind: 'heart', labelKey: 'shapes.heart', group: 'basic', size: { width: 110, height: 100 } },
  { kind: 'moon', labelKey: 'shapes.moon', group: 'basic', size: { width: 90, height: 110 } },
  { kind: 'lightning', labelKey: 'shapes.lightning', group: 'basic', size: { width: 80, height: 120 } },

  { kind: 'process', labelKey: 'shapes.process', group: 'flowchart' },
  { kind: 'terminator', labelKey: 'shapes.terminator', group: 'flowchart', size: { width: 140, height: 56 } },
  { kind: 'decision', labelKey: 'shapes.decision', group: 'flowchart', size: { width: 140, height: 90 } },
  { kind: 'data', labelKey: 'shapes.data', group: 'flowchart' },
  { kind: 'document', labelKey: 'shapes.document', group: 'flowchart' },
  { kind: 'multiDocument', labelKey: 'shapes.multiDocument', group: 'flowchart' },
  { kind: 'predefinedProcess', labelKey: 'shapes.predefinedProcess', group: 'flowchart' },
  { kind: 'manualInput', labelKey: 'shapes.manualInput', group: 'flowchart' },
  { kind: 'manualOperation', labelKey: 'shapes.manualOperation', group: 'flowchart' },
  { kind: 'preparation', labelKey: 'shapes.preparation', group: 'flowchart' },
  { kind: 'delay', labelKey: 'shapes.delay', group: 'flowchart' },
  { kind: 'storedData', labelKey: 'shapes.storedData', group: 'flowchart' },
  { kind: 'cylinder', labelKey: 'shapes.cylinder', group: 'flowchart', size: { width: 110, height: 100 } },
  { kind: 'directData', labelKey: 'shapes.directData', group: 'flowchart', size: { width: 140, height: 70 } },
  { kind: 'sequentialData', labelKey: 'shapes.sequentialData', group: 'flowchart', size: { width: 90, height: 90 } },
  { kind: 'display', labelKey: 'shapes.display', group: 'flowchart' },
  { kind: 'card', labelKey: 'shapes.card', group: 'flowchart' },
  { kind: 'tape', labelKey: 'shapes.tape', group: 'flowchart' },
  { kind: 'connector', labelKey: 'shapes.connector', group: 'flowchart', size: { width: 48, height: 48 } },
  { kind: 'offPage', labelKey: 'shapes.offPage', group: 'flowchart', size: { width: 90, height: 100 } },
  { kind: 'transfer', labelKey: 'shapes.transfer', group: 'flowchart', size: { width: 140, height: 72 } },
  { kind: 'merge', labelKey: 'shapes.merge', group: 'flowchart', size: { width: 110, height: 80 } },
  { kind: 'extract', labelKey: 'shapes.extract', group: 'flowchart', size: { width: 110, height: 80 } },
  { kind: 'collate', labelKey: 'shapes.collate', group: 'flowchart', size: { width: 90, height: 100 } },
  { kind: 'sort', labelKey: 'shapes.sort', group: 'flowchart', size: { width: 90, height: 100 } },
  { kind: 'or', labelKey: 'shapes.or', group: 'flowchart', size: { width: 72, height: 72 } },
  { kind: 'summingJunction', labelKey: 'shapes.summingJunction', group: 'flowchart', size: { width: 72, height: 72 } },
  { kind: 'loopLimit', labelKey: 'shapes.loopLimit', group: 'flowchart' },
  { kind: 'parallelMode', labelKey: 'shapes.parallelMode', group: 'flowchart', size: { width: 160, height: 60 } },
  { kind: 'annotation', labelKey: 'shapes.annotation', group: 'flowchart', size: { width: 160, height: 72 } },

  { kind: 'umlClass', labelKey: 'shapes.umlClass', group: 'uml', size: { width: 180, height: 130 }, labelPreset: 'ClassName' },
  { kind: 'umlInterface', labelKey: 'shapes.umlInterface', group: 'uml', size: { width: 180, height: 110 }, labelPreset: '«interface»\nInterface' },
  { kind: 'umlObject', labelKey: 'shapes.umlObject', group: 'uml', size: { width: 170, height: 60 }, labelPreset: 'obj: Class' },
  { kind: 'umlPackage', labelKey: 'shapes.umlPackage', group: 'uml', size: { width: 180, height: 120 }, labelPreset: 'Package' },
  { kind: 'umlComponent', labelKey: 'shapes.umlComponent', group: 'uml', size: { width: 170, height: 90 }, labelPreset: 'Component' },
  { kind: 'umlNode', labelKey: 'shapes.umlNode', group: 'uml', size: { width: 150, height: 110 }, labelPreset: 'Node' },
  { kind: 'umlLollipop', labelKey: 'shapes.umlLollipop', group: 'uml', size: { width: 40, height: 80 } },
  { kind: 'umlSocket', labelKey: 'shapes.umlSocket', group: 'uml', size: { width: 40, height: 80 } },
  { kind: 'umlActor', labelKey: 'shapes.umlActor', group: 'uml', size: { width: 60, height: 110 }, labelPreset: 'Actor' },
  { kind: 'umlUseCase', labelKey: 'shapes.umlUseCase', group: 'uml', size: { width: 160, height: 80 }, labelPreset: 'Use Case' },
  { kind: 'umlBoundary', labelKey: 'shapes.umlBoundary', group: 'uml', size: { width: 90, height: 80 }, labelPreset: 'Boundary' },
  { kind: 'umlControl', labelKey: 'shapes.umlControl', group: 'uml', size: { width: 80, height: 80 }, labelPreset: 'Control' },
  { kind: 'umlEntity', labelKey: 'shapes.umlEntity', group: 'uml', size: { width: 80, height: 80 }, labelPreset: 'Entity' },
  { kind: 'umlNote', labelKey: 'shapes.umlNote', group: 'uml', size: { width: 160, height: 90 }, labelPreset: '注释' },
  { kind: 'umlState', labelKey: 'shapes.umlState', group: 'uml', size: { width: 150, height: 70 }, labelPreset: 'State' },
  { kind: 'umlInitial', labelKey: 'shapes.umlInitial', group: 'uml', size: { width: 36, height: 36 } },
  { kind: 'umlFinal', labelKey: 'shapes.umlFinal', group: 'uml', size: { width: 40, height: 40 } },
  { kind: 'umlFlowFinal', labelKey: 'shapes.umlFlowFinal', group: 'uml', size: { width: 40, height: 40 } },
  { kind: 'umlHistory', labelKey: 'shapes.umlHistory', group: 'uml', size: { width: 40, height: 40 } },
  { kind: 'umlFork', labelKey: 'shapes.umlFork', group: 'uml', size: { width: 200, height: 10 } },
  { kind: 'umlSendSignal', labelKey: 'shapes.umlSendSignal', group: 'uml', size: { width: 160, height: 64 }, labelPreset: 'Send' },
  { kind: 'umlReceiveSignal', labelKey: 'shapes.umlReceiveSignal', group: 'uml', size: { width: 160, height: 64 }, labelPreset: 'Receive' },
  { kind: 'umlLifeline', labelKey: 'shapes.umlLifeline', group: 'uml', size: { width: 120, height: 260 }, labelPreset: 'Object' },
  { kind: 'umlActivation', labelKey: 'shapes.umlActivation', group: 'uml', size: { width: 18, height: 120 } },
  { kind: 'umlDestruction', labelKey: 'shapes.umlDestruction', group: 'uml', size: { width: 36, height: 36 } },
  { kind: 'umlFrame', labelKey: 'shapes.umlFrame', group: 'uml', size: { width: 320, height: 200 }, labelPreset: 'alt' },
  { kind: 'umlSwimlane', labelKey: 'shapes.umlSwimlane', group: 'uml', size: { width: 220, height: 400 }, labelPreset: '泳道' },
  { kind: 'umlSwimlaneH', labelKey: 'shapes.umlSwimlaneH', group: 'uml', size: { width: 500, height: 160 }, labelPreset: '泳道' },

  { kind: 'erEntity', labelKey: 'shapes.erEntity', group: 'er', size: { width: 150, height: 70 }, labelPreset: '实体' },
  { kind: 'erWeakEntity', labelKey: 'shapes.erWeakEntity', group: 'er', size: { width: 150, height: 70 }, labelPreset: '弱实体' },
  { kind: 'erAssociativeEntity', labelKey: 'shapes.erAssociativeEntity', group: 'er', size: { width: 160, height: 90 }, labelPreset: '关联实体' },
  { kind: 'erRelationship', labelKey: 'shapes.erRelationship', group: 'er', size: { width: 150, height: 90 }, labelPreset: '关系' },
  { kind: 'erWeakRelationship', labelKey: 'shapes.erWeakRelationship', group: 'er', size: { width: 150, height: 90 }, labelPreset: '弱关系' },
  { kind: 'erAttribute', labelKey: 'shapes.erAttribute', group: 'er', size: { width: 130, height: 64 }, labelPreset: '属性' },
  { kind: 'erKeyAttribute', labelKey: 'shapes.erKeyAttribute', group: 'er', size: { width: 130, height: 64 }, labelPreset: '主键' },
  { kind: 'erMultiAttribute', labelKey: 'shapes.erMultiAttribute', group: 'er', size: { width: 130, height: 64 }, labelPreset: '多值属性' },
  { kind: 'erDerivedAttribute', labelKey: 'shapes.erDerivedAttribute', group: 'er', size: { width: 130, height: 64 }, labelPreset: '派生属性' },
  { kind: 'erTable', labelKey: 'shapes.erTable', group: 'er', size: { width: 180, height: 150 }, labelPreset: 'table_name' },
]

const shapeKinds = new Set<string>(canvasShapeOptions.map(({ kind }) => kind))
export function isCanvasShapeKind(value: unknown): value is CanvasShapeKind {
  return typeof value === 'string' && shapeKinds.has(value)
}

export type ShapePrimitive =
  | { type: 'path'; d: string; filled: boolean; dashed?: boolean; ink?: boolean }
  | { type: 'polygon'; points: Array<[number, number]>; filled: boolean; dashed?: boolean; ink?: boolean }
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number; filled: boolean; dashed?: boolean; ink?: boolean }

type Pt = [number, number]

const poly = (points: Pt[], filled = true, dashed?: boolean): ShapePrimitive => ({ type: 'polygon', points, filled, dashed })
const path = (d: string, filled = false, dashed?: boolean): ShapePrimitive => ({ type: 'path', d, filled, dashed })
const ellipse = (cx: number, cy: number, rx: number, ry: number, filled = true, dashed?: boolean): ShapePrimitive => ({ type: 'ellipse', cx, cy, rx, ry, filled, dashed })
/** A solid disc painted in the stroke colour (UML initial state, final-state core). */
const inkDot = (cx: number, cy: number, r: number): ShapePrimitive => ({ type: 'ellipse', cx, cy, rx: r, ry: r, filled: true, ink: true })
const line = (a: Pt, b: Pt): ShapePrimitive => path(`M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`)

function rectPath(l: number, t: number, r: number, b: number): string {
  return `M ${l} ${t} H ${r} V ${b} H ${l} Z`
}

function roundedRectPath(l: number, t: number, r: number, b: number, radius: number): string {
  const rad = Math.max(1, Math.min(radius, (r - l) / 2, (b - t) / 2))
  return `M ${l + rad} ${t} H ${r - rad} Q ${r} ${t} ${r} ${t + rad} V ${b - rad} Q ${r} ${b} ${r - rad} ${b} H ${l + rad} Q ${l} ${b} ${l} ${b - rad} V ${t + rad} Q ${l} ${t} ${l + rad} ${t} Z`
}

function pillPath(l: number, t: number, r: number, b: number): string {
  const rad = (b - t) / 2
  if (r - l <= b - t) return roundedRectPath(l, t, r, b, Math.min(rad, (r - l) / 2))
  return `M ${l + rad} ${t} H ${r - rad} A ${rad} ${rad} 0 0 1 ${r - rad} ${b} H ${l + rad} A ${rad} ${rad} 0 0 1 ${l + rad} ${t} Z`
}

function regularPolygon(cx: number, cy: number, rx: number, ry: number, sides: number, rotation = -Math.PI / 2): Pt[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (index * Math.PI * 2) / sides
    return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry] as Pt
  })
}

function starPoints(cx: number, cy: number, rx: number, ry: number): Pt[] {
  const points: Pt[] = []
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5
    const scale = index % 2 === 0 ? 1 : .42
    points.push([cx + Math.cos(angle) * rx * scale, cy + Math.sin(angle) * ry * scale])
  }
  return points
}

function cylinderPaths(l: number, t: number, r: number, b: number): { outline: string; rim: string } {
  const w = r - l
  const cap = Math.max(8, Math.min((b - t) * .2, 22))
  const cx = l + w / 2
  return {
    outline: `M ${l} ${t + cap / 2} C ${l} ${t - 2} ${cx - w * .2} ${t} ${cx} ${t} C ${cx + w * .2} ${t} ${r} ${t - 2} ${r} ${t + cap / 2} L ${r} ${b - cap / 2} C ${r} ${b + 2} ${cx + w * .2} ${b} ${cx} ${b} C ${cx - w * .2} ${b} ${l} ${b + 2} ${l} ${b - cap / 2} Z`,
    rim: `M ${l} ${t + cap / 2} C ${l} ${t + cap} ${cx - w * .2} ${t + cap} ${cx} ${t + cap} C ${cx + w * .2} ${t + cap} ${r} ${t + cap} ${r} ${t + cap / 2}`,
  }
}

function documentPath(l: number, t: number, r: number, b: number): string {
  const wave = Math.max(6, Math.min((b - t) * .16, 18))
  const w = r - l
  return `M ${l} ${t} H ${r} V ${b - wave} C ${r - w * .25} ${b - wave * 2.2} ${l + w * .5} ${b + wave * .4} ${l + w * .25} ${b - wave * .1} C ${l + w * .12} ${b - wave * .4} ${l + w * .05} ${b - wave * .6} ${l} ${b - wave * .2} Z`
}

function cloudPath(l: number, t: number, r: number, b: number): string {
  const w = r - l
  const h = b - t
  const x = (f: number) => l + w * f
  const y = (f: number) => t + h * f
  return [
    `M ${x(.22)} ${y(.82)}`,
    `C ${x(.02)} ${y(.86)} ${x(-.02)} ${y(.52)} ${x(.16)} ${y(.48)}`,
    `C ${x(.06)} ${y(.2)} ${x(.36)} ${y(.06)} ${x(.44)} ${y(.24)}`,
    `C ${x(.5)} ${y(-.04)} ${x(.84)} ${y(.02)} ${x(.8)} ${y(.3)}`,
    `C ${x(1.02)} ${y(.3)} ${x(1.04)} ${y(.7)} ${x(.84)} ${y(.72)}`,
    `C ${x(.86)} ${y(.96)} ${x(.5)} ${y(1.02)} ${x(.44)} ${y(.84)}`,
    `C ${x(.36)} ${y(1)} ${x(.2)} ${y(.98)} ${x(.22)} ${y(.82)} Z`,
  ].join(' ')
}

function calloutPath(l: number, t: number, r: number, b: number, radius: number): string {
  const tail = Math.max(10, Math.min((b - t) * .22, 26))
  const bodyBottom = b - tail
  const rad = Math.max(1, Math.min(radius, (r - l) / 2, (bodyBottom - t) / 2))
  const w = r - l
  return `M ${l + rad} ${t} H ${r - rad} Q ${r} ${t} ${r} ${t + rad} V ${bodyBottom - rad} Q ${r} ${bodyBottom} ${r - rad} ${bodyBottom} H ${l + w * .34} L ${l + w * .2} ${b} L ${l + w * .18} ${bodyBottom} H ${l + rad} Q ${l} ${bodyBottom} ${l} ${bodyBottom - rad} V ${t + rad} Q ${l} ${t} ${l + rad} ${t} Z`
}

export function shapeGeometry(shape: CanvasShapeKind, width: number, height: number, inset: number, radius: number): ShapePrimitive[] {
  const l = inset
  const t = inset
  const r = width - inset
  const b = height - inset
  const w = r - l
  const h = b - t
  const cx = width / 2
  const cy = height / 2
  switch (shape) {
    case 'rectangle':
    case 'square':
    case 'process':
    case 'erEntity':
    case 'umlActivation':
    case 'umlObject': // the object name is underlined by the label style
      return [path(rectPath(l, t, r, b), true)]
    case 'doubleRectangle':
    case 'erWeakEntity':
      return [path(rectPath(l, t, r, b), true), path(rectPath(l + 5, t + 5, r - 5, b - 5))]
    case 'internalStorage': {
      const gap = Math.max(10, Math.min(w, h) * .18)
      return [path(rectPath(l, t, r, b), true), line([l, t + gap], [r, t + gap]), line([l + gap, t], [l + gap, b])]
    }
    case 'roundedRectangle':
    case 'umlState':
      return [path(roundedRectPath(l, t, r, b, shape === 'umlState' ? Math.max(radius, 14) : radius), true)]
    case 'pill':
    case 'terminator':
      return [path(pillPath(l, t, r, b), true)]
    case 'ellipse':
    case 'circle':
    case 'umlUseCase':
    case 'erAttribute':
    case 'erKeyAttribute': // the key is marked by underlining the name, not the outline
      return [ellipse(cx, cy, w / 2, h / 2)]
    case 'connector':
      return [ellipse(cx, cy, Math.min(w, h) / 2, Math.min(w, h) / 2)]
    case 'erMultiAttribute':
      return [ellipse(cx, cy, w / 2, h / 2), ellipse(cx, cy, w / 2 - 5, h / 2 - 5, false)]
    case 'erDerivedAttribute':
      return [ellipse(cx, cy, w / 2, h / 2, true, true)]
    case 'diamond':
    case 'decision':
    case 'erRelationship':
      return [poly([[cx, t], [r, cy], [cx, b], [l, cy]])]
    case 'erWeakRelationship': {
      const dx = Math.min(w * .12, 12)
      const dy = Math.min(h * .12, 12)
      return [poly([[cx, t], [r, cy], [cx, b], [l, cy]]), poly([[cx, t + dy * 1.4], [r - dx * 1.4, cy], [cx, b - dy * 1.4], [l + dx * 1.4, cy]], false)]
    }
    case 'erAssociativeEntity':
      return [path(rectPath(l, t, r, b), true), poly([[cx, t], [r, cy], [cx, b], [l, cy]], false)]
    case 'erTable': {
      const header = Math.min(Math.max(30, h * .24), 40)
      const rows = Math.max(1, Math.floor((h - header) / 30))
      const rowHeight = (h - header) / rows
      const primitives = [path(rectPath(l, t, r, b), true), line([l, t + header], [r, t + header])]
      for (let index = 1; index < rows; index += 1) primitives.push(line([l, t + header + rowHeight * index], [r, t + header + rowHeight * index]))
      return primitives
    }
    case 'triangle':
    case 'extract':
      return [poly([[cx, t], [r, b], [l, b]])]
    case 'rightTriangle':
      return [poly([[l, t], [r, b], [l, b]])]
    case 'merge':
      return [poly([[l, t], [r, t], [cx, b]])]
    case 'hexagon':
    case 'preparation': {
      const shoulder = Math.max(8, w * .22)
      return [poly([[l + shoulder, t], [r - shoulder, t], [r, cy], [r - shoulder, b], [l + shoulder, b], [l, cy]])]
    }
    case 'pentagon':
      return [poly(regularPolygon(cx, cy, w / 2, h / 2, 5))]
    case 'octagon': {
      const c = Math.min(w, h) * .29
      return [poly([[l + c, t], [r - c, t], [r, t + c], [r, b - c], [r - c, b], [l + c, b], [l, b - c], [l, t + c]])]
    }
    case 'parallelogram':
    case 'data': {
      const skew = Math.max(9, w * .17)
      return [poly([[l + skew, t], [r, t], [r - skew, b], [l, b]])]
    }
    case 'trapezoid':
    case 'manualOperation': {
      const skew = Math.max(9, w * .17)
      return shape === 'trapezoid'
        ? [poly([[l + skew, t], [r - skew, t], [r, b], [l, b]])]
        : [poly([[l, t], [r, t], [r - skew, b], [l + skew, b]])]
    }
    case 'star':
      return [poly(starPoints(cx, cy, w / 2, h / 2))]
    case 'cross': {
      const arm = Math.min(w, h) * .3
      return [poly([[cx - arm / 2, t], [cx + arm / 2, t], [cx + arm / 2, cy - arm / 2], [r, cy - arm / 2], [r, cy + arm / 2], [cx + arm / 2, cy + arm / 2], [cx + arm / 2, b], [cx - arm / 2, b], [cx - arm / 2, cy + arm / 2], [l, cy + arm / 2], [l, cy - arm / 2], [cx - arm / 2, cy - arm / 2]])]
    }
    case 'arrowRight': {
      const head = Math.min(w * .35, h)
      const shaft = h * .26
      return [poly([[l, cy - shaft], [r - head, cy - shaft], [r - head, t], [r, cy], [r - head, b], [r - head, cy + shaft], [l, cy + shaft]])]
    }
    case 'arrowDouble': {
      const head = Math.min(w * .28, h)
      const shaft = h * .26
      return [poly([[l, cy], [l + head, t], [l + head, cy - shaft], [r - head, cy - shaft], [r - head, t], [r, cy], [r - head, b], [r - head, cy + shaft], [l + head, cy + shaft], [l + head, b]])]
    }
    case 'chevron':
    case 'transfer': {
      const notch = Math.min(w * .22, h * .5)
      return shape === 'chevron'
        ? [poly([[l, t], [r - notch, t], [r, cy], [r - notch, b], [l, b], [l + notch, cy]])]
        : [poly([[l, t], [r - notch, t], [r, cy], [r - notch, b], [l, b]])]
    }
    case 'andGate': {
      const rad = Math.min(h / 2, w * .5)
      return [path(`M ${l} ${t} H ${r - rad} A ${rad} ${rad} 0 0 1 ${r - rad} ${b} H ${l} Z`, true)]
    }
    case 'orGate': {
      const bulge = w * .22
      return [path(`M ${l} ${t} Q ${l + w * .55} ${t} ${r} ${cy} Q ${l + w * .55} ${b} ${l} ${b} Q ${l + bulge} ${cy} ${l} ${t} Z`, true)]
    }
    case 'xorGate': {
      const bulge = w * .22
      const inset2 = Math.max(6, w * .1)
      return [
        path(`M ${l + inset2} ${t} Q ${l + inset2 + w * .5} ${t} ${r} ${cy} Q ${l + inset2 + w * .5} ${b} ${l + inset2} ${b} Q ${l + inset2 + bulge} ${cy} ${l + inset2} ${t} Z`, true),
        path(`M ${l} ${t} Q ${l + bulge} ${cy} ${l} ${b}`),
      ]
    }
    case 'heart': {
      return [path(`M ${cx} ${b} C ${l - w * .05} ${t + h * .55} ${l} ${t + h * .05} ${l + w * .28} ${t + h * .02} C ${l + w * .42} ${t} ${cx - w * .02} ${t + h * .12} ${cx} ${t + h * .28} C ${cx + w * .02} ${t + h * .12} ${r - w * .42} ${t} ${r - w * .28} ${t + h * .02} C ${r} ${t + h * .05} ${r + w * .05} ${t + h * .55} ${cx} ${b} Z`, true)]
    }
    case 'moon': {
      return [path(`M ${r} ${t + h * .12} A ${w * .5} ${h * .5} 0 1 0 ${r} ${b - h * .12} A ${w * .36} ${h * .4} 0 1 1 ${r} ${t + h * .12} Z`, true)]
    }
    case 'lightning': {
      return [poly([[l + w * .55, t], [l, t + h * .55], [l + w * .42, t + h * .55], [l + w * .25, b], [r, t + h * .4], [l + w * .58, t + h * .4]])]
    }
    case 'callout':
      return [path(calloutPath(l, t, r, b, radius), true)]
    case 'cloud':
      return [path(cloudPath(l, t, r, b), true)]
    case 'cube': {
      const d = Math.min(w, h) * .26
      return [
        poly([[l, t + d], [l + w - d, t + d], [r, t], [r, b - d], [r - d, b], [l, b]]),
        path(`M ${l} ${t + d} L ${l + d} ${t} L ${r} ${t} M ${r - d} ${b} L ${r - d} ${t + d} L ${l} ${t + d} M ${r - d} ${t + d} L ${r} ${t}`),
      ]
    }
    case 'document':
      return [path(documentPath(l, t, r, b), true)]
    case 'multiDocument': {
      const step = Math.min(8, w * .07)
      return [
        path(documentPath(l, t + step * 2, r - step * 2, b), true),
        path(`M ${l + step} ${t + step * 2} V ${t + step} H ${r - step} V ${b - h * .22}`),
        path(`M ${l + step * 2} ${t + step} V ${t} H ${r} V ${b - h * .3}`),
      ]
    }
    case 'predefinedProcess': {
      const bar = Math.max(8, Math.min(w * .1, 16))
      return [path(rectPath(l, t, r, b), true), line([l + bar, t], [l + bar, b]), line([r - bar, t], [r - bar, b])]
    }
    case 'manualInput':
      return [poly([[l, t + h * .28], [r, t], [r, b], [l, b]])]
    case 'delay': {
      const rad = Math.min(h / 2, w * .4)
      return [path(`M ${l} ${t} H ${r - rad} A ${rad} ${rad} 0 0 1 ${r - rad} ${b} H ${l} Z`, true)]
    }
    case 'storedData': {
      const bulge = Math.min(w * .14, 20)
      return [path(`M ${l + bulge} ${t} H ${r} C ${r - bulge * 1.4} ${t} ${r - bulge * 1.4} ${b} ${r} ${b} H ${l + bulge} C ${l - bulge * .33} ${b} ${l - bulge * .33} ${t} ${l + bulge} ${t} Z`, true)]
    }
    case 'display': {
      const nose = Math.min(w * .18, 26)
      const bulge = Math.min(w * .12, 18)
      return [path(`M ${l} ${cy} L ${l + nose} ${t} H ${r - bulge} C ${r + bulge * .6} ${t} ${r + bulge * .6} ${b} ${r - bulge} ${b} H ${l + nose} Z`, true)]
    }
    case 'card': {
      const cut = Math.min(w, h) * .25
      return [poly([[l + cut, t], [r, t], [r, b], [l, b], [l, t + cut]])]
    }
    case 'tape': {
      const wave = Math.min(h * .14, 14)
      return [path(`M ${l} ${t + wave} C ${l + w * .25} ${t + wave * 2.4} ${l + w * .5} ${t - wave} ${r} ${t + wave} V ${b - wave} C ${r - w * .25} ${b - wave * 2.4} ${r - w * .5} ${b + wave} ${l} ${b - wave} Z`, true)]
    }
    case 'offPage':
      return [poly([[l, t], [r, t], [r, b - h * .3], [cx, b], [l, b - h * .3]])]
    case 'collate':
      return [poly([[l, t], [r, t], [l, b], [r, b]])]
    case 'sort':
      return [poly([[cx, t], [r, cy], [cx, b], [l, cy]]), line([l, cy], [r, cy])]
    case 'or': {
      const rad = Math.min(w, h) / 2
      return [ellipse(cx, cy, rad, rad), line([cx - rad, cy], [cx + rad, cy]), line([cx, cy - rad], [cx, cy + rad])]
    }
    case 'summingJunction': {
      const rad = Math.min(w, h) / 2
      const k = rad * Math.SQRT1_2
      return [ellipse(cx, cy, rad, rad), line([cx - k, cy - k], [cx + k, cy + k]), line([cx + k, cy - k], [cx - k, cy + k])]
    }
    case 'cylinder': {
      const paths = cylinderPaths(l, t, r, b)
      return [path(paths.outline, true), path(paths.rim)]
    }
    case 'umlClass': {
      const header = Math.min(Math.max(30, h * .3), 44)
      const second = header + (h - header) * .5
      return [path(rectPath(l, t, r, b), true), line([l, t + header], [r, t + header]), line([l, t + second], [r, t + second])]
    }
    case 'umlInterface': {
      const header = Math.min(Math.max(38, h * .4), 56)
      return [path(rectPath(l, t, r, b), true), line([l, t + header], [r, t + header])]
    }
    case 'umlPackage': {
      const tabHeight = Math.min(Math.max(16, h * .18), 26)
      const tabWidth = Math.min(Math.max(50, w * .4), 120)
      return [
        path(`M ${l} ${t + tabHeight} V ${t} H ${l + tabWidth} V ${t + tabHeight} H ${r} V ${b} H ${l} Z`, true),
        line([l, t + tabHeight], [l + tabWidth, t + tabHeight]),
      ]
    }
    case 'umlComponent': {
      const tab = Math.min(w * .14, 22)
      const tabH = Math.min(h * .14, 12)
      const bodyLeft = l + tab / 2
      return [
        path(rectPath(bodyLeft, t, r, b), true),
        path(rectPath(l, t + h * .25, l + tab, t + h * .25 + tabH), true),
        path(rectPath(l, b - h * .25 - tabH, l + tab, b - h * .25), true),
      ]
    }
    case 'umlNode': {
      const d = Math.min(w, h) * .18
      return [
        poly([[l, t + d], [l + w - d, t + d], [r, t], [r, b - d], [r - d, b], [l, b]]),
        path(`M ${l} ${t + d} L ${l + d} ${t} L ${r} ${t} M ${r - d} ${b} L ${r - d} ${t + d} L ${l} ${t + d} M ${r - d} ${t + d} L ${r} ${t}`),
      ]
    }
    case 'umlActor': {
      const headR = Math.min(w * .3, h * .16)
      const headY = t + headR
      const neck = headY + headR
      const hip = t + h * .62
      return [
        ellipse(cx, headY, headR, headR),
        path(`M ${cx} ${neck} V ${hip} M ${l} ${neck + h * .12} H ${r} M ${cx} ${hip} L ${l + w * .08} ${b} M ${cx} ${hip} L ${r - w * .08} ${b}`),
      ]
    }
    case 'umlNote': {
      const fold = Math.min(w, h) * .2
      return [poly([[l, t], [r - fold, t], [r, t + fold], [r, b], [l, b]]), path(`M ${r - fold} ${t} V ${t + fold} H ${r}`)]
    }
    case 'umlInitial': {
      const rad = Math.min(w, h) / 2
      return [inkDot(cx, cy, rad)]
    }
    case 'umlFinal': {
      const rad = Math.min(w, h) / 2
      return [ellipse(cx, cy, rad, rad), inkDot(cx, cy, rad * .55)]
    }
    case 'umlLifeline': {
      const head = Math.min(Math.max(34, h * .16), 52)
      return [path(rectPath(l, t, r, t + head), true), path(`M ${cx} ${t + head} V ${b}`, false, true)]
    }
    case 'umlBoundary': {
      const rad = Math.min(w * .36, h / 2)
      const barX = l + w * .12
      return [ellipse(r - rad, cy, rad, rad), path(`M ${barX} ${cy - rad} V ${cy + rad} M ${barX} ${cy} H ${r - rad * 2}`)]
    }
    case 'umlControl': {
      const rad = Math.min(w, h * .82) / 2
      const top = cy + h * .08 - rad
      return [
        ellipse(cx, cy + h * .08, rad, rad),
        path(`M ${cx + rad * .35} ${top - rad * .3} L ${cx} ${top} L ${cx + rad * .35} ${top + rad * .3}`),
      ]
    }
    case 'umlEntity': {
      const rad = Math.min(w, h * .86) / 2
      return [ellipse(cx, cy - h * .06, rad, rad), line([cx - rad, cy - h * .06 + rad + 3], [cx + rad, cy - h * .06 + rad + 3])]
    }
    case 'umlFork':
      return [{ type: 'path', d: rectPath(l, t, r, b), filled: true, ink: true }]
    case 'umlFlowFinal': {
      const rad = Math.min(w, h) / 2
      const k = rad * Math.SQRT1_2
      return [ellipse(cx, cy, rad, rad), line([cx - k, cy - k], [cx + k, cy + k]), line([cx + k, cy - k], [cx - k, cy + k])]
    }
    case 'umlHistory': {
      const rad = Math.min(w, h) / 2
      const arm = rad * .45
      return [ellipse(cx, cy, rad, rad), path(`M ${cx - arm} ${cy - arm} V ${cy + arm} M ${cx + arm} ${cy - arm} V ${cy + arm} M ${cx - arm} ${cy} H ${cx + arm}`)]
    }
    case 'umlSendSignal': {
      const notch = Math.min(w * .2, h * .5)
      return [poly([[l, t], [r - notch, t], [r, cy], [r - notch, b], [l, b]])]
    }
    case 'umlReceiveSignal': {
      const notch = Math.min(w * .2, h * .5)
      return [poly([[l, t], [r, t], [r, b], [l, b], [l + notch, cy]])]
    }
    case 'umlFrame': {
      const tabW = Math.min(Math.max(46, w * .22), 120)
      const tabH = Math.min(Math.max(20, h * .14), 30)
      return [path(rectPath(l, t, r, b), true), path(`M ${l} ${t + tabH} H ${l + tabW - tabH * .45} L ${l + tabW} ${t + tabH * .55} V ${t}`)]
    }
    case 'umlSwimlane': {
      const header = Math.min(Math.max(30, h * .1), 44)
      return [path(rectPath(l, t, r, b), true), line([l, t + header], [r, t + header])]
    }
    case 'umlSwimlaneH': {
      const header = Math.min(Math.max(32, w * .12), 60)
      return [path(rectPath(l, t, r, b), true), line([l + header, t], [l + header, b])]
    }
    case 'umlLollipop': {
      const rad = Math.min(w / 2, h * .3)
      return [ellipse(cx, t + rad, rad, rad), line([cx, t + rad * 2], [cx, b])]
    }
    case 'umlSocket': {
      const rad = Math.min(w / 2, h * .3)
      return [path(`M ${cx - rad} ${t + rad * .2} A ${rad} ${rad} 0 1 0 ${cx + rad} ${t + rad * .2}`), line([cx, t + rad * 1.2], [cx, b])]
    }
    case 'umlDestruction': {
      const k = Math.min(w, h) / 2
      return [path(`M ${cx - k} ${cy - k} L ${cx + k} ${cy + k} M ${cx + k} ${cy - k} L ${cx - k} ${cy + k}`)]
    }
    case 'sequentialData': {
      const rad = Math.min(w, h * .82) / 2
      const centerY = t + rad
      return [ellipse(cx, centerY, rad, rad), path(`M ${cx} ${centerY + rad} H ${cx + rad}`)]
    }
    case 'directData': {
      const cap = Math.min(w * .16, 24)
      return [
        path(`M ${l + cap / 2} ${t} H ${r - cap / 2} C ${r + cap * .6} ${t} ${r + cap * .6} ${b} ${r - cap / 2} ${b} H ${l + cap / 2} C ${l - cap * .6} ${b} ${l - cap * .6} ${t} ${l + cap / 2} ${t} Z`, true),
        path(`M ${r - cap / 2} ${t} C ${r - cap * 1.6} ${t} ${r - cap * 1.6} ${b} ${r - cap / 2} ${b}`),
      ]
    }
    case 'annotation': {
      const lip = Math.min(w * .12, 16)
      return [path(`M ${l + lip} ${t} H ${l} V ${b} H ${l + lip}`)]
    }
    case 'loopLimit': {
      const cut = Math.min(w, h) * .2
      return [poly([[l + cut, t], [r - cut, t], [r, t + cut], [r, b], [l, b], [l, t + cut]])]
    }
    case 'parallelMode':
      return [path(`M ${l} ${t} H ${r} M ${l} ${b} H ${r}`)]
    default:
      return [path(rectPath(l, t, r, b), true)]
  }
}

/** Shapes whose outline is straight-edged, so a miter join keeps corners sharp. */
const sharpShapes = new Set<CanvasShapeKind>([
  'triangle', 'rightTriangle', 'diamond', 'hexagon', 'parallelogram', 'pentagon', 'octagon', 'trapezoid', 'star', 'cross', 'arrowRight', 'arrowDouble', 'chevron', 'cube', 'lightning',
  'decision', 'data', 'manualInput', 'manualOperation', 'preparation', 'merge', 'extract', 'card', 'offPage', 'collate', 'sort', 'transfer', 'loopLimit',
  'umlNode', 'umlNote', 'umlSendSignal', 'umlReceiveSignal', 'erRelationship', 'erWeakRelationship', 'erAssociativeEntity',
])
export function shapeUsesSharpJoins(shape: CanvasShapeKind): boolean {
  return sharpShapes.has(shape)
}

/** Shapes drawn as a solid mass or a bare symbol rather than an outlined region (label sits outside). */
export function shapeIsSolidGlyph(shape: CanvasShapeKind): boolean {
  return ['umlInitial', 'umlFinal', 'umlFlowFinal', 'umlHistory', 'umlActor', 'umlBoundary', 'umlControl', 'umlEntity', 'umlFork', 'umlDestruction', 'umlLollipop', 'umlSocket', 'connector', 'sequentialData'].includes(shape)
}

/**
 * Where a named connector port meets the actual outline of a shape, in
 * normalized coordinates. Side-midpoint handles fall outside a triangle or a
 * parallelogram, so using the node rectangle for those ports creates a visible
 * gap between the connector and the drawn outline.
 */
export function canvasShapePortPosition(shape: CanvasShapeKind, portId: string): { x: number; y: number } | undefined {
  switch (shape) {
    case 'triangle':
    case 'extract':
      if (portId === 'left') return { x: .25, y: .5 }
      if (portId === 'right') return { x: .75, y: .5 }
      return undefined
    case 'rightTriangle':
      if (portId === 'top') return { x: 0, y: 0 }
      if (portId === 'right') return { x: .5, y: .5 }
      return undefined
    case 'merge':
      if (portId === 'left') return { x: .25, y: .5 }
      if (portId === 'right') return { x: .75, y: .5 }
      return undefined
    case 'chevron':
      if (portId === 'left') return { x: .22, y: .5 }
      return undefined
    case 'umlReceiveSignal':
      if (portId === 'left') return { x: .2, y: .5 }
      return undefined
    case 'parallelogram':
    case 'data':
      if (portId === 'left') return { x: .085, y: .5 }
      if (portId === 'right') return { x: .915, y: .5 }
      return undefined
    case 'trapezoid':
      if (portId === 'left') return { x: .085, y: .5 }
      if (portId === 'right') return { x: .915, y: .5 }
      return undefined
    case 'manualOperation':
      if (portId === 'left') return { x: .085, y: .5 }
      if (portId === 'right') return { x: .915, y: .5 }
      return undefined
    case 'manualInput':
      if (portId === 'top') return { x: .5, y: .14 }
      return undefined
    case 'offPage':
      if (portId === 'bottom') return { x: .5, y: 1 }
      if (portId === 'left') return { x: 0, y: .35 }
      if (portId === 'right') return { x: 1, y: .35 }
      return undefined
    default:
      return undefined
  }
}
