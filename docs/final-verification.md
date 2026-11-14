# 迁移验收记录

更新日期：2026-11-14。桌面清理已落地；原生窗口验收尚未完成。

## 最终安装包

- 路径：`dist-package/blc-export-book-0.1.0.tgz`。
- 大小：58,980,597 字节；399 个归档条目，7 个后台命令。
- SHA-256：`d82b70b8121fcefaca4fd393f9b27daf94ed4d046ccc587712f4f68ab4bd4f83`。
- 独立解包验证通过：后台不依赖本地 node_modules，字体、Typst WASM、PDF.js 和图片设计资源齐全。
- 使用本轮修改后的原仓库 `D:\biglazycat\desktop` 的实际 `plugin.Manager` 安装该包，得到 `enabled=true`、`ready=true`，日志为空。证据：原仓库 `.cache/export-acceptance/install/result.json`。

本记录在包校验完成后生成，打包脚本明确排除本文件。安装包的校验文件位于包旁边。

## 已完成的迁移与验证

- 已将 `desktop-export-migration.patch` 应用到 `D:\biglazycat`，涉及 101 个 desktop 文件；不再存在原先的目录写入阻塞。移除内置排版导出、专用模型安装项和无用依赖；PDF 编辑器仍需使用的 PDFium/中文字体改为随桌面构建内置。
- 应用后的文件在规范化 CRLF/LF 后，与先前通过验证的源码副本逐一一致；删除项均已删除。原有 15 个 mobile 改动文件 SHA-256 保持一致。核对脚本：`.vite/verify-desktop-applied.mjs`。
- 原仓库重新安装锁定依赖后，TypeScript/Vite 生产构建通过；Windows `go build -tags production` 编译通过。编译产物：`D:\biglazycat\desktop\.cache\export-acceptance\biglazycat-desktop.exe`；未替换正在运行的用户程序。
- 原仓库前端 12 个相关测试文件、115 项测试通过，涵盖菜单、工具栏、设置、工作区标签、嵌入资源与 PDF 编辑。
- Go `internal/localmodels`、`internal/plugin` 全套测试，以及主包 `TestPlugin*` / `TestLocalModel*` 通过。
- 插件已有的 194 项 Vitest 与 6 项后台测试通过；本轮生产逻辑未变，重新打包时 TypeScript/生产构建再次通过。文章 PDF、Word、HTML、PNG 和书籍 EPUB、PDF、Word 的实际浏览器输出、零外部请求及图形目视检查证据保存在 `.vite/browser-check/`。
- 先前桌面全量主包测试有既有失败 `TestAutomaticSyncCancelsNetworkAndReleasesSlot`，在未修改的原仓库已复现。本轮未改动相关同步实现，也未将整个 Go 测试集记为通过。

## 原生验收边界

当前自动执行环境内，既有独立 Wails 验收程序与本轮新编译的桌面程序都出现 WebView2 浏览器进程反复退出，未建立可用页面调试连接；根因尚未确定。失败的测试进程已停止，原有桌面进程保留。日志位于原仓库 `.cache/export-acceptance/native-error.log` 和 `.cache/export-acceptance/preflight-*/process-error.log`。

用户在普通终端启动后，2026-11-14 12:53:44 的日志已经包含 `ui.startup`、`ui.load`、`ui.render`，证明应用窗口正常渲染。此前启动脚本依赖未生成的 DevToolsActivePort 文件，误判后关闭了正常窗口；这一次不属于 WebView2 崩溃。已修正脚本：主窗口使用明确的本地端口 19369，调试连接超时时保留仍在运行的进程。

已准备独立原生验收入口 `D:\biglazycat\desktop\.cache\export-acceptance\start-native.ps1`。其程序通过 Go overlay 更换单实例标识，并为每个原生插件页面分配、记录独立调试端口；产品源码不加入这些测试设置。数据目录独立。启动后保留窗口，继续验证真实菜单、未保存文稿快照、工作区切换、设置恢复、七种导出以及系统保存/取消。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\biglazycat\desktop\.cache\export-acceptance\start-native.ps1"
```

Wails 页面、系统保存对话框与 macOS/Linux WebView 尚未验收通过。不能用安装成功、编译通过或浏览器 RPC 测试替代这些结果。
