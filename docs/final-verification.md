# 排版导出 0.1.2 验证记录

更新日期：2026-11-14。本轮完成未启动插件的工具栏隐藏、创作区文件夹菜单、文件夹选择和日期错误修复，并保留 0.1.1 的独立稿件快照修复。

## 安装包

- 路径：`dist-package/blc-export-book-0.1.2.tgz`。
- 大小：58,981,977 字节；399 个归档条目，7 个后台命令。
- SHA-256：`94bced61bf8c22dbcb161e8fe9563e663f499026a82a57e331aac09419439de1`。
- `npm run package` 生产构建与归档结构检查通过。
- `node scripts/verify-package.mjs` 独立解包、摘要、命令注册及字体/WASM/PDF.js 资源验证通过；后台无需安装 node_modules。

本文件在包校验完成后更新，打包脚本明确排除本文件，避免归档摘要自引用。

## 修复行为

- 平台编辑器工具栏仅显示已启用、就绪、未跳过启动且 `state: running` 的插件命令。待启动、启动中、停止中、已停止、故障和停用状态均不占位置；没有按钮时不生成占位容器。插件仍可通过插件中心、命令面板或资源菜单启动。
- `export.book` 通过公共 SDK 已有的 `contributes.menus` 声明 `location: resource`，名称为「排版导出」。目录右键直接打开该目录；文件右键使用所在目录；根目录处理宿主省略空路径字段的情况。默认编辑器工具栏只声明文章导出。
- 本地创作区侧栏目录和根目录通过共享资源菜单传递准确目标。平台实现不判断插件名称；资源菜单切换目标时旧上下文立即失效，并清除残留编辑器身份和 revision。
- 插件资源选择页将「浏览文件夹」和「选择此文件夹制作书籍」分开。后者直接选择行内目录；上方按钮选择当前目录。书籍包含目录内及子目录内的文章。
- `ModTimeUnix` 在宿主的 `workspacefile.Scan` 中使用 `UnixNano()`。此前插件错误乘以 1000，导致真实文件日期越界。现在除以 1,000,000 转为毫秒，缺失、非有限或越界日期为空，不阻止制作书籍。
- 文章命令先通过 `readDocument` 捕获未保存稿件，再打开插件页面。稿件分块存入工作区插件存储，页面检查点只保存快照引用。每次打开独立捕获，原编辑器销毁及页面重载后不再使用过期 editorId 取稿。书籍调用清除无关编辑器身份。
- SDK 独立仓库 README 说明入口声明、工具栏生命周期、根目录上下文、时间单位和稿件捕获时机；未新增公共 API 或修改 SDK 运行时代码。

## 已通过

- 插件 TypeScript 类型检查、Vite 生产构建及完整打包。
- 插件 28 个 Vitest 文件、200 项测试；9 项后台测试。新增覆盖直接选择/浏览/返回上级/根目录选择、真实纳秒时间戳、子目录遍历及无效时间值。
- 平台前端全量 TypeScript 检查。8 个相关测试文件、80 项测试通过，其中 10 项插件工具栏生命周期测试、1 项外层编辑器布局单元折叠测试，以及 2 项从本地创作区目录树、根目录右键点击通用菜单组件的集成测试。
- 平台前端生产构建通过：`vite build --configLoader runner --outDir .vite/plugin-entry-final-dist`，产物在隔离目录；既有依赖的大包提示仍保留。
- 生产浏览器验证：`BLC_BROWSER_SINGLE_PROCESS=1 node scripts/check-browser.mjs`。真实插件后台与生产页面实际生成 8 个输出：文章 PDF/Word/HTML/PNG、根目录书籍 EPUB/PDF/Word、选择文件夹后生成 EPUB。检查文件签名、归档结构、嵌入图形与所选目录的读取范围。外部请求为零、页面异常为零。
- 浏览器夹具使用真实量级时间戳 `1794630600000000000` 纳秒。验证目录浏览、上一级、独立选择目录、子目录内容导出，以及目录/根目录命令直接进入排版页面。文章源编辑器关闭后重载页面，捕获次数仍为 1。结果：`.vite/browser-check/result.json`。
- 1380px 和 480px 宽度的文件夹选择界面截图检查通过，窄页无横向溢出。截图：`.vite/browser-check/folder-picker.png`、`folder-picker-narrow.png`。
- 真实桌面 `plugin.Manager` 在独立数据目录安装并启用 0.1.2：`enabled=true`、`ready=true`。经真实 Go/Node RPC 连续打开两次文章，得到独立视图实例和稿件快照；目录和根目录目标正确，书籍上下文不含 editorId/documentId。资源和文稿接口由受控夹具提供。证据：`../biglazycat/desktop/frontend/.vite/export-book-entry-check/result.json`。

## 验证边界

本轮验证不包含真实 Wails 菜单点击、原生 WebView 页面与系统保存对话框操作，也不包含 macOS/Linux 实机验证。宿主安装与 Go/Node 调用、组件菜单点击、浏览器生产页面导出分别记录，不等同于原生界面验收。

标准桌面前端构建遇到现有 `node_modules/.vite-temp` 写入和 `frontend/dist` 文件删除权限限制，改用 Vite 的 `--configLoader runner` 和独立的 `.vite/plugin-entry-final-dist` 输出目录进行构建验证。

本轮未替换正在运行的用户桌面程序。工具栏隐藏属于桌面宿主源码修改，需要使用包含此次修改的桌面构建；文件夹选择、菜单标题与日期修复位于 0.1.2 插件包。

先前桌面内置导出迁移的记录见 [migration-status.md](migration-status.md)。
