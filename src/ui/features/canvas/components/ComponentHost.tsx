import { Component, type ErrorInfo, type ReactNode } from 'react'
import type { CanvasElement, JsonObject } from '../domain/types'
import type { ComponentRegistry } from './registry/ComponentRegistry'
import type { ComponentHostAPI } from './registry/types'

export interface ComponentHostProps {
  element: CanvasElement
  registry: ComponentRegistry
  host: ComponentHostAPI
  fallback?: (element: CanvasElement) => ReactNode
  errorFallback?: (element: CanvasElement, error: Error, retry: () => void) => ReactNode
  onRenderError?: (element: CanvasElement, error: Error, info: ErrorInfo) => void
}

export function ComponentHost(props: ComponentHostProps): ReactNode {
  const { element, host } = props
  // The revision is deliberately not part of the key: remounting on every
  // committed patch would tear down the rendered subtree — and any focus or
  // scroll inside it — each time a property changes. The boundary instead
  // clears a stuck error when the revision moves (see resetToken), which is
  // all the remount ever bought.
  const boundaryKey = `${element.id}:${element.component_type}:${element.component_version}:${host.mode}`
  return (
    <ComponentErrorBoundary
      key={boundaryKey}
      resetToken={element.revision}
      element={element}
      fallback={props.errorFallback}
      onError={(error, info) => props.onRenderError?.(element, error, info)}
    >
      <ResolvedComponentRenderer {...props} />
    </ComponentErrorBoundary>
  )
}

function ResolvedComponentRenderer({ element, registry, host, fallback }: ComponentHostProps): ReactNode {
  const resolved = registry.resolve(element.component_type, element.component_version, element.props)
  if (resolved.unknown) throw new Error(`不支持的画布组件 ${element.component_type}@${element.component_version}`)
  if (resolved.unknown && fallback) return fallback(element)
  const renderer = resolved.definition.renderers[host.mode]
  const renderElement: CanvasElement<JsonObject> = resolved.migrated
    ? { ...element, component_version: resolved.version, props: resolved.props }
    : element
  return renderer({ element: renderElement, host })
}

interface BoundaryProps {
  element: CanvasElement
  children: ReactNode
  /** Clears a captured error when it changes — a new revision means new inputs. */
  resetToken?: unknown
  fallback?: ComponentHostProps['errorFallback']
  onError?: (error: Error, info: ErrorInfo) => void
}

interface BoundaryState { error?: Error; token?: unknown }

class ComponentErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = {}

  static getDerivedStateFromError(value: unknown): Partial<BoundaryState> {
    return { error: value instanceof Error ? value : new Error(String(value)) }
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    if (state.token === props.resetToken) return null
    return { token: props.resetToken, error: undefined }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  private readonly retry = (): void => this.setState({ error: undefined })

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(this.props.element, error, this.retry)
    return (
      <div role="alert" data-canvas-component-error={this.props.element.component_type}>
        <strong>{this.props.element.component_type}@{this.props.element.component_version}</strong>
        <span>Component render failed.</span>
        <button type="button" onClick={this.retry}>Retry</button>
      </div>
    )
  }
}
