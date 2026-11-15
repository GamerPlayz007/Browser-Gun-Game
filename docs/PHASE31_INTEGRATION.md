# CROSSFIRE 3.1 - Safe integration branch

The experimental **Cyberpunk City / Rebuilt** map is compiled directly from the
current real CROSSFIRE generator and weapon definitions.

## Baseline stays intact

By default `python build_map.py` produces the original **02.5** map and registry.
The original server and browser movement algorithms remain unchanged and in parity.
No changes are deployed to `main` or to the current Render service.

## Run the experimental build

```sh
pip install -r requirements.txt
npm ci
CROSSFIRE_STAGE31=1 python build_map.py
CROSSFIRE_STAGE31=1 python -m unittest test_stage31
node test_stage31.mjs
python server.py
```

Choose **Cyberpunk City / Rebuilt (Experimental)** from the room map dropdown.
It remains optional and does not replace the default map.

The geometry comes from Phase 1 Stage 4/5/6, and the direct Station–Plaza
Arcade route metadata from Phase 2 Stage 2.5. The original building, plan,
and road-system sources are checked into `maps/`.

## What is NOT yet activated

Phase 2's 60 Hz movement, vaulting, mantling, wall-kicks, and adaptive spawn
prototype modules live under `static/experimental/`. They are **not** plugged
into `game.js` or `server.py` because enabling them on one side first would
break the established 30 Hz movement prediction / authoritative server parity.
They need a coordinated protocol + Python implementation, cross-language replay
tests, and real multiplayer playtesting before being exposed in a room.

## Release gates still open

- Verify all new stair paths and portals with the real server and JS player
  controllers in both directions, not only the standalone collision simulator.
- Inspect the rebuilt map in Chrome / Edge on Windows with WebGL enabled and
  test auto, performance, high, and ultra settings.
- Test complete 2, 4 and 8-player rooms, respawns and late joins.
- Collect actual FPS, frame-time percentiles, network RTT and correction deltas.
- Do not merge to main, enable on Render or replace production defaults until
  these checks pass.
