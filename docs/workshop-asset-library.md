# CROSSFire Workshop — Permanent Asset Library
Phase 2 / Stage 1 adds a searchable, version-aware asset library inside the **existing garage** at `/static/workshop.html`. The old benchmark and Daybreak field test remain separate and unchanged.

**Repository inventory:** 11 catalog entries, including a live S-12 v0.4 performance GLB, three SPECTER finishes with performance/balanced/original versions, early SPECTER prototypes, a studio beacon, and an attributed Fox rig demonstration. Runtime-only AR, SMG, and Operator models are honestly marked unavailable for standalone GLB preview. The old AWP draft is marked as an offline model requiring re-import.

**Personal asset shelf:** Import a local GLB (30 MB maximum), validate binary glTF v2 and decode with Three.js, then persist the actual file blob to IndexedDB. Saved models can be reopened and deleted in that browser. No server uploads, GitHub commits, cross-device sync, or automatic game integration.

**Tests:** `npm run test:workshop`. Covers catalog URLs against repo files, filtering, header validation, UI wiring, and multiplayer isolation. A/B comparison works for entries with two or more profiles.

The workshop is a viewer/benchmark and does not modify Blender mesh geometry. `server.py`, `static/game.js`, physics, matchmaking, and game weapons remain untouched.
