import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Check, Copy, Download, Image, Loader2, Minus, Plus, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ParseKeys } from 'i18next'
import { exportApi } from '../../bridge/export-api'
import { docToMarkdown, storedDocFromRaw } from '../../lib/content-model'
import { saveExportBlob } from '../../lib/save-export'
import { sanitizeExportName } from '../novels/work-export/file-name'
import { applyImageLayout, defaultImageDesign, IMAGE_LAYOUTS, IMAGE_THEMES, imageHeight, imageOutputSize, withoutRepeatedTitle, type ImageDesign, type ImageRatio, type ImageTheme } from './design'
import { ImageCanvas } from './ImageCanvas'
import { imageContentOverflows, prepareImageHtml, renderDesignImage, waitForImageContent } from './render-image'
import 'katex/dist/katex.min.css'
import './image-designer.css'

type ImageLabel = ParseKeys<'novels'> extends infer Key ? Key extends `imageDesigner.${infer Label}` ? Label : never : never
const ratioLabels = { auto: 'auto', '3:4': 'portrait', '1:1': 'square', '16:9': 'landscape' } as const

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="imageDesignerField"><span>{label}</span>{children}</label>
}

export function ImageDesigner({ chapterId, onBack }: { chapterId: string; onBack: () => void }) {
  const { t } = useTranslation('novels')
  const tr = (key: ImageLabel) => t(`imageDesigner.${key}`)
  const [design, setDesign] = useState(defaultImageDesign)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [footer, setFooter] = useState('')
  const [source, setSource] = useState('')
  const [original, setOriginal] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [retry, setRetry] = useState(0)
  const [renderRetry, setRenderRetry] = useState(0)
  const [prepared, setPrepared] = useState<{ source: string; html: string } | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const [layoutError, setLayoutError] = useState('')
  const [notice, setNotice] = useState('')
  const [exporting, setExporting] = useState(false)
  const [viewportSize, setViewportSize] = useState({ width: 640, height: 720 })
  const [zoom, setZoom] = useState<number | null>(null)
  const [size, setSize] = useState({ width: 720, height: 0, overflow: false })
  const canvasRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)
  const imageCache = useRef(new Map<string, Promise<string>>())

  useEffect(() => {
    let alive = true
    setLoaded(false)
    setError('')
    setPrepared(null)
    imageCache.current.clear()
    void exportApi.getChapter(chapterId).then((chapter) => {
      if (!alive) return
      const markdown = withoutRepeatedTitle(docToMarkdown(storedDocFromRaw(chapter.content)), chapter.title)
      setTitle(chapter.title)
      setSource(markdown)
      setOriginal(markdown)
      setLoaded(true)
    }).catch((err: unknown) => { if (alive) setError(String(err instanceof Error ? err.message : err)) })
    return () => { alive = false }
  }, [chapterId, retry])

  const readImage = useCallback((src: string) => {
    const cache = imageCache.current
    if (!cache.has(src)) cache.set(src, exportApi.readImageAsDataURL(src).catch((err: unknown) => {
      cache.delete(src)
      throw err
    }))
    return cache.get(src)!
  }, [])

  useEffect(() => {
    if (!loaded) return
    let alive = true
    setPreparing(true)
    setError('')
    const timer = window.setTimeout(() => {
      void prepareImageHtml(source, readImage).then((html) => {
        if (alive) setPrepared({ source, html })
      }).catch((err: unknown) => {
        if (alive) setError(String(err instanceof Error ? err.message : err))
      }).finally(() => { if (alive) setPreparing(false) })
    }, 250)
    return () => { alive = false; window.clearTimeout(timer) }
  }, [loaded, source, readImage, renderRetry])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const measure = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let alive = true
    setLayoutError('')
    const measure = () => {
      if (alive) setSize({ width: canvas.offsetWidth, height: canvas.offsetHeight, overflow: imageContentOverflows(canvas) })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    const card = canvas.querySelector('.imageDesignCard')
    if (card) observer.observe(card)
    measure()
    void waitForImageContent(canvas).then(measure).catch((err: unknown) => {
      if (alive) setLayoutError(String(err instanceof Error ? err.message : err))
    })
    return () => { alive = false; observer.disconnect() }
  }, [loaded, prepared, design, title, author, footer])

  const patch = <K extends keyof ImageDesign>(key: K, value: ImageDesign[K]) => {
    setNotice('')
    setDesign((current) => ({ ...current, [key]: value }))
  }
  const posterHeight = imageHeight(design)
  const effectiveZoom = zoom ?? Math.max(0.15, Math.min(1, (viewportSize.width - 64) / design.width,
    posterHeight ? (viewportSize.height - 64) / posterHeight : 1))
  const output = imageOutputSize(size.width, size.height, design.scale)
  const stale = !prepared || prepared.source !== source
  const problem = error || layoutError || (size.overflow ? tr('overflow') : size.height && !output.valid ? tr('tooLarge') : '')
  const disabled = !loaded || preparing || stale || Boolean(problem) || !size.height || exporting
  const canCopy = typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function'

  const exportImage = async (copy: boolean) => {
    if (disabled || busyRef.current || !canvasRef.current) return
    busyRef.current = true
    setExporting(true)
    setNotice('')
    try {
      const blob = await renderDesignImage(canvasRef.current, design.scale)
      if (copy) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        setNotice(tr('copied'))
      } else {
        const saved = await saveExportBlob(blob, `${sanitizeExportName(title)}.png`)
        setNotice(saved.cancelled ? t('export.saveCancelled') : tr('saved'))
      }
    } catch (err) {
      setNotice('')
      setLayoutError(String(err instanceof Error ? err.message : err))
    } finally {
      busyRef.current = false
      setExporting(false)
    }
  }

  const slider = (key: 'width' | 'inset' | 'padding' | 'radius' | 'fontSize' | 'lineHeight', min: number, max: number, step = 1) => (
    <Field label={`${tr(key)} · ${design[key]}${key === 'lineHeight' ? '' : ' px'}`}>
      <input type="range" min={min} max={max} step={step} value={design[key]} onChange={(event) => patch(key, Number(event.target.value))} />
    </Field>
  )

  return (
    <div className="imageDesigner">
      <header className="imageDesignerHeader">
        <div className="imageDesignerHeading">
          <button type="button" className="lbBtn" onClick={onBack} disabled={exporting}><ArrowLeft size={15} />{tr('back')}</button>
          <div><h1><Image size={17} />{tr('title')}</h1><span>{tr('subtitle')}</span></div>
        </div>
        <div className="imageDesignerActions">
          {notice ? <span role="status" className="imageDesignerNotice"><Check size={14} />{notice}</span> : null}
          {canCopy ? <button type="button" className="lbBtn" disabled={disabled} onClick={() => void exportImage(true)}><Copy size={14} />{tr('copy')}</button> : null}
          <button type="button" className="lbBtn primary" disabled={disabled} onClick={() => void exportImage(false)}>
            {exporting ? <Loader2 size={15} className="typesetSpinner" /> : <Download size={15} />}{exporting ? tr('exporting') : tr('export')}
          </button>
        </div>
      </header>
      <div className="imageDesignerMain">
        <section className="imageDesignerPreview" aria-label={tr('preview')}>
          <div className="imageDesignerPreviewBar">
            <span>{preparing || !loaded ? tr('preparing') : tr('livePreview')}</span>
            <span>{output.width} × {output.height} px</span>
          </div>
          {problem ? <div className="imageDesignerError" role="alert">{problem}{error || layoutError ? <button className="lbBtn" onClick={() => {
            setLayoutError('')
            if (loaded) setRenderRetry((value) => value + 1)
            else setRetry((value) => value + 1)
          }}>{t('typeset.errors.retry')}</button> : null}</div> : null}
          <div className="imageDesignerViewport" ref={viewportRef}>
            {loaded ? (
              <div className="imageDesignerScaled" style={{ width: design.width * effectiveZoom, height: size.height * effectiveZoom }}>
                <div style={{ transform: `scale(${effectiveZoom})`, transformOrigin: 'top left' }}>
                  <ImageCanvas ref={canvasRef} design={design} title={title} author={author} footer={footer} html={prepared?.html || ''} />
                </div>
              </div>
            ) : <div className="imageDesignerLoading"><Loader2 className="typesetSpinner" size={20} />{tr('preparing')}</div>}
          </div>
          <div className="imageDesignerZoom">
            <button type="button" className="lbBtn" aria-label={tr('zoomOut')} onClick={() => setZoom(Math.max(0.15, effectiveZoom - 0.1))}><Minus size={14} /></button>
            <span>{Math.round(effectiveZoom * 100)}%</span>
            <button type="button" className="lbBtn" aria-label={tr('zoomIn')} onClick={() => setZoom(Math.min(1.5, effectiveZoom + 0.1))}><Plus size={14} /></button>
            <button type="button" className="lbBtn" onClick={() => setZoom(null)}>{tr('fit')}</button>
          </div>
        </section>
        <aside className="imageDesignerSidebar">
          <fieldset disabled={exporting || !loaded} className="imageDesignerControls">
            <div className="imageDesignerColumns">
            <div>
              <section><h2>{tr('layoutTheme')}</h2>
                <div className="imageDesignerLayouts" role="group" aria-label={tr('layoutTheme')}>
                  {IMAGE_LAYOUTS.map((layout) => <button type="button" key={layout} aria-label={tr(`layouts.${layout}.name`)} aria-pressed={design.layout === layout} onClick={() => {
                    setNotice('')
                    setDesign((current) => applyImageLayout(current, layout))
                  }}>
                    <div className="imageDesignerLayoutSample" aria-hidden="true">
                      <ImageCanvas design={{ ...applyImageLayout(defaultImageDesign(), layout), width: 360, ratio: '3:4', padding: 26, inset: 16 }} title={tr('layoutSampleTitle')} author="" footer={tr('layoutSampleFooter')} html={`<p>${tr('layoutSampleBody')}</p><blockquote><p>${tr('layoutSampleQuote')}</p></blockquote>`} />
                    </div>
                    <strong>{tr(`layouts.${layout}.name`)}</strong><span>{tr(`layouts.${layout}.hint`)}</span>
                  </button>)}
                </div>
                <p className="imageDesignerHint">{tr('layoutHint')}</p>
              </section>
              <section><h2>{tr('theme')}</h2><div className="imageDesignerThemes">
                {(Object.keys(IMAGE_THEMES) as ImageTheme[]).map((value) => <button type="button" key={value} aria-label={tr(`themes.${value}`)} aria-pressed={design.theme === value && !design.background} onClick={() => setDesign((current) => ({ ...current, theme: value, background: '' }))}>
                  <span style={{ background: IMAGE_THEMES[value].background }}><i style={{ background: IMAGE_THEMES[value].card, color: IMAGE_THEMES[value].ink }}>文</i></span>{tr(`themes.${value}`)}
                </button>)}
              </div></section>
              <section><h2>{tr('canvas')}</h2>
                <Field label={tr('ratio')}><select className="lbSelect" value={design.ratio} onChange={(event) => patch('ratio', event.target.value as ImageRatio)}>
                  {(['auto', '3:4', '1:1', '16:9'] as const).map((value) => <option key={value} value={value}>{tr(`ratios.${ratioLabels[value]}`)}</option>)}
                </select></Field>
                {slider('width', 480, 1080, 20)}{slider('inset', 0, 80, 4)}
                <Field label={tr('background')}><input type="color" value={design.background || '#e8e0d2'} onChange={(event) => patch('background', event.target.value)} /></Field>
              </section>
            </div>
            <div>
              <section><h2>{tr('content')}</h2><p className="imageDesignerHint">{tr('draftHint')}</p>
                <Field label={tr('heading')}><input className="lbInput" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} /></Field>
                <label className="imageDesignerToggle"><input type="checkbox" checked={design.showTitle} onChange={(event) => patch('showTitle', event.target.checked)} />{tr('showTitle')}</label>
                <Field label={tr('author')}><input className="lbInput" value={author} maxLength={120} onChange={(event) => setAuthor(event.target.value)} /></Field>
                <Field label={tr('footer')}><input className="lbInput" value={footer} maxLength={160} onChange={(event) => setFooter(event.target.value)} /></Field>
              </section>
              <section><h2>{tr('card')}</h2>{slider('padding', 16, 80, 4)}{slider('radius', 0, 36, 2)}
                <label className="imageDesignerToggle"><input type="checkbox" checked={design.shadow} onChange={(event) => patch('shadow', event.target.checked)} />{tr('shadow')}</label>
              </section>
              <section><h2>{tr('typography')}</h2>
                <Field label={tr('font')}><select className="lbSelect" value={design.font} onChange={(event) => patch('font', event.target.value as ImageDesign['font'])}>
                  {(['wenkai', 'sans', 'serif'] as const).map((value) => <option key={value} value={value}>{tr(`fonts.${value}`)}</option>)}
                </select></Field>
                {slider('fontSize', 16, 36)}{slider('lineHeight', 1.3, 2.2, 0.1)}
                <Field label={tr('align')}><select className="lbSelect" value={design.align} onChange={(event) => patch('align', event.target.value as ImageDesign['align'])}>
                  <option value="left">{tr('left')}</option><option value="center">{tr('center')}</option>
                </select></Field>
              </section>
              <section><h2>{tr('quality')}</h2><Field label={tr('scale')}><select className="lbSelect" value={design.scale} onChange={(event) => patch('scale', Number(event.target.value))}>
                {[1, 2, 3].map((value) => <option key={value} value={value}>{value}×</option>)}
              </select></Field></section>
            </div>
            </div>
            <section>
              <Field label={tr('markdown')}><textarea className="lbInput imageDesignerSource" value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} /></Field>
              <button type="button" className="lbBtn" disabled={source === original} onClick={() => setSource(original)}><RotateCcw size={14} />{tr('restore')}</button>
            </section>
          </fieldset>
        </aside>
      </div>
    </div>
  )
}
