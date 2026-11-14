import type { ComponentType } from 'react'
import { BookOpen, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FilePdfIcon } from '../../../components/FilePdfIcon'
import { nt } from '../nt'
import type { WorkExportFormat } from './types'

type FormatLabelKey = 'formats.epub' | 'formats.docx' | 'formats.pdf'

interface FormatOption {
  value: WorkExportFormat
  /** 标签与提示存 i18n 键，取词交给渲染方（模块常量会把语言冻结在加载那一刻）。 */
  labelKey: FormatLabelKey
  hintKey: `${FormatLabelKey}Hint`
  Icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}

// Only the three book formats. Folder and single-file Markdown are gone: the
// chapter-level export still offers them per chapter, and a collection flattened
// into one text file loses its structure.
export const FORMAT_OPTIONS: FormatOption[] = [
  { value: 'epub', labelKey: 'formats.epub', hintKey: 'formats.epubHint', Icon: BookOpen },
  { value: 'docx', labelKey: 'formats.docx', hintKey: 'formats.docxHint', Icon: FileText },
  { value: 'pdf', labelKey: 'formats.pdf', hintKey: 'formats.pdfHint', Icon: FilePdfIcon },
]

export function formatLabel(format: WorkExportFormat): string {
  const option = FORMAT_OPTIONS.find((item) => item.value === format)
  return option ? nt(option.labelKey) : nt('formats.epub')
}

export function WorkExportFormatCards({
  value,
  disabled,
  onChange,
}: {
  value: WorkExportFormat
  disabled?: boolean
  onChange: (format: WorkExportFormat) => void
}) {
  const { t } = useTranslation(['novels', 'common'])
  return (
    <div className="blcWorkFormatCards" role="group" aria-label={t('export.formatSection')}>
      {FORMAT_OPTIONS.map(({ value: format, labelKey, hintKey, Icon }) => (
        <button
          key={format}
          type="button"
          className={`blcWorkFormatCard${value === format ? ' is-active' : ''}`}
          aria-pressed={value === format}
          disabled={disabled}
          title={t(hintKey)}
          onClick={() => onChange(format)}
        >
          <Icon size={16} />
          <strong>{t(labelKey)}</strong>
          <span>{t(hintKey)}</span>
        </button>
      ))}
    </div>
  )
}
