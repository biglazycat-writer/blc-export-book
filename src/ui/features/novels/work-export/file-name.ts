import type { WorkExportFormat } from './types'
import { nt } from '../nt'

const EXTENSIONS: Record<WorkExportFormat, string> = {
  epub: 'epub',
  docx: 'docx',
  pdf: 'pdf',
  html: 'html',
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i
const MAX_BYTES = 120

export function exportExtension(format: WorkExportFormat): string {
  return EXTENSIONS[format]
}

export function stripExportExtension(name: string): string {
  return String(name || '').replace(/\.(epub|docx|pdf|html|md|markdown|txt)$/i, '')
}

/** UTF-8 byte length, because NTFS rejects names over 255 bytes and the app caps lower. */
export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

function truncateUtf8(value: string, maxBytes: number): string {
  let out = ''
  let bytes = 0
  for (const char of value) {
    const size = utf8ByteLength(char)
    if (bytes + size > maxBytes) break
    out += char
    bytes += size
  }
  return out
}

/**
 * A file name stem safe on Windows and readable everywhere.
 *
 * Dots and spaces at either end are stripped because Windows silently drops
 * them, which would make the saved path differ from the one we report back.
 */
export function sanitizeExportName(title: string, fallback = nt('export.fallbackFilename')): string {
  let name = stripExportExtension(title)
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  name = name.replace(/^[.\s]+|[.\s]+$/g, '')
  if (!name) name = fallback
  if (WINDOWS_RESERVED.test(name)) name = `${name}_`
  name = truncateUtf8(name, MAX_BYTES)
  name = name.replace(/[.\s]+$/g, '')
  if (!name) name = fallback
  return name
}

export function exportFileName(title: string, format: WorkExportFormat, fallback = nt('export.fallbackFilename')): string {
  return `${sanitizeExportName(title, fallback)}.${exportExtension(format)}`
}
