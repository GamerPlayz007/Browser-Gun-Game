# CROSSFire — AETHER-S9 / VESPER
## Phase 1.3 — final SMG concept lock (CQB Predator)
**Status:** visual direction locked, **NOT** a built 3D model.  
**Scope:** one original nonfunctional science-fiction game prop (SMG cosmetic). Do not modify the AETHER-9 AR or begin W12/L7 redesigns in this phase.

### Source of truth — AR, not the previous S9
- AR authored geometry: `tools/aether9_blender_phase1.py`
- AR's material vocabulary: `tools/aether_pbr_phase3.py`
- Render anchor: `static/previews/aether9-specter-midnight-pbr.png`
- AR anchors proven in code: continuous lofted ceramic monocoque, raised curved titanium spine, swept layered cheek plates, singular cyan dorsal/side traces, open sculpted rear arch, floating photonic lower prism, integrated low-profile visor.
- **Explicitly reject** the old `common()` rectangular body, simple rear beams, standalone holo ring and repeated vent filler in `tools/aether_collection_blender.py`.

### Design in one line
**AETHER-S9 VESPER** is the compact, asymmetric-looking-in-perspective but bilaterally balanced *urban predator* sibling of AETHER-9 SPECTER: a continuous **sculpted shell**, one **arched upper crest**, a **short split-nose jewel**, a **recessed floating photonic capsule**, and a **tight clipped rear yoke**. Do not model a conventional gun and dress it with lights.

### Locked design choices
| Subject | Chosen direction | Design intent |
|---|---|---|
| Personality | CQB Predator with AR-family elegance | Faster visual rhythm, not cruder construction |
| Primary outline | Compressed swept teardrop, short angular nose | Readably different silhouette from AR; still recognizable family |
| Upper contour | Single rising rear-to-center crown, falling into the nose | Visually continuous, **not stacked top boxes** |
| Front ornament | Compact **split-petal emitter facade**, tucked between swept shell tips | Fictive energy-tech design language; **not** a cylindrical tube |
| Center mass | Lofted, twisted-looking but symmetrical ceramic shell, widest at rear-mid | One visual hull, **not** three blocks |
| Side sculpture | TWO broad overlapping blade-like cheek panels per side with an elongated negative-space window | AR's sweeping panel rhythm in compressed form |
| Lower ornament | Floating short faceted cyan prism inside a protective crescent | Family match to AR's floating energy jewel; zero operational mechanics |
| Grip silhouette | Narrow elegant dark descending sculptural handle | Clean contrast against body, no giant boxy extension |
| Rear outline | Short two-ribbon rear yoke, clipped with a rounded pad | Avoid the old exposed triangle scaffolding |
| Visor | Low flush integrated translucent slit/crown | Avoid the old free-floating circular ring |
| Primary finish | AR's **Midnight**: cool graphite ceramic, satin blue-grey titanium, charcoal, restrained cyan | Same manufacturer before experimenting with colors |
| Accent policy | One continuous cyan line each side + small core glow; tiny warm insignia | Glow reveals contour; never conceals weak geometry |

### Shape map for artwork (NOT physical construction dimensions)
This is a visual silhouette guide, with total **illustrated** left-right length = 100 units, nose at 0, rear at 100. Height is normalized to its own illustrated outline. All values are aesthetic screen proportions only.

- **0–18**: split-petal prow; strongly tapered nose, a partially enclosed luminous teardrop-shaped recess; no exposed circular rod or round front tip.
- **18–44**: blended swept front cowl, top line begins a shallow rise; paired flanking blade wings create a narrow dark cutout.
- **44–76**: hero sculpted mid-body. It is the widest, tallest and smoothest visual mass. A curved side panel overlays the uninterrupted ceramic core with a clearly readable shadow gap.
- **51–66, underside**: recessed small faceted energy capsule, enclosed by elegant arcs; visual echo of the AR prism.
- **58–82, underside**: narrow curved handle as a secondary silhouette; an inset cell is represented only by a small dark color break, not a box appendage.
- **76–100**: rear ribbons converge into shortened, gentle C-shaped yoke; compact curved rear termination, little exposed scaffold.
- **48–66, top**: flush optical crown recessed into the upper shell line, translucent accent only.

Proportion benchmark: **illustrated overall length 74–78% of the AR** at consistent game scale; the SMG has a **comparatively denser central shell** and shorter rear and fore geometry. No real-world dimensions or functional design implied.

### Primary design signatures that must be visible with materials disabled
1. **Continuous tapered ceramic shell**: silhouette via custom multi-ring loft, varied cross sections and deliberate taper changes (reference AR `loft("01 / Ceramic monocoque")`), never a large beveled cuboid.
2. **Swept shadow-gap side sculpture**: two elegant organically tapered plates per side, separated by a thin *dark negative-space channel*, running from near visor to near nose.
3. **Crescent-lit jewel**: floating cyan decorative prism nested low in the shell — directly related to AETHER-9's photonic prism, but shortened, sleeker and more enclosed.
4. **Clipped rear ribbon**: distinctly compact; arch and silhouette sculpted with lofts and curves instead of straight beams.
5. **Embedded thin visor**: a flush optical slit/crown within the upper monocoque, not a floating circle.

### Palette reference: transfer values, not existing S9 violet/orange/green identity
Reuse AR's named material roles from `tools/aether9_blender_phase1.py`: `ceramic`, `frame`, `mid`, `polymer`, `silver`, `cyan`, `glass`, `copper`, `carbon`. Match AR's midnight PBR mapping methodology in `tools/aether_pbr_phase3.py`; no bright violet primary coloring for the initial build. Begin **clay** (no materials/emission) to judge the silhouette, then a Midnight version.

### Production gates before replacing old SMG
- **Gate A / concept:** single asset design, approved design brief (this file).
- **Gate B / gray clay:** front three-quarter **and clear full side profile** of newly authored mesh. Judge **shape only**; veto if it could be mistaken for old S9 with the neon off.
- **Gate C / sculpt:** full resolved custom lofted hero hull, side shadow gaps, cropped rear ribbon, prism and visor; camera orients for shape visibility. No giant shared box-centered `common()`.
- **Gate D / finish:** AR-matched nine material families; real mapped surface contrast, controlled cyan. Render under the **same camera angle, scale, background and lighting as AR** for honest comparison.
- **Gate E / game import:** inspect self-contained GLB in a dedicated preview. Verify orientation, proportion, clipping, and framerate on school-laptop low fallback. Existing AR and current playable S9 fallback are unchanged until new S9 is validated.
- **Gate F / signoff:** compare AR and S9 in side-by-side side and three-quarter views, both clay and Midnight. Only then update the SMG game cosmetic and armory link.

### Reasons to reject a render without polishing it
- Main mass visually reads as a bevelled box or collection of boxes.
- Neon, colored panels, or vents are responsible for its identity.
- Stock/yoke looks like welded straight rods or triangle scaffold.
- Isolated optic ring or muzzle cylinder dominates.
- A W12/L7 could be made just by recoloring and lengthening this model.
- Preview hides full side silhouette behind a foreshortened camera.
- Model passes GLB export but fails visual comparison to AR.

### Scope reminder
This file locks **concept direction**, not execution. The next phase is sculpting an **entirely new** S9 mesh pipeline using the AR's shape philosophy. Other weapons and AR are out of scope.
