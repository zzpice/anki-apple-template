"""从实际模板生成兼容旧客户端的 .apkg，不维护另一份模板或数据库格式。"""

import argparse
import json
from pathlib import Path
import re
import tempfile

import genanki


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "downloads" / "anki-apple-template.apkg"
FIELDS = ("问题", "答案", "笔记", "相关知识")
MODEL_NAME = "Apple 风格问答"
DECK_NAME = "Apple 模板示例"
# 一次生成并固定；更新外观时不要改变，否则会产生重复笔记类型和牌组。
MODEL_ID = 1303378372
DECK_ID = 2040368695
LICENSE_NAME = "_anki_apple_template_license.txt"


def read_source(filename):
    return (ROOT / filename).read_text(encoding="utf-8")


def samples():
    return json.loads(read_source("samples.json"))


def media_names():
    return sorted(set(re.findall(r"url\(['\"]([^'\"]+)['\"]\)", read_source("style.css"))))


def sample_guid(key):
    return genanki.guid_for("zzpice/anki-apple-template", key)


def build_package(output=OUTPUT, timestamp=None):
    model = genanki.Model(
        MODEL_ID,
        MODEL_NAME,
        fields=[{"name": name} for name in FIELDS],
        templates=[{
            "name": "问答",
            "qfmt": read_source("front.html"),
            "afmt": read_source("back.html"),
        }],
        css=read_source("style.css"),
    )
    deck = genanki.Deck(DECK_ID, DECK_NAME)
    seen = set()
    for sample in samples():
        if sample["key"] in seen or set(sample["fields"]) != set(FIELDS):
            raise ValueError("示例 key 必须唯一，字段必须与实际模板一致")
        seen.add(sample["key"])
        deck.add_note(genanki.Note(
            model=model,
            fields=[sample["fields"][name] for name in FIELDS],
            tags=sample["tags"],
            guid=sample_guid(sample["key"]),
        ))
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        license_path = Path(temporary) / LICENSE_NAME
        license_path.write_text(read_source("LICENSE"), encoding="utf-8")
        media = [str(ROOT / name) for name in media_names()] + [str(license_path)]
        genanki.Package(deck, media_files=media).write_to_file(output, timestamp=timestamp)
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    print(build_package(args.output))
