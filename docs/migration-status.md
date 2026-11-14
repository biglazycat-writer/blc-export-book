# 迁移核对记录

目标保持为完整迁移 desktop 排版导出能力到插件，不能仅凭独立插件构建通过就宣布完成。

## 已落实

- 从 desktop 物理复制排版工作台、长图设计器、EPUB/Word/HTML/Typst 渲染器及测试，项目间没有源码导入或链接。
- 源读取改为 SDK，单篇使用 `readDocument` 捕获一致的未保存 Markdown 快照；文件夹与图片按公开接口分块读取并校验进度/内容变更。
- WASM、常规/粗体中文、Emoji、等宽和文楷字体、KaTeX、PDF.js 预览资源由构建放入插件自身目录，使用相对于页面的 URL。
- 后台 SDK 已打包，导出大文件分块落盘，检查顺序、大小与调用页面；取消/不完整写入不会覆盖已有文件。
- 排版设置经插件工作区存储持久化，超过 64 KiB 的封面等数据分块写入；manifest 最后提交，完整读取校验 SHA-256。
- 嵌入画布直接读取工作区 `.canvas` 场景，保留形状、变换、图层、可见性、连线、标签、手绘和行内图标；思维导图读取 `.xmind` 原文件及原生图形布局，保留主题、彩虹线、图标和公式。二进制读取限定工作区会话与路径，分块检查文件版本。
- PNG 设计器正确转换 SDK 返回的文档 JSON，并在 HTML 预览前解析 Markdown `blc:node` 嵌入引用。导图 SVG 导出额外嵌入 KaTeX 样式和所用字体，避免重复显示 MathML。

## 验证证据

- `npm run build`：TypeScript 与 Vite 生产构建。
- `npm test`：后台分块落盘、迁移的内容/排版/格式测试与新增 SDK 读取、设置保存测试。
- `scripts/check-browser.mjs`：真实浏览器运行生产 UI、插件后台及宿主 browser bridge 固定副本；使用本地 `.canvas`、`.xmind`、相对图片、Mermaid、公式及表格，生成 7 份实际输出，验证文件签名、DOCX/EPUB 包结构、HTML 嵌入图形、PNG 内容与零外部请求。实际 PNG 已目视检查图形、公式和正文。
- `.vite/browser-check/result.json`、输出文件和截图为本地验证产物，不提交 Git。
- 真实 Typst 布局测试编译 WASM 并测量文本位置、行距、边界、代码与图标字体，不仅检查生成的源码。
- 插件：194 项 Vitest 测试和 6 项后台测试通过。
- 宿主实际 `plugin.Manager` 已从 `.tgz` 安装并启用插件，返回 `enabled: true`、`ready: true`，没有运行日志错误；尚不能等同于 Wails 页面和系统保存对话框验收。
- 桌面清理已应用到原仓库 `D:\biglazycat\desktop`。移除内置排版入口和模型安装设置，并将 PDF 编辑器仍需要的 PDFium/中文字体改为直接内置。原仓库 TypeScript/Vite 生产构建、Windows 生产程序编译和 115 项相关前端测试通过；Go `internal/localmodels`、`internal/plugin` 全套测试及主包 `TestPlugin*` / `TestLocalModel*` 通过。
- [桌面清理补丁](desktop-export-migration.patch) 涉及 101 个文件，均已落地；规范化 CRLF/LF 后与先前验证的源码副本逐文件一致。原有 15 个 mobile 改动文件的 SHA-256 保持一致。附 [文件清单](desktop-export-migration-files.json)。

## 完成前必须继续

1. 在真实客户端安装插件包，核对菜单、当前文章上下文、工作区切换、设置恢复、取消与保存。浏览器 RPC 测试不能替代此项。
2. 验证所支持平台的 WebView，特别是 PDF worker、公式/图片光栅化和系统文件对话框。

宿主桥接固定测试副本为 `tests/fixtures/host-browser.mjs`，来源 `desktop/internal/plugin/browser.mjs`。它只用于本地验收脚本，插件生产构建始终通过宿主注入的 SDK 连接。

原生窗口在当前自动执行环境中仍无法完成验收：既有独立 Wails 验收程序和本轮从原仓库构建的桌面程序均出现 WebView2 浏览器进程反复退出。测试程序使用独立数据目录及独立实例标识；已关闭失败的测试进程，现有桌面进程保持运行。普通终端启动入口为原仓库 `.cache/export-acceptance/start-native.ps1`，用于建立原生验收窗口，尚不能将编译通过或窗口启动尝试记为原生导出通过。
