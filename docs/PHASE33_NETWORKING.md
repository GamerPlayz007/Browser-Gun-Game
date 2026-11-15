# CROSSFIRE Stage 3.3 — Networking

**Mainline integration:** Stage 3.3 is implemented in the existing multiplayer
client and single Python authoritative server. No separate arena or prototype
game is created.

## Protocol

State packet fields:
- `snapshotSeq` — strictly increasing **per room** for out-of-order rejection
- `serverTime` — monotonic Python time in seconds at snapshot construction
- `tickRate=60`, `snapshotHz=20`
- `players`, `targets`, `events` — unchanged gameplay authority

Ping/pong includes the original client `t` and server `serverTime`;
the client estimates clock offset by the midpoint of the RTT. This assumes
approximately symmetric network delay, not precise wall-clock time.

## Rendering policy

Remote players interpolate between *authoritative* server snapshots with a
95–185 ms adaptive render delay, based on observed variation between
interarrival and server intervals. Out-of-order state packets are discarded.
If the clock runs past the newest packet, movement is extrapolated for at most
80 ms, with bounded speeds, and then freezes rather than flying offscreen.
Respawns, teleports, disconnects, and player removals reset stale history.

The local player continues immediate 60 Hz client prediction. Replayed,
unacknowledged inputs reconcile against the current server snapshot; camera
error is eased for small corrections and snapped for large divergence.

No network change allows the client to authorize hits, movement, health,
inventory, room state or scores.

## Test commands

```sh
python build_map.py
python -m unittest test_map test_server test_stage31
npm test
node test_stage31.mjs
```

A GitHub Actions green run validates deterministic logic but **not** actual
2–8-player gameplay at an external Render deployment. Manual release checks:
- 2, 4, and 8 clients; respawns, crouch, wall-kicks and match transitions
- RTT variation and simulated packet delay (Network tab)
- Snap-to-position behavior for teleports and late joins
- Performance and High/Ultra GPU presets on Windows laptops
