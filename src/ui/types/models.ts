export type WorkExportFormat = 'epub' | 'docx' | 'pdf' | 'html'

export interface WorkExportScope {
  folder_path?: string
  type: 'all' | 'volumes' | 'chapters'
  volume_paths?: string[]
  chapter_ids?: string[]
}

export interface WorkExportVolume {
  path: string
  parent_path: string
  title: string
  chapter_count: number
  word_count: number
}

export interface WorkExportChapter {
  id: string
  volume_path: string
  title: string
  synopsis: string
  content: string
  word_count: number
  created_at: string
  updated_at: string
}

export interface WorkExportManuscript {
  novel_id: string
  title: string
  synopsis: string
  workspace_kind: string
  word_count: number
  volumes: WorkExportVolume[]
  chapters: WorkExportChapter[]
}

export interface Volume {
  id: string
  novel_id: string
  parent_id: string
  title: string
  synopsis: string
  created_at: string
  updated_at: string
}

export interface ChapterSummary {
  workspace_rel?: string
  content_hash?: string
  id: string
  novel_id: string
  volume_path: string
  title: string
  synopsis: string
  word_count: number
  status: string
  created_at: string
  updated_at: string
}

export interface ChapterPreview {
  id: string
  preview: string
}

export interface Chapter extends ChapterSummary {
  content: string
  revision: number
  content_hash: string
  /**
   * The chapter's annotations, kept by the backend outside the Markdown body
   * because they anchor to offsets the file cannot carry. Absent when the
   * chapter has none. Join them into the editor seed with `chapterEditorContent`.
   */
  annotations?: import('../lib/content-model').AnnotationData[]
}
