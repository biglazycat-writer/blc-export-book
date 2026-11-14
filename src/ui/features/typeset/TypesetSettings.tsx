import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, FileImage, ImagePlus, RotateCcw, Trash2 } from 'lucide-react'
import type { ChapterSummary } from '../../types/models'
import { formatDisplayDate } from '../../lib/display-date'
import { applyChapterOrder } from '../novels/work-export/manuscript'
import type { ScopeTree } from '../novels/work-export/scope-tree'
import { WorkExportScopePicker } from '../novels/work-export/WorkExportScopePicker'
import { allChapterIds } from '../novels/work-export/scope-tree'
import {
  applyEpubPreset,
  EPUB_PRESET_IDS,
  EPUB_THEMES,
  MARGIN_PRESET_IDS,
  marginPresetId,
  type MarginPresetId,
} from '../novels/work-export/presets'
import type {
  DocxExportSettings,
  EpubExportSettings,
  EpubPresetId,
  PageBandSettings,
  PageFooterSettings,
  PdfExportSettings,
  WorkExportPaper,
  WorkExportSettings,
} from '../novels/work-export/types'

export type TypesetFormat = 'pdf' | 'docx' | 'epub' | 'html'

export interface TypesetSettingsProps {
  settings: WorkExportSettings
  mode: 'book' | 'chapter'
  format: TypesetFormat
  tree: ScopeTree | null
  chapters: ChapterSummary[]
  disabled?: boolean
  patch: (updater: (current: WorkExportSettings) => WorkExportSettings) => void
  onFormatChange: (format: TypesetFormat) => void
  onCoverFile: (file: File | undefined) => void
  onLogoFile: (file: File | undefined) => void
  onClearCover: () => void
  onClearLogo: () => void
}

const PAPER_LABELS: Record<WorkExportPaper, string> = {
  a5: 'A5 148×210',
  a4: 'A4 210×297',
  b5: 'B5 176×250',
  '16k': '16K 185×260',
}

const MARGIN_PRESET_LABELS: Record<MarginPresetId, string> = {
  compact: '紧凑',
  standard: '标准',
  loose: '宽松',
  binding: '装订',
}

/** Word 只记录字体名，最终显示效果取决于系统里装了什么。 */
const DOCX_BODY_FONTS = ['宋体', '黑体', '楷体', '微软雅黑'] as const

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="blcWorkField">
      <span>{label}</span>
      {children}
      {hint ? <em className="typesetFieldHint">{hint}</em> : null}
    </label>
  )
}

function Toggle({ checked, label, disabled, onChange }: {
  checked: boolean
  label: string
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="blcWorkToggle">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

function Select<T extends string>({ label, value, options, disabled, onChange }: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  disabled?: boolean
  onChange: (value: T) => void
}) {
  return (
    <Field label={label}>
      <select
        className="lbSelect"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </Field>
  )
}

function NumberField({ label, value, min, max, step = 1, disabled, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => { setDraft(String(value)) }, [value])
  const commit = () => {
    const parsed = Number(draft)
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value
    setDraft(String(next))
    if (next !== value) onChange(next)
  }
  return (
    <Field label={label}>
      <input
        className="lbInput"
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur() }}
      />
    </Field>
  )
}

function BandEditor({ band, kind, disabled, onChange }: {
  band: PageBandSettings | PageFooterSettings
  kind: 'header' | 'footer'
  disabled?: boolean
  onChange: (updater: (band: PageBandSettings) => PageBandSettings) => void
}) {
  const { t } = useTranslation('novels')
  const slot = (key: 'left' | 'center' | 'right', label: string) => (
    <Field label={label}>
      <input
        className="lbInput"
        value={band[key]}
        maxLength={120}
        disabled={disabled || !band.enabled}
        placeholder={key === 'center' ? '{title}' : ''}
        onChange={(event) => onChange((current) => ({ ...current, [key]: event.target.value }))}
      />
    </Field>
  )
  return (
    <div className="typesetBandEditor">
      <div className="typesetBandEnabled">
        <Toggle
          checked={band.enabled}
          disabled={disabled}
          label={kind === 'header' ? t('typeset.band.headerEnable') : t('typeset.band.footerEnable')}
          onChange={(checked) => onChange((current) => ({
            ...current,
            enabled: checked,
            separator: checked && current.separator === 'none' && kind === 'header' ? 'solid' : current.separator,
          }))}
        />
      </div>
      <div className="blcWorkGrid3">
        {slot('left', t('typeset.band.left'))}
        {slot('center', t('typeset.band.center'))}
        {slot('right', t('typeset.band.right'))}
      </div>
      <div className="typesetFieldHint typesetTokens">
        {t('typeset.band.tokens')}
      </div>
      <div className="blcWorkGrid2">
        <Select
          label={t('typeset.band.separator')}
          value={band.separator}
          disabled={disabled || !band.enabled}
          options={[
            { value: 'none', label: t('typeset.band.separatorNone') },
            { value: 'solid', label: t('typeset.band.separatorSolid') },
            { value: 'dashed', label: t('typeset.band.separatorDashed') },
            { value: 'double', label: t('typeset.band.separatorDouble') },
          ]}
          onChange={(value) => onChange((current) => ({ ...current, separator: value }))}
        />
      </div>
      <Toggle
        checked={band.hideOnFrontMatter}
        disabled={disabled || !band.enabled}
        label={t('typeset.band.hideOnFrontMatter')}
        onChange={(checked) => onChange((current) => ({ ...current, hideOnFrontMatter: checked }))}
      />
    </div>
  )
}

function PageNumberEditor({ footer, disabled, onChange }: {
  footer: PageFooterSettings
  disabled?: boolean
  onChange: (updater: (footer: PageFooterSettings) => PageFooterSettings) => void
}) {
  const { t } = useTranslation('novels')
  return (
    <section className="blcWorkSection">
      <div className="blcWorkSectionTitle">{t('typeset.layout.pageNumbers')}</div>
      <div className="blcWorkGrid2">
        <Select
          label={t('typeset.band.pageNumberPosition')}
          value={footer.pageNumberPosition}
          disabled={disabled || !footer.enabled}
          options={[
            { value: 'left', label: t('typeset.band.left') },
            { value: 'center', label: t('typeset.band.center') },
            { value: 'right', label: t('typeset.band.right') },
          ]}
          onChange={(value) => onChange((current) => ({ ...current, pageNumberPosition: value }))}
        />
        <Select
          label={t('typeset.band.pageNumberFormat')}
          value={footer.pageNumberFormat}
          disabled={disabled || !footer.enabled}
          options={[
            { value: 'x', label: '1' },
            { value: 'x-of-y', label: '1 / 128' },
            { value: 'page-x', label: '第 1 页' },
            { value: 'page-x-of-y', label: '第 1 页 / 共 128 页' },
          ]}
          onChange={(value) => onChange((current) => ({ ...current, pageNumberFormat: value }))}
        />
      </div>
      <p className="typesetFieldHint">{t('typeset.layout.pageNumberHint')}</p>
    </section>
  )
}

/** 「文章顺序」页：展示当前生效的导出顺序，并提供逐行上移/下移。 */
function ChapterOrderList({ chapters, order, disabled, patch }: {
  chapters: ChapterSummary[]
  order: string[]
  disabled?: boolean
  patch: (updater: (current: WorkExportSettings) => WorkExportSettings) => void
}) {
  const { t } = useTranslation('novels')
  const ordered = applyChapterOrder(chapters, order)
  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= ordered.length) return
    const ids = ordered.map((chapter) => chapter.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    patch((current) => ({
      ...current,
      content: { ...current.content, chapterOrder: ids },
    }))
  }
  const reset = () => patch((current) => ({
    ...current,
    content: { ...current.content, chapterOrder: [] },
  }))
  return (
    <section className="blcWorkSection">
      <div className="blcWorkSectionTitle">{t('typeset.order.title')}</div>
      <p className="typesetFieldHint">{t('typeset.order.hint')}</p>
      <ol className="typesetOrderList">
        {ordered.map((chapter, index) => (
          <li key={chapter.id} className="typesetOrderRow">
            <span className="typesetOrderIndex">{index + 1}</span>
            <span className="typesetOrderTitle" title={chapter.title}>
              {chapter.title.trim() || t('unnamed.chapter')}
            </span>
            <span className="typesetOrderDate">{formatDisplayDate(chapter.created_at)}</span>
            <span className="typesetOrderActions">
              <button
                type="button"
                disabled={disabled || index === 0}
                aria-label={t('typeset.order.moveUp')}
                title={t('typeset.order.moveUp')}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                disabled={disabled || index === ordered.length - 1}
                aria-label={t('typeset.order.moveDown')}
                title={t('typeset.order.moveDown')}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={13} />
              </button>
            </span>
          </li>
        ))}
      </ol>
      {order.length > 0 ? (
        <button type="button" className="typesetOrderReset" disabled={disabled} onClick={reset}>
          <RotateCcw size={12} /> {t('typeset.order.reset')}
        </button>
      ) : null}
    </section>
  )
}

export function TypesetSettings({
  settings,
  mode,
  format,
  tree,
  chapters,
  disabled,
  patch,
  onFormatChange,
  onCoverFile,
  onLogoFile,
  onClearCover,
  onClearLogo,
}: TypesetSettingsProps) {
  const { t } = useTranslation(['novels', 'common'])
  const coverRef = useRef<HTMLInputElement | null>(null)
  const logoRef = useRef<HTMLInputElement | null>(null)
  const pdfFonts = ['Noto Serif SC']

  const layoutTarget: 'pdf' | 'docx' = format === 'docx' ? 'docx' : 'pdf'
  const pdf = settings.pdf
  const docx = settings.docx
  const editingPdf = layoutTarget === 'pdf'
  const activeMarginPreset = editingPdf
    ? marginPresetId({ top: pdf.marginsMm.top, bottom: pdf.marginsMm.bottom, left: pdf.marginsMm.inside, right: pdf.marginsMm.outside })
    : marginPresetId(docx.marginsMm)
  const bandTarget = format === 'docx' ? docx : pdf

  const patchPdf = (updater: (value: PdfExportSettings) => PdfExportSettings) =>
    patch((current) => ({ ...current, pdf: updater(current.pdf) }))
  const patchDocx = (updater: (value: DocxExportSettings) => DocxExportSettings) =>
    patch((current) => ({ ...current, docx: updater(current.docx) }))
  const patchEpub = (updater: (value: EpubExportSettings) => EpubExportSettings) =>
    patch((current) => ({ ...current, epub: updater(current.epub) }))
  const patchCommon = (key: keyof WorkExportSettings['common'], value: string) =>
    patch((current) => ({ ...current, common: { ...current.common, [key]: value } }))
  const patchContent = (key: 'includeSynopsis' | 'includeVolumeTitles' | 'includeChapterSynopsis' | 'includeToc' | 'skipEmpty', value: boolean) =>
    patch((current) => ({ ...current, content: { ...current.content, [key]: value } }))
  const patchBand = (target: 'pdf' | 'docx', kind: 'header' | 'footer') =>
    (updater: (band: PageBandSettings) => PageBandSettings) => {
      if (target === 'pdf') {
        patchPdf((current) => ({
          ...current,
          [kind]: updater(current[kind]) as PageBandSettings,
        }))
      } else {
        patchDocx((current) => ({
          ...current,
          [kind]: updater(current[kind]) as PageBandSettings,
        }))
      }
    }

  const patchFooter = (updater: (footer: PageFooterSettings) => PageFooterSettings) =>
    patchBand(layoutTarget, 'footer')((band) => updater(band as PageFooterSettings))

  const applyMarginPreset = (preset: MarginPresetId) => {
    if (editingPdf) {
      patchPdf((current) => ({
        ...current,
        marginsMm: {
          top: presetMargins(preset).top,
          bottom: presetMargins(preset).bottom,
          inside: presetMargins(preset).left,
          outside: presetMargins(preset).right,
        },
      }))
    } else {
      patchDocx((current) => ({ ...current, marginsMm: presetMargins(preset) }))
    }
  }

  return (
    <aside className="typesetSettingsPane">
      <div className="typesetFormatBar">
        <div className="typesetFormatGrid">
          {(['pdf', 'docx', 'epub', 'html'] as TypesetFormat[]).map((value) => (
            <button
              key={value}
              type="button"
              className={`typesetFormatOption${format === value ? ' is-active' : ''}`}
              disabled={disabled}
              onClick={() => onFormatChange(value)}
            >
              <strong>{t(`typeset.formats.${value}`)}</strong>
              <span>{t(`typeset.formatHints.${value}`)}</span>
            </button>
          ))}
        </div>
        <Field label={t('export.filenameSection')}>
          <input
            className="lbInput"
            value={settings.common.filename}
            maxLength={120}
            disabled={disabled}
            onChange={(event) => patchCommon('filename', event.target.value)}
          />
        </Field>
      </div>

      <div className="typesetSettingsBody">
        <div className="typesetSettingsCol">
        {(
          <>
            {mode === 'book' ? (
              <section className="blcWorkSection">
                <div className="blcWorkSectionTitle">{t('typeset.cover.section')}</div>
                <div className="typesetCoverCard">
                  {settings.branding.coverDataUrl ? (
                    <img src={settings.branding.coverDataUrl} alt={t('typeset.cover.previewAlt')} />
                  ) : (
                    <div className="typesetCoverPlaceholder">
                      <FileImage size={22} />
                      <span>{t('typeset.cover.placeholder')}</span>
                    </div>
                  )}
                  <div className="typesetCoverActions">
                    <button type="button" className="lbBtn" disabled={disabled} onClick={() => coverRef.current?.click()}>
                      <ImagePlus size={14} /> {t('typeset.cover.choose')}
                    </button>
                    {settings.branding.coverDataUrl ? (
                      <button type="button" className="lbBtn" disabled={disabled} onClick={onClearCover}>
                        <Trash2 size={14} /> {t('typeset.cover.remove')}
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={coverRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={(event) => {
                      onCoverFile(event.currentTarget.files?.[0])
                      event.currentTarget.value = ''
                    }}
                  />
                  <Toggle
                    checked={pdf.includeCover}
                    disabled={disabled}
                    label={t('export.includeCover')}
                    onChange={(checked) => patch((current) => ({
                      ...current,
                      pdf: { ...current.pdf, includeCover: checked },
                      docx: { ...current.docx, includeCover: checked },
                      epub: { ...current.epub, includeCover: checked },
                    }))}
                  />
                  <p className="typesetFieldHint">{t('typeset.cover.hint')}</p>
                </div>
              </section>
            ) : null}

            <section className="blcWorkSection">
              <div className="blcWorkSectionTitle">{t('typeset.info.section')}</div>
              <Field label={t('export.titleLabel')}>
                <input
                  className="lbInput"
                  value={settings.common.title}
                  maxLength={120}
                  disabled={disabled}
                  onChange={(event) => patchCommon('title', event.target.value)}
                />
              </Field>
              <div className="blcWorkGrid2">
                <Field label={t('export.subtitleLabel')}>
                  <input
                    className="lbInput"
                    value={settings.common.subtitle}
                    maxLength={120}
                    disabled={disabled}
                    onChange={(event) => patchCommon('subtitle', event.target.value)}
                  />
                </Field>
                <Field label={t('export.authorLabel')}>
                  <input
                    className="lbInput"
                    value={settings.common.author}
                    maxLength={80}
                    disabled={disabled}
                    placeholder={t('export.optional')}
                    onChange={(event) => patchCommon('author', event.target.value)}
                  />
                </Field>
              </div>
              <div className="blcWorkGrid2">
                <Field label={t('export.publisherLabel')}>
                  <input
                    className="lbInput"
                    value={settings.common.publisher}
                    disabled={disabled}
                    placeholder={t('export.optional')}
                    onChange={(event) => patchCommon('publisher', event.target.value)}
                  />
                </Field>
                <Field label={t('export.publicationDateLabel')}>
                  <input
                    className="lbInput"
                    type="date"
                    value={settings.common.publicationDate}
                    disabled={disabled}
                    onChange={(event) => patchCommon('publicationDate', event.target.value)}
                  />
                </Field>
              </div>
              <Field label={t('export.descriptionLabel')}>
                <textarea
                  className="lbTextarea"
                  rows={4}
                  value={settings.common.description}
                  disabled={disabled}
                  onChange={(event) => patchCommon('description', event.target.value)}
                />
              </Field>
              {mode === 'book' ? (
                <div className="blcWorkGrid2">
                  <Field label="ISBN">
                    <input
                      className="lbInput"
                      value={settings.common.isbn}
                      disabled={disabled}
                      placeholder={t('export.isbnPlaceholder')}
                      onChange={(event) => patchCommon('isbn', event.target.value)}
                    />
                  </Field>
                  <Field label={t('export.rightsLabel')}>
                    <input
                      className="lbInput"
                      value={settings.common.rights}
                      disabled={disabled}
                      onChange={(event) => patchCommon('rights', event.target.value)}
                    />
                  </Field>
                </div>
              ) : null}
            </section>
          </>
        )}

        {(
          <>
            {mode === 'book' && tree ? (
              <section className="blcWorkSection">
                <div className="blcWorkSectionTitle">{t('export.scopeSection')}</div>
                <WorkExportScopePicker
                  tree={tree}
                  scopeType={settings.content.scopeType}
                  chapterIds={settings.content.chapterIds}
                  disabled={disabled}
                  onScopeTypeChange={(value) => patch((current) => ({
                    ...current,
                    content: {
                      ...current.content,
                      scopeType: value,
                      chapterIds: value === 'chapters' && current.content.chapterIds.length === 0
                        ? allChapterIds(tree)
                        : current.content.chapterIds,
                    },
                  }))}
                  onChapterIdsChange={(ids) => patch((current) => ({
                    ...current,
                    content: { ...current.content, chapterIds: ids },
                  }))}
                />
              </section>
            ) : null}

            {mode === 'book' ? (
              <section className="blcWorkSection">
                <div className="blcWorkSectionTitle">{t('typeset.content.structure')}</div>
                <Toggle
                  checked={settings.content.includeToc}
                  disabled={disabled}
                  label={t('export.includeToc')}
                  onChange={(checked) => patchContent('includeToc', checked)}
                />
                <Toggle
                  checked={settings.content.includeVolumeTitles}
                  disabled={disabled}
                  label={t('export.includeVolumeTitles')}
                  onChange={(checked) => patchContent('includeVolumeTitles', checked)}
                />
                <Toggle
                  checked={settings.content.includeSynopsis}
                  disabled={disabled}
                  label={t('export.synopsisPage')}
                  onChange={(checked) => patchContent('includeSynopsis', checked)}
                />
                <Toggle
                  checked={settings.content.includeChapterSynopsis}
                  disabled={disabled}
                  label={t('export.includeChapterSynopsis')}
                  onChange={(checked) => patchContent('includeChapterSynopsis', checked)}
                />
                <Toggle
                  checked={settings.content.skipEmpty}
                  disabled={disabled}
                  label={t('export.skipEmpty')}
                  onChange={(checked) => patchContent('skipEmpty', checked)}
                />
              </section>
            ) : (
              <p className="typesetFieldHint">{t('typeset.content.chapterHint')}</p>
            )}
          </>
        )}

        {mode === 'book' ? (
          <ChapterOrderList
            chapters={chapters}
            order={settings.content.chapterOrder}
            disabled={disabled}
            patch={patch}
          />
        ) : null}

        </div>
        <div className="typesetSettingsCol">
        {(
          format === 'epub' || format === 'html' ? (
            <>
              <section className="blcWorkSection">
                <div className="blcWorkSectionTitle">{t('typeset.layout.epub')}</div>
                <Select
                  label={t('export.presetLabel')}
                  value={settings.epub.preset}
                  disabled={disabled}
                  options={EPUB_PRESET_IDS.map((id) => ({
                    value: id,
                    label: t(EPUB_THEMES[id].labelKey),
                  }))}
                  onChange={(value) => patchEpub((current) => ({
                    ...applyEpubPreset(value as EpubPresetId),
                    chapterPageBreak: current.chapterPageBreak,
                    includeCover: current.includeCover,
                    includeSynopsisPage: current.includeSynopsisPage,
                  }))}
                />
                <p className="typesetFieldHint">{t(EPUB_THEMES[settings.epub.preset].descriptionKey)}</p>
                <Select
                  label={t('export.indentLabel')}
                  value={String(settings.epub.paragraphIndent)}
                  disabled={disabled}
                  options={[
                    { value: '0', label: t('export.indentNone') },
                    { value: '2', label: t('export.indent2Chars') },
                  ]}
                  onChange={(value) => patchEpub((current) => ({
                    ...current,
                    paragraphIndent: value === '2' ? 2 : 0,
                  }))}
                />
                <Toggle
                  checked={settings.epub.chapterPageBreak}
                  disabled={disabled}
                  label={t('export.chapterPageBreak')}
                  onChange={(checked) => patchEpub((current) => ({ ...current, chapterPageBreak: checked }))}
                />
                {mode === 'book' ? (
                  <>
                    <Toggle
                      checked={settings.epub.includeCover}
                      disabled={disabled}
                      label={t('export.includeCover')}
                      onChange={(checked) => patchEpub((current) => ({ ...current, includeCover: checked }))}
                    />
                    <Toggle
                      checked={settings.epub.includeSynopsisPage}
                      disabled={disabled}
                      label={t('export.synopsisPage')}
                      onChange={(checked) => patchEpub((current) => ({ ...current, includeSynopsisPage: checked }))}
                    />
                  </>
                ) : null}
                <p className="typesetFieldHint">{t('typeset.layout.previewNote')}</p>
              </section>
            </>
          ) : layoutTarget === 'pdf' ? (
            <>
              <section className="blcWorkSection">
                <div className="blcWorkSectionTitle">{t('typeset.layout.page')}</div>
                <div className="blcWorkGrid2">
                  <Select
                    label={t('export.presetLabel')}
                    value={settings.pdf.preset}
                    disabled={disabled}
                    options={[
                      { value: 'reading', label: t('pdfPresets.reading') },
                      { value: 'manuscript', label: t('pdfPresets.manuscript') },
                      { value: 'print', label: t('pdfPresets.print') },
                    ]}
                    onChange={(value) => patchPdf((current) => ({
                      ...current,
                      preset: value,
                      ...pdfPresetLayout(value),
                      header: current.header,
                      footer: current.footer,
                      watermark: current.watermark,
                      includeCover: current.includeCover,
                      includeTitlePage: current.includeTitlePage,
                      includeCopyright: current.includeCopyright,
                      includeToc: current.includeToc,
                      includeChapterSynopsis: current.includeChapterSynopsis,
                    }))}
                  />
                  <Select
                    label={t('export.paperLabel')}
                    value={settings.pdf.paper}
                    disabled={disabled}
                    options={(Object.keys(PAPER_LABELS) as WorkExportPaper[]).map((paper) => ({
                      value: paper,
                      label: paper === '16k' ? t('export.paper16k') : PAPER_LABELS[paper],
                    }))}
                    onChange={(value) => patchPdf((current) => ({ ...current, paper: value }))}
                  />
                  <Select
                    label={t('export.fontLabel')}
                    value={pdf.bodyFont || 'Noto Serif SC'}
                    disabled={disabled}
                    options={(pdfFonts.includes(pdf.bodyFont) ? pdfFonts : [pdf.bodyFont, ...pdfFonts])
                      .filter(Boolean)
                      .map((family) => ({ value: family, label: family }))}
                    onChange={(value) => patchPdf((current) => ({ ...current, bodyFont: value }))}
                  />
                </div>
                <div className="typesetPresetRow">
                  <span>{t('typeset.layout.marginPreset')}</span>
                  <div>
                    {MARGIN_PRESET_IDS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`typesetChip${activeMarginPreset === preset ? ' is-active' : ''}`}
                        disabled={disabled}
                        onClick={() => applyMarginPreset(preset)}
                      >
                        {MARGIN_PRESET_LABELS[preset]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="blcWorkGrid2">
                  <NumberField
                    label={t('export.marginTop')}
                    value={pdf.marginsMm.top}
                    min={6}
                    max={60}
                    disabled={disabled}
                    onChange={(value) => patchPdf((current) => ({ ...current, marginsMm: { ...current.marginsMm, top: value } }))}
                  />
                  <NumberField
                    label={t('export.marginBottom')}
                    value={pdf.marginsMm.bottom}
                    min={6}
                    max={60}
                    disabled={disabled}
                    onChange={(value) => patchPdf((current) => ({ ...current, marginsMm: { ...current.marginsMm, bottom: value } }))}
                  />
                  <NumberField
                    label={t('export.marginInside')}
                    value={pdf.marginsMm.inside}
                    min={6}
                    max={60}
                    disabled={disabled}
                    onChange={(value) => patchPdf((current) => ({ ...current, marginsMm: { ...current.marginsMm, inside: value } }))}
                  />
                  <NumberField
                    label={t('export.marginOutside')}
                    value={pdf.marginsMm.outside}
                    min={6}
                    max={60}
                    disabled={disabled}
                    onChange={(value) => patchPdf((current) => ({ ...current, marginsMm: { ...current.marginsMm, outside: value } }))}
                  />
                </div>
                <NumberField
                  label={t('export.gutter')}
                  value={pdf.gutterMm}
                  min={0}
                  max={20}
                  disabled={disabled}
                  onChange={(value) => patchPdf((current) => ({ ...current, gutterMm: value }))}
                />
              </section>

              <section className="blcWorkSection">
                <div className="blcWorkSectionTitle">{t('typeset.layout.typography')}</div>
                <div className="blcWorkGrid2">
                  <NumberField
                    label={t('export.fontSize')}
                    value={pdf.bodySizePt}
                    min={7}
                    max={20}
                    step={0.5}
                    disabled={disabled}
                    onChange={(value) => patchPdf((current) => ({ ...current, bodySizePt: value }))}
                  />
                  <NumberField
                    label={t('export.lineSpacing')}
                    value={pdf.lineSpacing}
                    min={1}
                    max={3}
                    step={0.05}
                    disabled={disabled}
                    onChange={(value) => patchPdf((current) => ({ ...current, lineSpacing: value }))}
                  />
                  <Select
                    label={t('export.indentLabel')}
                    value={String(pdf.firstLineIndentChars)}
                    disabled={disabled}
                    options={[
                      { value: '0', label: t('export.indentNone') },
                      { value: '2', label: t('export.indent2Chars') },
                    ]}
                    onChange={(value) => patchPdf((current) => ({ ...current, firstLineIndentChars: value === '2' ? 2 : 0 }))}
                  />
                  <Select
                    label={t('export.chapterStart')}
                    value={pdf.chapterStart}
                    disabled={disabled}
                    options={[
                      { value: 'next', label: t('export.chapterStartNext') },
                      { value: 'recto', label: t('export.chapterStartRecto') },
                    ]}
                    onChange={(value) => patchPdf((current) => ({ ...current, chapterStart: value }))}
                  />
                </div>
                <Toggle
                  checked={pdf.justify}
                  disabled={disabled}
                  label={t('export.justify')}
                  onChange={(checked) => patchPdf((current) => ({ ...current, justify: checked }))}
                />
              </section>

            </>
          ) : (
            <>
              <section className="blcWorkSection">
                <div className="blcWorkSectionTitle">{t('typeset.layout.page')}</div>
                <div className="blcWorkGrid2">
                  <Select
                    label={t('export.presetLabel')}
                    value={settings.docx.preset}
                    disabled={disabled}
                    options={[
                      { value: 'manuscript', label: t('docxPresets.manuscript') },
                      { value: 'publish', label: t('docxPresets.publish') },
                      { value: 'modern', label: t('docxPresets.modern') },
                    ]}
                    onChange={(value) => patchDocx((current) => ({
                      ...current,
                      preset: value,
                      ...docxPresetLayout(value),
                      header: current.header,
                      footer: current.footer,
                      includeCover: current.includeCover,
                      includeTitlePage: current.includeTitlePage,
                      includeCopyright: current.includeCopyright,
                      includeToc: current.includeToc,
                    }))}
                  />
                  <Select
                    label={t('export.paperLabel')}
                    value={settings.docx.paper}
                    disabled={disabled}
                    options={(Object.keys(PAPER_LABELS) as WorkExportPaper[]).map((paper) => ({
                      value: paper,
                      label: paper === '16k' ? t('export.paper16k') : PAPER_LABELS[paper],
                    }))}
                    onChange={(value) => patchDocx((current) => ({ ...current, paper: value }))}
                  />
                </div>
                <div className="typesetPresetRow">
                  <span>{t('typeset.layout.marginPreset')}</span>
                  <div>
                    {MARGIN_PRESET_IDS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`typesetChip${activeMarginPreset === preset ? ' is-active' : ''}`}
                        disabled={disabled}
                        onClick={() => applyMarginPreset(preset)}
                      >
                        {MARGIN_PRESET_LABELS[preset]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="blcWorkGrid2">
                  <NumberField
                    label={t('export.marginTop')}
                    value={docx.marginsMm.top}
                    min={6}
                    max={60}
                    disabled={disabled}
                    onChange={(value) => patchDocx((current) => ({ ...current, marginsMm: { ...current.marginsMm, top: value } }))}
                  />
                  <NumberField
                    label={t('export.marginBottom')}
                    value={docx.marginsMm.bottom}
                    min={6}
                    max={60}
                    disabled={disabled}
                    onChange={(value) => patchDocx((current) => ({ ...current, marginsMm: { ...current.marginsMm, bottom: value } }))}
                  />
                  <NumberField
                    label={t('export.marginLeft')}
                    value={docx.marginsMm.left}
                    min={6}
                    max={60}
                    disabled={disabled}
                    onChange={(value) => patchDocx((current) => ({ ...current, marginsMm: { ...current.marginsMm, left: value } }))}
                  />
                  <NumberField
                    label={t('export.marginRight')}
                    value={docx.marginsMm.right}
                    min={6}
                    max={60}
                    disabled={disabled}
                    onChange={(value) => patchDocx((current) => ({ ...current, marginsMm: { ...current.marginsMm, right: value } }))}
                  />
                </div>
              </section>

              <section className="blcWorkSection">
                <div className="blcWorkSectionTitle">{t('typeset.layout.typography')}</div>
                <Select
                  label={t('typeset.layout.bodyFont')}
                  value={docx.bodyFont}
                  disabled={disabled}
                  options={DOCX_BODY_FONTS.map((font) => ({ value: font, label: font }))}
                  onChange={(value) => patchDocx((current) => ({ ...current, bodyFont: value }))}
                />
                <NumberField
                  label={t('export.fontSize')}
                  value={docx.bodySizePt}
                  min={7}
                  max={20}
                  step={0.5}
                  disabled={disabled}
                  onChange={(value) => patchDocx((current) => ({ ...current, bodySizePt: value }))}
                />
                <NumberField
                  label={t('export.lineSpacing')}
                  value={docx.lineSpacing}
                  min={1}
                  max={3}
                  step={0.05}
                  disabled={disabled}
                  onChange={(value) => patchDocx((current) => ({ ...current, lineSpacing: value }))}
                />
                <Select
                  label={t('export.indentLabel')}
                  value={String(docx.firstLineIndentChars)}
                  disabled={disabled}
                  options={[
                    { value: '0', label: t('export.indentNone') },
                    { value: '2', label: t('export.indent2Chars') },
                  ]}
                  onChange={(value) => patchDocx((current) => ({ ...current, firstLineIndentChars: value === '2' ? 2 : 0 }))}
                />
                <Toggle
                  checked={docx.chapterPageBreak}
                  disabled={disabled}
                  label={t('export.chapterPageBreak')}
                  onChange={(checked) => patchDocx((current) => ({ ...current, chapterPageBreak: checked }))}
                />
              </section>

            </>
          )
        )}

        {(
          format === 'epub' || format === 'html' ? (
            <p className="typesetFieldHint">{t(format === 'html' ? 'typeset.band.htmlHint' : 'typeset.band.epubHint')}</p>
          ) : (
            <>
              <section className="blcWorkSection">
                <div className="blcWorkSectionTitle">{t('export.headerLabel')}</div>
                <BandEditor
                  band={bandTarget.header}
                  kind="header"
                  disabled={disabled}
                  onChange={patchBand(layoutTarget, 'header')}
                />
              </section>
              <section className="blcWorkSection">
                <div className="blcWorkSectionTitle">{t('export.footerLabel')}</div>
                <BandEditor
                  band={bandTarget.footer}
                  kind="footer"
                  disabled={disabled}
                  onChange={patchBand(layoutTarget, 'footer')}
                />
                <PageNumberEditor footer={bandTarget.footer} disabled={disabled} onChange={patchFooter} />
              </section>
              {layoutTarget === 'pdf' ? (
                <section className="blcWorkSection">
                  <div className="blcWorkSectionTitle">{t('typeset.branding.logo')}</div>
                  <div className="typesetLogoRow">
                    {settings.branding.logoDataUrl ? (
                      <img src={settings.branding.logoDataUrl} alt={t('typeset.branding.logo')} className="typesetLogoPreview" />
                    ) : (
                      <span className="typesetLogoEmpty">{t('typeset.branding.logoEmpty')}</span>
                    )}
                    <button type="button" className="lbBtn" disabled={disabled} onClick={() => logoRef.current?.click()}>
                      <ImagePlus size={14} /> {t('typeset.branding.logoChoose')}
                    </button>
                    {settings.branding.logoDataUrl ? (
                      <button type="button" className="lbBtn" disabled={disabled} onClick={onClearLogo}>
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={logoRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={(event) => {
                      onLogoFile(event.currentTarget.files?.[0])
                      event.currentTarget.value = ''
                    }}
                  />
                  <NumberField
                    label={t('typeset.branding.logoHeight')}
                    value={settings.branding.logoHeightMm}
                    min={4}
                    max={20}
                    step={0.5}
                    disabled={disabled || !settings.branding.logoDataUrl}
                    onChange={(value) => patch((current) => ({
                      ...current,
                      branding: { ...current.branding, logoHeightMm: value },
                    }))}
                  />
                </section>
              ) : null}
            </>
          )
        )}

        {format === 'pdf' ? (
          <Field label={t('export.watermarkLabel')}>
            <input
              className="lbInput"
              value={settings.pdf.watermark}
              disabled={disabled}
              placeholder={t('export.watermarkPlaceholder')}
              onChange={(event) => patchPdf((current) => ({ ...current, watermark: event.target.value }))}
            />
          </Field>
        ) : null}
        </div>
      </div>
    </aside>
  )
}

function presetMargins(preset: MarginPresetId) {
  if (preset === 'compact') return { top: 10, bottom: 10, left: 10, right: 10 }
  if (preset === 'loose') return { top: 25, bottom: 25, left: 20, right: 20 }
  if (preset === 'binding') return { top: 20, bottom: 20, left: 25, right: 15 }
  return { top: 20, bottom: 20, left: 15, right: 15 }
}

function pdfPresetLayout(preset: PdfExportSettings['preset']) {
  if (preset === 'manuscript') {
    return { paper: 'a4' as WorkExportPaper, marginsMm: { top: 25, bottom: 25, inside: 25, outside: 25 }, gutterMm: 0, bodySizePt: 12, lineSpacing: 1.5, firstLineIndentChars: 2 as const, justify: true, chapterStart: 'next' as const }
  }
  if (preset === 'print') {
    return { paper: '16k' as WorkExportPaper, marginsMm: { top: 20, bottom: 20, inside: 22, outside: 18 }, gutterMm: 5, bodySizePt: 10.5, lineSpacing: 1.75, firstLineIndentChars: 2 as const, justify: true, chapterStart: 'recto' as const }
  }
  return { paper: 'a5' as WorkExportPaper, marginsMm: { top: 18, bottom: 18, inside: 20, outside: 16 }, gutterMm: 0, bodySizePt: 10.5, lineSpacing: 1.7, firstLineIndentChars: 2 as const, justify: true, chapterStart: 'next' as const }
}

function docxPresetLayout(preset: DocxExportSettings['preset']) {
  if (preset === 'publish') {
    return { paper: 'b5' as WorkExportPaper, marginsMm: { top: 22, bottom: 20, left: 22, right: 18 }, bodySizePt: 10.5, lineSpacing: 1.75, firstLineIndentChars: 2 as const }
  }
  if (preset === 'modern') {
    return { paper: 'a4' as WorkExportPaper, marginsMm: { top: 22, bottom: 22, left: 22, right: 22 }, bodySizePt: 11, lineSpacing: 1.5, firstLineIndentChars: 0 as const }
  }
  return { paper: 'a4' as WorkExportPaper, marginsMm: { top: 25, bottom: 25, left: 25, right: 25 }, bodySizePt: 12, lineSpacing: 1.5, firstLineIndentChars: 2 as const }
}
