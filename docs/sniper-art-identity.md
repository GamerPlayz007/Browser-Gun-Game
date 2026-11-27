# CROSSFire sniper artwork — single current version

**AWP-01 v0.3 ORIGINAL** is the only supported sniper artwork.

- Source model: `static/assets/CROSSFIRE_AWP_ReferenceInspired_v03.glb`
- Size: 4,682,872 bytes
- SHA-256: `a227f177bc1d5398ec5919aaf537a8a29ab48a2c10b9c9c51b73b74366351b4b`
- Source generator: `tools/awp01_v03_builder.py` (digital nonfunctional exterior art)
- Multiplayer rendering module: `static/awp01_v03_model.js`
- Workshop: `/static/workshop.html?asset=awp01-v03`

The old AETHER-L7/Longwatch GLBs, old Blender source exports, and standalone
legacy studio are removed from this repository. The AWP-01 v0.3 GLB replaces
the sniper's **artwork only**. No shooting rules, collision, physics or networking
are changed. The imported GLB is shared and batched to avoid 396 draw calls.

The exact source GLB is intentionally preserved for workshop inspection and
reproducible exports. Git history still contains the removed assets if recovery
is needed.
