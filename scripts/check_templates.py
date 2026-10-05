"""检查真实模板、字段、静态媒体、脚本语法和预览入口。"""

import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
CARDS = ROOT / "cards"


def check_link(source, value):
    repository = "https://github.com/zzpice/anki-template/blob/main/"
    if value.startswith(repository):
        value = value[len(repository):]
        source = ROOT / "README.md"
    url = urlsplit(value)
    if url.scheme or url.netloc:
        return
    target = (source.parent / unquote(url.path)).resolve() if url.path else source
    assert target.is_relative_to(ROOT) and target.exists(), f"{source.relative_to(ROOT)}: missing {value}"
    if url.fragment and target.suffix == ".md":
        # GitHub heading anchors used by this repository's Markdown links.
        headings = re.findall(r"^#+ (.+)$", target.read_text(), re.M)
        anchors = {re.sub(r"[^\w\s-]", "", h.lower()).replace(" ", "-") for h in headings}
        assert unquote(url.fragment) in anchors, f"{source.relative_to(ROOT)}: missing anchor {value}"


def check_paths():
    for source in [*ROOT.glob("*.md"), *(ROOT / "docs").rglob("*.md"), *ROOT.glob("*.html")]:
        text = re.sub(r"```.*?```", "", source.read_text(), flags=re.S)
        if source.suffix == ".md":
            text = re.sub(r"`[^`]*`", "", text)
        links = re.findall(r"\]\(([^\s)]+)\)", text) if source.suffix == ".md" else []
        links += re.findall(r'<(?:a|img|script|link)\b[^>]*\b(?:href|src)="([^"]+)"', text)
        for link in links:
            check_link(source, link)
    for source in (ROOT / "web/tools").glob("*.mjs"):
        text = source.read_text()
        for link in re.findall(r"from\s+['\"]([^'\"]+)['\"]", text):
            check_link(source, link)
        for link in re.findall(r"new URL\(['\"]([^'\"]+)['\"],\s*import.meta.url\)", text):
            check_link(source, link)


def check():
    check_paths()
    specs = json.loads((CARDS / "note-types.json").read_text())
    assert len({spec["id"] for spec in specs}) == len(specs)
    for spec in specs:
        if spec.get("css"):
            css = (CARDS / spec["css"]).read_text()
            assert "@import" not in css and "url(" not in css
        fields = set(spec["fields"]) | {"FrontSide", "Tags"}
        assert len(fields) == len(spec["fields"]) + 2
        for side in ("front", "back"):
            source = (CARDS / spec[side]).read_text()
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
                assert media.startswith("_") and (CARDS / "media" / media).is_file(), media
            for script in re.findall(r"<script>(.*?)</script>", source, re.S):
                assert "{{" not in script, f"{spec[side]}: field inside JavaScript"
    for path in (CARDS / "media").glob("*.js"):
        assert "{{" not in path.read_text()
        subprocess.run(["node", "--check", str(path)], check=True)
    mindmap = (CARDS / "media/_mindmap.js").read_text()
    assert not re.search(r'\b(?:fetch|XMLHttpRequest|MutationObserver|setInterval|localStorage)\b', mindmap)
    assert "https://" not in mindmap and "console." not in mindmap
    preview = (ROOT / "preview.html").read_text()
    for script in re.findall(r"<script>(.*?)</script>", preview, re.S):
        subprocess.run(["node", "--check"], input=script, text=True, check=True)
    assert 'web/preview-cards.json' in preview and 'cards/style.css' in preview
    for file in ("index.html", "preview.html", "downloads/anki-template.apkg", ".nojekyll"):
        assert (ROOT / file).is_file(), file
    tools = (ROOT / "tools.html").read_text()
    assert './web/tools/app.mjs' in tools and './web/tools/style.css' in tools
    assert './tools.html' in preview
    assert 'note-types.json' in (ROOT / "web/tools/app.mjs").read_text()
    for path in (ROOT / "web/tools").glob("*.mjs"):
        subprocess.run(["node", "--check", str(path)], check=True)
    for file in ("AUTHORING.md", "docs/authoring.md", "tools.html", "web/tools/style.css", "web/preview-cards.json"):
        assert (ROOT / file).is_file(), file
    css = (CARDS / "style.css").read_text()
    assert "@import" not in css and "url(" not in css
    print("Template Check passed")


if __name__ == "__main__":
    check()
