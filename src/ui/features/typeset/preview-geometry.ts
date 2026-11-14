export interface PreviewPageFit {
  scale: number
  width: number
  height: number
}

/**
 * Fit one PDF page (measured at scale 1) into the preview pane.
 *
 * Zoom is relative to the fit, so 1 always means "the whole page is visible".
 * Fitting both axes matters: a page constrained by width alone still overflows
 * a short pane, and the studio must open without a scrollbar.
 */
export function fitPreviewPage(input: {
  availableWidth: number
  availableHeight: number
  pageWidth: number
  pageHeight: number
  zoom: number
}): PreviewPageFit {
  const { availableWidth, availableHeight, pageWidth, pageHeight } = input
  const zoom = Math.max(0.1, input.zoom)
  const fit = Math.min(availableWidth / pageWidth, availableHeight / pageHeight)
  const scale = Math.max(0.05, fit * zoom)
  return {
    scale,
    width: Math.max(1, Math.floor(pageWidth * scale)),
    height: Math.max(1, Math.floor(pageHeight * scale)),
  }
}

export interface RulerTick {
  /** CSS pixel offset along the ruler. */
  position: number
  /** Tick length in CSS pixels, measured inward from the ruler's page edge. */
  length: number
  /** Every tenth millimetre carries a number when the ticks are readable. */
  label?: string
}

export function rulerTickPlan(pxPerMm: number) {
  return {
    minorMm: pxPerMm >= 3.5 ? 1 : pxPerMm >= 1.2 ? 2 : 5,
    labelStepMm: 10,
    showLabels: pxPerMm * 10 >= 22,
  }
}

/** Millimetre ticks for a sheet of `paperMm`, drawn at `pxPerMm`. */
export function rulerTicks(paperMm: number, pxPerMm: number): RulerTick[] {
  if (paperMm <= 0 || pxPerMm <= 0) return []
  const { minorMm, labelStepMm, showLabels } = rulerTickPlan(pxPerMm)
  const ticks: RulerTick[] = []
  for (let mm = 0; mm <= paperMm + 1e-6; mm += minorMm) {
    const major = Math.abs(mm % labelStepMm) < 1e-6
    const half = Math.abs(mm % 5) < 1e-6
    ticks.push({
      position: Math.round(mm * pxPerMm),
      length: major ? 9 : half ? 6 : 3,
      label: major && showLabels ? String(Math.round(mm)) : undefined,
    })
  }
  // 纸张尺寸很少是整十毫米（A5 宽 148、B5 176、16K 185），但最后一格恰好是
  // 页面边界，必须标出尺寸，否则标尺末尾会留一段空着没有数字的刻度。
  const edge = Math.round(paperMm * pxPerMm)
  const edgeLabel = showLabels ? String(Math.round(paperMm)) : undefined
  const last = ticks[ticks.length - 1]
  if (last && last.position === edge) last.label = edgeLabel
  else ticks.push({ position: edge, length: 9, label: edgeLabel })
  if (edgeLabel) {
    for (let index = ticks.length - 2; index >= 0; index -= 1) {
      const tick = ticks[index]
      if (!tick.label) continue
      // 末端数字会和最近的整十数字挤在一起时，保留页面边界上的那个。
      if (edge - tick.position < 18) tick.label = undefined
      break
    }
  }
  return ticks
}
