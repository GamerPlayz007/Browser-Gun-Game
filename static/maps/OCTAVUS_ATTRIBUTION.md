# Octavus (Red Eclipse 2) — CROSSFire map conversion

**Octavus is adapted map content licensed CC BY-SA 3.0.** The source
architecture remains the work of Ricky Thomson ("unixfreak") and
Alex "molexted" Foster. CROSSFire is not affiliated with or endorsed
by Red Eclipse.

## Pinned sources and license

- Authored Octavus map: https://github.com/redeclipse/maps
  - Source map configuration: `octavus.cfg`, SHA
    `8e15bd6e933a1a81c33b782e94b23399d531cba1`
  - License text: `octavus.txt`, SHA
    `f0463bb3e04a03b2f9f62f7e7958fc9936d2b366`
  - Native `octavus.mpz` source SHA
    `c3d927bdb016927f1f96868b435dfdf174a01af9`.
    Its **verified original binary has now been archived** at
    `sources/octavus.original.mpz` (1,469,341 bytes compressed;
    14,987,053 bytes decompressed). Source SHA-256 and header are in
    `sources/octavus.original.json`.
  - Native MPZ v59 metadata parsed from its source encoding:
    892 entities including 233 lights, 149 mapmodels, and 33 playerstarts.
    `static/maps/octavus.native-entities.json` stores the original
    positions/attributes/links, while
    `sources/octavus.native-variables.json` stores source map variables.
- Phase 1 structural decoder `scripts/decode_octavus_octree76.py` now
    verifies the original 223 texture vslots and reads all 704,159 octree
    leaves, 49,794 explicitly stored polygon faces and native face texture
    IDs. The resulting authoritative inventory is
    `static/maps/octavus.native-octree-report.json`.
    **This is NOT yet a visible native mesh export**: renderer visibility,
    implicitly generated faces, merged geometry and native collision still
    require reconstruction. See `static/maps/OCTAVUS_PHASE1.md`.
- Source OBJ mesh: https://github.com/Calinou/game-maps-obj
  - `redeclipse/octavus.obj`, SHA
    `ad408f0c35ffb98aa1c19d4fb01943decac3b8de`
  - `redeclipse/octavus.mtl`, SHA
    `944c2144265194e278d4e43fae1e8341dc0bb559`
  - The OBJ was exported from Red Eclipse at pinned commit
    `ecfe18c51` (see exporter README).
- Map documentation: https://www.redeclipse.net/docs/maps/Octavus
- License: https://creativecommons.org/licenses/by-sa/3.0/

## Adaptation details — November 2026

The initial prototype exported only the OBJ mesh and shrunk its source
8192-unit span to a 120-unit scene. This conversion now:

- Retains all **52,061 source vertices and 86,500 source triangles** in
  local `OCT1` files (`octavus_01.b64` through `octavus_08.b64`).
- Restores all **65,636 source texture coordinates**, with original
  per-face UV indices and slot mapping, in local `OCU1` files
  (`octavus_uv_01.b64` through `octavus_uv_11.b64`).
- Applies a **0.05 source-to-CROSSFire scale**, following the OBJ
  exporter's suggested starting scale, resulting in a **409.6 x 409.6**
  unit visual footprint. The central courtyard at source Y=2816 is
  translated to gameplay Y=0. The exact same transform is applied to
  server collision, client collision, and player spawn data.
- Preserves authored UVs and imports the native **map entity metadata**.
  The current renderer loads original diffuse/PBR material packages, available
  native light and decal metadata, and locally hosted authentic map models.
  Some fallback procedural materials remain where original media is missing.
  A source material manifest with 111 OBJ slots, 68 native CFG definitions,
  shader names, scaling/tint and texture filenames is available in
  `static/maps/octavus.source-materials.json`. Individual media copyright
  and attribution requirements still apply.
- Stores upstream map configuration as `octavus.original.cfg` and
  original license as `octavus.source-license.txt`. Its revision may
  differ from the older pinned OBJ geometry; it is a reference for the
  next material-reconstruction phase; the MPZ entity inventory is
  now extracted, but the native octree's rendering topology has NOT
  been independently converted. The current static rendered mesh is
  still the pinned 86,500-triangle OBJ export.

The derived map files, source UV pack, and geometric adaptations
remain CC BY-SA 3.0; retain this notice and mark further changes.
Models and textures from other Red Eclipse modules have distinct licenses,
as specified below. The engine integration is original CROSSFire code.
Please respect Red Eclipse's mark policy.

## Stage 2.7 — original source models and media

The native Octavus MPZ places 149 mapmodel entities; the current compact arena
contains 147 of them. The 13 placements missing in Stage 2.6 are now
represented by **original source-derived geometry**, not substitute blocks:

- `misc/lowpoly_eagle` (8 instances): original IQM v2 mesh from
  https://github.com/redeclipse/misc/tree/master/lowpoly_eagle,
  converted into a static OBJ mesh retaining its 1,805 vertices, 1,532
  authored triangles and UVs. Original `diff.png` is included as a local
  base64 PNG package. The source defines animations; CROSSFire currently
  presents the original static bind pose rather than recreating animations.
- `luckystrike/door1` (4 instances): original MD5Mesh source from
  https://github.com/redeclipse/luckystrike/tree/master/door1,
  converted into a 36-vertex / 12-triangle static OBJ using the source's
  one-joint weighted bind pose. Original `mdlyaw 90` is preserved.
  **The original diffuse texture is not yet packaged**; its geometry is
  displayed with a non-source fallback material. Native door animations are
  not implemented, and there is no claim that the door can be opened.
- `misc/radio_dish` (1 instance): original IQM v2 mesh from
  https://github.com/redeclipse/misc/tree/master/radio_dish,
  converted into a static OBJ retaining its 5,370 vertices, 3,786
  authored triangles, three source submeshes and UVs.
  Original source `diff.png` is included as a local base64 PNG package and
  loaded only on High/Ultra quality to protect low-spec laptops.
  Original mapmodel pitch and animation are not currently simulated.

**Licenses:** `misc/radio_dish` is credited to **David W CG** and licensed
**CC BY-SA 4.0**, as stated by the source
`radio_dish/readme.txt` (originally sourced from
https://opengameart.org/content/sci-fi-radio-dish-antenna).
The Red Eclipse `misc` and `luckystrike` module content follows its
documented CC BY-SA 4.0 default license unless individual files specify
otherwise. These models and locally bundled skins retain their original
attribution and ShareAlike obligations; they do not change the Octavus
map-geometry attribution above.
