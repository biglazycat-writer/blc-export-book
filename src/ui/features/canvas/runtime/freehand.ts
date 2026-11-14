/**
 * Freehand drawing for the structured canvas.
 *
 * The structured canvas has no stroke concept of its own: every mutation is a
 * command against a `CanvasElement`, so a pen stroke is stored as an ordinary
 * `core.drawing` element whose points live in its props. That buys undo, delete,
 * selection, layering and persistence for free, with no new command type.
 *
 * Points are kept in the element's own coordinate space (relative to its
 * transform) so moving a stroke is a plain transform patch, exactly like every
 * other component.
 */

import type { CanvasElement, CanvasPoint, JsonObject, JsonValue } from '../domain/types'

export const DRAWING_COMPONENT_TYPE = 'core.drawing'

/** Widths and colours the toolbar offers. Kept small: this is a pen, not a paint program. */
export const PEN_WIDTHS = [2, 4, 8, 16] as const
export const PEN_COLORS = ['#202536', '#e11d48', '#f59e0b', '#16a34a', '#2563eb', '#9333ea'] as const
export const ERASER_RADII = [8, 16, 32] as const

export interface DrawingStroke {
  readonly points: readonly CanvasPoint[]
  readonly color: string
  readonly width: number
}

const squaredDistance = (a: CanvasPoint, b: CanvasPoint) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function pointSegmentDistanceSquared(point: CanvasPoint, start: CanvasPoint, end: CanvasPoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return squaredDistance(point, start)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)))
  return squaredDistance(point, { x: start.x + t * dx, y: start.y + t * dy })
}

/** Drops samples the pointer emits on top of each other, which carry no shape. */
export function appendDistinctPoints(current: readonly CanvasPoint[], point: CanvasPoint, minimumDistance = 1.2): CanvasPoint[] {
  const previous = current[current.length - 1]
  if (previous && squaredDistance(previous, point) < minimumDistance * minimumDistance) return [...current]
  return [...current, point]
}

/** Douglas-Peucker: a raw drag emits hundreds of samples, a curve needs a handful. */
export function simplifyPoints(points: readonly CanvasPoint[], tolerance = .65): CanvasPoint[] {
  if (points.length <= 2) return points.map((point) => ({ ...point }))
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: Array<[number, number]> = [[0, points.length - 1]]
  const toleranceSquared = tolerance * tolerance
  while (stack.length) {
    const [startIndex, endIndex] = stack.pop()!
    let farthestIndex = -1
    let farthestDistance = toleranceSquared
    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const distance = pointSegmentDistanceSquared(points[index], points[startIndex], points[endIndex])
      if (distance > farthestDistance) {
        farthestDistance = distance
        farthestIndex = index
      }
    }
    if (farthestIndex >= 0) {
      keep[farthestIndex] = 1
      stack.push([startIndex, farthestIndex], [farthestIndex, endIndex])
    }
  }
  return points.filter((_, index) => keep[index]).map((point) => ({ ...point }))
}

/** Quadratic segments through the midpoints, so a drawn line reads as a curve. */
export function strokePath(points: readonly CanvasPoint[], offset: CanvasPoint = { x: 0, y: 0 }): string {
  if (points.length === 0) return ''
  const local = points.map((point) => ({ x: point.x - offset.x, y: point.y - offset.y }))
  if (local.length === 1) return `M ${local[0].x} ${local[0].y} l 0.01 0`
  if (local.length === 2) return `M ${local[0].x} ${local[0].y} L ${local[1].x} ${local[1].y}`
  let path = `M ${local[0].x} ${local[0].y}`
  for (let index = 1; index < local.length - 1; index += 1) {
    const midpoint = { x: (local[index].x + local[index + 1].x) / 2, y: (local[index].y + local[index + 1].y) / 2 }
    path += ` Q ${local[index].x} ${local[index].y} ${midpoint.x} ${midpoint.y}`
  }
  const last = local[local.length - 1]
  path += ` T ${last.x} ${last.y}`
  return path
}

/** The element box a stroke needs: its extent plus room for the round cap. */
export function strokeBounds(stroke: DrawingStroke): { x: number; y: number; width: number; height: number } {
  const padding = Math.max(2, stroke.width * 1.5)
  if (!stroke.points.length) return { x: 0, y: 0, width: padding * 2, height: padding * 2 }
  let minX = stroke.points[0].x
  let maxX = minX
  let minY = stroke.points[0].y
  let maxY = minY
  for (const point of stroke.points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  return {
    x: minX - padding, y: minY - padding,
    width: Math.max(1, maxX - minX + padding * 2),
    height: Math.max(1, maxY - minY + padding * 2),
  }
}

/**
 * The stroke as it appears on the canvas. A drawing element's points live in its
 * own box, and React Flow rotates that box about its centre, so this is the
 * mapping that turns them back into canvas coordinates. Erasing happens in that
 * space: the fragments it leaves are written back as plain unrotated elements,
 * which puts the remaining ink exactly where it already was.
 */
export function canvasSpaceStroke(element: CanvasElement): DrawingStroke | null {
  const stroke = drawingStrokeOf(element)
  if (!stroke) return null
  const { x, y, scale_x, scale_y, rotation } = element.transform
  if (rotation === 0 && scale_x === 1 && scale_y === 1) {
    return { ...stroke, points: stroke.points.map((point) => ({ x: point.x + x, y: point.y + y })) }
  }
  const centre = { x: element.bounds.width / 2, y: element.bounds.height / 2 }
  const radians = (rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    ...stroke,
    points: stroke.points.map((point) => {
      const localX = (point.x - centre.x) * scale_x
      const localY = (point.y - centre.y) * scale_y
      return { x: x + centre.x + localX * cos - localY * sin, y: y + centre.y + localX * sin + localY * cos }
    }),
  }
}

/** Whether the eraser brush passes close enough to a stroke to change it at all. */
export function strokeIntersectsEraser(stroke: DrawingStroke, eraserPoints: readonly CanvasPoint[], radius: number): boolean {
  if (!eraserPoints.length || radius <= 0) return false
  const combinedRadius = radius + stroke.width / 2
  const sampled = densifyPoints(stroke.points, Math.max(.75, Math.min(6, combinedRadius / 2)))
  return sampled.some((point) => touchesEraser(point, eraserPoints, combinedRadius ** 2))
}

function isPointArray(value: JsonValue | undefined): boolean {
  return Array.isArray(value) && value.every((entry) =>
    typeof entry === 'object' && entry !== null && !Array.isArray(entry)
    && typeof (entry as Record<string, unknown>).x === 'number' && typeof (entry as Record<string, unknown>).y === 'number')
}

export function isDrawingProps(props: JsonObject): boolean {
  return isPointArray(props.points) && typeof props.color === 'string' && typeof props.width === 'number'
}

/** Reads a stroke back out of an element, in the element's own coordinates. */
export function drawingStrokeOf(element: CanvasElement): DrawingStroke | null {
  if (element.component_type !== DRAWING_COMPONENT_TYPE || !isDrawingProps(element.props)) return null
  const points = (element.props.points as Array<{ x: number; y: number }>).map(({ x, y }) => ({ x, y }))
  return { points, color: element.props.color as string, width: element.props.width as number }
}

/**
 * Turns canvas-space points into the props and geometry of a drawing element.
 * The stroke is re-based on its own bounds so the element's transform is its
 * top-left corner, like every other component on the canvas.
 */
export function drawingElementGeometry(stroke: DrawingStroke): { props: JsonObject; bounds: { width: number; height: number }; position: CanvasPoint } {
  const simplified = simplifyPoints(stroke.points, Math.max(.2, stroke.width * .06))
  const bounds = strokeBounds({ ...stroke, points: simplified })
  return {
    props: {
      points: simplified.map((point) => ({ x: round(point.x - bounds.x), y: round(point.y - bounds.y) })),
      color: stroke.color,
      width: stroke.width,
    },
    bounds: { width: round(bounds.width), height: round(bounds.height) },
    position: { x: round(bounds.x), y: round(bounds.y) },
  }
}

function round(value: number): number { return Math.round(value * 100) / 100 }

/**
 * The box a component occupies on the canvas. React Flow turns a node about its
 * own centre, and the canvas only ever turns things by quarter steps, so the
 * envelope of a turned box is exact rather than merely close: it keeps the
 * centre and swaps the sides.
 */
export function elementCanvasBox(element: CanvasElement): { x: number; y: number; width: number; height: number } {
  const { x, y, scale_x, scale_y, rotation } = element.transform
  const width = Math.abs(element.bounds.width * scale_x)
  const height = Math.abs(element.bounds.height * scale_y)
  if (rotation === 0) return { x, y, width, height }
  const radians = (rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  // Rounded like every other geometry this module hands out: `cos` of a quarter
  // turn is 6.1e-17, not 0, and an 80.00000000000001-wide box is a lie the
  // inspector and the tests would both have to work around.
  const halfWidth = round((width * cos + height * sin) / 2)
  const halfHeight = round((width * sin + height * cos) / 2)
  return { x: round(x + width / 2 - halfWidth), y: round(y + height / 2 - halfHeight), width: round(halfWidth * 2), height: round(halfHeight * 2) }
}

function distanceToBox(point: CanvasPoint, box: { x: number; y: number; width: number; height: number }): number {
  const dx = Math.max(box.x - point.x, 0, point.x - (box.x + box.width))
  const dy = Math.max(box.y - point.y, 0, point.y - (box.y + box.height))
  return Math.hypot(dx, dy)
}

/**
 * Whether the brush reaches any part of a box. The eraser sweeps a disc along
 * its path, so this is the distance from that swept path to the box, and the
 * path is sampled the same way a stroke is — which is what makes a fast swipe
 * count along its whole length rather than only where the pointer last reported.
 */
export function eraserReachesBox(eraserPoints: readonly CanvasPoint[], radius: number, box: { x: number; y: number; width: number; height: number }): boolean {
  if (!eraserPoints.length || radius <= 0) return false
  const sampled = densifyPoints(eraserPoints, Math.max(.75, Math.min(6, radius / 2)))
  return sampled.some((point) => distanceToBox(point, box) <= radius)
}

function densifyPoints(points: readonly CanvasPoint[], spacing: number): CanvasPoint[] {
  if (points.length <= 1) return points.map((point) => ({ ...point }))
  const result: CanvasPoint[] = [{ ...points[0] }]
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]
    const end = points[index]
    const distance = Math.hypot(end.x - start.x, end.y - start.y)
    const steps = Math.max(1, Math.min(2048, Math.ceil(distance / spacing)))
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps
      result.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t })
    }
  }
  return result
}

function touchesEraser(point: CanvasPoint, eraserPoints: readonly CanvasPoint[], radiusSquared: number): boolean {
  if (eraserPoints.length === 1) return squaredDistance(point, eraserPoints[0]) <= radiusSquared
  for (let index = 1; index < eraserPoints.length; index += 1) {
    if (pointSegmentDistanceSquared(point, eraserPoints[index - 1], eraserPoints[index]) <= radiusSquared) return true
  }
  return false
}

/**
 * What the eraser leaves of one stroke: the fragments the brush did not touch,
 * in canvas coordinates. An empty result means the whole stroke is gone, so the
 * caller deletes the element; one fragment patches it; several replace it.
 */
export function eraseStroke(stroke: DrawingStroke, eraserPoints: readonly CanvasPoint[], radius: number): DrawingStroke[] {
  if (!eraserPoints.length || radius <= 0) return [{ ...stroke, points: stroke.points.map((point) => ({ ...point })) }]
  const combinedRadius = radius + stroke.width / 2
  const radiusSquared = combinedRadius ** 2
  const sampled = densifyPoints(stroke.points, Math.max(.75, Math.min(6, combinedRadius / 2)))
  const fragments: CanvasPoint[][] = []
  let fragment: CanvasPoint[] = []
  for (const point of sampled) {
    if (touchesEraser(point, eraserPoints, radiusSquared)) {
      if (fragment.length > 1) fragments.push(fragment)
      fragment = []
    } else {
      fragment.push(point)
    }
  }
  if (fragment.length > 1) fragments.push(fragment)
  return fragments.map((points) => ({ ...stroke, points }))
}
