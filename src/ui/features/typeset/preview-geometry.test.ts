import { describe, expect, it } from 'vitest'
import { fitPreviewPage, rulerTickPlan, rulerTicks } from './preview-geometry'

describe('fitPreviewPage', () => {
  it('fits a portrait page by height when the pane is short', () => {
    const fit = fitPreviewPage({
      availableWidth: 900,
      availableHeight: 400,
      pageWidth: 595,
      pageHeight: 842,
      zoom: 1,
    })
    expect(fit.scale).toBeCloseTo(400 / 842)
    expect(fit.width).toBeLessThan(595)
    expect(fit.height).toBe(400)
  })

  it('fits a wide page by width when the pane is narrow', () => {
    const fit = fitPreviewPage({
      availableWidth: 300,
      availableHeight: 900,
      pageWidth: 595,
      pageHeight: 842,
      zoom: 1,
    })
    expect(fit.scale).toBeCloseTo(300 / 595)
    expect(fit.width).toBe(300)
    expect(fit.height).toBeLessThan(842)
  })

  it('treats zoom as a multiplier on the fit', () => {
    const base = { availableWidth: 600, availableHeight: 900, pageWidth: 595, pageHeight: 842 }
    const normal = fitPreviewPage({ ...base, zoom: 1 })
    const doubled = fitPreviewPage({ ...base, zoom: 2 })
    expect(doubled.width).toBeGreaterThan(normal.width)
    expect(doubled.height).toBeGreaterThan(normal.height)
  })

  it('never produces a zero-sized page', () => {
    const fit = fitPreviewPage({
      availableWidth: 0,
      availableHeight: 0,
      pageWidth: 595,
      pageHeight: 842,
      zoom: 1,
    })
    expect(fit.width).toBeGreaterThan(0)
    expect(fit.height).toBeGreaterThan(0)
  })
})

describe('rulerTicks', () => {
  it('drops to coarser ticks when the page is zoomed out', () => {
    expect(rulerTickPlan(1.5).minorMm).toBe(2)
    expect(rulerTickPlan(0.8).minorMm).toBe(5)
    expect(rulerTickPlan(6).minorMm).toBe(1)
  })

  it('labels every ten millimetres when there is room', () => {
    const ticks = rulerTicks(210, 4)
    expect(ticks[0]).toMatchObject({ position: 0, label: '0' })
    expect(ticks.filter((tick) => tick.label).map((tick) => tick.label)).toEqual([
      '0', '10', '20', '30', '40', '50', '60', '70', '80', '90',
      '100', '110', '120', '130', '140', '150', '160', '170', '180', '190', '200', '210',
    ])
    expect(ticks.find((tick) => tick.label === '10')?.length).toBe(9)
  })

  it('omits labels when ten millimetres is too narrow to read', () => {
    const ticks = rulerTicks(210, 1.5)
    expect(ticks.some((tick) => tick.label)).toBe(false)
  })

  it('covers the sheet edge exactly', () => {
    const ticks = rulerTicks(148, 3)
    expect(ticks[ticks.length - 1]?.position).toBe(444)
  })

  it('labels the sheet edge even when it is not a round number', () => {
    const ticks = rulerTicks(148, 3)
    expect(ticks[ticks.length - 1]).toMatchObject({ position: 444, label: '148' })
  })

  it('drops the round label that would collide with the edge label', () => {
    const labels = rulerTicks(185, 2.5)
      .filter((tick) => tick.label)
      .map((tick) => tick.label)
    expect(labels).toContain('185')
    expect(labels).not.toContain('180')
  })
})
