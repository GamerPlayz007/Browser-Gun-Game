"""Phase 1 native Octavus MAPZ v59 decoder regression tests."""
import unittest
from scripts.decode_octavus_octree76 import (
    decode_octavus, Cursor, skip_vslots, parse_octree, FormatError
)

class OctavusSourceOctreeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = decode_octavus()

    def test_source_metadata_and_octree_integrity(self):
        d = self.result
        self.assertEqual(d["format"], "OCTAVUS-NATIVE-OCTREE76")
        self.assertEqual(d["sourceRevision"], 829)
        self.assertEqual(d["worldSize"], 8192)
        self.assertFalse(d["liveMapModified"])
        self.assertEqual(
            d["octree"]["leaves"],
            d["octree"]["empty"]+d["octree"]["solid"]+d["octree"]["deformed"]
        )
        self.assertLess(d["octree"]["endOffset"], 14_987_053)
        self.assertGreater(d["octree"]["explicitFaces"], 0)

    def test_empty_synthetic_octree_has_eight_roots(self):
        # 8 empty root leaves; 12 source texture bytes per leaf.
        node = bytes((1,)) + bytes(12)
        r = Cursor(node * 8)
        tree = parse_octree(r, 8192)
        self.assertEqual(tree["empty"], 8)
        self.assertEqual(tree["leaves"], 8)
        self.assertEqual(tree["endOffset"], 104)

    def test_bad_nested_octree_is_rejected(self):
        with self.assertRaises(FormatError):
            parse_octree(Cursor(bytes((0,))), 8192)

    def test_truncated_vslot_is_rejected(self):
        r = Cursor(bytes((0,0,0,0)))
        with self.assertRaises(FormatError):
            skip_vslots(r, 1)

if __name__ == "__main__":
    unittest.main()
