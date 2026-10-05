"""读取网页版的原生字段工作空间；不读取或写入个人集合。"""

import base64
import hashlib
from html.parser import HTMLParser
from html import unescape
import json
from pathlib import Path
import re

FORMAT = "anki-template-workspace"
MAX_BYTES = 40 * 1024 * 1024
MIME = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif"}


class StaticHTML(HTMLParser):
    """Export only static field content; detect actual attributes, not code text."""
    def __init__(self, available):
        super().__init__(convert_charrefs=True)
        self.available = available
        self.errors = []

    def handle_starttag(self, tag, attributes):
        if tag in {"script", "iframe", "object", "embed", "form", "input", "button", "textarea", "link", "meta", "style", "svg", "math", "template", "base"}:
            self.errors.append("字段含活动内容")
        for name, value in attributes:
            value = value or ""
            if name.startswith("on") or re.search(r"(?:javascript|vbscript):", re.sub(r"[\s\x00-\x1f]", "", value), re.I):
                self.errors.append("字段含活动属性")
            if name in {"srcset", "poster"} or (name == "style" and re.search(r"url\s*\(|expression\s*\(|@import|\\", value, re.I)):
                self.errors.append("字段含活动样式")
            if tag in {"img", "audio", "video", "source"} and name == "src" and value not in self.available:
                self.errors.append("缺少本地媒体：" + value)

    handle_startendtag = handle_starttag


def read_workspace(path, specs, builtin_media):
    path = Path(path)
    if path.stat().st_size > MAX_BYTES:
        raise ValueError("工作空间超过 40 MiB")
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict) or data.get("format") != FORMAT or data.get("version") != 1:
        raise ValueError("不支持的工作空间版本")
    deck = data.get("deck")
    if (not isinstance(deck, str) or not deck.strip() or re.search(r"[\x00-\x1f<>]", deck)
            or any(not part.strip() for part in deck.split("::"))):
        raise ValueError("目标牌组名称无效")
    media = {}
    if not isinstance(data.get("media"), list) or len(data["media"]) > 1000:
        raise ValueError("媒体须为数组，最多 1000 个")
    for item in data["media"]:
        if not isinstance(item, dict) or not isinstance(item.get("name"), str) or not isinstance(item.get("data"), str):
            raise ValueError("媒体须包含 name 和 data 字符串")
        name = item.get("name", "")
        if not re.fullmatch(r"at-[a-f0-9]{32}\.(png|jpg|webp|gif)", name) or name in media:
            raise ValueError("媒体名称无效或重复")
        match = re.fullmatch(r"data:(image/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]*={0,2})", item.get("data", ""))
        if not match:
            raise ValueError("媒体数据格式无效")
        mime = match[1]
        raw = base64.b64decode(match[2], validate=True)
        correct = {"image/png": raw.startswith(b"\x89PNG\r\n\x1a\n"), "image/jpeg": raw.startswith(b"\xff\xd8\xff"),
                   "image/gif": raw.startswith((b"GIF87a", b"GIF89a")), "image/webp": raw.startswith(b"RIFF") and raw[8:12] == b"WEBP"}
        if (not raw or len(raw) > 10 * 1024 * 1024 or not correct[mime]
                or name != "at-" + hashlib.sha256(raw).hexdigest()[:32] + "." + MIME[mime]):
            raise ValueError("媒体文件名、大小或内容不一致")
        media[name] = raw
    available = set(builtin_media) | set(media)
    if not isinstance(data.get("notes"), list) or not 0 < len(data["notes"]) <= 5000:
        raise ValueError("需要 1～5000 条笔记")
    records, guids = [], set()
    specifications = {s["key"]: s for s in specs}
    for index, source in enumerate(data["notes"], 1):
        if not isinstance(source, dict) or not isinstance(source.get("type"), str):
            raise ValueError(f"第 {index} 条笔记结构无效")
        spec = specifications.get(source.get("type"))
        if spec is None:
            raise ValueError(f"第 {index} 条笔记类型无效")
        guid = source.get("guid", "")
        if not isinstance(guid, str) or not re.fullmatch(r"[!-~]{1,64}", guid) or re.search(r"[\"'\\]", guid) or guid in guids:
            raise ValueError(f"第 {index} 条 GUID 无效或重复")
        guids.add(guid)
        fields = source.get("fields")
        if not isinstance(fields, dict) or set(fields) != set(spec["fields"]):
            raise ValueError(f"第 {index} 条字段不匹配")
        for name, value in fields.items():
            if not isinstance(value, str) or re.search(r"[\x00\x1f]", value):
                raise ValueError(f"第 {index} 条字段 {name} 无效")
            parser = StaticHTML(available)
            parser.feed(value)
            if parser.errors or "[sound:" in value:
                raise ValueError(f"第 {index} 条：" + (parser.errors[0] if parser.errors else "音频请在 Anki 中添加"))
        tags = source.get("tags")
        if not isinstance(tags, list) or any(not isinstance(t, str) or not t or re.search(r"[\s<>\x00-\x1f]", t) for t in tags):
            raise ValueError(f"第 {index} 条标签无效")
        if spec["kind"] == "basic":
            for name in ("问题", "答案"):
                if not re.sub(r"<[^>]+>|&nbsp;", "", fields[name]).strip() and "<img" not in fields[name]:
                    raise ValueError(f"第 {index} 条 {name} 不能为空")
        if spec["key"] == "choice":
            options, answer, kind = fields["选项"].split("||"), re.sub(r"[\s,，、]", "", unescape(re.sub(r"<[^>]+>", "", fields["答案"]))).upper(), unescape(re.sub(r"<[^>]+>", "", fields["题型"])).strip()
            if (not 2 <= len(options) <= 26 or any(not unescape(re.sub(r"<[^>]+>", "", o)).strip() and not re.search(r"<img\b", o, re.I) for o in options)
                    or kind not in ("", "单选", "多选", "判断") or not re.fullmatch("[A-Z]+", answer)
                    or len(set(answer)) != len(answer) or any(ord(c) - 65 >= len(options) for c in answer)
                    or (kind != "多选" and len(answer) != 1)
                    or (kind == "判断" and fields["选项"] != "正确||错误")):
                raise ValueError(f"第 {index} 条选择题字段无效")
        if spec["kind"] == "cloze":
            value = fields["内容" if spec["key"] == "mindmap" else "正文"]
            if not re.search(r"{{c[1-9]\d*::", value) or re.search(r"{{c0\d*::|{{c\d+::\s*(?:::.*?)?}}", value):
                raise ValueError(f"第 {index} 条需要非空原生挖空")
            if spec["key"] == "mindmap" and any(re.search(r"<(?:ul|ol|li)\b|{{c\d+::[\s\S]*{{c\d+::", token, re.I)
                    for token in re.findall(r"{{c\d+::[\s\S]*?}}", value)):
                raise ValueError(f"第 {index} 条导图挖空不能包含列表或另一处挖空")
        records.append({"key": guid, "guid": guid, "type": spec["key"], "fields": {name: fields[name] for name in spec["fields"]}, "tags": list(dict.fromkeys(tags)),
                        "label": re.sub(r"<[^>]+>", "", next((v for v in fields.values() if v.strip()), spec["name"]))[:80]})
    return deck.strip(), records, media
