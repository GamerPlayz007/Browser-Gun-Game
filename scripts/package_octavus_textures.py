"""Download, verify and optimize the licensed original Octavus textures.

Map architecture license: CC BY-SA 3.0. Individual media authors are
credited in static/maps/octavus_assets/ATTRIBUTION.md. No game engine,
unrelated sound/media or original map models are downloaded here.
Uses upstream asset modules referenced by redeclipse/base/.gitmodules.
"""
from __future__ import annotations
from collections import Counter
from hashlib import sha256, sha1
from io import BytesIO
import json
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
MAPS = ROOT / "static" / "maps"
OUT = MAPS / "octavus_assets"
INDEX = MAPS / "octavus.texture-manifest.json"
SOURCE = MAPS / "octavus.source-materials.json"
ALLOWED = {"mikeplus64", "trak", "philipk", "appleflap", "misc",
           "nieb", "jojo", "acerspyro"}
REPO_BASE = "https://raw.githubusercontent.com/redeclipse/"
MAX_INPUT = 8 * 1024 * 1024
RETRY = 2
MAX_RES = {"color": 1024, "normal": 768, "glow": 768, "roughness": 768}
QUALITY = {"color": 88, "normal": 81, "glow": 84, "roughness": 80}


def safe_path(source):
    if not isinstance(source, str) or source.startswith("<"):
        return None
    src = source.removeprefix("data/").lstrip("/")
    parts = src.split("/")
    if len(parts) < 2 or parts[0] not in ALLOWED or any(
            p in ("", ".", "..") for p in parts):
        return None
    if not src.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
        return None
    return src


def download(source):
    src = safe_path(source)
    if src is None:
        return None
    root, tail = src.split("/", 1)
    url = REPO_BASE + quote(root) + "/master/" + quote(tail, safe="/")
    for attempt in range(RETRY):
        try:
            req = Request(url, headers={"User-Agent": "CROSSFire-source-attribution/1.0"})
            with urlopen(req, timeout=25) as response:
                mime = response.headers.get("Content-Type", "")
                data = response.read(MAX_INPUT + 1)
            if not data or len(data) > MAX_INPUT or "html" in mime.lower():
                return None
            return data
        except (HTTPError, URLError, TimeoutError):
            if attempt + 1 < RETRY:
                time.sleep(.3)
    return None


def convert(original, kind):
    with Image.open(BytesIO(original)) as image:
        image.load()
        original_size = image.size
        # Keep diffuse alpha channels for original transparencies.
        if kind == "roughness":
            image = ImageOps.invert(image.convert("L"))
            image = image.point(lambda p: min(255, max(15, int(100 + p * .55))))
        elif kind == "normal":
            image = image.convert("RGB")
        elif "A" in image.getbands():
            image = image.convert("RGBA")
        else:
            image = image.convert("RGB")
        maximum = MAX_RES[kind]
        if max(image.size) > maximum:
            image.thumbnail((maximum, maximum), Image.Resampling.LANCZOS)
        buffer = BytesIO()
        image.save(buffer, format="WEBP", quality=QUALITY[kind], method=5)
        return buffer.getvalue(), original_size, image.size


def main():
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    by_config = {e["cfgSlot"]: e for e in data["cfgSlots"]}
    slots = data["meshSlots"]
    requests = {}
    for m in slots:
        main_src = safe_path(m.get("diffuseSource"))
        if not main_src:
            continue
        selection = m.get("potentialConfigSlots", [])
        if m["objSlot"] in selection:
            cfg = by_config[m["objSlot"]]
        elif selection:
            cfg = by_config[selection[0]]
        else:
            cfg = {}
        record = {"color": main_src}
        for key, label in (("n", "normal"), ("g", "glow"), ("s", "roughness")):
            candidate = safe_path(cfg.get("layers", {}).get(key))
            if candidate:
                record[label] = candidate
        requests[str(m["objSlot"])] = {
            "source": main_src, "cfgSlot": cfg.get("cfgSlot"),
            "shader": cfg.get("shader", "stdworld"),
            "tint": cfg.get("tint", [1, 1, 1]),
            "originalTextureScale": cfg.get("textureScale", 1),
            "images": record,
        }
    # Download once even where many slots use the same file.
    all_sources = {}
    for record in requests.values():
        for kind, src in record["images"].items():
            all_sources[(src, kind)] = None
    OUT.mkdir(parents=True, exist_ok=True)
    resolved = {}
    missing = []
    attributions = Counter()
    print(f"Octavus source assets: {len(requests)} slots, {len(all_sources)} image roles",
          flush=True)
    for index, (src, kind) in enumerate(sorted(all_sources)):
        if (index + 1) % 20 == 0:
            print(f"Fetching {index + 1}/{len(all_sources)}", flush=True)
        original = download(src)
        if original is None:
            missing.append({"source": src, "role": kind})
            continue
        try:
            packed, original_size, converted_size = convert(original, kind)
        except Exception as error:
            missing.append({"source": src, "role": kind, "error": type(error).__name__})
            continue
        file = f"{sha1((src + ':' + kind).encode()).hexdigest()[:16]}.webp"
        (OUT / file).write_bytes(packed)
        resolved[src, kind] = {
            "url": f"/static/maps/octavus_assets/{file}",
            "width": original_size[0],
            "height": original_size[1],
            "convertedWidth": converted_size[0],
            "convertedHeight": converted_size[1],
            "sha256": sha256(original).hexdigest(),
            "module": src.split("/")[0],
            "original": src,
            "bytes": len(packed),
        }
        attributions[src.split("/")[0]] += 1

    runtime = {}
    for slot, info in requests.items():
        media = info["images"]
        pack = {kind: resolved[img, kind] for kind, img in media.items()
                if (img, kind) in resolved}
        runtime[slot] = {
            "slot": int(slot), "source": info["source"],
            "shader": info["shader"], "sourceTint": info["tint"],
            "materialDefinition": info["cfgSlot"], "channels": pack,
        }
    payload = {
        "format": "OCTAVUS-TEX2",
        "provenance": "Red Eclipse original media submodules / Calinou OBJ MTL",
        "sourceLicenseNote": "See static/maps/octavus_assets/ATTRIBUTION.md and upstream module license notices",
        "sourceSlots": len(runtime),
        "sourceImagesDownloaded": len(resolved),
        "missingSources": missing,
        "materials": runtime,
    }
    INDEX.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    lines = [
        "# Octavus imported texture source attribution",
        "",
        "Map geometry and arrangement: Ricky Thomson and Alex Foster, CC BY-SA 3.0.",
        "Original texture assets are from Red Eclipse data submodule repositories.",
        "Each image is a compressed/resampled adaptation; source names and hashes",
        "are preserved in octavus.texture-manifest.json.",
        "Any asset lacking an accessible original was excluded and falls back to",
        "the CROSSFire procedural material. This does not imply blanket licensing.",
        "See original module-specific license/readme files and",
        "https://github.com/redeclipse/base/blob/master/doc/all-licenses.txt",
        "",
    ]
    for mod, count in sorted(attributions.items()):
        lines.append(f"- {mod}: {count} optimized source image roles, "
                     f"https://github.com/redeclipse/{mod}")
    lines.append("")
    lines.append("Original map: https://github.com/redeclipse/maps/blob/master/octavus.txt")
    (OUT / "ATTRIBUTION.md").write_text("\n".join(lines) + "\n")
    print(json.dumps({
        "loaded": len(resolved),
        "missing": len(missing),
        "materialSlotsWithDiffuse": sum("color" in x["channels"] for x in runtime.values()),
        "attributionModules": sorted(attributions)
    }, indent=2), flush=True)
    if sum("color" in x["channels"] for x in runtime.values()) < 75:
        raise RuntimeError("Too many original diffuse textures missing; refusing to publish incomplete archive")


if __name__ == "__main__":
    main()
