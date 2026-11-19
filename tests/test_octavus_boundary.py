"""Stage 2.4: the Octavus rendered wall matches authoritative play bounds.

Run: python -m unittest discover -s tests -p 'test_octavus_*.py' -v
These checks are intentionally cheap; startup should not decode the full map.
"""
import json
import unittest
from pathlib import Path
from types import SimpleNamespace

from dust_world64 import DustWorld64
from octavus_world import configured_play_bounds

ROOT=Path(__file__).resolve().parents[1]


def arena():
    return json.loads((ROOT/'static/maps/octavus.json').read_text(encoding='utf-8'))


class OctavusBoundaryTests(unittest.TestCase):
    def test_same_bounds_for_client_and_authoritative_server(self):
        self.assertEqual(configured_play_bounds(), arena()['playBounds'])

    def test_compact_arena_is_strictly_smaller_than_source_map(self):
        data=arena()
        b=data['playBounds']
        self.assertAlmostEqual(b['x1']-b['x0'],204.8)
        self.assertAlmostEqual(b['z1']-b['z0'],204.8)
        self.assertLess(b['x1']-b['x0'],data['sourceTransform']['visualSpan'])
        self.assertEqual(data['collisionTriangles'],86500)
        self.assertEqual(data['sourceTransform']['sourceTriangles'],86500)

    def test_every_spawn_inside_compact_perimeter_with_capsule_margin(self):
        data=arena()
        world=SimpleNamespace(bounds=data['playBounds'])
        self.assertEqual(len(data['spawns']),data['spawnValidation']['safeCount'])
        for x,y,z in data['spawns']:
            with self.subTest(spawn=(x,y,z)):
                self.assertTrue(DustWorld64.inside(world,x,z,.34))

    def test_outside_and_boundary_edge_cannot_be_played(self):
        b=arena()['playBounds']
        world=SimpleNamespace(bounds=b)
        self.assertTrue(DustWorld64.inside(world,0,0,.34))
        self.assertFalse(DustWorld64.inside(world,b['x1'],0,.34))
        self.assertFalse(DustWorld64.inside(world,b['x0'],0,.34))
        self.assertFalse(DustWorld64.inside(world,0,b['z1'],.34))
        self.assertFalse(DustWorld64.inside(world,0,b['z0'],.34))

    def test_wall_reaches_beyond_possible_jump_height(self):
        b=arena()['arenaBoundary']
        self.assertEqual(b['serverCollision'],'playBounds')
        self.assertGreaterEqual(b['topY']-b['bottomY'],32)
        self.assertGreaterEqual(b['topY'],24)
        self.assertLessEqual(b['bottomY'],-12)
        self.assertGreaterEqual(b['thickness'],1)

    def test_visual_scene_wires_perimeter_lifecycle(self):
        code=(ROOT/'static/octavus_match.js').read_text(encoding='utf-8')
        boundary=(ROOT/'static/octavus_boundary.js').read_text(encoding='utf-8')
        self.assertIn('createOctavusBoundary(scene,map)',code)
        self.assertIn('boundary.dispose()',code)
        self.assertIn('wallCount:4',boundary)

    def test_25_visual_crop_does_not_change_authoritative_source_collision(self):
        match=(ROOT/'static/octavus_match.js').read_text(encoding='utf-8')
        preview=(ROOT/'static/octavus_preview.js').read_text(encoding='utf-8')
        self.assertIn('const source=collisionSource(packed,map)',match)
        self.assertIn('soup:{count:triangle,positions,surfaces}',match)
        self.assertIn('createOctavusScene(packed,materials,scene,authoredUV,true,null,map.playBounds)',match)
        self.assertIn('sourceUV.indices[faceOffset+i+t]',preview)
        self.assertIn('renderedTriangleCount',preview)
        self.assertIn('visibleSlots:[...renderedSlots.keys()]',preview)

    def test_25_quality_profiles_can_reload_without_rejoining(self):
        match=(ROOT/'static/octavus_match.js').read_text(encoding='utf-8')
        preview=(ROOT/'static/octavus_preview.js').read_text(encoding='utf-8')
        self.assertIn('requestMedia(value)',match)
        self.assertIn('loadOctavusMaterialLibrary(tier,visual.visibleSlots)',match)
        self.assertIn('materialInstances.length=0',preview)
        self.assertIn('fallbackUv',preview)
        self.assertIn('previous.dispose?.()',preview)

    def test_26_original_mapmodels_use_gpu_instancing_not_clone_draws(self):
        props=(ROOT/'static/octavus_props.js').read_text(encoding='utf-8')
        match=(ROOT/'static/octavus_match.js').read_text(encoding='utf-8')
        self.assertIn('new THREE.InstancedMesh(',props)
        self.assertIn('mesh.count=visible.length',props)
        self.assertIn('mesh.computeBoundingSphere()',props)
        self.assertIn('octavusPropInside(e.sourcePosition,playBounds)',props)
        self.assertNotIn('prototype.clone(true)',props)
        self.assertIn('createOctavusProps(scene,quality,map.playBounds)',match)
        self.assertIn('get nativePropDrawBatches()',match)

    def test_26_f8_playtest_report_includes_real_gpu_budget(self):
        game=(ROOT/'static/game.js').read_text(encoding='utf-8')
        self.assertIn('Actual WebGL draw calls (last frame)',game)
        self.assertIn('Octavus original prop draw objects (before instancing)',game)
        self.assertIn('Octavus instanced prop draw batches',game)
        self.assertIn('get gpuFrameDrawCalls()',game)


if __name__=='__main__':
    unittest.main()
