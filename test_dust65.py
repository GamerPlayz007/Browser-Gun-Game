"""Native Dust Corridor 6.5 multiplayer and Python/JS movement parity."""
import asyncio
import json
import math
from pathlib import Path
import unittest

from aiohttp.test_utils import TestClient, TestServer
import server
from dust_motion65 import dust_step65
from dust_world64 import get_dust_world64

ROOT=Path(__file__).parent

class DustPhysics65Tests(unittest.TestCase):
    def test_authoritative_map_registry_and_original_mesh(self):
        dust=server.ARENAS['dust_corridor']
        self.assertEqual(dust.id,'dust_corridor')
        self.assertTrue(dust.data['dustOriginal'])
        self.assertEqual(dust.data['collisionFormat'],'DUSTCOL3')
        self.assertEqual(dust.data['collisionSha256'],get_dust_world64().sha256)
        self.assertEqual(dust.data['spawns'],[dust.data['spawnSets'][side][i]
            for side in ('A','B') for i in dust.data['validatedSpawns'][side]['safeIndices']])
        self.assertFalse(dust.boxes,'No fake box-based collisions replacing original mesh')
        self.assertIn('cyberpunk',server.ARENAS)
        self.assertIn('neon_zenith',server.ARENAS)

    def test_client_and_server_motion_replay(self):
        file=ROOT/'stage65_replay_fixture.json'
        if not file.exists():self.skipTest('JS motion replay is generated in CI')
        f=json.loads(file.read_text())
        self.assertEqual(f['sourceTriangles'],get_dust_world64().count)
        self.assertGreaterEqual(len(f['trace']),150)
        x,y,z=f['spawn']
        p=dict(x=x,y=y,z=z,vx=0.,vy=0.,vz=0.,yaw=math.pi,
            grounded=True,crouch=False,slide_until=0.,slide_ready=0.,
            jump_held=False,slide_held=False,jump_consumed=False,
            jump_cut=False,interact_held=False,wall_kick_used=False,
            mantle=None,lean=0.,input={},last_input=0.)
        for tick,(cmd,expected) in enumerate(zip(f['commands'],f['trace'])):
            p['input']=cmd['input'];p['last_input']=cmd['now'];p['yaw']=cmd['yaw']
            dust_step65(p,1/60,cmd['now'],server.WEAPONS[0])
            with self.subTest(tick=tick):
                for key in ('x','y','z'):
                    self.assertAlmostEqual(p[key],expected[key],delta=.08,
                        msg=f'Tick {tick} {key}: Python={p[key]} JS={expected[key]}')
                self.assertEqual(p['grounded'],expected['grounded'])

    def test_server_perimeter_and_source_occlusion(self):
        world=get_dust_world64()
        p=dict(x=42.,y=world.ground_at(42,0,0) or .03,z=0.,vx=8.2,
            vy=0.,vz=0.,yaw=-math.pi/2,grounded=True,
            crouch=False,slide_until=0.,slide_ready=0.,jump_held=False,
            slide_held=False,input={'w':True,'sprint':True},last_input=1.,
            jump_consumed=False,jump_cut=False)
        for i in range(70):
            p['last_input']=1.+i/60
            dust_step65(p,1/60,1.+i/60,server.WEAPONS[0])
            self.assertLessEqual(p['x'],42.66)
        self.assertIsNotNone(world.raycast((0,2,-30),(65,2,-30)),
                             'Source perimeter wall must occlude a ray crossing the district boundary')


class DustNetwork65Tests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        server.rooms.clear()
        self.client=TestClient(TestServer(server.make_app()))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()
        server.rooms.clear()

    async def read_type(self,ws,kind):
        for _ in range(100):
            msg=await ws.receive_json(timeout=5)
            if msg.get('type')==kind:return msg
        raise AssertionError(f'No {kind} frame received')

    async def test_two_players_same_source_arena(self):
        resp=await self.client.post('/api/rooms',json={'mapId':'dust_corridor'})
        self.assertEqual(resp.status,200)
        room_data=await resp.json();code=room_data['room']
        a=await self.client.ws_connect('/ws/'+code+'?name=Alpha')
        b=await self.client.ws_connect('/ws/'+code+'?name=Bravo')
        try:
            wa=await self.read_type(a,'welcome')
            wb=await self.read_type(b,'welcome')
            self.assertEqual(wa['mapId'],'dust_corridor')
            self.assertEqual(wb['mapId'],'dust_corridor')
            self.assertNotEqual(wa['id'],wb['id'])
            room=server.rooms[code]
            self.assertEqual(room.arena.id,'dust_corridor')
            self.assertEqual(len(room.players),2)
            state=await self.read_type(a,'state')
            self.assertEqual(state['mapId'],'dust_corridor')
            self.assertEqual(len(state['players']),2)
            player=room.players[wa['id']]
            original_z=player['z']
            await a.send_json({'type':'input','seq':1,'spawn':player['spawn'],
                               'yaw':math.pi,'pitch':0.,'w':True})
            for _ in range(50):
                await asyncio.sleep(.012)
                if player['seq']>=1:break
            self.assertGreaterEqual(player['seq'],1)
            self.assertLess(math.dist(
                (player['x'],player['z']),tuple(state['players'][0][key] for key in ('x','z'))),3)
            self.assertTrue(get_dust_world64().inside(player['x'],player['z']))
            self.assertTrue(math.isfinite(player['y']))
            # Shared map retains the same authoritative source checksum.
            self.assertEqual(room.arena.data['collisionSha256'],get_dust_world64().sha256)
        finally:
            await a.close();await b.close()


if __name__=='__main__':
    unittest.main()
