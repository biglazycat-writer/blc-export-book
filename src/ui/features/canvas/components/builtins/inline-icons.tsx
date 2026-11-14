/**
 * Icons that live inside a component's text. The caret picks the position and
 * the glyph flows with the surrounding characters; the string that components
 * already persist keeps a token with the icon id and colour, so display and
 * editing read the same value.
 */
import { Fragment, type ReactNode } from 'react'
import { IconGlyph, iconDefinition, renderIconSvg, type IconDefinition, type IconSelection } from '../../../inserts/icon-catalog'
import type { JsonObject } from '../../domain/types'

const ICON_TOKEN = /\{\{icon:([a-z0-9-]+)(?::([^}]+))?\}\}/g
const DEFAULT_ICON_COLOR = '#356AE6'

export const INLINE_ICON_COMPONENTS = ['core.text', 'core.shape'] as const

export function supportsInlineIcon(componentType: string): boolean {
  return (INLINE_ICON_COMPONENTS as readonly string[]).includes(componentType)
}

export type InlineIconPart =
  | { kind: 'text'; text: string }
  | { kind: 'icon'; definition: IconDefinition; color: string }

export function inlineIconToken(id: string, color: string): string {
  return `{{icon:${id}:${color || DEFAULT_ICON_COLOR}}}`
}

export function inlineIconParts(text: string): InlineIconPart[] {
  const parts: InlineIconPart[] = []
  let cursor = 0
  for (const match of text.matchAll(ICON_TOKEN)) {
    const start = match.index ?? 0
    if (start > cursor) parts.push({ kind: 'text', text: text.slice(cursor, start) })
    const definition = iconDefinition(match[1])
    if (definition) parts.push({ kind: 'icon', definition, color: match[2] || DEFAULT_ICON_COLOR })
    else parts.push({ kind: 'text', text: match[0] })
    cursor = start + match[0].length
  }
  if (cursor < text.length) parts.push({ kind: 'text', text: text.slice(cursor) })
  return parts
}

/** Compact form for thumbnails and summaries that cannot draw the glyph. */
export function inlineIconPlainText(text: string): string {
  return inlineIconParts(text).map((part) => part.kind === 'icon' ? part.definition.symbol : part.text).join('')
}

export function InlineIconText({ text }: { text: string }): ReactNode {
  return <>{inlineIconParts(text).map((part, index) => part.kind === 'icon'
    ? <span
      key={index}
      className="structuredCanvasInlineIcon"
      style={{ color: part.color }}
      role="img"
      aria-label={part.definition.label}
    ><IconGlyph definition={part.definition} size="1.1em" color={part.color} strokeWidth={1.9} /></span>
    : <Fragment key={index}>{part.text}</Fragment>)}</>
}

export function inlineIconSeedColor(props: JsonObject): string {
  // Text-specific colours first: `color` on a shape is the label colour, which
  // reads better as an icon tint than the fill.
  for (const key of ['labelColor', 'fontColor', 'titleColor', 'color']) {
    const value = props[key]
    if (typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) return value
  }
  return DEFAULT_ICON_COLOR
}

function createIconElement(definition: IconDefinition, color: string): HTMLSpanElement {
  const element = document.createElement('span')
  element.className = 'structuredCanvasInlineIcon'
  element.dataset.canvasIcon = definition.id
  element.dataset.canvasIconColor = color
  element.contentEditable = 'false'
  element.setAttribute('role', 'img')
  element.setAttribute('aria-label', definition.label)
  element.innerHTML = renderIconSvg(definition, color, { size: 16 })
  return element
}

/** Rebuilds an editable field from the stored string, tokens becoming glyphs. */
export function writeInlineIconContent(node: HTMLElement, text: string): void {
  const fragment = node.ownerDocument.createDocumentFragment()
  for (const part of inlineIconParts(text)) {
    fragment.append(part.kind === 'icon'
      ? createIconElement(part.definition, part.color)
      : node.ownerDocument.createTextNode(part.text))
  }
  node.replaceChildren(fragment)
}

/** Reads an editable field back, glyphs becoming their stored tokens. */
export function readInlineIconContent(node: HTMLElement): string {
  let output = ''
  const closeLine = (): void => {
    if (output !== '' && !output.endsWith('\n')) output += '\n'
  }
  const walk = (parent: Node): void => {
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        output += child.nodeValue ?? ''
        continue
      }
      if (!(child instanceof HTMLElement)) continue
      const iconId = child.dataset.canvasIcon
      if (iconId) {
        output += inlineIconToken(iconId, child.dataset.canvasIconColor || '')
        continue
      }
      if (child.tagName === 'BR') {
        output += '\n'
        continue
      }
      const block = child.tagName === 'DIV' || child.tagName === 'P'
      if (block) closeLine()
      walk(child)
      if (block) closeLine()
    }
  }
  walk(node)
  // Editing engines pad with NBSP and a phantom trailing newline; neither is content.
  return output.replace(/\u00a0/g, ' ').replace(/\n$/, '')
}

/** Puts the icon at the caret (or the field's end) and parks the caret after it. */
export function insertInlineIcon(field: HTMLElement, range: Range | null, selection: IconSelection): boolean {
  const definition = iconDefinition(selection.id)
  if (!definition) return false
  const color = selection.color || DEFAULT_ICON_COLOR
  field.focus({ preventScroll: true })
  const target = range !== null && field.contains(range.startContainer) ? range : endOf(field)
  const icon = createIconElement(definition, color)
  target.deleteContents()
  target.insertNode(icon)
  const caret = field.ownerDocument.createRange()
  caret.setStartAfter(icon)
  caret.collapse(true)
  const selectionApi = field.ownerDocument.defaultView?.getSelection()
  selectionApi?.removeAllRanges()
  selectionApi?.addRange(caret)
  return true
}

export function restoreInlineFocus(field: HTMLElement, range: Range | null): void {
  field.focus({ preventScroll: true })
  if (range === null) return
  const selection = field.ownerDocument.defaultView?.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function endOf(field: HTMLElement): Range {
  const range = field.ownerDocument.createRange()
  range.selectNodeContents(field)
  range.collapse(false)
  return range
}
