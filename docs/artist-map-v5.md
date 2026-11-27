# CROSSFire — Artist Mesh Map Stage v5

This is a **separate, optional preview**, not a multiplayer integration. It exercises CROSSFire's actual `static/world.js`/`buildWorld` Daybreak City scene with an independently artist-authored, animated glTF model. The Fox is an integration test, not a CROSSFire weapon or planned character.

## Open the deployed preview

`https://playcrossfire-production.up.railway.app/static/map-art-v5.html`

**Controls:** Hero and Performance texture profiles, school-laptop vs high-quality city, Survey/Walk/Run animation, three actual map spawn points, wireframe, visibility toggle, turntable, and JSON observation report. Drag the canvas to orbit, wheel to zoom.

The renderer does not modify game mechanics, map collision, multiplayer network, player physics, damage, lobby, or the sniper weapon. There are **no imports of v5 modules from `static/game.js` or `static/world.js`**.

## Architecture

- `static/map-art-v5.html`: standalone UI. Reuses current THREE import map and vendor modules.
- `static/map-art-v5.js`: fetches the **real Daybreak City map data**, calls the game's `buildWorld` with `quality='performance'`, then imports the artist's Fox GLB with `GLTFLoader` and renders in the same scene. It never reimplements the animal's shape in JavaScript.
- `static/artist-mesh-v3-data.js`: **unchanged** original Fox Hero and Performance assets already present in the repository; the import does not need a duplicate committed file. The attached local kit contains a copy so validation can work offline.
- `tools/test-map-art-v5.mjs`: isolated regression tests for UI and scene integration, byte-for-byte SHA256 checks of both artist models, triangle count, skin, and animations.

## Licenses

[Fox asset — Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox): artist **PixelMannen** (model CC0); **tomkranis** (rigging and animation CC BY 4.0); **AsoboStudio and scurest** (conversion CC BY 4.0). The source project license files should be retained if this sample is redistributed. The model is only a test and not proposed as a commercial game character.

## Verification and limitations

Run:

```
node --check static/map-art-v5.js
node tools/test-map-art-v5.mjs
```

Structural checks do not replace live visual inspection or measuring FPS on a real school laptop. Rendering in the target browser and performance on target hardware require manual testing. Do not infer improved FPS from file size alone.