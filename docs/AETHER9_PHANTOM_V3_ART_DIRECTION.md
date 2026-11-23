# CROSSFire — AETHER-9 Phantom V3 / MONOLITH
## Art direction and implementation blueprint
**Status:** built as a standalone Three.js/WebGL concept on `/static/aether9-phantom-v3.html`. Multiplayer weapon assets remain unchanged.

### Creative brief
Create a distinctive, premium **original fictional sci-fi prop** with a clear silhouette and premium surface read at normal viewing distance. V3 is an art-direction overhaul, *not* a higher polygon-count version of V2. The core identity is a continuous tapered ceramic canopy, brushed-titanium structural spine, calm side plates, open rear cantilever, and an illuminated interior framed with restrained light.

### Hierarchy
1. **Hero silhouette first.** A continuous cross-section monocoque must remain legible against a dark background, including from a flat profile and a three-quarter view.
2. **Two dominant materials.** Low-gloss ceramic/composite exterior; brighter anisotropy-suggestive titanium lines and accent plates. Secondary microtexture remains subtle.
3. **Negative space.** Use real cutout holes and an architectural cantilever frame, not blocks painted to look like vents.
4. **One deliberate glow system.** A luminous spine leads the eye toward the internal photonic centerpiece, with small secondary marks—avoid a uniformly glowing outline.
5. **Integrated display.** Lower-profile glass visor sits within the surface, not a tall accessory stacked on top.

### Color variants
- **Midnight:** dark teal/graphite body, colder cyan light, satin steel contrast
- **Glacier:** pale blue metal, soft mint light, controlled ivory reflectance
- **Eclipse:** dark purple composite, violet accent light, silver-blue edge
All variants must adjust V3-specific materials, not just the original V2 skin.

### V3 implementation
**Delivered:**
- New `aether9-phantom-v3.js` derives from the existing V2 model and maintains its WebGL studio pipeline while replacing the older exterior groups with a custom V3 shell.
- One multi-ring tapered `loftHullV2` outer body and narrower matching dorsal titanium crown.
- Three actual geometric flank openings per side in extruded profile shapes.
- Independently sculpted side cheek plates with one major light channel per side.
- New continuous stock arch and open underside, lower integrated visor, art-directed core cradle.
- Four material roles: matte ceramic, brushed titanium, polymer and recessed dark void, with a restrained emissive channel.
- Studio/Dramatic lighting comparison, quality toggle, 6 camera views, and 3 finishes.

### Production-ready follow-up: dedicated asset pipeline
The V3 WebGL concept is **not** yet a professionally authored, UV-unwrapped, baked-and-exported GLB. A dedicated DCC pipeline is the next technical milestone, not something claimed as complete here.

1. **Model approval.** Review the live V3 at hero, profile, rear, visor and core angles. Adjust silhouettes until V3 is clearly preferable without needing to zoom.
2. **Topology and UV work.** Recreate the approved custom sculpted forms in Blender (or equivalent), create clean geometry and UV islands, and target a manageable mesh hierarchy.
3. **Bake maps.** Create tangent-space normal, roughness, metallic and AO texture sets. Bake to a streamlined low-poly model.
4. **Material audit.** Compare dark/bright studio conditions and all 3 skins. Ensure glass, matte polymer, titanium and ceramic have visibly different light response.
5. **Game integration.** Load optimized GLB/glTF into the current model factory, preserve existing gameplay/hit logic, align the optic, and retain animations.
6. **LOD and performance.** Separate first-person hero mesh from lightweight third-person geometry. Target stable frame times on low-end school laptops, using selectable texture quality.
7. **Acceptance review.** Verify close-up quality, silhouette legibility, network play, player model memory use, visual FPS, and no server-side behavior changes.

### Acceptance criteria
- Recognizably distinct from V2 at normal distance; no dependence on more pieces alone
- Clearly separate material families under both light modes
- All 3 variants and 6 camera views usable
- No rendering exception and no missing model geometry
- Separate V3 link always available; V1, V2 and multiplayer unchanged until approval
- Future GLB implementation requires a separate inspection and performance gate

### Files
- Viewer: `static/aether9-phantom-v3.html`
- Model/rendering: `static/aether9-phantom-v3.js`
- Comparison: `static/aether9-phantom-v2.html`
