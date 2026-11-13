"""Run: python -m unittest -v test_server.py"""
import asyncio, unittest
from aiohttp.test_utils import TestClient, TestServer
import server as s

def player(room,id,x,z):
    p=dict(id=id,name=id,kills=0,deaths=0,yaw=0.,pitch=0.,input={},last_input=100.)
    s.spawn(p,room.players,100);p.update(x=x,z=z,shield=0)
    room.players[id]=p;return p

class GameTests(unittest.TestCase):
    def test_wall_blocks_damage(self):
        r=s.Room('TEST');a=player(r,'a',0,8);b=player(r,'b',0,-8)
        r.shoot(a,101);self.assertEqual(b['hp'],100);self.assertEqual(a['ammo'],29)
    def test_kill_respawn_and_round_win(self):
        r=s.Room('TEST');a=player(r,'a',20,8);b=player(r,'b',20,0)
        for i in range(4):r.shoot(a,101+i*.2)
        self.assertEqual(b['hp'],0);self.assertEqual(a['kills'],1);self.assertEqual(b['deaths'],1)
        r.step(s.TICK,105);self.assertEqual(b['hp'],100);self.assertGreater(b['shield'],105)
        b.update(x=20,z=0,shield=0,hp=25);a['kills']=14;r.shoot(a,106)
        self.assertEqual(r.winner,'a');r.reset(117);self.assertIsNone(r.winner);self.assertEqual(a['kills'],0)
    def test_cadence_reload_shield(self):
        r=s.Room('TEST');a=player(r,'a',20,8);b=player(r,'b',20,0);b['shield']=103
        r.shoot(a,101);r.shoot(a,101.01);self.assertEqual(a['ammo'],29);self.assertEqual(b['hp'],100)
        a.update(input={'reload':True},last_input=101.1);r.step(s.TICK,101.1)
        self.assertGreater(a['reload_at'],101.1);r.shoot(a,101.5);self.assertEqual(a['ammo'],29)
        r.step(s.TICK,103);self.assertEqual(a['ammo'],30)
    def test_collision_and_input_timeout(self):
        r=s.Room('TEST');a=player(r,'a',0,4);a.update(input={'w':True},last_input=100)
        for i in range(90):a['last_input']=100+i*s.TICK;s.move(a,s.TICK,100+i*s.TICK)
        self.assertGreaterEqual(a['z'],2.84)
        pos=a['z'];s.move(a,s.TICK,110);self.assertEqual(a['z'],pos)
    def test_target_does_not_score(self):
        r=s.Room('TEST');a=player(r,'a',-5,-16)
        for i in range(4):r.shoot(a,101+i*.2)
        self.assertEqual(r.targets[0]['hp'],0);self.assertEqual(a['kills'],0)
    def test_jump_lands(self):
        r=s.Room('TEST');a=player(r,'a',20,8);a.update(input={'jump':True},last_input=100)
        s.move(a,s.TICK,100);self.assertGreater(a['y'],0);a['input']={}
        for i in range(60):s.move(a,s.TICK,100+i*s.TICK)
        self.assertEqual(a['y'],0);self.assertTrue(a['grounded'])

class NetworkTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        s.rooms.clear();self.client=TestClient(TestServer(s.make_app()));await self.client.start_server()
    async def asyncTearDown(self):await self.client.close()
    async def state(self,ws):
        for _ in range(100):
            data=await ws.receive_json(timeout=2)
            if data['type']=='state':return data
        self.fail('No state')
    async def test_two_clients_state_isolation_capacity_and_disconnect(self):
        code=(await (await self.client.post('/api/rooms')).json())['room']
        a=await self.client.ws_connect('/ws/'+code+'?name=Alpha');wa=await a.receive_json()
        b=await self.client.ws_connect('/ws/'+code+'?name=Bravo');await b.receive_json()
        st=await self.state(a);self.assertEqual(len(st['players']),2)
        p=s.rooms[code].players[wa['id']];p.update(x=20,z=8,yaw=0,shield=0)
        await a.send_json({'type':'input','yaw':0,'pitch':0,'w':True,'x':9999,'kills':100})
        await asyncio.sleep(.15);self.assertLess(p['z'],8);self.assertLess(p['x'],24);self.assertEqual(p['kills'],0)
        await a.send_str('not json');await a.send_json({'type':'input','yaw':'NaN'});await a.send_json([])
        await a.send_json({'type':'ping','t':123})
        while True:
            d=await a.receive_json(timeout=2)
            if d['type']=='pong':self.assertEqual(d['t'],123);break
        code2=(await (await self.client.post('/api/rooms')).json())['room']
        c=await self.client.ws_connect('/ws/'+code2);await c.receive_json();self.assertEqual(len((await self.state(c))['players']),1)
        d=await self.client.ws_connect('/ws/'+code);await d.receive_json()
        e=await self.client.ws_connect('/ws/'+code);await e.receive_json()
        resp=await self.client.get('/ws/'+code);self.assertEqual(resp.status,409)
        await b.close();await asyncio.sleep(.05);self.assertEqual(len(s.rooms[code].players),3)
        for conn in [a,c,d,e]:await conn.close()
    async def test_static_and_expired_room(self):
        self.assertEqual((await self.client.get('/')).status,200)
        self.assertEqual((await self.client.get('/static/vendor/three.module.js')).status,200)
        self.assertEqual((await self.client.get('/api/rooms/XXXXXX')).status,404)
if __name__=='__main__':unittest.main()
