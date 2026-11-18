"""Octavus Phase 1.5: provable original-source partial-triangle occlusion.

Sources: Red Eclipse 2 octa.cpp visibletris()/occludesface() (CC BY-SA 3.0).
The original engine clips face polygons against neighboring octree nodes,
including smaller leaves. This prototype performs exact-integer XY plane
clipping to an octree node rectangle and removes a *source triangle* only
when every clipped piece is covered by opaque native leaf geometry.

Guarantees:
- Never introduces new surfaces or changes source vertex coordinates.
- Keeps the original phase1.2 conservative full-face test, so triangle
  count can only decrease relative to original OCN2 full staging.
- Opaque source cube covering the complete neighbor plane is safe.
- Deformed face is accepted as cover only if its projected convex polygon
  entirely contains the piece and every face vertex touches the plane.
- Partial coverage of a candidate triangle => do NOT cull that triangle.
- Nonzero native volume materials are kept pending renderer-equivalent
  alpha/clip logic.
- This is an offline independent staging mesh, not live gameplay collision.

Not yet full renderer equivalence: polygon splits and blend layers,
authored UV mapping and GPU surface merging are not reconstructed.
"""
from __future__ import annotations
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
from time import perf_counter

from scripts.octavus_native_geometry77 import (
    ROOT, SCALE, WORLD_SIZE, Face, Cube, NativeWorld, Builder,
    OCT_CHILDREN, OCT_EMPTY, OCT_NORMAL, OCT_SOLID,
    source_tree, visible_polygon, implicit_polygon,
    nondegenerate, triangle_area_sq, pack_mesh,
)

OUTPUT=ROOT/"static/maps/octavus.native-partial.bin.gz"
META=ROOT/"static/maps/octavus.native-partial.json"
SOURCE_ID="source MPZ revision 829; engine: redeclipse/base octa.cpp"
AXIS_PAIR=((1,2),(0,2),(0,1))
FULL=8*WORLD_SIZE

def signed_cross(a,b,c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])

def polygon_area_twice(poly):
    return sum(p[0]*q[1]-q[0]*p[1]
               for p,q in zip(poly,poly[1:]+poly[:1]))

def clip_rect(poly, xmin, xmax, ymin, ymax):
    """Sutherland-Hodgman half-plane clip, points may be Fractions/floats.

    Exact integer arithmetic on original vertices, rational intersections
    computed using integer numerator/denominator => no unintentional
    area loss from integer vertex roundoff.
    """
    from fractions import Fraction
    def clip(points,axis,value,ismax):
        if not points:return []
        out=[]
        def inside(p):
            return p[axis]<=value if ismax else p[axis]>=value
        for u,v in zip(points,points[1:]+points[:1]):
            a,b=inside(u),inside(v)
            if a and b:
                out.append(v)
            elif a!=b:
                du=v[axis]-u[axis]
                if du:
                    t=Fraction(value-u[axis],du)
                    intersection=(u[0]+t*(v[0]-u[0]),u[1]+t*(v[1]-u[1]))
                    out.append(intersection)
                if not a:out.append(v)
        return out
    result=list(poly)
    for axis,value,ismax in ((0,xmin,False),(0,xmax,True),
                              (1,ymin,False),(1,ymax,True)):
        result=clip(result,axis,value,ismax)
        if len(result)<3:return []
    if polygon_area_twice(result)==0:return []
    return result

def convex_polygon_contains(container, points):
    """Conservatively accept only true convex original-source boundaries."""
    if len(container)<3:return False
    cross=[signed_cross(container[i-1],container[i],container[(i+1)%len(container)])
           for i in range(len(container))]
    nonzero=[v for v in cross if v]
    if not nonzero:return False
    sign=1 if nonzero[0]>0 else -1
    if any(v*sign<0 for v in cross):
        return False
    for point in points:
        if any(signed_cross(container[i-1],container[i],point)*sign<0
               for i in range(len(container))):
            return False
    return True

def opaque_neighbor_cover(node:Cube, opp:int, plane:int, projected):
    """Prove clipped candidate part belongs inside a solid source face."""
    if node.material:
        return False  # alpha / special clip behavior handled later
    if node.kind==OCT_SOLID:
        return True
    if node.kind!=OCT_NORMAL:
        return False
    axis=opp//2
    border=(node.origin[axis]+(node.size if opp&1 else 0))*SCALE
    if border!=plane:return False
    vertices=implicit_polygon(node,opp)
    if any(point[axis]!=plane for point in vertices):
        return False
    ca,cb=AXIS_PAIR[axis]
    contour=[(p[ca],p[cb]) for p in vertices]
    return convex_polygon_contains(contour,projected)

def triangle_covered_by_octree(world:NativeWorld, cube:Cube, orient:int, tri,
                               stats=None):
    """Safe removal when ALL portions adjoining the triangle are opaque.

    Critically unlike the original stage1 centroid method, this doesn't
    pretend the sampled center describes an entire triangle.
    """
    axis=orient//2
    plane=(cube.origin[axis]+(cube.size if orient&1 else 0))*SCALE
    if any(v[axis]!=plane for v in tri):
        return False  # recessed or sloped polygons remain untouched
    ca,cb=AXIS_PAIR[axis]
    poly=[(p[ca],p[cb]) for p in tri]
    if polygon_area_twice(poly)==0:return False
    neighbor_at=plane+(1 if orient&1 else -1)
    if not 0<=neighbor_at<FULL:
        return False  # never erase true world boundary in this pass
    test=[sum(p[k] for p in tri)/(3*SCALE) for k in range(3)]
    test[axis]=neighbor_at/SCALE
    nearby=world.locate(test)
    if nearby is None or nearby.kind==OCT_EMPTY or nearby.material:
        return False
    opposite=orient^1
    visited=0
    def cover(node):
        nonlocal visited
        x0=node.origin[ca]*SCALE;x1=x0+node.size*SCALE
        y0=node.origin[cb]*SCALE;y1=y0+node.size*SCALE
        if not (node.origin[axis]*SCALE<=neighbor_at<
                (node.origin[axis]+node.size)*SCALE):
            return True
        minx=min(p[0] for p in poly);maxx=max(p[0] for p in poly)
        miny=min(p[1] for p in poly);maxy=max(p[1] for p in poly)
        if x0>=maxx or x1<=minx or y0>=maxy or y1<=miny:
            return True
        clipped=clip_rect(poly,x0,x1,y0,y1)
        if not clipped:return True
        visited+=1
        if node.children:
            return all(cover(child) for child in node.children)
        return opaque_neighbor_cover(node,opposite,plane,clipped)
    covered=all(cover(root) for root in world.roots)
    if stats is not None:
        stats["coveredTriangle" if covered else "keptPartialOrOpen"]+=1
        stats["testedLeafOrBranchPieces"]+=visited
    return covered

def export():
    start=perf_counter()
    world,rootmeta=source_tree()
    b=Builder()
    summary=Counter()
    byslot=Counter()
    def visit(children):
        for cube in children:
            if cube.children:
                visit(cube.children)
                continue
            if cube.kind==OCT_EMPTY:continue
            for orient in range(6):
                surface=cube.faces.get(orient) if cube.faces else None
                if cube.merged&(1<<orient) and not surface:
                    summary["suppressedMergeParts"]+=1
                    continue
                poly=surface.verts if surface and surface.verts else implicit_polygon(cube,orient)
                if not nondegenerate(poly):
                    summary["collapsedFaces"]+=1
                    continue
                if not visible_polygon(world,cube,orient,poly):
                    summary["previouslyCulledWholeFaces"]+=1
                    continue
                # Keep the original phase1.2 triangle fan exact; only
                # remove individual triangles if neighbor clipping proves
                # entire area opaque, not merely its center sample.
                for i in range(1,len(poly)-1):
                    tri=(poly[0],poly[i],poly[i+1])
                    if triangle_area_sq(*tri)==0:
                        summary["degenerateTriangles"]+=1
                        continue
                    summary["candidateTriangles"]+=1
                    # Avoid expensive clipping on untrusted material only?
                    # No: all source slots get identical geometry proof.
                    if triangle_covered_by_octree(world,cube,orient,tri,summary):
                        summary["newlyHiddenTriangles"]+=1
                        byslot[cube.textures[orient]]+=1
                        continue
                    b.add(tri,cube.textures[orient],"retainedNativeTriangle")
    visit(world.roots)
    original=json.loads((ROOT/"static/maps/octavus.native-stage1.json").read_text())
    if summary["candidateTriangles"]!=original["triangles"]:
        raise ValueError("New source candidate count differs from pinned phase1.2 export")
    if len(b.indices)>original["triangles"]:
        raise ValueError("Partial-visibility pass unexpectedly increased face count")
    packed=gzip.compress(pack_mesh(b),compresslevel=6,mtime=0)
    OUTPUT.write_bytes(packed)
    report={
        "format":"OCN2",
        "status":"staging-only-not-live",
        "sourceRevision":829,
        "sourceStageSHA256":original["stagingSHA256"],
        "vertices":len(b.vertices),
        "triangles":len(b.indices),
        "oldStagingTriangles":original["triangles"],
        "removedTriangles":summary["newlyHiddenTriangles"],
        "remainingPlainSlotOneTriangles":b.materials[1],
        "removedByMaterialSlot":dict(sorted(byslot.items())),
        "surfaceCounters":dict(sorted(summary.items())),
        "warnings":dict(b.warnings),
        "bytesCompressed":len(packed),
        "sha256":hashlib.sha256(packed).hexdigest(),
        "fullOriginalRendererParity":False,
        "nativePartialFaceClipping":True,
        "liveMapModified":False,
        "limitations":[
            "Only fully-occluded source triangles are culled; fractional triangle areas are not split.",
            "Original source per-face visibility mask and alpha/clip material handling need exact replication.",
            "Native UVs, rendered normal blending, detail props and collision are not changed.",
        ],
    }
    META.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps({k:v for k,v in report.items() if k not in ("removedByMaterialSlot","surfaceCounters")},indent=2))
    print("Occlusion counters:",dict(summary))
    print("Removed by material:",byslot.most_common(14))
    print("Duration seconds:",round(perf_counter()-start,2))
    return report

if __name__=="__main__":
    export()
