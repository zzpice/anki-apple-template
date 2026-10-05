# 仓库协作约定

- 默认在 `main` 修改、提交并推送；用户明确要求时才使用其他分支或 Pull Request。
- 保持纯 HTML、CSS、JavaScript，卡片不依赖框架、打包器或第三方运行库。
- 模板源码位于 `note-types.json`、`templates/`、`style.css`、`media/` 和 `samples.json`。安装包与 `preview-cards.json` 由生成器产出，勿手动修改。
- 修改模板、字段、样式、媒体或示例后，重新生成安装包和预览数据，并运行静态检查、Anki 导入测试及 Chromium／WebKit 检查。命令见 `DEVELOPMENT.md`。
- 保留笔记类型、字段、模板、牌组和示例的固定标识，以及字段顺序；示例 GUID 存放在 `samples.json`。
- 填空和图片遮挡使用 Anki 原生机制。图片遮挡保留 `originalStockKind` 和字段 `tag`。
- 预览读取 Anki 生成的 HTML，共用模板样式和媒体。浏览器缺少原生遮挡 API 时隐藏图片并提示导入。
- 以日常阅读和复习为准判断改动。文案简洁，交互保持简单；区分浏览器检查和客户端设备测试。
- 开发依赖只用于生成和测试；这些操作只使用临时集合，不访问个人 Anki 数据。
