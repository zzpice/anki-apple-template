"""Mind Map keeps native Cloze generation and isolated assets; fixtures use Anki HTML."""

import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

from anki.collection import Collection

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import build_package as package


class MindMapTests(unittest.TestCase):
    def test_native_cloze_and_browser_fixtures(self):
        spec = next(s for s in package.specifications() if s["key"] == "mindmap")
        cases = {
            "single": '<ul><li>{{c1::中文 English}}</li></ul>',
            "flat": '无列表 {{c1::<b>答案</b>::提示}}',
            "loose": '<p>Heading Needle {{c1::root}}</p><ul><li>Child {{c2::leaf}}</li></ul><p>Footer needle</p>',
            "wrapper": '<div>Intro Needle<ul><li>Needle {{c1::wrapped}}</li></ul>Footer</div>',
            "mixed": '<ul><li>Root<ul><li></li><li>中文 {{c1::<b>答案</b>::提示}} / {{c1::第二}}</li>'
                     '<li>Search Need<b>le</b> and needle<ul><li>{{c2::Hidden Needle}}</li></ul></li>'
                     '<li>Image <img src="_rule-build.svg" alt="示意图"></li>'
                     '<li>' + 'Long中英Text ' * 1000 + '</li></ul></li></ul>',
            "deep": '<ul><li>Level' * 80 + '{{c1::Deep answer}}' + '</li></ul>' * 80,
            "large": '<ul><li>Large tree<ul>' + ''.join(
                f'<li>Node {i} ' + ('{{c1::Answer ' + str(i) + '}}' if i % 20 == 0 else '中英 Mixed') + '</li>'
                for i in range(2000)) + '</ul></li></ul>',
            "formatting": '<ul><li><div>Wrapped parent<ul><li><p>{{c1::child}}</p>'
                          '<table><tr><td>wide</td><td>table</td></tr></table>'
                          '<pre>' + '0123456789' * 80 + '</pre></li></ul></div></li></ul>',
        }
        with tempfile.TemporaryDirectory() as d:
            collection = Collection(str(Path(d) / "collection.anki2"))
            try:
                model = package.make_model(collection, spec, 1)
                self.assertEqual(model["type"], 1)
                self.assertEqual([f["name"] for f in model["flds"]], ["标题", "内容"])
                self.assertNotIn('_review.js', model["tmpls"][0]["qfmt"])
                rendered = {}
                for name, content in cases.items():
                    note = collection.new_note(model)
                    note["标题"], note["内容"] = name, content
                    collection.add_note(note, collection.decks.id("Test"))
                    cards = note.cards()
                    self.assertEqual(len(cards), 2 if name in ("mixed", "loose") else 1)
                    self.assertIn('data-cloze=', cards[0].question())
                    self.assertIn('data-ordinal="1"', cards[0].answer())
                    rendered[name] = [{"front": c.question(), "back": c.answer()} for c in cards]
                mixed = rendered["mixed"][0]
                self.assertEqual(mixed["front"].count('class="cloze"'), 2)
                self.assertIn('class="cloze-inactive" data-ordinal="2"', mixed["front"])
                if os.environ.get("ANKI_RENDER_OUTPUT"):
                    path = Path(os.environ["ANKI_RENDER_OUTPUT"]).parent / "mindmap-cases.json"
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(json.dumps(rendered, ensure_ascii=False), encoding="utf-8")
            finally:
                collection.close()

    def test_assets_are_exclusive_to_mindmap(self):
        for spec in package.specifications():
            if spec["key"] != "mindmap":
                self.assertNotIn('css', spec)
                for side in ("front", "back"):
                    self.assertNotIn('_mindmap', package.read_source(spec[side]))
        script = package.read_source('media/_mindmap.js')
        for token in ('fetch(', 'XMLHttpRequest', 'MutationObserver', 'localStorage', 'console.', 'keydown'):
            self.assertNotIn(token, script)


if __name__ == "__main__":
    unittest.main()
