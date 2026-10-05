# 仓库协作约定

- 默认直接在 `main` 修改、提交并推送；只有用户明确要求时才使用其他分支或 Pull Request。
- 保持纯 HTML、CSS、JavaScript，无框架、打包器或第三方运行时依赖。
- `front.html`、`back.html`、`style.css` 是实际 Anki 模板；`preview.html` 仅用于浏览器预览，不能代替客户端验证。
- 修改字段、交互、媒体引用或样式后必须通过现有 Template Check。
- 保持 Anki Desktop、AnkiMobile、AnkiDroid 的兼容性优先，不为视觉效果增加高维护成本。
