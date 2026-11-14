import { describe, expect, it } from 'vitest'
import {
  isCancelError,
  stagePercent,
  WorkExportCancelledError,
  throwIfAborted,
} from './progress'

describe('export progress', () => {
  it('maps stages onto their promised ranges', () => {
    expect(stagePercent('reading')).toBe(0)
    expect(stagePercent('assets', 0, 10)).toBe(10)
    expect(stagePercent('assets', 10, 10)).toBe(25)
    expect(stagePercent('chapters', 12, 24)).toBe(50)
    expect(stagePercent('chapters', 24, 24)).toBe(75)
    expect(stagePercent('compile')).toBe(75)
    expect(stagePercent('save')).toBe(95)
  })

  it('never overshoots a stage', () => {
    expect(stagePercent('chapters', 100, 2)).toBe(75)
  })

  it('turns an aborted signal into a cancellable error', () => {
    const controller = new AbortController()
    throwIfAborted(controller.signal)
    controller.abort()
    expect(() => throwIfAborted(controller.signal)).toThrow(WorkExportCancelledError)
    try {
      throwIfAborted(controller.signal)
    } catch (error) {
      expect(isCancelError(error)).toBe(true)
    }
  })
})
