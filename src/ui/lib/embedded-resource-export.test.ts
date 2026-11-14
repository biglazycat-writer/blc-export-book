// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { resolveEmbeddedResourceElements, resolveEmbeddedResources } from './embedded-resource-export'

describe('embedded diagrams in document exports', () => {
  const image = { src: 'data:image/png;base64,AA==', width: 800, height: 400 }
  it('renders nested embeds once per resource and preserves the editable source', async () => {
    const embed = { type: 'mindMapEmbed', attrs: { artifactId: 'map', title: 'Mind map' } }
    const doc = { type: 'doc', content: [{ type: 'blockquote', content: [embed] }, embed, { type: 'flowCanvas', attrs: { flowCanvasId: 'scene' } }] }
    const original = JSON.stringify(doc)
    const render = vi.fn(async () => image)
    const result = await resolveEmbeddedResources(doc, render)
    expect(render.mock.calls).toHaveLength(2)
    expect(render).toHaveBeenCalledWith('mindMapEmbed', 'map')
    expect(render).toHaveBeenCalledWith('flowCanvas', 'scene')
    expect((result.content[0] as { content: unknown[] }).content[0]).toEqual({ type: 'image', attrs: { ...image, alt: 'Mind map' } })
    expect(JSON.stringify(doc)).toBe(original)
  })
  it('fails explicitly if the linked resource cannot be read', async () => {
    await expect(resolveEmbeddedResources({ type: 'flowCanvas', attrs: { flowCanvasId: 'missing' } }, async () => { throw new Error('missing resource') })).rejects.toThrow('missing resource')
  })
  it('replaces both serialized and live-view diagrams in PNG export clones', async () => {
    const root = document.createElement('div')
    root.innerHTML = '<div data-flow-canvas-id="a"><figure data-flow-canvas-id="a">Loading</figure></div><figure data-mindmap-artifact-id="b">Map</figure><p>Text</p>'
    const render = vi.fn(async () => image)
    await resolveEmbeddedResourceElements(root, render)
    expect(root.querySelectorAll('img')).toHaveLength(2)
    expect(root.querySelectorAll('[data-flow-canvas-id], [data-mindmap-artifact-id]')).toHaveLength(0)
    expect(root.querySelector('p')?.textContent).toBe('Text')
    expect(render).toHaveBeenCalledTimes(2)
  })
})
