"""Extract original Red Eclipse 2 MPZ environmental entities for conversion.

Matches Red Eclipse base engine sources:
  src/engine/worldio.cpp: load_world(), readmapstring()
  src/engine/world.h: binary/mapz (44-byte header)
  src/shared/ents.h: entbase (16 bytes)
  src/game/game.h: enttype[].links <= gamever
  src/shared/command.h: ID_VAR=0, ID_FVAR=1, ID_SVAR=2

Map source content remains CC BY-SA 3.0. This metadata inventory is NOT
currently rendered or used for gameplay (no unresolved model/media imports).
"""
from collections import Counter
import gzip
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "sources" / "octavus.original.mpz"
OUTPUT = ROOT / "static" / "maps" / "octavus.native-entities.json"
DETAILS = ROOT / "sources" / "octavus.native-variables.json"

# Native version 59 linked-entity record flags from game.h enttype[].
TYPES = (
    "empty", "light", "mapmodel", "playerstart", "envmap",
    "particles", "sound", "lightfx", "decal", "wind", "mapui",
    "soundenv", "physics", "worldcol", "weapon", "teleport",
    "actor", "trigger", "pusher", "affinity", "checkpoint",
    "route", "rail", "camera",
)
LINK_VER = (
    0, 59, 58, 59, 260, 59, 58, 1, 0, 239, 241, 0, 0, 282,
    59, 50, 59, 58, 58, 48, 48, 224, 228, 252,
)
# Environmental reference types to be considered for Phase 2 visuals.
VISUAL_TYPES = {1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13}


class Reader:
    def __init__(self, data):
        self.data = data
        self.offset = 0

    def read(self, size):
        if not 0 <= size <= len(self.data) - self.offset:
            raise ValueError(f"Unexpected EOF at byte {self.offset} for {size} bytes")
        result = self.data[self.offset:self.offset + size]
        self.offset += size
        return result

    def unpack(self, fmt):
        return struct.unpack("<" + fmt, self.read(struct.calcsize("<" + fmt)))

    def integer(self):
        return self.unpack("i")[0]

    def string(self, n, maxlen=1 << 20):
        if n < 0 or n > maxlen:
            raise ValueError(f"Invalid MPZ string length {n}")
        raw = self.read(n + 1)
        if raw[-1] != 0:
            raise ValueError("MPZ string not terminated")
        return raw[:-1].decode("utf-8", errors="replace")


def main():
    expanded = gzip.decompress(SOURCE.read_bytes())
    reader = Reader(expanded)
    magic, version, headsize, worldsize, numents, numpvs, blendmap, nslots, gamever, revision, gameid = reader.unpack("4s9i4s")
    if (magic != b"MAPZ" or version != 59 or headsize != 44
            or worldsize != 8192 or numents != 892
            or not 200 <= gamever <= 400):
        raise ValueError("Unexpected source MPZ header; refusing to guess a layout")

    numvars = reader.integer()
    if not 0 <= numvars <= 4000:
        raise ValueError(f"Unreasonable MPZ variable count: {numvars}")
    variables = {}
    for _ in range(numvars):
        key = reader.string(reader.integer(), 1024)
        typ = reader.integer()
        if typ == 0:
            val = reader.integer()
        elif typ == 1:
            val = reader.unpack("f")[0]
            if not math.isfinite(val):
                raise ValueError("Non-finite map variable")
        elif typ == 2:
            val = reader.string(reader.integer())
        else:
            raise ValueError(f"Unknown map variable type: {typ}")
        variables[key] = val

    mru_count = reader.unpack("H")[0]
    if mru_count > 65535:
        raise ValueError("Invalid texture MRU count")
    _mru = reader.unpack(f"{mru_count}H") if mru_count else ()
    first_entity_offset = reader.offset

    entities = []
    names = Counter()
    for index in range(numents):
        x, y, z, entity_type, _pad = reader.unpack("fffB3s")
        if not all(math.isfinite(i) and -100000 < i < 100000 for i in (x, y, z)):
            raise ValueError(f"Bad MPZ entity coordinates at index {index}")
        if not 0 <= entity_type < len(TYPES):
            raise ValueError(f"Bad entity type {entity_type} at index {index}")
        attr_count = reader.integer()
        if not 0 <= attr_count <= 128:
            raise ValueError(f"Bad attr count {attr_count} for entity {index}")
        attrs = list(reader.unpack(f"{attr_count}i")) if attr_count else []
        links = []
        if LINK_VER[entity_type] and LINK_VER[entity_type] <= gamever:
            nlinks = reader.integer()
            if not 0 <= nlinks <= numents:
                raise ValueError(f"Bad link count {nlinks} for entity {index}")
            links = list(reader.unpack(f"{nlinks}i")) if nlinks else []
        names[TYPES[entity_type]] += 1
        # Do not convert or invent types not understood by the source format.
        record = {
            "id": index,
            "type": TYPES[entity_type],
            "typeId": entity_type,
            "sourcePosition": [round(x, 4), round(y, 4), round(z, 4)],
            "attrs": attrs,
            "links": links,
        }
        entities.append(record)

    if reader.offset >= len(expanded):
        raise ValueError("Entity decoder ran past native texture-slot/octree payload")
    if sum(names.values()) != 892:
        raise ValueError("Wrong native entity count")

    inventory = {
        "format": "MAPZ",
        "formatVersion": version,
        "worldSize": worldsize,
        "gameVersion": gamever,
        "revision": revision,
        "count": len(entities),
        "sourceAttribution": "static/maps/OCTAVUS_ATTRIBUTION.md",
        "coordinateSpace": "native Cube2: X/Y horizontal, Z vertical, units 0..8192",
        "use": "Source inventory for Phase 2/3; not automatically added to gameplay",
        "counts": dict(sorted(names.items())),
        "visualEntities": [entity for entity in entities if entity["typeId"] in VISUAL_TYPES],
        "playerStarts": [entity for entity in entities if entity["typeId"] == 3],
        "allEntityCount": len(entities),
    }
    details = {
        "header": {
            "version": version,
            "headerSize": headsize,
            "worldSize": worldsize,
            "gameVersion": gamever,
            "revision": revision,
            "gameId": gameid.decode("ascii", "replace").strip("\x00"),
            "numEnts": numents,
            "numPVS": numpvs,
            "blendmap": blendmap,
            "numVSlots": nslots,
            "numMapVariables": numvars,
            "numTextureMRU": mru_count,
            "entityDataOffset": first_entity_offset,
            "nextSectionOffset": reader.offset,
            "uncompressedBytes": len(expanded),
        },
        "variables": variables,
    }
    OUTPUT.write_text(json.dumps(inventory, separators=(",", ":")) + "\n")
    DETAILS.write_text(json.dumps(details, indent=2) + "\n")
    print(json.dumps({"header": details["header"], "counts": inventory["counts"],
                      "visualEntities": len(inventory["visualEntities"]),
                      "playerStarts": len(inventory["playerStarts"])}))


if __name__ == "__main__":
    main()
