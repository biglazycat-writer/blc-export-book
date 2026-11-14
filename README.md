# 排版导出 · 大懒猫创作平台

将 desktop 的排版工作台与长图设计器迁入独立插件。插件使用公共 SDK 读取文稿，排版引擎、字体、公式、Mermaid 与 PDF 预览资源均随插件打包。

desktop 旧排版入口与专用模型安装项已清理，插件已通过宿主插件管理器安装验证；原生 Wails 窗口验收仍在进行，限制见下文。

| 用途 | 格式 |
| --- | --- |
| 单篇文章 | PDF、Word `.docx`、HTML、PNG，另可导出 EPUB |
| 文件夹制作书籍 | EPUB、PDF、Word `.docx`、HTML |

排版包含纸张、字号、行距、页边距、页眉页脚、页码、封面、标志图、目录、章节选择及排序。图片设计器提供长图、海报比例、四种版式、配色和霞鹜文楷。Word 保存为可编辑的 `.docx`。

嵌入画布、思维导图从工作区 `.canvas` / `.xmind` 原文件渲染，保留布局、连线、图标和公式；资源缺失、文件损坏或版本不支持时明确报错。

## 使用

需要大懒猫创作平台 **0.4.5 及以上**，公共插件 API 1 修订 3，以及宿主支持的 Node 22 插件运行环境。

从文章编辑器打开「排版导出当前文章」，会先读取包含未保存改动的本次 Markdown 快照，再打开排版页面。每次打开独立捕获，不复用上次稿件；原编辑器关闭、切换标签或排版页面重载后仍使用本次快照。要导出修改后的稿件，请从文章再次打开。

在本地创作区文件夹或根目录的右键菜单选择「导出这个文件夹排版制作书籍」，直接排版该目录；从文件右键打开时使用其所在目录。该入口由插件清单的 `contributes.menus` 声明为 `resource`。通过命令面板或插件中心打开时，点击文件夹名称浏览内容，点击旁边的「选择此文件夹制作书籍」直接选择目录；上方按钮选择当前浏览的目录。文件夹模式读取包含子文件夹的已保存文稿；章节选择与排序在排版工作台中调整。

导出在系统保存对话框选择位置。大型文件按块传输并写入临时文件，完整写入后才替换目标文件。排版设置与封面保存在插件的工作区存储中，独立于页面地址。

已构建的 `.tgz` 包通过「安装插件 → 插件包」安装，无需在安装时准备依赖或再次构建。插件自带 Typst WASM、Noto Serif SC 常规/粗体、Noto Emoji、Noto Sans Mono、霞鹜文楷和 PDF.js 资源；运行时不下载这些资源。外部链接图片本身仍需能读取。

## 开发与验证

```sh
npm ci
npm run build
npm test
node scripts/check-browser.mjs
npm run package
```

构建只读取本仓库及锁定依赖，不引用 desktop 源文件。后台 SDK 打包进 `dist/main.js`，安装运行不需要 `node_modules`。产物为 `dist-package/blc-export-book-0.1.2.tgz` 及 SHA-256 文件。

`scripts/check-browser.mjs` 使用本机 Chrome 与本地 RPC 测试宿主，实际运行生产构建和后台文件保存，导出单篇 PDF/Word/HTML/PNG 及书籍 EPUB/PDF/Word。输出与页面截图在 `.vite/browser-check/`。可设置 `BLC_BROWSER` 指定 Chrome/Edge；在限制子进程的测试环境中可设置 `BLC_BROWSER_SINGLE_PROCESS=1`，仅测试浏览器使用单进程参数。它不是 Wails 客户端安装测试。

## 尚未完成

- 原生 Wails 菜单入口、系统保存对话框与跨平台 WebView 验收仍需完成。当前自动执行环境的 WebView2 浏览器进程反复退出；此项不能用浏览器 RPC 测试替代。
- Word 字体显示取决于阅读软件；PDF 内嵌排版字体。

迁移核对记录见 [docs/migration-status.md](docs/migration-status.md)。
