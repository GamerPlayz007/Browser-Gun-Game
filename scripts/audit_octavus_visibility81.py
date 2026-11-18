"""Original Octavus MPZ phase1.4: discover where the untrusted plain source
material is located before changing face culling.

Input: independent, SHA-256 verified phase1.2 full native candidate asset.
Output: deterministic metadata, never modifies playable world geometry.
Original Red Eclipse map CC BY-SA 3.0.
"""
from collections import Counter
from pathlib import Path
import gzip
import hashlib
import json
import math
import struct
from scripts.octavus_native_geometry77 import ROOT

MAPS=ROOT/"static/maps"
SOURCE=MAPS/"octavus.native-stage1.bin.gz"
META=MAPS/"octavus.native-stage1.json"
REPORT=MAPS/"octavus.native-visibility-audit81.json"

def audit():
    meta=json.loads(META.read_text())
    compressed=SOURCE.read_bytes()
    if hashlib.sha256(compressed).hexdigest()!=meta["stagingSHA256"]:
        raise ValueError("Native full candidate archive checksum changed")
    raw=gzip.decompress(compressed)
    if raw[:4]!=b"OCN2":raise ValueError("Unsupported native geometry format")
    nv,nt=struct.unpack_from("<II",raw,4)
    if (nv,nt)!=(822787,1661200) or len(raw)!=12+12*nv+14*nt:
        raise ValueError("Full candidate geometry changed unexpectedly")
    vertices=memoryview(raw)[12:12+12*nv]
    tris=memoryview(raw)[12+12*nv:]
    def point(i):
        return struct.unpack_from("<III",vertices,i*12)
    counts=Counter()
    material_dimensions=Counter()
    y_bins=Counter()
    coords=Counter()
    area_by_zone=Counter()
    boundary=0
    largest_dimension=[0,0,0]
    for i in range(nt):
        a,b,c,material=struct.unpack_from("<IIIH",tris,i*14)
        v0,v1,v2=point(a),point(b),point(c)
        e1=[v1[k]-v0[k] for k in range(3)]
        e2=[v2[k]-v0[k] for k in range(3)]
        nx=e1[1]*e2[2]-e1[2]*e2[1]
        ny=e1[2]*e2[0]-e1[0]*e2[2]
        nz=e1[0]*e2[1]-e1[1]*e2[0]
        absn=[abs(nx),abs(ny),abs(nz)]
        axis=absn.index(max(absn))
        direction=("X","Y","Z")[axis]
        if material!=1:
            counts["detailed"]+=1
            continue
        counts["plain"]+=1
        material_dimensions[direction]+=1
        planar=absn[axis] > 0 and absn[axis]*absn[axis] >= .96*sum(x*x for x in absn)
        if planar:material_dimensions["flatAxis"+direction]+=1
        at_boundary=False
        for d in range(3):
            for edge in (0,65536):
                if v0[d]==v1[d]==v2[d]==edge:
                    at_boundary=True
                    coords[("X","Y","Z")[d]+"="+str(edge)]+=1
        if at_boundary:boundary+=1
        xyz=[(v0[d]+v1[d]+v2[d])/3/8 for d in range(3)]
        zone="center" if 2800<=xyz[0]<=5400 and 2800<=xyz[1]<=5400 else "outside-center"
        area_by_zone[zone]+=1
        floor_bin=int(xyz[2]//128)*128
        y_bins[str(floor_bin)]+=1
        for d in range(3):
            largest_dimension[d]=max(largest_dimension[d],v0[d],v1[d],v2[d])
    report={
        "format":"OCTAVUS-NATIVE-FACE-AUDIT81",
        "sourceRevision":829,
        "inputSHA256":meta["stagingSHA256"],
        "totalTriangles":nt,
        "materialOneTriangleCount":counts["plain"],
        "detailedTriangleCount":counts["detailed"],
        "materialOneDominantFaceAxis":dict(sorted(material_dimensions.items())),
        "materialOneFullyOutsideWorldBoundary":boundary,
        "materialOneBoundaryPlanes":dict(sorted(coords.items())),
        "materialOneLocation":dict(sorted(area_by_zone.items())),
        "materialOneNativeZBins":dict(sorted(y_bins.items(),key=lambda k:int(k[0]))),
        "maxNativeEighths":largest_dimension,
        "note":"Triangle counts are raw staging candidates; this is NOT original engine-visibility equivalence.",
        "liveMapModified":False,
    }
    REPORT.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
    return report

if __name__=="__main__":
    audit()
