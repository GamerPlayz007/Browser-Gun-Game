# Movement and performance patch 2.1

Upload this complete package to the same repository and commit, then wait for Render to finish and hard-refresh every client. **Both server.py and the static folder must be updated together**: this patch changes the input protocol. The lobby badge says **02.1**.

- Fixed-step 30 Hz movement on both client and server. The server acknowledges only commands it has simulated. Clients replay unacknowledged input and smooth small visual corrections.
- Removed frame-dependent movement slowdown below 29 FPS; tested mixed sprint/jump/diagonal/slide/ADS inputs at simulated 10, 20, 30, 60 and 144 FPS.
- Reset stale commands on respawn, bounded input time budgets, and tested 200 ms delayed acknowledgements.
- Performance rendering is now the default (including for existing installations): no shadows, no MSAA, reduced render resolution capped around 1000 by 700 pixels. High quality is still selectable.
- Hidden weapon scene no longer renders; scoreboard and roster rebuild only when their contents change. Server snapshots reduced to ~20 Hz while movement remains 30 Hz.

Validation: 17 Python server tests, scene construction checks, JS syntax checks, and cross-language movement/replay tests passed. These are simulation checks, not measured laptop FPS. Live WebGL gameplay remains unverified in this environment. After updating, check both FPS and MS in the bottom-left HUD; FPS measures rendering, MS measures round-trip network latency.

# CROSSFIRE 02 — SOLSTICE

Browser multiplayer FPS for 2–4 friends. An upgrade to Build 01, compatible with the same Python/Render hosting settings.

## Update your existing GitHub + Render deployment

1. Extract the ZIP on your computer.
2. Open your **GamerPlayz007 / Browser-Gun-Game** repository on GitHub.
3. Choose **Add file → Upload files**.
4. Drag **all contents inside the extracted folder**, including the complete `static` folder, onto the upload page. Do not upload the ZIP or the outer folder. Keep file names and folder structure.
5. Commit the upload to `main`. Existing matching files are replaced and new files added. No old files require deletion.
6. Render should automatically deploy that commit if On Commit is enabled. Otherwise select **Manual Deploy → Deploy latest commit**.
7. Keep these Render settings: Python 3; build `pip install -r requirements.txt`; start `python server.py`; health `/health`; existing Free instance. Do not create a second Render service.
8. Once Render says Live, open your existing game URL and press **Ctrl + Shift + R** to load the new version. All players should refresh; old rooms are cleared on restart.

The lobby should say **SOLSTICE** with **CROSSFIRE 02** and four selectable weapon cards. If you see the old industrial-yard lobby, the new deployment has not finished or the page is cached.

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

## What's new

- **Solstice map:** sandstone/terracotta buildings, fountain plaza, market stall, palm trees, side routes, staircases, accessible roofs and a bridge with a walkable underpass.
- **Four weapons:** Vanguard rifle, Viper SMG, Breach shotgun and Longshot sniper. Different fire rates, magazine sizes, reload times, spread, headshot multipliers and damage falloff.
- **Weapon presentation:** rounded models, first-person arms, iron sights/scope, detachable-magazine reload motion, muzzle flashes and immediate firing audio/recoil.
- **Movement:** acceleration, sprinting, jump/landing physics, automatic stair stepping and short momentum-based slides with cooldown.
- **Feedback:** headshot/damage indicators, elimination messages, impacts, kill feed and positional attenuation for remote gunfire.
- **Players:** articulated running animation, different held weapons and short-range nametags.
- **Match flow:** roster, host-controlled mode/start, countdown, results, rematch and host transfer.
- **Settings:** sensitivity, volume, performance resolution/shadows, camera-motion toggle. FPS and ping are visible.

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

- **15 Python tests passed:** cover, headshots/weapon roles, ammunition/reload/switching, death/respawn/win, Gun Game advancement, host-only start/countdown/rematch/draw, practice immunity, targets, spawn validity, stair traversal, bridge underpass/deck, slide/jump/input timeout, HTTP and real WebSocket clients including room isolation, capacity and host transfer.
- **Node scene test passed:** all generated vertices finite, static map batching (50 meshes / ~6,000 triangles, excluding players/weapons), four weapon rigs and client staircase simulation.
- Python compilation and all JavaScript syntax checks passed.
- Lobby layout inspected. The available preview browser disables WebGL, so live rendering, animation appearance, mouse lock, audio and end-to-end gameplay on laptops remain unverified. Treat this as a playtest build. Test with two laptops before inviting a full group.

Networking uses a 30 Hz authoritative server, immediate local firing effects, simple client movement prediction and interpolated opponents. There is no historical hit rewind or production-grade competitive anti-cheat. High latency can still cause position corrections. Free hosting can add latency, restart or sleep. Do not claim or expect a guaranteed frame rate or uninterrupted service.

Rooms and scores live in memory. Use one server process/instance. Server restarts clear rooms. There are no bots, accounts, permanent stats, voice chat or touch controls in this build.

If WebGL is unavailable, use a WebGL2-capable Chrome/Edge browser with hardware acceleration. If movement/rendering stutters, select **Performance** in the room settings. The gun/map assets are local; optional Google Fonts has system-font fallbacks.

## Source

- `server.py`: authoritative movement, collision, shooting, rooms and matches.
- `static/map.json`: shared visual/collision/weapon data.
- `build_map.py`: map-authoring script, run only when changing layout or weapon balance.
- `static/world.js`: batched procedural environment.
- `static/models.js`: weapons, arms, player rigs and animations.
- `static/physics.js`: client movement prediction.
- `static/game.js`: network client, controls, effects and UI.
- `static/audio.js`: original synthesized sound.
- `static/index.html`, `static/style.css`: lobby, HUD, room and results screens.
- `THIRD_PARTY.md`: reused libraries and licenses.

Three.js’s existing Sky, RoundedBoxGeometry and BufferGeometryUtils components are reused instead of implementing those systems from scratch. The original Python/aiohttp architecture is retained. No assets were extracted from Venge or other commercial games.
