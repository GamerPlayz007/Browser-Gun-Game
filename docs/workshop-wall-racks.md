# CROSSFire Garage — Phase 2 / Wall Racks + Parts Workbench

The original permanent garage stays unchanged as a 3D space, but the cluttered model sidebar has been replaced by a focused tool panel.

## Mounted, selectable game-art models
Only models with valid real repository GLBs get wall mounts:
- AWP-01 v0.3 ORIGINAL — exact approved digital artwork GLB; no substitute L7.
- S-12 v0.4 — in-game cosmetic asset performance GLB.
- SPECTER Midnight — lowest-footprint available version.

The wall mounts are **real GLB scene geometry** with a physical mounting frame, display plaque, and 3D raycast hit testing. Click a wall model or its frame to load it into the central garage inspection bay.

Code-only runtime models (AR-01, SMG-05, Operator) do not appear as fake previews. The archived L7 and Fox reference are not wall mounts. Additional model versions, including Glacier/Eclipse finishes, remain in the hidden data catalog and may be compared in the Production Bay.

## Clean sidebar
Wall Racks / 360° View / Components buttons; selected model/GLB version; download, comparison, single import button, personal browser-saved imports selector. Rendering diagnostics, benchmark, wireframe, copies and advanced controls are collapsed by default. Old Lantern card, duplicate import and weapon list are removed.

## Component view
The visible on-workbench GLB instance is traversed into its actual constituent mesh nodes. Exploded mode offsets **all original visual mesh parts** from their authored positions without changing source GLB data, supports a spread slider (0–100%), a searchable component list, clicking a mesh in the viewport, highlight, material and triangle statistics, part focus, and reassembly. For densely split models such as the 396-mesh AWP, the list shows 96 entries at a time and the search reveals any other component. All mesh parts remain visible in the 3D view.

## Performance and isolation
- Three low-impact wall rack displays are loaded sequentially from repository files after the chosen asset loads. Each is a real GLB and may cost additional draw calls; a school-laptop display setting remains available.
- Personal GLBs are saved only to IndexedDB in the local browser.
- The existing comparison bay and measurement tools remain available under streamlined controls.
- No game server, multiplayer session, weapon handling, combat, physics, or map data is touched.
