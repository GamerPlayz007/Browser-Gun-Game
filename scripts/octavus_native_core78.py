"""Octavus Phase 1.2 staging visual core: isolate architecture from source plain fill.

The original (revision 829) map's material slot 1 is mikeplus64/plain.png.
A conservative initial octree triangulation yields >1.5 million slot-1
triangles, though the older engine-exported visible OBJ has only hundreds.
Drawing that raw slot-1 geometry would bury intended architecture in
incorrectly exposed internal walls. We preserve the full OCN2 archive,
but strip this *single* ambiguous source material from the isolated
stage-only browser-preview candidate, pending engine-exact visibility.
The source file and all its faces remain available for reconstruction.

Run: python -m scripts.octavus_native_core78
Outputs: static/maps/octavus.native-core.bin.gz & .native-core.json.
Not connected to live gameplay or physics.
"""
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import struct
from scripts.octavus_native_geometry77 import ROOT

IN = ROOT / "static/maps/octavus.native-stage1.bin.gz"
META = ROOT / "static/maps/octavus.native-stage1.json"
OUT = ROOT / "static/maps/octavus.native-core.bin.gz"
REPORT = ROOT / "static/maps/octavus.native-core.json"
SOURCE_PLAIN_SLOT = 1


def build():
    original = json.loads(META.read_text())
    packed = IN.read_bytes()
    if hashlib.sha256(packed).hexdigest() != original["stagingSHA256"]:
        raise ValueError("Original OCN2 staging source hash mismatch")
    raw = gzip.decompress(packed)
    magic,verts,triangles = struct.unpack_from("<4sII",raw)
    if magic != b"OCN2" or len(raw) != 12 + verts*12 + triangles*14:
        raise ValueError("Original OCN2 binary shape mismatch")
    if (verts,triangles) != (original["vertices"],original["triangles"]):
        raise ValueError("Original OCN2 counts don't match metadata")

    mapping = {}
    geom = bytearray()
    faces = bytearray()
    slots = Counter()
    bounds_low = [2**31]*3
    bounds_high = [0]*3
    omitted = 0
    start=12+verts*12
    for i in range(triangles):
        a,b,c,slot=struct.unpack_from("<IIIH",raw,start+i*14)
        if max(a,b,c)>=verts:
            raise ValueError("Native vertex index out of bounds")
        if slot == SOURCE_PLAIN_SLOT:
            omitted += 1
            continue
        refs=[]
        for old in (a,b,c):
            got=mapping.get(old)
            if got is None:
                got=len(mapping)
                mapping[old]=got
                vertex=struct.unpack_from("<III",raw,12+old*12)
                geom.extend(struct.pack("<III",*vertex))
                for k in range(3):
                    bounds_low[k]=min(bounds_low[k],vertex[k])
                    bounds_high[k]=max(bounds_high[k],vertex[k])
            refs.append(got)
        faces.extend(struct.pack("<IIIH",*refs,slot))
        slots[slot]+=1

    nverts=len(mapping)
    ntris=sum(slots.values())
    if ntris+omitted != triangles or ntris<75_000 or nverts<10_000:
        raise ValueError("Native core missing geometry or invalid material counts")
    bytes_raw=struct.pack("<4sII",b"OCN2",nverts,ntris)+geom+faces
    payload=gzip.compress(bytes_raw,compresslevel=8,mtime=0)
    OUT.write_bytes(payload)
    report={
        "format":"OCN2",
        "status":"staging-only-not-live",
        "source":"static/maps/octavus.native-stage1.bin.gz",
        "sourceSHA256":original["stagingSHA256"],
        "nativeOctavusSourceRevision":829,
        "excludedMaterial":SOURCE_PLAIN_SLOT,
        "excludedMaterialReason":"Engine OBJ has few visible slot-1 plain faces; conservative prototype emits 1.56m. Original full mesh retained.",
        "excludedTriangles":omitted,
        "vertices":nverts,
        "triangles":ntris,
        "triangleMaterials":dict(sorted(slots.items())),
        "boundsNativeEighths":{"min":bounds_low,"max":bounds_high},
        "rawBytes":len(bytes_raw),
        "compressedBytes":len(payload),
        "sha256":hashlib.sha256(payload).hexdigest(),
        "originalSourceVerified":True,
        "exactRendererParity":False,
        "liveMapModified":False
    }
    REPORT.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps({k:v for k,v in report.items() if k!="triangleMaterials"},indent=2))
    return report


if __name__=="__main__":
    build()
