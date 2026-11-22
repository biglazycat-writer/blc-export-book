export function connect() {
  const config = globalThis.__biglazycatPlugin;
  if (!config || config.apiVersion !== 1) throw new Error('API_MISMATCH: 请在大懒猫写作的插件页面中运行');
  let sequence = 0, pendingCalls = 0;
  async function call(method, params = {}) {
    if (pendingCalls >= 32) throw Object.assign(new Error('页面请求队列已满'), { code: 'BACKPRESSURE' });
    pendingCalls++;
    try {
    const id = `v${++sequence}`;
    const response = await fetch(config.endpoint, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', 'X-Plugin-Session': config.token }, body: JSON.stringify({ v: 1, id, method, params }), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Object.assign(new Error(`页面请求被拒绝 (${response.status})`), { code: response.status === 413 ? 'MESSAGE_TOO_LARGE' : response.status === 429 ? 'BACKPRESSURE' : 'DISCONNECTED' });
    const reply = await response.json();
    if (reply.v !== 1 || reply.id !== id) throw new Error('RPC identity mismatch');
    if (reply.error) throw Object.assign(new Error(reply.error.message), { code: reply.error.code });
    return reply.result;
    } finally { pendingCalls--; }
  }
  let saveHandler, lastSave = '', polling = false, localDirty = false;
  let colorScheme = config.colorScheme === 'dark' ? 'dark' : 'light';
  const appearanceListeners = new Set();
  const applyAppearance = mode => {
    if (mode !== 'light' && mode !== 'dark') return;
    const changed = colorScheme !== mode;
    colorScheme = mode;
    document.documentElement.setAttribute('data-color-scheme', mode);
    document.documentElement.style.setProperty('color-scheme', mode);
    if (changed) for (const listener of appearanceListeners) {
      try { listener(mode); } catch (error) { console.error(error); }
    }
  };
  let stateWrites = Promise.resolve();
  let writingState = false, queuedState;
  const writeState = async batch => {
    writingState = true;
    try { batch.resolve(await call('view.state', batch.snapshot)); }
    catch (error) { batch.reject(error); }
    finally {
      writingState = false;
      const next = queuedState; queuedState = undefined;
      if (next) void writeState(next);
    }
  };
  const poll = async () => {
    if (polling) return; polling = true;
    try {
      const view = await call('view.context');
      applyAppearance(view.colorScheme);
      for (const [key, value] of Object.entries(view.theme ?? {})) document.documentElement.style.setProperty(key, value);
      if (view.saveRequest && view.saveRequest !== lastSave) {
        lastSave = view.saveRequest;
        let failure = '';
        try { if (saveHandler) await saveHandler(); else if (localDirty || view.dirty) throw new Error('页面没有注册 onSave 处理器，请在页面中保存'); }
        catch (e) { failure = String(e.message ?? e); }
        try { await stateWrites; } catch (e) { failure ||= String(e.message ?? e); }
        await call('view.saved', { id: lastSave, error: failure });
      }
    } catch { /* The shell owns connection errors and reload. */ }
    finally { polling = false; }
  };
  const timer = setInterval(poll, 500); void poll();
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
  return Object.freeze({
    apiVersion: 1, apiRevision: 3,
    appearance: {
      getColorScheme: () => colorScheme,
      onDidChangeColorScheme: listener => {
        if (typeof listener !== 'function') throw new TypeError('Expected a color scheme listener');
        appearanceListeners.add(listener);
        return () => appearanceListeners.delete(listener);
      },
    },
    ready: () => call('view.ready'),
    onSave: handler => { if (typeof handler !== 'function') throw new TypeError('onSave requires a function'); saveHandler = handler; return () => { if (saveHandler === handler) saveHandler = undefined; }; },
    context: () => call('view.context'),
    setState: (state, dirty = false) => {
      // At most one HTTP write and one latest snapshot are retained. Calls
      // coalesced into that snapshot share its acknowledgement and failure.
      const snapshot = JSON.parse(JSON.stringify({ state, dirty }));
      if (new TextEncoder().encode(JSON.stringify(snapshot.state)).length > 64 * 1024) return Promise.reject(Object.assign(new Error('恢复状态超过 64 KiB'), { code: 'STATE_TOO_LARGE' }));
      localDirty = dirty;
      if (queuedState) { queuedState.snapshot = snapshot; return queuedState.promise; }
      const batch = { snapshot };
      batch.promise = new Promise((resolve, reject) => { batch.resolve = resolve; batch.reject = reject; });
      stateWrites = batch.promise;
      // The save handshake observes failures even when callers don't await.
      void batch.promise.catch(() => {});
      if (writingState) queuedState = batch; else void writeState(batch);
      return batch.promise;
    },
    commands: { invoke: (command, args = {}) => call('commands.invoke', { command, args }) },
    tasks: { list: () => call('tasks.list'), get: id => call('tasks.get', { id }), cancel: id => call('tasks.cancel', { id }) },
    views: { open: (view, options = {}) => call('views.open', { view, ...options }) },
    workspace: { list: () => call('workspace.list'), resources: request => call('resources.list', request), read: request => call('resources.read', request), search: request => call('resources.search', request), import: request => call('resources.import', request) },
    documents: { snapshot: request => call('documents.snapshot', request), export: request => call('documents.export', request), apply: change => call('documents.apply', change), operation: operationId => call('documents.operation', { operationId }) },
    images: { list: request => call('resources.images', request ?? {}), read: request => call('resources.image', request) },
    storage: { get: (key, workspaceId) => call('storage.get', { key, workspaceId }), set: (key, value, workspaceId) => call('storage.set', { key, value, workspaceId }) },
    ui: { notify: message => call('ui.notify', { message }), openFile: options => call('ui.openFile', options), saveFile: options => call('ui.saveFile', options), openExternal: url => call('ui.openExternal', { url }), openDocument: target => call('ui.openDocument', target) },
  });
}
