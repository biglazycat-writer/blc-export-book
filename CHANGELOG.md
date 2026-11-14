# 更新日志

本文件记录 `blc-export-book` 的 notable 变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循语义化版本。

## [Unreleased]

暂无。

## [0.1.0] - 2026-11-14

首个公开版本：面向大懒猫创作平台的排版导出插件（SDK API v1 修订 3）。

**客户端要求：** 需要大懒猫创作平台 **v0.4.5 及以上**，公共插件 API 1 修订 3，以及宿主支持的 Node 22 插件运行环境。

### 新增

- 单篇文章导出 PDF、Word `.docx`、HTML、PNG，另可导出 EPUB；文件夹制作书籍 EPUB、PDF、Word `.docx`、HTML。
- 排版设置：纸张、字号、行距、页边距、页眉页脚、页码、封面、标志图、目录、章节选择与排序；设置与封面保存在插件工作区存储中。
- 图片设计器：长图、海报比例、四种版式、配色与霞鹜文楷。
- 嵌入画布与思维导图从工作区 `.canvas` / `.xmind` 原文件渲染，保留布局、连线、图标和公式；资源缺失、文件损坏或版本不支持时明确报错。
- 离线排版引擎：Typst WASM、Noto Serif SC 常规/粗体、Noto Emoji、Noto Sans Mono、霞鹜文楷与 PDF.js 资源随插件打包，运行时不下载。
- 大文件分块保存：系统保存对话框选择位置，按块传输写入临时文件，完整写入后才替换目标文件。
- 中英文界面文案（React + i18next）。
- 测试：后台集成测试与 UI 单元测试（vitest + node:test，共 200+ 用例）；`scripts/check-browser.mjs` 用本机 Chrome 走生产构建验证单篇与书籍导出。
- GitHub Actions 发布工作流：推送 `v*` 标签自动构建、测试、打包，并创建 GitHub Release，附 `.tgz` 插件包与 SHA-256 校验文件。

### 说明

- 插件由 desktop 排版工作台与长图设计器迁入，只依赖公共 SDK 读取文稿，不引用 desktop 源文件；`blc-plugin-sdk` 以 `file:vendor/blc-plugin-sdk` 工件形式随仓库锁定。
- 已构建 `.tgz` 通过宿主「安装插件 → 插件包」安装，无需准备依赖或再次构建。
- 原生 Wails 菜单入口、系统保存对话框与跨平台 WebView 验收仍在进行。
