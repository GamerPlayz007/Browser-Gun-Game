# Stage 3.4 — Procedural Character Animation + Feedback

No new game build: `static/models.js` renders the existing remote player
characters in the same Three.js game. The 03.3 network timeline supplies
interpolated positions and movement flags; the animation module creates poses
for idle, walking, sprinting, falling/jumping, crouching and sliding.

## Rig

- Articulated two-part legs and arms, torso lean and subtle head pitch
- Foot stride and body bob from velocity, plus short landing ease
- Third-person muzzle flash and recoil **only** when a server `shot` event arrives
- Brief non-graphic hit response **only** when a server `hit` event arrives
- Short glowing spawn ring on player creation and spawn-generation change
- Existing labels and all current weapon meshes remain supported

## Local gameplay feedback

- Context status for sprint, slide, air, crouch, vault and ready
- Slight camera strafe lean and landing ease, disabled with Camera motion
- Readable kill-feed entrance animation with reduced-motion media fallback

## Verification

```sh
python build_map.py
python -m unittest test_map test_server test_stage31
npm test
node test_stage31.mjs
```

Unit tests use the actual Three.js rig but synthetic movement/event inputs.
Real FPS, deployment readiness, latency and online 2–8-player animation should
be inspected in Chrome/Edge on the deployed build.
