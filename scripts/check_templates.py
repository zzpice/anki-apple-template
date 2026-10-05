"""检查真实模板、字段、静态媒体、脚本语法和预览入口。"""

import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def check():
    specs = json.loads((ROOT / "note-types.json").read_text())
    assert len({spec["id"] for spec in specs}) == len(specs)
    for spec in specs:
        fields = set(spec["fields"]) | {"FrontSide", "Tags"}
        assert len(fields) == len(spec["fields"]) + 2
        for side in ("front", "back"):
            source = (ROOT / spec[side]).read_text()
            stack = []
            for token in re.findall(r"{{(.*?)}}", source):
                if token.startswith(("#", "^")):
                    stack.append(token[1:])
                elif token.startswith("/"):
                    assert stack and stack.pop() == token[1:], spec[side]
                name = token.lstrip("#/^").split(":")[-1]
                assert name in fields, f"{spec[side]}: unknown field {name}"
            assert not stack, f"{spec[side]}: unclosed conditions"
            if side == "back":
                assert 'id="answer"' in source
            for media in re.findall(r'<script src="([^"]+)"', source):
                assert media.startswith("_") and (ROOT / "media" / media).is_file(), media
            for script in re.findall(r"<script>(.*?)</script>", source, re.S):
                assert "{{" not in script, f"{spec[side]}: field inside JavaScript"
    for path in (ROOT / "media").glob("*.js"):
        assert "{{" not in path.read_text()
        subprocess.run(["node", "--check", str(path)], check=True)
    preview = (ROOT / "preview.html").read_text()
    for script in re.findall(r"<script>(.*?)</script>", preview, re.S):
        subprocess.run(["node", "--check"], input=script, text=True, check=True)
    assert 'preview-cards.json' in preview and 'style.css' in preview
    for file in ("index.html", "preview.html", "downloads/anki-apple-template.apkg", ".nojekyll"):
        assert (ROOT / file).is_file(), file
    css = (ROOT / "style.css").read_text()
    assert "@import" not in css and "url(" not in css
    print("Template Check passed")


if __name__ == "__main__":
    check()
