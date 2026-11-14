import i18next from 'i18next'

/**
 * 纯 ts 模块的 novels 命名空间取词助手（组件里请用 useTranslation）。
 *
 * 直接 `import i18n from '../../i18n'` 会在模块加载时初始化 i18next，初始化要碰
 * `document`，node 环境的逻辑测试会整个挂掉。i18next 的全局实例正是应用初始化的
 * 那一个：浏览器里它必然已就绪，这里直接取词即可；在未初始化的环境（纯逻辑测试）
 * 退回键名，保证 import 永远安全、行为可预期。
 */
export function nt(key: string, options?: Record<string, unknown>): string {
  if (!i18next.isInitialized) return key
  // 键名在调用点才知道，绕开 i18next 对字面量键的类型收窄。
  const translate = i18next.t as (key: string, options?: Record<string, unknown>) => string | null
  return translate(key, { ns: 'novels', ...options }) ?? key
}
