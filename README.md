# CROSSFIRE 05.4 — NEW MULTIPLAYER GAME MODES

**Source of truth:** `main` branch, deployed by Render when auto-deploy is enabled.

CROSSFIRE now uses **one** playable Cyberpunk City. The former 80 m map
and its separate `cyberpunk-next` experimental selection have been removed.
The only active map contains **more than 650 authoritative collision objects, a 120 m
gameplay envelope, 3053 decorative objects and 13 authored district routes.**
The surrounding 160 m urban context is visual-only.

## Phase 5.4 — new multiplayer modes (implemented on main)

**Four game modes, one Cyberpunk City map:**
- **Deathmatch:** existing individual race to 15.
- **Gun Game:** existing weapon progression, three eliminations per tier.
- **Team Deathmatch:** Azure vs Ember, balanced team assignment, first team to
  30 total eliminations. Friendly fire is disabled on the **server**, and
  teammates cannot block the authoritative hit query.
- **Control Point:** Azure vs Ember contest the **Neon Beacon** in Neon Plaza
  at `(2, 0, 16)` within a six-meter radius. The server awards **one point
  per uncontested second of presence**, pausing when both teams occupy
  the zone. First team to 60 points wins; after the 6-minute time limit,
  the leading team wins or equal scores end in a draw.

The server alone owns team assignments, score totals, Control Point occupancy,
victory condition, and round resets. Team assignments rebalance at round start
and upon first selecting a team mode in the lobby; joiners are assigned to
the smaller team. There is no client-controlled team-selection or
scoring message.

**Implementation:**
- `modes54.py`: pure deterministic team balance, objective occupancy,
  server team scoring and winner helpers.
- `server.py` and `match35.py`: authoritative team score and objective
  logic, no friendly fire, per-snapshot `team`, `teamScores`, `winnerTeam`,
  and server-owned `objective` fields. Existing FFA modes are retained.
- `static/match35.js`, `static/game.js`: four-option host mode selector,
  team-colored lobby/scoreboard/avatars, team score HUD, objective state,
  notices and accurate team-winner result screens.
- `static/control54.js`: lightweight animated Three.js beacon with
  purely visual non-colliding rings; color and location come from server
  snapshots. Scene resources are disposed on map unload.
- The minimap marks the Control Point and shows **living teammates only**
  in team modes; it does not reveal opposing players. Test coverage confirms
  objective visibility and exclusion of opponents/dead players.
- `test_modes54.py`: team balance, friendly-fire protection, kill scoring,
  contested/uncontested Control Point scoring, same-floor eligibility,
  victory conditions, rematches and actual two-player WebSocket authority.
- `test_modes54.mjs`: team presentation, objective indicator, game results,
  and beacon lifecycle. Both suites are included in GitHub Actions CI.
- Fixed an outdated match test that still expected a Phase 3 version badge.

**Testing & release:** Source is committed directly to `main` for Render
auto-deploy if enabled. Run `npm test` and
`python -m unittest -v test_server test_map test_release51 test_modes54`.
Then verify version **05.4**, complete a multiplayer browser session and
inspect F7/F8 telemetry. The full CI and production Render deployment have
not been independently verified in this chat.

## Phase 5.3 — movement revolution (implemented on main)

- **Slide-hop momentum:** `static/physics.js` and authoritative
  `movement_live.py` now share identical constant values:
  `slideHopSpeed=7.95`, `slideHopCarry=1.07`, and
  `slideHopCap=10`. A buffered jump taken during a grounded slide
  preserves modest forward velocity, capped for consistent gameplay.
  Regular and wall jumps remain unchanged.
- **Mantle reliability:** clearance-first mantles raise the player over
  the edge before advancing, reducing mid-vault collisions caused by
  intersecting the ledge during the previous linear motion.
  The new lift/smoothstep path is identical on client and server.
- **Held-E assistance:** while advancing forward, continuing to hold
  E attempts to mantle an approaching valid ledge; stationary tap-to-vault
  remains possible. Solid overhead obstructions still disallow vaults.
- **Vault continuation:** if W is held as a mantle completes, a bounded
  forward exit speed of `2.7 m/s` replaces the old abrupt hard stop.
  This speed remains subject to authoritative collision checks.
- **Visual movement feel:** `static/flow53.js` adds testable
  SLIDE HOP / VAULTING / WALL KICK cues and opt-in subtle motion camera
  response; FOV now smoothly interpolates rather than snapping.
  Camera enhancements respect the existing Motion toggle.
- **Parity and regression:** `test_flow53.mjs` tests matching Python
  and JS trajectories for three 60 Hz sequences: slide hop, held-E
  mantle, and blocked mantle. It also verifies post-vault speed,
  player state parity, camera helper and HUD cue behavior.
  The existing `test_movement.mjs` continues to test prediction
  and authoritative replay across client frame rates.
- The JS GitHub Actions job now installs Python and server dependencies
  to support both cross-language tests.

Play controls: **Shift + WASD** sprint; **C** slide; **Space**
jump/slide-hop; hold **E + W** approaching a reachable ledge to mantle.

**Build state:** 05.3 has been committed on `main`. Production Render,
full GitHub Actions CI and live multiplayer frame pacing have not yet
been independently verified. Final V3.0 release is a later milestone.

## Phase 5.2 — combat feel and visual confirmation (live main)

- `static/feedback52.js` introduces a self-contained, testable presentation layer:
  server-only hit acknowledgement, short-lived stacking damage readouts for
  multiple server-confirmed hits, recoil-reactive crosshair spacing, and
  bounded quality-specific tracer selection. It does not alter hits, shot
  timing, damage, ammo, weapon ranges or authoritative movement.
- Reticle arms now remain centered as they respond to movement, jumping,
  sliding/crouching, aiming and visual recoil. Larger hits momentarily
  pulse the hit marker, while headshots receive distinct treatment.
- New short synthesized hit cues respect mute/volume and only play after
  server hit events. First-person receiver movement and support-hand
  follow-through add tactile presentation without affecting physics.
- Tracers are quality-tier sampled and capped at 36 temporary objects;
  old particle objects are cleaned up during arena changes and disconnect.
- `test_feedback52.mjs` verifies that local/remote shots never fabricate
  confirmed hits, tests hit stacking, reticle states, tracer budget caps,
  visual recoil and mute-safe audio.
- This is an incremental **05.2 development build**. It is not the
  official V3 release until the complete phase 5 and real-device
  multiplayer validation pass.

## Phase 5.1 — multiplayer release-readiness audit (live main)

The active game still uses the **single Cyberpunk City**. Phase 5.1 does
not rewrite the map, movement rules, spawns, simulation or netcode.

**Corrected release contracts**
- The browser lobby, JS package, and Python server now identify the same
  release: **05.2**. The legacy `/health` numeric `version: 5` remains
  the API schema version; new `release` and `phase` fields identify the
  actual game release. `buildCommit` exposes the optional first 12
  characters of Render's `RENDER_GIT_COMMIT`, if present. The current map's
  geometric `revision: 03.2` stays separate.
- Python tests that still expected the old 03.6 lobby badge now check 05.2.
- The bundled `.github/workflows/crossfire-ci.yml` now runs **both** the
  complete JS regression suite and Python's multiplayer HTTP/WebSocket/map
  tests in separate jobs: `npm test` and
  `python -m unittest -v test_server test_map test_release51`.
- `test_release51.py` validates the browser/server build version, source
  module imports, same-file live/editor map data, release HTTP metadata,
  live static assets, and two-client WebSocket join/ping/host succession.
- `check_live51.py` is an optional independent probe of a deployed
  Render instance: checks the active build, assets, maps, creates a temporary
  room, joins two WebSocket clients, checks ping/pong and closes cleanly.
  It may take longer for a free Render instance to wake up.
- The in-game F7 diagnostics panel adds **COPY DEBUG REPORT (F8)**, exporting
  FPS/frame pacing, network timing and renderer metrics **without player
  names or room codes**, so actual multiplayer playtests can drive fixes.

**Commands:**
```bash
npm ci
npm test
pip install -r requirements.txt
python -m unittest -v test_server test_map test_release51
python check_live51.py https://YOUR-RENDER-SERVICE.onrender.com
```

**Release gate:** commit to main does not prove Render deployed, CI ran,
WebGL compiled on a Windows browser, or 2–8 real players can play reliably.
Confirm GitHub Actions checks and then run the live smoke script and actual
desktop playtests before announcing **V3.0**.

## Phase 4.6 — Ultra polish, performance, telemetry and deployment checks
- All changes stay on the **single playable Cyberpunk City** in GitHub `main`. No additional map or parallel experiment. Authoritative collision boxes, spawns, route topology and netcode stay unchanged.
- **Auto quality** now limits the initial HiDPI ratio to 1.15× (rather than rendering 2–3 native screen pixels per CSS pixel) and can adapt resolution down to 65% of that ceiling on sustained slow frames. High, Ultra and Native remain full native-resolution choices, and Performance stays 1× DPR.
- Auto can **bypass bloom and cinematic grading** while optional detail has been disabled by the frame-pacing meter, with a single renderer scene draw, and restore the visual compositor after recovery. Ultra now clamps MSAA sample requests to the GPU's reported `MAX_SAMPLES`, avoiding unsupported framebuffer allocations.
- Fixed disposal ownership for shared Stage 5/6 PBR materials: each shared texture/material is disposed once by its owning library instead of being disposed during every mesh traversal and again by the library. Separate living/weather/ambient layers still dispose their own resources.
- F7 diagnostics now gather **whole-frame** draw calls (including post-processing and first-person weapon), shader program count, renderer texture/geometry allocations, active meshes, instanced props, shadow casters, frame-buffer size, rain/motes and active advert/drone counts. Counts are resource counters; frame pacing is still CPU browser frame intervals, not measured GPU kernel times.
- `static/polish46.js` contains read-only render telemetry and budget warnings, tested by `node test_polish46.mjs`; display, world material ownership and compositor regressions are extended in the existing test scripts.
- GitHub Actions CI workflow `.github/workflows/crossfire-ci.yml` runs `npm ci` and `npm test` on pushes to main and pull requests where Actions is enabled.
- Production Render deployment, full GPU browser screenshots and real-device 144 FPS have not been independently validated; use F7 to compare actual renderer resources after deployment.

## Phase 4.5 — a living city (implemented on main)
- `static/living45.js` adds **12 original animated advertising panels** (three per district), **four turning ventilation fans** and **four slow-moving rooftop service drones** anchored to authored Cyberpunk City landmarks. All are render-only `collidable:false`, never modifying the map, routes, server or multiplayer state.
- Ads use **four shared procedural canvas textures / shader materials** (one per district) for gentle horizontal interference, scrolling highlights, scanline detail and non-strobing luminance. They react modestly to nearby players with smooth proximity-controlled glow.
- Mechanisms have deterministic motion computed from the frame clock; no extra physics bodies or network traffic.
- The existing Web Audio engine synthesizes gentle **positional ambience** for Night Market, Neon Plaza, Tech Atrium and Transit Deck. Sound only plays after user-gesture audio unlock, when the player is active, respects the volume slider and pauses if muted/hidden. Cues are throttled to one per 5.2 seconds (Performance 7.4 seconds); no downloaded tracks.
- Performance leaves one advert per district and two ventilation fans, with drones disabled; High/Auto have intermediate tiers; Ultra presents all decorative actors. The existing Auto detail toggle also hides expensive secondary objects.
- Existing Render auto-deploy from `main` is unchanged. Tests: `node test_living45.mjs` or `npm test`. Browser visual quality, Render deployment and measured fps still require real playtesting.

## Phase 4.4 — atmosphere and cinematic post-processing (live)
- `static/atmosphere44.js` is mounted directly into the single active Cyberpunk City scene; GPU-driven shader particles use a deterministic seed. Two clouds provide rain and drifting motes, with **1,170 particles at Ultra** (850 rain + 320 motes), lower counts in High and Auto, and none in Performance.
- **28 noncolliding, animated, neon-tinted wet-pavement patches** positioned above real floors across all four districts on the current map. Puddles are merged into four materials/draw groups; no colliders, movement or network records change.
- Shared PBR materials now support weather wetness: asphalt and road roughness drops under High/Ultra weather, while Performance restores dry roughness and disables expensive bump detail. No texture downloads.
- Fog density/color respond to mode; fog is atmospheric rather than true volumetric raymarching. Puddle highlights are procedural neon approximations, not full screen-space or ray-traced reflections.
- The preexisting **five-draw** bloom compositor in `static/postfx.js` gains cinematic grading, subtle shadow/highlight temperature, saturation, contrast, fine grain and a restrained vignette **inside its existing composite pass** (no extra full-screen draw). Performance bypasses it with one draw.
- Auto Quality also scales down rain/motes and removes puddles when it drops optional detail. All new effects are scoped to the live renderer with proper disposal on arena unload.
- Verification: `node test_atmosphere44.mjs`, `node test_postfx.mjs`, and `npm test`. Live Render deployment and visual/fps browser tests still need confirmation.

## Phase 4.3 — district environmental storytelling (live)
- Adds `static/environment43.js` to the live `static/world.js` renderer. **The map builder, authoritative collision objects, spawns, network protocol and routes are untouched.**
- Original and legible cyberpunk brands: 24 bespoke glowing sign panels split across Night Market, Neon Plaza, Tech Atrium and Transit Deck. Each district receives its own colors, terminology, and local atmosphere.
- Procedural, deterministic building details drawn from existing facade geometry: weathered overhang rails, rain awnings, ducts, AC/service panels, louvers, illuminated status indicators, piping, and hanging power lines.
- Discreet road edge lines and lane markings attached just above the existing road slabs; no walk-through kiosks placed in corridors.
- A total of **720 additional lightweight facade/sign/street components, 34 cable runs and 24 text signs** in the checked-in live map; batched into **34 draw groups** (21 instanced box styles + 12 sign sheets + 1 cable mesh), with four shared canvas sign atlases.
- Performance: base landmarks only; High/Auto: primary architecture and business signs; Ultra: full decorative population. All new content remains visual-only with `collidable:false`.
- Run `node test_environment43.mjs` and `npm test` locally. Render deployment and in-browser screenshot comparison require live verification.

## Phase 4.2 — cinematic district lighting (live)
- Lighting is rendered directly in the active game by `static/lighting42.js`; no separate demo or map.
- Cool moon key light and restrained magenta rim light add depth without turning every surface pink.
- Four distinct district light palettes: market magenta, plaza cyan, atrium teal, transit amber; authored signs have local bounce lighting and slim emissive light fixtures.
- Four soft, shader-based ground light pools are visual-only and are disabled on Performance. The strongest fixture and shadow tiers are reserved for Ultra.
- High/Auto enable a moderate amount of sign lighting and moon shadows; Performance retains two district sources, reduces shadow cost to zero, and removes architectural spotlights.
- A deterministic, low-amplitude neon pulse updates during the existing render frame. No strobing, collision changes, network changes, or external assets.
- Test: `node test_lighting42.mjs`; production Render deployment still needs verification.

## Phase 4.1 — next-generation materials (live)
- Shared, seeded 512px procedural diffuse/roughness/bump/emission atlases in `static/materials41.js`, including lit/unlit facades, rain-worn asphalt, panelled concrete, oxidized metals, tile, grate, glass, and vegetation.
- Core map, Stage 5 architecture, and Stage 6 skyline use the same material library and reusable texture sets; no external image downloads.
- Stage 5/6 visual-only boxes are merged by finish/tier with metre-scaled UVs instead of stretched flat-color cubes. Surrounding urban windows are deterministically mixed between lit and dark across district-colored emissive materials.
- Performance mode removes surface bump mapping while retaining nighttime window glow; High and Ultra retain full PBR detail. The gameplay map, routes, and authoritative colliders are unchanged.
- Material tests: `node test_materials41.mjs`; deploy from `main` with existing Render auto-deploy.

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
