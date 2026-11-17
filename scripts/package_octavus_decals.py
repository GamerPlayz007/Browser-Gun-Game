"""Package only the original Octavus decals actually placed in its MPZ.

Source image references are from octavus.cfg. Source entity positions
and orientations are in octavus.native-entities.json. Every image's
original author/repo URL and cryptographic SHA is included for credit.
"""
from collections import Counter
from hashlib import sha256,sha1
from io import BytesIO
import json
from pathlib import Path
import re
from urllib.parse import quote
from urllib.request import urlopen,Request

from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
MAPS=ROOT/"static/maps"
DEST=MAPS/"octavus_assets"
M=MAPS/"octavus.decals.json"


def main():
    cfg=(MAPS/"octavus.original.cfg").read_text()
    definitions={int(idx):path for path,idx in re.findall(
        r'^texture decal "([^"]+)"\s*//\s*(\d+)',cfg,flags=re.M)}
    entities=json.loads((MAPS/"octavus.native-entities.json").read_text())
    used=Counter(e["attrs"][0] for e in entities["visualEntities"]
                 if e.get("type")=="decal" and e.get("attrs"))
    DEST.mkdir(parents=True,exist_ok=True)
    materials={}
    missing=[]
    for slot,count in sorted(used.items()):
        path=definitions.get(slot)
        if not path or "<" in path or ".." in path:continue
        module,sub=path.split("/",1)
        if module not in {"jojo","decals","luckystrike"}:
            missing.append({"slot":slot,"source":path,"reason":"unverified source module"})
            continue
        url=f"https://raw.githubusercontent.com/redeclipse/{quote(module)}/master/{quote(sub,safe='/')}"
        try:
            with urlopen(Request(url,headers={
                "User-Agent":"CROSSFire-Octavus-original-decals/1.0"}),timeout=25) as f:
                raw=f.read(6*1024*1024+1)
            if len(raw)>6*1024*1024:raise ValueError("Oversize decal")
            with Image.open(BytesIO(raw)) as im:
                im.load()
                im=im.convert("RGBA")
                im.thumbnail((768,768),Image.Resampling.LANCZOS)
                filename="decal_"+sha1(path.encode()).hexdigest()[:14]+".webp"
                im.save(DEST/filename,format="WEBP",quality=86,method=5)
            materials[str(slot)]={
                "url":f"/static/maps/octavus_assets/{filename}",
                "source":url,"sha256":sha256(raw).hexdigest(),
                "placed":count,"licenseAttribution":module
            }
        except Exception as e:
            missing.append({"slot":slot,"source":path,"reason":type(e).__name__})
    payload={
        "format":"OCTAVUS-DECALS2",
        "source":"Original Red Eclipse native Octavus map decals",
        "nativeDecals":sum(used.values()),"materialCount":len(materials),
        "enabledEntities":sum(m["placed"] for m in materials.values()),
        "materials":materials,"missing":missing,
        "license":"Individual upstream Red Eclipse media module licensing applies"
    }
    M.write_text(json.dumps(payload,indent=2)+"\n")
    print(json.dumps({"native":payload["nativeDecals"],
                      "restored":payload["enabledEntities"],
                      "images":len(materials),
                      "missing":missing},indent=2),flush=True)


if __name__=="__main__":
    main()
