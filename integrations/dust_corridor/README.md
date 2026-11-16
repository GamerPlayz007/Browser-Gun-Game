# Dust Corridor — Stage 6.1 (source import)

This directory contains the original Dust Corridor environment source from
[Leonxlnx/claude-of-duty](https://github.com/Leonxlnx/claude-of-duty),
pinned to upstream commit `7f8a15ae54dd65e7ce22c80c074f9b1da7daee2f`, under the original
[MIT license](LICENSE). Source files were copied verbatim. The exact Git blob
hashes are recorded in [UPSTREAM_MANIFEST.json](UPSTREAM_MANIFEST.json).

**Not playable in CROSSFire yet.** This is a quarantined integration source
snapshot, not a separate hosted game. The existing live CROSSFire renderer,
server, Cyberpunk/Daybreak map, Neon map, lobby, controls and multiplayer are
unchanged.

## Original modules retained

- `src/world/MapGenerator.js`: district layout, streets, market lanes,
  plaza, building plots, seeded generation and spawn/cover outputs.
- `src/world/Buildings.js`, `Props.js`, `GeometryBuilder.js`,
  `Noise.js`: original facades, market decorations, detailed mesh generation.
- `src/world/MaterialLibrary.js`: all 20 surface types and procedural
  GPU material/shader logic.
- `src/world/ClothSystem.js`: original cloth and cable geometry/animation.
- `src/world/World.js`: builds the original scene and collision BVH.
- `src/physics/BVH.js`, `src/core/SeededRandom.js`,
  `src/render/FullscreenPass.js`, `src/render/shaders/noise.glsl.js`:
  supporting imports needed by these world modules.

Relative import structure is unchanged; the only external JavaScript package
required by these modules is `three` r180 (already part of CROSSFire).

Verify the verbatim source snapshot and dependency closure by running:

```sh
python integrations/dust_corridor/verify_import.py
```

## Next (not completed in this stage)

**6.2 — Native renderer adapter.** Reuse the original generated geometry
and adapt materials to CROSSFire's existing Three.js rendering pipeline. The
upstream material system uses GPU texture arrays and specialized shaders, so
a naive copy of its renderer would result in a second game engine. Preserve
the geometry and visual details, using an adapted material pipeline if needed.

**6.3 — Authoritative collision.** Upstream uses a triangle-soup BVH;
CROSSFire's server currently uses map JSON box/ramp colliders. Both browser
and server must agree on physical buildings, openings, terrain and height.
Do not discard the original environment detail just to satisfy the collider
schema.

**6.4–6.7 — Complete map.** Adapt spawns, networked matches, map selection,
minimap, performance tiers and side-by-side visual validation.

**Map registry note:** CROSSFire's `build_map.py` regenerates
`static/maps/index.json`. When this map is truly playable, register it
in the compiler as well as the client; do not add a broken lobby option now.

All original copyright and licensing notices must be retained when any
of these source modules are adapted or distributed.
