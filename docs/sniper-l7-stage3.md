# AETHER-L7 Longwatch / Stage 3

A visual-only 3D production pass for CROSSFire's fictional game sniper. This work is isolated from the multiplayer game, camera systems, weapon behavior, and physics.

Existing native source: art/blender/aether-l7.blend. The script reopens this Blender scene and produces:
- CROSSFIRE_L7_Hero_Source.blend — editable material-restored source
- CROSSFIRE_L7_Hero.glb — original 77-part art mesh, 384px source PBR maps
- CROSSFIRE_L7_Performance.glb — the same geometry and 128px maps
- CROSSFIRE_L7_Stage3_Report.json — export and source statistics

Pipeline: .github/workflows/sniper-l7-stage3.yml runs Blender on GitHub Actions and publishes GLBs only after validation. If the workflow fails, fix the pipeline before saying the asset was produced.

Export and validation completed successfully in GitHub Actions. 77 Blender mesh objects and 2,584 source triangles were preserved across Hero (2,202,432 bytes) and Performance (863,920 bytes); verified glTF 2.0, materials and normal texture references.

Use /static/workshop.html?asset=l7-native to inspect the Hero and Performance native assets in the permanent garage. Click COMPARE TWO VERSIONS to get the two profiles in synchronized views.

Next: real-browser visual review, optimization measurement, and art refinement. No game integration has been approved yet.
