"""Dust Corridor Stage 6.4 authoritative-map preflight and parity tests."""
import asyncio
import json
from pathlib import Path
import unittest

from aiohttp.test_utils import TestClient, TestServer
import server
from dust_world64 import DustWorld64, closest_on_triangle, ray_triangle, get_dust_world64

ROOT=Path(__file__).parent

class DustWorld64Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.world=get_dust_world64()

    def test_original_triangle_mesh_and_boundaries(self):
        world=self.world
        self.assertEqual(world.count,96588)
        self.assertEqual(len(world.sha256),64)
        self.assertTrue(world.inside(0,0))
        self.assertTrue(world.inside(26,-58))
        self.assertFalse(world.inside(44,0))
        self.assertFalse(world.inside(0,75))
        self.assertFalse(world.inside(-43,0))
        self.assertEqual(world.metadata()['available'],False)
        self.assertEqual(world.metadata()['multiplayer'],False)

    def test_surface_raycast_and_safe_source_spawns(self):
        world=self.world
        ray=world.raycast((0,5,-71),(0,-2,-71))
        self.assertIsNotNone(ray,'Expected original road ground at x=0, z=-71')
        self.assertLess(abs(ray['point'][1]),.7)
        for side in ('A','B'):
            selected=world.validated_spawns()[side]
            self.assertGreaterEqual(len(selected['safeIndices']),1,
              'At least one untouched source spawn must pass the server checks')
            for index in selected['safeIndices']:
                pos=world.spawns[side][index]
                self.assertTrue(world.inside(pos[0],pos[2]))
                self.assertTrue(world.capsule_clear(pos))
                ground=world.ground_at(pos[0],pos[2],pos[1])
                self.assertIsNotNone(ground)
                self.assertLess(abs(pos[1]-ground),.35)

    def test_closest_triangle_and_segment_intersection(self):
        tri=((0.,0.,0.),(2.,0.,0.),(0.,0.,2.))
        self.assertAlmostEqual(closest_on_triangle((.5,1,.5),*tri)[1],0)
        self.assertAlmostEqual(ray_triangle((.5,1,.5),(0,-2,0),*tri),.5)
        self.assertIsNone(ray_triangle((3,1,3),(0,-2,0),*tri))

    def test_source_js_bvh_parity(self):
        fixture=ROOT/'stage64_probe_fixture.json'
        if not fixture.exists():
            self.skipTest('JS source BVH parity fixtures generated during CI')
        data=json.loads(fixture.read_text())
        self.assertEqual(data['sourceTriangles'],self.world.count)
        self.assertGreaterEqual(len(data['probes']),40)
        for probe in data['probes']:
            result=self.world.raycast(probe['start'],probe['end'])
            expected=probe['hit']
            with self.subTest(probe=probe['label']):
                self.assertEqual(result is not None,expected is not None)
                if expected:
                    self.assertAlmostEqual(result['fraction'],expected['fraction'],delta=2e-4)
                    # If two triangles are coplanar and share an edge, source
                    # materials can differ; distance, not material, is what
                    # makes the path physically correct.


class DustServer64Tests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        server.rooms.clear()
        self.client=TestClient(TestServer(server.make_app()))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()
        server.rooms.clear()

    async def test_preview_contract_never_enables_online_rooms(self):
        response=await self.client.get('/api/dust-corridor/preview64')
        self.assertEqual(response.status,200)
        result=await response.json()
        self.assertFalse(result['multiplayer'])
        self.assertFalse(result['available'])
        self.assertEqual(result['triangleCount'],get_dust_world64().count)
        self.assertIn('playBounds',result)
        self.assertGreater(len(result['validatedSpawns']['A']['safeIndices']),0)
        self.assertGreater(len(result['validatedSpawns']['B']['safeIndices']),0)
        registry=await (await self.client.get('/api/maps')).json()
        self.assertNotIn('dust_corridor',{m['id'] for m in registry['maps'] if m['available']})
        forbidden=await self.client.post('/api/rooms',json={'mapId':'dust_corridor'})
        self.assertEqual(forbidden.status,400)


if __name__=='__main__':
    unittest.main()
