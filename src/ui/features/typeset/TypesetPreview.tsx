import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw } from 'lucide-react'
import {
  loadPDFDocumentFromBytes,
  type PDFDocumentProxy,
} from '../pdf-reader/pdfjs'
import { fitPreviewPage, rulerTicks } from './preview-geometry'

export interface PreviewPaper {
  /** Shown in the preview bar: A5 / A4 / B5 / 16K. */
  name: string
  widthMm: number
  heightMm: number
  marginsMm: { top: number; bottom: number; left: number; right: number }
}

interface TypesetPreviewProps {
  bytes: Uint8Array | null
  busy: boolean
  stage: string
  error: string
  paper: PreviewPaper
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.1
/** Width of both rulers, in CSS pixels. */
const RULER_SIZE = 22
/** Breathing room between a ruler and the sheet it measures. */
const RULER_GAP = 12

interface DisplaySize {
  width: number
  height: number
}

/**
 * Millimetre ruler drawn next to the page.
 *
 * The tick spacing follows the on-screen pixels-per-millimetre, so a zoomed
 * page keeps only the ticks that are still far enough apart to read. The
 * margins are shaded because they are exactly what the user is adjusting:
 * numbers in the sidebar and a picture of where those numbers land.
 */
function drawRuler(
  canvas: HTMLCanvasElement,
  orientation: 'horizontal' | 'vertical',
  length: number,
  paperMm: number,
  marginStartMm: number,
  marginEndMm: number,
) {
  if (length <= 0 || paperMm <= 0) return
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  const width = orientation === 'horizontal' ? length : RULER_SIZE
  const height = orientation === 'horizontal' ? RULER_SIZE : length
  canvas.width = Math.max(1, Math.round(width * ratio))
  canvas.height = Math.max(1, Math.round(height * ratio))
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(ratio, ratio)
  ctx.clearRect(0, 0, width, height)

  const color = window.getComputedStyle(canvas).color || 'rgba(120, 120, 120, 0.7)'
  const pxPerMm = length / paperMm
  const start = Math.min(length, Math.max(0, marginStartMm * pxPerMm))
  const end = Math.min(length, Math.max(0, marginEndMm * pxPerMm))

  ctx.fillStyle = 'rgba(127, 127, 127, 0.10)'
  if (orientation === 'horizontal') {
    ctx.fillRect(0, 0, start, height)
    ctx.fillRect(width - end, 0, end, height)
  } else {
    ctx.fillRect(0, 0, width, start)
    ctx.fillRect(0, height - end, width, end)
  }

  const minorTicks = rulerTicks(paperMm, pxPerMm)
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const tick of minorTicks) {
    const position = tick.position + 0.5
    if (orientation === 'horizontal') {
      ctx.moveTo(position, height)
      ctx.lineTo(position, height - tick.length)
    } else {
      ctx.moveTo(width, position)
      ctx.lineTo(width - tick.length, position)
    }
  }
  ctx.stroke()

  ctx.fillStyle = color
  ctx.font = '9px ui-sans-serif, system-ui, sans-serif'
  for (const tick of minorTicks) {
    if (!tick.label) continue
    // Labels on the sheet edges anchor inward: the first and last number sit on
    // the page border, and centring them would clip half the glyphs.
    if (orientation === 'horizontal') {
      const edge = tick.position <= 12 ? 'left' : tick.position >= width - 12 ? 'right' : 'center'
      ctx.textAlign = edge
      ctx.textBaseline = 'top'
      ctx.fillText(tick.label, edge === 'left' ? 1 : edge === 'right' ? width - 1 : tick.position, 1)
    } else {
      const edge = tick.position <= 12 ? 'top' : tick.position >= height - 12 ? 'bottom' : 'middle'
      ctx.textAlign = 'left'
      ctx.textBaseline = edge
      ctx.fillText(tick.label, 2, edge === 'top' ? 1 : edge === 'bottom' ? height - 1 : tick.position)
    }
  }

  ctx.strokeStyle = 'rgba(127, 127, 127, 0.28)'
  ctx.beginPath()
  if (orientation === 'horizontal') {
    ctx.moveTo(0, height - 0.5)
    ctx.lineTo(width, height - 0.5)
  } else {
    ctx.moveTo(width - 0.5, 0)
    ctx.lineTo(width - 0.5, height)
  }
  ctx.stroke()
}

/**
 * The paper preview: the real PDF the export would write, drawn with PDF.js.
 *
 * Rendering the actual file (rather than a DOM mock) is what keeps the preview
 * honest — margins, header rules, page breaks and page numbers are whatever
 * Typst produced, not a second implementation that can drift.
 *
 * The page is fitted to the pane by default. Zoom is relative to that fit
 * (100% = whole page visible), so changing the window or the paper never leaves
 * the studio showing a page that needs scrolling just to see its edges.
 */
export function TypesetPreview({ bytes, busy, stage, error, paper }: TypesetPreviewProps) {
  const { t } = useTranslation('novels')
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [loadError, setLoadError] = useState('')
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [display, setDisplay] = useState<DisplaySize | null>(null)
  const docRef = useRef<PDFDocumentProxy | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const topRulerRef = useRef<HTMLCanvasElement | null>(null)
  const leftRulerRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const host = viewportRef.current
    if (!host) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setViewportSize({
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height)),
      })
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!bytes) {
      if (docRef.current) {
        void docRef.current.loadingTask.destroy()
        docRef.current = null
      }
      setDoc(null)
      return
    }
    let cancelled = false
    setLoadError('')
    void loadPDFDocumentFromBytes(bytes)
      .then((next) => {
        if (cancelled) {
          void next.loadingTask.destroy()
          return
        }
        if (docRef.current) void docRef.current.loadingTask.destroy()
        docRef.current = next
        setDoc(next)
        setPageNumber(1)
      })
      .catch((failure: unknown) => {
        if (!cancelled) setLoadError(failure instanceof Error ? failure.message : String(failure))
      })
    return () => { cancelled = true }
  }, [bytes])

  useEffect(() => () => {
    if (docRef.current) {
      void docRef.current.loadingTask.destroy()
      docRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!doc) return
    let cancelled = false
    let task: { cancel: () => void } | null = null

    void (async () => {
      const page = await doc.getPage(Math.min(Math.max(1, pageNumber), doc.numPages))
      if (cancelled) return
      const base = page.getViewport({ scale: 1 })
      // Fit the whole page, not just its width: a tall A4 page limited by width
      // alone would still need a vertical scrollbar, and "the preview always
      // shows the full page" is the point of the studio.
      const fit = fitPreviewPage({
        availableWidth: Math.max(160, viewportSize.width - RULER_SIZE - RULER_GAP),
        availableHeight: Math.max(160, viewportSize.height - RULER_SIZE - RULER_GAP),
        pageWidth: base.width,
        pageHeight: base.height,
        zoom,
      })
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale: fit.scale * pixelRatio })
      const canvas = canvasRef.current
      if (!canvas) return
      const width = fit.width
      const height = fit.height
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      setDisplay((current) =>
        current && current.width === width && current.height === height
          ? current
          : { width, height })
      const render = page.render({ canvas, viewport })
      task = render
      await render.promise
    })().catch((failure: unknown) => {
      if (!cancelled) setLoadError(failure instanceof Error ? failure.message : String(failure))
    })

    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, pageNumber, zoom, viewportSize.width, viewportSize.height])

  useEffect(() => {
    const top = topRulerRef.current
    const left = leftRulerRef.current
    if (!top || !left || !display) return
    drawRuler(top, 'horizontal', display.width, paper.widthMm, paper.marginsMm.left, paper.marginsMm.right)
    drawRuler(left, 'vertical', display.height, paper.heightMm, paper.marginsMm.top, paper.marginsMm.bottom)
  }, [display, paper.widthMm, paper.heightMm, paper.marginsMm.top, paper.marginsMm.bottom, paper.marginsMm.left, paper.marginsMm.right])

  const changePage = (next: number) => {
    if (!doc) return
    setPageNumber(Math.min(Math.max(1, next), doc.numPages))
  }

  const total = doc?.numPages ?? 0
  const message = error || loadError
  const fitPercent = Math.round(zoom * 100)

  return (
    <section className="typesetPreviewPane">
      <div className="typesetPreviewBar">
        <div className="typesetPreviewHeading">
          <span className="typesetPreviewTitle">{t('typeset.preview.title')}</span>
          <span className="typesetPaperMeta">
            {paper.name} · {paper.widthMm} × {paper.heightMm} mm
          </span>
          {busy && bytes ? (
            <span className="typesetPreviewBusy" role="status">
              {stage || t('typeset.preview.typesetting')}
            </span>
          ) : null}
        </div>
        <div className="typesetPreviewNav">
          <button
            type="button"
            className="typesetIconButton"
            onClick={() => changePage(pageNumber - 1)}
            disabled={!doc || pageNumber <= 1}
            aria-label={t('typeset.preview.prevPage')}
          >
            <ChevronLeft size={15} />
          </button>
          <span className="typesetPageLabel">
            {total > 0
              ? t('typeset.preview.pageOf', { page: pageNumber, total })
              : t('typeset.preview.noPage')}
          </span>
          <button
            type="button"
            className="typesetIconButton"
            onClick={() => changePage(pageNumber + 1)}
            disabled={!doc || pageNumber >= total}
            aria-label={t('typeset.preview.nextPage')}
          >
            <ChevronRight size={15} />
          </button>
          <span className="typesetNavDivider" />
          <button
            type="button"
            className="typesetIconButton"
            onClick={() => setZoom((value) => Math.max(MIN_ZOOM, Math.round((value - ZOOM_STEP) * 10) / 10))}
            disabled={zoom <= MIN_ZOOM}
            aria-label={t('typeset.preview.zoomOut')}
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            className="typesetIconButton typesetFitButton"
            onClick={() => setZoom(1)}
            title={t('typeset.preview.fitWidth')}
            aria-label={t('typeset.preview.fitWidth')}
          >
            <RotateCcw size={13} />
            <span>{fitPercent}%</span>
          </button>
          <button
            type="button"
            className="typesetIconButton"
            onClick={() => setZoom((value) => Math.min(MAX_ZOOM, Math.round((value + ZOOM_STEP) * 10) / 10))}
            disabled={zoom >= MAX_ZOOM}
            aria-label={t('typeset.preview.zoomIn')}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="typesetPreviewViewport" ref={viewportRef}>
        {message ? (
          <div className="typesetPreviewMessage">{message}</div>
        ) : !bytes ? (
          <div className="typesetPreviewMessage">
            {busy ? stage || t('typeset.preview.typesetting') : t('typeset.preview.empty')}
          </div>
        ) : (
          <div
            className="typesetRulerFrame"
            style={display ? {
              gridTemplateColumns: `${RULER_SIZE}px ${RULER_GAP}px ${display.width}px`,
              gridTemplateRows: `${RULER_SIZE}px ${RULER_GAP}px ${display.height}px`,
            } : undefined}
          >
            <canvas ref={topRulerRef} className="typesetRuler typesetRulerTop" />
            <canvas ref={leftRulerRef} className="typesetRuler typesetRulerLeft" />
            <div className={`typesetPageShell${busy ? ' is-busy' : ''}`}>
              <canvas ref={canvasRef} className="typesetCanvas" />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
