"""Stage 3.1 - native server map registry / integration smoke tests.

Run after: CROSSFIRE_STAGE31=1 python build_map.py
"""
import json
import math
import unittest
from pathlib import Path
from map_registry import ARENAS, DEFAULT, Arena, top_at, bottom_at

ROOT = Path(__file__).parent

class Stage31Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.old = json.loads((ROOT/'static/maps/cyberpunk.json').read_text())
        cls.new = json.loads((ROOT/'static/maps/cyberpunk-next.json').read_text())

    def test_default_not_replaced(self):
        self.assertEqual(DEFAULT.id, 'cyberpunk')
        self.assertEqual(DEFAULT.data, self.old)
        self.assertEqual(len(self.old['routes']),12)
        self.assertEqual(self.old['revision'],'02.5')

    def test_stage31_loads_via_real_server_registry(self):
        self.assertIn('cyberpunk-next',ARENAS)
        arena = ARENAS['cyberpunk-next']
        self.assertIsInstance(arena,Arena)
        self.assertEqual(arena.id,'cyberpunk-next')
        self.assertEqual(arena.data,self.new)
        self.assertEqual(self.new['size'],120)
        self.assertEqual(self.new['weapons'],self.old['weapons'])
        self.assertEqual(len(self.new['spawns']),8)

    def test_original_routes_and_arcade_registered(self):
        ids = {r['id'] for r in self.new['routes']}
        self.assertTrue({f'{kind}{i}' for kind in 'GIU' for i in range(1,5)} <= ids)
        self.assertIn('PD-01',ids)
        arcade = next(r for r in self.new['routes'] if r['id']=='PD-01')
        self.assertEqual((arcade['fromZone'],arcade['toZone']),('transit','plaza'))
        self.assertEqual(arcade['points'][-1],[2,0,22])
        self.assertEqual(len(self.new['stairs']),6)

    def test_compiled_data_is_finite_and_valid(self):
        for box in self.new['boxes']:
            for key in ('x','y','z','w','h','d'):
                self.assertTrue(math.isfinite(box[key]),(key,box))
            self.assertGreater(min(box['w'],box['h'],box['d']),0)
            if box.get('kind')=='ramp':
                self.assertTrue(math.isfinite(top_at(box,box['x'],box['z'])))
                self.assertLess(bottom_at(box,box['x'],box['z']),top_at(box,box['x'],box['z']))

    def test_render_and_collision_layers_separated(self):
        self.assertGreater(len(self.new['decor']),len(self.old['decor']))
        self.assertTrue(any(b.get('stage5VisualOnly') for b in self.new['decor']))
        self.assertTrue(any(b.get('stage6VisualOnly') for b in self.new['decor']))
        self.assertFalse(any(b.get('stage5VisualOnly') or b.get('stage6VisualOnly') for b in self.new['boxes']))
        self.assertTrue(self.new['stage31']['legacy_map_unchanged'])

    def test_server_accepts_separate_rooms(self):
        from server import Room
        legacy=Room('LEGACY','cyberpunk')
        expanded=Room('EXPANDED','cyberpunk-next')
        self.assertEqual(legacy.arena.data['size'],80)
        self.assertEqual(expanded.arena.data['size'],120)
        self.assertNotEqual(legacy.arena.id,expanded.arena.id)
        self.assertEqual(len(expanded.arena.boxes),len(self.new['boxes']))

if __name__=='__main__':
    unittest.main()
