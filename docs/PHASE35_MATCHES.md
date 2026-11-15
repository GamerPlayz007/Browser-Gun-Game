# CROSSFIRE 03.5 — Match System

## One authoritative rules engine

- Deathmatch: first to 15 points, up to 360 seconds
- Gun Game: four tiers, three points per tier, 12 total
- Both modes: 3-second countdown, 3-second respawn, host-only start/rematch
- Server owns points, streak, best streak, tier changes, rank, leader and winner
- Player ranking: most points; then fewest deaths; then headshots/name/ID for
  stable display order. Equal points and deaths share a rank.
- At time limit, tied top ranks produce DRAW. A score-goal victory ends immediately.
- Round results include `winnerId` and `winReason` to distinguish score from time.
- New rounds reset player scores/streaks, ammo, round targets and historical poses.
- No client-provided score, rank, winner or tier is accepted.

## UX

- Live round indicator, ranking, leader and tier progress in existing HUD
- New fifth column for streak on live and final scoreboards
- Server-confirmed announcements for leader changes, streaks, weapon tiers,
  start and end
- Outcome screen displays time/score finish and authoritative winner statistics

## Tests

```bash
python build_map.py
python -m unittest test_map test_server test_stage31 test_match35
npm test
node test_stage31.mjs
```
These tests are synthetic/in-process, not a proof of real deployment speed.
