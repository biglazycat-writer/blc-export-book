import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  chapterIdsUnder,
  selectionState,
  type ScopeNode,
  type ScopeTree,
} from './scope-tree'

function TriCheckbox({
  state,
  disabled,
  label,
  onChange,
}: {
  state: 'all' | 'some' | 'none'
  disabled?: boolean
  label: string
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some'
  }, [state])
  return (
    <input
      ref={ref}
      type="checkbox"
      className="blcWorkScopeCheck"
      aria-label={label}
      checked={state === 'all'}
      disabled={disabled}
      onChange={onChange}
      onClick={(event) => event.stopPropagation()}
    />
  )
}

function ScopeNodeRow({
  node,
  depth,
  selected,
  disabled,
  onToggle,
}: {
  node: ScopeNode
  depth: number
  selected: ReadonlySet<string>
  disabled?: boolean
  onToggle: (node: ScopeNode) => void
}) {
  const { t } = useTranslation(['novels', 'common'])
  const [open, setOpen] = useState(depth < 1)
  const state = selectionState(node, selected)
  const expandable = node.kind === 'volume' && node.children.length > 0
  const formatWords = (value: number): string => {
    if (!Number.isFinite(value) || value <= 0) return t('preview.wordsZero')
    if (value >= 10000) return t('preview.wordsWan', { value: (value / 10000).toFixed(1) })
    return t('preview.wordsCount', { value: Math.round(value) })
  }
  const meta =
    node.kind === 'volume'
      ? `${t('preview.chapterCount', { value: node.chapterCount })} · ${formatWords(node.wordCount)}`
      : formatWords(node.wordCount)

  return (
    <div className="blcWorkScopeNode">
      <div
        className={`blcWorkScopeRow${node.kind === 'volume' ? ' is-volume' : ''}`}
        style={{ paddingLeft: 6 + depth * 16 }}
      >
        {expandable ? (
          <button
            type="button"
            className="blcWorkScopeToggle"
            aria-label={open ? t('tree.collapse') : t('tree.expand')}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span className="blcWorkScopeToggle is-empty" />
        )}
        <TriCheckbox
          state={state}
          disabled={disabled}
          label={t('picker.chooseItem', { title: node.title })}
          onChange={() => onToggle(node)}
        />
        <span className="blcWorkScopeTitle" title={node.title}>
          {node.title}
        </span>
        <span className="blcWorkScopeMeta">{meta}</span>
      </div>
      {expandable && open ? (
        <div className="blcWorkScopeChildren">
          {node.children.map((child) => (
            <ScopeNodeRow
              key={`${child.kind}:${child.id}`}
              node={child}
              depth={depth + 1}
              selected={selected}
              disabled={disabled}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export interface WorkExportScopePickerProps {
  tree: ScopeTree
  scopeType: 'all' | 'chapters'
  chapterIds: string[]
  disabled?: boolean
  onScopeTypeChange: (value: 'all' | 'chapters') => void
  onChapterIdsChange: (ids: string[]) => void
}

export function WorkExportScopePicker({
  tree,
  scopeType,
  chapterIds,
  disabled,
  onScopeTypeChange,
  onChapterIdsChange,
}: WorkExportScopePickerProps) {
  const { t } = useTranslation(['novels', 'common'])
  const selected = new Set(chapterIds)
  const nodes = tree.rootGroup ? [tree.rootGroup, ...tree.nodes] : tree.nodes

  const toggle = (node: ScopeNode) => {
    const ids = chapterIdsUnder(node)
    const state = selectionState(node, selected)
    const next = new Set(selected)
    if (state === 'all') ids.forEach((id) => next.delete(id))
    else ids.forEach((id) => next.add(id))
    onChapterIdsChange(Array.from(next))
  }

  return (
    <div className="blcWorkScope">
      <div className="blcWorkScopeModes">
        <label className="blcWorkScopeMode">
          <input
            type="radio"
            name="blc-work-scope"
            checked={scopeType === 'all'}
            disabled={disabled}
            onChange={() => onScopeTypeChange('all')}
          />
          <span>{t('picker.allContent')}</span>
        </label>
        <label className="blcWorkScopeMode">
          <input
            type="radio"
            name="blc-work-scope"
            checked={scopeType === 'chapters'}
            disabled={disabled}
            onChange={() => onScopeTypeChange('chapters')}
          />
          <span>{t('picker.customChapters')}</span>
        </label>
      </div>
      {scopeType === 'chapters' ? (
        <div className="blcWorkScopeTree" role="tree" aria-label={t('picker.treeAria')}>
          {nodes.length === 0 ? (
            <div className="blcWorkScopeEmpty">{t('picker.empty')}</div>
          ) : (
            nodes.map((node) => (
              <ScopeNodeRow
                key={`${node.kind}:${node.id}`}
                node={node}
                depth={0}
                selected={selected}
                disabled={disabled}
                onToggle={toggle}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
