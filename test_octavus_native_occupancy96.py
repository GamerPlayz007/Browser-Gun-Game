"""Octavus source-octree SOLID/EMPTY/NORMAL staging point-query tests."""
from pathlib import Path
import gzip
import hashlib
import json
import unittest
from scripts.build_octavus_occupancy96 import NativeOccupancy96,OUTPUT,REPORT,HEADER,STRUCT

class OriginalNativeOccupancyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.meta=json.loads(Path(REPORT).read_text())
        cls.gzipdata=Path(OUTPUT).read_bytes()
        cls.index=NativeOccupancy96(gzip.decompress(cls.gzipdata))
    def test_binary_source_integrity(self):
        self.assertEqual(hashlib.sha256(self.gzipdata).hexdigest(),
                         self.meta["compressedSha256"])
        self.assertEqual(self.index.count,self.meta["occupancyCells"])
        self.assertEqual(self.meta["sourceRevision"],829)
        self.assertEqual(self.meta["binaryMagic"],"OCO1")
        self.assertEqual(self.meta["cellRecordBytes"],STRUCT.size)
        self.assertEqual(self.meta["sourceOctreeLeaves"],704159)
        self.assertGreaterEqual(self.index.count,1000)
        self.assertEqual(self.meta["sourceQuerySampleCount"],
                         len(self.meta["actualSourceOccupancyFixtures"]))
    def test_original_sampled_leaf_kind_and_size(self):
        for row in self.meta["actualSourceOccupancyFixtures"]:
            q=self.index.lookup(row["native"])
            self.assertEqual(q["kind"] if q else None,row["kind"])
            self.assertEqual(q["size"] if q else None,row["size"])
    def test_full_solid_not_same_as_deformed(self):
        by=self.meta["cellCounts"]
        self.assertGreater(by["solid"],0)
        self.assertGreater(by["deformed"],0)
        self.assertGreater(by["empty"],0)
        self.assertEqual(sum(by.values()),self.index.count)
        self.assertFalse(self.meta["normalCubeCollisionProven"])
        self.assertFalse(self.meta["fullSourceSolidCollisionReady"])
    def test_never_changes_live_game(self):
        self.assertFalse(self.meta["liveMapModified"])
        self.assertFalse(self.meta["clientServerControllerParity"])
        self.assertIsNone(self.index.lookup((-1,4096,2816)))
        self.assertIsNone(self.index.lookup((8192,4096,2816)))

if __name__=="__main__":
    unittest.main()
