"""用官方 Anki 后端生成安装包和真实卡片预览；只操作临时集合。"""

import argparse
import hashlib
import json
from pathlib import Path
import re
import tempfile
import time

from anki.collection import Collection
from anki.import_export_pb2 import ExportAnkiPackageOptions
from anki.models import StockNotetypeKind

from authoring import read_workspace

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
    css = read_source("style.css")
    if spec.get("css"):
        css += "\n" + read_source(spec["css"])
    model.update(id=spec["id"], name=spec["name"], mod=timestamp, css=css)
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


def preview_data(collection, records=None):
    """只去掉后端附加的样式块；预览直接读取同一份 style.css。"""
    def without_style(html):
        return re.sub(r"^<style>.*?</style>", "", html, count=1, flags=re.S)

    result = []
    specs = {spec["key"]: spec for spec in specifications()}
    for sample in samples() if records is None else records:
        spec = specs[sample["type"]]
        note_id = collection.db.scalar("select id from notes where guid=?", sample["guid"])
        card_ids = collection.db.list("select id from cards where nid=? order by ord", note_id)
        result.append({"key": sample["key"], "label": sample["label"], "type": sample["type"],
                       **({"css": read_source(spec["css"])} if spec.get("css") else {}),
                       "cards": [{"front": without_style(collection.get_card(cid).question()),
                                  "back": without_style(collection.get_card(cid).answer())}
                                 for cid in card_ids]})
    return result


def build_package(output=OUTPUT, preview=PREVIEW, timestamp=None, workspace=None):
    timestamp = int(time.time()) if timestamp is None else timestamp
    output = Path(output).resolve()
    targets = {output, Path(preview).resolve() if preview is not None else None}
    if workspace is not None and targets & {OUTPUT, PREVIEW}:
        raise ValueError("自制笔记不能覆盖项目示例安装包或预览，请指定 build/ 下的输出路径")
    if preview is not None and Path(preview).resolve() == output:
        raise ValueError("安装包和预览必须使用不同的输出路径")
    if workspace is not None and Path(workspace).resolve() in targets:
        raise ValueError("输出不能覆盖输入 JSON 备份")
    records = samples()
    deck_name, deck_id, extra_media = DECK_NAME, DECK_ID, {}
    if workspace is not None:
        deck_name, records, extra_media = read_workspace(workspace, specifications(), media_names())
        deck_id = 4_000_000_000 + int(hashlib.sha256(deck_name.encode()).hexdigest()[:11], 16)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        collection = Collection(str(Path(temporary) / "collection.anki2"))
        try:
            deck = collection.decks.new_deck_legacy(False)
            deck.update(id=deck_id, name=deck_name, mod=timestamp)
            collection.decks.update(deck)
            specs = {spec["key"]: spec for spec in specifications()}
            models = {key: make_model(collection, spec, timestamp) for key, spec in specs.items()}
            seen, guids = set(), set()
            for sample in records:
                spec = specs[sample["type"]]
                if (sample["key"] in seen or sample["guid"] in guids
                        or list(sample["fields"]) != spec["fields"]):
                    raise ValueError("示例 key 和 guid 必须唯一，字段顺序必须与 note-types.json 一致")
                seen.add(sample["key"])
                guids.add(sample["guid"])
                note = collection.new_note(models[sample["type"]])
                note.guid = sample["guid"]
                note.fields = list(sample["fields"].values())
                note.tags = sample["tags"]
                if workspace is not None and spec["kind"] != "basic" and not note.cloze_numbers_in_fields():
                    raise ValueError("笔记缺少有效的原生挖空：" + sample["key"])
                collection.add_note(note, deck_id)
                if workspace is not None:
                    # Package updates compare note modification times. Use the
                    # same build timestamp as models, including deterministic tests.
                    collection.db.execute("update notes set mod=? where id=?", timestamp, note.id)
            for name in media_names():
                collection.media.write_data(name, (ROOT / "media" / name).read_bytes())
            for name, content in extra_media.items():
                collection.media.write_data(name, content)
            if workspace is not None:
                for sample in records:
                    if sample["type"] == "occlusion":
                        nid = collection.db.scalar("select id from notes where guid=?", sample["guid"])
                        native = collection._backend.get_image_occlusion_note(nid).note
                        if not native.occlusions or any(not o.shapes for o in native.occlusions) or native.image_file_name not in set(media_names()) | set(extra_media):
                            raise ValueError("原生遮挡或图片字段无效：" + sample["key"])
            if workspace is not None and collection.get_empty_cards().notes:
                raise ValueError("原生 Anki 检查发现空卡片，请修正后重试")
            data = preview_data(collection, records)
            collection.export_anki_package(
                out_path=str(output), limit=deck_id,
                options=ExportAnkiPackageOptions(with_media=True, legacy=True,
                                                with_scheduling=False, with_deck_configs=False),
            )
            if preview is not None:
                Path(preview).parent.mkdir(parents=True, exist_ok=True)
                Path(preview).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        finally:
            collection.close()
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="网页版导出的 JSON 工作空间")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--preview", type=Path)
    args = parser.parse_args()
    if args.input and not args.output:
        parser.error("--input 需要 --output，避免覆盖项目示例")
    try:
        print(build_package(args.output or OUTPUT, args.preview if args.input else args.preview or PREVIEW,
                            workspace=args.input))
    except (ValueError, OSError) as error:
        parser.error(str(error))
