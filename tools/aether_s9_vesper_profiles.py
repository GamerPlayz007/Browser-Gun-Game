"""Create AETHER-S9 VESPER lightweight self-contained GLB quality variants.
Fictional nonfunctional cosmetic art only; never changes gameplay.
Reuses lossless glTF geometry preservation from glb_texture_profiles.optimize.
- High / Ultra / Native: original embedded 1024px PBR textures.
- Auto / balanced: 512px textures, same geometry.
- Performance: 256px textures, same geometry (optional; low-tier game stays procedural).
"""
import json
import sys
from pathlib import Path
from glb_texture_profiles import optimize,read_glb

def generate(src_dir):
    root=Path(src_dir)
    result={}
    for finish in ("midnight","glacier","eclipse"):
        name=f"aether-s9-vesper-{finish}"
        src=root/(name+".glb")
        before=src.read_bytes()
        doc,_=read_glb(before)
        if len(doc.get("images",[])) < 9 or len(doc.get("meshes",[])) < 32:
            raise ValueError("Not a reviewed VESPER PBR GLB: "+name)
        result[src.name]={}
        for quality,limit in (("balanced",512),("performance",256)):
            payload,report=optimize(before,limit)
            if len(payload)>=len(before):
                raise ValueError("No decrease for "+name+" "+quality)
            out=root/(name+"-"+quality+".glb")
            out.write_bytes(payload)
            compare,_=read_glb(payload)
            assert len(compare.get("meshes",[]))==len(doc["meshes"])
            assert len(compare.get("materials",[]))==len(doc["materials"])
            assert len(compare.get("images",[]))==len(doc["images"])
            assert report["max_texture_dimension"]==limit
            result[src.name][quality]=report
            print("VESPER_PROFILE",out.name,report["output_bytes"],flush=True)
        a=result[src.name]["balanced"]
        b=result[src.name]["performance"]
        assert b["output_bytes"]<a["output_bytes"]<len(before)
        assert b["estimated_rgba_mipped_bytes_after"]<a["estimated_rgba_mipped_bytes_after"]
    report_path=root/"vesper-texture-profile-report.json"
    report_path.write_text(json.dumps(result,indent=2)+"\n")
    return result

if __name__=="__main__":
    if len(sys.argv)!=2:raise SystemExit("Expected directory containing VESPER GLBs")
    data=generate(sys.argv[1])
    print("VESPER_PROFILES_DONE",json.dumps({k:[(q,v["output_bytes"]) for q,v in profiles.items()] for k,profiles in data.items()}))
