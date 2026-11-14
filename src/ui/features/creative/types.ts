export type CreativeArtifactKind = 'mindmap' | 'presentation'

export interface CreativeArtifact {
  id: string
  workspace_rel?: string
  chapter_id: string
  kind: CreativeArtifactKind
  title: string
  content: Record<string, unknown>
  revision: number
  schema_version: number
  created_at: string
  updated_at: string
}

export interface CreateCreativeArtifactInput {
  chapter_id: string
  kind: CreativeArtifactKind
  title?: string
  folder?: string  // V3: Target folder for file-based storage
  /** Adopt an existing slides project instead of creating one. */
  project_id?: string
}

export interface UpdateCreativeArtifactInput {
  id: string
  base_revision: number
  title: string
  content: Record<string, unknown>
}
