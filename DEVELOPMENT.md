# 维护说明

## 源码与标识

`note-types.json` 定义笔记类型、字段顺序和模板路径；`samples.json` 保存示例内容及固定 GUID。`scripts/build_package.py` 用官方 Anki 后端生成安装包和预览数据，只操作临时集合。

保留笔记类型 ID、字段 ID、模板 ID、示例 GUID 和字段顺序，确保重复导入和后续更新识别同一结构。字段 ID 为类型 ID × 100 + 序号 + 1，模板 ID 为类型 ID × 100。牌组 ID 也保持固定；导入后 Anki 可能按牌组名称映射到用户集合中的 ID。

填空使用原生 Cloze。图片遮挡从原生 Image Occlusion 类型生成，须保留 `originalStockKind` 和字段 `tag`，以便客户端编辑器识别。

## 字段与手动安装

问答类型的 `问题` 为题干，`答案` 为正文或正确选项字母；`选项` 用 `||` 分隔，至少两项、最多 26 项。`题型` 可填 `单选`、`多选`、`判断`，多选必须明确填写。判断题可写 `正确||错误`，答案为 `A` 或 `B`。

问答和填空的 `解析` 在背面直接显示，`补充` 默认折叠，`章节` 位于正面顶部，`来源` 位于背面底部。这些字段均可留空。

图片遮挡的 `Occlusion`、`Image` 由编辑器维护；`Header` 为题干，`Back Extra` 为背面解析，`Comments` 为折叠补充。各类型的 Anki 标签均显示在背面。

手动安装时，在 Anki 中复制 Basic、Cloze 或 Image Occlusion 类型，按 `note-types.json` 配置字段，将相应正反面和 `style.css` 填入「卡片」窗口，再将 `media/` 内的文件放入 `collection.media` 并同步。图片遮挡保留原生字段及内部标记，推荐直接导入安装包。

普通内容图片可点击放大；无需放大的图片可添加 `class="no-zoom"`。字体、行高、正文宽度和颜色在 `style.css` 顶部修改。

## 生成与检查

按 README 安装生成依赖后运行：

```sh
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

检查包含源码与安装包、预览的一致性，重复导入，用户内容及排程保留，以及浏览器布局和交互。浏览器检查覆盖移动屏幕尺寸与浅深色，不能代替 AnkiMobile、AnkiDroid 的设备测试。

## 预览与发布

```sh
python3 -m http.server 8000
```

打开 <http://localhost:8000/preview.html>。预览使用 Anki 后端生成的 HTML、共用样式和媒体；普通浏览器不支持原生遮挡 API，遮挡题只显示导入提示。

GitHub Pages 从 `main` 根目录发布。保留 `.nojekyll`，使以下划线开头的媒体正常发布。安装包存放在 `downloads/anki-template.apkg`，随源码提交；更改模板或示例后，同时生成并提交安装包和 `preview-cards.json`。
