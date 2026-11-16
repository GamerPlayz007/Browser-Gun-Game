# Stage 6.3: source-accurate collision and movement

## Implemented

- **Original collision triangles:** the same `MapGenerator().generate().soup` used by the source FPS, not re-created boxes.
- **Source BVH and swept capsule:** unmodified `CharacterController.js` imported under the original MIT license, sharing the original BVH.
- **Walking preview:** inside the existing CROSSFire lobby/canvas, WASD, Shift, Space to jump, Ctrl crouch, mouse drag to look.
- **Inspection toggle:** Free Fly permits Q/E vertical movement; Street, Market and Plaza viewpoint buttons switch into Free Fly.
- **No visual change required:** same buildings, doors, obstacles and source mesh.
- **Server-ready mesh export:** `node scripts/export_dust_collision63.mjs` produces `static/maps/dust_collision63.bin.gz` plus `.meta.json` with exact original collision triangles, material IDs, spawn positions, checksummed identity.
- **Python reader:** `dust_collision63.py` verifies format/count/checksum and exposes individual source triangle coordinates. This is a data contract, NOT yet active server motion.
- **CI:** Node fixed-step physics and exporter parity, Python binary-format integrity tests; Main Build Gate publishes generated collider files after checks pass.

## Safety gate

Do **not** add Dust Corridor to the multiplayer map registry or route live server movement through this mesh yet. The Python server currently implements box/ramp movement, not mesh capsule motion. Multiplayer requires authoritative collision parity and server integration during subsequent stages. The preview is genuinely collision-aware, but *not a live server-authoritative match*.

## Test

1. Open CROSSFire home, choose Explore Dust Corridor.
2. Walk into market stalls, wall faces, corners and building doorways; hit Space and Ctrl.
3. Toggle Free Fly, inspect geometry, then toggle WALK to return to source-safe spawn.
4. Run `node scripts/export_dust_collision63.mjs && node test_dust63.mjs && python -m unittest -v test_dust_collision63`.

Source: Leonxlnx/claude-of-duty pinned at 7f8a15ae; original MIT notice preserved in integrations/dust_corridor/LICENSE.
