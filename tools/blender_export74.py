"""CROSSFire generic game-art pipeline: import a glTF/GLB asset in Blender, save
an editable .blend scene, and export a consolidated .glb for the browser.

Usage (Blender 4.x+):
  blender -b --python tools/blender_export74.py -- \
    --input static/assets/studio-beacon.gltf \
    --blend output/studio-beacon.blend \
    --glb output/studio-beacon.glb

This script works with general-purpose, non-functional 3D game props.
It intentionally avoids modifying geometry or collision data.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    import bpy
except ImportError as error:
    raise SystemExit(
        "Run this file using Blender, e.g. blender -b --python "
        "tools/blender_export74.py -- --input <asset.gltf>"
    ) from error


def arguments() -> argparse.Namespace:
    cli = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Import, save and export a generic 3D game asset")
    parser.add_argument("--input", required=True, help="Input .gltf or .glb asset")
    parser.add_argument("--blend", required=True, help="Editable .blend output")
    parser.add_argument("--glb", required=True, help="Self-contained .glb output")
    parser.add_argument("--report", help="Optional JSON metrics output")
    return parser.parse_args(cli)


def create_asset(args: argparse.Namespace) -> dict:
    source = Path(args.input).expanduser().resolve()
    if source.suffix.lower() not in {".glb", ".gltf"} or not source.is_file():
        raise ValueError("Input must be an existing .glb or .gltf file")
    blend = Path(args.blend).expanduser().resolve()
    glb = Path(args.glb).expanduser().resolve()
    if blend == source or glb == source or blend == glb:
        raise ValueError("Input, Blend output and GLB output must be distinct")
    blend.parent.mkdir(parents=True, exist_ok=True)
    glb.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise ValueError("The imported asset contains no mesh objects")

    triangles = 0
    uv_missing = []
    material_count = set()
    for obj in meshes:
        mesh = obj.data
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
        if not mesh.uv_layers:
            uv_missing.append(obj.name)
        for material in mesh.materials:
            if material:
                material_count.add(material.name)

    # Preserve separate Blender objects and editable materials; never flatten
    # the mesh hierarchy or silently recalculate geometry.
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.export_scene.gltf(
        filepath=str(glb),
        export_format="GLB",
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
    )
    if not glb.is_file() or glb.stat().st_size < 100:
        raise RuntimeError("Blender did not produce a usable GLB output")

    summary = {
        "source": str(source),
        "blend": str(blend),
        "glb": str(glb),
        "meshes": len(meshes),
        "triangles": triangles,
        "materials": len(material_count),
        "uv_missing": uv_missing,
        "glb_bytes": glb.stat().st_size,
    }
    if args.report:
        report = Path(args.report).expanduser().resolve()
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


if __name__ == "__main__":
    try:
        print("CROSSFIRE_ASSET_EXPORT " + json.dumps(create_asset(arguments())))
    except Exception as exc:
        print(f"CROSSFIRE_ASSET_EXPORT_FAILED {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
