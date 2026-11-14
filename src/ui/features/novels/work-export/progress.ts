import { nt } from '../nt'
import type {
  WorkExportProgressReporter,
  WorkExportProgressUpdate,
  WorkExportStage,
} from './types'

const STAGE_RANGES: Record<WorkExportStage, [number, number]> = {
  reading: [0, 10],
  assets: [10, 25],
  chapters: [25, 75],
  compile: [75, 95],
  save: [95, 100],
}

export class WorkExportCancelledError extends Error {
  constructor() {
    super(nt('export.cancelled'))
    this.name = 'WorkExportCancelledError'
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new WorkExportCancelledError()
}

export function stagePercent(stage: WorkExportStage, done = 0, total = 0): number {
  const [from, to] = STAGE_RANGES[stage]
  if (stage === 'reading' || stage === 'compile' || stage === 'save') return from
  if (!Number.isFinite(total) || total <= 0) return from
  const ratio = Math.min(1, Math.max(0, done / total))
  return Math.round(from + (to - from) * ratio)
}

export function progressMessage(
  stage: WorkExportStage,
  done: number,
  total: number,
  detail?: string,
): string {
  switch (stage) {
    case 'reading':
      return detail || nt('export.readingChapters')
    case 'assets':
      return detail || nt('export.processingAssets', { value: Math.min(done, total), total })
    case 'chapters':
      return detail || nt('export.layingOutChapter', { current: Math.min(done + 1, total), total })
    case 'compile':
      return detail || nt('export.compilingFile')
    case 'save':
      return detail || nt('export.waitingSave')
    default:
      return detail || nt('export.exportingProgress')
  }
}

/** Reporter helper so every renderer reports the same stage/progress shape. */
export function createStageReporter(report: WorkExportProgressReporter) {
  return {
    stage(stage: WorkExportStage, detail?: string): void {
      report({ stage, percent: stagePercent(stage), message: progressMessage(stage, 0, 0, detail) })
    },
    step(stage: WorkExportStage, done: number, total: number, detail?: string): void {
      report({
        stage,
        percent: stagePercent(stage, done, total),
        message: progressMessage(stage, done, total, detail),
      })
    },
    update(update: WorkExportProgressUpdate): void {
      report(update)
    },
  }
}

export function isCancelError(error: unknown): boolean {
  return error instanceof WorkExportCancelledError
}
