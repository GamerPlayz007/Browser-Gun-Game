"""Authoritative gameplay and real WebSocket integration tests."""
import asyncio, json, math, random, time, unittest
from aiohttp.test_utils import TestClient,TestServer
import server as s

def duel(mode='deathmatch',weapon=0):
    random.seed(42);r=s.Room('TEST');r.phase='playing';r.started=100;r.mode=mode
    a=s.new_player(r,'a','Alpha',100,weapon);b=s.new_player(r,'b','Bravo',100)
    a.update(x=-20.,y=0.,z=10.,shield=0,yaw=0.,pitch=-math.atan(.5/8),input={},last_input=100)
    b.update(x=-20.,y=0.,z=2.,shield=0)
    return r,a,b

class GameTests(unittest.TestCase):
    def test_cover_blocks_bullets(self):
        r,a,b=duel();a.update(x=-26,y=0,z=4,yaw=0,pitch=0);b.update(x=-26,y=0,z=-6)
        r.shoot(a,101);self.assertEqual(b['hp'],100)
    def test_damage_kill_respawn_win(self):
        r,a,b=duel()
        for i in range(4):self.assertTrue(r.shoot(a,101+i*.2))
        self.assertEqual(b['hp'],0);self.assertEqual(a['kills'],1);self.assertEqual(b['deaths'],1)
        r.step(s.TICK,105);self.assertEqual(b['hp'],100);self.assertGreater(b['shield'],105)
        a['kills']=14;b.update(x=-20,z=2,y=0,shield=0,hp=25);r.shoot(a,106)
        self.assertEqual(r.phase,'results');self.assertEqual(r.winner,'Alpha')
    def test_headshot_and_weapon_roles(self):
        r,a,b=duel(weapon=3);a.update(pitch=0,input={'ads':True});r.shoot(a,101)
        self.assertEqual(b['hp'],0);self.assertEqual(a['headshots'],1)
        r,a,b=duel(weapon=1);r.shoot(a,101);self.assertGreater(b['hp'],70);self.assertLess(b['hp'],100)
        r,a,b=duel(weapon=2);b['z']=8;a['pitch']=-math.atan(.5/2);r.shoot(a,101);self.assertEqual(b['hp'],0)
    def test_cadence_empty_reload_protection(self):
        r,a,b=duel();b['shield']=110
        r.shoot(a,101);self.assertFalse(r.shoot(a,101.01));self.assertEqual(a['ammo'],29);self.assertEqual(b['hp'],100)
        r.reload(a,102);self.assertFalse(r.shoot(a,102.5));r.step(s.TICK,104);self.assertEqual(a['ammo'],30)
        a['ammo']=0;self.assertFalse(r.shoot(a,105))
    def test_switch_keeps_ammunition_and_cancels_reload(self):
        r,a,b=duel();a['ammo']=2;r.reload(a,101);r.select(a,1,101)
        self.assertEqual(a['weapon'],1);self.assertEqual(a['reload_at'],0);self.assertFalse(r.shoot(a,101.1))
        r.select(a,0,102);self.assertEqual(a['ammo'],2)
    def test_lobby_host_countdown_rematch_and_tie(self):
        r,a,b=duel();r.phase='lobby';self.assertFalse(r.start('b',101));self.assertTrue(r.start('a',101));self.assertEqual(r.phase,'countdown');self.assertFalse(r.shoot(a,102));r.step(s.TICK,104.1);self.assertEqual(r.phase,'playing')
        r.finish(500);self.assertEqual(r.winner,'DRAW');self.assertTrue(r.start('a',501));self.assertEqual(a['kills'],0)
    def test_lobby_players_invulnerable(self):
        r,a,b=duel();r.phase='lobby'
        for i in range(10):r.shoot(a,101+i*.2)
        self.assertEqual(b['hp'],100)
    def test_gungame_progression_and_switch_block(self):
        r,a,b=duel('gungame');a['kills']=2;b['hp']=1;r.shoot(a,101)
        self.assertEqual(a['weapon'],1);r.select(a,3,102);self.assertEqual(a['weapon'],1)
        a.update(kills=11,weapon=3,ammo=5,last_shot=0,pitch=0,input={'ads':True});b.update(hp=1,shield=0);r.shoot(a,104)
        self.assertEqual(r.phase,'results');self.assertEqual(r.winner,'Alpha')
    def test_targets_do_not_score(self):
        r,a,b=duel();r.phase='lobby';a.update(x=-20,y=0,z=-30,yaw=0,pitch=-math.atan(.5/4))
        for i in range(4):r.shoot(a,101+i*.2)
        self.assertEqual(r.targets[0]['hp'],0);self.assertEqual(a['kills'],0)
    def test_stairs_reach_roof(self):
        r,a,b=duel();a.update(x=-26,z=38,yaw=0,pitch=0,input={'w':True},last_input=100)
        for i in range(130):a['last_input']=100+i*s.TICK;s.move(a,s.TICK,100+i*s.TICK)
        self.assertAlmostEqual(a['y'],5.5);self.assertLess(a['z'],15)
    def test_bridge_has_clear_underpass_and_solid_deck(self):
        r,a,b=duel();a.update(x=0,z=-25,yaw=0,input={'w':True})
        for i in range(50):a['last_input']=100+i*s.TICK;s.move(a,s.TICK,100+i*s.TICK)
        self.assertLess(a['z'],-32);self.assertEqual(a['y'],0)
        a.update(x=0,y=7,z=-28,vy=-1,input={},grounded=False)
        for i in range(30):s.move(a,s.TICK,110+i*s.TICK)
        self.assertAlmostEqual(a['y'],5.5)
    def test_slide_cooldown_jump_landing_and_timeout(self):
        r,a,b=duel();a.update(vz=-8,input={'w':True,'slide':True},last_input=100)
        s.move(a,s.TICK,100);self.assertTrue(a['crouch']);self.assertGreater(a['slide_ready'],101)
        ready=a['slide_ready'];a['input']={'w':True,'slide':False};s.move(a,s.TICK,100.1);a['input']['slide']=True;s.move(a,s.TICK,100.2);self.assertEqual(a['slide_ready'],ready)
        a.update(x=-20,y=0,z=18,input={'jump':True},jump_held=False,slide_until=0,grounded=True,last_input=102);s.move(a,s.TICK,102);self.assertGreater(a['y'],0)
        a['input']={}
        for i in range(60):s.move(a,s.TICK,102+i*s.TICK)
        self.assertEqual(a['y'],0)
        a.update(input={'w':True},last_input=100)
        for i in range(30):s.move(a,s.TICK,110+i*s.TICK)
        self.assertLess(abs(a['vz']),.01)
    def test_input_ack_only_after_simulation_and_time_budget(self):
        r,a,b=duel();a['seq']=0
        for seq in range(1,13):a['commands'].append(dict(seq=seq,spawn=a['spawn'],yaw=0,pitch=0,input={'w':True,'sprint':True,'jump':seq==2}))
        self.assertEqual(a['seq'],0)
        r.step(s.TICK,101);self.assertEqual(a['seq'],1)
        r.step(.1,101.1);self.assertEqual(a['seq'],4)
        self.assertAlmostEqual(a['motion_time'],4*s.TICK)
    def test_stale_spawn_commands_are_discarded(self):
        r,a,b=duel();pos=(a['x'],a['y'],a['z'])
        a['commands'].append(dict(seq=100,spawn=a['spawn']-1,yaw=0,pitch=0,input={'w':True}))
        r.step(s.TICK,101);self.assertEqual((a['x'],a['y'],a['z']),pos);self.assertEqual(a['seq'],0)
    def test_all_spawn_points_valid(self):
        for x,y,z in s.SPAWNS:self.assertFalse(any(s.overlaps(x,y,z,b) for b in s.BOXES))

class NetworkTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):s.rooms.clear();self.client=TestClient(TestServer(s.make_app()));await self.client.start_server()
    async def asyncTearDown(self):await self.client.close()
    async def state(self,ws):
        while True:
            d=await ws.receive_json(timeout=2)
            if d['type']=='state':return d
    async def join(self,code,name):
        ws=await self.client.ws_connect('/ws/'+code+'?name='+name);welcome=await ws.receive_json();return ws,welcome['id']
    async def test_rooms_authority_damage_host_transfer_and_capacity(self):
        code=(await (await self.client.post('/api/rooms')).json())['room'];a,aid=await self.join(code,'Alpha');b,bid=await self.join(code,'Bravo');r=s.rooms[code]
        await b.send_json({'type':'start'});await self.state(b);self.assertEqual(r.phase,'lobby')
        await a.send_json({'type':'mode','mode':'gungame'});await self.state(a);await asyncio.sleep(.04);self.assertEqual(r.mode,'gungame')
        await a.send_json({'type':'start'});await asyncio.sleep(.04);self.assertEqual(r.phase,'countdown');r.phase='playing';r.started=time.monotonic()
        p=r.players[aid];q=r.players[bid];p.update(x=-20,y=0,z=10,yaw=0,pitch=0,shield=0);q.update(x=-20,y=0,z=2,shield=0)
        await a.send_json({'type':'input','yaw':0,'pitch':0,'w':True,'x':9999,'kills':100,'seq':1});await asyncio.sleep(.12)
        self.assertLess(p['z'],10);self.assertLess(p['x'],25);self.assertEqual(p['kills'],0)
        await a.send_json({'type':'shoot','yaw':0,'pitch':0,'shot':1});await asyncio.sleep(.06);self.assertLess(q['hp'],100)
        await a.send_str('bad json');await a.send_json({'type':'input','yaw':'NaN'});await a.send_json([])
        await a.send_json({'type':'ping','t':123})
        while True:
            d=await a.receive_json(timeout=2)
            if d['type']=='pong':self.assertEqual(d['t'],123);break
        code2=(await (await self.client.post('/api/rooms')).json())['room'];c,cid=await self.join(code2,'Other');self.assertEqual(len((await self.state(c))['players']),1)
        extras=[]
        for i in range(s.MAX_PLAYERS-2):
            conn,_=await self.join(code,'Extra'+str(i));extras.append(conn)
        self.assertEqual((await self.client.get('/ws/'+code)).status,409)
        await a.close();await asyncio.sleep(.05);self.assertEqual(r.host,bid)
        for conn in [b,c,*extras]:await conn.close()
    async def test_http_assets_and_room_expiry(self):
        for path in ['/','/static/map.json','/static/game.js','/static/world.js','/static/models.js','/static/vendor/addons/objects/Sky.js']:
            response=await self.client.get(path);self.assertEqual(response.status,200,path)
        self.assertEqual((await self.client.get('/api/rooms/XXXXXX')).status,404)
        self.assertEqual((await (await self.client.get('/health')).json())['version'],2)
if __name__=='__main__':unittest.main()
