# CROSSFire Artist-Mesh Lab v4 — performance stage

## Purpose

Isolated **browser benchmark**, built on the artist-authored Khronos Fox model from CROSSFire Artist-Mesh Lab v3. Not a weapon asset. It does not modify combat, multiplayer, or weapon visuals.

**Live URL after deployment:** `https://playcrossfire-production.up.railway.app/static/artist-mesh-v4.html`

## Major improvements over v3

- Repeated **animated, skinned** copies (1, 8, 24 or 48) of the same original glTF mesh, with independently rebound skeletons per clone.
- Compare the unmodified 1024px Hero texture against the 256px Performance texture; geometry, UVs, rigging and all animation tracks remain the same.
- Fixed four-scenario A/B benchmark: Hero/1, Performance/1, Hero/24, Performance/24. Same animation, renderer resolution and camera policy at a given copy count.
- Average and 1%-low FPS based on observed animation frame intervals, with draw calls, rendered triangles, geometry and texture counts.
- Export results as JSON or CSV for real school-laptop vs gaming-PC comparisons.
- Open any local `.glb` (up to 30 MB) for isolated inspection without uploading it.

## Important measurement notes

This **is not an automated GPU lab result**. FPS is measured inside your browser and depends on the GPU, CPU, screen refresh rate, browser, thermal state, pixel ratio, other tabs and hardware acceleration. Hero/Performance share the exact same geometry, and smaller textures mostly reduce GPU memory usage / download size; do not expect large FPS increases. FPS is based on requestAnimationFrame intervals and may be capped by display refresh. We cannot guarantee any result ahead of running it on the target laptop.

## Files

- `static/artist-mesh-v4.html` — benchmark UI.
- `static/artist-mesh-v4.js` — viewer and measurements; loads existing `static/artist-mesh-v3-data.js` already in repo (no duplicate binary payload).
- `tools/test-artist-mesh-v4.py` — verifies original GLB, test matrix, UI wiring, scripts, and basic runtime invariants (not a WebGL test).

To run the test within the CROSSFire repository, use `python tools/test-artist-mesh-v4.py`. The test also runs with this ZIP alongside the earlier `CROSSFIRE_ArtistMesh_Pipeline_v3` directory. To run a local page, install the new HTML and JS on the existing CROSSFire server with its `/static/vendor/` Three.js files.

## Original asset and licensing

Fox mesh: PixelMannen (CC0-1.0). Rig/animations: tomkranis (CC-BY-4.0). glTF conversion: AsoboStudio & scurest (CC-BY-4.0). Sources and exact notices:
https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox

This is an original external artist's model and must not be represented as generated or sculpted by our code.