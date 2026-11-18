"""Phase 1.4: evidence-led native Octavus neighbor-face occlusion.

Fix a structural mistake in the initial OCN2 exporter:
OCTSAV_NORMAL is a file-storage tag, NOT proof that the cube's touching
face is open. Red Eclipse octa.cpp's visibletris() tests the *12 source
edge nibble values*, and a deformed cube may have a wholly solid face.

This pass *only removes provably covered planar faces*. It does not
claim full original renderer equivalence (mixed faces/alpha/UV still
require work). It retains every texture slot including plain slot 1,
and never replaces current arena or server physics.

Creates octavus.native-neighbors.bin.gz and .json (stage only).
"""
from __future__ import annotations
from collections import Counter
import gzip
import hashlib
import io
import json
from pathlib import Path
from time import perf_counter

from scripts.octavus_native_geometry77 import (
    ROOT, SOURCE, Cube, NativeWorld, Builder, source_tree,
    implicit_polygon, nondegenerate, OCT_EMPTY, OCT_SOLID,
    WORLD_SIZE, SCALE, pack_mesh
)

OUTPUT=ROOT/"static/maps/octavus.native-neighbors.bin.gz"
REPORT=ROOT/"static/maps/octavus.native-neighbors.json"
# redeclipse/base src/engine/octa.cpp faceedgesidx[6][4]
FACE_EDGE_IDS=(
    (4,5,8,10),
    (6,7,9,11),
    (8,9,0,2),
    (10,11,1,3),
    (0,1,4,6),
    (2,3,5,7),
)
FULL_EDGE=0x80


def covers_entire_native_face(cube: Cube | None, orient: int) -> bool:
    """Exact original touchingface && faceedges == F_SOLID shortcut.

    Red Eclipse's visibletris() accepts this even if cube's *save tag*
    is OCTSAV_NORMAL. Material volumes may require alpha face rendering:
    avoid suppressing those until equivalent material tests exist.
    """
    if cube is None or cube.children or cube.kind == OCT_EMPTY or cube.material:
        return False
    if cube.kind == OCT_SOLID:
        return True
    if any(cube.edges[j]!=FULL_EDGE for j in FACE_EDGE_IDS[orient]):
        return False
    e=cube.edges[(orient//2)*4:(orient//2)*4+4]
    return (all((v>>4)==8 for v in e) if orient&1
            else all((v&0xF)==0 for v in e))


def polygon_bbox(poly,axis):
    transverse=tuple(k for k in range(3) if k!=axis)
    return transverse, tuple((min(p[k] for p in poly),max(p[k] for p in poly))
                             for k in transverse)


def area_covers_box(node, axis:int, axis_pos:int, transverse, bounds) -> bool:
    """Proof that *every* leaf intersecting the AABB behind a planar
    triangle has a completely solid face on the shared plane.

    AABB over-inclusion can retain excess faces, never erase a hole.
    Octree subdivision is followed exactly; no centroid approximation
    is allowed to decide polygon visibility.
    """
    o=node.origin
    side=node.size
    if not (o[axis]*SCALE <= axis_pos < (o[axis]+side)*SCALE):
        return True  # node has no intersection with the query plane
    for k,(lo,hi) in zip(transverse,bounds):
        if o[k]*SCALE>=hi or (o[k]+side)*SCALE<=lo:
            return True  # rectangle does not overlap this child
    if node.children:
        return all(area_covers_box(child,axis,axis_pos,transverse,bounds)
                   for child in node.children)
    # If the rectangle has a non-solid neighbor, it may contain a visible
    # opening; keep the original source polygon intact.
    orient=axis*2+(0 if axis_pos>=((o[axis]+side)*SCALE-1) else 1)
    return covers_entire_native_face(node,orient)


def definitely_covered(world:NativeWorld,cube:Cube,orient:int,poly,
                       metrics:Counter|None=None)->bool:
    """Return True only if removing this planar source face is safe.

    Neighbor face is opposite of our orientation; all tests stay in
    native integer 1/8-world-unit coordinates.
    """
    if not nondegenerate(poly):return False
    axis=orient//2
    far=bool(orient&1)
    plane=(cube.origin[axis]+(cube.size if far else 0))*SCALE
    if any(p[axis]!=plane for p in poly):
        if metrics is not None:metrics["recessedKept"]+=1
        return False
    neighbor_plane=plane+(1 if far else -1)
    if not 0<=neighbor_plane<WORLD_SIZE*SCALE:
        if metrics is not None:metrics["outerWorldBoundarySuppressed"]+=1
        return True
    projected=polygon_bbox(poly,axis)
    trans,bounds=projected
    if any(lo==hi for lo,hi in bounds):return False
    if any(lo<0 or hi>WORLD_SIZE*SCALE for lo,hi in bounds):return False
    # Fast rejection: a face is only provably hidden if the neighbor
    # directly across its center covers the relevant plane completely.
    probe=[sum(p[k] for p in poly)/(len(poly)*SCALE) for k in range(3)]
    probe[axis]=neighbor_plane/SCALE
    sample=world.locate(probe)
    if not covers_entire_native_face(sample,orient^1):
        if metrics is not None:metrics["nonSolidNeighborKept"]+=1
        return False

    # Check all overlapping quadtree leaves, rather than assuming that
    # one center sample represents the whole polygon.
    blocked=all(area_covers_box(root,axis,neighbor_plane,trans,bounds)
                for root in world.roots)
    if metrics is not None:metrics["fullyCoveredCulled" if blocked else "partialCoverageKept"]+=1
    return blocked


def build_revised_mesh(world:NativeWorld):
    result=Builder()
    counts=Counter()
    bymat=Counter()
    def visit(children):
        for cube in children:
            if cube.children:
                visit(cube.children);continue
            if cube.kind==OCT_EMPTY:continue
            for orient in range(6):
                surface=cube.faces.get(orient) if cube.faces else None
                if cube.merged&(1<<orient) and not surface:
                    counts["suppressedMergeParts"]+=1
                    continue
                poly=surface.verts if surface and surface.verts else implicit_polygon(cube,orient)
                if not nondegenerate(poly):
                    counts["degenerate"]+=1
                    continue
                if definitely_covered(world,cube,orient,poly,counts):
                    bymat[cube.textures[orient]]+=1
                    continue
                label="explicit" if surface else "implicit"
                result.add(poly,cube.textures[orient],label)
    visit(world.roots)
    return result,counts,bymat


def export():
    started=perf_counter()
    world,tree=source_tree()
    geom,counters,removed_slots=build_revised_mesh(world)
    payload=gzip.compress(pack_mesh(geom),compresslevel=6,mtime=0)
    if len(payload)>12*1024*1024:
        raise ValueError("Native neighbor mesh larger than safe 12MB staging budget")
    OUTPUT.write_bytes(payload)
    report={
        "format":"OCN2",
        "status":"staging-only-not-live",
        "sourceRevision":829,
        "sourceHash":hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "vertices":len(geom.vertices),
        "triangles":len(geom.indices),
        "sourceTextureSlots":len(geom.materials),
        "plainSlotOneTriangles":geom.materials[1],
        "nativeBoundsEighths":{"min":geom.bounds_min,"max":geom.bounds_max},
        "faceCounts":dict(sorted(counters.items())),
        "culledSurfaceMaterials":dict(sorted(removed_slots.items())),
        "topTextureSlots":geom.materials.most_common(25),
        "warnings":dict(geom.warnings),
        "compressedBytes":len(payload),
        "sha256":hashlib.sha256(payload).hexdigest(),
        "exactEngineVisibletrisParity":False,
        "sourceNeighborCoverageVerified":True,
        "liveMapModified":False,
        "limitations":[
            "Fully covered faces are removed using exact native edge nibble tests and octree-boundary coverage.",
            "Partially intersecting, sloped and translucent face decisions remain conservatively visible.",
            "Original render-layer compositing and UV/texture coordinates are not yet restored.",
        ],
    }
    REPORT.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps({"triangles":report["triangles"],
                      "plainSlotOneTriangles":report["plainSlotOneTriangles"],
                      "faceCounts":report["faceCounts"],
                      "removedTopSlots":Counter(removed_slots).most_common(12),
                      "seconds":round(perf_counter()-started,2)},indent=2))
    return report

if __name__=="__main__":
    export()
