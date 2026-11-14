# CROSSFIRE 02.4 — CYBERPUNK CITY

Browser multiplayer FPS for 2–8 friends. Four architectural districts, twelve named connections, and room-scoped maps. Cyberpunk City is the active map. Lush Rainforest and Solstice (Sandstone) appear as disabled future entries in the lobby selector.

## Upload to your existing GitHub + Render service

1. Extract `CROSSFIRE_Replit.zip`.
2. Open `GamerPlayz007 / Browser-Gun-Game` on GitHub, then **Add file → Upload files**.
3. Drag **the contents of the extracted folder** into GitHub, including the whole `maps` and `static` folders. Upload files/folders, not the ZIP or its outer folder. Preserve their paths.
4. Commit to `main`. Matching paths replace the existing files; new paths are added. **No old files need deleting.** `UPLOAD_02_4.md` gives the exact changed/added list.
5. Keep the existing Render service: **Python 3**, build `pip install -r requirements.txt`, start `python server.py`, health check `/health`. No Node build is required in production. Keep your current region and instance plan.
6. After the deploy is Live, press **Ctrl + Shift + R** on the game page. Everyone should refresh. Restarting the server clears existing rooms.

Confirm the lobby shows **CYBERPUNK** and badge **02.4**, and its Arena selector shows **Cyberpunk City**. `/health` returns `revision: "02.4"` and `mapId: "cyberpunk"`.

## Play

Enter a callsign, choose a starting weapon and an available map, then create a room. Use **Copy invite** to invite friends. Joining automatically loads that room's map; the map is fixed for the lifetime of the room. The host chooses Deathmatch or Gun Game and starts the round. Practice targets are available while waiting. Player damage is disabled in the practice lobby.

| Action | Control |
|---|---|
| Move / look | WASD / mouse |
| Sprint / jump / slide | Shift / Space / C |
| Shoot / aim | Left / right mouse |
| Reload / weapon | R / 1–4 |
| Scoreboard / full map | Hold Tab / hold M |
| Room menu | Escape |

Deathmatch ends at 15 kills or six minutes. Gun Game advances every three kills and ends at 12. Three-second respawns and 1.5-second spawn protection remain. The host can start a rematch; host ownership passes to another player when the host leaves.

## City architecture

The playable footprint is **80 × 80 metres**, bounded by city frontage with a skyline behind it. Tall solid buildings separate the districts and contain carved passages. The central tower breaks cross-district views.

- **Neon Plaza:** recessed intersection, subway entrance cover, cyan edge markings and an unlit holographic sign.
- **Night Market:** recessed counters, overhead signage, canopy terraces and a dedicated stair access.
- **Tech Corporate Atrium:** enclosed high-ceiling lobby, pillar cover, mezzanine, opaque tinted glass-style railings and an escalator-style ramp.
- **Elevated Transit Deck:** station canopy, train-car cover, public stairs and separate staff approaches.

Streets are 6 m wide; interior and upper routes are 4 m wide. The city has six named access ramps. Street level is 1 m, the plaza is 0 m, canopies/mezzanines are 5 m and the transit platform is 9 m. Main circulation requires no jump. Ramps use the same inclined slab for rendering, player collision and bullet collision, including open space beneath them.

| Pair | Street | Interior | Upper |
|---|---|---|---|
| Market ↔ Plaza | G1 Delivery Alley | I1 Electronics Shop | U1 Signwalk |
| Plaza ↔ Atrium | G2 Corporate Forecourt | I2 Security Lobby | U2 Executive Link |
| Market ↔ Transit | G3 Station Approach | I3 Maintenance Offices | U3 Rooftop Connector |
| Atrium ↔ Transit | G4 Service Street | I4 Operations Wing | U4 Commuter Bridge |

`MAP_GUIDE.svg` shows all twelve connections, buildings, elevations and spawns. It is a vector image and stays sharp when enlarged.

## Display and performance

- The renderer starts at **viewport × devicePixelRatio**, updates after window/DPI changes, and uses native WebGL antialiasing. The old 1000 × 700 cap is removed.
- **Auto** monitors sustained frame times. It first removes optional skyline detail, then reduces 3D resolution in gradual 5% steps if still slow. It waits for sustained recovery before raising quality again. Initial loading, hidden tabs and large stalls are excluded from sampling.
- Auto never drops below 75% of native pixel density or one rendered pixel per CSS pixel, whichever is greater. At DPR 1 it keeps native resolution and can only reduce optional detail. **Native** locks full display resolution, subject to the GPU's renderbuffer limit.
- UI text remains at native display resolution. The minimap rebuilds its cached image at the current display density when expanded or resized.
- The city uses **17 static geometry batches across four districts**, **21 scene meshes / 4,400 triangles** including practice targets, excluding player/weapon rigs. Lit geometry shares one material; neon shares one unlit material. Fixed signs share one texture atlas. No point lights, bloom, reflections or real-time shadows are used.
- Fixed-step prediction remains at 30 Hz. Camera height extrapolates ground movement on slopes, and movement tests compare server and browser results frame by frame.

**60 FPS is a target, not a measured guarantee.** The automated geometry/quality tests pass, but live WebGL visuals, eight-player rendering and FPS on Windows laptops have not been verified. The preview browser's automatic approval review reported a usage limit. After deploying, check both FPS and ping: resolution changes do not reduce network latency. High ping can still cause authoritative corrections; there is no historical hit rewind.

## Local development and tests

Python 3.11+ and Node (for tests):

```sh
pip install -r requirements.txt
python server.py
```

Open `http://localhost:3000`. The production server respects Render's `PORT` variable. Runtime Three.js files are bundled locally.

```sh
npm install
python build_map.py
python -m unittest -v test_map.py test_server.py
npm test
```

Validation covers:

- **26 Python tests**, including gameplay, actual WebSocket room capacity/host transfer, invalid map selection, room-map contracts and map-specific spawns, movement and shooting.
- **108 complete navigation traces**: twelve routes plus six access ramps × both directions × sprint/jump/slide, using the slowest weapon. Every movement step is compared against the shipped JavaScript physics.
- Street/interior/bridge width samples, jump headroom, support, protected spawns, interrupted sightlines, broad-phase collision completeness and deterministic map/guide output.
- Node scene/geometry budgets, weapon/player rigs, movement parity at simulated 10/20/30/60/144 FPS, delayed acknowledgement replay, minimap labels/DPI and Auto quality hysteresis/recovery.

The map guide was visually inspected. Browser gameplay and laptop benchmarks remain a deployment playtest step.

## Adding the next map

1. Create an authoring module under `maps/` and generate its JSON under `static/maps/`. Use the Cyberpunk schema: `id`, `name`, `revision`, `theme`, `size`, `palette`, `boxes`, `decor`, `zones`, `spawns`, `practiceTargets`, `signs`, `routes`, and `stairs`.
2. Extend `build_map.py` to compile that module and set its registry entry to `available: true` with the exact `/static/maps/...json` URL. The registry generated here is the source of truth; hand-edits to generated JSON are overwritten on rebuild.
3. Keep shared weapon balance in `static/weapons.json`. Embed the same weapon data when compiling a map. Maps do not define different gameplay weapons per room.
4. Restart the server. `map_registry.py` loads enabled entries, the lobby lists them automatically, and each new room selects its own arena. Joining clients load the map reported by the room before opening their WebSocket.
5. Run navigation tests for the new map before enabling it. Set the registry's `default` to change the default map.

`static/map.json` remains a generated copy of the default Cyberpunk map for existing tooling. The live client loads map-specific URLs; the server uses the registry. The environment renderer is data driven, with per-zone batches and palette colors, so additional maps can reuse it.

## Source and deployment limits

- `maps/cyberpunk.py`: authored buildings, routes, ramps, props and guide generation.
- `build_map.py`: deterministic compilation and map registry output.
- `map_registry.py`: map loading, spatial indexes and inclined-solid ray intersection.
- `server.py`: authoritative movement, shooting, rooms and matches.
- `static/world.js`: shared-material per-zone geometry and signage.
- `static/physics.js`: matching browser collision and prediction.
- `static/display.js`: adaptive/native render sizing.
- `static/game.js`, `static/minimap.js`: client, UI, navigation and networking.

Use one Python process/instance: rooms and scores live in memory. There are no bots, accounts, permanent stats, voice chat or touch controls. Open in a full browser tab with WebGL2 and hardware acceleration. Optional Google Fonts has system-font fallbacks. Existing Three.js components and aiohttp are credited in `THIRD_PARTY.md`; no assets were extracted from commercial games.
