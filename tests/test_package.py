"""在临时集合中检查官方导入、媒体、排程、更新和真实预览一致性。"""

import importlib.metadata
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from anki.collection import Collection
from anki.import_export_pb2 import ImportAnkiPackageRequest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import build_package as package


class PackageTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)

    def collection(self, name="collection", source=package.OUTPUT):
        collection = Collection(str(self.directory / (name + ".anki2")))
        self.addCleanup(collection.close)
        self.import_into(collection, source)
        return collection

    @staticmethod
    def import_into(collection, path):
        collection.import_anki_package(ImportAnkiPackageRequest(package_path=str(path.resolve())))
        collection.models._clear_cache()

    def check_collection(self, collection):
        self.assertEqual(collection.note_count(), len(package.samples()))
        self.assertEqual(len(collection.find_cards("")), 11)
        self.assertIsNotNone(collection.decks.id_for_name(package.DECK_NAME))
        for spec in package.specifications():
            model = collection.models.get(spec["id"])
            self.assertEqual(model["name"], spec["name"])
            self.assertEqual([f["name"] for f in model["flds"]], spec["fields"])
            self.assertEqual(model["css"], package.read_source("style.css"))
            self.assertEqual(model["tmpls"][0]["qfmt"], package.read_source(spec["front"]))
            self.assertEqual(model["tmpls"][0]["afmt"], package.read_source(spec["back"]))
            self.assertEqual([f["id"] for f in model["flds"]],
                             [spec["id"] * 100 + i + 1 for i in range(len(spec["fields"]))])
            if spec["kind"] == "basic":
                self.assertEqual(model["req"], [[0, "any", [0]]])
            if spec["kind"] == "occlusion":
                self.assertEqual(model["originalStockKind"], 6)
                self.assertEqual([f["tag"] for f in model["flds"]], [0, 1, 2, 3, 4])
        self.assertIn(package.read_source("LICENSE").strip(), package.read_source("media/_review.js"))
        for name in package.media_names():
            self.assertEqual((Path(collection.media.dir()) / name).read_bytes(),
                             (package.ROOT / "media" / name).read_bytes())
        for sample in package.samples():
            nid = collection.db.scalar("select id from notes where guid=?", package.sample_guid(sample["key"]))
            note = collection.get_note(nid)
            self.assertEqual(note.fields, list(sample["fields"].values()))
            self.assertEqual(set(note.tags), set(sample["tags"]))
            for card in note.cards():
                self.assertIn('id="answer"', card.answer())
                self.assertNotIn("{{FrontSide}}", card.answer())
                self.assertEqual((card.type, card.queue, card.reps), (0, 0, 0))
        data = package.preview_data(collection)
        self.assertEqual(data, json.loads(package.read_source("preview-cards.json")))
        return data

    def test_download_import_and_preview(self):
        collection = self.collection()
        data = self.check_collection(collection)
        # 可独立排程的填空和原生图片遮挡，不由模板 JS 临时生成。
        for example in data:
            if example["key"] == "cloze":
                self.assertEqual(len(example["cards"]), 3)
                self.assertIn('class="cloze"', example["cards"][0]["front"])
            if example["key"] == "occlusion":
                self.assertEqual(len(example["cards"]), 2)
                self.assertIn('data-shape="rect"', example["cards"][0]["front"])
            if example["type"] == "basic":
                self.assertNotIn('data-answer', example["cards"][0]["front"])
                self.assertNotIn('review-explanation', example["cards"][0]["front"])
        if os.environ.get("ANKI_RENDER_OUTPUT"):
            path = Path(os.environ["ANKI_RENDER_OUTPUT"])
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            web = importlib.metadata.distribution("aqt").locate_file("_aqt/data/web")
            (path.parent / "anki-web.json").write_text(json.dumps(str(web.resolve())))

    def test_native_occlusion_editor_recognizes_note(self):
        collection = self.collection()
        spec = package.specifications()[2]
        indexes = collection._backend.get_image_occlusion_fields(spec["id"])
        self.assertEqual((indexes.occlusions, indexes.image, indexes.header, indexes.back_extra), (0, 1, 2, 3))
        nid = collection.db.scalar("select id from notes where guid=?", package.sample_guid("occlusion"))
        source = collection._backend.get_image_occlusion_note(nid).note
        self.assertEqual(source.image_file_name, "_memory.svg")
        self.assertEqual(source.image_data, (package.ROOT / "media/_memory.svg").read_bytes())
        self.assertEqual({group.ordinal for group in source.occlusions}, {1, 2})
        self.assertTrue(source.occlude_inactive)

    def test_rebuild_from_sources(self):
        source = package.build_package(self.directory / "rebuilt.apkg", preview=None)
        self.check_collection(self.collection("rebuilt", source))

    def test_reimport_preserves_schedule_without_duplicates(self):
        collection = self.collection()
        schedules = {}
        for index, cid in enumerate(collection.find_cards("")):
            card = collection.get_card(cid)
            card.type = card.queue = 2
            card.ivl, card.reps, card.due = 23 + index, 7, 100 + index
            collection.update_card(card)
            schedules[cid] = (2, 2, 23 + index, 7, 100 + index)
        self.import_into(collection, package.OUTPUT)
        rebuilt = package.build_package(self.directory / "rebuilt.apkg", preview=None)
        self.import_into(collection, rebuilt)
        self.assertEqual(collection.note_count(), 8)
        self.assertEqual(len(collection.find_cards("")), 11)
        for spec in package.specifications():
            self.assertEqual(len([m for m in collection.models.all() if m["name"] == spec["name"]]), 1)
        for cid, schedule in schedules.items():
            saved = collection.get_card(cid)
            self.assertEqual((saved.type, saved.queue, saved.ivl, saved.reps, saved.due), schedule)

    def test_template_update_preserves_user_notes(self):
        collection = self.collection()
        saved = []
        specs = package.specifications()
        for spec in specs:
            note = collection.new_note(collection.models.get(spec["id"]))
            note.fields = list(next(s for s in package.samples() if s["type"] == spec["key"])["fields"].values())
            note.tags = ["用户内容"]
            collection.add_note(note, collection.decks.id_for_name(package.DECK_NAME))
            saved.append(note)
        original = package.read_source
        css = original("style.css") + "\n/* update regression */\n"
        timestamp = max(collection.models.get(s["id"])["mod"] for s in specs) + 10
        with patch.object(package, "read_source", side_effect=lambda name: css if name == "style.css" else original(name)):
            rebuilt = package.build_package(self.directory / "updated.apkg", preview=None, timestamp=timestamp)
        self.import_into(collection, rebuilt)
        for spec in specs:
            self.assertEqual(collection.models.get(spec["id"])["css"], css)
        for note in saved:
            self.assertEqual(collection.get_note(note.id).fields, note.fields)
            self.assertEqual(collection.get_note(note.id).tags, note.tags)
        self.assertEqual(collection.note_count(), 11)

    def test_empty_question_is_reported_by_anki(self):
        collection = self.collection()
        model = collection.models.get(package.specifications()[0]["id"])
        note = collection.new_note(model)
        note["章节"] = "只有章节"
        note["题型"] = "多选"
        note["选项"] = "A||B"
        collection.add_note(note, collection.decks.id_for_name(package.DECK_NAME))
        self.assertNotIn('data-review="basic"', note.cards()[0].question())
        report = collection.get_empty_cards()
        self.assertIn(note.cards()[0].id, [cid for group in report.notes for cid in group.card_ids])
        self.assertEqual(model["req"], [[0, "any", [0]]])

    def test_rich_fields_are_never_inserted_into_script(self):
        collection = self.collection()
        model = collection.models.get(package.specifications()[0]["id"])
        note = collection.new_note(model)
        note["问题"] = '<p>反引号 `，引号 "，表达式 ${value} 与中文。</p>'
        note["答案"] = '<b>完整的 <code>HTML</code> 答案</b>'
        collection.add_note(note, collection.decks.id_for_name(package.DECK_NAME))
        card = note.cards()[0]
        self.assertIn(note["问题"], card.question())
        self.assertIn(note["答案"], card.answer())
        self.assertNotIn(note["答案"], card.question())


if __name__ == "__main__":
    unittest.main()
