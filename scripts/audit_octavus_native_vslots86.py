"""Phase 1.6: decode original MPZ native VSlot inheritance, without
pretending the older OBJ export's material indices are native indices.

Decodes Red Eclipse 2 MAPZ v59 changed masks and predecessor links,
validates all 223 slots, and reports root CFG image candidates where
the native registry indexing is supported by the source. Does not
alter gameplay or source geometry.

Source: redeclipse/base src/engine/worldio.cpp savevslots/loadvslots
and source CFG (Octavus CC BY-SA 3.0).
"""
from __future__ import annotations
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
from scripts.decode_octavus_octree76 import (
    ROOT,SOURCE,SOURCE_INFO,ENTITY_INFO,Cursor,FormatError,
    skip_vslot,VSLOT_NUM
)

OUT=ROOT/"static/maps/octavus.native-vslot-audit86.json"
MATERIALS=ROOT/"static/maps/octavus.source-materials.json"
ASSETS=ROOT/"static/maps/octavus.texture-manifest.json"
EXPECTED_END=107595

def decode_native_vslots():
    compressed=SOURCE.read_bytes()
    metadata=json.loads(SOURCE_INFO.read_text())
    if hashlib.sha256(compressed).hexdigest()!=metadata["rawSha256"]:
        raise FormatError("Original MPZ checksum mismatch")
    data=gzip.decompress(compressed)
    info=json.loads(ENTITY_INFO.read_text())["header"]
    r=Cursor(data,info["nextSectionOffset"])
    count=info["numVSlots"]
    slots=[]
    tally=Counter()
    changed_sets=Counter()
    while len(slots)<count:
        control=r.i32()
        if control<0:
            if not -count<=control<=-1:raise FormatError("Invalid VSlot run")
            if len(slots)-control>count:raise FormatError("Overrun native unchanged VSlot run")
            slots.extend({"index":i,"changedMaskHex":"0x0","prev":-1,
                          "overrides":{}} for i in range(len(slots),len(slots)-control))
            continue
        lo=r.u64()
        hi=r.u64()
        mask=lo|(hi<<64)
        parent=r.i32()
        if mask>>(VSLOT_NUM):
            raise FormatError("Unexpected original VSlot changed bits")
        if parent>=count or parent<-1:
            raise FormatError("Native VSlot predecessor not prior to slot")
        overrides={}
        # For every changed field, capture meaningful native texture
        # parameters without reinterpreting less-common grass payloads.
        # Cursor allocation is cheap because source is only 15MB.
        start=r.pos
        skip_vslot(r,mask)
        end=r.pos
        # Decode only the source's shader scalar blocks by walking
        # known constant-width segments, skip already-tested rest.
        scan=Cursor(data,start)
        for bit in range(VSLOT_NUM):
            if not(mask&(1<<bit)):continue
            if bit==0:
                countflags=scan.u16()
                n=countflags&0x7fff
                params=[]
                for _ in range(n):
                    ln=scan.u16()
                    raw=bytes(scan.read(ln))
                    name=raw.decode("utf-8","replace")
                    vals=list(scan.unpack("4f"))
                    if countflags&0x8000:scan.skip(8)
                    params.append({"name":name,"values":vals})
                overrides["shaderParams"]=params
            elif bit==1:overrides["scale"]=scan.unpack("f")[0]
            elif bit==2:overrides["rotation"]=scan.i32()
            elif bit==3:overrides["offset"]=list(scan.unpack("2i"))
            elif bit==4:overrides["scroll"]=list(scan.unpack("2f"))
            elif bit==5:overrides["layer"]=scan.i32()
            elif bit==6:overrides["alpha"]=list(scan.unpack("2f"))
            elif bit==7:overrides["color"]=list(scan.unpack("3f"))
            elif bit==8:overrides["palette"]=list(scan.unpack("2i"))
            elif bit==9:overrides["coast"]=scan.unpack("f")[0]
            elif bit==10:overrides["refract"]=list(scan.unpack("4f"))
            elif bit==11:overrides["detail"]=scan.i32()
            elif bit==12:overrides["angle"]=list(scan.unpack("3f"))
            elif bit==13:overrides["shadow"]=scan.unpack("f")[0]
            else:
                # Future source grass controls don't affect diffuse,
                # but must not desynchronize byte-level parsing.
                width=(8 if bit in (3,4,6,8)
                       else 12 if bit in (7,12)
                       else 16 if bit==10 else 4)
                scan.skip(width)
        if scan.pos!=end:
            raise FormatError(f"VSlot {len(slots)} scalar parser drift: {scan.pos} != {end}")
        for field in overrides:changed_sets[field]+=1
        slots.append({"index":len(slots),"changedMaskHex":hex(mask),
                      "prev":parent,"overrides":overrides})
        tally["changed"]+=1
    if r.pos!=EXPECTED_END or len(slots)!=count:
        raise FormatError("Source texture slot block size or count mismatch")
    # savevslot records the previous entry in a linked variant chain;
    # variants need not have lower numeric indices than their successor.
    for slot in slots:
        seen=set()
        idx=slot["index"]
        while slots[idx]["prev"]!=-1:
            parent=slots[idx]["prev"]
            if parent<0 or parent>=count or parent in seen or parent==idx:
                raise FormatError("Native texture predecessor cycle or invalid index")
            seen.add(idx);idx=parent
        slot["rootVSlot"]=idx
        if seen:slot["depth"]=len(seen)
    return slots,tally,changed_sets

def audit():
    slots,tally,changed_sets=decode_native_vslots()
    cfg=json.loads(MATERIALS.read_text())["cfgSlots"]
    sources=json.loads(ASSETS.read_text())["materials"]
    bypath={}
    for key,entry in sources.items():
        path=entry["source"].removeprefix("data/").lstrip("/")
        url=entry.get("channels",{}).get("color",{}).get("url")
        if url:
            bypath.setdefault(path,[]).append((int(key),url))
    cfg_map={m["cfgSlot"]:m for m in cfg}
    roots=Counter(s["rootVSlot"] for s in slots)
    real_used=json.loads((ROOT/"static/maps/octavus.native-octree-report.json").read_text())
    present=real_used.get("textureSlots",0)
    mappings={}
    unmapped=[]
    for slot in slots:
        root=slot["rootVSlot"]
        cm=cfg_map.get(root)
        if cm:
            source=cm["sourceImage"].removeprefix("data/").lstrip("/")
            found=bypath.get(source,[])
            mappings[str(slot["index"])]={
                "root":root,
                "candidateSourceImage":source,
                "availableSourceAsset":found[0][1] if found else None,
                "cfgBaseScale":cm.get("textureScale",1),
                "nativeOverrides":slot["overrides"],
                "confidence":"candidate-registry-index-only",
                "reason":"MPZ stores variants and predecessors, not the original external texture file path. CFG order must still be verified against source default slot registry.",
            }
        else:unmapped.append(slot["index"])
    return {
        "format":"OCTAVUS-NATIVE-VSLOTS86",
        "sourceRevision":829,
        "sourceChecksum":hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "nativeVSlotCount":len(slots),
        "modifiedNativeSlots":tally["changed"],
        "nativeRootCount":len(roots),
        "nativeRootHistogram":dict(sorted(roots.items())),
        "nativeFieldChanges":dict(sorted(changed_sets.items())),
        "maxVariantDepth":max(s.get("depth",0) for s in slots),
        "cfgTextureDefinitions":len(cfg),
        "preexistingObjAtlasMaterials":len(sources),
        "registryIndexCandidates":len(mappings),
        "candidateWithReusableAsset":sum(bool(m["availableSourceAsset"]) for m in mappings.values()),
        "notInCFGOrder":unmapped,
        "sourceNativeSlots":slots,
        "candidatesBySlot":mappings,
        "originalRendererTextureParity":False,
        "liveMapModified":False,
    }

def main():
    report=audit()
    OUT.write_text(json.dumps(report,indent=2)+"\n")
    summary={k:v for k,v in report.items()
             if k not in ("sourceNativeSlots","candidatesBySlot","nativeRootHistogram","notInCFGOrder")}
    summary["rootHistogramTop"]=Counter(report["nativeRootHistogram"]).most_common(15)
    summary["unmappedPreview"]=report["notInCFGOrder"][:30]
    print(json.dumps(summary,indent=2))
    return report

if __name__=="__main__":
    main()
