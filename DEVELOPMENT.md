# 维护说明

日常安装与字段教学见 [README](README.md)，网页制卡与数据交换见 [AUTHORING](AUTHORING.md)，提交约定见 [AGENTS](AGENTS.md)。本页说明源码、生成、验证与发布。

## 源码与标识

| 文件 | 维护职责 |
| --- | --- |
| `note-types.json` | 五个类型的 ID、字段顺序、正背面及附加样式路径，共供构包与网页制卡读取 |
| `templates/`、`style.css`、`media/` | 模板、公共样式、卡片脚本与示例媒体 |
| `samples.json` | 示例字段、标签、来源及固定 GUID |
| `scripts/build_package.py`、`scripts/authoring.py` | 官方 Anki 构包、渲染与用户工作空间校验，只操作临时集合 |
| `downloads/anki-template.apkg`、`preview-cards.json` | 随源码提交的生成产物，不手动修改 |
| `index.html`、`preview.html`、`tools.html`、`tools/` | 静态网页入口、示例预览与制卡工具，不需前端构建 |
| `tests/`、`.github/workflows/check.yml` | 回归检查与 CI；`build/` 是不提交的测试 / 自制包输出目录 |

五个类型为问答、选择、填空、图片遮挡和思维导图。问答与选择分别使用独立字段和正面，共用背面、样式和脚本。

保留笔记类型 ID、字段 ID、模板 ID、示例 GUID 和字段顺序，确保重复导入和后续更新识别同一结构。字段 ID 为类型 ID × 100 + 序号 + 1，模板 ID 为类型 ID × 100。牌组 ID 也保持固定；导入后 Anki 可能按牌组名称映射到用户集合中的 ID。

填空使用原生 Cloze。图片遮挡从原生 Image Occlusion 类型生成，须保留 `originalStockKind` 和字段 `tag`，以便客户端编辑器识别。

## 模板行为与手动安装

字段填写与选项规则见 [README](README.md#填写卡片)。维护选择脚本时须区分原始选项标识与显示字母，答案始终按原始标识映射到排序后的内容；判断和带 `固定顺序` 标签的笔记不随机。

当前排序和选择只占用一个 `sessionStorage` 条目：翻面继续读取并保留，开始下一张正面时清除。存储不可用时改用题目内容生成确定性排序，正反面仍一致，但不能保留已选项。背面模板的 `data-review-back` 标记让嵌入的正面脚本识别翻面，不提前清除状态。

安装包是常规安装入口。需要手动安装独立的个人类型时：

1. 在 Anki「工具 → 管理笔记类型」中，问答 / 选择复制单卡 Basic，填空 / 思维导图复制原生 Cloze，图片遮挡复制原生 Image Occlusion；另取名称。
2. 按 `note-types.json` 的 `fields` 配置字段名称和顺序；遮挡保留原生字段及内部标记。
3. 在「卡片」窗口分别粘贴该类型 `front`、`back` 指向的文件全文。选择的背面指向 `templates/basic/back.html`；保留其中的 `{{FrontSide}}`，不要用正面源码替换它。样式粘贴 `style.css`，有 `css` 路径的类型再追加该文件全文（当前为思维导图）。
4. 将 `media/` 内的文件平铺复制到当前配置的 `collection.media`，目录位置见 [Anki 手册](https://docs.ankiweb.net/files.html#user-data)，再同步媒体并检查实际卡片。

手动复制产生个人类型身份，不具备安装包的固定 ID；项目包的重复导入与更新保证针对包内原类型。需要继续跟随项目更新时，直接导入安装包。

问答、选择、填空和图片遮挡的普通内容图片可点击放大（原生遮挡区域除外）；无需放大的图片可添加 `class="no-zoom"`。思维导图图片内嵌自适应显示。字体、行高、正文宽度和颜色在 `style.css` 顶部修改。

## 生成与检查

先取得仓库并在根目录运行命令。需要 Python 3.12、Node.js 与 npm；本地默认依赖由 `requirements-build.txt` / `requirements-test.txt` 固定，CI 的 Node 与 Anki 版本见 [工作流](.github/workflows/check.yml)。静态网页不需要构建，Python 只用于生成与后端测试，Node 用于脚本和浏览器检查。

准备环境：

```sh
git clone https://github.com/zzpice/anki-template.git
cd anki-template
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements-build.txt
.venv/bin/python -m pip install --no-deps -r requirements-test.txt
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium webkit
```

`aqt` 仅提供测试用的官方 reviewer 资源，以 `--no-deps` 安装，不需 Qt / GUI。Linux 缺少浏览器系统库时，按 CI 使用 `npx playwright install --with-deps chromium webkit`。

检查当前提交的安装包与预览时，先运行以下检查，不先重建产物。修改类型、模板、样式、媒体或示例后，先运行 `.venv/bin/python scripts/build_package.py` 更新两份产物，再执行同一组检查：

```sh
.venv/bin/python scripts/check_templates.py
ANKI_RENDER_OUTPUT=build/cards.json .venv/bin/python -m unittest discover -s tests -v
node tests/test_browser.cjs
node --test tests/test_tools.mjs
ANKI_PYTHON=.venv/bin/python node tests/test_tools_browser.cjs
```

Python 测试会在临时目录重建并比较源码、安装包与预览，并验证重复导入、五个类型的模板 / 内容更新及排程保留。`ANKI_RENDER_OUTPUT` 还输出 `build/cards.json`、选择 / 导图测试数据和 `anki-web.json`；`test_browser.cjs` 依赖这些文件，需先完成 Python 测试。`mindmap_browser.cjs` 由它调用，无需单独运行。

`test_tools.mjs` 检查网页数据、文本往返与 ZIP；`test_tools_browser.cjs` 检查实际编辑、预览、导入预检、图片分组、下载、存储恢复 / 冲突和小屏浅深色布局。浏览器实际下载的 ZIP 再经官方后端导入，核对字段、GUID、标签、牌组与空卡。`ANKI_PYTHON` 指定这一步的 Python；CI 使用环境默认 Python。

Windows 使用 `py -3.12 -m venv .venv`，将命令中的 `.venv/bin/python` 换成 `.venv\Scripts\python.exe`。PowerShell 不支持上面的行首环境变量写法，相关测试改为：

```powershell
$env:ANKI_RENDER_OUTPUT = "build/cards.json"
.venv\Scripts\python.exe -m unittest discover -s tests -v
$env:ANKI_PYTHON = ".venv\Scripts\python.exe"
node tests/test_tools_browser.cjs
```

其他不带行首环境变量的检查命令照常运行。

问答、选择、填空和遮挡示例取自其他项目的公开说明，修改时核对来源链接与答案，保留 GUID。流程图为公开规则生成步骤的示意图；不引用节点、订阅、凭据或实际持仓。思维导图只用通用格式示例。README 中的字段示例应与 `samples.json` 一致。

示例或外观变化且测试通过后，运行 `ANKI_SCREENSHOTS=1 node tests/test_browser.cjs` 更新 README 的三张截图。截图读取同一份预览内容，切勿另外编写展示模板；图片保存在仓库根目录，随示例一起提交。PowerShell 先设置 `$env:ANKI_SCREENSHOTS = "1"`，再运行 `node tests/test_browser.cjs`。纯文档或仅网页制卡界面的修改不需要重建公共示例包或卡片截图。

## 预览与发布

```sh
python3 -m http.server 8000
```

打开 <http://localhost:8000/preview.html> 或 <http://localhost:8000/tools.html>；需使用 HTTP / HTTPS 加载数据与模块。`index.html` 跳转到示例预览。预览使用 Anki 后端生成的 HTML、共用样式和媒体；返回当前正面时仅添加 `data-review-resume`，保留同一次选择。普通浏览器不支持原生遮挡 API，遮挡题只显示导入提示。

视口选项在自适应宽度与 390px 手机宽度之间切换，小屏仍限制在页面宽度内。切换只改变同一个 iframe 的宽度，不重新渲染卡片，当前选择和正反面保持不变。浏览器检查覆盖桌面及 320、360、375、390、430px 手机宽度。

GitHub Pages 使用仓库 Settings → Pages 中的「Deploy from a branch」，来源为 `main` / 根目录；保留 `.nojekyll`，使以下划线开头的媒体正常发布。推送即触发 Pages 发布；`.github/workflows/check.yml` 只做检查，不构建或提交发布产物，也不阻止 Pages 先行部署，因此应在推送前完成相关验证。

发布模板或示例改动时，一起提交源码、重新生成的 `downloads/anki-template.apkg` 和 `preview-cards.json`，有外观变化再附带截图。推送后分别确认 Template Check 和 Pages 部署成功，并打开在线预览、制卡工具及下载链接检查；当前发布不依赖 GitHub Release 或额外前端打包步骤。

## 思维导图

`templates/mindmap/front.html` 和 `back.html` 只放字段与容器，两面各加载一次 `media/_mindmap.js`，不嵌入 `FrontSide`。`templates/mindmap/style.css` 通过 `note-types.json` 的可选 `css` 配置附加到该类型的样式。其他类型的样式与脚本不加载导图逻辑；预览的同一条生成数据携带附加样式，无需另一个构建系统。

数据使用普通 `ul/ol > li` 嵌套列表和原生 Cloze。解析、卡片编号和排程由 Anki 负责，脚本只消费 `.cloze` / `.cloze-inactive` 的 `data-ordinal` 和正面 `data-cloze`。不另写 Cloze 解析器；需要提供这些标记的现代客户端。标记不完整时保留原生输出，不启用交互工具。嵌套挖空和将整棵列表包进挖空不属于支持的录入格式。六层以后的分支停止累计缩进，并显示层数，避免挤出手机屏幕。

脚本内部按原生输出规范化、节点关系、答案控制、搜索索引、临时状态、委托事件依次组织。父节点和子列表只建立一次引用；箭头修改 `hidden` / `aria-expanded`，答案内容不被反复创建。搜索一次缓存节点文本，提交查询后标记命中文字，支持跨格式边界。↑ / ↓ 只打开祖先并滚动，不修改答案状态。没有框架、第三方运行库、网络请求、全局事件、轮询或观察器。

`sessionStorage` 只保存当前卡片的内容指纹、折叠索引、定位、搜索及显隐状态。新正面覆盖这一条状态；翻面默认揭示本卡编号，保留可匹配的路径和搜索。重复背面保留主动显隐操作。状态不会写入字段或长期存储。存储被禁用或两面 WebView 不共享存储时使用默认展开路径；不会影响原生卡片生成与背面答案。

`tests/test_mindmap.py` 使用官方后端生成单层、普通文本、多层、80 层、2,001 节点 / 100 挖空、空节点、富文本、图片及长文本卡片，现有 `tests/test_browser.cjs` 调用 `mindmap_browser.cjs` 测试两个引擎。覆盖独立显隐、全部显隐、定位 / 循环导航、折叠路径、中文 / 英文 / 混排、跨格式搜索、无结果、结果循环、存储禁用、重复初始化、翻面、小屏和深色模式。

章节场景另外覆盖总览图片、个人备注节点、纯图片 / 文字与图片混合 Cloze、同节点多个挖空和图片节点的子节点，只使用项目自己的测试图。官方后端导出再导入验证媒体、原始字段、三张独立卡片与完整知识树；浏览器验证 `src` / `alt` / 尺寸属性、实际图片节点身份、反复显隐后的 DOM 数量、搜索不改图片或揭示答案，以及翻面、小屏、夜间模式不改变原图颜色。正面的图片答案来自 Anki 编码后的 `data-cloze`，背面来自原生 `<img>`；初始化包装一次，显隐只切换 `hidden`。搜索索引仅包含文字节点，不包含图片 `alt`，不提供 OCR。

## 网页制卡工具

入口 `tools.html`，界面样式 `tools/style.css`，行为 `tools/app.mjs`。`data.mjs` 读取同一份 `note-types.json`，负责原生字段、工作空间版本、GUID、静态内容检查、CSV / TSV 与外部 AI 提示词；`storage.mjs` 用单条 IndexedDB 记录与事务内版本检查避免多页静默覆盖；`zip.mjs` 只写标准无压缩 ZIP，不读集合或维护 SQLite。没有新增前端运行依赖。

`preview.mjs` 对字段做静态视图清理，问答 / 选择替换原模板字段并加载原 `_review.js`；Cloze / 遮挡 / 导图只显示字段，不另写原生答案渲染器。原字段仅在编辑时变化，HTML 与富文本之间切换不丢原文。检查规则不判断知识正确性。新增类型或字段应改公共规格并同步规则、文档和测试，不新建网页专属映射。

工作空间 `format=anki-template-workspace, version=1` 包含 `deck / notes / media`。笔记 `type` 使用公共规格 key，`fields` 按公共规格同名并规范化排序，`tags` 为原生数组；GUID 创建后保持不变，复制另建身份。媒体用内容 SHA-256 前 32 个十六进制字符命名，base64 保留在 JSON，字段只引用平铺文件名。安全检查拒绝活动 HTML、远程图片、媒体路径及哈希冲突。受支持媒体格式和大小限制见 [AUTHORING](AUTHORING.md#保存与备份)。项目自带的 `_rule-build.svg` 由公共媒体提供，不属于用户图片上传格式。

`--input` 复用 `build_package.py` 的模型、临时集合、媒体和官方导出路径；`scripts/authoring.py` 独立校验网页 JSON。自制笔记不能覆盖公共下载、预览或输入备份；默认无参数构包行为不变。原生遮挡保留 stock 标记与字段 tag，原生 Cloze 分卡完全由后端生成。包内笔记时间戳与构包时间一致，用于相同 GUID 更新；测试用明确时间戳，正常构包用当前秒。

`tests/authoring_fixture.mjs` 直接调用网页数据与 ZIP 函数，Python `test_authoring.py` 验证五类 TSV、JSON 构包、官方预览、媒体 / GUID / 字段、重复导入与排程，并拒绝无效输入和危险输出路径。浏览器检查的入口与执行顺序见 [生成与检查](#生成与检查)。

如需截取制卡界面，设置 `AUTHORING_SCREENSHOT=/绝对路径/authoring.png` 后运行 `test_tools_browser.cjs`；截图来自实际工具。不要用单独的展示页面代替。PowerShell 用 `$env:AUTHORING_SCREENSHOT` 设置路径。

Anki 文本导入器拒绝空的模型首字段，即使调换列映射也一样。因此 `ankiTSV` 拒绝空首字段，不自动补标题或丢笔记；导图空标题仍可通过 JSON 构包，原生语义由测试确认。

## 验证边界

自动检查使用临时 Anki 集合、官方后端渲染与 reviewer 资源、Chromium / WebKit 和合成触摸事件；测试不会读取个人集合。CI 的具体版本以工作流为准，浏览器检查不能代替 Anki Desktop GUI、AnkiMobile 或 AnkiDroid 真机验证。

客户端复核应确认安装与更新选项、原生遮挡编辑器、媒体同步、实际复习、导图翻面定位（客户端可能再次自动滚动）、两面 WebView 状态共享、滚动手势不触发按钮及夜间类。制卡页面还需人工检查触屏画框、富文本粘贴 / 缩进和输入法。大工作空间、浏览器存储配额与异常图片未穷尽；浏览器性能测量不能代表手机帧率。
