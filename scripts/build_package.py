"""用官方 Anki 后端生成安装包和真实卡片预览；只操作临时集合。"""

import argparse
import json
from pathlib import Path
import re
import tempfile
import time

from anki.collection import Collection
from anki.import_export_pb2 import ExportAnkiPackageOptions
from anki.models import StockNotetypeKind

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "downloads/anki-template.apkg"
PREVIEW = ROOT / "preview-cards.json"
DECK_ID = 2040368696
DECK_NAME = "Anki 模板 · 示例"


def read_source(name):
    return (ROOT / name).read_text(encoding="utf-8")


def specifications():
    return json.loads(read_source("note-types.json"))


def samples():
    return json.loads(read_source("samples.json"))


def sample_guid(key):
    return next(sample["guid"] for sample in samples() if sample["key"] == key)


def media_names():
    return sorted(path.name for path in (ROOT / "media").iterdir() if path.is_file())


def make_model(collection, spec, timestamp):
    kind = {"basic": StockNotetypeKind.KIND_BASIC,
            "cloze": StockNotetypeKind.KIND_CLOZE,
            "occlusion": StockNotetypeKind.KIND_IMAGE_OCCLUSION}[spec["kind"]]
    model = json.loads(collection._backend.get_stock_notetype_legacy(kind))
    model.update(id=spec["id"], name=spec["name"], mod=timestamp, css=read_source("style.css"))
    if spec["kind"] != "occlusion":
        model["flds"] = [collection.models.new_field(name) for name in spec["fields"]]
    for index, field in enumerate(model["flds"]):
        # 固定字段标识使重建和重复导入识别为同一结构；原生遮挡保留字段 tag。
        field.update(id=spec["id"] * 100 + index + 1, ord=index)
    template = model["tmpls"][0]
    template.update(id=spec["id"] * 100, name=spec["name"],
                    ord=0, qfmt=read_source(spec["front"]), afmt=read_source(spec["back"]))
    collection.models.update(model)
    return collection.models.get(spec["id"])


def preview_data(collection):
    """只去掉后端附加的样式块；预览直接读取同一份 style.css。"""
    def without_style(html):
        return re.sub(r"^<style>.*?</style>", "", html, count=1, flags=re.S)

    result = []
    for sample in samples():
        note_id = collection.db.scalar("select id from notes where guid=?", sample_guid(sample["key"]))
        card_ids = collection.db.list("select id from cards where nid=? order by ord", note_id)
        result.append({"key": sample["key"], "label": sample["label"], "type": sample["type"],
                       "cards": [{"front": without_style(collection.get_card(cid).question()),
                                  "back": without_style(collection.get_card(cid).answer())}
                                 for cid in card_ids]})
    return result


def build_package(output=OUTPUT, preview=PREVIEW, timestamp=None):
    timestamp = int(time.time()) if timestamp is None else timestamp
    output = Path(output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        collection = Collection(str(Path(temporary) / "collection.anki2"))
        try:
            deck = collection.decks.new_deck_legacy(False)
            deck.update(id=DECK_ID, name=DECK_NAME, mod=timestamp)
            collection.decks.update(deck)
            specs = {spec["key"]: spec for spec in specifications()}
            models = {key: make_model(collection, spec, timestamp) for key, spec in specs.items()}
            seen, guids = set(), set()
            for sample in samples():
                spec = specs[sample["type"]]
                if (sample["key"] in seen or sample["guid"] in guids
                        or list(sample["fields"]) != spec["fields"]):
                    raise ValueError("示例 key 和 guid 必须唯一，字段顺序必须与 note-types.json 一致")
                seen.add(sample["key"])
                guids.add(sample["guid"])
                note = collection.new_note(models[sample["type"]])
                note.guid = sample_guid(sample["key"])
                note.fields = list(sample["fields"].values())
                note.tags = sample["tags"]
                collection.add_note(note, DECK_ID)
            for name in media_names():
                collection.media.write_data(name, (ROOT / "media" / name).read_bytes())
            data = preview_data(collection)
            collection.export_anki_package(
                out_path=str(output), limit=DECK_ID,
                options=ExportAnkiPackageOptions(with_media=True, legacy=True,
                                                with_scheduling=False, with_deck_configs=False),
            )
            if preview is not None:
                Path(preview).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        finally:
            collection.close()
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--preview", type=Path, default=PREVIEW)
    args = parser.parse_args()
    print(build_package(args.output, args.preview))
