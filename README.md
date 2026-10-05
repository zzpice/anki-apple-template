# Anki 模板

个人日常复习用的 Anki 模板，支持问答、选择、填空和图片遮挡。

[下载安装包](https://zzpice.github.io/anki-template/downloads/anki-template.apkg) · [在线预览](https://zzpice.github.io/anki-template/)

[![Template Check](https://github.com/zzpice/anki-template/actions/workflows/check.yml/badge.svg)](https://github.com/zzpice/anki-template/actions/workflows/check.yml)

## 使用

下载 `.apkg` 后在 Anki 中导入，即可获得四个笔记类型、所需媒体和可删除的示例牌组。添加笔记时选择自己的牌组和相应类型：

- **问答**：填写 `问题` 和 `答案`。
- **选择**：`选项` 用 `||` 分隔，`答案` 按录入顺序填字母，如 `C`、`ABD`。`题型` 留空为单选，多选填 `多选`，判断填 `判断`，选项写 `正确||错误`。
- **填空**：在 `正文` 中使用 Anki 的填空按钮，或写入 `{{c1::内容}}`。不同编号生成独立卡片，也可用于完形段落。
- **图片遮挡**：用 Anki 内置编辑器添加图片、绘制遮挡区域。

单选、多选每次复习随机排序，判断保持原顺序；添加 `固定顺序` 标签可让个别题目不随机。背面同时显示已选项和正确答案，进入下一张卡片时清除临时选择。

解析直接显示，补充默认折叠，章节、来源和标签按需填写。浅深色跟随客户端或系统外观；卡片离线可用，无需插件。

建议使用当前稳定版 Anki Desktop、AnkiMobile 或 AnkiDroid。图片遮挡需要客户端支持原生遮挡，在线预览只显示提示。AnkiWeb 用户需先在客户端导入，再同步。

更新时重新导入安装包；现有笔记类型和示例保留固定标识。想自行修改并保留样式，可先在 Anki 中复制笔记类型。

## 维护

字段和类型见 `note-types.json`，正反面在 `templates/`，共用样式在 `style.css`，媒体在 `media/`。可在 Anki 的「卡片」窗口修改模板；手动安装、测试和本地预览见 [维护说明](DEVELOPMENT.md)。

使用 Python 3.12 生成安装包：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-build.txt
.venv/bin/python scripts/build_package.py
```

修改源码后，重新生成并一起提交 `downloads/anki-template.apkg` 和 `preview-cards.json`。在线预览读取同一份卡片内容、样式和脚本。

## 许可

[MIT](LICENSE)
