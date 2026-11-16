# Dust Corridor — Stage 6.2: native visual preview

Open the existing CROSSFire main lobby. Use **EXPLORE DUST CORRIDOR · ORIGINAL MAP PREVIEW** below the arena selector.

- It uses CROSSFire's *existing renderer and canvas*: no iframe, external page, or original game's loop.
- The original upstream map generator, buildings, geometry, props and cloth run unchanged from `static/dust_corridor/src/`.
- The original 20 material layers are baked with the upstream procedural GPU material code and displayed with a single native material adapter.
- If a school GPU can't bake those shader textures, a procedural material fallback still displays *all* of the original geometry.
- Original market awnings, laundry and cables animate using the existing frame clock.
- Navigate in free-flight with WASD, Q/E, Shift and drag-to-look; switch Street/Market/Plaza views.
- Closing the preview releases the temporary resources and restores the ordinary main lobby.

**Not a playable match yet.** Multiplayer, map registry and physics stay unchanged in this step. Stage 6.3 adds server-authoritative collision; 6.4–6.5 handle spawns/lobby matches; 6.6 tunes performance; 6.7 validates fidelity.

The upstream multi-pass effects are not copied as a second engine. This adapter keeps source geometry, layer textures and ambient dynamics but will not be pixel-identical to Dust Corridor's complete renderer.

Source/license: `integrations/dust_corridor/UPSTREAM_MANIFEST.json`, `integrations/dust_corridor/LICENSE`, `THIRD_PARTY.md`.
