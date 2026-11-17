"""Archive the original Octavus 'jojo/redcliff' skybox.

Source world MAPZ variable: skybox='jojo/redcliff'.
The six source faces are in redeclipse/jojo at redcliff_{side}.png.
Each file is resized for web rendering and original bytes are credited.
"""
import json
from io import BytesIO
from hashlib import sha256
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "static" / "maps" / "octavus_assets"
SIDES = ("rt", "lf", "up", "dn", "ft", "bk")
SRC = "https://raw.githubusercontent.com/redeclipse/jojo/master/redcliff_"


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    info = {"name":"jojo/redcliff",
            "source":"https://github.com/redeclipse/jojo",
            "licenseNote":"Original image authorship and licensing retained; see redeclipse module licenses",
            "format":"OCTAVUS-SKY1","sides":{}}
    for side in SIDES:
        url = SRC + side + ".png"
        with urlopen(Request(url, headers={
                "User-Agent": "CROSSFire-Octavus-source-attribution/1.0"}), timeout=30) as f:
            original = f.read(8 * 1024 * 1024 + 1)
        if len(original) > 8 * 1024 * 1024:
            raise ValueError("Skybox source file too large")
        with Image.open(BytesIO(original)) as img:
            img.load()
            size=img.size
            img=img.convert("RGB")
            img.thumbnail((1024,1024), Image.Resampling.LANCZOS)
            filename=f"redcliff_{side}.webp"
            img.save(DEST / filename, format="WEBP", quality=88, method=5)
            info["sides"][side]={
                "url":f"/static/maps/octavus_assets/{filename}",
                "originalSource":url,
                "sha256":sha256(original).hexdigest(),
                "originalSize":size,
                "optimizedSize":img.size,
            }
    (ROOT/"static/maps/octavus.skybox.json").write_text(
        json.dumps(info,indent=2)+"\n",encoding="utf-8")
    print("Verified six Red Eclipse source skybox faces",len(info["sides"]))


if __name__=="__main__":
    main()
