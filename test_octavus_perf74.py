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
                    brute.add(tri)
            self.assertEqual(set(w.wall_candidates(a, b, c, d)), brute)

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
