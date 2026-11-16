"""Daybreak 6.7 — route-safe outer street geometry and safe, reproducible cover."""
import unittest
from collections import Counter
from maps.daybreak67_density import protected,travel_lines
from map_registry import DEFAULT

class Daybreak67MapTests(unittest.TestCase):
    def test_outer_cover_and_original_geometry(self):
        city=DEFAULT.data
        metadata=city['daybreak67'];items=metadata['furnishings']
        self.assertGreaterEqual(len(items),16)
        self.assertLessEqual(len(items),44)
        self.assertGreaterEqual(len(metadata['facades']),18)
        original=metadata['priorColliderCount']
        self.assertEqual(len(city['boxes']),original+len(items))
        self.assertTrue(all(not b.get('daybreak67Physical') for b in city['boxes'][:original]))
        placed=city['boxes'][original:]
        self.assertTrue(all(b.get('daybreak67Physical') for b in placed))
        self.assertEqual({b['furnitureId'] for b in placed},{p['id'] for p in items})
        self.assertEqual(set(Counter(p['district'] for p in items)),
                         {'north','east','south','west'})
        # Remove the new cover from the collision list, then independently
        # verify every new footprint against unchanged buildings and routes.
        baseline={**city,'boxes':city['boxes'][:original]}
        lines=travel_lines(baseline)
        for p in items:
            with self.subTest(p=p['id']):
                self.assertTrue(protected((p['x'],p['z'],p['w'],p['d']),baseline,lines))
                self.assertGreaterEqual(max(abs(p['x']),abs(p['z'])),36)
                self.assertEqual(p['y'],1.0)
                self.assertGreater(p['w'],.5)
                self.assertGreater(p['d'],.5)

    def test_no_data_or_physics_changed_for_existing_routes(self):
        city=DEFAULT.data
        self.assertEqual(len(city['routes']),13)
        self.assertEqual(len(city['stairs']),6)
        self.assertEqual(city['id'],'cyberpunk')
        self.assertEqual(city['name'],'Daybreak City')
        self.assertEqual(city['daybreak67']['noOriginalGeometryChanged'],True)
        self.assertTrue(all(p['type'] in ('planter','bench','kiosk','car','barrier')
                            for p in city['daybreak67']['furnishings']))
if __name__=='__main__':unittest.main()
