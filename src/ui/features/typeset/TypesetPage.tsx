import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Download, Image, Loader2, RefreshCw } from 'lucide-react'
import { exportApi } from '../../bridge/export-api'
import { loadPersistedSettings, savePersistedSettings } from '../../bridge/persistent-settings'
import { getSDK, getSession } from '../../bridge/sdk'
import { openAppPage } from '../../lib/app-navigation'
import i18n from '../../i18n'
import { saveExportBlob } from '../../lib/save-export'
import { normalizeWorkspaceKind } from '../../lib/work-types'
import type { ChapterSummary, Volume, WorkExportManuscript } from '../../types/models'
import { prepareCoverAsset, type ImageProfile } from '../novels/work-export/assets'
import {
  createDefaultWorkExportSettings,
  paperSizeMm,
  todayISODate,
  validateWorkExportSettings,
} from '../novels/work-export/presets'
import { isCancelError } from '../novels/work-export/progress'
import {
  loadWorkExportBook,
  prepareWorkExportAssets,
  rebuildWorkBook,
  renderWorkExportBlob,
  renderWorkExportPdfBytes,
  workExportFilename,
  type LoadedWorkExportBook,
} from '../novels/work-export/run-export'
import { buildScopeTree, summarizeSelection } from '../novels/work-export/scope-tree'
import {
  filterStaleChapterSelection,
} from '../novels/work-export/settings'
import type {
  BookAssetTarget,
  BookAssets,
  ExportAsset,
  WorkBookModel,
  WorkExportProgressReporter,
  WorkExportSettings,
} from '../novels/work-export/types'
import { previewPdfSettings } from './preview-settings'
import { TypesetPreview, type PreviewPaper } from './TypesetPreview'
import { TypesetSettings, type TypesetFormat } from './TypesetSettings'
import '../writing/modals/modal.css'
import '../novels/work-export/work-export.css'
import './typeset.css'

interface TypesetPageProps {
  novelId?: string
  chapterId?: string
  folderPath?: string
  title?: string
  /** 主窗口里标签被切走时暂停预览编译；独立窗口不传，默认常驻。 */
  active?: boolean
}

type Banner = { kind: 'error' | 'notice'; text: string } | null

const ImageDesigner = lazy(() => import('../image-designer/ImageDesigner').then((module) => ({ default: module.ImageDesigner })))

export function TypesetPage(props: TypesetPageProps) {
  const { t } = useTranslation('novels')
  const [imageChapter, setImageChapter] = useState<string | null>(null)
  if (props.chapterId && imageChapter === props.chapterId) {
    return <Suspense fallback={<div className="typesetEmptyPane">{t('imageDesigner.preparing')}</div>}>
      <ImageDesigner key={props.chapterId} chapterId={props.chapterId} onBack={() => setImageChapter(null)} />
    </Suspense>
  }
  return <DocumentTypesetPage {...props} onImageDesign={props.chapterId ? () => setImageChapter(props.chapterId!) : undefined} />
}

const PREVIEW_DELAY_MS = 700
const COVER_MAX_BYTES = 12 * 1024 * 1024
const LOGO_MAX_BYTES = 6 * 1024 * 1024
const IMAGE_TYPES = /^image\/(png|jpeg|webp)$/i

function storageKey(novelId: string, chapterId?: string): string {
  return chapterId ? `${novelId}::${chapterId}` : novelId
}

function scopeKey(settings: WorkExportSettings): string {
  if (settings.content.scopeType === 'chapters') {
    return `chapters:${[...settings.content.chapterIds].sort().join(',')}`
  }
  return 'all'
}

function chapterModeSettings(settings: WorkExportSettings, chapterId: string): WorkExportSettings {
  return {
    ...settings,
    content: {
      ...settings.content,
      scopeType: 'chapters',
      chapterIds: [chapterId],
      includeSynopsis: false,
      includeVolumeTitles: false,
      includeToc: false,
    },
    pdf: {
      ...settings.pdf,
      includeCover: false,
      includeTitlePage: false,
      includeCopyright: false,
      includeToc: false,
    },
    docx: {
      ...settings.docx,
      includeCover: false,
      includeTitlePage: false,
      includeCopyright: false,
      includeToc: false,
    },
    epub: {
      ...settings.epub,
      includeCover: false,
      includeSynopsisPage: false,
    },
  }
}

function coverEnabled(settings: WorkExportSettings, target: BookAssetTarget): boolean {
  if (target === 'docx') return settings.docx.includeCover
  if (target === 'epub' || target === 'html') return settings.epub.includeCover
  return settings.pdf.includeCover
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error(i18n.t('typeset.errors.coverReadFailed', { ns: 'novels' })))
    reader.readAsDataURL(file)
  })
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function DocumentTypesetPage({ novelId, chapterId: requestedChapterId, folderPath, title, active = true, onImageDesign }: TypesetPageProps & { onImageDesign?: () => void }) {
  const { t } = useTranslation(['novels', 'common'])
  const [source, setSource] = useState<WorkExportManuscript | null>(null)
  const chapterId = requestedChapterId || (folderPath === undefined && source?.workspace_kind === 'standalone' ? source.chapters[0]?.id : undefined)
  const hasSource = Boolean(novelId || requestedChapterId || folderPath !== undefined)
  const [volumes, setVolumes] = useState<Volume[]>([])
  const [chapters, setChapters] = useState<ChapterSummary[]>([])
  const [settings, setSettings] = useState<WorkExportSettings>(() =>
    createDefaultWorkExportSettings({ title: title || '' }),
  )
  const [format, setFormat] = useState<TypesetFormat>('pdf')
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewStage, setPreviewStage] = useState('')
  const [previewError, setPreviewError] = useState('')

  const [exporting, setExporting] = useState(false)
  const [canCancel, setCanCancel] = useState(true)
  const [exportPercent, setExportPercent] = useState(0)
  const [exportMessage, setExportMessage] = useState('')
  const [banner, setBanner] = useState<Banner>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const formatRef = useRef(format)
  formatRef.current = format
  const readyRef = useRef(false)
  readyRef.current = ready
  const storageKeyRef = useRef('')
  const sourceTitleRef = useRef('')
  const loadedRef = useRef<{ key: string; value: LoadedWorkExportBook } | null>(null)
  const loadPromiseRef = useRef<{ key: string; promise: Promise<LoadedWorkExportBook> } | null>(null)
  const assetsRef = useRef(new Map<string, BookAssets>())
  const imageCacheRef = useRef(new Map<string, ExportAsset>())
  const previewSeqRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const mode: 'book' | 'chapter' = chapterId ? 'chapter' : 'book'
  const tree = useMemo(() => buildScopeTree(volumes, chapters), [volumes, chapters])
  // The rulers and the paper label describe exactly the sheet the preview renders.
  const previewPaper = useMemo<PreviewPaper>(() => {
    const pdf = previewPdfSettings(settings, format)
    const size = paperSizeMm(pdf.paper)
    return {
      name: pdf.paper === '16k' ? '16K' : pdf.paper.toUpperCase(),
      widthMm: size.width,
      heightMm: size.height,
      marginsMm: {
        top: pdf.marginsMm.top,
        bottom: pdf.marginsMm.bottom,
        left: pdf.marginsMm.inside,
        right: pdf.marginsMm.outside,
      },
    }
  }, [settings, format])

  const patch = useCallback((updater: (current: WorkExportSettings) => WorkExportSettings) => {
    setSettings((current) => updater(current))
  }, [])

  const persist = useCallback((value: WorkExportSettings) => {
    if (!storageKeyRef.current) return
    void savePersistedSettings(storageKeyRef.current, value).then(async () => {
      if (settingsRef.current === value) await getSDK().setState(getSession().state || {}, false)
    }).catch(error => setBanner({ kind: 'error', text: `保存排版设置失败：${errorText(error)}` }))
  }, [])

  // Flush the last settings when the workspace tab closes; the debounce below
  // would otherwise be cancelled before it ever writes.
  useEffect(() => () => {
    if (readyRef.current && storageKeyRef.current) {
      void savePersistedSettings(storageKeyRef.current, settingsRef.current).catch(() => {})
    }
  }, [])

  useEffect(() => {
    let alive = true
    if (readyRef.current && storageKeyRef.current) {
      void savePersistedSettings(storageKeyRef.current, settingsRef.current).catch(() => {})
    }
    setReady(false)
    setLoadError('')
    setBanner(null)
    setWarnings([])
    setPreviewBytes(null)
    setPreviewError('')
    setPreviewBusy(false)
    loadedRef.current = null
    loadPromiseRef.current = null
    assetsRef.current.clear()
    imageCacheRef.current.clear()
    previewSeqRef.current += 1

    if (!hasSource) {
      setLoadError(t('typeset.errors.noNovel'))
      return () => { alive = false }
    }

    void exportApi.loadWorkExportManuscript(novelId || '', {
      type: requestedChapterId ? 'chapters' : 'all',
      chapter_ids: requestedChapterId ? [requestedChapterId] : undefined,
      folder_path: folderPath,
    })
      .then(async (manuscript) => {
        if (!alive) return
        setSource(manuscript)
        const volumeList: Volume[] = manuscript.volumes.map(volume => ({
          id: volume.path, parent_id: volume.parent_path, novel_id: manuscript.novel_id,
          title: volume.title, synopsis: '', created_at: '', updated_at: '',
        }))
        const chapterList: ChapterSummary[] = manuscript.chapters.map(chapter => ({
          ...chapter, novel_id: manuscript.novel_id, status: '',
        }))
        setVolumes(volumeList)
        setChapters(chapterList)

        const singleId = requestedChapterId || (folderPath === undefined && normalizeWorkspaceKind(manuscript.workspace_kind) === 'standalone' ? chapterList[0]?.id : undefined)
        const chapter = singleId ? chapterList.find((item) => item.id === singleId) : undefined
        const isChapter = Boolean(singleId)
        const defaults = {
          title: isChapter
            ? chapter?.title || title || i18n.t('unnamed.chapter', { ns: 'novels' })
            : manuscript.title || i18n.t('unnamed.content', { ns: 'novels' }),
          synopsis: isChapter ? chapter?.synopsis || '' : manuscript.synopsis || '',
          author: '',
          standalone: isChapter,
          today: todayISODate(),
        }
        const key = folderPath !== undefined ? `folder:${folderPath}` : storageKey(novelId || '', singleId)
        let next = await loadPersistedSettings(key, defaults)
        if (!alive) return
        next = isChapter
          ? chapterModeSettings(next, singleId as string)
          : filterStaleChapterSelection(next, chapterList.map((item) => item.id))

        storageKeyRef.current = key
        sourceTitleRef.current = defaults.title
        settingsRef.current = next
        formatRef.current = next.lastFormat
        setSettings(next)
        setFormat(next.lastFormat)
        setReady(true)
      })
      .catch((error: unknown) => {
        if (alive) setLoadError(errorText(error))
      })

    return () => { alive = false }
    // title is only a fallback for the first load; renaming the tab must not reset edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novelId, requestedChapterId, folderPath, reloadToken])

  // Persist edits after the user stops typing; the page has no explicit save button.
  useEffect(() => {
    return getSDK().onSave(async () => {
      if (readyRef.current && storageKeyRef.current) await savePersistedSettings(storageKeyRef.current, settingsRef.current)
      await getSDK().setState(getSession().state || {}, false)
    })
  }, [])

  useEffect(() => {
    if (!ready || !storageKeyRef.current) return
    void getSDK().setState(getSession().state || {}, true).catch(error => setBanner({ kind: 'error', text: errorText(error) }))
    const timer = window.setTimeout(() => persist(settingsRef.current), 600)
    return () => window.clearTimeout(timer)
  }, [settings, ready, persist])

  const ensureBook = useCallback(async (snapshot: WorkExportSettings): Promise<LoadedWorkExportBook> => {
    if (!source) throw new Error(t('typeset.errors.noNovel'))
    const key = `${folderPath ?? novelId}|${scopeKey(snapshot)}`
    if (loadedRef.current?.key === key) return loadedRef.current.value
    if (loadPromiseRef.current?.key === key) return loadPromiseRef.current.promise
    let promise: Promise<LoadedWorkExportBook>
    promise = loadWorkExportBook({ novelId: novelId || '', manuscript: source, settings: snapshot })
      .then((value) => {
        loadedRef.current = { key, value }
        return value
      })
      .finally(() => {
        if (loadPromiseRef.current?.promise === promise) loadPromiseRef.current = null
      })
    loadPromiseRef.current = { key, promise }
    return promise
  }, [novelId, folderPath, source, t])

  const ensureAssets = useCallback(async (
    snapshot: WorkExportSettings,
    target: BookAssetTarget,
    report?: WorkExportProgressReporter,
    imageProfile: ImageProfile = 'full',
  ): Promise<{ book: WorkBookModel; assets: BookAssets }> => {
    const loaded = await ensureBook(snapshot)
    const book = rebuildWorkBook(loaded, snapshot)
    const scope = `${novelId}|${scopeKey(snapshot)}`
    const key = `${scope}|${target}|${imageProfile}`
    const cached = assetsRef.current.get(key)
    if (cached) return { book, assets: cached }
    const assets = await prepareWorkExportAssets({ book, target, imageProfile, report })
    // Keep only the current scope: the preview and the export use different image
    // profiles, and a stale chapter selection must not pin the pictures it read.
    for (const cachedKey of assetsRef.current.keys()) {
      if (!cachedKey.startsWith(`${scope}|`)) assetsRef.current.delete(cachedKey)
    }
    assetsRef.current.set(key, assets)
    return { book, assets }
  }, [ensureBook, novelId])

  const resolveCover = useCallback(async (
    snapshot: WorkExportSettings,
    target: BookAssetTarget,
    imageProfile: ImageProfile = 'full',
  ): Promise<ExportAsset | null> => {
    const url = snapshot.branding.coverDataUrl
    if (!url || !coverEnabled(snapshot, target)) return null
    const key = `cover|${target}|${imageProfile}|${url}`
    const cached = imageCacheRef.current.get(key)
    if (cached) return cached
    const asset = await prepareCoverAsset(url, target, 'cover', imageProfile)
    imageCacheRef.current.set(key, asset)
    return asset
  }, [])

  const resolveLogo = useCallback(async (
    snapshot: WorkExportSettings,
    target: BookAssetTarget,
    imageProfile: ImageProfile = 'full',
  ): Promise<{ asset: ExportAsset; heightMm: number } | null> => {
    if (target === 'epub' || target === 'html') return null
    const url = snapshot.branding.logoDataUrl
    if (!url) return null
    const key = `logo|${target}|${imageProfile}|${url}`
    let asset = imageCacheRef.current.get(key)
    if (!asset) {
      asset = await prepareCoverAsset(url, target, 'logo', imageProfile)
      imageCacheRef.current.set(key, asset)
    }
    return { asset, heightMm: snapshot.branding.logoHeightMm }
  }, [])

  useEffect(() => {
    if (exporting) {
      // Keep the last rendered page on screen while exporting, and clear the
      // busy flag: the export's own progress belongs to the header, not to the
      // preview placeholder.
      setPreviewBusy(false)
      return
    }
    if (!ready || !active || !hasSource) return
    const timer = window.setTimeout(() => {
      const seq = previewSeqRef.current + 1
      previewSeqRef.current = seq
      const snapshot = settingsRef.current
      const targetFormat = formatRef.current
      const previewSettings: WorkExportSettings = {
        ...snapshot,
        pdf: previewPdfSettings(snapshot, targetFormat),
      }
      setPreviewBusy(true)
      setPreviewError('')
      setPreviewStage(t('typeset.preview.typesetting'))
      void (async () => {
        try {
          const { book, assets } = await ensureAssets(previewSettings, 'pdf', (update) => {
            if (previewSeqRef.current === seq) setPreviewStage(update.message)
          }, 'preview')
          const [cover, logo] = await Promise.all([
            resolveCover(previewSettings, 'pdf', 'preview'),
            resolveLogo(previewSettings, 'pdf', 'preview'),
          ])
          const bytes = await renderWorkExportPdfBytes({
            book,
            settings: previewSettings,
            assets,
            cover,
            logo,
            format: 'pdf',
            report: (update) => {
              if (previewSeqRef.current === seq) setPreviewStage(update.message)
            },
          })
          if (previewSeqRef.current !== seq) return
          setPreviewBytes(bytes)
          setPreviewError('')
        } catch (error) {
          if (previewSeqRef.current === seq) setPreviewError(errorText(error))
        } finally {
          if (previewSeqRef.current === seq) setPreviewBusy(false)
        }
      })()
    }, PREVIEW_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      // 让已经在编译的旧预览失效，别让它在新设置之后把旧版面画回来。
      previewSeqRef.current += 1
    }
  }, [settings, format, ready, active, novelId, exporting, ensureAssets, resolveCover, resolveLogo, t])

  useEffect(() => () => {
    abortRef.current?.abort()
  }, [])

  const handleFormatChange = (next: TypesetFormat) => {
    setFormat(next)
    formatRef.current = next
    setSettings((current) => ({ ...current, lastFormat: next }))
  }

  const handleCoverFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    if (!IMAGE_TYPES.test(file.type)) {
      setBanner({ kind: 'error', text: t('typeset.errors.coverTypeUnsupported') })
      return
    }
    if (file.size > COVER_MAX_BYTES) {
      setBanner({ kind: 'error', text: t('typeset.errors.coverTooLarge') })
      return
    }
    try {
      const dataUrl = await readImageFile(file)
      setSettings((current) => ({
        ...current,
        branding: { ...current.branding, coverDataUrl: dataUrl, coverName: file.name },
      }))
      setBanner(null)
    } catch (error) {
      setBanner({ kind: 'error', text: errorText(error) })
    }
  }, [t])

  const handleLogoFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    if (!IMAGE_TYPES.test(file.type)) {
      setBanner({ kind: 'error', text: t('typeset.errors.logoTypeUnsupported') })
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      setBanner({ kind: 'error', text: t('typeset.errors.logoTooLarge') })
      return
    }
    try {
      const dataUrl = await readImageFile(file)
      setSettings((current) => ({
        ...current,
        branding: { ...current.branding, logoDataUrl: dataUrl },
      }))
      setBanner(null)
    } catch (error) {
      setBanner({ kind: 'error', text: errorText(error) })
    }
  }, [t])

  const handleExport = async () => {
    if (!ready || exporting || !hasSource) return
    const snapshot = settingsRef.current
    const target = formatRef.current
    const selection = summarizeSelection(
      tree,
      new Set(snapshot.content.chapterIds),
      snapshot.content.scopeType,
    )
    const chapterCount = mode === 'chapter'
      ? (chapters.some((chapter) => chapter.id === chapterId) ? 1 : 0)
      : selection.chapterCount
    const validation = validateWorkExportSettings(snapshot.common, chapterCount)
    const blocked = Object.values(validation.errors)[0]
    if (blocked) {
      setBanner({ kind: 'error', text: blocked })
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setExporting(true)
    setCanCancel(true)
    setBanner(null)
    setWarnings([])
    setExportPercent(0)
    setExportMessage(t('typeset.export.preparing'))
    const report: WorkExportProgressReporter = (update) => {
      setExportPercent(update.percent)
      setExportMessage(update.message)
      // Compiling and saving cannot be interrupted.
      setCanCancel(update.stage !== 'compile' && update.stage !== 'save')
    }

    try {
      const { book, assets } = await ensureAssets(snapshot, target, report)
      const collectedWarnings = assets.warnings
      const [cover, logo] = await Promise.all([
        resolveCover(snapshot, target),
        resolveLogo(snapshot, target),
      ])
      const blob = await renderWorkExportBlob({
        book,
        settings: snapshot,
        assets,
        cover,
        logo,
        format: target,
        signal: controller.signal,
        report,
      })
      const filename = workExportFilename(snapshot, target)

      setCanCancel(false)
      setExportPercent(99)
      setExportMessage(t('export.waitingSave'))
      const saved = await saveExportBlob(blob, filename)
      if (saved.cancelled) {
        setBanner({ kind: 'notice', text: t('export.saveCancelled') })
      } else {
        persist(snapshot)
        setWarnings(collectedWarnings)
        setBanner({
          kind: 'notice',
          text: saved.path
            ? t('typeset.export.savedTo', { path: saved.path })
            : t('typeset.export.done'),
        })
      }
    } catch (error) {
      if (isCancelError(error) || controller.signal.aborted) {
        setBanner({ kind: 'notice', text: t('export.cancelled') })
      } else {
        setBanner({ kind: 'error', text: errorText(error) })
      }
    } finally {
      abortRef.current = null
      setExporting(false)
      setCanCancel(true)
      setExportMessage('')
      setExportPercent(0)
    }
  }

  const handleCancel = () => {
    if (canCancel) abortRef.current?.abort()
  }

  if (!hasSource) {
    return (
      <div className="typesetShell">
        <div className="typesetEmptyPane">{loadError || t('typeset.errors.noNovel')}</div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="typesetShell">
        <div className="typesetEmptyPane">
          {loadError ? (
            <>
              <p>{loadError}</p>
              <button type="button" className="lbBtn" onClick={() => setReloadToken((value) => value + 1)}>
                <RefreshCw size={14} /> {t('typeset.errors.retry')}
              </button>
            </>
          ) : (
            <>
              <Loader2 size={18} className="typesetSpinner" />
              <span>{t('typeset.loading')}</span>
            </>
          )}
        </div>
      </div>
    )
  }

  const heading = mode === 'chapter'
    ? settings.common.title.trim() || title || ''
    : source?.title || settings.common.title
  const selection = summarizeSelection(
    tree,
    new Set(settings.content.chapterIds),
    settings.content.scopeType,
  )
  const chapterWords = chapters.find((chapter) => chapter.id === chapterId)?.word_count || 0
  const selectionLabel = mode === 'chapter'
    ? t('typeset.chapterScoped', { value: chapterWords.toLocaleString() })
    : t('export.selectedChapters', {
        value: selection.chapterCount,
        words: selection.wordCount.toLocaleString(),
      })
  const formatName = t(`typeset.formats.${format}`)

  return (
    <div className="typesetShell">
      <header className="typesetHeader">
        <div className="typesetHeading">
          <div className="typesetHeadingLine">
            <button
              type="button"
              className="typesetBack"
              onClick={() => openAppPage('novels', {
                novelId: novelId || source?.novel_id,
                chapterId,
                folderPath,
                title: heading,
              })}
            >
              <ArrowLeft size={15} />
              {t('typeset.back')}
            </button>
            <span className={`typesetBadge${mode === 'chapter' ? ' is-chapter' : ''}`}>
              {mode === 'chapter' ? t('typeset.badge.chapter') : t('typeset.badge.book')}
            </span>
            <h1 title={heading}>{heading}</h1>
          </div>
          <span className="typesetMeta">{selectionLabel}</span>
        </div>
        <div className="typesetHeaderActions">
          {onImageDesign ? <button type="button" className="lbBtn" disabled={exporting} onClick={onImageDesign}>
            <Image size={14} />{t('imageDesigner.entry')}
          </button> : null}
          {banner ? (
            <span className={`typesetBanner is-${banner.kind}`} role="status">{banner.text}</span>
          ) : null}
          {exporting ? (
            <>
              <span className="typesetExportProgress">
                <span className="typesetMiniProgress">
                  <i style={{ width: `${exportPercent}%` }} />
                </span>
                <span>{exportMessage || t('export.exportingProgress')}</span>
              </span>
              <button type="button" className="lbBtn" onClick={handleCancel} disabled={!canCancel}>
                {t('typeset.export.cancel')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="lbBtn primary"
              disabled={!ready}
              onClick={() => void handleExport()}
            >
              <Download size={14} />
              {t('typeset.export.action', { format: formatName })}
            </button>
          )}
        </div>
      </header>

      {warnings.length > 0 ? (
        <div className="typesetWarnings">
          {warnings.slice(0, 3).map((warning, index) => (
            <div key={`${warning}-${index}`}>{warning}</div>
          ))}
        </div>
      ) : null}

      <div className="typesetMain">
        <TypesetPreview
          bytes={previewBytes}
          busy={previewBusy}
          stage={previewStage}
          error={previewError}
          paper={previewPaper}
        />
        <TypesetSettings
          settings={settings}
          mode={mode}
          format={format}
          tree={tree}
          chapters={chapters}
          disabled={exporting}
          patch={patch}
          onFormatChange={handleFormatChange}
          onCoverFile={handleCoverFile}
          onLogoFile={handleLogoFile}
          onClearCover={() => patch((current) => ({
            ...current,
            branding: { ...current.branding, coverDataUrl: '', coverName: '' },
          }))}
          onClearLogo={() => patch((current) => ({
            ...current,
            branding: { ...current.branding, logoDataUrl: '' },
          }))}
        />
      </div>
    </div>
  )
}
