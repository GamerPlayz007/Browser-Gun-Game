# CROSSFIRE 03.6 — Phase 3 release validation

## What Phase 3 now validates

**One game and one default map**, with authoritative 60 Hz movement, combat,
20 Hz network snapshots, and Deathmatch/Gun Game scoring.

### Automated validation (GitHub Actions)

1. Deterministic map build and the Python regression suite.
2. JavaScript rendering, 60 Hz prediction parity, combat, networking, animation,
   match systems and frame pacing tests.
3. Real loopback aiohttp/WebSocket probes with **2, 4 and 8 independent clients**.
   The probes send actual movement messages and observe the server's snapshots,
   player IDs, modes, acknowledgements, room isolation, host transfer, room
   capacity, and connection cleanup.
4. **Chromium software-WebGL smoke:** loads the real production HTML/Three.js
   module, creates a room, joins a second independent WebSocket client, sees a
   two-player roster, opens in-game diagnostics, and starts a real round.
5. Stores `stage36_loopback_metrics.json` and
   `stage36_chromium_smoke.png` as a GitHub Actions artifact.

### Understand the measurements

The loopback report measures the actual Python server and local socket
transport on a GitHub-hosted machine. It does **not** measure Dubai-to-Render
latency, public-Internet packet loss, a Windows laptop GPU, or the FPS of an
RTX 3070.

The in-game F7 diagnostics panel measures the player's actual browser
`requestAnimationFrame` pacing (average FPS and 1% low; p50/95/99 ms),
network RTT/jitter, packet sequence gaps, and Three.js draw-call/triangle
counts. `/health` exposes only aggregated server-loop and snapshot data.

### Live-player release checklist

- [ ] Render confirms commit and version 03.6 deployed, `/health` reports OK
- [ ] RTX 3070 at High and Ultra: record FPS average, 1% low, P95 frame time
- [ ] School Windows laptop at Auto/Performance: record the same metrics
- [ ] Two, four and eight separate computers / tabs join one room and play
- [ ] Check a long match: jumping, sliding, vaulting, reloads and respawns
- [ ] Check several round transitions: Deathmatch → Gun Game → rematch
- [ ] Record RTT, jitter, snapshot gaps, correction/teleport anomalies
- [ ] Leave/reconnect and transfer host; verify invitation still works
- [ ] Verify all named routes in the actual 120 m city with players
- [ ] Confirm no console errors and no repeated WebGL context loss

**A green CI result is the automated Phase 3 release gate, not a statement
that real-world, real-GPU multiplayer acceptance has happened.** Share F7
metrics or the results of the live checklist when available.

## Commands

```bash
pip install -r requirements.txt
npm ci
python build_map.py
python -m unittest test_map test_server test_stage31 test_match35 test_stage36
npm test
node test_stage31.mjs
python load36.py --out stage36_loopback_metrics.json
pip install playwright
python -m playwright install chromium
python test_browser36.py
```

Only the CI suite must use Chromium; regular game hosting does not need it.
