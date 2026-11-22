# Typeset Export (blc-export-book)

A BigLazyCat Writer plugin that turns a single article or a whole folder into print-ready, shareable documents.

| Target | Formats |
| --- | --- |
| Single article | PDF, Word `.docx`, HTML, PNG, EPUB |
| Book from a folder | EPUB, PDF, Word `.docx`, HTML |

Requires BigLazyCat Writer **0.4.5 or newer** (plugin API 1, revision 3).

## Highlights

- **Typesetting settings**: paper, font size, line spacing, margins, headers and footers, page numbers, cover and table of contents — stored in the plugin's workspace storage;
- **Image designer**: long images, poster ratios, four layouts and LXGW WenKai color themes;
- **Canvas & mind maps**: rendered from the original `.canvas` / `.xmind` files, keeping layout, connectors, icons and formulas;
- **Offline bundle**: the Typst engine and all fonts ship with the plugin — nothing is downloaded at runtime;
- **Reliable large-file saves**: streamed to a temporary file in chunks and swapped in only after the write completes.

## Install & use

1. Import the `.tgz` from GitHub Releases via "Plugin center → Install plugin → Plugin package"; no dependency setup or build required;
2. **Article export**: open 「排版导出」 (Typeset Export) from the article editor. The export captures unsaved changes as they are; to pick up later edits, reopen it from the article;
3. **Book export**: right-click a folder (or the workspace root) in the creation area and choose 「排版导出」; opening from a file uses its containing folder;
4. The save location comes from the system save dialog.

Chapter selection and ordering live in the typesetting workbench; folder exports include saved articles from subfolders. When opened from the command palette or the plugin center, you can browse first and pick a folder with "选择此文件夹制作书籍" (choose this folder).

## Development

```sh
npm ci              # install dependencies (SDK locked as a vendor artifact)
npm run build       # typecheck + build
npm test            # backend integration tests + UI unit tests
npm run package     # produces dist-package/blc-export-book-<version>.tgz plus SHA-256
```

- The build reads only this repository and its locked dependencies; it never references desktop sources;
- `scripts/check-browser.mjs` drives the production build end-to-end with a local Chrome (set `BLC_BROWSER` to choose the browser); output lands in `.vite/browser-check/`;
- Releases: push a `v*` tag and GitHub Actions builds, tests, packages and publishes the Release.

## Known limitations

- Word font rendering depends on the reading app; PDFs embed the typesetting fonts;
- Native Wails menu entries and cross-platform WebView acceptance are still in progress — see [docs/migration-status.md](docs/migration-status.md).

## Choosing feature locations

Open plugin details in BigLazyCat Writer to choose where each declared feature appears. This plugin defines its features and supported locations in `contributes.features`; users choose among those locations. See the SDK [feature reference](https://github.com/biglazycat-writer/blc-plugin-sdk/blob/main/FEATURES.md) for the declaration format.
