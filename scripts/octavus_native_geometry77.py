"""Octavus Phase 1.2: source-native octree -> conservative visible-world staging mesh.

RE2 source attribution: CC BY-SA 3.0; source revision 829.
Decode details: redeclipse/base src/engine/worldio.cpp, octa.h, octarender.cpp.

IMPORTANT: This source-geometry prototype culls fully buried faces and restores
explicit/merged polygons but is *not yet renderer-equivalent*: partial-face
occlusion, render merges, blend layers, UVs and original PVS are future checks.
Output is deliberately staging-only, never loaded by the live arena.

Run: python scripts/octavus_native_geometry77.py
Produces:
  static/maps/octavus.native-stage1.bin.gz
  static/maps/octavus.native-stage1.json

Binary format (little endian, gzip, magic OCN2):
  4sII    magic, unique vertex count, triangle count
  per vertex: III   native X/Y/Z in EIGHTHS of an engine world unit
  per triangle: IIIH vertex indices (native axis order), source texture VSlot
This deliberately retains 1/8-unit native coordinates without lossy floats.
"""
from __future__ import annotations
from array import array
from collections import Counter
from dataclasses import dataclass
import gzip
import hashlib
import io
import json
from pathlib import Path
import struct
from time import perf_counter

from scripts.decode_octavus_octree76 import (
    Cursor, FormatError, ROOT, SOURCE, SOURCE_INFO, ENTITY_INFO,
    skip_vslots, OCT_CHILDREN, OCT_EMPTY, OCT_SOLID, OCT_NORMAL
)

OUT = ROOT / "static/maps/octavus.native-stage1.bin.gz"
MANIFEST = ROOT / "static/maps/octavus.native-stage1.json"
WORLD_SIZE = 8192
SCALE = 8  # face and native polygon coordinates in 1/8 native unit
# Cube vertex order and edge nibble addressing from src/engine/octa.h
CORNERS = (
    (1,1,0), (0,1,0), (0,1,1), (1,1,1),
    (1,0,1), (0,0,1), (0,0,0), (1,0,0)
)
# fv[6][4] in src/engine/octa.cpp and src/engine/octa.h
FACES = ((2,1,6,5), (3,4,7,0), (4,5,6,7),
         (1,2,3,0), (6,1,0,7), (5,4,3,2))
ROW = (1,2,0)
COL = (2,0,1)
MAX_TRIS = 1_800_000

@dataclass(slots=True)
class Face:
    info: int
    flag: int
    verts: tuple[tuple[int,int,int], ...]  # global native eighths


@dataclass(slots=True)
class Cube:
    origin: tuple[int,int,int]
    size: int
    kind: int
    edges: bytes
    textures: tuple[int,int,int,int,int,int] | tuple
    material: int
    merged: int
    faces: dict[int,Face] | None
    children: tuple[Cube, ...] | None


def cube_corner(cube: Cube, corner: int):
    """Original genfaceverts cubeedge(c, axis, row, col) nibble rule."""
    x, y, z = CORNERS[corner]
    e = cube.edges
    vx = ((e[(y<<1)|z] >> (4 if x else 0)) & 0xF)
    vy = ((e[4+(z<<1)+x] >> (4 if y else 0)) & 0xF)
    vz = ((e[8+(x<<1)+y] >> (4 if z else 0)) & 0xF)
    return (vx,vy,vz)


def implicit_polygon(cube: Cube, orientation: int):
    o = cube.origin
    size = cube.size
    return tuple(
        tuple(o[k]*SCALE + p[k]*size for k in range(3))
        for corner in FACES[orientation]
        for p in (cube_corner(cube,corner),)
    )


def geometry_plane(cube: Cube, orientation: int):
    """Construct geometric face's plane in local eighth-native coordinates."""
    v = [cube_corner(cube,corner) for corner in FACES[orientation]]
    a = tuple((v[1][k]-v[0][k])*cube.size for k in range(3))
    b = tuple((v[2][k]-v[0][k])*cube.size for k in range(3))
    n = cross(a,b)
    if n == (0,0,0):
        b = tuple((v[3][k]-v[0][k])*cube.size for k in range(3))
        n = cross(a,b)
    origin_in_block = tuple((cube.origin[k] & 0xFFF)*SCALE for k in range(3))
    point = tuple(v[0][k]*cube.size + origin_in_block[k] for k in range(3))
    return n, -sum(n[k]*point[k] for k in range(3))


def cross(a,b):
    return (a[1]*b[2]-a[2]*b[1],
            a[2]*b[0]-a[0]*b[2],
            a[0]*b[1]-a[1]*b[0])


def read_face(r:Cursor, cube:Cube, orientation:int, totalverts:int):
    # Original loadc in src/engine/worldio.cpp for MAPZ>=44.
    flag = r.byte()
    info = r.byte()
    count = info & 15
    if not count:
        return Face(info,flag,())
    if count < 3 or count > totalverts:
        raise FormatError("Native surface vertex count invalid")
    normal, bias = geometry_plane(cube, orientation)
    dim = orientation//2
    vc, vr = COL[dim],ROW[dim]
    local_base = tuple((cube.origin[k] & 0xFFF)*SCALE for k in range(3))
    outer_base = tuple((cube.origin[k] & ~0xFFF)*SCALE for k in range(3))
    intrinsic = implicit_polygon(cube, orientation)
    hasxyz = bool(flag&4)
    hasnrm = bool(flag&128)
    verts = []
    if hasxyz and count == 4 and flag&1:
        c1,r1,c2,r2 = (r.u16(),r.u16(),r.u16(),r.u16())
        pairs=((c1,r1),(c1,r2),(c2,r2),(c2,r1))
        for u,v in pairs:
            xyz=[0,0,0]
            xyz[vc],xyz[vr]=u,v
            xyz[dim] = (
                int(-(bias + normal[vc]*xyz[vc]+normal[vr]*xyz[vr])
                    / normal[dim])
                if normal[dim] else local_base[dim]
            )
            verts.append(tuple(xyz[k]+outer_base[k] for k in range(3)))
        hasxyz = False
    if hasnrm and flag&8:
        r.skip(2)
        hasnrm=False
    if hasxyz or hasnrm:
        for _ in range(count):
            if hasxyz:
                u,v=r.u16(),r.u16()
                xyz=[0,0,0]
                xyz[vc],xyz[vr]=u,v
                xyz[dim] = (
                    int(-(bias+normal[vc]*xyz[vc]+normal[vr]*xyz[vr])
                        / normal[dim])
                    if normal[dim] else local_base[dim]
                )
                verts.append(tuple(xyz[k]+outer_base[k] for k in range(3)))
            if hasnrm:
                r.skip(2)
    if not hasxyz and not verts:
        # "verts" omitted in native storage; reconstruct the authored
        # source triangle/quad using flag1/flag2 orientation and winding.
        base = implicit_polygon(cube,orientation)
        order = 1 if flag&1 else 0
        local_vis = (2 if flag&2 else 1) if count < 4 else 3
        idx=[order]
        if local_vis&1:idx.append((order+1)&3)
        idx.append((order+2)&3)
        if local_vis&2:idx.append((order+3)&3)
        verts=[base[k] for k in idx]
    if len(verts)!=count:
        raise FormatError("Decoded polygon vertex count differs from source")
    for pos in verts:
        if any(not 0 <= pos[k] <= WORLD_SIZE*8 for k in range(3)):
            raise FormatError("Out-of-world native polygon vertex")
    return Face(info,flag,tuple(verts))


def read_tree(r:Cursor, size=WORLD_SIZE//2):
    metrics=Counter()
    def rec(origin, side, depth):
        if depth>13 or side<1:
            raise FormatError("Invalid native cube subdivision")
        out=[]
        for child in range(8):
            co=tuple(origin[k]+side*((child>>k)&1) for k in range(3))
            flag=r.byte()
            kind=flag&7
            if kind==OCT_CHILDREN:
                if side==1:raise FormatError("Nested unit cube")
                subs=rec(co,side//2,depth+1)
                out.append(Cube(co,side,kind,b"",(),0,0,None,subs))
                metrics["branches"]+=1
                continue
            if kind not in (OCT_EMPTY,OCT_SOLID,OCT_NORMAL):
                raise FormatError(f"Unexpected native cube kind {kind}")
            edges=(bytes(12) if kind==OCT_EMPTY
                   else bytes([0x80])*12 if kind==OCT_SOLID
                   else bytes(r.read(12)))
            textures=r.unpack("6H")
            material=r.u16() if flag&0x40 else 0
            merged=r.byte() if flag&0x80 else 0
            c=Cube(co,side,kind,edges,textures,material,merged,None,None)
            if flag&0x20:
                mask,total=r.byte(),r.byte()
                faces={}
                occupied=0
                for orient in range(6):
                    if mask&(1<<orient):
                        surf=read_face(r,c,orient,total)
                        occupied+=len(surf.verts)
                        faces[orient]=surf
                if occupied>total:
                    raise FormatError("Native face vertex payload overflow")
                c.faces=faces
                metrics["explicitPolygons"]+=sum(bool(f.verts) for f in faces.values())
            metrics["leaves"]+=1
            metrics["solid"]+=kind==OCT_SOLID
            metrics["deformed"]+=kind==OCT_NORMAL
            metrics["empty"]+=kind==OCT_EMPTY
            out.append(c)
        return tuple(out)
    return rec((0,0,0),size,0),metrics


class NativeWorld:
    def __init__(self,roots):
        self.roots=roots

    def locate(self,xyz):
        if any(coord<0 or coord>=WORLD_SIZE for coord in xyz):
            return None
        size=WORLD_SIZE//2
        node=self.roots[
            ((xyz[0]>=size)<<0)|
            ((xyz[1]>=size)<<1)|
            ((xyz[2]>=size)<<2)
        ]
        while node.children:
            half=node.size//2
            o=node.origin
            index=((xyz[0]>=o[0]+half)<<0)|((xyz[1]>=o[1]+half)<<1)|((xyz[2]>=o[2]+half)<<2)
            node=node.children[index]
        return node


def triangle_area_sq(a,b,c):
    u=tuple(b[k]-a[k] for k in range(3))
    v=tuple(c[k]-a[k] for k in range(3))
    n=cross(u,v)
    return sum(z*z for z in n)


def nondegenerate(poly):
    return len(poly)>=3 and any(
        triangle_area_sq(poly[0],poly[i],poly[i+1])>0
        for i in range(1,len(poly)-1)
    )


def visible_polygon(world, cube, orient, poly):
    """Conservatively remove faces fully covered by *solid* neighbors.

    Native visibletris also tests partial deformed-face occlusion. This
    prototype never culls against a partially filled neighbor (so it
    cannot inadvertently punch missing holes); exact parity remains a
    required gate before switching live geometry.
    """
    axis=orient//2
    far=bool(orient&1)
    boundary=(cube.origin[axis]+(cube.size if far else 0))*SCALE
    # A deformed face recessed into a cube cannot be hidden by the
    # external neighbor. Keep it regardless of adjacent solid leaves.
    if any(v[axis] != boundary for v in poly):
        return True
    # For each native triangle, probe the adjoining cell. Only a solid
    # neighbor at every probe point can completely bury this face.
    for i in range(1,len(poly)-1):
        tri=(poly[0],poly[i],poly[i+1])
        probe=[sum(v[k] for v in tri)/(3*SCALE) for k in range(3)]
        probe[axis] += (1/32 if far else -1/32)
        neighbor=world.locate(probe)
        if neighbor is None or neighbor.kind != OCT_SOLID:
            return True
    return False


class Builder:
    def __init__(self):
        self.vertices=[]
        self.indices=[]
        self.vlookup={}
        self.materials=Counter()
        self.faces=Counter()
        self.bounds_min=[WORLD_SIZE*8]*3
        self.bounds_max=[0]*3
        self.warnings=Counter()

    def add(self,poly,slot,label):
        if not nondegenerate(poly):
            self.warnings["degenerateFaces"]+=1
            return
        ids=[]
        for v in poly:
            idx=self.vlookup.get(v)
            if idx is None:
                idx=len(self.vertices)
                self.vlookup[v]=idx
                self.vertices.append(v)
                for k in range(3):
                    self.bounds_min[k]=min(self.bounds_min[k],v[k])
                    self.bounds_max[k]=max(self.bounds_max[k],v[k])
            ids.append(idx)
        # Convex native quadrilateral polygons usually fan-triangulate;
        # n>4 complex merged source polygons need a dedicated exact
        # concavity check against the engine before Phase 1.3.
        for i in range(1,len(ids)-1):
            if triangle_area_sq(poly[0],poly[i],poly[i+1])==0:
                self.warnings["degenerateTriangles"]+=1
                continue
            self.indices.append((ids[0],ids[i],ids[i+1],slot))
            self.materials[slot]+=1
            if len(self.indices)>MAX_TRIS:
                raise FormatError("Native staging mesh exceeds safety triangle cap")
        self.faces[label]+=1


def build_geometry(world):
    m=Builder()
    def visit(subs):
        for c in subs:
            if c.children:
                visit(c.children)
                continue
            if c.kind==OCT_EMPTY:continue
            for orient in range(6):
                surface=c.faces.get(orient) if c.faces else None
                # Faces flagged as merged are geometrically emitted only
                # from their explicit origin polygons, not every merged part.
                if c.merged&(1<<orient) and not surface:
                    m.faces["suppressedMergedParts"]+=1
                    continue
                poly=surface.verts if surface and surface.verts else implicit_polygon(c,orient)
                if not nondegenerate(poly):
                    m.warnings["collapsedFaces"]+=1
                    continue
                if not visible_polygon(world,c,orient,poly):
                    m.faces["occludedBySolidNeighbor"]+=1
                    continue
                label=("explicitMerged" if surface and c.merged&(1<<orient)
                       else "explicit" if surface else "implicit")
                m.add(poly,c.textures[orient],label)
    visit(world.roots)
    return m


def pack_mesh(geometry:Builder):
    # Max 1.8m triangles and <1.8m unique vertices => 4-byte indices.
    out=io.BytesIO()
    out.write(struct.pack("<4sII",b"OCN2",len(geometry.vertices),len(geometry.indices)))
    for xyz in geometry.vertices:
        out.write(struct.pack("<III",*xyz))
    for a,b,c,slot in geometry.indices:
        out.write(struct.pack("<IIIH",a,b,c,slot))
    return out.getvalue()


def source_tree():
    compressed=SOURCE.read_bytes()
    manifest=json.loads(SOURCE_INFO.read_text())
    if hashlib.sha256(compressed).hexdigest()!=manifest["rawSha256"]:
        raise FormatError("Source Octavus SHA mismatch")
    data=gzip.decompress(compressed)
    if len(data)!=manifest["unpackedBytes"]:
        raise FormatError("Source Octavus unpacked size mismatch")
    info=json.loads(ENTITY_INFO.read_text())["header"]
    r=Cursor(data,info["nextSectionOffset"])
    vslots=skip_vslots(r,info["numVSlots"])
    if r.pos!=107595:raise FormatError("Native VSlot end offset mismatch")
    roots,counts=read_tree(r)
    if r.pos!=12982777 or counts["leaves"]!=704159:
        raise FormatError("Source-native tree count or end offset mismatch")
    if counts["explicitPolygons"]!=49794:
        raise FormatError("Source-native explicit polygon count mismatch")
    return NativeWorld(roots),counts


def export():
    t=perf_counter()
    world,counts=source_tree()
    parse_seconds=round(perf_counter()-t,2)
    t=perf_counter()
    geometry=build_geometry(world)
    build_seconds=round(perf_counter()-t,2)
    raw=pack_mesh(geometry)
    gzip_bytes=gzip.compress(raw,compresslevel=6,mtime=0)
    if len(raw)>128*1024*1024:
        raise FormatError("Staging geometry exceeds safe raw asset limit")
    OUT.write_bytes(gzip_bytes)
    report={
        "format":"OCN2",
        "status":"staging-only-not-live",
        "sourceRevision":829,
        "nativeSourceHash":hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "nativeWorldScale":0.05,
        "coordinateSpace":"source native XYZ, eighths of world unit; game Y is native Z",
        "vertices":len(geometry.vertices),
        "triangles":len(geometry.indices),
        "nativeBoundsEighths":{"min":geometry.bounds_min,"max":geometry.bounds_max},
        "sourceTextureSlots":len(geometry.materials),
        "largestTextureSlots":geometry.materials.most_common(25),
        "surfaceCounts":dict(geometry.faces),
        "warnings":dict(geometry.warnings),
        "sourceLeaves":counts["leaves"],
        "sourceExplicitPolygons":counts["explicitPolygons"],
        "sourceStoredBytes":12982777-107595,
        "stagingRawBytes":len(raw),
        "stagingGzipBytes":len(gzip_bytes),
        "stagingSHA256":hashlib.sha256(gzip_bytes).hexdigest(),
        "authoritativeNativeSurfaceData":True,
        "exactRendererParity":False,
        "knownGaps":[
            "Partial occlusion against deformed neighbor surfaces is conservative.",
            "Native polygon merging and layer blending are not renderer-exact.",
            "UV generation, texture reconciliation, scene preview are pending.",
            "Staging mesh is not used by current server or clients."
        ],
        # Wall-clock durations are intentionally omitted from the JSON:
        # generated manifests must be byte-identical across CI reruns.
        "liveMapModified":False
    }
    MANIFEST.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
    print(f"Native geometry parse={parse_seconds}s, geometry build={build_seconds}s")
    return report


if __name__=="__main__":
    export()
