"""Rebuild OCU1 original UV data from the pinned Red Eclipse OBJ export.

SOURCE: Calinou/game-maps-obj/redeclipse/octavus.obj
PINNED BLOB: ad408f0c35ffb98aa1c19d4fb01943decac3b8de
LICENSE: CC BY-SA 3.0 — see static/maps/OCTAVUS_ATTRIBUTION.md.

Usage: python scripts/pack_octavus_source_uv.py /path/to/octavus.obj

Does not download proprietary resources or require the original game.
Preserves all original UVs and per-face material order. The fallback
procedural materials can still use their own temporary planar UVs.
"""
import argparse
import base64
from collections import OrderedDict
from pathlib import Path
import struct

VERTICES = 52061
TEXTURE_VERTICES = 65636
TRIANGLES = 86500
CHUNK_SIZE = 160000


def build(obj, output):
    textures = []
    faces = OrderedDict()
    active_slot = None
    source_vertices = 0
    with obj.open(encoding="utf-8") as stream:
        for raw in stream:
            line = raw.strip()
            if line.startswith("v "):
                source_vertices += 1
            elif line.startswith("vt "):
                parts = line.split()
                textures.append((float(parts[1]), float(parts[2])))
            elif line.startswith("usemtl slot"):
                active_slot = int(line[len("usemtl slot"):])
                faces.setdefault(active_slot, [])
            elif line.startswith("f "):
                fields = line.split()[1:]
                if len(fields) != 3 or active_slot is None:
                    raise ValueError("Non-triangle or missing material")
                face = []
                for field in fields:
                    indices = field.split("/")
                    if len(indices) < 2:
                        raise ValueError("Missing OBJ texture coordinate")
                    vertex = int(indices[0]) - 1
                    tex_index = int(indices[1]) - 1
                    if not (0 <= vertex < VERTICES and
                            0 <= tex_index < TEXTURE_VERTICES):
                        raise ValueError("Source vertex or UV index out of range")
                    face.append(tex_index)
                faces[active_slot].extend(face)

    triangles = sum(len(group) // 3 for group in faces.values())
    if (source_vertices != VERTICES or len(textures) != TEXTURE_VERTICES or
            triangles != TRIANGLES or len(faces) != 111):
        raise ValueError("Pinned source mesh dimensions changed")

    data = bytearray(struct.pack("<4sII", b"OCU1", len(textures), triangles))
    for u, v in textures:
        data.extend(struct.pack("<ff", u, v))
    for indices in faces.values():
        for index in indices:
            data.extend(index.to_bytes(3, "little"))

    encoded = base64.b64encode(data).decode("ascii")
    output.mkdir(parents=True, exist_ok=True)
    parts = (len(encoded) + CHUNK_SIZE - 1) // CHUNK_SIZE
    for index in range(parts):
        part = encoded[index * CHUNK_SIZE:(index + 1) * CHUNK_SIZE]
        (output / f"octavus_uv_{index + 1:02d}.b64").write_text(
            part, encoding="ascii"
        )
    if parts != 11 or len(data) != 1303600:
        raise ValueError("Source UV package size changed")
    print(f"OCU1: {source_vertices} geometry vertices, {len(textures)} UVs, "
          f"{triangles} triangles, {len(data)} bytes, {parts} chunks")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("obj", type=Path)
    parser.add_argument("--output", type=Path,
                        default=Path("static/maps"))
    args = parser.parse_args()
    build(args.obj, args.output)
