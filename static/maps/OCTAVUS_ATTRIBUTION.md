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
  - Native `octavus.mpz` exists upstream, SHA
    `c3d927bdb016927f1f96868b435dfdf174a01af9`.
    **Its binary content has not yet been ingested or converted.**
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
- Preserves authored UVs for future use; **original texture images,
  native map entities, mapmodels, and lightmaps are not yet imported**.
  Current procedural materials are temporary rendering replacements.
- Stores upstream map configuration as `octavus.original.cfg` and
  original license as `octavus.source-license.txt`. Its revision may
  differ from the older pinned OBJ geometry; it is a reference for the
  next material-reconstruction phase, not evidence that all original
  native entities were converted.

The derived map files, source UV pack, and geometric adaptations
remain CC BY-SA 3.0; retain this notice and mark further changes.
Other original media (textures, models, music, sounds) can carry their
own licenses and **have not been copied**. The engine integration is
original CROSSFire code. Please respect Red Eclipse's mark policy.
