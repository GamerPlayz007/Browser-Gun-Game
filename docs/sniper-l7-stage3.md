# AETHER-L7 Longwatch / Stage 3

A visual-only 3D production pass for CROSSFire's fictional game sniper. This work is isolated from the multiplayer game, camera systems, weapon behavior, and physics.

Existing native source: art/blender/aether-l7.blend. The script reopens this Blender scene and produces:
- CROSSFIRE_L7_Hero_Source.blend — editable material-restored source
- CROSSFIRE_L7_Hero.glb — original 77-part art mesh, 384px source PBR maps
- CROSSFIRE_L7_Performance.glb — the same geometry and 128px maps
- CROSSFIRE_L7_Stage3_Report.json — export and source statistics

Pipeline: .github/workflows/sniper-l7-stage3.yml runs Blender on GitHub Actions and publishes GLBs only after validation. If the workflow fails, fix the pipeline before saying the asset was produced.

Next: add the verified GLBs to static/workshop-library.js with their actual file sizes, inspect Hero versus Performance in the permanent garage, and obtain visual approval before any game integration.
