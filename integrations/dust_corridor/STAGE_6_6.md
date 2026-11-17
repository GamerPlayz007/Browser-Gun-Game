# Stage 6.6 — original-detail performance pass

## Why loading was expensive

In Stage 6.5 every browser regenerated the entire author's procedural map,
converted all source geometry arrays, and built a ~96k-triangle collision tree
on every map entry. Huge unpartitioned render batches had bounds covering most
of the district, so geometry outside the viewing frustum stayed in the GPU's
workload.

## Changes

- Build-time original `MapGenerator` produces **all** original triangles and
  environmental definitions. No architecture, props, foliage, facades or
  authored surface meshes are removed.
- An offline pack splits the exact indexed geometry into 32 m spatial draw
  sections. Each triangle is assigned once, and the index/vertex remap is
  checked with an order-independent triangle-position fingerprint. Culling
  discards off-screen sections; nearby visual detail is unchanged.
- Geometry uses compact GPU-native attributes: original f32 positions/UV,
  normalized signed 16-bit normals, normalized 8-bit colors/wear, 8-bit
  material-layer IDs, and 16/32-bit indices. Encoding slightly quantizes
  normals/colors without changing layout or polygon density.
- The precompiled scene, original cloth/cables, building footprints, and
  unchanged `DUSTCOL3` physics soup load through native gzip in
  `static/dust_source66.js`. Missing packs/older browsers fall back to the
  **actual** original `MapGenerator`, never a blocky replacement.
- The loader caches the decoded district for subsequent match or preview
  entry; a shared `WeakMap` caches the corresponding original BVH across
  normal game and walking preview.
- Automatic and Performance quality never trigger expensive original shader
  texture-bake compilation. All scene props and cloth remain present; cloth
  vertex animations update at 15–22 Hz on low-end modes rather than every
  60–144 Hz frame. First-person motion remains full frame rate.
- Selecting Dust Corridor in the lobby opportunistically starts the scene
  download, so loading overlaps room setup. Ordinary maps do not pay the
  scene load cost.
- CI verifies complete original triangle/attribute coverage and original
  dynamic component counts. Chromium must demonstrate `packedScene: true`
  in both original-map exploration and live two-player matches.

## Quality and compatibility

No FPS target is guaranteed on a particular GPU. The measured transfer size,
start-up cost, draw-call count, and observed browser performance remain
hardware-dependent. Existing Daybreak/Neon games and Python 60Hz authoritative
physics stay unchanged. More demanding visual shaders belong to Stage 6.7.

Run:
```sh
node scripts/export_dust_collision63.mjs
node scripts/pack_dust_scene66.mjs
node test_dust_scene66.mjs
python build_map.py
python test_dust_browser65.py
```

Upstream MIT attribution: `integrations/dust_corridor/LICENSE`.
