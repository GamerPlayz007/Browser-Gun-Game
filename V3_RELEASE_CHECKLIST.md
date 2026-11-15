# CROSSFIRE V3.0 — Release Candidate 1

**Build:** `3.0.0-rc.1` (server `release`) / **phase:** `05.6`
**Source of truth:** GitHub `main`; Render deploys the same branch if auto-deploy is configured.
**Status:** release candidate committed; **not production-certified** until all gates below pass.

## What V3 RC1 includes

The same single Cyberpunk City map, procedural city graphics and optional
Performance / Auto / High / Ultra / Native quality presets.

- Four server-authoritative modes: Deathmatch (first 15), Gun Game (3 per
  tier), Team Deathmatch (team first 30), Control Point (first 60 seconds
  held uncontested at the Neon Beacon, 6-minute match).
- Improved movement and first-person feedback with client/server movement
  parity checks; friend-safe spawn ranking; team balancing and ready-up.
- Host-only mode/rebalance controls; team-only respawn spectating; group
  scoreboards; a minimap objective marker; 3-second respawn.
- New V3-only features: four **visual-only** avatar accent colors synchronized
  via validated server snapshots, safe preferences even when localStorage is
  restricted, and manual **Rejoin Previous Room** after a connection loss.
  Rejoining creates a fresh player identity and resets that user's round stats.
  Room codes are not persisted in localStorage.

## Hard gates before calling this the public V3.0 launch

### 1. GitHub Actions — BOTH checks green on main

Open the repository **Actions → CROSSFIRE release checks**, inspect the most
recent run on `main`, and confirm both `javascript-tests` and
`multiplayer-integration` have successful conclusions.

```bash
npm ci --no-audit --no-fund
npm test
pip install -r requirements.txt
python -m unittest -v test_server test_map test_release51 test_modes54 test_competitive55 test_release56
```

CI includes Python/JS movement parity tests, competitive multiplayer,
server HTTP/room/WebSocket tests, cosmetic and release manifest checks.

### 2. Render deployment — correct live build

Once Render publishes the latest `main`, open:

- `/health`: `ok: true`, `release: "3.0.0-rc.1"`, `phase: "05.6"`.
- Homepage: **V3.0 RC** badge, four modes in the room selector.
- Run: `python check_live51.py https://YOUR-SERVICE.onrender.com`.

The smoke script checks release metadata, first-party JS and map assets,
room creation, two-player WebSockets and ping, Control Point mode change,
team assignment, ready-up and synchronized avatar cosmetics.

**Important:** A successful GitHub commit is not evidence that Render is
running it. Render must report the correct build.

### 3. Real-world browser playtests (Windows laptop + friends)

- Connect 2 players and then 4–8 as available. Verify joins, host handoff,
  ready-up, optional balancing, rematch flow and no ghost players.
- Test all four modes: correct HUD, score progression and results.
- Test objective contesting (both teams on point), spectators switching
  only to eligible teammates, respawns, and changes between modes.
- Verify changing cosmetic colors updates on another player's screen and
  **does not** change hit detection or player/team identity.
- Test reconnect behavior: drop Wi-Fi, use **Rejoin Previous Room**, and
  confirm the UI explains that it is a new identity.
- Test F7 diagnostics on Performance, Auto, High and Ultra. Use F8 to copy a
  private-safe report for a bug; no room codes or names should be included.
- Test Chrome/Edge on the target school laptops and the RTX 3070 computer;
  measure FPS, frame spikes, ping and jitter rather than assuming targets.

### 4. Promotion

After green CI, passing Render smoke checks and at least one successful
real multiplayer playtest, promote RC1 to `3.0.0` and update the release badge
from **V3.0 RC** to **V3.0**, as a separate verified release commit.

If any gate fails, keep the V3 release-candidate label and fix the failing
case on `main`; avoid announcing a verified production launch prematurely.
