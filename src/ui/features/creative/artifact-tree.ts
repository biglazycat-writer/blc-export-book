import {normalizeMindMapText} from './mind-map-text'
import {applyLevelFontSizes} from './mindmap-presets'
import type {CreativeArtifact} from './types'
type SimpleTreeNode = {
  data: { uid?: string; text?: string; label?: string; richText?: boolean; [key: string]: unknown }
  children?: SimpleTreeNode[]
}

function normalizeNativeTree(value: unknown): SimpleTreeNode | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const data = record.data
  if (!data || typeof data !== 'object') return null
  const rawData = data as Record<string, unknown>
  const text = normalizeMindMapText(rawData.text || rawData.label)
  const children = Array.isArray(record.children)
    ? record.children.map(normalizeNativeTree).filter((child): child is SimpleTreeNode => !!child)
    : []
  return { data: { ...rawData, text, label: text, richText: false, resetRichText: false }, children }
}

export function artifactToTree(artifact: CreativeArtifact): SimpleTreeNode {
  const tree = buildArtifactTree(artifact)
  // 三级以下的字号是算出来的、存在节点数据里；老稿件里没有这些数据，
  // 这里补一遍，否则嵌入的图和编辑器里看到的层级字号不一样。
  applyLevelFontSizes(tree)
  return tree
}

function buildArtifactTree(artifact: CreativeArtifact): SimpleTreeNode {
  const native = normalizeNativeTree(artifact.content.root)
    || normalizeNativeTree((artifact.content.data as Record<string, unknown> | undefined)?.root)
  if (native) return native

  const rawNodes = Array.isArray(artifact.content.nodes)
    ? artifact.content.nodes.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    : []
  const entries: Array<[string, Record<string, unknown>]> = rawNodes.flatMap((node) => {
    const id = String(node.id || '')
    return id ? [[id, node]] : []
  })
  const byId = new Map<string, Record<string, unknown>>(entries)
  const children = new Map<string, string[]>()
  const hasParent = new Set<string>()
  const rawEdges = Array.isArray(artifact.content.edges) ? artifact.content.edges : []
  rawEdges.forEach((item) => {
    if (!item || typeof item !== 'object') return
    const edge = item as Record<string, unknown>
    const source = String(edge.source || '')
    const target = String(edge.target || '')
    if (!byId.has(source) || !byId.has(target) || hasParent.has(target)) return
    hasParent.add(target)
    children.set(source, [...(children.get(source) || []), target])
  })
  const rootId = [...byId.keys()].find((id) => !hasParent.has(id)) || [...byId.keys()][0]
  const visited = new Set<string>()
  const build = (id: string): SimpleTreeNode => {
    const node = byId.get(id)
    const rawData = node?.data && typeof node.data === 'object' ? node.data as Record<string, unknown> : {}
    const text = normalizeMindMapText(rawData.label || rawData.text)
    if (visited.has(id)) return { data: { uid: id, text, label: text, richText: false, resetRichText: false }, children: [] }
    visited.add(id)
    return {
      data: { ...rawData, uid: id, text, label: text, richText: false, resetRichText: false },
      children: (children.get(id) || []).map(build),
    }
  }
  return rootId
    ? build(rootId)
    : { data: { uid: 'root', text: artifact.title || '中心主题', label: artifact.title || '中心主题' }, children: [] }
}

