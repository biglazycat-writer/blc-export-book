import { describe, expect, it } from 'vitest'
import type { ChapterSummary, Volume } from '../../../types/models'
import {
  allChapterIds,
  buildScopeTree,
  chapterIdsUnder,
  selectionState,
  summarizeSelection,
} from './scope-tree'

function volume(overrides: Partial<Volume> = {}): Volume {
  return {
    id: 'v1',
    novel_id: 'n1',
    parent_id: '',
    title: '第一卷',
    synopsis: '',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function chapter(overrides: Partial<ChapterSummary> = {}): ChapterSummary {
  return {
    id: 'c1',
    novel_id: 'n1',
    volume_path: '',
    title: '第一节',
    synopsis: '',
    word_count: 100,
    status: 'draft',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('buildScopeTree', () => {
  it('nests volumes by path and keeps root chapters in a 正文 group', () => {
    const tree = buildScopeTree(
      [volume(), volume({ id: 'v1/child', parent_id: 'v1', title: '下卷' })],
      [
        chapter({ id: 'root-1', volume_path: '', word_count: 40 }),
        chapter({ id: 'c1', volume_path: 'v1', word_count: 60 }),
        chapter({ id: 'c2', volume_path: 'v1/child', word_count: 80 }),
      ],
    )

    expect(tree.nodes).toHaveLength(1)
    expect(tree.nodes[0].id).toBe('v1')
    const nested = tree.nodes[0] as Extract<typeof tree.nodes[0], { kind: 'volume' }>
    expect(nested.chapterCount).toBe(2)
    expect(nested.wordCount).toBe(140)
    expect(nested.children.map((child) => child.id)).toEqual(['v1/child', 'c1'])
    expect(tree.rootGroup?.chapterCount).toBe(1)
    expect(tree.rootGroup?.wordCount).toBe(40)
  })

  it('drops chapters whose volume is gone, because the loader would not return them', () => {
    const tree = buildScopeTree([volume()], [chapter({ id: 'ghost', volume_path: 'missing' })])
    expect(allChapterIds(tree)).toEqual([])
    expect(tree.rootGroup).toBeNull()
  })

  it('keeps chapters in the order the workspace reports', () => {
    const tree = buildScopeTree(
      [volume()],
      [
        chapter({ id: 'b', volume_path: 'v1', title: 'B' }),
        chapter({ id: 'a', volume_path: 'v1', title: 'A' }),
      ],
    )
    const node = tree.nodes[0]
    expect(chapterIdsUnder(node)).toEqual(['b', 'a'])
  })
})

describe('selection', () => {
  const tree = buildScopeTree(
    [volume(), volume({ id: 'v1/child', parent_id: 'v1', title: '下卷' })],
    [
      chapter({ id: 'c1', volume_path: 'v1', word_count: 60 }),
      chapter({ id: 'c2', volume_path: 'v1/child', word_count: 80 }),
    ],
  )

  it('reports a parent as partial when only one descendant is selected', () => {
    expect(selectionState(tree.nodes[0], new Set(['c2']))).toBe('some')
    expect(selectionState(tree.nodes[0], new Set(['c1', 'c2']))).toBe('all')
    expect(selectionState(tree.nodes[0], new Set())).toBe('none')
  })

  it('summarizes the selected chapters and words', () => {
    expect(summarizeSelection(tree, new Set(['c1']), 'chapters')).toEqual({
      chapterCount: 1,
      wordCount: 60,
    })
    expect(summarizeSelection(tree, new Set(), 'all')).toEqual({
      chapterCount: 2,
      wordCount: 140,
    })
  })
})
