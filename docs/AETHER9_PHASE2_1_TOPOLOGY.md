# CROSSFire — Project AETHER / Phase 2.1: Mesh Topology

**Status:** Blender CI validated and published on main. **Scope:** artistic mesh surfaces of an original fictional sci-fi game prop. No gameplay or functional hardware geometry was altered.

## Main result

The Blender authoring scene retains **75 visual objects**, comprising **60 mesh objects** cleaned by BMesh plus **15 editable lightguide curves** that are converted only when exporting glTF.

### Measured topology results

| Check | Before | After |
|---|---:|---:|
| Editable mesh objects audited | 60 | 60 |
| Source mesh vertices | 2,138 | 2,138 |
| Source mesh triangle equivalents | 4,044 | 4,044 |
| N-gon caps | 20 | 0 |
| Duplicate vertices welded | — | 0 needed |
| Reversed mesh normals corrected | — | 0 needed |
| Weighted-normal shading on sculptural panels | — | 15 objects |
| Open/non-manifold edges remaining | — | 0 |
| Degenerate faces remaining | — | 0 |
| Loose vertices remaining | — | 0 |

**Interpretation:** The source geometry was already mostly watertight and free of duplicates. The main improvements are explicit n-gon cap triangulation, consistent angle-based hard/smooth shading, 15 weighted-normal modifier treatments, and **automated proof of topology validity**. There is **no claimed polygon-count reduction** at this stage. Mesh UV layers still use provisional coordinates; these are *not* a production UV atlas.

### Blender workflow

`tools/aether_topology21.py` is a self-contained Blender BMesh module, called from `tools/aether9_blender_phase1.py` **before** objects are parented into eight art collections.

For each source mesh it:
1. Welds nearly coincident vertices, dissolves degenerates and triangulates n-gon end caps without needlessly subdividing quads.
2. Recalculates normals, checks outward signed volume and corrects reversed orientation where needed.
3. Keeps major facet breaks crisp using a **55° smoothing threshold** and adds weighted-normal shading to selected hard-surface forms.
4. Rejects unresolved boundary/non-manifold edges, degenerate faces, n-gons, loose vertices or nonpositive closed volume.
5. Records per-object before/after counts and outputs a machine-readable report.

The `.blend` continues to preserve original editable curves; the separate GLB export contains tessellated visual geometry.

### Deliverables

- Blender source: `art/blender/aether9-specter-phase1.blend`
- Updated GLB: `static/assets/aether9-specter-phase1.glb`
- Per-object topology report: `art/blender/aether9-phase2-topology.json`
- Updated scene manifest: `art/blender/aether9-phase1-manifest.json`
- Build summary: `art/blender/aether9-phase1-report.json`
- Blender topology module: `tools/aether_topology21.py`
- Validated GitHub Actions workflow: `.github/workflows/aether-blender-phase1.yml`

### Remaining acceptance gates

Phase 2.1 is a *source topology cleanup*, not proof of final runtime frame times. It does not include polygon-reduction LODs, a packed UV atlas, texture baking, or game integration.

**Next:** Phase 2.2 — unwrap UV islands with explicit material-aware seams, a measurable UV density target, and padding; validate the actual Blender-generated UV maps and GLB `TEXCOORD_0` attributes.
