"""Phase 1.4 Octavus source-native exact coplanar rectangle compaction.

Source: CC BY-SA 3.0 Red Eclipse 2 MPZ revision 829, previously
decoded into OCN2. Fixes excessive tessellation of native plain
geometry without changing visual footprints or inventing elevations.

ONLY merges axis-aligned, coplanar, identically oriented adjacent
rectangles. Any other source triangle is kept exactly. This is not
a replacement for original visibletris or source texture UVs.

Input: native-stage1.bin.gz (the SHA-verified full candidate).
Output: native-merged.bin.gz / .json. Staging only.
"""
from __future__ import annotations
from collections import Counter,defaultdict
import gzip
import hashlib
import io
import json
from pathlib import Path
import struct
from time import perf_counter

from scripts.octavus_native_geometry77 import ROOT, WORLD_SIZE

MAPS=ROOT/"static/maps"
INPUT=MAPS/"octavus.native-stage1.bin.gz"
MANIFEST=MAPS/"octavus.native-stage1.json"
OUTPUT=MAPS/"octavus.native-merged.bin.gz"
REPORT=MAPS/"octavus.native-merged.json"
SOURCE_MAT=1


def native_xyz(axis,plane,u,v):
    other=tuple(k for k in range(3) if k!=axis)
    coords=[0,0,0]
    coords[axis]=plane
    coords[other[0]]=u
    coords[other[1]]=v
    return tuple(coords)


def rectangle_from_pair(first,second,verts):
    """Reassemble exactly the two fan triangles of a planar quad.

    Return (axis,plane,sign,u0,u1,v0,v1), or None.
    All source geometry coordinates are 1/8 native units, exact integers.
    """
    a,b,c,slot=first
    a2,b2,d,slot2=second
    if slot!=SOURCE_MAT or slot2!=SOURCE_MAT or a!=a2 or c!=b2:
        return None
    if len({a,b,c,d})!=4:
        return None
    p=[verts[n] for n in (a,b,c,d)]
    normal=(
        (p[1][1]-p[0][1])*(p[2][2]-p[0][2])
         -(p[1][2]-p[0][2])*(p[2][1]-p[0][1]),
        (p[1][2]-p[0][2])*(p[2][0]-p[0][0])
         -(p[1][0]-p[0][0])*(p[2][2]-p[0][2]),
        (p[1][0]-p[0][0])*(p[2][1]-p[0][1])
         -(p[1][1]-p[0][1])*(p[2][0]-p[0][0]),
    )
    for axis in range(3):
        if not normal[axis] or any(normal[k] for k in range(3) if k!=axis):
            continue
        if len({pt[axis] for pt in p})!=1:
            continue
        other=[k for k in range(3) if k!=axis]
        uu=sorted({pt[other[0]] for pt in p})
        vv=sorted({pt[other[1]] for pt in p})
        if len(uu)!=2 or len(vv)!=2 or uu[0]>=uu[1] or vv[0]>=vv[1]:
            continue
        if {(pt[other[0]],pt[other[1]]) for pt in p} != {
            (uu[0],vv[0]),(uu[0],vv[1]),(uu[1],vv[0]),(uu[1],vv[1])
        }:
            continue
        # Opposite edge signs must preserve the original surface.
        return (axis,p[0][axis],1 if normal[axis]>0 else -1,
                uu[0],uu[1],vv[0],vv[1])
    return None


def coalesce(rectangles):
    """Repeated full-edge unions only. Exact shape and area preserved.

    Rectangles are (u0,u1,v0,v1). Shared full edges, same plane and
    normal/material prevent merging through a hole or across a slope.
    """
    rects=sorted(rectangles)
    original_area=sum((r[1]-r[0])*(r[3]-r[2]) for r in rects)
    loops=0
    while loops<12:
        loops+=1
        old=len(rects)
        # Horizontal runs share identical V intervals.
        rects.sort(key=lambda q:(q[2],q[3],q[0],q[1]))
        horizontal=[]
        for r in rects:
            if horizontal and horizontal[-1][2:]==r[2:] and horizontal[-1][1]==r[0]:
                last=horizontal.pop()
                horizontal.append((last[0],r[1],last[2],last[3]))
            else:horizontal.append(r)
        # Vertical runs share identical U intervals.
        horizontal.sort(key=lambda q:(q[0],q[1],q[2],q[3]))
        vertical=[]
        for r in horizontal:
            if vertical and vertical[-1][:2]==r[:2] and vertical[-1][3]==r[2]:
                last=vertical.pop()
                vertical.append((last[0],last[1],last[2],r[3]))
            else:vertical.append(r)
        rects=vertical
        if len(rects)==old:break
    assert original_area==sum((r[1]-r[0])*(r[3]-r[2]) for r in rects)
    return rects,loops


def triangles_from_rectangle(axis,plane,sign,u0,u1,v0,v1):
    points=[
        native_xyz(axis,plane,u0,v0),
        native_xyz(axis,plane,u1,v0),
        native_xyz(axis,plane,u1,v1),
        native_xyz(axis,plane,u0,v1),
    ]
    a,b,c=points[:3]
    v=tuple(b[k]-a[k] for k in range(3))
    w=tuple(c[k]-a[k] for k in range(3))
    cross=(v[1]*w[2]-v[2]*w[1],
           v[2]*w[0]-v[0]*w[2],
           v[0]*w[1]-v[1]*w[0])
    if sign*cross[axis]<0:
        points=[points[0],points[3],points[2],points[1]]
    return (points[0],points[1],points[2]),(points[0],points[2],points[3])


def compact(source=INPUT, source_manifest=MANIFEST, output=OUTPUT, report_path=REPORT):
    started=perf_counter()
    manifest=json.loads(source_manifest.read_text())
    compressed=source.read_bytes()
    source_hash=manifest["stagingSHA256"] if "stagingSHA256" in manifest else manifest["sha256"]
    if hashlib.sha256(compressed).hexdigest()!=source_hash:
        raise ValueError("Source staging mesh SHA mismatch")
    raw=gzip.decompress(compressed)
    if raw[:4]!=b"OCN2":raise ValueError("Invalid OCN2 asset")
    nv,nt=struct.unpack_from("<II",raw,4)
    if (nt,nv)!=(manifest["triangles"],manifest["vertices"]):raise ValueError("Unexpected source geometry header vs manifest")
    vertex_data=raw[12:12+12*nv]
    verts=list(struct.iter_unpack("<III",vertex_data))
    triangle_data=raw[12+12*nv:]
    raw_tris=struct.iter_unpack("<IIIH",triangle_data)
    pending=None
    preserved=[]
    groups=defaultdict(list)
    counters=Counter()
    for tri in raw_tris:
        if pending is None:
            if tri[3]!=SOURCE_MAT:
                preserved.append(tri)
            else:
                pending=tri
            continue
        rect=rectangle_from_pair(pending,tri,verts)
        if rect is None:
            preserved.append(pending)
            pending=tri if tri[3]==SOURCE_MAT else None
            if pending is None:
                preserved.append(tri)
            continue
        groups[rect[:3]].append(rect[3:])
        counters["pairedQuads"]+=1
        pending=None
    if pending is not None:preserved.append(pending)
    all_rects={}
    iterations=0
    for key,values in sorted(groups.items()):
        merged,n=coalesce(values)
        all_rects[key]=merged
        iterations+=n
    merged_rect_count=sum(len(x) for x in all_rects.values())
    # Reuse only vertices referenced by preserved triangles. All merged
    # faces get exact native 1/8-unit vertices, with correct winding.
    output_verts=[]
    mapping={}
    output_tris=[]
    mats=Counter()
    def addvertex(p):
        idx=mapping.get(p)
        if idx is None:
            idx=len(output_verts)
            mapping[p]=idx
            output_verts.append(p)
        return idx
    for a,b,c,slot in preserved:
        output_tris.append((addvertex(verts[a]),addvertex(verts[b]),
                            addvertex(verts[c]),slot))
        mats[slot]+=1
    for (axis,plane,sign),rects in sorted(all_rects.items()):
        for u0,u1,v0,v1 in rects:
            for triangle in triangles_from_rectangle(axis,plane,sign,u0,u1,v0,v1):
                output_tris.append((*map(addvertex,triangle),SOURCE_MAT))
                mats[SOURCE_MAT]+=1
    if len(output_tris)>=nt:
        raise ValueError("No conservative source plain-triangle reduction verified; refusing to publish")
    out=io.BytesIO()
    out.write(struct.pack("<4sII",b"OCN2",len(output_verts),len(output_tris)))
    for xyz in output_verts:out.write(struct.pack("<III",*xyz))
    for tri in output_tris:out.write(struct.pack("<IIIH",*tri))
    packed=gzip.compress(out.getvalue(),compresslevel=6,mtime=0)
    if len(packed)>len(compressed):
        raise ValueError("Source face compaction did not improve compressed size")
    output.write_bytes(packed)
    report={
        "format":"OCN2",
        "status":"staging-only-not-live",
        "sourceRevision":829,
        "sourceSHA256":source_hash,
        "sourceTriangles":nt,
        "sourceVertices":nv,
        "vertices":len(output_verts),
        "triangles":len(output_tris),
        "originalPlainTriangles":manifest.get("remainingPlainSlotOneTriangles",1562842),
        "finalPlainTriangles":mats[SOURCE_MAT],
        "pairedOriginalPlainQuads":counters["pairedQuads"],
        "mergedPlainRectangles":merged_rect_count,
        "untouchedTriangleCount":len(preserved),
        "originalMaterialCount":len(mats),
        "newMaterialTriangleCounts":dict(sorted(mats.items())),
        "exactUnionProof":"Only full-edge axis-aligned rectangles with identical source material, plane and winding; checked area conservation.",
        "exactSourceSurfaceVisibility":False,
        "knownLimitations":[
            "Native source surface visibility is not yet proven identical to original engine.",
            "No material UVs, blend layers, props or gameplay collision are changed.",
            "Interior geometrical faces may still be present; triangles alone are not an accuracy proof.",
        ],
        "bytesCompressed":len(packed),
        "sha256":hashlib.sha256(packed).hexdigest(),
        "liveMapModified":False,
    }
    report_path.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps({k:v for k,v in report.items() if k!="newMaterialTriangleCounts"},indent=2))
    print("Compaction duration (s):",round(perf_counter()-started,2))
    return report

if __name__=="__main__":
    compact()
