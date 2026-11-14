import type { ChapterSummary, Volume } from '../../../types/models'
import { nt } from '../nt'

export interface ScopeChapterNode {
  kind: 'chapter'
  id: string
  title: string
  wordCount: number
  children: []
}

export interface ScopeVolumeNode {
  kind: 'volume'
  /** Volume path, which is also `Volume.id` in this codebase. */
  id: string
  title: string
  wordCount: number
  chapterCount: number
  children: ScopeNode[]
}

export type ScopeNode = ScopeVolumeNode | ScopeChapterNode

export interface ScopeTree {
  nodes: ScopeNode[]
  /** Root chapters (`volume_path === ''`) grouped under a synthetic 正文 node. */
  rootGroup: ScopeVolumeNode | null
}

const ROOT_GROUP_ID = '\u0000root'

export function rootGroupId(): string {
  return ROOT_GROUP_ID
}

/**
 * Volume tree for the range picker. `Volume.id` is the volume path and
 * `Volume.parent_id` is the parent path, so the tree needs no extra mapping.
 *
 * Chapters that point at a volume that no longer exists are dropped: the Go
 * loader would not return them either, and showing them would let the user
 * select something that can never be exported.
 */
export function buildScopeTree(volumes: Volume[], chapters: ChapterSummary[]): ScopeTree {
  const byPath = new Map<string, ScopeVolumeNode>()
  const parentOf = new Map<string, string>()
  const order: string[] = []
  for (const volume of volumes) {
    const path = String(volume.id || '').trim()
    if (!path || byPath.has(path)) continue
    byPath.set(path, {
      kind: 'volume',
      id: path,
      title: volume.title || nt('unnamed.category'),
      wordCount: 0,
      chapterCount: 0,
      children: [],
    })
    parentOf.set(path, String(volume.parent_id || '').trim())
    order.push(path)
  }

  const nodes: ScopeNode[] = []
  for (const path of order) {
    const node = byPath.get(path) as ScopeVolumeNode
    const parentId = parentOf.get(path) || ''
    const parent = parentId ? byPath.get(parentId) : undefined
    if (parent) parent.children.push(node)
    else nodes.push(node)
  }

  const rootChapters: ScopeChapterNode[] = []
  for (const chapter of chapters) {
    const node: ScopeChapterNode = {
      kind: 'chapter',
      id: chapter.id,
      title: chapter.title || nt('unnamed.chapter'),
      wordCount: Math.max(0, Number(chapter.word_count) || 0),
      children: [],
    }
    const path = String(chapter.volume_path || '').trim()
    const volume = path ? byPath.get(path) : undefined
    if (volume) volume.children.push(node)
    else if (!path) rootChapters.push(node)
  }

  const rootGroup: ScopeVolumeNode | null =
    rootChapters.length > 0
      ? {
          kind: 'volume',
          id: ROOT_GROUP_ID,
          title: nt('manuscript.rootVolume'),
          wordCount: rootChapters.reduce((sum, item) => sum + item.wordCount, 0),
          chapterCount: rootChapters.length,
          children: rootChapters,
        }
      : null

  const finalize = (node: ScopeVolumeNode): void => {
    let wordCount = 0
    let chapterCount = 0
    for (const child of node.children) {
      if (child.kind === 'volume') finalize(child)
      wordCount += child.wordCount
      chapterCount += child.kind === 'chapter' ? 1 : child.chapterCount
    }
    node.wordCount = wordCount
    node.chapterCount = chapterCount
  }
  for (const node of nodes) if (node.kind === 'volume') finalize(node)
  if (rootGroup) finalize(rootGroup)

  return { nodes, rootGroup }
}

export function chapterIdsUnder(node: ScopeNode): string[] {
  if (node.kind === 'chapter') return [node.id]
  return node.children.flatMap(chapterIdsUnder)
}

export function allChapterIds(tree: ScopeTree): string[] {
  const nodes = tree.rootGroup ? [tree.rootGroup, ...tree.nodes] : tree.nodes
  return nodes.flatMap(chapterIdsUnder)
}

export type SelectionState = 'all' | 'some' | 'none'

export function selectionState(node: ScopeNode, selected: ReadonlySet<string>): SelectionState {
  if (node.kind === 'chapter') return selected.has(node.id) ? 'all' : 'none'
  const ids = chapterIdsUnder(node)
  if (ids.length === 0) return 'none'
  const hit = ids.filter((id) => selected.has(id)).length
  if (hit === 0) return 'none'
  return hit === ids.length ? 'all' : 'some'
}

export interface ScopeSelectionSummary {
  chapterCount: number
  wordCount: number
}

export function summarizeSelection(
  tree: ScopeTree,
  selected: ReadonlySet<string>,
  scopeType: 'all' | 'chapters',
): ScopeSelectionSummary {
  const nodes = tree.rootGroup ? [tree.rootGroup, ...tree.nodes] : tree.nodes
  const walk = (node: ScopeNode): ScopeSelectionSummary => {
    if (node.kind === 'chapter') {
      const on = scopeType === 'all' || selected.has(node.id)
      return { chapterCount: on ? 1 : 0, wordCount: on ? node.wordCount : 0 }
    }
    return node.children.reduce<ScopeSelectionSummary>(
      (sum, child) => {
        const part = walk(child)
        return {
          chapterCount: sum.chapterCount + part.chapterCount,
          wordCount: sum.wordCount + part.wordCount,
        }
      },
      { chapterCount: 0, wordCount: 0 },
    )
  }
  return nodes.reduce<ScopeSelectionSummary>(
    (sum, node) => {
      const part = walk(node)
      return {
        chapterCount: sum.chapterCount + part.chapterCount,
        wordCount: sum.wordCount + part.wordCount,
      }
    },
    { chapterCount: 0, wordCount: 0 },
  )
}
