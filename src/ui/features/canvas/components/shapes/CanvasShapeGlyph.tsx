import { useMemo } from 'react'
import rough from 'roughjs'
import type { Options, PathInfo } from 'roughjs/bin/core'
import { shapeGeometry, shapeUsesSharpJoins, type CanvasShapeKind, type ShapePrimitive } from './shape-geometry'

export {
  canvasShapeGroupTitleKeys, canvasShapeOptions, canvasShapePortPosition, isCanvasShapeKind, shapeIsSolidGlyph,
  type CanvasShapeGroup, type CanvasShapeKind, type CanvasShapeOption,
} from './shape-geometry'

const generator = rough.generator()

// Hand-drawn paths must be derived from a stable seed, or every re-render
// re-rolls the jitter and the outline visibly twitches.
function numericSeed(value: string | number): number {
  if (typeof value === 'number') return Math.max(1, Math.abs(Math.round(value)) % 2147483647)
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.max(1, Math.abs(hash) % 2147483647)
}

function createRoughPaths(primitives: ShapePrimitive[], seed: number, options: Options): PathInfo[] {
  const dashed = options.strokeLineDash
  return primitives.flatMap((primitive, index) => {
    const local: Options = {
      ...options,
      seed: seed + index * 17,
      fill: primitive.ink ? options.stroke : primitive.filled ? options.fill : undefined,
      strokeLineDash: primitive.dashed ? [7, 5] : dashed,
      preserveVertices: true,
    }
    const drawing = primitive.type === 'ellipse'
      ? generator.ellipse(primitive.cx, primitive.cy, primitive.rx * 2, primitive.ry * 2, local)
      : primitive.type === 'polygon'
        ? generator.polygon(primitive.points, local)
        : generator.path(primitive.d, local)
    return generator.toPaths(drawing)
  })
}

interface Props {
  shape: CanvasShapeKind
  width?: number
  height?: number
  radius?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  borderStyle?: 'solid' | 'dashed' | 'dotted'
  handDrawn?: boolean
  seed?: string | number
  className?: string
  title?: string
}

/**
 * Renders one canvas shape as scalable SVG. `preserveAspectRatio="none"` lets the
 * viewBox stretch to whatever bounds the element has, so geometry never needs to
 * be recomputed when the element is resized.
 */
export function CanvasShapeGlyph({
  shape,
  width = 100,
  height = 70,
  radius = 12,
  fill = '#ffffff',
  stroke = '#1f2937',
  strokeWidth = 1.6,
  borderStyle = 'solid',
  handDrawn = false,
  seed = shape,
  className,
  title,
}: Props) {
  const resolvedSeed = numericSeed(seed)
  const strokeLineDash = useMemo(() => (borderStyle === 'dashed' ? [9, 6] : borderStyle === 'dotted' ? [2, 5] : undefined), [borderStyle])
  // The outer half of the stroke must meet the SVG edge so connector ports
  // placed on the node boundary have no visual gap to the shape.
  const inset = Math.max(0.75, strokeWidth / 2)
  const primitives = useMemo(() => shapeGeometry(shape, width, height, inset, radius), [shape, width, height, inset, radius])
  const roughPaths = useMemo(() => {
    if (!handDrawn) return []
    return createRoughPaths(primitives, resolvedSeed, {
      seed: resolvedSeed,
      stroke: strokeWidth > 0 ? stroke : 'none',
      strokeWidth: Math.max(.75, strokeWidth),
      fill: fill === 'transparent' ? undefined : fill,
      fillStyle: 'solid',
      // Enough wobble to read as an intentional pencil sketch at normal canvas
      // zoom; sub-pixel offsets disappear on HiDPI screens.
      roughness: 1.38,
      bowing: 1.08,
      maxRandomnessOffset: Math.min(3.2, Math.max(1.45, strokeWidth * 1.08)),
      curveFitting: .88,
      curveStepCount: 18,
      preserveVertices: true,
      strokeLineDash,
      disableMultiStroke: false,
      disableMultiStrokeFill: true,
      fillShapeRoughnessGain: .82,
      fixedDecimalPlaceDigits: 2,
    })
  }, [fill, handDrawn, primitives, resolvedSeed, stroke, strokeLineDash, strokeWidth])

  const common = {
    stroke: strokeWidth > 0 ? stroke : 'none',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: (shapeUsesSharpJoins(shape) ? 'miter' : 'round') as 'miter' | 'round',
    vectorEffect: 'non-scaling-stroke' as const,
    className: 'canvasShapeStroke',
  }

  return <svg className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
    {title && <title>{title}</title>}
    {handDrawn ? roughPaths.map((path, index) => <path
      key={`${resolvedSeed}-${index}`}
      className={path.stroke && path.stroke !== 'none' ? 'canvasShapeStroke' : 'canvasShapeFill'}
      d={path.d}
      fill={path.fill || 'none'}
      stroke={path.stroke}
      strokeWidth={path.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={path.fill ? undefined : strokeLineDash?.join(' ')}
      vectorEffect="non-scaling-stroke"
    />) : primitives.map((primitive, index) => {
      const dash = primitive.dashed ? '7 5' : strokeLineDash?.join(' ')
      const paint = { ...common, fill: primitive.ink ? stroke : primitive.filled ? fill : 'none', strokeDasharray: dash }
      if (primitive.type === 'ellipse') return <ellipse key={index} cx={primitive.cx} cy={primitive.cy} rx={primitive.rx} ry={primitive.ry} {...paint} />
      if (primitive.type === 'polygon') return <polygon key={index} points={primitive.points.map((point) => point.join(',')).join(' ')} {...paint} />
      return <path key={index} d={primitive.d} {...paint} />
    })}
  </svg>
}
