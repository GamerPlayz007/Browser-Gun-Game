# Third-party code and credits

## Three.js r180 — MIT

Bundled under `static/vendor/`:

- `three.module.js`, `three.core.js`
- `addons/objects/Sky.js`: analytical daylight sky shader (retained for future daylight maps; unused by Cyberpunk)
- `addons/geometries/RoundedBoxGeometry.js`: rounded weapon and character geometry
- `addons/utils/BufferGeometryUtils.js`: batching the static map geometry

These are unmodified files from the official `three@0.180.0` npm package. Full MIT notice: `static/vendor/THREE-LICENSE.txt`.

Project: https://github.com/mrdoob/three.js
Docs: https://threejs.org/docs/

## aiohttp — Apache 2.0

Installed from requirements.txt rather than copied into this archive. Handles HTTP and WebSocket connections.

Project and license: https://github.com/aio-libs/aiohttp

## Typography

Barlow and Barlow Condensed by Jeremy Tribby, served optionally through Google Fonts (SIL Open Font License). System font fallbacks work if fonts are blocked.

## Original material

The Cyberpunk City and Solstice layouts, collision data, procedural buildings, weapon/character models, synthesized sounds, game UI, Python rules and client controller were authored for this project. Venge, Krunker and other shooters served as design references; no game code, maps, models, logos or audio were extracted from them.

## Dust Corridor environment source — MIT (integration staging)

Original world generator, buildings, props, material shaders, cloth, collision utilities and their supporting imports copied intact into `integrations/dust_corridor/src/` from [Dust Corridor / Claude of Duty](https://github.com/Leonxlnx/claude-of-duty) at upstream commit `7f8a15ae54dd65e7ce22c80c074f9b1da7daee2f`.

Copyright (c) 2026 Leonxlnx. Licensed under MIT. Retained original notice at `integrations/dust_corridor/LICENSE`; source Git blob SHAs and provenance in `integrations/dust_corridor/UPSTREAM_MANIFEST.json`. This staged source is not yet linked into CROSSFire's live client or server.
