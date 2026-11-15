"""CROSSFIRE single map registry / current 120 m city tests."""
import json,math,unittest
from pathlib import Path
import map_registry as registry
from map_registry import ARENAS, DEFAULT, top_at, bottom_at

ROOT=Path(__file__).parent

class LiveCityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.map=json.loads((ROOT/'static/maps/cyberpunk.json').read_text())

    def test_single_playable_arena(self):
        self.assertEqual(set(ARENAS),{'cyberpunk'})
        self.assertEqual(registry.REGISTRY['default'],'cyberpunk')
        self.assertEqual(DEFAULT.data,self.map)
        self.assertEqual(self.map['size'],120)
        self.assertEqual(self.map['revision'],'03.2')
        self.assertFalse((ROOT/'static/maps/cyberpunk-next.json').exists())

    def test_routes_and_spawns(self):
        routes={r['id'] for r in self.map['routes']}
        self.assertEqual(routes,{f'{kind}{i}' for kind in 'GIU' for i in range(1,5)}|{'PD-01'})
        self.assertEqual(len(self.map['stairs']),6)
        self.assertEqual(len(self.map['spawns']),8)
        self.assertGreaterEqual(len(self.map['boxes']),650)
        self.assertEqual(json.loads((ROOT/'static/map.json').read_text()),self.map)

    def test_noncolliding_layers(self):
        self.assertTrue(any(b.get('stage5VisualOnly') for b in self.map['decor']))
        self.assertTrue(any(b.get('stage6VisualOnly') for b in self.map['decor']))
        self.assertFalse(any(b.get('stage5VisualOnly') or b.get('stage6VisualOnly') for b in self.map['boxes']))
        for box in self.map['boxes']:
            self.assertGreater(min(box[k] for k in ('w','h','d')),0)
            self.assertTrue(all(math.isfinite(box[k]) for k in ('x','y','z','w','h','d')))
            if box.get('kind')=='ramp':
                self.assertLess(bottom_at(box,box['x'],box['z']),top_at(box,box['x'],box['z']))

    def test_single_room_uses_live_map(self):
        from server import Room
        room=Room('LIVE')
        self.assertEqual(room.arena.id,'cyberpunk')
        self.assertEqual(room.arena.data['size'],120)
        self.assertEqual(len(room.arena.boxes),len(self.map['boxes']))

if __name__=='__main__':unittest.main()
