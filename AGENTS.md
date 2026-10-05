# 仓库协作约定

- 默认直接在 `main` 修改、提交并推送；只有用户明确要求时才使用其他分支或 Pull Request。
- 保持纯 HTML、CSS、JavaScript，无前端框架、前端打包器或第三方卡片运行时依赖。
- `front.html`、`back.html`、`style.css` 是实际 Anki 模板；`preview.html` 仅用于浏览器预览，不能代替客户端验证。
- 修改字段、交互、媒体引用或样式后必须通过现有 Template Check。
- 保持 Anki Desktop、AnkiMobile、AnkiDroid 的兼容性优先，不为视觉效果增加高维护成本。
- 视觉优先服务于阅读：统一排版、留白和少量分隔线；新增装饰或交互必须有明确复习收益。
- `.apkg` 是交付文件，三个模板源码和 `samples.json` 是编辑入口；相关源码改动后重新生成安装包并通过包一致性、官方 Anki 导入和浏览器回归检查。
- 固定模型 ID、牌组 ID、示例 key 和字段顺序；构建与测试依赖只用于开发，不进入卡片运行时。
