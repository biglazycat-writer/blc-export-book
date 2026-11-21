# 排版导出（blc-export-book）

大懒猫创作平台的排版导出插件：把单篇文章或整个文件夹排版成可打印、可分发的成品。

| 用途 | 导出格式 |
| --- | --- |
| 单篇文章 | PDF、Word `.docx`、HTML、PNG、EPUB |
| 文件夹制作书籍 | EPUB、PDF、Word `.docx`、HTML |

需要大懒猫创作平台 **0.4.5 及以上**（插件 API 1 修订 3）。

## 功能亮点

- **排版设置**：纸张、字号、行距、页边距、页眉页脚、页码、封面与目录，设置保存在插件工作区存储；
- **图片设计器**：长图、海报比例、四种版式与霞鹜文楷配色；
- **画布与思维导图**：按 `.canvas` / `.xmind` 原文件渲染，保留布局、连线、图标和公式；
- **离线打包**：Typst 排版引擎与全部字体随插件分发，运行时不联网下载；
- **大文件可靠保存**：按块写入临时文件，完整写入后才替换目标文件。

## 安装与使用

1. 在桌面端「插件中心 → 安装插件 → 插件包」导入 GitHub Release 提供的 `.tgz`，无须额外准备依赖或构建；
2. **单篇导出**：从文章编辑器打开「排版导出」，导出内容包含未保存的改动；要导出最新改动，请从文章重新打开；
3. **书籍制作**：在创作区文件夹或根目录右键选择「排版导出」，从文件右键打开时使用其所在目录；
4. 保存位置由系统保存对话框选择。

章节选择与排序在排版工作台中调整；文件夹模式读取包含子文件夹的已保存文稿。通过命令面板或插件中心打开时，可先浏览目录再点「选择此文件夹制作书籍」直接选定。

## 开发

```sh
npm ci              # 安装依赖（SDK 以 vendor 工件锁定）
npm run build       # 类型检查 + 构建
npm test            # 后台集成测试 + UI 单元测试
npm run package     # 产出 dist-package/blc-export-book-<版本>.tgz 与 SHA-256
```

- 构建只读取本仓库与锁定依赖，不引用 desktop 源文件；
- `scripts/check-browser.mjs` 用本机 Chrome 对生产构建做端到端导出验证（可设 `BLC_BROWSER` 指定浏览器），输出在 `.vite/browser-check/`；
- 发布：推送 `v*` 标签，GitHub Actions 自动构建、测试、打包并创建 Release。

## 已知限制

- Word 字体显示取决于阅读软件；PDF 内嵌排版字体；
- 原生 Wails 菜单入口与跨平台 WebView 验收仍在进行，核对记录见 [docs/migration-status.md](docs/migration-status.md)。

## 配置使用入口

在大懒猫创作平台的插件详情中，为插件声明的功能选择使用入口。功能数量、支持的位置与对应动作由本插件的 `contributes.features` 决定；用户可以多选、取消或恢复默认。开发声明见 SDK 的 [功能入口协议](https://github.com/biglazycat-writer/blc-plugin-sdk/blob/main/FEATURES.md)。
