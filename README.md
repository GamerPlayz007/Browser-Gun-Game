# CROSSFIRE 02.5 — CYBERPUNK CITY

Version 02.5 is a *visual-world overhaul* of the original 80 × 80 m, four-zone city. It preserves the twelve established connections, six access ramps, room networking and the authoritative map collider layout while replacing flat surfaces with procedural PBR materials and adding dense environmental storytelling.

## What changed

### Procedural materials

`static/world.js` produces deterministic 1024 × 1024 `CanvasTexture` sets: base color, roughness, bump and emissive maps. It has separate treatments for concrete/facades, window panels, asphalt, steel grating, weathered metal, timber, floor tile, glass and furniture. World-scaled UVs prevent windows and cracks from stretching across entire skyscrapers.

### Authored atmosphere

`maps/cyberpunk.py` adds **331 visual scene features** on top of the existing geometry. Highlights include market shopfronts, counters, lanterns, stools, vending machines, crates, steaming vents; a corporate reception, sofas, planters and glossy lobby floor; utility workshops, computer racks, transit seating, handrails and ticket kiosks; aerial cables, AC units, crosswalks, curbs, puddles, manholes, illuminated signs, streetlights, billboards and weathered rooftop-route dressing.

The new environmental features and `map.decor` are visual-only. `map.boxes` remains the sole collider data consumed by both Python and JS physics. Major pre-existing obstructions already use simple collision boxes; tiny decorative geometry is intentionally non-colliding so players do not snag on details or lose the validated routes.

### Lighting, reflections and post-effects

- Shadow-casting directional light with **2048 × 2048 PCF-soft** shadow maps in High and Ultra.
- Seven strategically positioned neon/amber point lights, dark alleys, atmospheric fog and improved sign emissive materials.
- Generated PMREM environmental lighting reflected by glossy wet asphalt patches, metal and corporate flooring. These are *environment-based reflections*, not dynamic screen-space reflections.
- A bundled **Three.js `EffectComposer`-style** post-processing pipeline in `static/postfx.js` using a local **`UnrealBloomPass`-style** bright-pass + separable blur. It uses **4× MSAA in High, 8× in Ultra**, on full native pixel resolution, followed by a filmic composite. These are self-contained compatible implementations, **not verbatim upstream Three.js example add-ons**.

## Quality controls

Room → Settings & Controls → Quality:

| Preset | Rendering |
| --- | --- |
| **High** (default) | Full display resolution, PBR, neon bloom, 4× MSAA, 2048² directional shadows |
| **Ultra** | Full resolution, stronger bloom, 8× MSAA, higher bump/reflection intensity, 2048² shadows |
| **Native** | Full display resolution, full detail, 4× MSAA |
| **Auto** | High visual quality initially, adaptive resolution/optional detail for sustained slow frames |
| **Performance** | 1 rendered pixel per CSS pixel, no bloom, reduced surface detail and shadows disabled |

144 FPS is a target for an RTX 3070, **not a measured guarantee**. Rendering speed depends on monitor resolution, browser, and GPU driver.

## Install / deploy

1. Extract the release ZIP into the existing project, preserving `maps/` and `static/` directories. Read `UPLOAD_02_5.md` for the modified-file list.
2. `python build_map.py` regenerates `static/map.json`, `static/maps/cyberpunk.json`, the registry and `MAP_GUIDE.svg`. The release already includes the generated outputs.
3. `pip install -r requirements.txt && python server.py` starts the local service on port 3000. Render deployment uses the unchanged `render.yaml` commands.
4. Open Chrome or Edge with hardware acceleration enabled and use the room settings to adjust quality.

## Tests

```sh
npm install
npm test
python -m unittest test_map test_server
```

The JS tests validate atlas/geometry construction, material channels, preset toggles, scene batch/triangle budgets, route navigation and post-process stage scheduling. The Python tests validate all twelve connections/six accesses, collision headroom and deterministic map compilation. **Browser GPU testing was blocked in the build environment**, so the release has not been validated for visual appearance, WebGL shaders or actual RTX 3070 FPS; confirm these on the target machine.

## Architecture and performance

The scene contains **236 authoritative collider boxes** and **331 visual-feature records**. The new fixed geometry merges into about **111 material/zone batches** with roughly **21,000 static triangles**. It loads the existing Three.js core and vendor utilities locally; no remote CDN or third-party assets are required. Physics, networking, room rules and routing remain unchanged. Additional map themes in the registry are still placeholders.
