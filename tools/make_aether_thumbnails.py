"""Generate compact, inspectable AETHER Blender art-review thumbnails.

Source renders are committed PNGs produced by the validated Blender 1.3
workflow. This script does not modify the underlying game-art GLB or .blend.
"""
from pathlib import Path
from PIL import Image, ImageStat

PREVIEWS = Path("static/previews")
NAMES = [
    "aether9-specter-phase1",
    "aether9-specter-phase1-profile",
    "aether9-specter-phase1-rear",
]

def main():
    for name in NAMES:
        source = PREVIEWS / f"{name}.png"
        dest = PREVIEWS / f"{name}-thumb.jpg"
        if not source.exists():
            raise FileNotFoundError(source)
        with Image.open(source) as image:
            image.load()
            rgb = image.convert("RGB")
            rgb.thumbnail((1080, 720), Image.Resampling.LANCZOS)
            probe = rgb.resize((160, 96))
            visible = sum(1 for pixel in probe.getdata() if max(pixel) > 60)
            if visible < 145:
                raise RuntimeError(f"Blank render detected: {name} ({visible})")
            rgb.save(dest, format="JPEG", quality=84, optimize=True,
                     subsampling=0)
            if dest.stat().st_size >= 700_000:
                raise RuntimeError(f"Thumbnail too large: {dest}")
            stat = ImageStat.Stat(rgb)
            print(f"{dest}: {rgb.width}x{rgb.height} "
                  f"{dest.stat().st_size} bytes; visible pixels {visible}; "
                  f"mean channels {[round(x, 1) for x in stat.mean]}")

if __name__ == "__main__":
    main()
