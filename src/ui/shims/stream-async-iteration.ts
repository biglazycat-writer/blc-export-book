/**
 * `for await (const chunk of readableStream)` on WebKit.
 *
 * Async iteration of a ReadableStream is part of the streams standard and Chromium
 * ships it, but WebKit does not — and Wails renders in WebKitGTK on Linux and in
 * WKWebView on macOS, so those two platforms reach it. PDF.js 6 uses the syntax
 * inside `PDFPageProxy.getTextContent`, which is what the reader's text layer, its
 * page index and every AI citation are built on; without this shim all three fail
 * there with "undefined is not a function (near '...value of readableStream...')"
 * while the same build works on Windows.
 *
 * The iterator follows the WHATWG definition of `ReadableStream.prototype.values`:
 * the reader's lock is released when the stream ends or throws, and a loop left
 * early (`break`, `return`, an exception) cancels the stream unless the caller
 * asked otherwise. Code written against the standard therefore behaves the same
 * whether it got the engine's implementation or this one.
 */

/** Just enough of a global scope to patch, so the shim can be tested directly. */
export type StreamScope = { ReadableStream?: { prototype: object } }

type StreamReader = {
  read: () => Promise<{ done: boolean; value?: unknown }>
  releaseLock: () => void
  cancel: (reason?: unknown) => Promise<void>
}

/**
 * Adds the missing async iterator, once. Returns whether it installed anything, so
 * a caller can tell "patched WebKit" from "engine already supports it" — every
 * other engine is left completely untouched.
 */
export function installStreamAsyncIteration(scope: StreamScope = globalThis): boolean {
  const constructor = scope.ReadableStream
  if (constructor === undefined) return false
  const prototype = constructor.prototype as Record<string | symbol, unknown>
  if (Symbol.asyncIterator in prototype) return false

  function values(this: { getReader: () => StreamReader }, options?: { preventCancel?: boolean }) {
    const preventCancel = options?.preventCancel === true
    const reader = this.getReader()
    const iterator = {
      async next(): Promise<{ done: boolean; value?: unknown }> {
        try {
          const result = await reader.read()
          // The lock outlives the last chunk otherwise, and a second pass over the
          // same stream would then fail with a lock error instead of ending.
          if (result.done) reader.releaseLock()
          return result
        } catch (error) {
          reader.releaseLock()
          throw error
        }
      },
      async return(value?: unknown): Promise<{ done: boolean; value?: unknown }> {
        if (preventCancel) {
          reader.releaseLock()
        } else {
          const cancelled = reader.cancel(value)
          reader.releaseLock()
          await cancelled
        }
        return { done: true, value }
      },
      [Symbol.asyncIterator]() {
        return iterator
      },
    }
    return iterator
  }

  // Writable and configurable, matching the engine's own accessors, so a later
  // polyfill or a devtools override can still replace them.
  const descriptor = { value: values, writable: true, configurable: true, enumerable: false }
  if (!('values' in prototype)) Object.defineProperty(prototype, 'values', descriptor)
  Object.defineProperty(prototype, Symbol.asyncIterator, descriptor)
  return true
}
