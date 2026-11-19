"""Source-native Octavus island wall tests; LIVE multiplayer unchanged."""
import json,math,unittest
from pathlib import Path
from octavus_native_boundary92 import NativeArenaBoundary92,MANIFEST,REPORT,audit

class OctavusIslandWallTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.world=NativeArenaBoundary92()
  cls.report=audit()
 def test_closed_wall_has_no_seam_or_hole(self):
  p=self.world.vertices;walls=self.world.segments
  self.assertEqual(len(p),58)
  self.assertEqual(len(walls),58)
  self.assertEqual(walls[-1][1],walls[0][0])
  for i,(a,b) in enumerate(walls):
   self.assertEqual(b,walls[(i+1)%len(walls)][0])
   self.assertGreater(math.dist(a,b),.08)
  self.assertGreater(self.world.perimeter,270.)
  self.assertLess(self.world.perimeter,420.)

 def test_original_visible_island_not_entire_409m_world(self):
  self.assertGreater(abs(self.world.area),7000.)
  self.assertLess(abs(self.world.area),12000.)
  self.assertTrue(self.world.allowed(0,0))
  for x,z in [(65,0),(-65,0),(0,65),(0,-65),(110,110),(-180,0)]:
   self.assertFalse(self.world.allowed(x,z))
  self.assertEqual(self.report['originalStartsInside'],33)
  self.assertEqual(self.report['sourcePixelOutlineVertices'],67)

 def test_nonleapable_height_and_independent_collision(self):
  self.assertEqual(self.world.base_y,-22)
  self.assertEqual(self.world.top_y,38)
  self.assertEqual(self.world.top_y-self.world.base_y,60)
  self.assertTrue(self.report['wallCollisionIsHeightIndependent'])
  start=(0.,0.)
  target=(90.,0.)
  x,z,hit=self.world.clip_horizontal(start,target)
  self.assertTrue(hit)
  self.assertTrue(self.world.allowed(x,z))
  self.assertLess(x,55)
  # The boundary collision does not accept or test a Y coordinate, so
  # jumping high cannot bypass the horizontal safe region.

 def test_radius_erosion_and_invalid_start(self):
  point=self.world.vertices[0]
  self.assertFalse(self.world.allowed(*point))
  self.assertFalse(self.world.allowed(*point,radius=.01))
  self.assertTrue(self.world.allowed(0,0))
  x,z,blocked=self.world.clip_horizontal((100,100),(0,0))
  self.assertTrue(blocked)
  self.assertEqual((x,z),(100,100))

 def test_original_start_clearance(self):
  for row in self.report['spawns']:
   self.assertTrue(row['capsuleInside'],row)
   self.assertGreater(row['wallDistance'],.36)
  self.assertEqual(self.report['originalStartsInside'],33)

 def test_continuous_sweeps_stay_inside(self):
  moves=self.report['motionFixtures']
  self.assertGreaterEqual(len(moves),100)
  self.assertGreaterEqual(self.report['blockedMotionFixtures'],90)
  for row in moves:
   x,z,blocked=self.world.clip_horizontal(row['start'],row['end'])
   self.assertAlmostEqual(x,row['clippedEnd'][0],places=4)
   self.assertAlmostEqual(z,row['clippedEnd'][1],places=4)
   self.assertEqual(blocked,row['blocked'])
   self.assertTrue(self.world.allowed(x,z))

 def test_footprint_metadata_not_live(self):
  m=json.loads(Path(MANIFEST).read_text())
  self.assertFalse(m['liveMapModified'])
  self.assertEqual(m['gameplayOutsideAllowed'],False)
  self.assertEqual(m['sourceRevision'],829)
  self.assertEqual(m['tracing']['outwardMarginPixels'],7)
  self.assertEqual(m['imageDimensions'],[548,469])
  self.assertFalse(self.report['clientMovementHookedIntoLiveGame'])
  self.assertFalse(self.report['serverMovementHookedIntoLiveGame'])

if __name__=='__main__':
 unittest.main()
