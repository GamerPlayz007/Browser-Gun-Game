"""Octavus Stage 2.2: compact original source-native OCCUPANCY broadphase.

Red Eclipse collision fundamentally depends on the native solid/empty/
deformed octree, not the renderer's 863K triangle staging candidate.

This emits a compact source-derived subset of exact octree leaves
covering the user's playable island and vertical arena range.
- Octree kind EMPTY/SOLID/NORMAL and all 12 original edge bytes preserved.
- All source leaves are non-overlapping, exact integer native coordinates.
- Works identically in lightweight Python and JavaScript runtime queries.
- NORMAL (deformed) is *unknown physical occupancy* pending exact cube-edge
  containment, never silently called solid or open.
- This is NOT the final player capsule or motion solver. Live unchanged.
"""
from __future__ import annotations
from collections import Counter
import gzip
import hashlib
import json
import math
import struct
from pathlib import Path
from scripts.octavus_native_geometry77 import (
  source_tree,OCT_EMPTY,OCT_SOLID,OCT_NORMAL
)
from octavus_native_boundary92 import NativeArenaBoundary92

ROOT=Path(__file__).resolve().parent.parent
MAPS=ROOT/"static/maps"
OUTPUT=MAPS/"octavus.native-occupancy96.bin.gz"
REPORT=MAPS/"octavus.native-occupancy96.json"
SOURCE_ENTITIES=MAPS/"octavus.native-entities.json"
INTERIOR_REPORT=MAPS/"octavus.native-interior-preflight94.json"
STRUCT=struct.Struct("<4HB12s")
HEADER=struct.Struct("<4sII")
BUFFER=2.0
OCTREE_AXIS_RANGE=(0,8192)
KIND_NAMES={OCT_EMPTY:"empty",OCT_SOLID:"solid",OCT_NORMAL:"deformed"}


class NativeOccupancy96:
    def __init__(self,data):
        if data[:4]!=b"OCO1" or len(data)<12:
            raise ValueError("Native source octree cell archive is invalid")
        _,revision,count=HEADER.unpack_from(data)
        if revision!=829 or len(data)!=HEADER.size+count*STRUCT.size:
            raise ValueError("Native original octree cell count or binary length changed")
        self.count=count
        self.by_size={}
        self.kinds=Counter()
        for i in range(count):
            x,y,z,size,kind,edges=STRUCT.unpack_from(data,HEADER.size+i*STRUCT.size)
            if kind not in KIND_NAMES or not size or size&(size-1) or size>4096:
                raise ValueError("Invalid original native cube kind or extent")
            if any(coord>=8192 or coord%size for coord in (x,y,z)):
                raise ValueError("Misaligned native cube")
            if (x,y,z) in self.by_size.get(size,{}):
                raise ValueError("Duplicate original native cube")
            self.by_size.setdefault(size,{})[x,y,z]=(kind,edges)
            self.kinds[kind]+=1
        self.sizes=sorted(self.by_size)
        if sum(self.kinds.values())!=count:
            raise ValueError("Original Octavus occupancy count mismatch")

    def lookup(self,world_native_xyz):
        """Exact original octree leaf kind for native engine XYZ (0..8192).

        Returns None outside the published island bounding rectangle.
        NORMAL means deformed: collision still needs native cube plane
        information; never interpret it as fully solid.
        """
        x,y,z=world_native_xyz
        if any(coord<0 or coord>=8192 for coord in (x,y,z)):return None
        for size in self.sizes:
            key=(int(x//size)*size,int(y//size)*size,int(z//size)*size)
            info=self.by_size[size].get(key)
            if info is not None:return {"kind":info[0],"edges":info[1],
                                         "origin":key,"size":size}
        return None


def area_native_bounds(ring):
    x0,x1,z0,z1=ring.bounds
    scale=1/.05
    return (
      max(0,math.floor(x0*scale+4096-BUFFER*scale)),
      min(8192,math.ceil(x1*scale+4096+BUFFER*scale)),
      max(0,math.floor(z0*scale+4096-BUFFER*scale)),
      min(8192,math.ceil(z1*scale+4096+BUFFER*scale)),
      max(0,math.floor(ring.base_y*scale+2816-BUFFER*scale)),
      min(8192,math.ceil(ring.top_y*scale+2816+BUFFER*scale)),
    )


def pack():
    ring=NativeArenaBoundary92()
    bounds=area_native_bounds(ring)
    world,source_counts=source_tree()
    selected=[]
    counts=Counter()
    def intersect(c):
        x0,x1,y0,y1,z0,z1=(bounds[0],bounds[1],bounds[2],bounds[3],bounds[4],bounds[5])
        return (c.origin[0]<x1 and c.origin[0]+c.size>x0 and
                c.origin[1]<y1 and c.origin[1]+c.size>y0 and
                c.origin[2]<z1 and c.origin[2]+c.size>z0)
    def visit(cube):
        if not intersect(cube):return
        if cube.children:
            for child in cube.children:visit(child)
            return
        selected.append(cube)
        counts[KIND_NAMES[cube.kind]]+=1
    for cube in world.roots:visit(cube)
    if not 1000<=len(selected)<704159:
        raise ValueError("Original native octree island subset invalid")
    selected.sort(key=lambda c:(c.size,c.origin))
    buffer=bytearray(HEADER.pack(b"OCO1",829,len(selected)))
    for c in selected:
        edge=c.edges
        if len(edge)!=12:
            raise ValueError("Original native octree edge data not preserved")
        buffer.extend(STRUCT.pack(*c.origin,c.size,c.kind,edge))
    archive=gzip.compress(buffer,compresslevel=7,mtime=0)
    OUTPUT.write_bytes(archive)
    index=NativeOccupancy96(buffer)
    if index.count!=len(selected):
        raise ValueError("Own original cell subset failed index verification")
    source=json.loads(SOURCE_ENTITIES.read_text())
    full=json.loads(INTERIOR_REPORT.read_text())
    sources=[]
    for entry in source["playerStarts"]:
        p=entry["sourcePosition"]
        for vertical in (0,0.1,0.5,1.,1.7,2.2,-.1,-.5):
            point=[p[0],p[1],p[2]+vertical/.05]
            node=world.locate(point)
            candidate=index.lookup(point)
            kind=node.kind if node else None
            if kind!=(candidate["kind"] if candidate else None):
                raise ValueError("Octree compact index altered original source player-start occupancy")
            sources.append({"kind":kind,"native":[round(n,5) for n in point],
                            "size":candidate["size"] if candidate else None})
    for s in full["nearSpawnSurvey"]:
        p=s["worldXZ"]
        baseline=s["referenceSourceY"]
        for delta in (0.,-.6,1.0):
            point=[p[0]/.05+4096,p[1]/.05+4096,(baseline+delta)/.05+2816]
            node=world.locate(point)
            candidate=index.lookup(point)
            kind=node.kind if node else None
            if kind!=(candidate["kind"] if candidate else None):
                raise ValueError("Island source octree occupancy differs at surveyed interior location")
            sources.append({"kind":kind,"native":[round(n,5) for n in point],
                            "size":candidate["size"] if candidate else None})
    totals=Counter("outside" if s["kind"] is None else KIND_NAMES[s["kind"]] for s in sources)
    report={
        "format":"OCTAVUS-NATIVE-OCCUPANCY96",
        "status":"staging-only-not-live",
        "sourceRevision":829,
        "source":"Original SHA256-verified Red Eclipse 2 r829 MAPZ octree",
        "sourceOctreeLeaves":source_counts["leaves"],
        "originalNativeBoundsXYZ":bounds,
        "occupancyCells":len(selected),
        "cellCounts":dict(counts),
        "binaryMagic":"OCO1",
        "binaryUncompressedBytes":len(buffer),
        "compressedBytes":len(archive),
        "compressedSha256":hashlib.sha256(archive).hexdigest(),
        "cellRecordBytes":STRUCT.size,
        "actualSourceOccupancyFixtures":sources,
        "sourceQuerySampleCount":len(sources),
        "sourceSampleKinds":dict(totals),
        "allSampledKindsMatchOriginalOctree":True,
        "normalCubeCollisionProven":False,
        "fullSourceSolidCollisionReady":False,
        "clientServerControllerParity":False,
        "liveMapModified":False,
        "limitations":[
          "Only leaves intersecting the rectangular prism around the user's island are stored; movement outside its polygon is separately blocked by Stage 2.1.",
          "The original source octree's deformed cubes require exact face/edge collision logic; kind NORMAL is explicitly unresolved.",
          "A source octree kind query is necessary but not sufficient to move a player-sized capsule safely along stairs, slopes and moving objects.",
          "Stage 2.2 still has no source-correct collision for solid mapmodels, entity alpha volumes or player interaction.",
          "This is source physics broadphase data only. It is not imported by the current live CROSSFire server or client."
        ],
    }
    REPORT.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps({k:v for k,v in report.items()
                      if k not in ("actualSourceOccupancyFixtures","limitations")},indent=2))
    return report


if __name__=="__main__":
    pack()
