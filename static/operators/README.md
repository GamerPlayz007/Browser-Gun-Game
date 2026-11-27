# Operator 03 — game runtime assets

This branch contains the tested **runtime integration code**, but GitHub's
connected text-editing interface cannot transport binary GLBs/PNGs from the
artifact sandbox. The matching binary assets are supplied in the downloadable
`Operator03_CROSSFire_Runtime_Assets.zip` package.

Extract the package into the repository root to create these files:

- `static/operators/CROSSFire_Operator_03_PBR_Game.glb`
- `static/operators/CROSSFire_Operator_03_woodland_BaseColor_Atlas.png`
- `static/operators/CROSSFire_Operator_03_desert_BaseColor_Atlas.png`
- `static/operators/CROSSFire_Operator_03_urban_BaseColor_Atlas.png`
- `static/operators/CROSSFire_Operator_03_arctic_BaseColor_Atlas.png`
- `static/operators/CROSSFire_Operator_03_jungle_BaseColor_Atlas.png`
- `static/operators/CROSSFire_Operator_03_navy_digital_BaseColor_Atlas.png`
- `static/operators/CROSSFire_Operator_03_ranger_BaseColor_Atlas.png`
- `static/operators/CROSSFire_Operator_03_shadow_BaseColor_Atlas.png`

The base GLB contains the full Operator 03 model with rig pivots, PBR normal
map and metallic/roughness map. Colour atlases are loaded separately. All eight
skins share its geometry and noncolour maps, reducing downloads and GPU RAM.

In modes `teamdeathmatch` and `control`, the **server** forces
Azure -> Arctic/White and Ember -> Shadow/Black. In all other modes, the
manual camo selected in the home screen or room lobby applies.

The client retains the old avatar if the GLB cannot be fetched, so
adding this code without uploading the binaries does **not** by itself
activate Operator 03 in the live game.
