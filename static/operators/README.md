# Operator 03 — real multiplayer character assets

**All runtime assets are now checked into this branch.** The operator body
is the authored PBR GLB with 18,360 triangles, 10 articulated pivots and
three embedded texture maps. All eight 1152×1152 camouflage atlases are
stored next to it in `static/operators/`.

The live game loads:
- `CROSSFire_Operator_03_PBR_Game.glb`
- `CROSSFire_Operator_03_{skin}_BaseColor_Atlas.png`

Available skin IDs: `woodland`, `desert`, `urban`, `arctic`, `jungle`,
`navy_digital`, `ranger`, `shadow`.

The GLB normal/roughness/metallic maps stay shared; only the base-colour
atlas changes. The original avatar is a defensive fallback if an asset
cannot load on a client. Multiplayer skins are synchronized via server
snapshots and controlled from the lobby.

Team game modes are server-authoritative:
- Azure = Arctic (white)
- Ember = Shadow (black)

Solo modes keep the chosen skin. The Python generator sources and
GitHub Actions asset build workflow are included for reproducibility.
