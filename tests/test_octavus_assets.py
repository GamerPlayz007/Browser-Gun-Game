"""Stage 2.7: verify actual locally packaged native Red Eclipse props.

These tests run in Render's startup smoke suite without WebGL, npm, downloads
or external network access; JavaScript/Three.js tests separately verify model
transforms and the instanced renderer.
"""
import base64
import json
import re
import unittest
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PROPS=ROOT/'static/maps/octavus_props'
EXPECTED={
    'misc/lowpoly_eagle':(8,1805,1532),
    'luckystrike/door1':(4,36,12),
    'misc/radio_dish':(1,5370,3786),
}

class OriginalOctavusAssetsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=json.loads((ROOT/'static/maps/octavus.props.json').read_text())
        cls.entities=json.loads((ROOT/'static/maps/octavus.native-entities.json').read_text())
        cls.map=json.loads((ROOT/'static/maps/octavus.json').read_text())
        cfg=(ROOT/'static/maps/octavus.original.cfg').read_text()
        cls.aliases=re.findall(r'^mapmodel\\s+"([^"]+)"',cfg,re.M)

    def test_thirteen_authored_placements_use_recovered_sources(self):
        counts=Counter()
        for entry in self.entities['visualEntities']:
            if entry.get('type')=='mapmodel' and isinstance(entry.get('attrs'),list):
                index=entry['attrs'][0]
                if isinstance(index,int) and 0<=index<len(self.aliases):
                    counts[self.aliases[index]]+=1
        for alias,(instances,_,_) in EXPECTED.items():
            self.assertEqual(counts[alias],instances)
            self.assertFalse(self.data['models'][alias].get('missing'))
            self.assertEqual(self.data['models'][alias]['codec'],'obj')

    def test_converted_objs_retain_full_static_source_topology(self):
        for alias,(_,vertices,triangles) in EXPECTED.items():
            info=self.data['models'][alias]
            path=ROOT/info['url'].lstrip('/')
            self.assertTrue(path.is_file(),alias)
            self.assertTrue(path.resolve().is_relative_to(PROPS.resolve()))
            n_verts=n_faces=0
            for line in path.read_text().splitlines():
                if line.startswith('v '):n_verts+=1
                elif line.startswith('f '):n_faces+=1
            self.assertEqual(n_verts,vertices,alias)
            self.assertEqual(n_faces,triangles,alias)
            self.assertEqual(info['vertices'],vertices)
            self.assertEqual(info['triangles'],triangles)

    def test_original_skin_bundles_are_local_pngs(self):
        for alias in ('misc/lowpoly_eagle','misc/radio_dish'):
            info=self.data['models'][alias]
            url=info['skinB64Url']
            path=ROOT/url.lstrip('/')
            self.assertTrue(path.is_file())
            self.assertTrue(path.resolve().is_relative_to(PROPS.resolve()))
            data=base64.b64decode(path.read_text().strip(),validate=True)
            self.assertTrue(data.startswith(b'\\x89PNG\\r\\n\\x1a\\n'))
        self.assertTrue(self.data['models']['misc/radio_dish']['skinHighOnly'])

    def test_source_credit_and_missing_original_door_texture_are_explicit(self):
        license_text=(ROOT/'static/maps/OCTAVUS_ATTRIBUTION.md').read_text()
        for alias in EXPECTED:
            self.assertIn(alias,license_text)
        self.assertIn('CC BY-SA 4.0',license_text)
        door=self.data['models']['luckystrike/door1']
        self.assertIn('not yet packaged',door['textureStatus'])
        self.assertEqual(door['yaw'],90)

if __name__=='__main__':
    unittest.main()
