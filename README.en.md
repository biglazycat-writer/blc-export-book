# Typesetting Export for 大懒猫创作平台

Standalone migration of the desktop typesetting workspace and image designer.

- Articles: PDF, editable Word (`.docx`), standalone HTML, PNG, and EPUB.
- Books from workspace folders: EPUB, PDF, Word, and HTML, with chapter selection and ordering.
- Bundled Typst WASM, Chinese/emoji/monospace fonts, WenKai, math and Mermaid rendering, and PDF.js preview assets.
- Live article snapshots include unsaved changes. Folder exports read saved files.
- Articles are captured before opening the typesetting page. Each invocation captures a fresh draft; page reloads keep that snapshot after the source editor closes.
- “排版导出” is declared in the SDK `resource` context menu for local creation folders and the workspace root. It opens the chosen folder, or the containing folder of a chosen file. The command palette and plugin center open a picker with separate actions to browse a folder and select it for book export, including its subfolders.
- Files stream through bounded SDK messages to a temporary file before final replacement. Settings and cover images persist in plugin workspace storage.

Requires desktop 0.4.5+, plugin API 1 revision 3, and the host-supported Node 22 runtime.

```sh
npm ci
npm run build
npm test
node scripts/check-browser.mjs
npm run package
```

Install the resulting `dist-package/blc-export-book-0.1.2.tgz` as a prebuilt plugin without rebuilding. Runtime dependencies are bundled; no `node_modules` or font/WASM downloads are required at runtime. Remote article images still need to be accessible.

The browser verifier runs production assets and the bundled backend against a local RPC test host, checks seven actual exported files, and records external requests. Outputs live in `.vite/browser-check/`. Set `BLC_BROWSER` to a Chrome/Edge executable. In restricted test environments, `BLC_BROWSER_SINGLE_PROCESS=1` confines Chromium to one test process; it does not change the plugin runtime.

Editable canvases and mind maps render from workspace `.canvas` and `.xmind` files, including layout, connectors, themes, icons and formulas. Missing or invalid resources stop the export. Desktop built-in typesetting exports and their dedicated model-installation settings have been removed. Installation through the actual host plugin manager passes; native Wails menus, system save dialogs, and cross-platform WebView acceptance remain pending. The current automated execution environment repeatedly loses the WebView2 browser process. See [migration status](docs/migration-status.md).
