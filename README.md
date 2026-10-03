# Apple 风格 Anki 问答模板

![Template Check](https://github.com/zzpice/anki-apple-template/actions/workflows/check.yml/badge.svg)

一套面向中文问答卡片的 Anki 模板，采用接近 Apple / iOS 的简洁视觉风格，并针对桌面端与移动端做响应式适配。

## 特性

- 自动适配浅色 / 深色模式
- 支持 Anki `nightMode` / `night_mode`
- 问题、答案、笔记、相关知识分区展示
- Tags 独立徽标显示，不与顶部标题重复
- 自动显示复习时间
- 图片按视口自适应，小图保持自然尺寸
- 图片点击后进入居中 Lightbox
- Lightbox 支持再次点击、点击遮罩或按 `Esc` 关闭
- 放大图片时锁定页面滚动
- 表格自动增强并支持横向滚动
- 区分代码块与行内代码样式，避免重复边框
- 支持 Anki 答案定位锚点 `id="answer"`
- 相关知识使用 Anki 原生 `hint:` 过滤器
- 尊重系统“减少动态效果”设置
- 针对窄屏和手机横屏优化
- 纯 HTML + CSS + JavaScript，无第三方运行时依赖

## 在线仓库与本地预览

仓库地址：

`https://github.com/zzpice/anki-apple-template`

下载仓库后，直接在浏览器打开 `preview.html`，即可检查：

- 浅色 / 深色效果
- 问题、答案、笔记、相关知识分区
- Tags 长文本
- 图片 Lightbox
- 表格横向滚动
- 代码块与行内代码
- 链接和键盘焦点

预览页只是开发辅助文件，不需要复制到 Anki。

## 模板结构

正面：

- 顶部固定显示“问题” + 当前时间
- Tags 独立徽标
- 问题正文

背面：

- 保留正面内容
- 答案
- 笔记（可选）
- 相关知识（可选）

## 文件说明

| 文件 | 用途 |
| --- | --- |
| `front.html` | 卡片正面模板 |
| `back.html` | 卡片背面模板 |
| `style.css` | 卡片样式 |
| `_x_ios.svg` | “问题”图标 |
| `_y_ios.svg` | “答案 / 笔记”图标 |
| `_z_ios.svg` | “相关知识”图标 |
| `preview.html` | 浏览器本地预览 |
| `CHANGELOG.md` | 变更记录 |
| `LICENSE` | MIT 许可证 |
| `.github/workflows/check.yml` | GitHub Actions 自动检查 |

## 所需字段

笔记类型需要包含以下字段，名称必须完全一致：

- `问题`
- `答案`
- `笔记`
- `相关知识`

`Tags` 是 Anki 内置特殊字段，无需手动创建。

其中：

- `问题` 是必需字段。
- `答案`、`笔记`、`相关知识` 均可为空；为空时对应区块不会显示。
- `相关知识` 使用 `{{hint:相关知识}}`，默认折叠为提示。

## 安装

### 1. 创建或修改笔记类型

在 Anki 的笔记类型中确认存在以下四个字段：

`问题`、`答案`、`笔记`、`相关知识`

### 2. 设置卡片模板

打开 **卡片… / Cards…**：

- 将 `front.html` 内容复制到“正面模板”
- 将 `back.html` 内容复制到“背面模板”
- 将 `style.css` 内容复制到“样式”

### 3. 安装图标媒体

将以下三个文件放进当前 Anki 配置的媒体目录 `collection.media`：

`_x_ios.svg`、`_y_ios.svg`、`_z_ios.svg`

文件名前的下划线是有意保留的，用于模板级静态媒体。之后正常执行 Anki 同步，让其他设备同步这些媒体文件。

## 使用说明

### 图片

正文图片会自动适应当前视口：

- 大图缩小到可视区域
- 小图保持自然尺寸，不强制拉伸
- 点击进入居中 Lightbox
- 再次点击、点击遮罩或按 `Esc` 退出
- 窗口尺寸变化时会自动关闭 Lightbox 并重新适配

如某张图片不希望启用点击放大，可写：

```html
<img src="example.png" class="no-zoom">
```

或：

```html
<img src="example.png" data-nozoom="1">
```

### 表格

普通 HTML `table` 会自动套用模板表格样式，并在需要时放进横向滚动容器，避免手机端被过度压缩。

### 代码

模板会区分：

```html
<pre><code>代码块</code></pre>
```

和行内：

```html
<code>inline code</code>
```

代码字体优先使用：

`Maple Mono NF CN` → `JetBrains Mono` → 系统等宽字体。

### 相关知识

`相关知识` 使用 Anki 的：

```text
{{hint:相关知识}}
```

因此默认以提示按钮形式出现，模板会统一其视觉样式。

## 深色模式

模板同时兼容：

1. 系统 `prefers-color-scheme: dark`
2. Anki 的 `.nightMode` / `.night_mode`

通常无需维护两套 CSS。

## 无障碍与交互

- 链接和 Hint 支持 `:focus-visible`
- 动效遵循 `prefers-reduced-motion`
- 图片放大可通过键盘 `Esc` 退出
- 顶部时间使用等宽数字，减少跳动
- Tags 长文本可自动换行

## 兼容性说明

模板使用现代 CSS 与 JavaScript，同时为 `backdrop-filter` 提供回退样式。建议使用较新的 Anki、AnkiMobile 或 AnkiDroid。

JavaScript 初始化允许重复执行：翻到背面后，新增的答案、笔记和相关知识区域会再次扫描；事件本身通过状态标记避免重复绑定。

## 自定义

常用视觉参数集中在 `style.css` 顶部的 `:root`：

```css
:root {
  --ios-radius: 14px;
  --fs-base: clamp(1rem, 2.5vw, 1.25rem);
  --fs-title: clamp(1.15rem, 3vw, 1.35rem);
  --lh: 1.6;
}
```

整体调字号时，优先修改 `--fs-base` 和 `--fs-title`。

## 自动检查

每次 Push 或 Pull Request，GitHub Actions 会自动检查：

- 必需文件是否存在
- 必需字段是否仍在模板中
- `id="answer"` 是否存在
- CSS 引用的本地模板媒体是否存在
- HTML 模板中是否重新出现不必要的内联 `style=`
- 正反面内嵌 JavaScript 是否能通过 Node.js 语法检查

工作流文件：

`.github/workflows/check.yml`

## 仓库结构

```text
.
├── .editorconfig
├── .gitattributes
├── .github/
│   └── workflows/
│       └── check.yml
├── README.md
├── CHANGELOG.md
├── LICENSE
├── preview.html
├── front.html
├── back.html
├── style.css
├── _x_ios.svg
├── _y_ios.svg
└── _z_ios.svg
```

## 维护原则

- 保持零第三方运行时依赖
- 优先保证桌面端与移动端一致体验
- 新增交互必须允许重复初始化
- 模板媒体使用固定文件名
- 视觉参数优先集中到 CSS 变量
- 避免在模板 HTML 中散落内联样式
- 修改后先打开 `preview.html`，再同步到 Anki 实机验证

## 许可证

本项目使用 [MIT License](LICENSE)。
