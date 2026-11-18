"""Evidence-only Octavus original MPZ geometry vs native player starts audit.

Checks whether the STAGING native architectural triangles contain a solid
surface near each of the 33 genuine native spawn entities, without falsely
claiming that geometry is a complete collision mesh. No gameplay changes.
"""
from __future__ import annotations
import gzip
import json
import math
from pathlib import Path
import struct
from scripts.octavus_native_geometry77 import ROOT
from scripts.octavus_native_core78 import OUT as CORE

SPAWNS=ROOT/"static/maps/octavus.native-entities.json"
REPORT=ROOT/"static/maps/octavus.native-spawn-audit.json"


def triangles_at_xy(verts,tris,x,y):
    """Native XY is horizontal; native Z is up. Return intersecting elevations."""
    heights=[]
    for a,b,c,mat in tris:
        u,v,w=verts[a],verts[b],verts[c]
        if not (min(u[0],v[0],w[0])<=x<=max(u[0],v[0],w[0])
                and min(u[1],v[1],w[1])<=y<=max(u[1],v[1],w[1])):
            continue
        den=(v[1]-w[1])*(u[0]-w[0])+(w[0]-v[0])*(u[1]-w[1])
        if abs(den)<=1e-9:continue
        alpha=((v[1]-w[1])*(x-w[0])+(w[0]-v[0])*(y-w[1]))/den
        beta=((w[1]-u[1])*(x-w[0])+(u[0]-w[0])*(y-w[1]))/den
        if alpha<-.00001 or beta<-.00001 or alpha+beta>1.00001:continue
        hz=alpha*u[2]+beta*v[2]+(1-alpha-beta)*w[2]
        heights.append((hz,mat))
    return heights


def audit():
    raw=gzip.decompress(CORE.read_bytes())
    magic,nv,nt=struct.unpack_from("<4sII",raw)
    if magic!=b"OCN2" or len(raw)!=12+nv*12+nt*14:
        raise ValueError("Native core binary not valid OCN2")
    verts=list(struct.iter_unpack("<III",raw[12:12+nv*12]))
    tris=list(struct.iter_unpack("<IIIH",raw[12+nv*12:]))
    source=json.loads(SPAWNS.read_text())
    if len(source["playerStarts"])!=33:
        raise ValueError("Unexpected count of original player starts")
    items=[]
    found_near=0
    for entry in source["playerStarts"]:
        xyz=entry["sourcePosition"]
        x,y,z=[float(v)*8 for v in xyz]
        heights=triangles_at_xy(verts,tris,x,y)
        nearest=min(heights,key=lambda hit:abs(hit[0]-z)) if heights else None
        dist=round((nearest[0]-z)/8,3) if nearest else None
        if dist is not None and abs(dist)<=8:found_near+=1
        items.append({
            "entityID":entry["id"],
            "sourcePosition":xyz,
            "hits":len(heights),
            "nearestSurfaceZ":round(nearest[0]/8,3) if nearest else None,
            "heightDifferenceNativeUnits":dist,
            "textureSlot":nearest[1] if nearest else None,
        })
    result={
        "format":"OCTAVUS-NATIVE-SPAWN-AUDIT78",
        "sourceRevision":829,
        "originalPlayerStartCount":len(items),
        "withProjectedNativeMeshSurfaceWithin8Units":found_near,
        "withNoXYProjectedSurface":sum(i["hits"]==0 for i in items),
        "outliers":[i for i in items
                    if i["heightDifferenceNativeUnits"] is None
                    or abs(i["heightDifferenceNativeUnits"])>8],
        "spawns":items,
        "limitations":[
            "Prototype native mesh is not renderer-exact and excludes plain slot 1.",
            "Vertical ray projection is a diagnostic, not a capsule collision test.",
            "Original game spawn points may be intentionally suspended above floors."
        ],
        "liveMapModified":False
    }
    REPORT.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:v for k,v in result.items() if k not in ("spawns","outliers")},indent=2))
    print("Outliers:",[(s["entityID"],s["heightDifferenceNativeUnits"]) for s in result["outliers"]])
    return result


if __name__=="__main__":
    audit()
