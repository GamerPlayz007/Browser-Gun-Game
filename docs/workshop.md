# CROSSFire — The Workshop (Garage 01)

The garage is the permanent art-development home. This update preserves the previous v4 animated-asset benchmark as a separate historical page and provides a dedicated Workshop page.

## URLs
- /static/workshop.html — **permanent workshop**: garage studio, import a GLB, inspect skin/animation, quality, mesh statistics, performance, A/B test and reports
- /static/artist-mesh-v4.html — original v4 benchmark preserved
- /static/map-art-v5.html — existing Daybreak City field test
- / — multiplayer unchanged except for a Workshop navigation link

## Workflow
Create/refine in Blender, export an approved artist-made .glb, import to Workshop from disk (local-only), inspect, run 1 and 24-copy profiles, export benchmark results, then verify environmental compatibility in the Daybreak City field test.

The workshop cannot edit mesh topology, UVs or Blender source; it is an asset-inspection and test garage. Garage architecture is simple low-cost procedural scenery; imported hero objects are untouched GLB meshes, never reconstructed from JavaScript primitives.

## Verification
`node --check static/workshop.js && node tools/test-workshop.mjs`
The default sample is the licensed Khronos Fox: PixelMannen (CC0 mesh), tomkranis (CC BY 4.0 rig and animation), AsoboStudio/scurest (CC BY 4.0 conversion). Its existing embedded GLB bytes are reused unchanged.
No changes to multiplayer, weapons, map registry, or collision geometry.
