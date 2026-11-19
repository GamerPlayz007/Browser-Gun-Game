"""Octavus Stage 2.2 — island-interior native collision candidate.

Input: SHA-verified original Red Eclipse 2 r829 octree, the 863803-tri
native rendering candidate, and the user's Stage 2.1 polygon. Output:
a compact SHA-verified OCN2 candidate plus source provenance and known gaps.

Unlike Stage 2.0, this does NOT silently erase source material slot 1.
For those plain faces we test original native octree occupancy on BOTH
sides at 4 sample points; only entirely buried solid-solid faces are
discarded. Other ambiguous faces are kept and marked as candidates.
No fake floor/platform geometry, no guessed stair heights, no spawn
teleports and no changes to live multiplayer.

This is a source-grounded collision inspection candidate, NOT a fully
physically authoritative or production-ready octree collision mesh.
"""
from __future__ import annotations

from collections import Counter
import gzip
import hashlib
import json
import math
import struct
from pathlib import Path
from time import perf_counter

from octavus_native_boundary92 import NativeArenaBoundary92
from scripts.octavus_native_geometry77 import source_tree, OCT_EMPTY, OCT_SOLID, OCT_NORMAL

ROOT=Path(__file__).resolve().parent
MAPS=ROOT/"static/maps"
SOURCE=MAPS/"octavus.native-optimized.bin.gz"
SOURCE_META=MAPS/"octavus.native-optimized.json"
OUT=MAPS/"octavus.native-interior93.bin.gz"
META=MAPS/"octavus.native-interior93.json"
EXPECTED_SOURCE_TRIANGLES=863803
EXPECTED_SOURCE_VERTICES=679837
SQM=.05/8.0
PROBE=.03125  # original native world units; less than minimum source cube
BUFFER=2.0    # keep architectural faces near perimeter within 2m
MAX_TRIANGLES=850000


def read_optimized():
    meta=json.loads(SOURCE_META.read_text())
    packed=SOURCE.read_bytes()
    if hashlib.sha256(packed).hexdigest()!=meta["sha256"]:
        raise ValueError("Original native source material candidate hash mismatch")
    raw=gzip.decompress(packed)
    magic,nv,nt=struct.unpack_from("<4sII",raw)
    if magic!=b"OCN2" or (nv,nt)!=(EXPECTED_SOURCE_VERTICES,EXPECTED_SOURCE_TRIANGLES):
        raise ValueError("Original Octavus native candidate changed unexpectedly")
    if len(raw)!=12+nv*12+nt*14:
        raise ValueError("Corrupt native optimized OCN2 archive")
    vertbytes=raw[12:12+12*nv]
    return meta,vertbytes,memoryview(raw)[12+12*nv:]


def _original_octree_side(world,point,axis,direction):
    p=list(point)
    p[axis]+=direction*PROBE
    node=world.locate(p)
    if node is None or node.kind==OCT_EMPTY:
        return 0
    if node.kind==OCT_SOLID:
        return 1
    return 2  # deformed cube: uncertain, DO NOT erase on this evidence


def classify_plain_face(world,a,b,c):
    """Classify source face as solid-solid buried only with 4 full proofs.

    The source octree is sampled at each barycentric point. Requiring all
    samples to have solid cubes on both sides is conservative but it is
    NOT full-area native visibletris; the output remains a candidate.
    """
    u=(b[0]-a[0],b[1]-a[1],b[2]-a[2])
    v=(c[0]-a[0],c[1]-a[1],c[2]-a[2])
    n=(u[1]*v[2]-u[2]*v[1],
       u[2]*v[0]-u[0]*v[2],
       u[0]*v[1]-u[1]*v[0])
    axis=max(range(3),key=lambda k:abs(n[k]))
    if abs(n[axis])<1: return "degenerate"
    # For native source slots, axis-aligned faces are by far most common.
    # Deformed face boundaries cannot be decided by an axis-only probe.
    if any(n[k] for k in range(3) if k!=axis):
        return "sloped-unresolved"
    points=[
        tuple((a[k]+b[k]+c[k])/24.0 for k in range(3)),
        tuple((6*a[k]+2*b[k]+2*c[k])/80.0 for k in range(3)),
        tuple((2*a[k]+6*b[k]+2*c[k])/80.0 for k in range(3)),
        tuple((2*a[k]+2*b[k]+6*c[k])/80.0 for k in range(3)),
    ]
    open_side=False
    unknown=False
    for point in points:
        left=_original_octree_side(world,point,axis,-1)
        right=_original_octree_side(world,point,axis,+1)
        if left==0 or right==0:open_side=True
        if left==2 or right==2:unknown=True
        if left!=1 or right!=1:
            # Remaining probes cannot establish whole-sample burial.
            # Continue to identify if some actual source void was found.
            pass
        else:
            continue
    if open_side:return "borders-open-octree"
    if unknown:return "deformed-neighbor-unresolved"
    return "solid-solid-at-four-samples"


def _inside_source_boundary(ring,a,b,c):
    x=(a[0]+b[0]+c[0])/3*SQM-4096*.05
    z=(a[1]+b[1]+c[1])/3*SQM-4096*.05
    minx,maxx,minz,maxz=ring.bounds
    if x<minx-BUFFER or x>maxx+BUFFER or z<minz-BUFFER or z>maxz+BUFFER:
        return False
    if ring.contains_point(x,z):
        return True
    # Preserve source faces crossing the perimeter in case of long
    # strips spanning interior/exterior, but not distant world terrain.
    for p in (a,b,c):
        vx=p[0]*SQM-4096*.05
        vz=p[1]*SQM-4096*.05
        if ring.contains_point(vx,vz):
            return True
    return ring.distance_to_wall(x,z)<=BUFFER


def export():
    start=perf_counter()
    ring=NativeArenaBoundary92()
    info,vertices_data,triangles=read_optimized()
    world,octree_counts=source_tree()
    nv=EXPECTED_SOURCE_VERTICES
    readvertex=lambda index:struct.unpack_from("<III",vertices_data,index*12)
    old_to_new={}
    new_vertices=bytearray()
    new_triangles=bytearray()
    stats=Counter()
    by_material=Counter()
    by_class=Counter()
    source_kept=[]
    max_kept=MAX_TRIANGLES
    for i in range(EXPECTED_SOURCE_TRIANGLES):
        a,b,c,slot=struct.unpack_from("<IIIH",triangles,i*14)
        if a>=nv or b>=nv or c>=nv:
            raise ValueError("Source triangle index overflow")
        va,vb,vc=readvertex(a),readvertex(b),readvertex(c)
        stats["sourceTriangles"]+=1
        if not _inside_source_boundary(ring,va,vb,vc):
            stats["outsideCompactIsland"]+=1
            continue
        stats["insideOrNearIsland"]+=1
        if slot==1:
            classif=classify_plain_face(world,va,vb,vc)
            by_class[classif]+=1
            if classif in ("solid-solid-at-four-samples","degenerate"):
                stats["notCertifiedForCollision"]+=1
                continue
        else:
            by_class["authoredDetailed"]+=1
        if len(source_kept)>=max_kept:
            raise ValueError("Interior native collision candidate exceeds budget")
        for v in (a,b,c):
            if v not in old_to_new:
                old_to_new[v]=len(old_to_new)
                new_vertices.extend(vertices_data[v*12:(v+1)*12])
            # construct triangle using source vertex exact 1/8-unit
        new_triangles.extend(struct.pack("<IIIH",
            old_to_new[a],old_to_new[b],old_to_new[c],slot))
        source_kept.append(i)
        by_material[slot]+=1
    nt=len(source_kept)
    if nt<50000 or nt>=EXPECTED_SOURCE_TRIANGLES:
        raise ValueError("Original island native collider candidate unexpectedly empty or unfiltered")
    raw=struct.pack("<4sII",b"OCN2",len(old_to_new),nt)+new_vertices+new_triangles
    packed=gzip.compress(raw,compresslevel=6,mtime=0)
    OUT.write_bytes(packed)
    report={
      "format":"OCN2","status":"staging-only-not-live",
      "sourceRevision":829,"collisionScope":"island-interior-candidate",
      "sourceOptimizedSha256":info["sha256"],
      "sourceOriginalMPZLeaves":octree_counts["leaves"],
      "perimeterManifest":"static/maps/octavus.native-boundary92.json",
      "interiorSourceTriangles":nt,
      "triangles":nt,"vertices":len(old_to_new),
      "sourceTriangles":EXPECTED_SOURCE_TRIANGLES,
      "retainedNativeSlotOneTriangles":by_material[1],
      "detailedNativeTriangles":nt-by_material[1],
      "originalNativeMaterialCounts":dict(sorted(by_material.items())),
      "candidateClasses":dict(sorted(by_class.items())),
      "counters":dict(sorted(stats.items())),
      "excludedOutsideIsland":stats["outsideCompactIsland"],
      "explicitNativeSlotOneIncluded":by_material[1]>0,
      "partiallyBuriedFaceAmbiguityRemaining":True,
      "exactNativeRendererVisibility":False,
      "nativeAuthoritativeCollisionReady":False,
      "clientServerMovementParity":False,
      "liveMapModified":False,
      "compressedBytes":len(packed),
      "sha256":hashlib.sha256(packed).hexdigest(),
      "limitations":[
        "Centroid/vertex shell tests preserve near-boundary source faces but do not clip source triangles exactly to the screenshot polygon.",
        "Source OCT_NORMAL deformed surfaces and open-side samples are conservative candidates; full source visibletris parity remains unproven.",
        "The plain-material slot 1 contains ambiguous internal surfaces; only fully solid-solid checked faces are excluded.",
        "The original engine collides against solid octree geometry rather than this partial OCN2 rendering candidate.",
        "This staging candidate is not directly used by server.py, physics.js, octavus_match.js or the live Octavus map."
      ]
    }
    META.write_text(json.dumps(report,indent=2)+"\n")
    summary={k:v for k,v in report.items() if k not in
             ("originalNativeMaterialCounts","limitations")}
    print(json.dumps(summary,indent=2))
    print("Duration seconds:",round(perf_counter()-start,2))
    return report

if __name__=="__main__":
    export()
