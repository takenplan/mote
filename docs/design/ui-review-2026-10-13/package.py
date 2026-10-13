"""Package only the offline review allowlist; never include exported owner notes."""
import hashlib
import json
import re
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

repo = Path(__file__).resolve().parents[3]
folder = repo / ".mote/ui-review-2026-10-13"
manifest = json.loads((folder / "manifest.json").read_text())
assert manifest["generatedOnly"] is True
names = {
    "index.html", "review.css", "review.js", "manifest.js", "manifest.json", "README.md",
    "evidence/evaluator.md", "evidence/journeys.md", "evidence/validation.md",
}
if (folder / "evidence/originality-evaluator.md").is_file():
    names.add("evidence/originality-evaluator.md")
if manifest.get("finalValidation"):
    names.add(manifest["finalValidation"])
for name in manifest.get("documents", []):
    assert name.startswith("evidence/") and name.endswith(".md")
    (folder / name).resolve().relative_to(folder.resolve())
    names.add(name)
for asset in manifest["assets"]:
    assert asset["generatedOnly"] is True
    path = (folder / asset["src"]).resolve()
    path.relative_to(folder.resolve())
    assert hashlib.sha256(path.read_bytes()).hexdigest() == asset["sha256"]
    names.add(asset["src"])
for name in names:
    if not name.endswith(".md"):
        continue
    document = folder / name
    for reference in re.findall(r"\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)", document.read_text()):
        if re.match(r"^[a-z]+:", reference, re.I) or reference.startswith("#"):
            continue
        target = (document.parent / reference.split("#", 1)[0]).resolve()
        relative_target = str(target.relative_to(folder.resolve()))
        assert relative_target in names, f"Unpackaged Markdown reference: {name}: {reference}"
target = folder.with_suffix(".zip")
with ZipFile(target, "w", compression=ZIP_DEFLATED) as archive:
    for name in sorted(names):
        archive.write(folder / name, arcname=f"{folder.name}/{name}")
with ZipFile(target) as archive:
    assert archive.testzip() is None
    for asset in manifest["assets"]:
        assert hashlib.sha256(archive.read(f"{folder.name}/{asset['src']}")).hexdigest() == asset["sha256"]
print(f"Packaged {len(names)} allowlisted review files → {target}")
