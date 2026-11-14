# CROSSFIRE 02.5 — Upload checklist

Upload the entire `CROSSFIRE_Cyberpunk_02_5.zip` archive into the project, replacing matching files. The following paths are modified or newly created relative to the supplied 02.4 archive:

- `maps/cyberpunk.py`
- `build_map.py`
- `static/world.js`
- `static/display.js`
- `static/game.js`
- `static/postfx.js` **(new)**
- `static/index.html`
- `static/style.css` (release comment)
- `server.py` (release docstring)
- `static/map.json` **(generated)**
- `static/maps/cyberpunk.json` **(generated)**
- `MAP_GUIDE.svg` **(generated)**
- `test_map.py`
- `test_scene.mjs`
- `test_display.mjs`
- `test_postfx.mjs` **(new)**
- `test_server.py`
- `package.json`
- `package-lock.json`
- `README.md`
- `UPLOAD_02_5.md` **(new)**

The old `UPLOAD_02_4.md` remains for release history. No gameplay changes were made to `server.py` (docstring update only), `map_registry.py`, physics or networking.

For local testing: `npm install && npm test` and `python -m unittest test_map test_server`. For deployment: run as before and verify the 02.5 badge and `/health` revision.
