#!/usr/bin/env bash
# Imports the UNMODIFIED Neon Zenith renderer/assets and adds CROSSFIRE's
# separate first-person adapter. This deliberately does not reconstruct art.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIN="d70ada769bf297e95e41b3d4366a1999e92efd1d"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

for executable in git node npm python3; do
  command -v "$executable" >/dev/null || { echo "Missing $executable" >&2; exit 1; }
done
echo "[CROSSFIRE] Fetching original Neon Zenith at $PIN"
git clone --quiet --no-checkout https://github.com/billpwchan/neon-zenith.git "$WORK/upstream"
git -C "$WORK/upstream" checkout --quiet "$PIN"

cp "$ROOT/integrations/crossfire_walk.js" "$WORK/upstream/src/crossfire_walk.js"

# One additive import and one hook. All original geometry, rendering and assets
# remain owned by the upstream scene.
python3 - "$WORK/upstream/src/main.js" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
s=p.read_text()
anchor="import * as THREE from 'three/webgpu';"
assert s.count(anchor)==1, "Neon entrypoint changed; stop rather than corrupt it"
s=s.replace(anchor, anchor+"\nimport { installCrossfireWalk } from './crossfire_walk.js';", 1)
needle="window.__nz = { renderer, scene, camera, post, gov, city, lightmap, fly, U, ground, facadeKit, shopKit, district, kite, rig, input, traffic, game, runs, shards, sound, hud, screens, ready: true, backend: renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl' };"
assert s.count(needle)==1, "Neon boot API changed; manual upstream review needed"
s=s.replace(needle, needle+"\n  if (params.has('crossfire')) installCrossfireWalk(window.__nz);")
p.write_text(s)
PY

echo "[CROSSFIRE] Building native Neon scene (no texture or geometry downgrade)"
(cd "$WORK/upstream" && npm ci --no-audit --no-fund && npm run build -- --base=/neon/ --outDir="$ROOT/static/neon")

cp "$WORK/upstream/LICENSE" "$ROOT/static/neon/NEON_ZENITH_LICENSE.txt"
cp "$WORK/upstream/CREDITS.md" "$ROOT/static/neon/NEON_ZENITH_CREDITS.md"
echo "$PIN" > "$ROOT/static/neon/UPSTREAM_COMMIT.txt"
echo "[CROSSFIRE] Original native Neon Zenith scene ready in static/neon/"
