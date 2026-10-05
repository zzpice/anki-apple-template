"""可在本地和 CI 运行的原 Template Check。需要 Python 3 和 Node.js。"""

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {
    "front.html": ("{{问题}}", "{{#Tags}}", "{{Tags}}", "{{/Tags}}"),
    "back.html": ("{{FrontSide}}", 'id="answer"', "{{答案}}", "{{笔记}}", "{{hint:相关知识}}"),
    "preview.html": (),
}


def check():
    for filename, markers in REQUIRED.items():
        source = (ROOT / filename).read_text(encoding="utf-8")
        for marker in markers:
            assert marker in source, f"{filename}: missing {marker}"
        stack = []
        for kind, name in re.findall(r"{{([#/])([^}]+)}}", source):
            if kind == "#":
                stack.append(name)
            else:
                assert stack and stack.pop() == name, f"{filename}: unbalanced section {name}"
        assert not stack, f"{filename}: unclosed sections {stack}"
        scripts = re.findall(r"<script>(.*?)</script>", source, re.S)
        assert scripts, f"{filename}: missing script"
        for script in scripts:
            assert "{{FrontSide}}" not in script, f"{filename}: FrontSide inside JavaScript"
            subprocess.run(["node", "--check"], input=script, text=True, check=True)
    css = (ROOT / "style.css").read_text(encoding="utf-8")
    for media in re.findall(r"url\(['\"]([^'\"]+)['\"]\)", css):
        assert media.startswith("_") and (ROOT / media).is_file(), f"Missing static media: {media}"
    print("Template Check passed")


if __name__ == "__main__":
    check()
