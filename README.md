# Apple 风格 Anki 问答模板

![Template Check](https://github.com/zzpice/anki-apple-template/actions/workflows/check.yml/badge.svg)

纯 HTML、CSS 和 JavaScript，无框架、构建步骤或第三方依赖。

保留问题、答案、笔记、相关知识分区、Tags、复习时间、深色模式、图片自适应与点击放大、表格横向滚动、代码块，以及手机横竖屏适配。

## 安装

1. 在 Anki 笔记类型中创建 `问题`、`答案`、`笔记`、`相关知识` 四个字段，名称必须一致。`Tags` 是内置字段，无需创建。
2. 打开 **卡片… / Cards…**，将 [front.html](front.html)、[back.html](back.html)、[style.css](style.css) 分别复制到正面模板、背面模板和样式。
3. 将 `_x_ios.svg`、`_y_ios.svg`、`_z_ios.svg` 放入当前配置的 `collection.media`，然后正常同步。下划线用于保留模板级静态媒体。

`问题` 为必需字段；答案、笔记、相关知识和 Tags 为空时不显示对应区块。背面通过 Anki 原生 `{{FrontSide}}` 复用正面，相关知识通过 `{{hint:相关知识}}` 默认折叠，答案保留 `id="answer"` 定位锚点。

## 内容与交互

图片保持比例，大图缩小到容器和视口内，小图保持自然尺寸。点击图片放大，再次点击、点击遮罩或按 `Esc` 关闭；窗口尺寸变化和换卡也会关闭放大。尺寸由 CSS 控制，加载完成或展开 Hint 后自动适配。

两种现有的禁用放大写法均保留：

```html
<img src="example.png" class="no-zoom">
<img src="example.png" data-nozoom="1">
```

普通 `<table>` 自动包一层横向滚动容器，保留原生表格布局。代码无需添加 class：

```html
<pre><code>代码块</code></pre>
<code>行内代码</code>
```

代码字体依次使用 Maple Mono NF CN、JetBrains Mono 和系统等宽字体，不附带或下载字体。

深色模式支持系统 `prefers-color-scheme` 与 Anki 的 `.nightMode` / `.night_mode`。两种入口只修改配色变量，组件共用一套样式。动效遵循 `prefers-reduced-motion`。

## 预览与检查

在仓库目录运行 Python 自带的静态服务：

```sh
python3 -m http.server 8000
```

打开 <http://localhost:8000/preview.html>，可切换系统、浅色和深色主题。预览读取实际模板、样式和脚本，仅用样例替换 Anki 字段和 Hint，因此需要 HTTP 服务，不能直接用 `file://` 打开。

GitHub Actions 检查核心字段、答案锚点、本地媒体引用及内嵌 JavaScript 语法，并防止将 `FrontSide` 字段写进 JS 注释或代码。浏览器预览不等于客户端验证；修改后仍应在 Anki Desktop、AnkiMobile、AnkiDroid 中检查换卡、翻面、Hint、图片放大及横屏显示。

## 维护

- 视觉参数在 `style.css` 顶部；常用的是 `--ios-radius`、`--fs-base`、`--fs-title` 和 `--lh`。
- 图片尺寸、代码样式、主题和移动布局交给 CSS。
- 共享交互只在 `front.html` 实现；背面末尾调用初始化，处理新增表格。
- 一个全局初始化函数防止同一 WebView 连续换卡时重复绑定事件；每次初始化关闭放大，已包装的表格不会再包一层。
- 原图被换卡移除时，原生 `MutationObserver` 清理放大层；切到其他笔记类型也不会残留遮罩或拦截它的图片点击。
- 放大层挂在 `body` 下，避开正文卡片的模糊和动画所建立的定位与层叠上下文。
- 不支持模糊效果的内核直接显示已有卡片背景，不再维护另一套回退主题。

变更记录见 [CHANGELOG.md](CHANGELOG.md)。许可证：[MIT](LICENSE)。
