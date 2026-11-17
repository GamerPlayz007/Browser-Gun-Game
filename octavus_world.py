"""Server-side source-mesh collision for Octavus (Red Eclipse 2).

The imported map geometry is CC BY-SA 3.0, with creators and source credited
in static/maps/OCTAVUS_ATTRIBUTION.md. This decoder and integration are
CROSSFire-specific; all movement and hit detection remains server-authoritative.
"""
from __future__ import annotations

import base64
import hashlib
import struct
from array import array
from functools import lru_cache
from pathlib import Path

from dust_world64 import DustWorld64

ROOT = Path(__file__).parent
SCALE = 120.0 / 8192.0
VERTICES = 52061
TRIANGLES = 86500
PARTS = 8


class OctavusCollision:
    def __init__(self):
        pieces = []
        for index in range(1, PARTS + 1):
            path = ROOT / 'static' / 'maps' / f'octavus_{index:02d}.b64'
            pieces.append(path.read_text(encoding='ascii').strip())
        raw = base64.b64decode(''.join(pieces), validate=True)
        expected = 12 + VERTICES * 6 + TRIANGLES * 7
        if len(raw) != expected:
            raise ValueError(f'Octavus packed mesh length {len(raw)} != {expected}')
        magic, num_vertices, num_triangles = struct.unpack_from('<4sII', raw, 0)
        if (magic, num_vertices, num_triangles) != (b'OCT1', VERTICES, TRIANGLES):
            raise ValueError('Octavus source mesh header mismatch')

        points = struct.unpack_from(f'<{VERTICES * 3}h', raw, 12)
        positions = array('f')
        surfaces = bytearray(TRIANGLES)
        offset = 12 + VERTICES * 6
        for tri in range(TRIANGLES):
            a, b, c, material = struct.unpack_from('<HHHB', raw, offset)
            offset += 7
            if a >= VERTICES or b >= VERTICES or c >= VERTICES:
                raise ValueError('Octavus source mesh contains an invalid vertex index')
            for vertex in (a, b, c):
                i = vertex * 3
                positions.extend((points[i] * SCALE,
                                  points[i + 1] * SCALE,
                                  points[i + 2] * SCALE))
            surfaces[tri] = material
        self.vertices = positions.tobytes()  # Same float32 triangle soup used by JS BVH.
        self._surfaces = surfaces
        self.count = TRIANGLES
        self.metadata = {
            'playBounds': {'x0': -57, 'x1': 57, 'z0': -57, 'z1': 57},
            'spawns': {},
            'rawSha256': hashlib.sha256(raw).hexdigest(),
        }

    def surface(self, triangle):
        return self._surfaces[triangle]


@lru_cache(maxsize=1)
def get_octavus_world():
    """Keep a single indexed 86,500-triangle arena shared by all Octavus rooms."""
    return DustWorld64(OctavusCollision())
