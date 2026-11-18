# Octavus — original-native geometry rebuild (Phase 1)

## Stage 1.1 — COMPLETE: lossless source-structure validation

This is an implementation record, not a claim that the live mesh has been replaced.

**Upstream:** `redeclipse/maps/octavus.mpz`, map revision **829**, CC BY-SA 3.0.
**Archived source:** `sources/octavus.original.mpz` (source SHA-256 verified).
**Parser:** `scripts/decode_octavus_octree76.py`, transcribed from
Red Eclipse's `src/engine/worldio.cpp` native MAPZ v59 reader.
**Automated checks:** `test_octavus_octree76.py` and
`.github/workflows/octavus-native-phase1.yml`.
**Machine-readable evidence:** `static/maps/octavus.native-octree-report.json`.

The decoder reads the archive's original texture-vslot records, traverses the
entire 8-root octree, identifies every empty/solid/deformed leaf, reads every
cube's six face texture identifiers, 12 edge bytes for deformed cubes,
native volume material, merged-face flags, and explicit polygon vertex payload.
All binary offsets and source topology counts are checked against the pinned
archive. It does not infer polygon faces or insert substitute triangles.

### Results from the original source archive

| Property | Verified value |
|---|---:|
| Native map world size | 8192 units |
| Source texture vslots | 223 |
| Changed texture variants | 155 |
| Leaf cubes | 704,159 |
| Empty leaf cubes | 180,887 |
| Fully solid leaf cubes | 335,303 |
| Deformed leaf cubes | 187,969 |
| Interior branches | 100,593 |
| Explicit polygon faces | 49,794 |
| Explicit vertex records | 200,878 |
| Stored octree payload | 12,875,182 bytes |
| Native vslot end offset | 107,595 |
| Native octree end offset | 12,982,777 |

These are **structural data counts**. They are **not** renderable face/triangle
counts. A cube can expose zero, one, or multiple faces, and the Red Eclipse
renderer performs neighbor visibility and face merging. The older CROSSFire
OBJ has 86,500 *rendered* triangles, which must **not** be compared to the
704,159 native leaf count.

### Why the old map is not being deleted yet

The original native world has not yet been converted into a complete
visible-surface mesh. Simply drawing all six faces of every solid/deformed cube
would create a very large incorrect mass of hidden faces and a severe
performance regression. Drawing only the 49,794 explicitly stored surfaces
would omit the source engine's implicit faces. Neither is an acceptable
replacement.

## Stage 1.2 — SOURCE GEOMETRY EXPORTED; renderer-exact parity pending

**Implemented:**
- `scripts/octavus_native_geometry77.py`: reconstructs the original
  Cube2 nibble-based deformed face vertices, implicit and explicitly stored
  polygon vertices, and merged-face origins. It uses native octree neighbors
  to cull faces completely buried behind solid cubes. All source texture
  VSlot indices and eighth-native-unit vertex precision are retained in
  the `OCN2` binary format.
- `test_octavus_native_geometry77.py`: tests native coordinates, face
  winding, solid neighbor occlusion, source vertex counts, and merged polygons.
- `.github/workflows/octavus-native-phase12.yml`: independently exports,
  checks and publishes the binary and corresponding provenance/metrics reports.

**Exported from verified Red Eclipse 2 revision 829:**

| Source-native staging artifact | Triangles | Unique vertices | Compressed |
|---|---:|---:|---:|
| All candidate faces `octavus.native-stage1.bin.gz` | 1,661,200 | 822,787 | 8,963,100 bytes |
| Architectural preview core `octavus.native-core.bin.gz` | 98,358 | 123,915 | 822,182 bytes |

The first-pass conservative culling exposes **1,562,842** triangles under
native texture VSlot **1** (`mikeplus64/plain.png`). The older original
engine's OBJ export draws only ~607 visible triangles with that texture.
This is strong evidence that the source renderer performs more aggressive
visibility and merging on that material. Blindly showing these source
candidates would cover much of the arena with wrongly exposed interior
faces. **The core omits only VSlot 1**, while retaining the full candidate
export for eventual exact reconstruction. The omitted material may contain
legitimate world surfaces, so this core is diagnostic, not the finished map.

All packed coordinates are native XYZ in exact eighths of a world unit,
with no mixing of older OBJ origins and later MPZ entity positions.
The source `OCN2` triangle records contain the exact native texture VSlot
number. Native XY is horizontal and native Z is up.

**Still required for fidelity:** Red Eclipse's full `visibletris`
partial-face occlusion handling; renderer-accurate surface merging and
concave polygon tessellation; texture/blend/UV mapping; a real visual
comparison of the game bases, roads and courtyard. The current 98,358
triangles have **not** been asserted as an exact copy of the original
renderer output.

Additional spawn-surface audit:
`scripts/audit_octavus_native_spawns78.py` writes
`octavus.native-spawn-audit.json`, comparing the native core against all
33 source MPZ player-start locations. This is a validation diagnostic,
not a replacement of server collision.

## Stage 1.3 — STANDALONE VIEWER COMPLETE; visual parity gate open

**Standalone preview route:**
[`/static/octavus-native-preview.html`](/static/octavus-native-preview.html)

This is a diagnostic page, **not** a new option in the main game's menus.
It does not replace or touch the live arena, client movement or server collision.

**Implemented and independently tested:**
- `static/octavus-native-preview.html` and
  `static/octavus-native-preview.js` load and SHA-256 verify both
  source-native `OCN2` staging meshes in a Three.js WebGL browser viewer.
- Default core preview: **98,358 triangles**, **123,915 vertices**, 195
  native material-slot IDs, presented with neutral shading rather than
  falsely applying mismatched older OBJ textures.
- Optional heavy diagnostic: **1,661,200 candidate triangles** from the
  complete original octree. Unresolved plain material VSlot 1 is marked
  untrusted and translucent; this is NOT an engine-exact render.
- Orbit, zoom, pan, top-down, first-authored-spawn camera, wireframe,
  material-ID colours, elevation colouring, original 33 MPZ spawn markers.
- Creator's official Red Eclipse 2 `octavus.png` mapshot is
  self-hosted as `static/maps/octavus.reference-source.png`, downloaded
  from the pinned upstream commit, verified against Git blob
  `6b8bfa071be14550d9fbfdb7594eb69769202786` and attributed
  under the source map's CC BY-SA 3.0 license.
- `test_octavus_native_preview79.mjs` validates every binary triangle
  index, the checksum, the missing slot-1 safety separation, and the
  source spawn metadata.
- `test_octavus_native_browser80.mjs` launches real headless Chrome
  with software WebGL, verifies 3D canvas rendering of the compact
  mesh, exercises the inspection controls and asserts all 33 original
  spawns are loaded. It captures an Octavus WebGL screenshot and a
  side-by-side original-mapshot screenshot as CI artifacts.
- `.github/workflows/octavus-native-phase13.yml` checks JavaScript
  syntax, static HTTP serving, binary data and actual browser rendering.

**Inspection limits:** An actual side-by-side view is provided, but
camera-angle alignment to the creator's source screenshot has **not** been
automatically measured. Our renderer still lacks native `visibletris`
partial-face culling, original material UVs and exact merged-face handling.
The smaller mesh deliberately omits source material slot 1; some valid
exterior surfaces may be missing. A screenshot of the viewer is **not proof
of native rendering equivalence**.

**Next required tasks before any gameplay replacement:** compare the
courtyard, dunes, entrances and ground heights interactively against the
original mapshot; correct hidden-face exposure, merged surfaces and
material/UV definitions; generate matching client and server collision;
test all player starts and routes, then benchmark multiplayer load on
both school laptops and high-end machines.

## Stage 1.4 — NATIVE SOURCE PLANE MERGING COMPLETE; FULL VISIBILITY PENDING

The source-coordinate visibility audit (scripts/audit_octavus_visibility81.py;
published as octavus.native-visibility-audit81.json) confirms:

- Original plain-material triangles: **1,562,842**
- In the native central map region: **1,555,509**
- Exactly on outer world boundaries: **488**

This proves that simply hiding the outer shell cannot fix the map.

### Geometry-preserving plane compaction

scripts/octavus_native_merge83.py reconstructs exact coplanar source
quadrilaterals and merges only *full-edge aligned* rectangles with matching
material, source plane and original winding. It verifies that the original
surface area is conserved, with no holes filled and no surfaces moved.

| Source-native candidate | Triangles | Unique vertices | Compressed bytes |
|---|---:|---:|---:|
| Raw octree staging | 1,661,200 | 822,787 | 8,963,100 |
| **Exact plane-merged staging** | **1,115,718** | **767,090** | **7,500,424** |
| Compact core (plain slot 1 omitted) | 98,358 | 123,915 | 822,182 |

The merger **removes 545,482 unnecessary triangles (~32.8%)** while
retaining all 196 original source texture-slot IDs. It is geometry
compaction, NOT proof that all remaining triangles belong on screen.

The merged archive is an optional *heavy diagnostic* in the independent
Octavus inspection viewer, never loaded by current live gameplay.
The source remains in static/maps/octavus.native-stage1.bin.gz.

The exact plane merge is independently tested in
test_octavus_native_merge83.py and the CI workflow
.github/workflows/octavus-native-merge83.yml. The workflow verifies
hashes, all triangle indices, source material conservation, untouched
non-plain triangles, and synthetic gap/winding invariants.

### Rejected conservative visibility experiment

Inspecting the original engine reveals that a deformed map cube may
still have a **fully occluding face**: source edge nibbles, not the
stored cube kind, determine coverage. The experimental
scripts/octavus_native_visibility82.py incorporates these tests and
recursive bounding-rectangle occlusion; its unit tests pass.

However its conservative full-map reconstruction **exceeded the safe
1.8-million-triangle cap** and was prevented from publishing. It is
not a usable replacement mesh and is not offered in the inspector.
Its CI now runs the verified source-invariant tests only.

### What still prevents native-renderer parity

- Original classifyface/visibletris partial-face visibility, face
  merging and polygon triangulation must be fully reconstructed.
- Original source texture UVs, blend layers and model placement remain.
- Map-view comparisons must check base buildings, courtyard, dunes,
  doors and walkable routes against the original engine.
- Client and authoritative server geometry/collision must be rebuilt
  together and benchmarked before any map switch.

**Phase 1.4 completes deterministic mesh compaction and visibility
diagnosis, not the replacement of the live multiplayer map.**

## Stage 1.5 — PARTIAL-FACE SOURCE OCCLUSION VERIFIED; NATIVE RENDERER PARITY OPEN

**Implemented and passed automated CI:**
- scripts/octavus_native_partial84.py: an independent source-native
  triangle-visibility pass. This uses the verified Red Eclipse 2 revision
  829 octree, verifies opaque adjoining *normal/deformed* faces, and
  recursively clips triangles against smaller neighboring octree cubes.
- test_octavus_native_partial84.py: verifies original-facing normals,
  exact clipping area, subdivision openings, non-opaque material handling
  and keeping recessed/sloped surfaces when visibility is uncertain.
- .github/workflows/octavus-native-partial84.yml: decodes and validates
  the resulting geometry and publishes an isolated OCN2 staging archive.
- scripts/octavus_native_optimize85.py and
  .github/workflows/octavus-native-optimize85.yml: apply the
  lossless coplanar merge AFTER the new visibility pass, so the
  independent improvements accumulate.

**Verified output (original source: 1,661,200 candidate triangles):**

| Candidate | Triangles | Unique vertices | Compressed |
|---|---:|---:|---:|
| Raw native source candidates | 1,661,200 | 822,787 | 8,963,100 B |
| Source-native partial-face proof | 1,072,281 | 701,256 | 6,411,706 B |
| **Partial visibility + exact planar merges** | **863,803** | **679,837** | **6,079,733 B** |

The native clipping removes **588,919 fully occluded triangles**,
including 588,490 from source plain-material slot 1. Unlike the
previous naive material filter, this visibility pass keeps the
genuinely exposed surfaces of slot 1 instead of deleting everything.

The lossless merge pass reduces the corrected visibility candidate
by a further **208,478 triangles**. Both phases preserve remaining
source coordinates and native material indices. The final candidate
has 97,929 non-plain triangles and 765,874 plain-material candidates.

This is a **48.0% reduction from the raw source** but is *not* final
engine visibility equivalence. In particular:
- Only fully covered source triangles are removed; partially covered
  triangles have not yet been split to hide the invisible fraction.
- Some Red Eclipse 2 visibletris partial-mask and translucent/clip
  volume semantics remain unimplemented.
- Authored texture UVs, props, source lighting, fully matching
  client/server collision and exact camera comparison are pending.
- Fewer triangles do not on their own prove original visual parity.

The isolated Octavus browser inspector now offers an optional
**Visibility + merge** mode alongside the 98K core, 1.12M merge
and 1.66M original raw candidate. The Chrome smoke test attempts
to load and render the 864K combined staging mesh in actual WebGL.

**The live CROSSFire Octavus map and all server/client physics are
unchanged by this stage.** Replacing the active map requires full
source-view visual checks and synchronized native collisions.

## Stage 1.6 — ORIGINAL SOURCE TEXTURE REGISTRY AND VISUAL PREVIEW

**This stage is about Octavus's appearance, not further triangle-count work.**

The original Red Eclipse 2 MAPZ v59 stores an ordered texture-variant
chain; it does NOT embed each material's external image filename. We
decoded its original VSlot predecessor graph directly from the pinned
r829 MPZ and reconciled the roots with the original Octavus CFG.

| Source material statistic | Verified result |
|---|---:|
| Original CFG base materials | **68** |
| Native VSlot roots | **68** |
| Changed native texture variants | **155** |
| All native texture slots | **223** |
| Slots used by the optimized mesh | **196** |
| Used slots with reusable attributed source diffuse image | **165** |
| Used slots missing source diffuse | **31** |
| Source-image candidate coverage of the optimized mesh | **845,889 / 863,803 triangles (97.9%)** |
| Unique attributed source files represented | **41** |

The large plain-material slot 1 contributes 765,874 candidates to the
coverage figure. As a result, 97.9% source-image coverage should not be
read as 97.9% accurate appearance or proof that the map is playable.
Missing upstream files are listed in the registry and are NOT silently
substituted with unrelated images. Some original texture sources have
non-image procedural/composite definitions.

New reproducible source-stage files:

- scripts/audit_octavus_native_vslots86.py: reads **all 223 native**
  VSlots and validates the 68-root graph, including reverse-indexed
  predecessor links. The generated audit is
  static/maps/octavus.native-vslot-audit86.json.
- scripts/build_octavus_native_materials87.py: resolves native VSlot
  overrides (scale, rotation, offset, color, alpha, layer), inherited
  from original CFG root declarations. It links source-image candidates
  by **original file path**, not older OBJ material indices, to
  already-downloaded attributed WebP assets. Result:
  static/maps/octavus.native-materials87.json.
- static/octavus_native_material_preview87.js: independent browser
  source-image preview, reusing the 41 original images and a shader
  mapping based on the engine's TEX_SCALE=8, six axis projections and
  original eight texture orientations. Native source coordinates are
  preserved. Original image pixel dimensions are used for repeat scale.
- static/octavus-native-preview.html: **Original textures (approx)**
  is now an opt-in visual mode. Shader compiling, missing-image
  fallback, preview modes and screenshot capture are checked in
  test_octavus_native_browser80.mjs under real headless Chrome.
- Workflows .github/workflows/octavus-native-vslots86.yml and
  .github/workflows/octavus-native-materials87.yml validate the
  original binary, VSlot lineage, expected registry/asset coverage,
  and ensure no external image path was invented.

**Known remaining visual gaps, before replacing the live map:**

- OCN2 currently records vertex position and source texture slot but
  not exact per-face orientation, authored normals, multi-layer UVs,
  shader blending or lightmaps. The browser mode infers the dominant
  axis from each triangle and is therefore an **approximation** on
  deformed, diagonal and merged surfaces. A pixel-perfect source
  texture comparison is still pending.
- Full source sprite/model placements, light sources and atmosphere
  must be checked against original r829 in the new coordinate frame.
- The source-derived 864K candidate remains unfit for the low-end
  school-laptop target without exact original visibility and
  spatial batching, and client/server collision still uses the
  older OBJ export.

**The live game map and all collision/multiplayer logic remain unchanged.**

**Guardrail:** Do not modify `static/maps/octavus.json`,
`static/octavus_match.js`, `octavus_world.py`, or server gameplay
collision until the native geometry replacement passes the visual
and physical parity gates.
