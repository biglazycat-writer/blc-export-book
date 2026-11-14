/**
 * The global `Iterator` constructor (ES2025 iterator helpers) on WebKit.
 *
 * Chromium and recent Safari expose it, but the WKWebView shipped with macOS
 * 15.3 does not. pdfjs-dist 6.2 runs `Iterator.prototype.join = ...` at module
 * evaluation time, so the first import of the PDF reader / typeset preview dies
 * with `ReferenceError: Can't find variable: Iterator`. The failed lazy chunk
 * takes the whole React tree down and the window goes white.
 *
 * Install the missing global as the real intrinsic %IteratorPrototype% rather
 * than a stand-in object: PDF.js then patches the prototype that every built-in
 * iterator already inherits from, so its `values().join("")` calls keep working
 * too. Engines that already have `Iterator` are left untouched.
 *
 * This module is also copied verbatim to `public/pdfjs/iterator.mjs` for the
 * PDF.js worker by scripts/copy-pdfjs-assets.mjs. Keep it plain JavaScript:
 * no TypeScript syntax, no imports.
 */
export function installIteratorGlobal(scope = globalThis) {
  if ('Iterator' in scope) return false
  const iteratorPrototype = Object.getPrototypeOf(
    Object.getPrototypeOf([][Symbol.iterator]()),
  )
  function Iterator() {}
  Iterator.prototype = iteratorPrototype
  Object.defineProperty(scope, 'Iterator', {
    value: Iterator,
    writable: true,
    configurable: true,
  })
  return true
}

installIteratorGlobal()
