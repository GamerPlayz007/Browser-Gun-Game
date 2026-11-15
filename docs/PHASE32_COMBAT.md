# Stage 3.2 — Combat Responsiveness & Feedback

**Status:** development branch for review; not deployed.

This stage refines the game *without changing weapon damage, intervals, spread,
ammo size, authoritative hit calculation, or the map pipeline*.

## Implemented

- **Automatic**: VANGUARD (AR) and VIPER (SMG) still fire continuously while
  holding the primary button, obeying their existing fire intervals.
- **Single click**: BREACH (shotgun) and LONGSHOT (precision rifle) now fire
  once per press. Releasing and pressing again is required for another shot.
- **Server-truth impact UI**: hitmarkers, damage feedback, and elimination
  banners continue to rely on events from the Python server. Unconfirmed
  client predictions cannot cause hitmarker success messages.
- **Directional damage cue**: the authoritative hit event supplies the
  attacker's in-game position for a brief orange indicator (0° forward,
  90° right). Damage numbers and hit colors distinguish confirmed headshots.
- **Ammo/reload clarity**: low and empty magazine states, weapon fire-mode
  label, a reload progress indicator, and a one-shot dry trigger tone.
- **Shot sequence anti-replay**: the server acknowledges strictly increasing
  shot IDs, including cooldown-denied packets, and drops duplicate/replayed IDs
  before invoking room shooting logic.

## Test

```bash
pip install -r requirements.txt
npm ci
python build_map.py
python -m unittest test_map test_server
npm test
CROSSFIRE_STAGE31=1 python build_map.py
CROSSFIRE_STAGE31=1 python -m unittest test_stage31
node test_stage31.mjs
```

Automated tests exercise input state, ammo math, shot feedback, replay
protection over a live in-process WebSocket, and the Stage 3.1 map renderer.
They do not measure actual FPS, GPU behavior, perceived input responsiveness,
WebGL visual quality, or real-world network jitter.

## Manual playtest gates before merge

- Confirm one-click semi-auto response in both Chrome and Edge.
- Check held auto fire, quick clicks, shotgun, precision ADS, reload cancel,
  weapon switch, respawn, room transitions, and pointer-lock exit.
- Confirm target hit, headshot color, and direction cue for left/right/rear.
- Verify server/client displayed ammo under packet delay and multiple players.
- Verify 02.5 default map and Stage 3.1 experimental city both load.
- Do not merge into main or deploy to Render until the existing game and
  experimental map have been playtested.

This is a browser **game** implementation, not real-world firearm instruction.
