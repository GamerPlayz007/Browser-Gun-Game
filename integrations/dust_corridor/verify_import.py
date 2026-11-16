"""Check the integrity and dependency closure of the pinned Dust Corridor files.

Run: python integrations/dust_corridor/verify_import.py
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parent
manifest = json.loads((root / "UPSTREAM_MANIFEST.json").read_text(encoding="utf-8"))
errors = []

# The Git SHA-1 is over a blob header plus the *exact* file bytes.
for item in manifest["files"]:
    rel = item["path"]
    path = root / rel
    if not path.is_file():
        errors.append(f"Missing: {rel}")
        continue
    data = path.read_bytes()
    payload = b"blob " + str(len(data)).encode("ascii") + b"\0" + data
    actual_sha = hashlib.sha1(payload).hexdigest()
    if actual_sha != item["upstream_git_blob_sha"]:
        errors.append(f"Upstream content mismatch: {rel}")
    if path.suffix == ".js":
        text = data.decode("utf-8")
        imports = re.findall(r"""(?:\bfrom\s+|\bimport\s+)['"](\.[^'"]+)['"]""", text)
        for spec in imports:
            dependency = (path.parent / spec).resolve()
            if not dependency.is_relative_to(root) or not dependency.is_file():
                errors.append(f"Missing relative import: {rel} -> {spec}")

if errors:
    for error in errors:
        print("FAIL:", error, file=sys.stderr)
    sys.exit(1)
print(f"OK: {len(manifest['files'])} imported files match upstream; relative imports resolve.")
