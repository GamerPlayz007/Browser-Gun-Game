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
SCALE = 0.05  # Full-size original geometry; upstream OBJ README recommends ~0.05
GROUND_SOURCE_Y = 2816.0  # Center courtyard ground in source Cube 2 units
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
        self.cell_size = 10.0  # Broadphase tuned for 409.6-unit outdoor map
        self.native_step_assist = True  # Enable matched Python/JS source-mesh stair handling
        offset = 12 + VERTICES * 6
        for tri in range(TRIANGLES):
            a, b, c, material = struct.unpack_from('<HHHB', raw, offset)
            offset += 7
            if a >= VERTICES or b >= VERTICES or c >= VERTICES:
                raise ValueError('Octavus source mesh contains an invalid vertex index')
            for vertex in (a, b, c):
                i = vertex * 3
                positions.extend((points[i] * SCALE,
                                  (points[i + 1] - GROUND_SOURCE_Y) * SCALE,
                                  points[i + 2] * SCALE))
            surfaces[tri] = material
        self.vertices = positions.tobytes()  # Same float32 triangle soup used by JS BVH.
        self._surfaces = surfaces
        self.count = TRIANGLES
        self.metadata = {
            'playBounds': {'x0': -194.56, 'x1': 194.56,
                           'z0': -194.56, 'z1': 194.56},
            'spawns': {},
            'rawSha256': hashlib.sha256(raw).hexdigest(),
        }

    def surface(self, triangle):
        return self._surfaces[triangle]


class OctavusWorld(DustWorld64):
    """Exact source collision with reusable wall and vertical-ground indexes.

    The 86,500 source triangles are unchanged. The regular Dust controller
    continues using DustWorld64; only the large Octavus arena gets this index.
    """

    def __init__(self):
        super().__init__(OctavusCollision())
        import math
        from collections import defaultdict
        from array import array
        points = self.points
        # Independent narrowphase index: large terrain keeps the 10m grid,
        # but 44k steep wall faces are indexed by their own 2m X/Z bounds.
        # Original triangles, normals and collision tolerances stay untouched.
        self.wall_cell = 2.0
        fine_walls = defaultdict(list)
        normals = array('f', [0.0]) * (self.count * 3)
        y_bounds = array('f', [0.0]) * (self.count * 2)
        xz_bounds = array('f', [0.0]) * (self.count * 4)
        wall = bytearray(self.count)
        for tri in range(self.count):
            k = tri * 9
            ax, ay, az, bx, by, bz, cx, cy, cz = points[k:k+9]
            ux, uy, uz = bx-ax, by-ay, bz-az
            vx, vy, vz = cx-ax, cy-ay, cz-az
            nx = uy*vz-uz*vy
            ny = uz*vx-ux*vz
            nz = ux*vy-uy*vx
            length = math.sqrt(nx*nx+ny*ny+nz*nz)
            normals[tri*3:tri*3+3] = array('f', (nx, ny, nz))
            y_bounds[tri*2:tri*2+2] = array('f', (min(ay,by,cy), max(ay,by,cy)))
            xz_bounds[tri*4:tri*4+4] = array(
                'f', (min(ax,bx,cx), max(ax,bx,cx), min(az,bz,cz), max(az,bz,cz)))
            wall[tri] = length >= 1e-8 and abs(ny)/length <= .65
            if wall[tri]:
                for gx in range(math.floor(min(ax,bx,cx)/self.wall_cell),
                                math.floor(max(ax,bx,cx)/self.wall_cell)+1):
                    for gz in range(math.floor(min(az,bz,cz)/self.wall_cell),
                                    math.floor(max(az,bz,cz)/self.wall_cell)+1):
                        fine_walls[gx,gz].append(tri)
        self.wall_normals = normals
        self.wall_y_bounds = y_bounds
        self.ground_xz_bounds = xz_bounds
        self.wall_cells = {key: tuple(indices) for key, indices in fine_walls.items()}

    @lru_cache(maxsize=4096)
    def _wall_candidates_cells(self, gx0, gz0, gx1, gz1):
        if gx0 == gx1 and gz0 == gz1:
            return self.wall_cells.get((gx0, gz0), ())
        found = set()
        for gx in range(gx0, gx1 + 1):
            for gz in range(gz0, gz1 + 1):
                found.update(self.wall_cells.get((gx, gz), ()))
        return tuple(sorted(found))

    def wall_candidates(self, x0, z0, x1, z1):
        import math
        near = self._wall_candidates_cells(
            math.floor(x0 / self.wall_cell), math.floor(z0 / self.wall_cell),
            math.floor(x1 / self.wall_cell), math.floor(z1 / self.wall_cell))
        # A cell may touch a triangle dozens of metres away. Cull against
        # each ORIGINAL triangle's exact horizontal bounding box first.
        bounds = self.ground_xz_bounds
        return (tri for tri in near
                if (bounds[tri*4] <= x1 and bounds[tri*4+1] >= x0 and
                    bounds[tri*4+2] <= z1 and bounds[tri*4+3] >= z0))

    def ground_at(self, x, z, feet_y=0.0):
        """Same highest two-sided vertical ray hit as DustWorld64.ground_at.

        Direct XZ barycentric interpolation avoids rebuilding hundreds of
        Python triangle tuples, rays and sorted candidate sets per player tick.
        Non-walkable faces still mask the ground just like the original raycast.
        """
        import math
        gx, gz = math.floor(x / self.cell), math.floor(z / self.cell)
        candidates = self.cells.get((gx, gz), ())
        points = self.points
        xy = self.ground_xz_bounds
        heights = self.wall_y_bounds
        normals = self.wall_normals
        low, high = feet_y - 1.0, feet_y + .48
        best = low
        chosen = -1
        for tri in candidates:
            b = tri*4
            if x < xy[b] or x > xy[b+1] or z < xy[b+2] or z > xy[b+3]:
                continue
            t = tri*2
            if heights[t] > high or heights[t+1] < low:
                continue
            k = tri*9
            ax, ay, az = points[k], points[k+1], points[k+2]
            bx, by, bz = points[k+3], points[k+4], points[k+5]
            cx, cy, cz = points[k+6], points[k+7], points[k+8]
            denom = (bz-cz)*(ax-cx)+(cx-bx)*(az-cz)
            if abs(denom) < 1e-9:
                continue
            u = ((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/denom
            v = ((cz-az)*(x-cx)+(ax-cx)*(z-cz))/denom
            if u < 0.0 or v < 0.0 or u+v > 1.0:
                continue
            y = u*ay + v*by + (1-u-v)*cy
            if low+1e-6 < y < high-1e-6 and y > best:
                best, chosen = y, tri
        if chosen < 0:
            return None
        n = chosen*3
        nx, ny, nz = normals[n], normals[n+1], normals[n+2]
        length = math.sqrt(nx*nx+ny*ny+nz*nz)
        return best if length >= 1e-8 and abs(ny)/length >= .67 else None


@lru_cache(maxsize=1)
def get_octavus_world():
    """Single accelerated authoritative Octavus world shared by all rooms."""
    return OctavusWorld()
