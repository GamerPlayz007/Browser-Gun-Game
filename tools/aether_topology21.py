"""AETHER Phase 2.1 — offline Blender mesh topology cleanup and QA.

Purely cosmetic, original sci-fi game-art geometry. The pipeline does not
create any operational mechanism. Preserves shape/transform/material naming;
UV island unwrapping belongs to Phase 2.2 and texture baking to Phase 3.
Compatible with Blender 3.0 (Ubuntu 22.04 GitHub Actions).
"""
from __future__ import annotations
import math
from collections import Counter

import bpy
import bmesh

SMOOTH_THRESHOLD = math.radians(55.0)
WELD_DISTANCE = 1e-6
AREA_EPSILON = 1e-10


def _stats(bm):
    """Inspect one BMesh with no custom debug addons required."""
    bm.verts.ensure_lookup_table()
    bm.edges.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    return {
        "vertices": len(bm.verts),
        "edges": len(bm.edges),
        "faces": len(bm.faces),
        "triangles": sum(max(0, len(f.verts) - 2) for f in bm.faces),
        "ngons": sum(len(f.verts) > 4 for f in bm.faces),
        "boundary_edges": sum(e.is_boundary for e in bm.edges),
        "nonmanifold_edges": sum(not e.is_manifold for e in bm.edges),
        "wire_edges": sum(e.is_wire for e in bm.edges),
        "loose_vertices": sum(not v.link_edges for v in bm.verts),
        "degenerate_faces": sum(f.calc_area() <= AREA_EPSILON for f in bm.faces),
        "signed_volume": round(bm.calc_volume(signed=True), 9),
    }


def prepare_topology(objects):
    """Audit and repair cosmetic mesh defects without changing silhouette.

    - Weld sub-microscopic duplicated vertices and dissolve degenerate faces.
    - Resolve planar n-gon end caps into explicit triangles (retain quads).
    - Recalculate face normals and correct reversed closed surfaces.
    - Use angle-based hard edges while keeping curved spans smooth.
    - Add a single weighted-normal pass on flat-sided sculptural panels.

    The result is *UV-preparation*, not final UV mapping or texture baking.
    """
    details={}
    totals=Counter()
    mesh_objects=sorted((o for o in objects if o.type=="MESH"),key=lambda o:o.name)
    if not mesh_objects:
        raise RuntimeError("Topology audit received no editable meshes")
    for obj in mesh_objects:
        mesh=obj.data
        source_bm=bmesh.new()
        try:
            source_bm.from_mesh(mesh)
            before=_stats(source_bm)
            bmesh.ops.remove_doubles(
                source_bm, verts=list(source_bm.verts), dist=WELD_DISTANCE
            )
            bmesh.ops.dissolve_degenerate(
                source_bm, edges=list(source_bm.edges), dist=WELD_DISTANCE
            )
            ngons=[face for face in source_bm.faces if len(face.verts)>4]
            if ngons:
                bmesh.ops.triangulate(
                    source_bm, faces=ngons, quad_method="BEAUTY",
                    ngon_method="BEAUTY"
                )
            bmesh.ops.recalc_face_normals(source_bm,faces=list(source_bm.faces))
            signed=source_bm.calc_volume(signed=True)
            reversed_normals=False
            if signed < -1e-8:
                bmesh.ops.reverse_faces(source_bm,faces=list(source_bm.faces))
                reversed_normals=True
            # Keep major facet breaks crisp instead of smoothing every edge.
            for face in source_bm.faces:
                face.smooth=True
            for edge in source_bm.edges:
                edge.smooth=bool(edge.is_manifold and
                                 edge.calc_face_angle(0.0)<SMOOTH_THRESHOLD)
            after=_stats(source_bm)
            flaws={k:after[k] for k in (
                "boundary_edges","nonmanifold_edges","wire_edges",
                "loose_vertices","degenerate_faces","ngons"
            ) if after[k]!=0}
            if flaws:
                raise RuntimeError(
                    "Nonclosed or invalid aesthetic surface "+obj.name+": "+str(flaws)
                )
            if after["signed_volume"] <= AREA_EPSILON:
                raise RuntimeError("Inward/zero-volume closed art mesh "+obj.name)
            # One mesh = one clean connected sculpture; no lost faces.
            if after["triangles"]<4:
                raise RuntimeError("Geometry simplified unexpectedly: "+obj.name)
            source_bm.to_mesh(mesh)
            mesh.update(calc_edges=True)
            if hasattr(mesh,"use_auto_smooth"):
                mesh.use_auto_smooth=True
                mesh.auto_smooth_angle=SMOOTH_THRESHOLD
            # Weighted normals help the beveled exterior panels but would
            # flatten the organic lofted main shell. No geometry added.
            label=obj.name.lower()
            panel_like=any(t in label for t in (
                "cheek","flank","fin","shield","insert","highlight","pad"
            ))
            if panel_like and not any(m.type=="WEIGHTED_NORMAL" for m in obj.modifiers):
                normal_mod=obj.modifiers.new(
                    "AETHER / weighted hard-surface shading","WEIGHTED_NORMAL"
                )
                normal_mod.keep_sharp=True
                normal_mod.weight=50
            entry={
                "before":before,"after":after,
                "welded_vertices":max(0,before["vertices"]-after["vertices"]),
                "triangulated_ngons":before["ngons"],
                "reversed_inward_normals":reversed_normals,
                "weighted_normal_modifier":panel_like,
                "hard_edge_angle_degrees":55,
            }
            details[obj.name]=entry
            totals["meshes"]+=1
            totals["vertices_before"]+=before["vertices"]
            totals["vertices_after"]+=after["vertices"]
            totals["triangles_before"]+=before["triangles"]
            totals["triangles_after"]+=after["triangles"]
            totals["ngons_resolved"]+=before["ngons"]
            totals["welded_vertices"]+=entry["welded_vertices"]
            totals["reversed_inward_normals"]+=int(reversed_normals)
            totals["weighted_normal_objects"]+=int(panel_like)
        finally:
            source_bm.free()
    return {
        "phase":"2.1",
        "asset_id":"AETHER9_SPECTER",
        "algorithm":"Blender BMesh / cleanup, winding, 55-degree smooth edges",
        "scope":"visual 3D game art",
        "topology_gate":"closed, outward, no loose geometry or degenerates",
        "uv_status":"provisional; actual UV islands belong to Phase 2.2",
        "stats":dict(totals),
        "objects":details,
    }
