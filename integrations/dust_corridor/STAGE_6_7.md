# Stage 6.7 — Dust Corridor release polish

Dust Corridor is now an ordinary CROSSFire native multiplayer map, not an
iframe or external website. The original MIT world geometry, 284,456 visual
triangles, 96,588 physics triangles, authored buildings, stalls, props, cloth,
cables and map layout remain unchanged.

## Visual tiers

- **Performance / Auto:** Full authored geometry with lightweight, distinct
  GPU procedural surface patterns for masonry, tile, cloth, wood, metal,
  plaster, sand and asphalt. No extra texture downloads or startup baking.
- **High:** The original author's complete 20-layer GPU-generated
  albedo/normal/ORM texture arrays at 192 px per layer, when WebGL2 supports
  them.
- **Ultra / Native:** Same original 20 layers baked at 256 px per layer.
- Material baking fails safely back to the complete source geometry and
  procedural textures; unsupported graphics hardware must not produce a
  blank map.
- Switching graphics quality while in a match upgrades/downgrades material
  detail without rebuilding the 284k-triangle district or restarting the
  multiplayer session. Dynamic cloth remains visible in every mode.
- Shader baking is asynchronous and its result is discarded if the map is
  exited or quality changes during compilation.

## QA

- Stage 6.6 packed scene integrity checks remain in CI.
- Stage 6.7 verifies native scene lifecycle, no WebGL2 fallback, exact
  original triangle totals, cloth/cables, source footprints and disposal.
- Existing Chromium two-player native match, collision preview, map
  generation, movement and server integration tests remain in the build gate.
- F7 diagnostics include the map's geometry, section count, texture layer
  state and packed-scene status.

## Known limits

This release is not a guarantee of 60 FPS on every school laptop. Real
GPU frame-time measurements and visual inspection on the actual target
devices are still required. GPU shader compilation on High/Ultra is
driver-dependent and can take noticeable time; Auto and Performance avoid it.

Original source attribution: `integrations/dust_corridor/LICENSE`.
