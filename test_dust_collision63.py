"""Verify Python server can read the authored Dust Corridor geometry."""
import shutil
import tempfile
import unittest
from pathlib import Path
from dust_collision63 import load_dust_collision63


class DustCollision63Tests(unittest.TestCase):
    def test_exact_mesh_data(self):
        collider=load_dust_collision63()
        self.assertGreater(collider.count,1000)
        self.assertEqual(len(collider.vertices),collider.count*36)
        self.assertEqual(len(collider.surfaces),collider.count)
        self.assertEqual(len(collider.triangle(0)),9)
        self.assertGreater(len(collider.metadata['spawns']['A']),0)
        self.assertGreater(len(collider.metadata['spawns']['B']),0)
        self.assertIn(collider.surface(0),range(12))

    def test_reject_corrupt_data(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)
            home=Path(__file__).parent/'static'/'maps'
            shutil.copy(home/'dust_collision63.meta.json',path)
            (path/'dust_collision63.bin.gz').write_bytes(b'invalid')
            with self.assertRaises((ValueError,EOFError,OSError)):
                load_dust_collision63(path)


if __name__ == '__main__':
    unittest.main()
