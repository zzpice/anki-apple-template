# anki-apple-template

简洁的 Anki 问答模板。以 Apple 的排版和留白为审美参考，让长时间阅读和复习更轻松。

[![Template Check](https://github.com/zzpice/anki-apple-template/actions/workflows/check.yml/badge.svg)](https://github.com/zzpice/anki-apple-template/actions/workflows/check.yml)
[![License](https://img.shields.io/github/license/zzpice/anki-apple-template)](./LICENSE)

**[下载 Anki 安装包](https://github.com/zzpice/anki-apple-template/raw/refs/heads/main/downloads/anki-apple-template.apkg)** · **[在线预览](https://zzpice.github.io/anki-apple-template/)**

正文采用单列阅读布局和少量分隔线；支持浅深色、可选字段、标签、原生折叠提示、图片放大、表格横向滚动和代码。卡片是纯 HTML、CSS、JavaScript，无框架、远程字体、插件或第三方运行时依赖。

## 安装与使用

1. 下载上面的 `anki-apple-template.apkg`。
2. 在 Anki Desktop 中选择 **文件 → 导入**；AnkiDroid 中使用 **导入**；AnkiMobile 中从文件应用打开或分享给 Anki。
3. 导入后会出现 **Apple 模板示例** 牌组和 **Apple 风格问答** 笔记类型。添加自己的笔记时选择这个笔记类型和目标牌组。

包内包含模板、样式、两张可删除的示例和 MIT 许可证，无需手动复制代码或媒体文件。它是牌组包，会添加内容，不会替换整个 Anki 集合。AnkiWeb 不支持直接导入，先在桌面端或移动端导入，再同步。

| 字段 | 用途 |
| --- | --- |
| 问题 | 必填，显示在正面 |
| 答案 | 显示在背面 |
| 笔记 | 可选的补充说明 |
| 相关知识 | 可选，使用 Anki 原生 `hint:` 默认折叠 |

`Tags` 是 Anki 内置字段，不需要创建。可选字段和 Tags 为空时不显示对应区块。背面通过 `{{FrontSide}}` 复用问题，保留 `id="answer"`，支持 Anki 自动滚动到答案。

**已有普通问答卡片：** 在桌面端浏览器中选中笔记，使用 **笔记 → 更改笔记类型**，映射原字段到上述四个字段，并将原卡片映射到“问答”。该笔记类型只有一张正向问答卡；Cloze、多卡片或带输入答案的笔记不能直接等价转换。

**更新与自定义：** 下载新版后再次导入。同一笔记类型、牌组和示例使用固定标识，重复导入不会重复添加示例。新版桌面端的“更新笔记类型”选项决定模板是否更新；需要采用新外观时允许更新，具体界面以客户端为准。模板更新会影响使用该类型的所有笔记；自行修改前，可在“管理笔记类型”中复制一份使用。已手动安装到其他笔记类型的模板不会因导入而自动更新。

## 内容与交互

图片保持比例，大图缩小到正文和视口内，小图保持自然尺寸。点击图片放大，再次点击、点击遮罩或按 `Esc` 关闭；旋转屏幕、翻面和换卡也会清理放大层。图片链接和按钮保留原有行为。

禁用某张图片的放大：

```html
<img src="example.png" class="no-zoom">
<img src="example.png" data-nozoom="1">
```

普通 `<table>` 保留原生表格布局，在窄屏可左右滑动；折叠提示中的表格也适用。代码直接使用 HTML：

```html
<pre><code>代码块</code></pre>
<code>行内代码</code>
```

代码优先使用已安装的 Maple Mono NF CN、JetBrains Mono，随后回退到系统等宽字体。模板不附带或下载字体。系统 `prefers-color-scheme` 和 Anki 的 `.nightMode` / `.night_mode` 都能启用深色配色。模板没有动画。

## 源码与维护

| 文件 | 职责 |
| --- | --- |
| `front.html`、`back.html`、`style.css` | 实际 Anki 模板；可直接编辑或手动安装 |
| `samples.json` | 安装包和预览共用的示例 |
| `preview.html` | 读取实际源码，预览正反面、空字段和主题 |
| `scripts/build_package.py` | 将源码生成 `.apkg`，固定笔记类型、牌组和示例标识 |
| `scripts/check_templates.py`、`tests/` | 源码完整性、安装包、Anki 官方导入和浏览器回归检查 |

正文宽度、留白和配色都在 `style.css`。共享脚本只处理图片放大和表格包装，绑定一次全局事件，背面末尾重新初始化。已有包装不会嵌套；切到其他笔记类型也会关闭放大层。

新版移除了装饰性图标，因此无需模板媒体。手动安装只需建立上述四个字段，将三个源码文件复制到 **卡片… / Cards…** 的正面、背面和样式。旧版本的 `_x_ios.svg`、`_y_ios.svg`、`_z_ios.svg` 可以留在媒体目录，其他旧模板可能仍在使用它们。

### 本地预览

```sh
python3 -m http.server 8000
```

打开 <http://localhost:8000/preview.html>。预览需要 HTTP 服务，不能直接用 `file://` 打开。预览只模拟本模板使用的字段替换；Anki 的最终渲染由官方后端测试验证。

### 生成下载文件

只有生成安装包时才需要 Python 和构建依赖；普通用户直接下载即可：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-build.txt
.venv/bin/python scripts/build_package.py
```

Windows 中将 `.venv/bin/python` 换成 `.venv\Scripts\python.exe`。生成器使用固定版本的 [genanki](https://github.com/kerrickstaley/genanki) 写出广泛兼容的 legacy `.apkg`，不手写 Anki 数据库格式。模板、样式、示例或许可证变更后重新生成，并将 `downloads/anki-apple-template.apkg` 与源码一起提交。README 和 GitHub Pages 预览页直接提供这个文件，无需独立发布流程。

CI 会逐项比较下载包与源码，遗漏重新生成会导致检查失败。模型 ID、牌组 ID、示例 key 和字段顺序应保持稳定；生成时间用于 Anki 判断更新，不要求每次构建的二进制完全相同。

### 检查

使用 Python 3.12 和 Node.js 22：

```sh
python scripts/check_templates.py
.venv/bin/python -m pip install -r requirements-test.txt
ANKI_RENDER_OUTPUT=build/cards.json .venv/bin/python -m unittest discover -s tests -v
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium webkit
node tests/test_browser.cjs
```

`ANKI_RENDER_OUTPUT` 只用于输出浏览器测试所需的 Anki 实际渲染；单独运行 Python 测试无需设置。Windows PowerShell 可先设置 `$env:ANKI_RENDER_OUTPUT = "build/cards.json"`。Python 测试使用临时集合，不会打开或修改个人 Anki 数据。

GitHub Actions 运行同样的检查，涵盖源码与下载包一致性、首次与重复导入、模板更新、已有笔记和复习进度保留，以及 Chromium/WebKit 下的主题、Hint、图片、表格、换卡和手机横竖屏。引擎测试不等于 AnkiMobile/AnkiDroid 真机验证；发布前仍应在客户端检查翻面、答案定位、Hint、图片放大和同步。

审查依据与取舍见 [REVIEW.md](REVIEW.md)，变更记录见 [CHANGELOG.md](CHANGELOG.md)。许可证：[MIT](LICENSE)。
