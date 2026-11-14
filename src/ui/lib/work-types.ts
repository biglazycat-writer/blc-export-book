export interface WorkspaceConfig {
  leftTabs: Array<{ value: string; label: string }>
  defaultLeftTab: string
  chapterLabel: string
  volumeLabel: string
  hasVolumes: boolean
}

/** All works use the same workspace without type-specific configuration. */
export const WORKSPACE_CONFIG: WorkspaceConfig = {
  leftTabs: [
    { value: 'volumes', label: '文件夹与文件' },
    { value: 'chapters', label: '全部文件' },
  ],
  defaultLeftTab: 'volumes',
  chapterLabel: '文件',
  volumeLabel: '文件夹',
  hasVolumes: true,
}

export function workspaceConfigForKind(_raw?: string | null): WorkspaceConfig {
  return WORKSPACE_CONFIG
}

export type WorkspaceKind = 'writing' | 'library' | 'notes' | 'wechat' | 'other' | 'standalone'

export function normalizeWorkspaceKind(raw?: string | null): WorkspaceKind {
  const s = (raw || '').trim().toLowerCase()
  if (s === 'standalone' || s === 'single' || s === 'document') return 'standalone'
  if (s === 'library' || s === 'archive') return 'library'
  if (s === 'notes' || s === 'note' || s === 'knowledge') return 'notes'
  if (s === 'wechat' || s === 'article' || s === 'articles') return 'wechat'
  if (s === 'other' || s === 'general') return 'other'
  return 'writing'
}

export function workspaceKindLabel(raw?: string | null): string {
  return normalizeWorkspaceKind(raw) === 'standalone' ? '文件' : '文件夹'
}
