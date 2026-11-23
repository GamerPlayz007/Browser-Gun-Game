# CROSSFire — External 3D Asset Pipeline (glTF / GLB)

## Why this exists
The previous prototypes used JavaScript to assemble many basic meshes while the web page ran. This pipeline instead **loads editable external model files**. Artists can create meshes, unwrap UVs, paint textures, organize objects and export a single transferable file.

This first implementation is a **general-purpose game-art pipeline** with a neutral sci-fi beacon test asset. No multiplayer meshes or game rules are changed.

## Delivered
- [Asset Lab](/static/asset-lab.html): actual `GLTFLoader`, drag-and-drop local `.glb` import, self-contained `.gltf` support, orbit/zoom, lighting modes, wireframe and mesh/material/triangle metrics.
- Source: `static/asset-lab.js`, `static/asset-lab.html`.
- Three.js loader vendored to `static/vendor/addons/loaders/GLTFLoader.js` (Three.js r180, MIT license), using the existing local import map.
- External sample: `static/assets/studio-beacon.gltf`. Its scene geometry is stored in the model file, not assembled with Three.js inside the browser.
- Blender script: `tools/blender_export74.py`. It imports a glTF asset, saves an editable `.blend`, and exports a self-contained `.glb` file.

## Standard content workflow
1. Model a **nonfunctional game-art prop** or environment object in Blender.
2. Organize named meshes, assign PBR materials and create UV layers. Keep baked maps appropriate for the project's quality target.
3. Export glTF 2.0 binary (`.glb`). In Blender: File → Export → glTF 2.0; Format = glTF Binary (.glb). Enable UVs, normals and materials.
4. Open `/static/asset-lab.html` and drag the exported GLB into the viewer. Check silhouette, normals, surface materials and triangle count.
5. Review the asset from different angles under both studio and dramatic lighting; use wireframe to detect excessive geometry.
6. Import reviewed assets into game render scenes separately from collision and gameplay logic. Compare the performance profile before rollout.

## Batch Blender conversion
When Blender 4.x or later is available:

```bash
blender -b --python tools/blender_export74.py -- \
  --input static/assets/studio-beacon.gltf \
  --blend output/studio-beacon.blend \
  --glb output/studio-beacon.glb \
  --report output/studio-beacon.metrics.json
```

An editable `.blend` and a distributable `.glb` will be written to the output directory. If Blender is not installed, open the sample `.gltf` in Asset Lab or Blender when available.

## Acceptance criteria for new asset families
- Geometry created/edited in a DCC tool, not dynamically recreated by `makeWeapon` or another runtime builder.
- Named objects for key separate visual assemblies and clear material naming.
- Correct texture UVs and color spaces (base color in sRGB; normal/roughness/metallic in linear).
- Consistent scale and orientation, no invalid geometry, no missing textures.
- Mobile/weak-PC fallback plan: fewer triangles, lower-resolution textures and fewer render materials.
- No dependence on an external runtime CDN; glTF loader shipped alongside the app.
- No gameplay integration until the imported asset has passed visual and performance checks.

## Current status and limitations
- **Working now:** general GLB/glTF loading path and browser asset inspection; demo model is external glTF 2.0.
- **Not yet done:** a native Blender-authored production asset set, finalized texture bakes, LOD authoring, game rendering substitution, or full cross-device visual benchmarking.
- `tools/blender_export74.py` is provided for Blender; Blender is not installed in the assistant's local environment, so that step requires validation in Blender.
- Local `.gltf` file imports in the viewer are intended for self-contained data-URI files. A `.gltf` with separate `.bin` or texture files should first be exported as `.glb`.

## Links
- Demo viewer: https://playcrossfire.onrender.com/static/asset-lab.html
- Source sample: https://playcrossfire.onrender.com/static/assets/studio-beacon.gltf
- Three.js glTF docs: https://threejs.org/docs/pages/GLTFLoader.html
- Blender glTF docs: https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html
