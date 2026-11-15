# CROSSFIRE 03.2 — ONE LIVE CYBERPUNK CITY

**Source of truth:** `main` branch, deployed by Render when auto-deploy is enabled.

CROSSFIRE now uses **one** playable Cyberpunk City. The former 80 m map
and its separate `cyberpunk-next` experimental selection have been removed.
The only active map contains **more than 650 authoritative collision objects, a 120 m
gameplay envelope, 3053 decorative objects and 13 authored district routes.**
The surrounding 160 m urban context is visual-only.

## Build

```sh
pip install -r requirements.txt
npm ci
python build_map.py
python -m unittest test_map test_server test_stage31
npm test
node test_stage31.mjs
python server.py
```

Open http://localhost:3000 in a browser with WebGL and pointer lock.
Production is served by Render from `main`; Render redeployment status
must be checked there. No separate map-generation environment variable.

## How the map is built

- `maps/base_city.py`: internal original-city source geometry; **not a
  separate selectable arena**.
- `maps/cyberpunk_world.py`: current live compiler composing the Stage
  4 structural greybox, Stage 5 visual details, Stage 6 physical expansion,
  and Stage 2.5 Station–Plaza Arcade.
- `build_map.py`: regenerates both copies of the single map and registry.
- `static/maps/cyberpunk.json`: served to clients and the Python server.
- `static/map.json`: identical data for existing tests and helpers.

The 02.5 Cyberpunk City selection, former experimental candidate file, obsolete
movement prototypes and 80 m SVG guide have been deleted from the current tree.
Only the live Cyberpunk City appears in the map registry. Old git
history remains available for rollback.

## Gameplay and quality

Stage 3.2 upgrades the combat HUD, server-confirmed hit feedback, firing
controls and replay resistance. Quality modes remain Performance, Auto,
High, Ultra and Native.

**Movement:** Python `movement_live.py` and JavaScript `static/physics.js`
are one mirrored fixed-60Hz controller, including responsive acceleration,
slides/crouch, jump buffering, coyote jumps, short hops, wall-kicks, and
server-validated mantle/vault transitions via **E**. Both replay the same
network input and are regression-tested for numerical parity.

## Release gate

All automated tests must pass before accepting a deployment to `main`.
Actual GPU FPS, multiplayer latency and route usability require human
playtests; CI tests alone are not a claim of production polish.

**Workflow:** Every later stage contributes directly to this one game,
and reaches `main` after the regression gate. No independent playable
versions or extra map selectors.
