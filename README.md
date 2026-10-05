# Anki 模板

个人日常复习用的 Anki 模板，支持问答、选择、填空、原生图片遮挡和思维导图。配套网页工具可整理自己的笔记，导入 Anki 后复习。

[**项目首页**](https://zzpice.github.io/anki-template/) · [下载安装包](https://zzpice.github.io/anki-template/downloads/anki-template.apkg) · [网页制卡](https://zzpice.github.io/anki-template/tools.html) · [在线预览](https://zzpice.github.io/anki-template/preview.html) · [使用说明](docs/usage.md)

[![Template Check](https://github.com/zzpice/anki-template/actions/workflows/check.yml/badge.svg)](https://github.com/zzpice/anki-template/actions/workflows/check.yml)

## 开始使用

1. 下载 `.apkg`，在 Anki Desktop 的「文件 → 导入」中打开，安装五个笔记类型、媒体和「Anki 模板 · 示例」牌组。
2. 先复习示例，或在「添加」中选择自己的牌组和笔记类型，填写字段。也可在网页制卡工具中编辑，再导出并导入 Anki；网页草稿与 Anki 通过文件交换，不会自动同步。
3. 使用手机或 AnkiWeb 时，先在客户端导入，再同步。图片遮挡需要支持原生遮挡的 Anki 客户端。

## 支持的卡片

| 类型 | 用途 |
| --- | --- |
| 问答 | 正面回忆，背面核对答案与解析 |
| 选择 | 单选、多选、判断；答案按录入顺序填写，单选和多选默认随机排序 |
| 填空 | Anki 原生 Cloze，同编号一起遮住，不同编号生成不同卡片 |
| 图片遮挡 | 用 Anki 原生编辑器遮住图片局部；网页工具可绘制矩形遮挡 |
| 思维导图 | 嵌套列表与原生 Cloze，保留层级上下文，支持折叠、搜索和逐处揭示 |

字段使用 Anki / HTML 富文本，支持图片、表格和代码；模板不解析 Markdown。卡片可在 Anki 中离线复习，浅深色跟随客户端外观。

在线预览可查看示例正反面、手机宽度及浅深色效果；图片遮挡在普通浏览器中显示导入提示，实际复习请在 Anki 中查看。

## 详细说明

- [Anki 使用说明](docs/usage.md)：安装、各类型字段与示例、内容格式、更新和导出备份。
- [网页制卡说明](docs/authoring.md)：编辑、图片遮挡、导入数据、JSON 备份、导入 Anki 与生成自己的 `.apkg`。草稿保存在当前浏览器，请定期下载备份。
- [维护说明](docs/development.md)：当前目录与源码职责、手动安装、生成、测试、Pages 发布及验证边界。

## 许可

[MIT](LICENSE)
