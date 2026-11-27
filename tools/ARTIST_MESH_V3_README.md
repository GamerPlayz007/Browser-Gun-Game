# CROSSFire — Artist Mesh Lab v3

A **browser-hosted integration test** for a licensed, artist-authored 3D model. It advances the pipeline beyond static GLB validation without touching multiplayer or weapon visuals.

## What it does

- Uses the actual existing Fox artist-created model from the Khronos glTF sample collection — no generated replacement geometry.
- Embeds two validated GLB exports in a separate self-contained data module: `HERO` (1024 px texture) and `PERFORMANCE` (256 px texture).
- Preserves all 576 mesh triangles, the original skinned rig, UVs, and the `Survey`, `Walk`, `Run` animation clips.
- Renders in the existing CROSSFire Three.js runtime (locally vendored 0.180.0), with no external CDN dependencies.
- Exposes an isolated interactive route `/static/artist-mesh-v3.html` where users can switch texture variants, select original animations, orbit, toggle wireframe, shadows and pixel density, and observe approximate frame rate/draw calls.
- Allows importing a local, self-contained `.glb` of <= 30 MB for visual inspection without uploading it to the server.
- Exports a JSON report from the browser. This export is a performance *observation*, not a fixed benchmarking guarantee.

## Bundle contents

- `static/artist-mesh-v3.html`: interface
- `static/artist-mesh-v3.js`: glTF renderer, animation, metrics, import logic
- `static/artist-mesh-v3-data.js`: base64 of the two verified GLB assets
- `sample/`: physical copies of both GLBs and original glTF source
- `blender_review.py`: Blender-native import and `.blend` save script from v2, not executed in this environment
- `tools/test-artist-mesh-v3.py`: verifies byte-for-byte embedded GLBs and structural preservation
- `build/report.json`: original pipeline export report

To build the native Blender project yourself:

```sh
blender --background --python blender_review.py -- --hero sample/CROSSFIRE_Fox_Artist_HERO.glb --performance sample/CROSSFIRE_Fox_Artist_PERFORMANCE.glb --out artist_mesh.blend --render fox_studio.png
```

To check the new lab:

```sh
python tools/test-artist-mesh-v3.py
node --check static/artist-mesh-v3.js
node --check static/artist-mesh-v3-data.js
```

To host locally, copy `static/*` into the project's `static` folder (CROSSFire's vendor Three.js files must already be available), then start the CROSSFire server and visit `/static/artist-mesh-v3.html`.

## Source, licensing, and honesty

Khronos source: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox

- PixelMannen — Fox model, CC0.
- tomkranis — rig and animations, CC BY 4.0.
- AsoboStudio and scurest — glTF conversion, CC BY 4.0.

Include those credits in redistribution. The model is a **non-weapon proof of a workflow**, not a new CROSSFire playable character, not the AWP, and not a game-ready character skin.

**Validated locally**: GLB bytes, skin and animation preservation, exact triangle counts, HTML control wiring, JavaScript syntax. **Not validated here**: WebGL result in a remote user browser, GPU frame-rate estimates, native `.blend` project or Blender render (Blender not installed). No claim that the performance variant is visually superior; its measured disk reduction is ~7.8% at unchanged geometry, and GPU results may vary.