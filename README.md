# 简明 Anki 模板

为每天的复习设计的个人模板。问题、答案和解析各有清楚的位置，补充资料需要时再展开。单列正文、适当的行长和浅深色配色，适合长时间阅读。

[![Template Check](https://github.com/zzpice/anki-apple-template/actions/workflows/check.yml/badge.svg)](https://github.com/zzpice/anki-apple-template/actions/workflows/check.yml)

**[下载并导入 Anki](https://github.com/zzpice/anki-apple-template/raw/refs/heads/main/downloads/anki-apple-template.apkg)** · **[在线预览](https://zzpice.github.io/anki-apple-template/)**

支持普通问答、单选、多选、判断、原生填空／完形段落和原生图片遮挡。没有设置面板、倒计时、自动评分或选项随机排序。卡片离线可用，不需要插件、远程字体或第三方运行库。

## 直接安装

1. 下载上面的 `.apkg` 安装包。
2. Anki Desktop：**文件 → 导入**；AnkiDroid：使用**导入**；AnkiMobile：从文件应用打开或分享给 Anki。
3. 导入后会出现 **简明模板 · 示例** 牌组，以及 **简明 · 问答**、**简明 · 填空**、**简明 · 图片遮挡** 三个笔记类型。
4. 添加自己的笔记时，选择相应类型和自己的牌组。示例牌组中的 8 条笔记（11 张卡片）可以删除，已安装的笔记类型仍能继续使用。

安装包包含字段、模板、样式、共享脚本和示例图片，无需复制代码。它会向现有集合添加内容，不会替换整个集合。AnkiWeb 无法直接导入，先在客户端导入，再同步。

## 怎样写卡片

### 问答、选择与判断

都使用 **简明 · 问答**。每条笔记生成一张正向卡片。

| 字段 | 用途 |
| --- | --- |
| 问题 | 必填；正面的题干，可包含图片、列表、表格 |
| 答案 | 问答填写正文；选择题填写正确选项字母，如 `C` 或 `ABD` |
| 选项 | 选择题用 `||` 分隔；问答留空 |
| 题型 | 多选必须填写 `多选`；单选／判断可填写 `单选`／`判断`，或留空 |
| 解析 | 背面直接显示的解释、易错点 |
| 补充 | 背面默认折叠的个人笔记和扩展资料 |
| 章节 | 正面顶部的上下文；可选 |
| 来源 | 背面底部的书名、页码或链接；可选 |

例如，`选项` 填写：

```text
再次阅读课本||给重点划线||合上书，尝试解释刚学过的概念||只浏览答案
```

`答案` 填写 `C`。字母按照原始顺序从 A 到 Z 编号，不需要在选项里再次写字母。至少两个、最多 26 个选项；每项可包含 Anki 的富文本。`||` 只用作选项分隔符，不要把它写进某一项的正文。可以用 HTML 换行组织单项内容。

判断题也使用相同结构：`选项` 写 `正确||错误`，`答案` 写 `A` 或 `B`，`题型` 写 `判断`。普通问答只需填写问题和答案。

点击选项仅辅助回忆，不会自动翻面或评分。翻面后会标出正确选项，并在答案区列出对应正文。正面的临时选择不跨翻面、换卡或设备保存。答案不符合字母格式时直接显示原文，不尝试推断正确选项。复习评分始终由你通过 Anki 的按钮决定。

### 填空与完形段落

使用 **简明 · 填空**。字段为 `正文`、`解析`、`补充`、`章节`、`来源`，后四项都可留空。

在 `正文` 中选中文字并点击 Anki 的填空按钮，或写入原生语法：

```text
记忆的三个基本过程是 {{c1::编码}}、{{c2::存储}} 和 {{c3::提取::访问已存信息}}。
```

这会生成三张可独立排程的卡片。使用相同编号，可在一张卡片上同时遮住多个片段；最后一项演示了可选提示。外语完形段落也可以这样制作。模板使用标准 Cloze，没有额外的 `[[...]]` 语法、逐空弹窗或整篇自动判分。

### 图片遮挡

使用 **简明 · 图片遮挡**，在 Anki 的添加窗口中选择图片，使用**内置遮挡编辑器**绘制区域。支持原生的“遮住全部，猜一个”和“遮住一个，猜一个”，各个区域／分组独立排程。[Anki 原生图片遮挡说明](https://docs.ankiweb.net/editing.html#image-occlusion)

为保持原生编辑器识别，保留以下字段名称和内部标记：

| 字段 | 用途 |
| --- | --- |
| Occlusion、Image | 编辑器维护的遮挡数据和图片，无需手工填写 |
| Header | 图片上方的问题或提示 |
| Back Extra | 背面的解析 |
| Comments | 本模板在背面折叠显示的补充资料 |

图片遮挡由客户端绘制，普通图片放大不会接管遮挡图片。背面的按钮可暂时显示／隐藏其他遮挡。浏览器预览会明确提示你导入体验，不模拟原生遮挡，也不会把未遮挡图片暴露为题目。

所有类型都可使用 Anki 内置 `Tags`；标签只出现在背面，不需要另建字段。可选字段留空时不显示相应区块。

## 阅读与交互

普通内容图片保持比例，大图适应正文宽度，小图保持自然大小；点击放大，点击图片／关闭按钮或按 `Esc` 退出。放大层属于当前卡片，翻面和换卡时一起移除。图片链接保留链接行为；不需要放大的图片可添加 `class="no-zoom"`。

表格和代码在窄屏可以左右滚动，不会撑开整页。代码使用系统等宽字体；音频、MathJax 和媒体同步继续由 Anki 处理。模板不自建播放器或数学渲染器。

浅深色支持系统外观和 Anki 的 `.nightMode` / `.night_mode` 类名。模板没有动画、渐变、毛玻璃、装饰性图标或多个彩色内容面板。

## 已有笔记与更新

这次重做采用新的字段结构和笔记类型标识，不会把旧版 **Apple 风格问答** 或 kikkua 模板静默改成新类型。

已有普通问答可在桌面端浏览器中选择笔记，使用 **笔记 → 更改笔记类型**，把题干、答案等映射到对应字段。旧版的 `笔记` 可映射到 `解析`，`相关知识` 可映射到 `补充`。kikkua 的 `Question`、`Options`、`Chapter`、`Analysis` 分别对应 `问题`、`选项`、`章节`、`解析`；选择题将 `Answer` 映射到 `答案`，问答将 `AnswerText` 映射到 `答案`。`Refrence`（原拼写）按内容映射到 `来源` 或 `补充`；`Type` 需整理为上面约定的题型文字。

填空必须使用真正的 Cloze 类型。旧 `[[...]]`、多小题 `##`、`$$$` 完形与 JSON 图片遮挡不自动转换；建议先拆分为独立问题，或通过 Anki 的原生编辑器重新制作。多卡片笔记转换时，应核对卡片映射和已有排程。

之后下载新版再次导入即可更新：同一类型、字段和示例使用固定标识，重复导入不会产生示例副本。新版桌面端的“更新笔记类型”选项决定是否采用新模板，界面以客户端为准。模板更新会影响使用该类型的所有笔记；需要长期自定义时，在“管理笔记类型”中先复制一份。

## 兼容性

建议使用当前稳定版 Anki Desktop、AnkiMobile 和 AnkiDroid，并更新手机系统的 WebView。原生图片遮挡需要 Anki Desktop 23.10+，AnkiDroid 2.17+ 和支持该功能的 AnkiMobile。[桌面端说明](https://docs.ankiweb.net/editing.html#image-occlusion) · [AnkiDroid 更新记录](https://docs.ankidroid.org/changelog.html)

图片放大使用浏览器原生 `<dialog>`，需要现代 WebView；其他控件使用原生表单和 `<details>`。没有针对过时 WebView 的兼容层。原生图片遮挡的数据和绘制依赖客户端自身能力；不支持该 API 时模板隐藏图片并给出提示。

自动检查覆盖官方 Anki 25.9.2／26.9.3 的导入与实际 HTML 渲染、Chromium／WebKit、320–1280px 屏幕宽度、手机横竖屏、浅深色和两种夜间模式类名，也使用官方 reviewer 验证原生遮挡。它不能替代 AnkiMobile／AnkiDroid 的真机手势、客户端导入界面和同步测试；本次没有做手机真机测试。

## 手动安装与修改源码

| 文件 | 职责 |
| --- | --- |
| `note-types.json` | 三个类型的字段顺序、固定标识及源码路径 |
| `templates/basic/`、`templates/cloze/`、`templates/occlusion/` | 各类型的正面和背面，唯一模板源码 |
| `style.css` | 所有类型共用的排版和配色 |
| `media/_review.js` | 选项、普通图片放大、表格包装和原生遮挡 API 调用 |
| `media/_memory.svg`、`samples.json` | 原创示例，安装包与预览共用 |
| `scripts/build_package.py` | 官方 Anki 后端生成安装包和预览数据 |
| `preview-cards.json` | 自动生成的真实卡片 HTML，不手动修改 |
| `tests/`、`scripts/check_templates.py` | 导入、更新、包与源码一致性及浏览器检查 |

修改后，重新生成安装包和预览数据，并一起提交。字号、正文宽度、行高和颜色位于 `style.css` 顶部。核心脚本不使用全局监听、持久化存储或定时器；控件和放大层随当前卡片 DOM 一起清理。

**手动安装：** 问答类型以 Basic 为基础，填空类型以 Cloze 为基础，图片遮挡类型以原生 Image Occlusion 为基础。按 `note-types.json` 建立字段，将相应目录的正反面和 `style.css` 复制到 **卡片…**，把 `media/` 中的文件放进 `collection.media`，然后同步。图片遮挡应复制原生类型，保留其内部字段标记；直接导入安装包最可靠。

### 本地预览

```sh
python3 -m http.server 8000
```

打开 [http://localhost:8000/preview.html](http://localhost:8000/preview.html)。预览需要 HTTP 服务。它加载官方后端生成的 HTML 和真实样式、媒体脚本，不另写字段替换或填空渲染。切换“卡片”可查看一条 Cloze 笔记生成的不同卡片。

GitHub Pages 继续从 `main` 根目录发布，`.nojekyll` 保留以下划线开头的媒体资源。首页转到预览，下载按钮直接指向仓库中的同一安装包。

### 生成安装包

普通用户不需要运行这些命令。开发时使用 Python 3.12：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-build.txt
.venv/bin/python scripts/build_package.py
```

Windows 中将 `.venv/bin/python` 换成 `.venv\Scripts\python.exe`。生成器只在临时集合中工作，不打开个人资料，使用固定版本的官方 Anki 后端导出兼容格式 `.apkg`。不手写数据库、媒体映射或 Cloze 生成规则。

安装包约 80 KB，直接保存在 `downloads/` 并随源码发布；不需要另外维护 GitHub Release 或自动发版系统。代码的 MIT 许可全文也包含在共享媒体脚本内。后续新增模板媒体放在 `media/`，并使用 Anki 要求的下划线前缀。

### 必要检查

```sh
.venv/bin/python scripts/check_templates.py
.venv/bin/python -m pip install --no-deps -r requirements-test.txt
ANKI_RENDER_OUTPUT=build/cards.json .venv/bin/python -m unittest discover -s tests -v
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium webkit
node tests/test_browser.cjs
```

先按上一节安装构建依赖。检查脚本需要 Node.js，CI 使用 Node.js 22。`aqt` 仅提供测试用的官方 JS/CSS 资源，`--no-deps` 避免安装 Qt GUI；它不会进入卡片或在线预览。Windows PowerShell 可先设置 `$env:ANKI_RENDER_OUTPUT = "build/cards.json"`。

源码、安装包或预览数据不一致时 CI 失败。测试包括重复导入、用户内容和排程保留、空题干检查、特殊字符、原生遮挡的 canvas 绘制、选项、折叠、图片、换卡和预览下载。

设计分析和取舍见 [REVIEW.md](REVIEW.md)，变更见 [CHANGELOG.md](CHANGELOG.md)。项目保留原仓库名 `anki-apple-template`，视觉不以模仿某个系统组件为目标。许可证：[MIT](LICENSE)。
