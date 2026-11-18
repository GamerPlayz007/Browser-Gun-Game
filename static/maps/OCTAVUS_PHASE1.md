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

**Guardrail:** Do not modify `static/maps/octavus.json`,
`static/octavus_match.js`, `octavus_world.py`, or server gameplay
collision until the native geometry replacement passes the visual
and physical parity gates.
