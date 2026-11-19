"""Native Octavus collision pilot contract and original-authored spawn tests."""
import json
from pathlib import Path
import math
import unittest

from octavus_native_collision91 import (
    NativeCollisionPilot91,native_point,preflight,REPORT,
    RADIUS,HEIGHT
)

class NativeCollisionPilotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.world=NativeCollisionPilot91()
        cls.report=preflight()

    def test_source_native_coordinate_basis(self):
        self.assertEqual(native_point((4096*8,4096*8,2816*8)),(0.,0.,0.))
        self.assertEqual(native_point((4104*8,4108*8,2820*8)),(.4,.2,.6))
        self.assertAlmostEqual(RADIUS,.34)
        self.assertAlmostEqual(HEIGHT,1.8)

    def test_architecture_only_not_live_collision(self):
        self.assertEqual(self.world.count,98358)
        self.assertEqual(self.world.vertices,123915)
        self.assertNotIn(1,self.world.surface_counter)
        self.assertEqual(self.world.float_sha256,self.report['float32TriangleSoupSHA256'])
        self.assertEqual(len(self.world.triangle_float_bytes),98358*36)
        self.assertEqual(self.report['sourceFormat'],'OCN2')
        self.assertFalse(self.report['liveMapModified'])
        self.assertFalse(self.report['clientServerParityVerified'])
        self.assertFalse(self.report['gameplayMotionParityVerified'])
        self.assertFalse(self.report['collisionCandidateHasOriginalSlot1Floor'])

    def test_indexed_broadphase_finds_source_architecture(self):
        self.assertGreater(self.world.cell_count,10)
        self.assertGreater(self.world.candidate_references,0)
        self.assertLess(self.world.candidate_references,10_000_000)
        rows=self.report['sourceSpawns']
        sample=rows[0]['worldPosition']
        candidates=list(self.world.candidates(sample[0]-1,sample[2]-1,
                                              sample[0]+1,sample[2]+1,
                                              sample[1]-2,sample[1]+2))
        self.assertGreater(len(candidates),0)
        self.assertLess(len(candidates),self.world.count)
        for i in candidates:
            tri=self.world.triangle(i)
            self.assertEqual(len(tri),3)
            self.assertTrue(all(math.isfinite(v) for p in tri for v in p))

    def test_all_original_spawns_scanned_not_assumed_safe(self):
        rows=self.report['sourceSpawns']
        self.assertEqual(len(rows),33)
        self.assertEqual(len({r['entityID'] for r in rows}),33)
        self.assertEqual(self.report['sourceSpawnCount'],33)
        n=sum(1 for r in rows if r['potentiallyUsable'])
        self.assertEqual(n,self.report['spawnPreflightCounts'].get('potentiallyUsable',0))
        self.assertGreaterEqual(sum(r['hasNearbyWalkableFloor'] for r in rows),20)
        self.assertTrue(all(r['sourceGeometryIncomplete'] for r in rows))
        self.assertTrue(all(r['floorCandidatesChecked']>=0 and
                            r['capsuleCandidatesChecked']>=0 for r in rows))

    def test_report_is_stable_binary_contract(self):
        saved=json.loads(Path(REPORT).read_text())
        self.assertEqual(saved['float32TriangleSoupSHA256'],self.world.float_sha256)
        self.assertEqual(saved['sourceSHA256'],self.world.source_archive_sha256)
        self.assertEqual(saved['sourceSpawns'],self.report['sourceSpawns'])
        self.assertEqual(saved['status'],'staging-only-not-live')

if __name__=="__main__":
    unittest.main()
