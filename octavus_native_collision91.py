"""Octavus Phase 2.0: source-native collision *pilot*, NOT a playable map.

This validates the ORIGINAL Red Eclipse r829 OCN2 architectural core in
exactly the same Y-up coordinate frame as static/octavus-native-preview.js.

- Reuses the existing SHA256-verified source core (98,358 triangles).
- Outputs a deterministic IEEE754 float32 triangle soup shared with JS.
- Builds sparse broadphase cells, with an overflow pool for large faces.
- Evaluates all 33 AUTHORED source player-start positions for a walkable
  floor and genuine player capsule clearance, without relocating spawns.
- Does not import into server.py, register a map, modify live collision,
  or claim the complete 864K native geometry is collision-compatible.

The original source architecture excludes native material slot 1 and
does not yet include model collision or native engine blended surfaces.
"""
from __future__ import annotations

from array import array
from collections import Counter, defaultdict
import gzip
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

from dust_world64 import closest_on_triangle

ROOT=Path(__file__).resolve().parent
BASE=ROOT/"static/maps"
SOURCE=BASE/"octavus.native-core.bin.gz"
META=BASE/"octavus.native-core.json"
ENTITIES=BASE/"octavus.native-entities.json"
REPORT=BASE/"octavus.native-collision-preflight91.json"
CELL=8.0
MAX_CELLS_PER_TRI=40
RADIUS=.34
HEIGHT=1.8
SOURCE_SCALE=.05


def native_point(point):
    """Source eighth-unit integer (native X,Y,Z) -> THREE world X,Y,Z."""
    x,y,z=point
    return ((x/8-4096)*SOURCE_SCALE,
            (z/8-2816)*SOURCE_SCALE,
            (y/8-4096)*SOURCE_SCALE)


class NativeCollisionPilot91:
    def __init__(self,source=SOURCE,meta=META):
        if sys.byteorder!="little":
            raise RuntimeError("Native collision pilot requires little-endian float32")
        archive=source.read_bytes()
        metadata=json.loads(meta.read_text())
        if hashlib.sha256(archive).hexdigest()!=metadata["sha256"]:
            raise ValueError("Original source-native collision archive checksum mismatch")
        raw=gzip.decompress(archive)
        magic,nv,nt=struct.unpack_from("<4sII",raw,0)
        if magic!=b"OCN2" or len(raw)!=12+12*nv+14*nt:
            raise ValueError("Native collision pilot input is not complete OCN2")
        if (nv,nt)!=(metadata["vertices"],metadata["triangles"]):
            raise ValueError("Original native collision counts do not match manifest")
        # Stage 2.0 architecture remains strictly pinned to slot-1
        # omission. Stage 2.2 may inspect its separately verified
        # island-only candidate that retains source floor/wall slot 1.
        stage22=metadata.get("collisionScope")=="island-interior-candidate"
        if stage22:
            if (metadata.get("sourceRevision")!=829 or
                    metadata.get("nativeAuthoritativeCollisionReady") is not False or
                    metadata.get("status")!="staging-only-not-live"):
                raise ValueError("Interior source candidate is not verified staging-only")
        elif metadata.get("excludedMaterial")!=1:
            raise ValueError("Native pilot requires known explicit source slot-1 omission")
        self.meta=metadata
        self.source_archive_sha256=metadata["sha256"]
        self.vertices=nv
        self.count=nt
        vertices=list(struct.iter_unpack("<III",raw[12:12+nv*12]))
        pos=bytearray(nt*9*4)
        slots=bytearray(nt)
        bounds=array("f")
        grid=defaultdict(lambda:array("I"))
        oversized=array("I")
        origin=12+nv*12
        surface_counter=Counter()
        for i in range(nt):
            a,b,c,slot=struct.unpack_from("<IIIH",raw,origin+14*i)
            if a>=nv or b>=nv or c>=nv or slot>255:
                raise ValueError("Native collision contains an invalid indexed triangle")
            xyz=native_point(vertices[a])+native_point(vertices[b])+native_point(vertices[c])
            struct.pack_into("<9f",pos,i*36,*xyz)
            slots[i]=slot
            surface_counter[slot]+=1
            minx,maxx=min(xyz[0::3]),max(xyz[0::3])
            miny,maxy=min(xyz[1::3]),max(xyz[1::3])
            minz,maxz=min(xyz[2::3]),max(xyz[2::3])
            bounds.extend((minx,maxx,miny,maxy,minz,maxz))
            x0,x1=math.floor(minx/CELL),math.floor(maxx/CELL)
            z0,z1=math.floor(minz/CELL),math.floor(maxz/CELL)
            if (x1-x0+1)*(z1-z0+1)>MAX_CELLS_PER_TRI:
                oversized.append(i)
            else:
                for gx in range(x0,x1+1):
                    for gz in range(z0,z1+1):
                        grid[gx,gz].append(i)
        self.triangle_float_bytes=bytes(pos)
        self.float_sha256=hashlib.sha256(pos).hexdigest()
        self.points=memoryview(self.triangle_float_bytes).cast("f")
        self.slots=slots
        self.bounds=bounds
        self.grid=dict(grid)
        self.oversized=oversized
        self.surface_counter=surface_counter
        self.cell_count=len(grid)
        self.candidate_references=sum(len(v) for v in grid.values())

    def triangle(self,index):
        p=self.points;k=index*9
        return ((p[k],p[k+1],p[k+2]),
                (p[k+3],p[k+4],p[k+5]),
                (p[k+6],p[k+7],p[k+8]))

    def candidates(self,x0,z0,x1,z1,y0=-float("inf"),y1=float("inf")):
        found=set()
        for gx in range(math.floor(x0/CELL),math.floor(x1/CELL)+1):
            for gz in range(math.floor(z0/CELL),math.floor(z1/CELL)+1):
                found.update(self.grid.get((gx,gz),()))
        found.update(self.oversized)
        boxes=self.bounds
        for tri in sorted(found):
            k=6*tri
            if (boxes[k]>x1 or boxes[k+1]<x0 or
                boxes[k+2]>y1 or boxes[k+3]<y0 or
                boxes[k+4]>z1 or boxes[k+5]<z0):
                continue
            yield tri

    def floor_at(self,x,y,z,down=2.0,up=.5):
        """Two-sided vertical triangle probe, excludes steep non-walkable faces."""
        result=None
        checked=0
        for t in self.candidates(x,z,x,z,y-down,y+up):
            a,b,c=self.triangle(t)
            checked+=1
            den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
            if abs(den)<1e-8:continue
            u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den
            v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den
            if u<-.00001 or v<-.00001 or u+v>1.00001:continue
            height=u*a[1]+v*b[1]+(1-u-v)*c[1]
            if not y-down-.001<=height<=y+up+.001:continue
            normal=((b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),
                    (b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),
                    (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))
            nlength=math.sqrt(sum(v*v for v in normal))
            slope=abs(normal[1])/nlength if nlength>1e-9 else 0
            if slope<.67:continue
            # Prefer exact authored spawn footing, not a different upper deck
            # or a lower platform hidden beneath this player start.
            delta=height-y
            if result is None or abs(delta)<abs(result["groundDelta"]):
                result={"triangle":t,"ground":height,
                        "groundDelta":delta,"slopeCos":round(slope,5),
                        "material":self.slots[t]}
        return result,checked

    def capsule_clear(self,x,y,z,radius=RADIUS,height=HEIGHT):
        """Source-core conservative capsule preflight, not a motion solver."""
        centers=[(x,y+radius+(height-2*radius)*n/5,z) for n in range(6)]
        checked=0
        for t in self.candidates(x-radius,z-radius,x+radius,z+radius,
                                 y-.05,y+height+.05):
            tri=self.triangle(t)
            checked+=1
            for p in centers:
                q=closest_on_triangle(p,*tri)
                if sum((p[k]-q[k])**2 for k in range(3))<(radius-.012)**2:
                    return False,checked,t
        return True,checked,None

    def audit_spawns(self,entities=ENTITIES):
        manifest=json.loads(entities.read_text())
        entries=manifest["playerStarts"]
        if len(entries)!=33 or manifest["revision"]!=829:
            raise ValueError("Original Octavus native player starts changed")
        stats=Counter()
        rows=[]
        for entity in entries:
            native=entity["sourcePosition"]
            xyz=((native[0]-4096)*SOURCE_SCALE,
                 (native[2]-2816)*SOURCE_SCALE,
                 (native[1]-4096)*SOURCE_SCALE)
            x,y,z=xyz
            floor,tested=self.floor_at(x,y,z)
            clear,checked,blocked=self.capsule_clear(x,y,z)
            supported=bool(floor and -.17<=floor["groundDelta"]<=.20)
            if floor:stats["walkableFloorWithin2m"]+=1
            if supported:stats["supportedAtOriginalHeight"]+=1
            if clear:stats["capsuleClear"]+=1
            if clear and supported:stats["potentiallyUsable"]+=1
            item={
                "entityID":entity["id"],
                "sourcePosition":native,
                "worldPosition":[round(v,4) for v in xyz],
                "groundDelta":round(floor["groundDelta"],4) if floor else None,
                "floorMaterial":floor["material"] if floor else None,
                "hasNearbyWalkableFloor":floor is not None,
                "supportedAtOriginalHeight":supported,
                "capsuleClear":clear,
                "potentiallyUsable":bool(clear and supported),
                "blockingTriangle":blocked,
                "floorCandidatesChecked":tested,
                "capsuleCandidatesChecked":checked,
                "sourceGeometryIncomplete":True,
            }
            rows.append(item)
        return rows,dict(stats)


def preflight():
    world=NativeCollisionPilot91()
    rows,stats=world.audit_spawns()
    result={
        "format":"OCTAVUS-NATIVE-COLLISION-PILOT91",
        "status":"staging-only-not-live",
        "sourceRevision":829,
        "sourceFormat":"OCN2",
        "sourceSHA256":world.source_archive_sha256,
        "nativeVertices":world.vertices,
        "collisionTriangles":world.count,
        "excludedNativeMaterialSlot":1,
        "sourceCoreHasRendererParity":False,
        "worldAxis":"(native X,Z,Y) -> Three (X,Y,Z), native units scaled 0.05",
        "coordinateScale":SOURCE_SCALE,
        "nativeWorldCenter":[4096,4096,2816],
        "float32TriangleSoupSHA256":world.float_sha256,
        "float32ByteLength":len(world.triangle_float_bytes),
        "playerCapsuleRadius":RADIUS,
        "playerCapsuleHeight":HEIGHT,
        "sourceSpawnCount":len(rows),
        "spawnPreflightCounts":stats,
        "sourceSpawns":rows,
        "indexMetrics":{
            "cellSize":CELL,"gridCells":world.cell_count,
            "indexedReferences":world.candidate_references,
            "oversizedTriangles":len(world.oversized),
        },
        "collisionCandidateHasOriginalSlot1Floor":False,
        "clientServerParityVerified":False,
        "gameplayMotionParityVerified":False,
        "liveMapModified":False,
        "limitations":[
            "Original 98,358-triangle architectural core excludes slot 1 and could leave legitimate source floors and walls missing.",
            "Closest point capsule preflight is not full continuous collision or live controller movement.",
            "Original source 33 starts have different native positions from the active old OBJ spawns.",
            "This pilot must never replace server/client physics without support and movement parity validation.",
        ]
    }
    REPORT.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:v for k,v in result.items()
                      if k not in ("sourceSpawns","limitations")},indent=2))
    print("Unusable prototype starts:",
          [(x["entityID"],x["groundDelta"],x["capsuleClear"])
           for x in rows if not x["potentiallyUsable"]])
    return result

if __name__=="__main__":
    preflight()
