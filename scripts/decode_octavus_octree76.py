"""Phase 1 / Stage 1.1: strictly decode Red Eclipse 2 Octavus native MAPZ octree.

Source of truth: sources/octavus.original.mpz (CC BY-SA 3.0).
Binary format transcribed from redeclipse/base src/engine/worldio.cpp:
  loadvslots(), loadvslot(), loadchildren(), loadc() (MAPZ v59).
This is a *structural* decoder, NOT yet a playable/visible exported mesh:
visibletris(), face merging, native render textures and hidden face culling
must be reproduced before replacing the older live OBJ geometry.

Run: python scripts/decode_octavus_octree76.py
Result: static/maps/octavus.native-octree-report.json (deterministic).
"""
from __future__ import annotations

import gzip
import hashlib
import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "sources/octavus.original.mpz"
SOURCE_INFO = ROOT / "sources/octavus.original.json"
ENTITY_INFO = ROOT / "sources/octavus.native-variables.json"
REPORT = ROOT / "static/maps/octavus.native-octree-report.json"
OCT_CHILDREN, OCT_EMPTY, OCT_SOLID, OCT_NORMAL = range(4)
# Red Eclipse 2 src/engine/texture.h, GRASSHEADS=3, VSLOT_NUM=79
VSLOT_NUM = 79
MAX_LEAVES = 2_000_000

class FormatError(ValueError):
    pass

class Cursor:
    def __init__(self, data: bytes, position=0):
        self.view = memoryview(data)
        self.pos = position

    def read(self, n):
        if n < 0 or self.pos + n > len(self.view):
            raise FormatError(f"MAPZ truncated at offset {self.pos} reading {n} bytes")
        result = self.view[self.pos:self.pos+n]
        self.pos += n
        return result

    def unpack(self, fmt):
        size = struct.calcsize("<"+fmt)
        return struct.unpack("<"+fmt, self.read(size))

    def byte(self):
        return self.unpack("B")[0]

    def u16(self):
        return self.unpack("H")[0]

    def i32(self):
        return self.unpack("i")[0]

    def u64(self):
        return self.unpack("Q")[0]

    def skip(self, n):
        self.read(n)


def skip_vslot(r, mask):
    """Consume exactly the changed fields from native loadvslot(v59)."""
    if mask >> VSLOT_NUM:
        raise FormatError(f"Unexpected vslot change mask bits: 0x{mask:x}")
    for bit in range(VSLOT_NUM):
        if not mask & (1 << bit):
            continue
        if bit == 0:
            flags = r.u16()
            count = flags & 0x7FFF
            if count > 2000:
                raise FormatError("Excessive VSlot shader parameter count")
            for _ in range(count):
                length = r.u16()
                r.skip(length)
                r.skip(16)  # four float shader values
                if flags & 0x8000:
                    r.skip(8)  # palette + index
        elif bit in (1, 9, 13, 18, 19, 20, 22, 23, 25, 27, 29, 30,
                     31, 33, 34, 69, 70, 71, 72):
            r.skip(4)  # float
        elif bit in (3, 4, 6, 8):
            r.skip(8)  # 2x int, 2x float, 2x float, 2x int
        elif bit in (7, 12):
            r.skip(12)  # 3x float
        elif bit == 10:
            r.skip(16)  # float refract scale + colour
        elif 41 <= bit <= 61:
            r.skip(4)  # grass head float attributes
        else:
            r.skip(4)  # integer; all other grass and texture flags


def skip_vslots(r: Cursor, count: int):
    if not 0 <= count <= 65536:
        raise FormatError("Unreasonable MAPZ VSlot count")
    begun = r.pos
    processed = 0
    variations = 0
    while processed < count:
        control = r.i32()
        if control < 0:
            processed += -control
            if processed > count:
                raise FormatError("VSlot unchanged run exceeds header count")
            continue
        low = r.u64()
        high = r.u64()
        parent = r.i32()
        if parent < -1 or parent >= count:
            raise FormatError("VSlot parent out of range")
        skip_vslot(r, low | high << 64)
        variations += 1
        processed += 1
    return {"count": processed, "variations": variations,
            "bytes": r.pos - begun, "endOffset": r.pos}


@dataclass
class OctreeMetrics:
    leaves: int = 0
    branches: int = 0
    empty: int = 0
    solid: int = 0
    deformed: int = 0
    explicit_faces: int = 0
    explicit_vertices: int = 0
    merged_faces: int = 0
    materialized: int = 0
    max_depth: int = 0
    leaf_bounds: dict | None = None

    def __post_init__(self):
        self.kind_counts = Counter()
        self.texture_faces = Counter()
        self.explicit_texture_faces = Counter()
        self.size_histogram = Counter()
        self.materials = Counter()
        self.bound_min = [8192, 8192, 8192]
        self.bound_max = [0, 0, 0]


def parse_surface(r, surfid, total_limit):
    """Decode written surface polygon flags from savec()/loadc() v59.

    surfaceinfo contains (uchar verts, uchar numverts); explicit XYZ are
    stored in local 1/8 unit offsets. Preserve their encoded data for next
    stage; never guess edges or invent faces.
    """
    flags = r.byte()
    numverts = r.byte()
    n = numverts & 0x0F
    if n == 0:
        return 0, 0
    if n < 3:
        raise FormatError("Non-polygon source face has 1 or 2 vertices")
    hasxyz = bool(flags & 0x04)
    hasnrm = bool(flags & 0x80)
    if n == 4 and hasxyz and flags & 1:
        r.skip(8)  # rectangular merged polygon XY bounds
        hasxyz = False
    if hasnrm and flags & 8:
        r.skip(2)  # shared surface normal
        hasnrm = False
    if hasxyz or hasnrm:
        r.skip(n * (4 * hasxyz + 2 * hasnrm))
    return 1, n


def parse_octree(r: Cursor, worldsize=8192):
    """Read all 8 roots and descendants, retaining exact source statistics."""
    m = OctreeMetrics()
    start = r.pos

    def children(origin, size, depth):
        if depth > 18 or size < 1:
            raise FormatError("Invalid MAPZ octree subdivision depth")
        m.max_depth = max(depth, m.max_depth)
        for i in range(8):
            xyz = tuple(origin[k] + ((i >> k) & 1) * size for k in range(3))
            flag = r.byte()
            kind = flag & 7
            if kind == OCT_CHILDREN:
                if size <= 1:
                    raise FormatError("Unit-sized MAPZ leaf subdivided")
                m.branches += 1
                children(xyz, size >> 1, depth + 1)
                continue
            if kind not in (OCT_EMPTY, OCT_SOLID, OCT_NORMAL):
                raise FormatError(f"Invalid MAPZ octree kind {kind}")
            m.leaves += 1
            if m.leaves > MAX_LEAVES:
                raise FormatError("Octree leaf resource limit exceeded")
            if kind == OCT_NORMAL:
                m.deformed += 1
                r.skip(12)  # Cube2 12 edge bytes
            elif kind == OCT_SOLID:
                m.solid += 1
            else:
                m.empty += 1
            m.size_histogram[size] += 1
            textures = [r.u16() for _ in range(6)]
            for slot in textures:
                m.texture_faces[slot] += 1
            if kind != OCT_EMPTY:
                for k in range(3):
                    m.bound_min[k] = min(m.bound_min[k], xyz[k])
                    m.bound_max[k] = max(m.bound_max[k], xyz[k] + size)
            if flag & 0x40:
                material = r.u16()
                m.materials[material] += 1
                m.materialized += 1
            merged = r.byte() if flag & 0x80 else 0
            if flag & 0x20:
                surfmask = r.byte()
                totalverts = r.byte()
                m.merged_faces += merged.bit_count()
                vertexcount = 0
                for face in range(6):
                    if surfmask & (1 << face):
                        polygons, vertices = parse_surface(r, face, totalverts)
                        vertexcount += vertices
                        m.explicit_faces += polygons
                        m.explicit_vertices += vertices
                        if polygons:
                            m.explicit_texture_faces[textures[face]] += 1
                if vertexcount > totalverts:
                    raise FormatError("Face vertices overrun cube's totalverts")
    children((0, 0, 0), worldsize // 2, 0)
    return {
        "startOffset": start,
        "endOffset": r.pos,
        "storedBytes": r.pos-start,
        "branches": m.branches, "leaves": m.leaves,
        "empty": m.empty, "solid": m.solid, "deformed": m.deformed,
        "maxDepth": m.max_depth,
        "explicitFaces": m.explicit_faces,
        "explicitVertices": m.explicit_vertices,
        "mergedFaces": m.merged_faces,
        "materializedLeaves": m.materialized,
        "solidBoundsNative": {"min": m.bound_min, "max": m.bound_max},
        "leafSizeHistogram": {str(k):v for k,v in sorted(m.size_histogram.items())},
        "textureSlots": len(m.texture_faces),
        "mostReferencedTextures": m.texture_faces.most_common(25),
        "explicitFaceTextureSlots": len(m.explicit_texture_faces),
        "explicitFaceTopTextures": m.explicit_texture_faces.most_common(25),
        "volumeMaterials": m.materials.most_common(),
        "warning": "Stored octree, not a visible surface mesh. Adjacent hidden faces and merged faces still need renderer-accurate reconstruction."
    }


def decode_octavus():
    compressed = SOURCE.read_bytes()
    expected = json.loads(SOURCE_INFO.read_text())
    if len(compressed) != expected["compressedBytes"]:
        raise FormatError("Unexpected native map compressed size")
    # fetch_octavus_native.py stores the SHA-256 of the *compressed* MPZ
    # under rawSha256. Confirm the exact archived bytes before inflation.
    if hashlib.sha256(compressed).hexdigest() != expected["rawSha256"]:
        raise FormatError("Native MAPZ compressed-source checksum mismatch")
    expanded = gzip.decompress(compressed)
    if len(expanded) != expected["unpackedBytes"]:
        raise FormatError("Native MAPZ uncompressed size mismatch")
    metadata = json.loads(ENTITY_INFO.read_text())["header"]
    version, worldsize, nslots = (metadata["version"],
                                  metadata["worldSize"],
                                  metadata["numVSlots"])
    if version != 59 or worldsize != 8192:
        raise FormatError("Unsupported native Octavus map revision")
    offset = metadata["nextSectionOffset"]
    if not 44 <= offset < len(expanded):
        raise FormatError("Invalid native entity section boundary")
    r = Cursor(expanded, offset)
    vslots = skip_vslots(r, nslots)
    tree = parse_octree(r, worldsize)
    if tree["leaves"] < 500 or tree["deformed"] < 100:
        raise FormatError("Native octree unexpectedly empty")
    return {
        "format": "OCTAVUS-NATIVE-OCTREE76",
        "source": "sources/octavus.original.mpz",
        "sourceRevision": metadata["revision"],
        "sourceSHA256": expected["rawSha256"],
        "worldSize": worldsize,
        "vslots": vslots, "octree": tree,
        "bytesAfterOctree": len(expanded)-r.pos,
        "sourceEngine": "redeclipse/base src/engine/worldio.cpp MAPZ v59",
        "integration": "offline-audit-only",
        "liveMapModified": False,
    }


def main():
    result = decode_octavus()
    REPORT.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({
        "status": "decoded",
        "revision": result["sourceRevision"],
        "vslots": result["vslots"],
        "octreeLeaves": result["octree"]["leaves"],
        "explicitFaces": result["octree"]["explicitFaces"],
        "storedBytes": result["octree"]["storedBytes"],
        "bytesAfterOctree": result["bytesAfterOctree"],
    }, indent=2))


if __name__ == "__main__":
    main()
