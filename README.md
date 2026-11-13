# CROSSFIRE 02.3 — SOLSTICE: SKYWAYS

Browser multiplayer FPS for 2–8 friends. An expansion of the 2.2 build, replacing its map with connected three-lane architecture, compatible with the same Python/Render hosting settings.

## Update your existing GitHub + Render deployment

1. Extract the ZIP on your computer.
2. Open your **GamerPlayz007 / Browser-Gun-Game** repository on GitHub.
3. Choose **Add file → Upload files**.
4. Drag **all contents inside the extracted folder**, including the complete `static` folder, onto the upload page. Do not upload the ZIP or the outer folder. Keep file names and folder structure.
5. Commit the upload to `main`. Existing matching files are replaced and new files added. No old files require deletion.
6. Render should automatically deploy that commit if On Commit is enabled. Otherwise select **Manual Deploy → Deploy latest commit**.
7. Keep these Render settings: Python 3; build `pip install -r requirements.txt`; start `python server.py`; health `/health`; existing Free instance. Use whichever existing service you selected after testing regional ping; this update itself needs no new service.
8. Once Render says Live, open your existing game URL and press **Ctrl + Shift + R** to load the new version. All players should refresh; old rooms are cleared on restart.

The lobby should say **SOLSTICE** with the **02.3** badge and four selectable weapon cards. If you see the old industrial-yard lobby, the new deployment has not finished or the page is cached.

## Play with friends

1. Enter your name and select a starting weapon.
2. Create a room. The first person is its host.
3. Press **Copy invite** in the room panel and send the link to friends.
4. Friends enter their names and join with the prefilled room code.
5. Choose **Deathmatch** or **Gun Game** before starting.
6. **Enter practice** lets you move and shoot targets while waiting. Players cannot damage each other during practice.
7. The host presses **Start match**. A three-second countdown starts the round. If your mouse is not captured, click the arena.
8. When the round ends, the results show everyone’s kills, deaths and headshot kills. The host presses **Play again**. If the host leaves, hosting passes to another player.

Desktop keyboard and mouse required. Open in a full browser tab, not an iframe preview.

## Skyways architecture (2.3)

- **80 × 80**, organised into three interconnected lanes: orange/terracotta **Ember Roofs**, white/blue **Azure Court**, slate/green **Emerald Gardens**.
- Hollow arcade beneath three Ember roof sections; a split bell tower and a second roof access staircase. Roof shortcut gaps are 2 m and 2.5 m.
- A white northern bridge links Ember's roof to the garden pavilion, with a clear central underpass. Its arch faces the direction of travel.
- Raised court approaches surround a recessed-by-comparison fountain court. A broken gold ring marks the centre, with turquoise water and offset planting walls.
- Gardens rise through connected tiers, with a pavilion, waterfall, western ramp chain and eastern roof gallery. Its optional gap is 1.5 m. Two .9 m ledges provide a jump shortcut.
- Nine movement ramps/stairs have continuous wedge visuals over 12.5 cm collision risers. Existing acceleration, jump, slide and prediction constants are unchanged. The ramp visual/collision difference is at most 12.5 cm.
- Main ground arches offer 8–10 m width and 5.2 m clear headroom; the bridge arch offers a 5 m clear opening above the deck. Staggered walls break the three main north/south ground sightlines.
- **16 spawns**, 2–8 player rooms, minimap and **hold M** for the full map.
- `python build_map.py` regenerates **both** `static/map.json` and `MAP_GUIDE.svg` from the same authored layout.
- Shared materials and merged static geometry: **17 scene meshes / 4,506 triangles**, including sky and practice targets, excluding players/weapons. The water is opaque and batched, with no reflection or post-processing pass. Performance defaults are retained.

The four weapons, ADS, reloads, sprint/jump/slide, Gun Game, practice, host controls and match results remain available.

## Modes

**Deathmatch:** first to 15 kills or the leader after six minutes. Fewest deaths breaks a kills tie; an exact tie is a draw. Use 1–4 to switch weapons. Each weapon retains its magazine when switched; respawning refills magazines.

**Gun Game:** three kills with each weapon in sequence: rifle → SMG → shotgun → sniper. The 12th kill wins. Manual switching is disabled during the round. Targets never count as kills.

Three-second respawns; 1.5-second spawn protection, cancelled when firing. The server picks spawns based on distance and blocked sightlines.

## Controls

| Action | Control |
|---|---|
| Move | W A S D |
| Look | Mouse |
| Fire | Left mouse; hold for repeated firing |
| Aim / scope | Hold right mouse |
| Sprint | Shift |
| Slide | C while moving quickly; 1.7-second cooldown |
| Jump | Space |
| Reload | R |
| Switch weapon | 1–4 in Deathmatch |
| Scoreboard | Hold Tab |
| Expanded map | Hold M |
| Room menu / release mouse | Escape |

The match continues while your room menu is open. Click Resume to recapture your mouse.

## Local development

Python 3.11+:

```sh
pip install -r requirements.txt
python server.py
```

Open http://localhost:3000. The server respects Render’s `PORT` variable. The JavaScript libraries are bundled; no npm install or build step is needed for deployment.

The optional Node scene test uses the official Three.js npm package:

```sh
npm install
node test_scene.mjs
```

## Verification and limits

Run the checks from the project folder:

```sh
python -m unittest -v test_server.py test_map.py
npm install
npm test
```

- **26 Python tests** cover gameplay, eight-client WebSocket capacity/host transfer, spawn support, ground-route connectivity, interrupted lane sightlines, perimeter containment, spatial indexing and deterministic map/guide generation. `test_map.py` directly executes the shipped JavaScript physics with Node and compares every movement step with the Python server: all three gap widths with all four weapon speeds, both .9 m ledges, all nine ramps, and main-arch jump/slide clearance. Negative checks confirm the gap/ledge shortcuts cannot simply be walked across.
- Node tests validate finite geometry and batching, weapons, client/server movement agreement at simulated 10–144 FPS, delayed acknowledgement replay, minimap lane names and throttled redraws.
- Python compilation and JavaScript syntax checks passed.
- The tactical overview was visually inspected. Live WebGL gameplay and laptop performance are **not verified** in this environment, whose preview browser previously disabled WebGL. Test with friends after deployment; check FPS and ping separately. Eight-player rendering/server load has not been benchmarked on your laptops or Render instance.

Networking uses a 30 Hz authoritative server, immediate local firing effects, fixed-step client prediction with acknowledged-input replay and interpolated opponents. There is no historical hit rewind or production-grade competitive anti-cheat. High latency can still cause position corrections. Free hosting can add latency, restart or sleep. Do not claim or expect a guaranteed frame rate or uninterrupted service.

Rooms and scores live in memory. Use one server process/instance. Server restarts clear rooms. There are no bots, accounts, permanent stats, voice chat or touch controls in this build.

If WebGL is unavailable, use a WebGL2-capable Chrome/Edge browser with hardware acceleration. If movement/rendering stutters, select **Performance** in the room settings. The gun/map assets are local; optional Google Fonts has system-font fallbacks.

## Source

- `server.py`: authoritative movement, collision, shooting, rooms and matches.
- `static/map.json`: shared visual/collision/weapon data.
- `build_map.py`: map-authoring script and SVG guide generator, run only when changing layout or weapon balance.
- `static/world.js`: batched procedural environment.
- `static/models.js`: weapons, arms, player rigs and animations.
- `static/physics.js`: client movement prediction.
- `static/spatial.js`: shared-map collision broad phase for the client.
- `static/minimap.js`: cached tactical map and district navigation.
- `static/game.js`: network client, controls, effects and UI.
- `static/audio.js`: original synthesized sound.
- `static/index.html`, `static/style.css`: lobby, HUD, room and results screens.
- `THIRD_PARTY.md`: reused libraries and licenses.

Three.js’s existing Sky, RoundedBoxGeometry and BufferGeometryUtils components are reused instead of implementing those systems from scratch. The original Python/aiohttp architecture is retained. No assets were extracted from Venge or other commercial games.
