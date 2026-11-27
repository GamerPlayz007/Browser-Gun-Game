"""CROSSFire Workshop Phase 2 / Stage 2 — CC0 Lantern production intake.
Run with Blender 4.x:
 blender -b --python tools/blender_lantern_stage2.py -- --out artifacts/lantern
For an offline input, pass --source /path/to/Lantern.glb.
Nothing here modifies the live game.
"""
import argparse
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

PIN = "e124e8d8d7330a5372bc2b4d00d39a4a9d7997ea"
GIT_BLOB = "0c97893aee066b6fa36f7725443b7536c3510d09"
SOURCE_URL = ("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/"
              + PIN + "/Models/Lantern/glTF-Binary/Lantern.glb")
SOURCE_SIZE = 9564264

def blob_sha(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()

def get_source(path):
    if path.exists():
        data = path.read_bytes()
    else:
        with urllib.request.urlopen(SOURCE_URL, timeout=120) as reply:
            data = reply.read()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    if len(data) != SOURCE_SIZE or blob_sha(data) != GIT_BLOB:
        raise RuntimeError("Unexpected source file — checksum mismatch. No model was imported.")
    return data

def triangle_count(objects):
    return sum(max(0, len(p.vertices) - 2) for o in objects for p in o.data.polygons)

def run():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path)
    parser.add_argument("--out", type=Path, default=Path("artifacts/lantern"))
    parser.add_argument("--max-texture", type=int, default=768)
    parser.add_argument("--decimate", type=float, default=0.75)
    option = parser.parse_args(args)
    option.out.mkdir(parents=True, exist_ok=True)
    source = option.source or (option.out / "Lantern_CC0_original.glb")
    data = get_source(source)

    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("Imported Lantern did not contain meshes.")
    source_tris = triangle_count(meshes)
    native = option.out / "Lantern_Hero_Source.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(native.resolve()))
    hero = option.out / "Lantern_Hero.glb"
    bpy.ops.export_scene.gltf(filepath=str(hero.resolve()), export_format="GLB")

    # Reload the author geometry; edits below are only applied to the export copy.
    bpy.ops.wm.open_mainfile(filepath=str(native.resolve()))
    resized = []
    for image in bpy.data.images:
        if image.source not in ("FILE", "GENERATED"):
            continue
        width, height = image.size[:]
        if min(width, height) <= 0:
            continue
        ratio = min(1.0, option.max_texture / max(width, height))
        if ratio < 1.0:
            image.scale(max(1, int(width * ratio)), max(1, int(height * ratio)))
            resized.append(image.name)

    reduced = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or len(obj.data.polygons) < 1000:
            continue
        modifier = obj.modifiers.new(name="CROSSFIRE_Visual_LOD", type="DECIMATE")
        modifier.ratio = min(1.0, max(0.35, option.decimate))
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        reduced.append(obj.name)

    performance = option.out / "Lantern_Performance.glb"
    bpy.ops.export_scene.gltf(filepath=str(performance.resolve()), export_format="GLB")
    performance_tris = triangle_count([o for o in bpy.context.scene.objects if o.type == "MESH"])
    report = {
        "source_url": SOURCE_URL,
        "source_license": "CC0-1.0",
        "source_blob_sha1": GIT_BLOB,
        "source_bytes": len(data),
        "source_triangles": source_tris,
        "performance_triangles": performance_tris,
        "texture_resized": resized,
        "meshes_decimated": reduced,
        "native_blend": native.name,
        "hero_glb": hero.name,
        "performance_glb": performance.name,
        "hero_bytes": hero.stat().st_size,
        "performance_bytes": performance.stat().st_size,
    }
    (option.out / "Lantern_Production_Report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    run()
