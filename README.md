# CROSSFIRE — Build 01

A browser-based 3D deathmatch prototype for 2–4 friends. Python runs the shared game server; Three.js renders the game on each player's laptop. No game download is needed for players once you publish it.

## What's included

- One industrial arena with shipping containers, cover and low blocks you can jump onto.
- WASD, mouse look, sprint, jump, rifle, ammunition, reload and synthesized audio.
- 100 HP, 25 damage per hit, 30-round magazine, unlimited reserve ammunition.
- Three-second respawns and 1.5-second spawn protection (firing cancels protection).
- First to 15 kills, or the leader after 10 minutes; deaths break score ties. An exact tie currently selects the first joined tied player.
- Automatic new round after ten seconds.
- Room creation, six-character codes, invite links, kill feed and scoreboard.
- Two orange practice dummies. They respawn, but do not award kills.
- Sensitivity, sound and resolution controls in the pause menu.

This is the agreed first deathmatch milestone. Gun Game weapon progression, bots, multiple maps and accounts are not included in this build.

## Run on Replit

1. Import this ZIP as a Replit project using its ZIP import option. Alternatively, create a Python project and upload the extracted files and `static` folder, keeping their structure. `server.py` must be in the project root.
2. Open the project Shell and run:

   ```sh
   pip install -r requirements.txt
   ```

3. Click Run. The supplied `.replit` configuration runs `python server.py`. If Replit asks for a run command, enter that exact command.
4. Open the web preview in its **own browser tab**. Embedded previews can block mouse capture.
5. Enter a callsign, choose **Create a room**, then **Enter arena**. Use **Copy invite** to share the room link. Your friend enters a nickname and clicks the arrow beside the prefilled room code.

There is no JavaScript build step. Three.js is bundled under `static/vendor`; Node/npm is not needed to play or host this version. The `package.json` records the bundled version and supports local preview tooling.

### Publish a stable link

Use one **Reserved VM / Web server** instance so all players connect to the same Python process. Configure:

| Setting | Value |
|---|---|
| Build command | `pip install -r requirements.txt` |
| Run command | `python server.py` |
| Internal port | `3000` (or the supplied `PORT` environment variable) |
| Access | Public, if friends should join without Replit accounts |

Replit hosting may cost money; check its displayed price before publishing. Development preview links depend on the workspace staying awake and its access settings. Public publishing has not been performed for you.

Official Replit hosting reference: https://docs.replit.com/pt/references/publishing/reserved-vm-deployments

Do not use static-only hosting: it cannot run the multiplayer server. Do not launch multiple independent workers or replicas: rooms are held in process memory, not a shared database. Restarting the server clears all rooms and scores; create a new room afterward.

## Run on Windows instead

Install Python 3.11 or newer. Open a terminal in the extracted folder:

```powershell
py -m pip install -r requirements.txt
py server.py
```

Open `http://localhost:3000` in Chrome or Edge. This local address works only on your own laptop; it is not a public invite link. On a permitted LAN, friends can use the host laptop's LAN address and port 3000 if firewall/network rules allow it. For remote friends, use your published Replit URL.

## Controls

| Action | Control |
|---|---|
| Move | W A S D |
| Aim | Mouse |
| Shoot | Hold left mouse button |
| Sprint | Left Shift |
| Jump | Space |
| Reload | R |
| Scoreboard | Hold Tab |
| Release mouse / pause menu | Escape |

The match continues while you pause. Click Resume to capture the mouse again. Desktop keyboard and mouse required; touch controls are not included.

## Troubleshooting

- **WebGL unavailable:** use a WebGL2-capable browser/laptop with hardware acceleration enabled. This game cannot render without it.
- **Mouse capture blocked:** open the game as a full browser tab rather than an embedded preview, then click Enter arena.
- **Room expired:** create a new one. Empty rooms are cleaned up; restarts clear rooms.
- **Connection failed:** check that the Python server is running and the network permits WebSocket connections.
- **Low frame rate:** press Escape and uncheck High resolution.
- **Lag:** this is a basic 30 Hz prototype with client prediction and interpolated opponents. It does not yet have production lag compensation or competitive anti-cheat.

## Verification

Run `python -m unittest -v test_server.py`.

Eight automated tests cover damage through cover, weapon cadence/reloading/protection, kills/respawns/win/reset, movement/collision/input timeouts, jumping, practice targets, HTTP assets and real multi-client WebSocket connections (isolation, room capacity, malformed inputs, client-authority rejection and disconnects).

Python compilation and JavaScript syntax checks passed. The lobby was inspected in a browser. The available QA browser disabled WebGL, so live rendered gameplay, mouse lock and laptop frame rate remain unverified. Test with two laptops before relying on this for a group session.

## Source guide

- `server.py`: authoritative simulation, room API, WebSockets and static hosting.
- `static/game.js`: arena/model creation, browser controls, rendering, audio and network UI.
- `static/style.css`, `static/index.html`: lobby, HUD and menus.
- `test_server.py`: automated server tests.
- `.replit`: Replit run/publishing configuration.

Procedural art and generated sound; no Fortnite assets. Three.js is MIT licensed; its license is included in `static/vendor/THREE-LICENSE.txt`. Google Fonts is used for optional typography, with local system-font fallbacks.
