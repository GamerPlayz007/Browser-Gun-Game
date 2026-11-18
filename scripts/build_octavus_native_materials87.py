"""Build Octavus phase 1.6 source-native material candidate registry.

The original MPZ stores texture-variant deltas, not image paths. A full
68-base-root graph is reconstructed from v59 predecessor links and
cross-referenced with its original cfg texture declarations. Existing
CC-attributed source images are reused by exact original path only.

No older OBJ face indices are used as native MPZ material identities.
No missing/unlicensed source images are invented.
"""
from __future__ import annotations
from collections import Counter
import json
from math import isfinite
from pathlib import Path

from scripts.decode_octavus_octree76 import ROOT, FormatError

MAPS=ROOT/"static/maps"
VSLOTS=MAPS/"octavus.native-vslot-audit86.json"
OPTIMIZED=MAPS/"octavus.native-optimized.json"
OUTPUT=MAPS/"octavus.native-materials87.json"

def safe_number(n, default):
    if isinstance(n,(int,float)) and isfinite(n):
        return float(n)
    return default

def build():
    source=json.loads(VSLOTS.read_text())
    geom=json.loads(OPTIMIZED.read_text())
    assert source["nativeVSlotCount"]==223
    assert source["nativeRootCount"]==68
    assert geom["sourceTriangles"]==1072281
    assert geom["triangles"]==863803
    record={int(k):v for k,v in source["candidatesBySlot"].items()}
    slots={x["index"]:x for x in source["sourceNativeSlots"]}
    uses={int(k):v for k,v in geom["newMaterialTriangleCounts"].items()}
    all_materials={}
    reasons=Counter()
    missing_reasons=Counter()
    supported_triangles=0
    texture_source_paths=set()
    for i in range(223):
        data=record[i]
        root=data["root"]
        if root<0 or root>=68:raise FormatError("Native source root outside CFG declarations")
        trail=[]
        idx=i
        seen=set()
        while True:
            if idx in seen:raise FormatError("Texture variant predecessor cycle")
            seen.add(idx)
            trail.append(idx)
            prev=slots[idx]["prev"]
            if prev<0:break
            if prev not in slots:raise FormatError("Broken native variant predecessor")
            idx=prev
        trail.reverse()
        if trail[0]!=root:raise FormatError("Native texture root mismatch")
        original_scale=safe_number(data["cfgBaseScale"],1.0)
        scale=original_scale
        rotation=0
        offset=[0,0]
        color=[1,1,1]
        alpha=[1,0]
        layer=0
        for n in trail:
            override=slots[n]["overrides"]
            if "scale" in override:scale=safe_number(override["scale"],scale)
            if "rotation" in override:rotation=int(override["rotation"])%8
            if "offset" in override:offset=list(override["offset"])
            if "color" in override:color=list(override["color"])
            if "alpha" in override:alpha=list(override["alpha"])
            if "layer" in override:layer=int(override["layer"])
        image=data["availableSourceAsset"]
        if not (0.005<=scale<=1000):
            raise FormatError(f"Invalid resolved native material scale {scale}")
        count=uses.get(i,0)
        if image and count:
            supported_triangles+=count
            texture_source_paths.add(image)
            reasons["usedSlotsWithSourceImage"]+=1
        elif count:
            reasons["usedSlotsWithoutSourceImage"]+=1
            missing_reasons[data["candidateSourceImage"]]+=count
        all_materials[str(i)]={
            "vslot":i,
            "rootCfgSlot":root,
            "sourceDiffuse":data["candidateSourceImage"],
            "image":image,
            "triangleCount":count,
            "scale":round(scale,7),
            "rotation":rotation,
            "offset":offset,
            "color":[round(safe_number(x,1.0),7) for x in color],
            "alpha":[round(safe_number(x,1.0),7) for x in alpha],
            "layer":layer,
            "chain":trail,
        }
    used=sum(v>0 for v in uses.values())
    return {
        "format":"OCTAVUS-NATIVE-MATERIALS87",
        "status":"staging-only-not-live",
        "originalSourceRevision":829,
        "nativeVSlots":223,
        "originalCFGRoots":68,
        "modifiedNativeVariants":155,
        "sourceGeometryTriangles":geom["triangles"],
        "usedNativeMaterialSlots":used,
        "usedSlotsWithSourceImage":reasons["usedSlotsWithSourceImage"],
        "usedSlotsWithoutSourceImage":reasons["usedSlotsWithoutSourceImage"],
        "sourceImageSupportedTriangles":supported_triangles,
        "missingSourceImageTriangles":geom["triangles"]-supported_triangles,
        "differentSourceImageFiles":len(texture_source_paths),
        "missingSourcePathTriangleCounts":dict(missing_reasons.most_common()),
        "textureCoordinateParity":False,
        "texturePathLinkage":"Candidate mapping: original 68 CFG slots align with the 68 MAPZ texture root indices. Image selection uses exact source file path from the existing attributed OBJ-based asset pack.",
        "limitations":[
            "Native MPZ references 223 VSlots but does not embed original source image paths; CFG root alignment is supported by source ordering, not verified against running Red Eclipse.",
            "Source packed WebP images are optimized adaptations with existing attribution, not newly fetched assets.",
            "Texture projection in browser inspection is approximate until native per-face TEX_SCALE, rotation and offset are reproduced exactly.",
            "Transparent, glow, specular, layer blends and missing upstream images remain staged.",
        ],
        "materials":all_materials,
        "liveMapModified":False,
    }

def main():
    result=build()
    OUTPUT.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:v for k,v in result.items() if k!="materials"},indent=2))
    return result

if __name__=="__main__":
    main()
