import type { CSSProperties, ReactNode } from 'react'
import type { JsonObject } from '../../domain/types'
import type { ComponentRenderContext, ComponentRenderer } from '../registry/types'
import { InlineIconText, inlineIconPlainText } from './inline-icons'
import { CanvasShapeGlyph, isCanvasShapeKind } from '../shapes/CanvasShapeGlyph'
import { drawingStrokeOf, strokePath } from '../../runtime/freehand'
import { kt } from '../../kt'

export function rendererFor(type: string, displayName: string): ComponentRenderer {
  switch (type) {
    case 'core.text': return renderText
    case 'core.shape': return renderShape
    case 'core.drawing': return renderDrawing
    default: return ({ element, host }) => renderSummary(displayName, element.props, host.lod)
  }
}


function renderText({ element, host }: ComponentRenderContext): ReactNode {
  const style = componentTextStyle(element.props)
  if (host.lod !== 'detail') return renderSummary(kt('renderer.textSummary'), element.props, host.lod)
  const content = stringProp(element.props.content)
  return <div className="structuredCanvasText" style={style}>
    <span className="structuredCanvasTextBody">{content ? <InlineIconText text={content} /> : kt('renderer.textPlaceholder')}</span>
  </div>
}

function renderShape({ element, host }: ComponentRenderContext): ReactNode {
  const shape = isCanvasShapeKind(element.props.shape) ? element.props.shape : 'roundedRectangle'
  const label = host.lod === 'detail' ? stringProp(element.props.label) : ''
  const labelStyle: CSSProperties = {}
  const explicitLabelFontSize = numberProp(element.props.labelFontSize)
  // When no explicit size is set, scale the label with the shape so resizing
  // keeps the text inside the outline instead of spilling past it. The floor is
  // low enough that a shrunken shape still fits its own text.
  labelStyle.fontSize = explicitLabelFontSize > 0
    ? explicitLabelFontSize
    : Math.max(9, Math.min(30, Math.round(Math.min(element.bounds.width, element.bounds.height) * 0.15)))
  const labelColor = stringProp(element.props.labelColor)
  if (labelColor) labelStyle.color = labelColor
  return <div className="structuredCanvasShape" data-canvas-shape={shape}>
    <CanvasShapeGlyph
      className="structuredCanvasShapeSurface"
      shape={shape}
      // Geometry is authored against the element's own box so the stretched
      // viewBox keeps corner radii and shoulders proportional after a resize.
      width={Math.max(1, element.bounds.width)}
      height={Math.max(1, element.bounds.height)}
      fill={stringProp(element.props.fill) || '#ffffff'}
      stroke={stringProp(element.props.stroke) || '#334155'}
      // 默认 1px：2px 在缩放到 150% 时看着像 3px，比网格和文字都重。
      // 0 是显式的「不要边框」，别被 `|| 1` 吞掉。
      strokeWidth={Math.max(0, Math.min(12, typeof element.props.strokeWidth === 'number' ? element.props.strokeWidth : 1))}
      borderStyle={stringProp(element.props.borderStyle) === 'dashed' ? 'dashed' : stringProp(element.props.borderStyle) === 'dotted' ? 'dotted' : 'solid'}
      handDrawn={host.handDrawn === true}
      seed={element.id}
    />
    {label && <span className="structuredCanvasShapeLabel" style={labelStyle}><span className="structuredCanvasShapeText"><InlineIconText text={label} /></span></span>}
  </div>
}

/**
 * A freehand stroke is its own path: the points are stored in the element's own
 * coordinate space, so the svg is the element box at 1:1 and the ink keeps the
 * exact width the pen had. A viewBox that scaled the path into the box would
 * re-stretch the stroke on every resize, thinning it on one axis and fattening
 * it on the other.
 */
function renderDrawing({ element, host }: ComponentRenderContext): ReactNode {
  const stroke = drawingStrokeOf(element)
  if (!stroke || stroke.points.length === 0) return host.lod === 'placeholder' ? kt('renderer.drawingSummary') : null
  return <svg
    className="structuredCanvasDrawing"
    width={Math.max(1, element.bounds.width)}
    height={Math.max(1, element.bounds.height)}
  >
    <path
      d={strokePath(stroke.points)}
      fill="none"
      stroke={stroke.color}
      strokeWidth={stroke.width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
}

function stringProp(value: unknown): string { return typeof value === 'string' ? value : '' }
function numberProp(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0 }
function componentTextStyle(props: JsonObject): CSSProperties {
  const align = ['left', 'center', 'right'].includes(stringProp(props.textAlign)) ? stringProp(props.textAlign) : 'center'
  return {
    textAlign: align as 'left' | 'center' | 'right',
    fontSize: Math.max(11, Math.min(72, numberProp(props.fontSize) || 18)),
    color: stringProp(props.color) || '#202536',
    background: stringProp(props.background) || 'rgba(255,255,255,.82)',
  }
}
function renderSummary(name: string, props: JsonObject, lod: string): string {
  if (lod === 'placeholder') return name
  const label = typeof props.title === 'string' ? props.title : typeof props.label === 'string' ? props.label : ''
  const plain = inlineIconPlainText(label)
  return plain ? `${name}: ${plain}` : name
}
