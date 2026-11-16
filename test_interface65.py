"""Daybreak 6.5 premade-room and manual respawn regression tests."""
import unittest
import time
from aiohttp.test_utils import TestClient,TestServer
import server

class Daybreak65Rules(unittest.TestCase):
    def test_respawn_uses_authoritative_safe_spawn(self):
        room=server.Room('MAX')
        a=server.new_player(room,'a','Alpha',100)
        b=server.new_player(room,'b','Bravo',100)
        room.phase='playing';room.started=100
        a.update(hp=5,kills=5,deaths=1,streak=3,shield=0)
        old=a['spawn']
        self.assertTrue(room.manual_respawn65('a',101)[0])
        self.assertEqual((a['hp'],a['kills'],a['deaths'],a['streak']),(200,5,2,0))
        self.assertGreater(a['spawn'],old)
        self.assertGreater(a['shield'],101)
        self.assertEqual(b['deaths'],0)
        self.assertFalse(room.manual_respawn65('a',102)[0])
        self.assertTrue(room.manual_respawn65('a',121.1)[0])
        self.assertEqual(a['deaths'],3)
        self.assertFalse(room.manual_respawn65('missing',124)[0])
        a['hp']=0
        self.assertFalse(room.manual_respawn65('a',150)[0])
        room.phase='results';a['hp']=100
        self.assertFalse(room.manual_respawn65('a',160)[0])
    def test_lobby_respawn_no_death(self):
        room=server.Room('ACE');a=server.new_player(room,'a','Alpha',100)
        self.assertTrue(room.manual_respawn65('a',101)[0])
        self.assertEqual(a['deaths'],0)
    def test_pool_contains_only_short_words(self):
        self.assertEqual(server.ROOM_CODES65[0],'MAX')
        self.assertEqual(len(set(server.ROOM_CODES65)),12)
        self.assertTrue(all(c.isalpha() and len(c)<=4 for c in server.ROOM_CODES65))

class Daybreak65Transport(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        server.rooms.clear()
        self.client=TestClient(TestServer(server.make_app()))
        await self.client.start_server()
    async def asyncTearDown(self):
        await self.client.close()
        server.rooms.clear()
    async def test_named_rooms_exhaust_and_cannot_be_overridden(self):
        pool=set()
        for _ in server.ROOM_CODES65:
            response=await self.client.post('/api/rooms',json={'mapId':'cyberpunk','code':'HACK'})
            self.assertEqual(response.status,200)
            code=(await response.json())['room']
            self.assertIn(code,server.ROOM_CODES65);self.assertNotIn(code,pool)
            pool.add(code)
        self.assertEqual(len(pool),12)
        listing=await (await self.client.get('/api/rooms')).json()
        self.assertEqual(len(listing['rooms']),12)
        self.assertTrue(all(r['active'] for r in listing['rooms']))
        self.assertEqual((await self.client.post('/api/rooms')).status,503)
    async def test_socket_respawn_applies_only_to_sender(self):
        available=await (await self.client.get('/api/rooms')).json()
        self.assertEqual(available['rooms'][0]['code'],'MAX')
        self.assertFalse(available['rooms'][0]['active'])
        code=(await (await self.client.post('/api/rooms')).json())['room']
        ws1=await self.client.ws_connect('/ws/'+code+'?name=Alpha')
        ws2=await self.client.ws_connect('/ws/'+code+'?name=Bravo')
        host=await ws1.receive_json(timeout=2)
        guest=await ws2.receive_json(timeout=2)
        room=server.rooms[code];a=room.players[host['id']];b=room.players[guest['id']]
        room.phase='playing';room.started=time.monotonic()
        a['hp']=50;b['hp']=30
        await ws1.send_json({'type':'respawn','id':guest['id']})
        reply=None
        for _ in range(10):
            data=await ws1.receive_json(timeout=2)
            if data.get('type')=='manual_respawn_result65':
                reply=data;break
        self.assertIsNotNone(reply);self.assertTrue(reply['ok'])
        self.assertEqual(a['hp'],200);self.assertEqual(b['hp'],30)
        self.assertEqual(a['deaths'],1)
        await ws1.send_json({'type':'respawn'})
        response=None
        for _ in range(10):
            data=await ws1.receive_json(timeout=2)
            if data.get('type')=='manual_respawn_result65':
                response=data;break
        self.assertFalse(response['ok'])
        await ws1.close();await ws2.close()
if __name__=='__main__':unittest.main()
