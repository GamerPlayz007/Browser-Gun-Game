"""Guard against a repeat of the Octavus blank-lobby regression.

Browser ES modules are imported *before* game.js executes. A single missing
import (previously three/addons/loaders/OBJLoader.js) prevents all JavaScript
from initializing, leaving the arena selector empty and the button disabled.

This check walks both static and literal dynamic module imports reachable from
the game's entry point, including the paths resolved by the HTML import map.
"""
from collections import deque
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
STATIC=(ROOT/"static").resolve()
ENTRY=STATIC/"game.js"
FROM=re.compile(r"\bfrom\s*['\"]([^'\"]+)['\"]")
DIRECT=re.compile(r"(?:^|\n)\s*import\s*['\"]([^'\"]+)['\"]")
DYNAMIC=re.compile(r"\bimport\s*\(\s*['\"]([^'\"]+)['\"]\s*\)")
IMPORTED=(FROM,DIRECT,DYNAMIC)

def resolve_module(base,name):
    if name=="three":return STATIC/"vendor/three.module.js"
    if name.startswith("three/addons/"):
        return STATIC/"vendor/addons"/name.removeprefix("three/addons/")
    if name.startswith(("./","../")):return (base.parent/name).resolve()
    if name.startswith(("/static/",)):
        return ROOT/name.lstrip("/")
    if name.startswith(("http://","https://")):return None
    # No opaque package resolution is permitted by the existing import map.
    raise ValueError(f"Unsupported browser bare module: {name} in {base}")

def main():
    seen=set()
    outstanding=deque([ENTRY])
    failures=[]
    while outstanding:
        file=outstanding.popleft().resolve()
        if file in seen:continue
        seen.add(file)
        if not file.is_relative_to(STATIC):
            failures.append(f"Invalid import outside /static: {file}")
            continue
        if not file.is_file():
            failures.append(f"MISSING imported module: {file.relative_to(ROOT)}")
            continue
        try:source=file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            failures.append(f"Invalid JavaScript UTF-8: {file.relative_to(ROOT)}")
            continue
        specs=set()
        for pattern in IMPORTED:
            specs.update(match.group(1) for match in pattern.finditer(source))
        for spec in sorted(specs):
            try:resolved=resolve_module(file,spec)
            except ValueError as e:
                failures.append(str(e));continue
            if resolved is not None:outstanding.append(resolved)
    for f in failures:print("ERROR:",f,file=sys.stderr)
    print(f"Browser import graph: {len(seen)} modules checked, "
          f"{len(failures)} missing/invalid imports.")
    if failures:sys.exit(1)

if __name__=="__main__":main()
