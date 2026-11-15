"""CROSSFIRE V3 release candidate: cosmetic, rejoin and manifest contracts."""
import asyncio
import json
import unittest
from pathlib import Path
from aiohttp.test_utils import TestClient,TestServer

import server
from cosmetics56 import PALETTE56,normalize_skin56

ROOT=Path(__file__).parent
VERSION='3.0.0-rc.2'
PHASE='05.7'
BADGE='V3.0 RC2'

class Release56Contracts(unittest.TestCase):
    def test_skin_ids_are_strictly_validated(self):
        self.assertEqual(len(PALETTE56),4)
        for i in range(4):self.assertEqual(normalize_skin56(i),i)
        for raw in (-1,4,999,True,False,None,0.5,'2','abc',{},[]):
            self.assertEqual(normalize_skin56(raw),0)

    def test_room_skin_is_only_changed_by_its_player(self):
        room=server.Room('SKIN56')
        alice=server.new_player(room,'a','Alpha',100,skin=3)
        bob=server.new_player(room,'b','Bravo',100,skin=2)
        self.assertEqual((alice['skin'],bob['skin']),(3,2))
        self.assertFalse(room.set_skin56('missing',0))
        for value in (-1,4,True,None,'3',{}):
            self.assertFalse(room.set_skin56('a',value))
        self.assertEqual(alice['skin'],3)
        self.assertTrue(room.set_skin56('b',1))
        self.assertEqual(alice['skin'],3)
        self.assertEqual(room.snapshot(100)['players'][1]['skin'],1)
        self.assertTrue(room.start('a',101))
        self.assertEqual(alice['skin'],3,'A new round keeps visual-only preferences')

    def test_manifest_lobby_and_release_contracts(self):
        package=json.loads((ROOT/'package.json').read_text())
        lock=json.loads((ROOT/'package-lock.json').read_text())
        html=(ROOT/'static/index.html').read_text()
        game=(ROOT/'static/game.js').read_text()
        self.assertEqual(package['version'],VERSION)
        self.assertEqual(lock['version'],VERSION)
        self.assertEqual(lock['packages']['']['version'],VERSION)
        self.assertEqual(server.RELEASE,VERSION)
        self.assertEqual(server.PHASE,PHASE)
        self.assertIn('<sup>'+BADGE+'</sup>',html)
        for id in ('skin56-home','skin56-room','rejoin56'):
            self.assertIn('id="'+id+'"',html)
        self.assertIn("from './preferences56.js'",game)
        self.assertIn("setPlayerSkin56(g,visualSkin)",game)
        self.assertIn("disconnect('Connection closed.",game)
        self.assertIn("safeRead56('cf-name','')",game)
        self.assertNotIn('localStorage.',game)
        self.assertIn('node test_release56.mjs',package['scripts']['test'])

class Live56Transport(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        server.rooms.clear()
        self.client=TestClient(TestServer(server.make_app()))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()
        server.rooms.clear()

    async def test_server_health_and_websocket_skin_updates(self):
        health=await (await self.client.get('/health')).json()
        self.assertEqual((health['release'],health['phase']),(VERSION,PHASE))
        self.assertIn('buildCommit',health)
        response=await self.client.post('/api/rooms',json={'mapId':'cyberpunk'})
        self.assertEqual(response.status,200)
        code=(await response.json())['room']
        first=await self.client.ws_connect('/ws/'+code+'?name=Alpha&skin=3')
        owner=await first.receive_json(timeout=2)
        second=await self.client.ws_connect('/ws/'+code+'?name=Bravo&skin=2')
        guest=await second.receive_json(timeout=2)
        self.assertEqual(server.rooms[code].players[owner['id']]['skin'],3)
        self.assertEqual(server.rooms[code].players[guest['id']]['skin'],2)
        await second.send_json({'type':'skin','skin':1,'id':owner['id']})
        await asyncio.sleep(.1)
        self.assertEqual(server.rooms[code].players[guest['id']]['skin'],1)
        self.assertEqual(server.rooms[code].players[owner['id']]['skin'],3)
        await second.send_json({'type':'skin','skin':True})
        await second.send_json({'type':'skin','skin':200})
        await asyncio.sleep(.1)
        self.assertEqual(server.rooms[code].players[guest['id']]['skin'],1)
        await first.close()
        await second.close()

if __name__=='__main__':
    unittest.main()
