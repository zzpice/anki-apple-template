# Changelog

本文件记录 Apple 风格 Anki 模板的重要变更。

格式参考 Keep a Changelog 的思路，但保持轻量，不强制语义化版本发布。

## [Unreleased]

### Added

- 新增 `preview.html` 本地预览页。
- 新增浅色、深色、跟随系统三种预览模式。
- 新增 `CHANGELOG.md`。
- 新增 MIT `LICENSE`。
- 新增 GitHub Actions 自动完整性检查。
- 新增 `.editorconfig` 与 `.gitattributes`，统一 UTF-8 / LF 与基础缩进规则。
- 新增链接和 Hint 的键盘焦点样式。
- 新增手机横屏适配。

### Changed

- 顶部标题固定为“问题”，Tags 只在独立徽标区显示，避免重复。
- 图片放大由当前位置缩放改为真正的居中 Lightbox。
- Lightbox 开启时锁定页面滚动。
- 小尺寸图片保持自然尺寸，不再强制拉伸到容器宽度。
- 表格增强改为专用横向滚动容器。
- 代码块和行内代码分别样式化，避免 `pre > code` 双重背景与边框。
- 将模板 HTML 中的视觉内联样式迁移到 `style.css`。
- 完善 Tags 长文本、Hint、深色模式和移动端细节。

### Fixed

- 修复 `.bar` 左侧语义色边框被后续 `border` 覆盖的问题。
- 为答案区加入 `id="answer"`。
- 修复背面新增 DOM 未重新增强的问题。
- 修复系统深色模式下 `u` 元素仍保留浅色高亮背景的问题。

## 2025-10-31

- 创建 Apple 风格 Anki 模板初版。
- 加入响应式图片、深色模式、表格与代码基础样式。
