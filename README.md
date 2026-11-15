# CROSSFIRE 03.6 — ONE LIVE CYBERPUNK CITY

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
node test_netcode33.mjs
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


## Multiplayer synchronization — Stage 3.3

- The Python server remains authoritative for movement, room state and hits.
- State packets carry an increasing `snapshotSeq` plus a monotonic
  `serverTime` timestamp. Ping/pong measures clock offset and RTT.
- The browser samples opponent positions on a short, jitter-adaptive buffer
  (95–185 ms); it interpolates heading around angle wrap and bounds
  extrapolation to 80 ms during a missing snapshot.
- Remote buffers reset on respawn, teleports, disconnections and room changes.
- Local prediction continues at 60 Hz. Authoritative snapshots replay only
  unacknowledged inputs, with bounded camera correction and snapping for
  large errors. No client-reported position is accepted by the server.
- The in-game HUD shows RTT, observed snapshot-arrival jitter and stale-link
  warnings.
- `test_netcode33.mjs` exercises packet delay, out-of-order arrivals,
  teleport/respawn reset, extrapolation caps, clock alignment and corrections.

This work does **not** add historical hitbox rewinding or claim to eliminate
high network latency. Actual browser multiplayer playtests and Render
deployment still require verification.

### Bounded historical hit validation

For browser shots, the client may include the estimated server time of its
rendered opponent view. Python validates a **300 ms maximum rewind**, samples
its own recent player pose history (not client-supplied hitboxes), and always
checks the current static arena geometry. A respawn changes the generation ID
and cannot reuse an old pose. The server alone confirms damage and eliminations.


## Stage 3.4 — Character animation and gameplay feedback

All character animation is procedural in the single live 3D game.
Remote models now distinguish idle/walk/run/jump/crouch/slide, include
articulated upper/lower limbs, smoother torso/head movement, and flash/glow
reactions driven only by confirmed server shot and hit events. Spawn transitions
use a short non-colliding ring. The local view gains a subtle landing response,
strafe lean, and a movement state indicator. Visual effects do not change
damage, collision, hitboxes, movement authority, or network protocol.

`test_animation34.mjs` runs pose transitions, event timing, spawn reset and
eight-avatar procedural-rig stress checks. The `test_scene.mjs` smoke test
still checks the actual Three.js models.


## Stage 3.5 — Competitive Match Systems

The **same live Python server** now owns ranked Deathmatch and Gun Game rules.
Both modes use a six-minute timer, a three-second countdown, deterministic
standings (kills, deaths, headshots), streaks, best-streak records, live leader
announcements and winner/reason metadata.

Deathmatch is first to 15 eliminations. Gun Game is three eliminations
per tier across the four existing weapons (12 total). The next weapon
is assigned by the server at each tier and cannot be selected manually
during a round. Match results are frozen after victory or timeout.
Rematches clear old scores, streaks, target damage and previous pose histories.

The HUD shows round/rank/leader information and server-derived progress.
Server events power tier, streak, lead and match-end presentation.
Neither client scores nor UI events can change server-owned results.
Tests: `python -m unittest test_map test_server test_stage31 test_match35`,
`npm test`, `node test_stage31.mjs`.

Real Render deployment, 2–8-player race tests and Windows/WebGL playtests
are separate manual release checks; passing CI does not establish them.


## Stage 3.6 — Release verification and live diagnostics

- Server /health now includes privacy-safe aggregate server loop-work percentiles,
  snapshot sizes, and connected client counts.
- Press **F7** in a room, or use **PERFORMANCE DIAGNOSTICS** in Settings,
  to see real browser requestAnimationFrame interval FPS, 1% low FPS, p50/p95/p99
  frame times, draw calls, triangles, RTT, network jitter, and snapshot gaps.
- These are actual browser intervals, **not** GPU-timer readings. The metrics
  are collected on the player's device at their selected quality preset.
- Local WebSocket integration and load tests simulate 2, 4 and 8 clients,
  room transitions, host transfer and independently inspect snapshot delivery.
- Synthetic benchmark artifacts from GitHub Actions describe the runner's
  loopback test conditions and are **not** proof of external Internet ping or
  Windows/RTX performance.

To test actual latency/FPS, open the deployed version 03.6 in Chrome/Edge,
create a room, invite another device, play a round, and toggle F7. Real Render
availability and cross-country connections still require checking separately.
