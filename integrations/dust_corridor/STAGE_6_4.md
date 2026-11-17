# CROSSFire Stage 6.4 — server preflight, safe spawns, bounds, minimap

## Implemented

- The **existing Python server** exposes `GET /api/dust-corridor/preview64` with original `DUSTCOL3` source checksum, count, bounds, A/B spawn positions, and server-validated spawn indices.
- The server's `dust_world64.py` indexes all **96,588 original collision triangles** in a 4-metre spatial grid. It performs closest-triangle, exact segment raycasts, original terrain probes, and conservative full-height player-capsule spawn clearance.
- The existing CrossFire preview validates the server contract before activating. Mismatched source or missing validated spawn candidates fail safely; the other live maps are untouched.
- A source-footprint minimap shows buildings, original streets, market, plaza, safe spawn groups and position. It is a canvas overlay, not a second renderer.
- Buttons SPAWN A / SPAWN B load server-approved positions into the same original swept-capsule preview. The author's play bounds are enforced in preview walking mode.
- CI compares server Python segment ray distances against the original JavaScript BVH using generated deterministic probes, exercises server API restrictions and smoke tests Chromium preview.

## Not a multiplayer map yet

Stage 6.4 adds authoritative **world queries** (geometry/bounds/spawns) and exposes them through the server, NOT authoritative multiplayer *movement*. The existing Python room controller is box/ramp based; its movement needs a source-mesh parity implementation before the map can safely join the lobby in Stage 6.5. Dust Corridor remains unselectable as a match.

## Commands

```
node scripts/export_dust_collision63.mjs
node scripts/gen_dust_probe64.mjs
python -m unittest -v test_dust_collision63 test_dust64
python test_dust_browser63.py
```

Upstream: Leonxlnx/claude-of-duty @ 7f8a15ae (MIT). Original license and source hashes preserved in integrations/dust_corridor.
