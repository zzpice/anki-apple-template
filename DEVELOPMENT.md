# 维护说明

## 源码与标识

`note-types.json` 定义笔记类型、字段顺序和模板路径；`samples.json` 保存示例内容及固定 GUID。`scripts/build_package.py` 用官方 Anki 后端生成安装包和预览数据，只操作临时集合。

四个类型为问答、选择、填空和图片遮挡。问答与选择分别使用独立字段和正面，共用背面、样式和脚本。

保留笔记类型 ID、字段 ID、模板 ID、示例 GUID 和字段顺序，确保重复导入和后续更新识别同一结构。字段 ID 为类型 ID × 100 + 序号 + 1，模板 ID 为类型 ID × 100。牌组 ID 也保持固定；导入后 Anki 可能按牌组名称映射到用户集合中的 ID。

填空使用原生 Cloze。图片遮挡从原生 Image Occlusion 类型生成，须保留 `originalStockKind` 和字段 `tag`，以便客户端编辑器识别。

## 字段与手动安装

问答填写 `问题` 和 `答案`。选择的 `选项` 用 `||` 分隔，至少两项、最多 26 项；`答案` 按录入顺序填写字母，如 `C`、`ABD`。`题型` 留空或填 `单选` 为单选，多选填 `多选`，判断填 `判断`。判断题写 `正确||错误`，答案为 `A` 或 `B`。

单选、多选每次复习随机排序；判断和带 `固定顺序` 标签的笔记保持原顺序。脚本区分原始选项标识与显示字母，答案始终按原始标识映射到排序后的内容。

当前排序和选择只占用一个 `sessionStorage` 条目：翻面继续读取并保留，开始下一张正面时清除。存储不可用时改用题目内容生成确定性排序，正反面仍一致，但不能保留已选项。背面模板的 `data-review-back` 标记让嵌入的正面脚本识别翻面，不提前清除状态。

问答、选择和填空的 `解析` 在背面直接显示，`补充` 默认折叠，`章节` 位于正面顶部，`来源` 位于背面底部。这些字段均可留空。

图片遮挡的 `Occlusion`、`Image` 由编辑器维护；`Header` 为题干，`Back Extra` 为背面解析，`Comments` 为折叠补充。各类型的 Anki 标签均显示在背面。

手动安装时，在 Anki 中复制 Basic、Cloze 或 Image Occlusion 类型，按 `note-types.json` 配置字段，将相应正反面和 `style.css` 填入「卡片」窗口，再将 `media/` 内的文件放入 `collection.media` 并同步。图片遮挡保留原生字段及内部标记，推荐直接导入安装包。

普通内容图片可点击放大；无需放大的图片可添加 `class="no-zoom"`。字体、行高、正文宽度和颜色在 `style.css` 顶部修改。

## 生成与检查

使用 Python 3.12 安装生成依赖并检查：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-build.txt
.venv/bin/python scripts/build_package.py
.venv/bin/python scripts/check_templates.py
.venv/bin/python -m pip install --no-deps -r requirements-test.txt
ANKI_RENDER_OUTPUT=build/cards.json .venv/bin/python -m unittest discover -s tests -v
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium webkit
node tests/test_browser.cjs
```

检查需要 Node.js，CI 使用 Node.js 22。`aqt` 仅提供测试用的官方 reviewer 资源，使用 `--no-deps` 安装。依赖只用于生成和测试。

Windows 将 `.venv/bin/python` 换成 `.venv\Scripts\python.exe`；PowerShell 先设置 `$env:ANKI_RENDER_OUTPUT = "build/cards.json"`，再运行测试命令。

检查包含源码与安装包、预览的一致性，重复导入，四个类型的内容及排程更新，随机排序与答案映射，以及浏览器布局和交互。浏览器检查覆盖移动屏幕尺寸与浅深色，不能代替 AnkiMobile、AnkiDroid 的设备测试。

示例取自其他项目的公开说明，修改时核对来源链接与答案，保留 GUID。流程图为公开规则生成步骤的示意图；不引用节点、订阅、凭据或实际持仓。README 中的字段示例应与 `samples.json` 一致。

安装包和预览生成、测试通过后，运行 `ANKI_SCREENSHOTS=1 node tests/test_browser.cjs` 更新 README 的两张截图。截图读取同一份预览内容，切勿另外编写展示模板；图片保存在仓库根目录，随示例一起提交。PowerShell 使用 `$env:ANKI_SCREENSHOTS = "1"` 设置开关。

## 预览与发布

```sh
python3 -m http.server 8000
```

打开 <http://localhost:8000/preview.html>。预览使用 Anki 后端生成的 HTML、共用样式和媒体；返回当前正面时仅添加 `data-review-resume`，保留同一次选择。普通浏览器不支持原生遮挡 API，遮挡题只显示导入提示。

视口选项在自适应宽度与 390px 手机宽度之间切换，小屏仍限制在页面宽度内。切换只改变同一个 iframe 的宽度，不重新渲染卡片，当前选择和正反面保持不变。浏览器检查覆盖桌面及 320、360、375、390、430px 手机宽度。

GitHub Pages 从 `main` 根目录发布。保留 `.nojekyll`，使以下划线开头的媒体正常发布。安装包存放在 `downloads/anki-template.apkg`，随源码提交；更改模板或示例后，同时生成并提交安装包和 `preview-cards.json`。
