# CROSSFire — Project AETHER / Phase 1
## AETHER-9 SPECTER · Blender geometry and silhouette pass

**Scope:** Original fictional visual game prop only. The model and viewer are independent of the current multiplayer weapon assets.

### Stage 1.1 — Approved art direction
**Creative direction: AETHER-9 SPECTER / Monolith hybrid**

The key objective is not to increase detail count. It is to make the shape read as a cohesive, intentionally designed sci-fi artifact at normal viewing distance, with premium material separation and controlled luminosity.

**Silhouette hierarchy**
- One uninterrupted tapered composite main body, front-facing taper and a continuous dorsal spine
- Deliberate side cheek surfaces with clean long diagonals; avoid stacking dozens of small blocks
- Open architectural rear frame with obvious negative space
- Short integrated optical visor, not a visually oversized separate module
- Internal luminous prism under the primary shell; not a uniformly glowing object

**Material hierarchy**
- Primary: charcoal ceramic/composite, visually matte
- Secondary: satin/brushed titanium, brighter on edges
- Tertiary: dark polymer, inset carbon, and restrained silver/copper markings
- Signature lighting: cool cyan lightguide and translucent glass, concentrated along the top spine and inner energy chamber

### Stage 1.2 — First editable Blender sculpt/export
Source: `tools/aether9_blender_phase1.py`.
The automated Blender runner creates:
- `art/blender/aether9-specter-phase1.blend` — editable native scene, material slots, curves and non-destructive edge modifiers
- `static/assets/aether9-specter-phase1.glb` — self-contained mesh export for the asset loader
- `static/previews/aether9-specter-phase1.png` — studio render when renderer is available
- `art/blender/aether9-phase1-report.json` — counts and file metrics

The model is *script-authored in Blender* and is deliberately editable, but it is **not** hand-sculpted. We do not present it as a manually authored production model. Curves remain editable in the .blend and are converted to meshes for export.

### Stage 1.3 — Geometry refinement criteria
- Inspect three-quarter, flat profile, rear and visor angles
- Silhouette should be distinct from the old `aether9-specter.glb` at normal viewing distance
- Check overall shape continuity, open rear cantilever and visor proportions
- Prefer adjusting the main forms rather than adding ornamental meshes

### Stage 1.4 — Naming and scene hierarchy criteria
- Objects use semantic names for shell, spine, cheek, visor, core and rear groups
- Material families use stable names and are independently editable
- Non-game preview lighting/cameras are kept in a separate studio collection
- Export excludes studio objects while preserving editable authoring scene

### Not yet attempted
Production UV packing, normal/ambient-occlusion baking, animated rig, LOD generation, and gameplay integration belong to later phases. Phase 1 UVs are **provisional**.

### Review links
- Blender viewer (after build): https://playcrossfire.onrender.com/static/aether9-blender-phase1.html
- Prior SPECTER: https://playcrossfire.onrender.com/static/asset-lab.html
- Earlier Phantom V3: https://playcrossfire.onrender.com/static/aether9-phantom-v3.html

**Acceptance gate:** A valid Blender .blend and independently loadable GLB, positive mesh counts, stable material groups, and visual review before any multiplayer integration.
