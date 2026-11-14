import {Position,getBezierPath,getSmoothStepPath,getStraightPath} from '@xyflow/react'
import type {CanvasConnector} from '../domain/types'
import type {ConnectorControlPoint,ConnectorMarker} from '../runtime/projectConnectors'
interface Vector { x: number; y: number }

export interface RoutedConnectorPath {
  path: string
  labelX: number
  labelY: number
  points: number[][]
}

interface RouteConnectorInput {
  routing: CanvasConnector['routing']
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
  controlPoint?: ConnectorControlPoint
}

export function routeConnectorPath(input: RouteConnectorInput): RoutedConnectorPath {
  if (input.controlPoint) return routeConnectorThroughControlPoint(input)

  const [path, labelX, labelY] = input.routing === 'straight'
    ? getStraightPath(input)
    : input.routing === 'bezier'
      ? getBezierPath(input)
      : getSmoothStepPath({ ...input, borderRadius: 8, offset: 12 })

  return { path, labelX, labelY, points: [] }
}

function routeConnectorThroughControlPoint(input: RouteConnectorInput): RoutedConnectorPath {
  const control = input.controlPoint!
  if (input.routing === 'straight') {
    return {
      path: `M ${input.sourceX} ${input.sourceY} L ${control.x} ${control.y} L ${input.targetX} ${input.targetY}`,
      labelX: control.x,
      labelY: control.y,
      points: [[control.x, control.y]],
    }
  }
  if (input.routing === 'bezier') {
    const tangent = normalize({ x: input.targetX - input.sourceX, y: input.targetY - input.sourceY })
    const tangentLength = Math.min(120, Math.max(36, Math.hypot(input.targetX - input.sourceX, input.targetY - input.sourceY) / 5))
    const centerBefore = { x: control.x - tangent.x * tangentLength, y: control.y - tangent.y * tangentLength }
    const centerAfter = { x: control.x + tangent.x * tangentLength, y: control.y + tangent.y * tangentLength }
    const sourceControl = endpointControl({ x: input.sourceX, y: input.sourceY }, input.sourcePosition, tangentLength)
    const targetControl = endpointControl({ x: input.targetX, y: input.targetY }, input.targetPosition, tangentLength)
    return {
      path: `M ${input.sourceX} ${input.sourceY} C ${sourceControl.x} ${sourceControl.y} ${centerBefore.x} ${centerBefore.y} ${control.x} ${control.y} C ${centerAfter.x} ${centerAfter.y} ${targetControl.x} ${targetControl.y} ${input.targetX} ${input.targetY}`,
      labelX: control.x,
      labelY: control.y,
      points: [[control.x, control.y]],
    }
  }

  const points = orthogonalControlPoints(input, control)
  return {
    path: roundedPolylinePath(points, 10),
    labelX: control.x,
    labelY: control.y,
    points: points.slice(1, -1).map(({ x, y }) => [x, y]),
  }
}

function orthogonalControlPoints(input: RouteConnectorInput, control: ConnectorControlPoint): Vector[] {
  const source = { x: input.sourceX, y: input.sourceY }
  const target = { x: input.targetX, y: input.targetY }
  const sourceHorizontal = input.sourcePosition === Position.Left || input.sourcePosition === Position.Right
  const targetHorizontal = input.targetPosition === Position.Left || input.targetPosition === Position.Right
  // Same-axis ports put both elbows on the control's axis line. A control
  // dragged outside the band between the two endpoints would then fold the
  // path back over itself (a spur that goes out and returns on the same
  // segment), so those drags route as a U through the control instead.
  if (sourceHorizontal && targetHorizontal) {
    if (control.y < Math.min(source.y, target.y) || control.y > Math.max(source.y, target.y)) {
      const sourceDrop = { x: (source.x + control.x) / 2, y: source.y }
      const targetRise = { x: (target.x + control.x) / 2, y: target.y }
      // The control rides the middle run; clamping keeps that run monotonic
      // when the control is also dragged past either endpoint sideways.
      const onRun = clamp(control.x, Math.min(sourceDrop.x, targetRise.x), Math.max(sourceDrop.x, targetRise.x))
      return dedupePoints([
        source, sourceDrop, { x: sourceDrop.x, y: control.y }, { x: onRun, y: control.y },
        { x: targetRise.x, y: control.y }, targetRise, target,
      ])
    }
    return dedupePoints([source, { x: control.x, y: source.y }, control, { x: control.x, y: target.y }, target])
  }
  if (!sourceHorizontal && !targetHorizontal) {
    if (control.x < Math.min(source.x, target.x) || control.x > Math.max(source.x, target.x)) {
      const sourceDrop = { x: source.x, y: (source.y + control.y) / 2 }
      const targetRise = { x: target.x, y: (target.y + control.y) / 2 }
      const onRun = clamp(control.y, Math.min(sourceDrop.y, targetRise.y), Math.max(sourceDrop.y, targetRise.y))
      return dedupePoints([
        source, sourceDrop, { x: control.x, y: sourceDrop.y }, { x: control.x, y: onRun },
        { x: control.x, y: targetRise.y }, targetRise, target,
      ])
    }
    return dedupePoints([source, { x: source.x, y: control.y }, control, { x: target.x, y: control.y }, target])
  }
  const sourceElbow = sourceHorizontal ? { x: control.x, y: source.y } : { x: source.x, y: control.y }
  const targetElbow = targetHorizontal ? { x: control.x, y: target.y } : { x: target.x, y: control.y }
  return dedupePoints([source, sourceElbow, control, targetElbow, target])
}

function dedupePoints(points: Vector[]): Vector[] {
  return points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y)
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

function roundedPolylinePath(points: Vector[], radius: number): string {
  if (points.length === 0) return ''
  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const next = points[index + 1]
    const incoming = Math.hypot(current.x - previous.x, current.y - previous.y)
    const outgoing = Math.hypot(next.x - current.x, next.y - current.y)
    const bend = Math.min(radius, incoming / 2, outgoing / 2)
    if (bend <= 0) { path += ` L ${current.x} ${current.y}`; continue }
    const before = moveToward(current, previous, bend)
    const after = moveToward(current, next, bend)
    path += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`
  }
  const end = points[points.length - 1]
  return `${path} L ${end.x} ${end.y}`
}

function moveToward(from: Vector, to: Vector, distance: number): Vector {
  const direction = normalize({ x: to.x - from.x, y: to.y - from.y })
  return { x: from.x + direction.x * distance, y: from.y + direction.y * distance }
}

function endpointControl(point: Vector, position: Position, distance: number): Vector {
  switch (position) {
    case Position.Left: return { x: point.x - distance, y: point.y }
    case Position.Right: return { x: point.x + distance, y: point.y }
    case Position.Top: return { x: point.x, y: point.y - distance }
    case Position.Bottom: return { x: point.x, y: point.y + distance }
  }
}


function normalize(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y) || 1
  return { x: vector.x / length, y: vector.y / length }
}

export function connectorMarkerPath(marker: ConnectorMarker, tip: Vector, direction: Vector, strokeWidth: number): string {
  if (marker === 'none') return ''
  const unit = normalize(direction)
  const normal = { x: -unit.y, y: unit.x }
  const length = Math.max(12, 8 + strokeWidth * 2.4)
  const halfWidth = Math.max(4.5, length * .42)
  const back = (distance: number, side = 0): Vector => ({ x: tip.x - unit.x * distance + normal.x * side, y: tip.y - unit.y * distance + normal.y * side })
  const seg = (a: Vector, b: Vector) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`
  const circleAt = (center: Vector, radius: number) => `M ${center.x - radius} ${center.y} A ${radius} ${radius} 0 1 0 ${center.x + radius} ${center.y} A ${radius} ${radius} 0 1 0 ${center.x - radius} ${center.y} Z`
  switch (marker) {
    case 'circle':
    case 'open-circle': {
      const radius = Math.max(4, 3 + strokeWidth)
      return circleAt(back(radius), radius)
    }
    case 'diamond':
    case 'open-diamond': {
      const rear = back(length * 1.1)
      const left = back(length * .55, halfWidth)
      const right = back(length * .55, -halfWidth)
      return `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${rear.x} ${rear.y} L ${right.x} ${right.y} Z`
    }
    case 'open-triangle': {
      const left = back(length * 1.15, halfWidth * 1.15)
      const right = back(length * 1.15, -halfWidth * 1.15)
      return `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`
    }
    case 'block': {
      const left = back(length * .95, halfWidth * 1.35)
      const right = back(length * .95, -halfWidth * 1.35)
      return `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`
    }
    case 'half-arrow': {
      const left = back(length, halfWidth)
      return seg(left, tip)
    }
    case 'bar': {
      const at = back(strokeWidth * 1.5)
      return seg({ x: at.x + normal.x * halfWidth * 1.3, y: at.y + normal.y * halfWidth * 1.3 }, { x: at.x - normal.x * halfWidth * 1.3, y: at.y - normal.y * halfWidth * 1.3 })
    }
    case 'cross': {
      const center = back(length * .5)
      const arm = halfWidth
      const a = { x: center.x + (unit.x + normal.x) * arm, y: center.y + (unit.y + normal.y) * arm }
      const b = { x: center.x - (unit.x + normal.x) * arm, y: center.y - (unit.y + normal.y) * arm }
      const c = { x: center.x + (unit.x - normal.x) * arm, y: center.y + (unit.y - normal.y) * arm }
      const d = { x: center.x - (unit.x - normal.x) * arm, y: center.y - (unit.y - normal.y) * arm }
      return `${seg(a, b)} ${seg(c, d)}`
    }
    case 'crow-one': {
      const at = back(length * .6)
      return seg({ x: at.x + normal.x * halfWidth, y: at.y + normal.y * halfWidth }, { x: at.x - normal.x * halfWidth, y: at.y - normal.y * halfWidth })
    }
    case 'crow-many': {
      const root = back(length)
      return `${seg(root, { x: tip.x + normal.x * halfWidth, y: tip.y + normal.y * halfWidth })} ${seg(root, tip)} ${seg(root, { x: tip.x - normal.x * halfWidth, y: tip.y - normal.y * halfWidth })}`
    }
    case 'crow-one-many': {
      const root = back(length)
      const at = back(length * 1.35)
      const bar = seg({ x: at.x + normal.x * halfWidth, y: at.y + normal.y * halfWidth }, { x: at.x - normal.x * halfWidth, y: at.y - normal.y * halfWidth })
      return `${seg(root, { x: tip.x + normal.x * halfWidth, y: tip.y + normal.y * halfWidth })} ${seg(root, tip)} ${seg(root, { x: tip.x - normal.x * halfWidth, y: tip.y - normal.y * halfWidth })} ${bar}`
    }
    case 'crow-zero-one': {
      const radius = Math.max(4, 3 + strokeWidth)
      const at = back(length * .6)
      const bar = seg({ x: at.x + normal.x * halfWidth, y: at.y + normal.y * halfWidth }, { x: at.x - normal.x * halfWidth, y: at.y - normal.y * halfWidth })
      return `${circleAt(back(length * .6 + radius * 2 + 2), radius)} ${bar}`
    }
    case 'crow-zero-many': {
      const radius = Math.max(4, 3 + strokeWidth)
      const root = back(length)
      return `${seg(root, { x: tip.x + normal.x * halfWidth, y: tip.y + normal.y * halfWidth })} ${seg(root, tip)} ${seg(root, { x: tip.x - normal.x * halfWidth, y: tip.y - normal.y * halfWidth })} ${circleAt(back(length + radius + 1), radius)}`
    }
    default: {
      const left = back(length, halfWidth)
      const right = back(length, -halfWidth)
      return `M ${left.x} ${left.y} L ${tip.x} ${tip.y} L ${right.x} ${right.y}${marker === 'arrow' ? ' Z' : ''}`
    }
  }
}
