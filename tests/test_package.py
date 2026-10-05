"""安装包完整性与 Anki 官方后端的导入、更新、渲染回归检查。"""

import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from anki.collection import Collection
from anki.import_export_pb2 import ImportAnkiPackageRequest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import build_package as package


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)

    def collection(self):
        collection = Collection(str(self.directory / "collection.anki2"))
        self.addCleanup(collection.close)
        self.import_into(collection, package.OUTPUT)
        return collection

    @staticmethod
    def import_into(collection, path):
        collection.import_anki_package(ImportAnkiPackageRequest(package_path=str(path)))
        # 无 GUI 的后端调用也需要刷新 Python 的笔记类型缓存。
        collection.models._clear_cache()

    def assert_archive(self, path):
        with zipfile.ZipFile(path) as archive:
            # genanki 的 legacy 格式，不依赖现代客户端的 zstd 包格式。
            self.assertIn("collection.anki2", archive.namelist())
            media = json.loads(archive.read("media"))
            self.assertEqual(set(media.values()), set(package.media_names()) | {package.LICENSE_NAME})
            for index, name in media.items():
                expected = package.read_source("LICENSE") if name == package.LICENSE_NAME else package.read_source(name)
                self.assertEqual(archive.read(index), expected.encode("utf-8"))
            database = self.directory / "package.anki2"
            database.write_bytes(archive.read("collection.anki2"))
        with sqlite3.connect(database) as connection:
            self.assertEqual(connection.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            models, decks = connection.execute("SELECT models, decks FROM col").fetchone()
            model = json.loads(models)[str(package.MODEL_ID)]
            self.assertEqual(model["name"], package.MODEL_NAME)
            self.assertEqual([field["name"] for field in model["flds"]], list(package.FIELDS))
            self.assertEqual(model["tmpls"][0]["qfmt"], package.read_source("front.html"))
            self.assertEqual(model["tmpls"][0]["afmt"], package.read_source("back.html"))
            self.assertEqual(model["css"], package.read_source("style.css"))
            self.assertEqual(model["req"], [[0, "all", [0]]])
            self.assertEqual(json.loads(decks)[str(package.DECK_ID)]["name"], package.DECK_NAME)
            expected = {package.sample_guid(s["key"]): s for s in package.samples()}
            rows = connection.execute("SELECT guid, mid, flds, tags FROM notes").fetchall()
            self.assertEqual({row[0] for row in rows}, set(expected))
            for guid, model_id, fields, tags in rows:
                self.assertEqual(model_id, package.MODEL_ID)
                self.assertEqual(fields.split("\x1f"), [expected[guid]["fields"][name] for name in package.FIELDS])
                self.assertEqual(set(tags.split()), set(expected[guid]["tags"]))
            self.assertEqual(connection.execute("SELECT count(*) FROM cards WHERE type=0 AND queue=0 AND reps=0").fetchone()[0], len(expected))

    def test_download_matches_all_sources(self):
        self.assert_archive(package.OUTPUT)

    def test_generator_matches_all_sources(self):
        self.assert_archive(package.build_package(self.directory / "rebuilt.apkg"))

    def test_native_import_and_render(self):
        collection = self.collection()
        self.assertEqual(collection.note_count(), len(package.samples()))
        model = collection.models.by_name(package.MODEL_NAME)
        self.assertEqual(model["id"], package.MODEL_ID)
        self.assertEqual(model["req"], [[0, "any", [0]]])
        for name in package.media_names():
            self.assertEqual((Path(collection.media.dir()) / name).read_bytes(), (package.ROOT / name).read_bytes())
        fixtures = {}
        for sample in package.samples():
            card_id = collection.db.scalar("SELECT c.id FROM cards c JOIN notes n ON n.id=c.nid WHERE n.guid=?", package.sample_guid(sample["key"]))
            card = collection.get_card(card_id)
            fixtures[sample["key"]] = {"front": card.question(), "back": card.answer()}
            self.assertNotIn(sample["fields"]["答案"], card.question())
            self.assertIn('id="answer"', card.answer())
            self.assertNotIn("{{FrontSide}}", card.answer())
        self.assertNotIn('class="tags"', fixtures["minimal"]["back"])
        self.assertNotIn('class=hint', fixtures["minimal"]["back"])
        self.assertIn('class=hint', fixtures["full"]["back"])
        self.assertEqual(fixtures["minimal"]["back"].count('class="section"'), 2)
        # 全部可选字段为空；浏览器回归使用真实 Anki 生成的 HTML。
        note = collection.new_note(model)
        note.fields = ["只有问题", "", "", ""]
        collection.add_note(note, package.DECK_ID)
        card = note.cards()[0]
        fixtures["empty"] = {"front": card.question(), "back": card.answer()}
        self.assertEqual(card.answer().count('class="section"'), 1)
        output = os.environ.get("ANKI_RENDER_OUTPUT")
        if output:
            path = Path(output)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(fixtures, ensure_ascii=False), encoding="utf-8")

    def test_reimport_preserves_progress_and_no_duplicates(self):
        collection = self.collection()
        card = collection.get_card(collection.find_cards("")[0])
        card.type = card.queue = 2
        card.ivl, card.reps, card.due = 23, 7, 100
        collection.update_card(card)
        self.import_into(collection, package.OUTPUT)
        rebuilt = package.build_package(self.directory / "rebuilt.apkg")
        self.import_into(collection, rebuilt)
        self.assertEqual(collection.note_count(), len(package.samples()))
        self.assertEqual(len(collection.find_cards("")), len(package.samples()))
        self.assertEqual(len([m for m in collection.models.all() if m["id"] == package.MODEL_ID]), 1)
        saved = collection.get_card(card.id)
        self.assertEqual((saved.type, saved.queue, saved.ivl, saved.reps, saved.due), (2, 2, 23, 7, 100))

    def test_template_update_preserves_user_content(self):
        collection = self.collection()
        model = collection.models.by_name(package.MODEL_NAME)
        note = collection.new_note(model)
        note.fields = ["用户问题", "用户答案", "用户笔记", "用户相关知识"]
        note.tags = ["用户标签"]
        collection.add_note(note, package.DECK_ID)
        css = package.read_source("style.css") + "\n/* update regression */\n"
        original = package.read_source
        with patch.object(package, "read_source", side_effect=lambda name: css if name == "style.css" else original(name)):
            updated = package.build_package(self.directory / "updated.apkg", timestamp=model["mod"] + 10)
        self.import_into(collection, updated)
        self.assertEqual(collection.models.by_name(package.MODEL_NAME)["css"], css)
        saved = collection.get_note(note.id)
        self.assertEqual(saved.fields, note.fields)
        self.assertEqual(saved.tags, note.tags)
        self.assertEqual(collection.note_count(), len(package.samples()) + 1)


if __name__ == "__main__":
    unittest.main()
