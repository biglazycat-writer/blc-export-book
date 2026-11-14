/**
 * 创作条目的时间显示（移动端 features/works/display-date.ts 的同源拷贝，两份各自维护）。
 *
 * 规则（zh-CN）：
 * - 今天编辑过的 → 「上午 08:00」（时段 + 时:分）
 * - 今年改过的   → 「9月12日」
 * - 更早的       → 「2024年12月3日」
 * 英文界面（en-*）输出对应英文写法："8:00 AM" / "Sep 12" / "Dec 3, 2024"。
 *
 * 纯函数：`now` 由调用方注入，单测不依赖真实时钟；语言取 i18next 当前语言，
 * 可用 `locale` 参数显式覆盖以便测试。解析失败返回空串，调用方不渲染这一栏。
 */
import i18next from 'i18next'

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDisplayDate(value: string, now: Date = new Date(), locale?: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const english = (locale ?? i18next.language ?? '').startsWith('en')

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (sameDay) {
    const hour = date.getHours()
    const minute = String(date.getMinutes()).padStart(2, '0')
    const hour12 = hour % 12 === 0 ? 12 : hour % 12
    if (english) {
      const meridiem = hour < 12 ? 'AM' : 'PM'
      return `${hour12}:${minute} ${meridiem}`
    }
    const meridiem = hour < 12 ? '上午' : '下午'
    return `${meridiem} ${String(hour12).padStart(2, '0')}:${minute}`
  }

  const month = date.getMonth() + 1
  const day = date.getDate()
  if (english) {
    const monthEn = EN_MONTHS[date.getMonth()]
    if (date.getFullYear() === now.getFullYear()) return `${monthEn} ${day}`
    return `${monthEn} ${day}, ${date.getFullYear()}`
  }
  if (date.getFullYear() === now.getFullYear()) return `${month}月${day}日`
  return `${date.getFullYear()}年${month}月${day}日`
}
