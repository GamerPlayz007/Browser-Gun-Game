"""Octavus Phase 1 source conversion and scale regression tests.

Run with: python -m unittest test_octavus_phase1 -v
No Red Eclipse installation, network access, or graphics card required.
"""
import base64
import json
from pathlib import Path
import struct
import unittest

from octavus_world import get_octavus_world

ROOT = Path(__file__).parent
MAP_DIR = ROOT / "static" / "maps"


class OctavusPhase1Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.map = json.loads((MAP_DIR / "octavus.json").read_text())
        cls.world = get_octavus_world()

    def test_map_and_world_dimensions(self):
        self.assertEqual(self.map["collisionFormat"], "OCT1")
        self.assertEqual(self.map["sourceTransform"]["objScale"], 0.05)
        self.assertEqual(self.map["size"], 409.6)
        self.assertEqual(self.world.count, 86500)
        self.assertEqual(self.world.bounds, self.map["playBounds"])
        self.assertEqual(self.world.cell, 10.0)
        self.assertEqual(self.map["sourceTransform"]["sourceTextureVertices"], 65636)

    def test_uv_package_keeps_all_authored_coordinates(self):
        encoded = "".join(
            (MAP_DIR / f"octavus_uv_{i:02d}.b64").read_text().strip()
            for i in range(1, 12)
        )
        data = base64.b64decode(encoded, validate=True)
        self.assertEqual(len(data), 1303600)
        magic, vertices, triangles = struct.unpack_from("<4sII", data)
        self.assertEqual((magic, vertices, triangles), (b"OCU1", 65636, 86500))
        self.assertEqual(struct.unpack_from("<ff", data, 12), (1024.0, 4097.0))
        offset = 12 + vertices * 8
        for p in range(offset, len(data), 3):
            self.assertLess(int.from_bytes(data[p:p+3], "little"), vertices)

    def test_source_clearance_for_all_respawn_candidates(self):
        safety = {}
        for side in ("A", "B"):
            usable = 0
            for point in self.map["spawnSets"][side]:
                x, y, z = point
                ground = self.world.ground_at(x, z, y)
                if (self.world.inside(x, z) and ground is not None
                        and abs(ground-y) < .18
                        and self.world.capsule_clear(point)):
                    usable += 1
            safety[side] = usable
        self.assertGreaterEqual(safety["A"], 6, safety)
        self.assertGreaterEqual(safety["B"], 6, safety)

    def test_registry_preserves_octavus(self):
        registry = json.loads((MAP_DIR / "index.json").read_text())
        entry = next(m for m in registry["maps"] if m["id"] == "octavus")
        self.assertTrue(entry["available"])
        self.assertEqual(entry["url"], "/static/maps/octavus.json")


if __name__ == "__main__":
    unittest.main()
