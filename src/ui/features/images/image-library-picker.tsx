import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Check, Image as ImageIcon, Loader2, Search, X } from 'lucide-react'
import { exportApi, type ImageLibraryItem } from '../../bridge/export-api'
import { imagePreview, type ImagePreview } from './image-preview'
import './image-picker.css'

type PickerProps = {
  open: boolean
  onClose: () => void
  onPick: (pick: { asset: ImageLibraryItem; dataUrl: string }) => void
}

type PreviewState = { image?: ImagePreview; error?: string }
type Selection = { asset: ImageLibraryItem; preview: ImagePreview }

/** 工作区素材库选图弹窗：列表、搜索、分页加载，缩略图在桥接层读取。 */
export function ImageLibraryPicker({ open, ...props }: PickerProps) {
  return open ? createPortal(<ImagePickerDialog {...props} />, document.body) : null
}

function ImagePickerDialog({ onClose, onPick }: Omit<PickerProps, 'open'>) {
  const { t } = useTranslation('novels')
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const mounted = useRef(true)
  const previewCache = useRef<Record<string, PreviewState>>({})
  const [items, setItems] = useState<ImageLibraryItem[]>([])
  const [total, setTotal] = useState(0)
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({})
  const [selection, setSelection] = useState<Selection>()
  const [search, setSearch] = useState('')
  const [request, setRequest] = useState({ query: '', offset: 0 })
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [listError, setListError] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    mounted.current = true
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.current?.querySelector<HTMLInputElement>('input[type=search]')?.focus()
    return () => {
      mounted.current = false
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setRequest((current) => current.query === search.trim() ? current : { query: search.trim(), offset: 0 }), 250)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let active = true
    setLoading(true)
    setListError('')
    if (!request.offset) { setItems([]); setTotal(0) }
    exportApi.listImageAssets(request.query, request.offset, 12).then((page) => {
      if (!active) return
      setItems((current) => request.offset ? [...current, ...page.items] : page.items)
      setTotal(page.total)
    }).catch((cause) => { if (active) setListError(String(cause)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request])

  useEffect(() => {
    let active = true
    let next = 0
    const pending = items.filter((item) => !previewCache.current[item.id])
    // 限制并发读取，画廊批量加载时不占满页面桥接。
    const worker = async () => {
      while (active && next < pending.length) {
        const item = pending[next++]
        let result: PreviewState
        try {
          result = { image: await imagePreview(await exportApi.readImageAsDataURL(item.src)) }
        } catch (cause) {
          result = { error: String(cause) }
        }
        if (!active) return
        previewCache.current[item.id] = result
        setPreviews((current) => ({ ...current, [item.id]: result }))
      }
    }
    void Promise.all(Array.from({ length: Math.min(3, pending.length) }, worker))
    return () => { active = false }
  }, [items])

  const apply = async () => {
    if (!selection || applying) return
    setApplying(true)
    setError('')
    try {
      const dataUrl = await exportApi.readImageAsDataURL(selection.asset.src)
      if (!mounted.current) return
      // 素材库允许的格式比封面宽（如 GIF），在弹窗里直接拦下并给出提示。
      if (!/^data:image\/(png|jpeg|webp)[;,]/i.test(dataUrl)) {
        setError(t('typeset.errors.coverTypeUnsupported'))
        return
      }
      onPick({ asset: selection.asset, dataUrl })
      onClose()
    } catch (cause) {
      if (mounted.current) setError(String(cause))
    } finally {
      if (mounted.current) setApplying(false)
    }
  }

  return (
    <div
      className="lbModalOverlay coverPickerBackdrop"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !applying) onClose() }}
    >
      <div
        ref={dialog}
        className="lbModal gallery coverPickerDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!applying) onClose() }
          if (event.key === 'Tab') {
            const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')]
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
          }
        }}
      >
        <header className="lbModalHeader">
          <div>
            <h2 className="lbModalTitle" id={titleId}>{t('typeset.libraryPicker.title')}</h2>
            <p>{t('typeset.libraryPicker.subtitle')}</p>
          </div>
          <button type="button" className="lbModalClose" aria-label={t('typeset.libraryPicker.closeAria')} disabled={applying} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="lbModalBody coverPickerBody">
          <div className="coverPickerToolbar">
            <label className="coverPickerSearch">
              <Search size={16} />
              <input
                type="search"
                aria-label={t('typeset.libraryPicker.searchAria')}
                placeholder={t('typeset.libraryPicker.searchPlaceholder')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
          <div className="coverPickerContent">
            <section className="coverPickerLibrary" aria-label={t('typeset.libraryPicker.libraryTitle')}>
              <header>
                <h3>{t('typeset.libraryPicker.libraryTitle')}</h3>
                <small>{loading ? t('typeset.libraryPicker.loading') : t('typeset.libraryPicker.totalCount', { count: total })}</small>
              </header>
              {listError ? (
                <div className="coverPickerError" role="alert">
                  {listError}
                  <button type="button" className="lbBtn" onClick={() => setRequest({ ...request })}>{t('typeset.libraryPicker.retry')}</button>
                </div>
              ) : null}
              {!items.length && !loading && !listError ? (
                <div className="coverPickerEmpty">
                  <ImageIcon size={32} />
                  <strong>{request.query ? t('typeset.libraryPicker.emptySearch') : t('typeset.libraryPicker.empty')}</strong>
                </div>
              ) : null}
              <div className="coverPickerGrid">
                {items.map((item) => {
                  const preview = previews[item.id]
                  const selected = selection?.asset.id === item.id
                  return (
                    <button
                      type="button"
                      className={`coverPickerCard${selected ? ' selected' : ''}`}
                      aria-label={t('typeset.libraryPicker.previewAria', { name: item.name })}
                      aria-pressed={selected}
                      key={item.id}
                      disabled={applying || !preview?.image}
                      title={preview?.error || item.name}
                      onClick={() => {
                        setError('')
                        if (preview?.image) setSelection({ asset: item, preview: preview.image })
                      }}
                    >
                      <span className="coverPickerThumb">
                        {preview?.image ? <img src={preview.image.url} alt={item.name} />
                          : preview?.error ? <span><ImageIcon size={24} />{t('typeset.libraryPicker.readFailed')}</span>
                          : <Loader2 size={20} className="coverPickerSpin" />}
                        {selected ? <i><Check size={14} /></i> : null}
                      </span>
                      <span className="coverPickerName">{item.name}</span>
                      <small>{preview?.image ? `${preview.image.width} × ${preview.image.height}`
                        : preview?.error ? t('typeset.libraryPicker.readFailed')
                        : t('typeset.libraryPicker.loadingPreview')}</small>
                    </button>
                  )
                })}
              </div>
              {loading ? <p className="coverPickerLoading" role="status"><Loader2 size={16} className="coverPickerSpin" />{t('typeset.libraryPicker.loading')}</p> : null}
              {items.length < total ? (
                <button
                  type="button"
                  className="lbBtn coverPickerMore"
                  disabled={loading || applying}
                  onClick={() => setRequest({ query: request.query, offset: items.length })}
                >
                  {t('typeset.libraryPicker.loadMore')}
                </button>
              ) : null}
            </section>
            <aside className="coverPickerPreview" aria-label={t('typeset.libraryPicker.selectedTitle')}>
              <h3>{t('typeset.libraryPicker.selectedTitle')}</h3>
              {selection ? (
                <>
                  <div className="coverPickerSelectedImage">
                    <img src={selection.preview.url} alt={t('typeset.libraryPicker.selectedAlt', { name: selection.asset.name })} />
                  </div>
                  <strong title={selection.asset.name}>{selection.asset.name}</strong>
                  <span>{selection.preview.width} × {selection.preview.height}</span>
                  <small>{t('typeset.libraryPicker.sourceLibrary')}</small>
                </>
              ) : (
                <div className="coverPickerEmpty">
                  <ImageIcon size={32} />
                  <span>{t('typeset.libraryPicker.previewEmpty')}</span>
                </div>
              )}
            </aside>
          </div>
          {error ? <p className="coverPickerError" role="alert">{error}</p> : null}
        </div>
        <footer className="lbModalFooter coverPickerFooter">
          <span>{t('typeset.libraryPicker.footerHint')}</span>
          <div>
            <button type="button" className="lbBtn" disabled={applying} onClick={onClose}>{t('typeset.libraryPicker.cancel')}</button>
            <button type="button" className="lbBtn primary" disabled={!selection || applying} onClick={() => void apply()}>
              {applying ? <Loader2 size={14} className="coverPickerSpin" /> : null}
              {t('typeset.libraryPicker.useImage')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
