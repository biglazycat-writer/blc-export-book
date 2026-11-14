import '../test-i18n'
import { describe, expect, it } from 'vitest'
import { exportFileName, sanitizeExportName, utf8ByteLength } from './file-name'

describe('sanitizeExportName', () => {
  it('replaces Windows-illegal characters and trims edge dots', () => {
    expect(sanitizeExportName('  a/b:c*d?e"f<g>h|i  ')).toBe('a_b_c_d_e_f_g_h_i')
    expect(sanitizeExportName('...标题...')).toBe('标题')
  })

  it('suffixes reserved device names', () => {
    expect(sanitizeExportName('CON')).toBe('CON_')
    expect(sanitizeExportName('com1')).toBe('com1_')
    expect(sanitizeExportName('console')).toBe('console')
  })

  it('strips an old extension before adding the new one', () => {
    expect(exportFileName('旧书.md', 'epub')).toBe('旧书.epub')
    expect(exportFileName('旧书.PDF', 'docx')).toBe('旧书.docx')
    expect(exportFileName('旧书.docx', 'html')).toBe('旧书.html')
    expect(exportFileName('旧书.HTML', 'pdf')).toBe('旧书.pdf')
  })

  it('falls back when the title is empty', () => {
    expect(sanitizeExportName('   ', '内容合集导出')).toBe('内容合集导出')
    expect(exportFileName('', 'pdf')).toBe('内容导出.pdf')
  })

  it('truncates by UTF-8 bytes, not code units', () => {
    const name = sanitizeExportName('猫'.repeat(80))
    expect(utf8ByteLength(name)).toBeLessThanOrEqual(120)
    expect(name.length).toBe(40)
  })

  it('never ends with a space or dot after truncation', () => {
    expect(sanitizeExportName('书名.')).toBe('书名')
  })
})
