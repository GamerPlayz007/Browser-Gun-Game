"""CROSSFIRE-native Neon Zenith regression checks.

The imported map uses the original upstream footprint data, but game.js,
physics.js and the existing server run both maps. There must never be a
second WebGPU game, iframe or 100-MB bootstrap on the playable map path.
"""
import json
import unittest
from pathlib import Path

import server

ROOT=Path(__file__).resolve().parent
NEON=json.loads((ROOT/'static/maps/neon_zenith.json').read_text())
REGISTRY=json.loads((ROOT/'static/maps/index.json').read_text())


class NeonNativeMapTests(unittest.TestCase):
    def test_registration_and_engine(self):
        entries={entry['id']:entry for entry in REGISTRY['maps']}
        self.assertEqual(REGISTRY['default'],'cyberpunk')
        self.assertIn('neon_zenith',entries)
        self.assertTrue(entries['neon_zenith']['available'])
        self.assertEqual(entries['neon_zenith']['engine'],'crossfire-webgl')
        self.assertEqual(NEON['id'],'neon_zenith')
        self.assertEqual(NEON['engine'],'crossfire-webgl')
        self.assertNotIn('originalScene',NEON)

    def test_original_city_collision_and_spawns(self):
        self.assertGreater(len(NEON['boxes']),500)
        self.assertGreaterEqual(len(NEON['spawns']),8)
        bounds=NEON['bounds']
        for (x,y,z) in NEON['spawns']:
            self.assertTrue(bounds['minX']<x<bounds['maxX'])
            self.assertTrue(bounds['minZ']<z<bounds['maxZ'])
            self.assertAlmostEqual(y,0)
            for b in NEON['boxes']:
                intersects=(abs(x-b['x'])<b['w']/2+.32 and
                            abs(z-b['z'])<b['d']/2+.32 and
                            y<b['y']+b['h']-.015 and
                            y+1.8>b['y']+.015)
                self.assertFalse(intersects,(x,z,b))

    def test_same_multiplayer_stack(self):
        route=(ROOT/'static/map_runtime.js').read_text()
        gameplay=(ROOT/'static/game.js').read_text()
        world=(ROOT/'static/world.js').read_text()
        self.assertIn("import './game.js'",route)
        self.assertNotIn('import(asset)',route)
        self.assertNotIn('crossfire-mp',gameplay)
        self.assertIn("map.id==='neon_zenith'",world)
        self.assertIn('createNeonWorld',world)

    def test_control_beacon_in_correct_district(self):
        r=server.Room('ZEN','neon_zenith')
        r.mode='control'
        objective=r.snapshot(2.0)['objective']
        self.assertAlmostEqual(objective['x'],NEON['center']['x'])
        self.assertAlmostEqual(objective['z'],NEON['center']['z'])
        self.assertEqual(objective['y'],0.)

if __name__=='__main__':
    unittest.main()
