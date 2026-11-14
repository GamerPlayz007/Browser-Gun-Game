# CROSSFIRE 02.4 — GitHub upload checklist

Upload the extracted ZIP contents into the repository root. Keep the `maps/` and `static/` directories intact. Existing matching paths are replaced; no deletions are needed. Do not upload `node_modules`, `__pycache__`, the ZIP itself, or an extra enclosing folder.

## Added files

- `UPLOAD_02_4.md`
- `map_registry.py`
- `maps/cyberpunk.py`
- `static/display.js`
- `static/maps/cyberpunk.json`
- `static/maps/index.json`
- `static/weapons.json`
- `test_display.mjs`

## Modified files

- `MAP_GUIDE.svg`
- `README.md`
- `THIRD_PARTY.md`
- `build_map.py`
- `package-lock.json`
- `package.json`
- `server.py`
- `static/game.js`
- `static/index.html`
- `static/map.json`
- `static/minimap.js`
- `static/physics.js`
- `static/style.css`
- `static/world.js`
- `test_district.mjs`
- `test_map.py`
- `test_movement.mjs`
- `test_scene.mjs`
- `test_server.py`

## Unchanged files

The complete ZIP also contains the unchanged runtime dependencies/assets and Render configuration, so uploading all of it is safe. The Render build/start commands stay the same. After deployment, refresh all clients and confirm the 02.4 lobby badge.

## Validation

26 Python tests and all four Node suites pass. The routes and six access ramps produce 108 complete navigation traces with server/browser movement parity. Static environment: 17 batches, 21 meshes, 4,400 triangles including practice targets. Browser visual/FPS playtesting is not verified: automatic preview approval reported a usage limit.
