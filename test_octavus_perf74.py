"""Octavus 3.4: exact accelerated collision and rubber-band regressions."""
import json
import math
import time
import unittest
from pathlib import Path

from dust_world64 import DustWorld64
from octavus_world import get_octavus_world

ROOT = Path(__file__).parent


class OctavusPerformanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.world = get_octavus_world()
        cls.map = json.loads((ROOT / 'static/maps/octavus.json').read_text())
        navigation = json.loads((ROOT / 'static/maps/octavus.navigation.json').read_text())
        cls.samples = list(cls.map['spawns']) + [
            node['p'] for node in navigation['nodes'][::13]
        ]

    def test_fast_ground_matches_original_triangle_raycast(self):
        for x, y, z in self.samples:
            with self.subTest(point=(x, y, z)):
                actual = self.world.ground_at(x, z, y)
                expected = DustWorld64.ground_at(self.world, x, z, y)
                if expected is None:
                    self.assertIsNone(actual)
                else:
                    self.assertIsNotNone(actual)
                    self.assertAlmostEqual(actual, expected, delta=.012)

    def test_wall_index_matches_original_filter(self):
        w = self.world
        for x, y, z in self.samples[::3]:
            a = x - .36
            b = z - .36
            c = x + .36
            d = z + .36
            brute = set()
            for tri in w.candidates(a, b, c, d):
                p, q, r = w.triangle(tri)
                u = tuple(q[i] - p[i] for i in range(3))
                v = tuple(r[i] - p[i] for i in range(3))
                nx = u[1]*v[2]-u[2]*v[1]
                ny = u[2]*v[0]-u[0]*v[2]
                nz = u[0]*v[1]-u[1]*v[0]
                nlen = math.sqrt(nx*nx+ny*ny+nz*nz)
                if nlen >= 1e-8 and abs(ny)/nlen <= .65:
                    minx = min(p[0], q[0], r[0])
                    maxx = max(p[0], q[0], r[0])
                    minz = min(p[2], q[2], r[2])
                    maxz = max(p[2], q[2], r[2])
                    if minx <= c and maxx >= a and minz <= d and maxz >= b:
                        brute.add(tri)
            actual = set(w.wall_candidates(a, b, c, d))
            self.assertFalse(
                actual.symmetric_difference(brute),
                f'at {x:.2f},{z:.2f}: expected {len(brute)} got {len(actual)}; '
                f'missing {sorted(brute-actual)[:8]}; extra {sorted(actual-brute)[:8]}'
            )

    def test_wall_bins_have_nearby_tris_only(self):
        # The original 10m broadphase contained many distant wall triangles.
        # The 2m index should return only intersecting ORIGINAL triangle AABBs.
        w = self.world
        self.assertEqual(w.wall_cell, 2.0)
        for x, y, z in self.samples[::4]:
            nearby = w.wall_candidates(x-.36, z-.36, x+.36, z+.36)
            for tri in nearby:
                k=tri*4
                xy=w.ground_xz_bounds
                self.assertLessEqual(xy[k],x+.36)
                self.assertGreaterEqual(xy[k+1],x-.36)
                self.assertLessEqual(xy[k+2],z+.36)
                self.assertGreaterEqual(xy[k+3],z-.36)

    def test_live_wall_resolve_parity_and_profile(self):
        from dust_motion65 import resolve_walls
        w = self.world

        class CoarseIndexedWorld:
            wall_cells = w.wall_cells
            wall_y_bounds = w.wall_y_bounds
            wall_normals = w.wall_normals
            triangle = staticmethod(w.triangle)

            @staticmethod
            def wall_candidates(x0, z0, x1, z1):
                return (tri for tri in w.candidates(x0, z0, x1, z1)
                        if w.wall_normals[tri*3+1] ** 2 <=
                        .65**2 * sum(v*v for v in w.wall_normals[tri*3:tri*3+3])
                        and sum(v*v for v in w.wall_normals[tri*3:tri*3+3]) >= 1e-16)

        cases = []
        for x,y,z in self.samples[:40]:
            for dx,dz in ((.05,.02),(.18,.13),(-.08,-.07)):
                cases.append((x+dx,y,z+dz,1.8,x,z,3.0,-2.0))
        coarse = CoarseIndexedWorld()
        t = time.perf_counter()
        old = [resolve_walls(coarse,*case) for case in cases]
        old_ms = (time.perf_counter()-t)*1000
        t = time.perf_counter()
        new = [resolve_walls(w,*case) for case in cases]
        new_ms = (time.perf_counter()-t)*1000
        for original,optimized in zip(old,new):
            for a,b in zip(original,optimized):
                self.assertAlmostEqual(a,b,delta=.0001)
        print(f'Octavus 120 wall resolves: coarse={old_ms:.2f}ms '
              f'2m={new_ms:.2f}ms speedup={old_ms/max(new_ms,1e-9):.1f}x')

    def test_reference_speed_profile(self):
        # No timing assertion; CI hosts vary. Report speedups for inspection.
        pts = self.samples[:24]
        start = time.perf_counter()
        reference = [DustWorld64.ground_at(self.world, x, z, y) for x, y, z in pts]
        slow = time.perf_counter() - start
        start = time.perf_counter()
        fast = [self.world.ground_at(x, z, y) for x, y, z in pts]
        elapsed = time.perf_counter() - start
        self.assertEqual(len(reference), len(fast))
        print(f'Octavus exact ground probes: reference={slow:.4f}s '
              f'accelerated={elapsed:.4f}s speedup={slow/max(elapsed, 1e-9):.1f}x')


if __name__ == '__main__':
    unittest.main()
