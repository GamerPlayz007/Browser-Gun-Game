"""Authoritative gameplay and real WebSocket integration tests."""
import asyncio, json, math, random, time, unittest
from aiohttp.test_utils import TestClient,TestServer
import server as s

def duel(mode='deathmatch',weapon=0):
    random.seed(42);r=s.Room('TEST');r.phase='playing';r.started=100;r.mode=mode
    a=s.new_player(r,'a','Alpha',100,weapon);b=s.new_player(r,'b','Bravo',100)
    a.update(x=-24.,y=1.,z=13.,shield=0,yaw=0.,pitch=-math.atan(.5/8),input={},last_input=100)
    b.update(x=-24.,y=1.,z=5.,shield=0)
    return r,a,b

class GameTests(unittest.TestCase):
    def test_snapshot_contains_monotonic_sequence_and_server_clock(self):
        room,_,_=duel()
        first=room.snapshot(110.0)
        second=room.snapshot(110.05)
        self.assertEqual(first['type'],'state')
        self.assertEqual(first['snapshotSeq']+1,second['snapshotSeq'])
        self.assertEqual((first['serverTime'],second['serverTime']),(110.0,110.05))
        self.assertEqual((second['tickRate'],second['snapshotHz']),(60,20))
        self.assertEqual(len(second['players']),2)

    def test_server_hit_events_include_origin_for_directional_ui(self):
        r,a,b=duel()
        self.assertTrue(r.shoot(a,101,shot_id=1))
        hits=[event for event in r.events if event['type']=='hit']
        self.assertTrue(hits)
        self.assertEqual(tuple(hits[0]['origin']),(-24.,2.55,13.))
        self.assertEqual(hits[0]['id'],'a')
        self.assertEqual(hits[0]['victim'],'b')

    def test_bounded_server_pose_rewind_uses_historical_target_only(self):
        r,a,b=duel()
        r.record_poses(101.0)
        b['x']=-20.0
        r.record_poses(101.1)
        self.assertTrue(r.shoot(a,101.11,shot_id=1,view_time=101.0))
        self.assertLess(b['hp'],100,'Rewind should find a formerly visible target')

        old,a2,b2=duel()
        old.record_poses(101.0);b2['x']=-20.0;old.record_poses(101.1)
        self.assertTrue(old.shoot(a2,101.11,shot_id=1,view_time=100.0))
        self.assertEqual(b2['hp'],100,'Old timestamps beyond 300ms cannot rewind')

        respawn,a3,b3=duel()
        respawn.record_poses(101.0)
        b3['x']=-20.0;b3['spawn']+=1
        respawn.record_poses(101.1)
        self.assertTrue(respawn.shoot(a3,101.11,shot_id=1,view_time=101.0))
        self.assertEqual(b3['hp'],100,'A respawn must never use the previous life hitbox')

    def test_static_cover_still_blocks_rewound_player(self):
        r,a,b=duel()
        a.update(x=-24.,y=1.,z=24.,yaw=-math.pi/2,pitch=0)
        b.update(x=0.,y=1.,z=24.)
        r.record_poses(101.0)
        b['x']=3.
        r.record_poses(101.1)
        r.shoot(a,101.11,shot_id=1,view_time=101.0)
        self.assertEqual(b['hp'],100,'Rewind must not bypass current static cover')

    def test_cover_blocks_bullets(self):
        r,a,b=duel();a.update(x=-24,y=1,z=24,yaw=-math.pi/2,pitch=0);b.update(x=0,y=1,z=24)
        r.shoot(a,101);self.assertEqual(b['hp'],100)
    def test_damage_kill_respawn_win(self):
        r,a,b=duel()
        for i in range(4):self.assertTrue(r.shoot(a,101+i*.2))
        self.assertEqual(b['hp'],0);self.assertEqual(a['kills'],1);self.assertEqual(b['deaths'],1)
        r.step(s.TICK,105);self.assertEqual(b['hp'],100);self.assertGreater(b['shield'],105)
        a['kills']=14;b.update(x=-24,z=5,y=1,shield=0,hp=25);r.shoot(a,106)
        self.assertEqual(r.phase,'results');self.assertEqual(r.winner,'Alpha')
    def test_headshot_and_weapon_roles(self):
        r,a,b=duel(weapon=3);a.update(pitch=0,input={'ads':True});r.shoot(a,101)
        self.assertEqual(b['hp'],0);self.assertEqual(a['headshots'],1)
        r,a,b=duel(weapon=1);r.shoot(a,101);self.assertGreater(b['hp'],70);self.assertLess(b['hp'],100)
        r,a,b=duel(weapon=2);b['z']=11;a['pitch']=-math.atan(.5/2);r.shoot(a,101);self.assertEqual(b['hp'],0)
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
        r,a,b=duel();r.phase='lobby';a.update(x=-24,y=1,z=8,yaw=0,pitch=-math.atan(.5/4))
        for i in range(4):r.shoot(a,101+i*.2)
        self.assertEqual(r.targets[0]['hp'],0);self.assertEqual(a['kills'],0)
    def test_stairs_reach_roof(self):
        from test_map import traverse
        course=next(r for r in s.MAP['stairs'] if r['id']=='S1')
        _,states=traverse(course,mode='sprint')
        self.assertAlmostEqual(states[-1]['y'],course['points'][-1][1],delta=.32)
        self.assertTrue(all(p['y']<6 for p in states))
    def test_new_city_has_supported_decks_and_open_lower_space(self):
        # Find a real elevated deck with free space below, rather than relying
        # on the deleted 80 m map's old bridge coordinates.
        elevated=[b for b in s.BOXES if b['kind'] in ('deck','routeFloor','stairLanding')
                  and 4.9<=s.top_at(b,b['x'],b['z'])<=9.2]
        self.assertTrue(elevated)
        valid=[]
        for b in elevated:
            x,z=b['x'],b['z'];top=s.top_at(b,x,z)
            if not any(s.overlaps(x,1,z,c,1.8) for c in s.nearby_boxes(x,z)):
                valid.append((x,z,top))
        self.assertTrue(valid,'At least one elevated deck must have a traversable space below')
    def test_slide_cooldown_jump_landing_and_timeout(self):
        r,a,b=duel();a.update(vz=-8,input={'w':True,'slide':True},last_input=100)
        s.move(a,s.TICK,100);self.assertTrue(a['crouch']);self.assertGreater(a['slide_ready'],101)
        ready=a['slide_ready'];a['input']={'w':True,'slide':False};s.move(a,s.TICK,100.1);a['input']['slide']=True;s.move(a,s.TICK,100.2);self.assertEqual(a['slide_ready'],ready)
        a.update(x=-24,y=1,z=18,input={'jump':True},jump_held=False,slide_until=0,grounded=True,last_input=102);s.move(a,s.TICK,102);self.assertGreater(a['y'],0)
        a['input']={}
        for i in range(60):s.move(a,s.TICK,102+i*s.TICK)
        self.assertEqual(a['y'],1)
        a.update(input={'w':True},last_input=100)
        for i in range(30):s.move(a,s.TICK,110+i*s.TICK)
        self.assertLess(abs(a['vz']),.01)
    def test_input_ack_only_after_simulation_and_time_budget(self):
        r,a,b=duel();a['seq']=0
        for seq in range(1,13):a['commands'].append(dict(seq=seq,spawn=a['spawn'],yaw=0,pitch=0,input={'w':True,'sprint':True,'jump':seq==2}))
        self.assertEqual(a['seq'],0)
        r.step(s.TICK,101);self.assertEqual(a['seq'],1)
        r.step(.1,101.1);self.assertEqual(a['seq'],7)
        self.assertAlmostEqual(a['motion_time'],7*s.TICK)
    def test_stale_spawn_commands_are_discarded(self):
        r,a,b=duel();pos=(a['x'],a['y'],a['z'])
        a['commands'].append(dict(seq=100,spawn=a['spawn']-1,yaw=0,pitch=0,input={'w':True}))
        r.step(s.TICK,101);self.assertEqual((a['x'],a['y'],a['z']),pos);self.assertEqual(a['seq'],0)
    def test_all_spawn_points_valid(self):
        for x,y,z in s.SPAWNS:self.assertFalse(any(s.overlaps(x,y,z,b) for b in s.BOXES))

class MapIsolationTests(unittest.TestCase):
    def test_room_scoped_spawns_collisions_and_shots(self):
        from copy import deepcopy
        fixture=deepcopy(s.MAP);fixture.update(id='fixture',spawns=[[100,0,105]],practiceTargets=[],boxes=[dict(x=100,y=0,z=100,w=4,h=5,d=2)])
        s.ARENAS['fixture']=s.Arena(fixture)
        try:
            r=s.Room('OTHER','fixture');p=s.new_player(r,'p','Other',100)
            self.assertEqual((p['x'],p['y'],p['z']),(100,0,105));self.assertEqual(r.snapshot(100)['mapId'],'fixture')
            p.update(yaw=0,input={'w':True,'sprint':True})
            for i in range(60):p['last_input']=100+i*s.TICK;s.move(p,s.TICK,100+i*s.TICK,r.arena)
            self.assertGreater(p['z'],101)
            r.phase='playing';q=s.new_player(r,'q','Target',100)
            p.update(x=100,y=0,z=105,yaw=0,pitch=0,shield=0);q.update(x=100,y=0,z=95,shield=0)
            r.shoot(p,101);self.assertEqual(q['hp'],100)
            normal=s.Room('DEFAULT');self.assertEqual(normal.arena.id,'cyberpunk')
            a=s.new_player(normal,'a','A',100);b=s.new_player(normal,'b','B',100)
            normal.phase='playing';a.update(x=100,y=0,z=105,yaw=0,pitch=0,shield=0);b.update(x=100,y=0,z=95,shield=0)
            normal.shoot(a,101);self.assertLess(b['hp'],100)
        finally:s.ARENAS.pop('fixture')
    def test_ramp_ray_respects_open_space_under_incline(self):
        ramp=dict(x=0,y=.68,z=0,w=4,h=8.32,d=16,kind='ramp',axis='z',direction=-1,low=1,rise=8,thickness=.32)
        self.assertIsNone(s.ray_solid((-5,2,-6),(1,0,0),ramp))
        self.assertIsNotNone(s.ray_solid((-5,8,-6),(1,0,0),ramp))
        self.assertAlmostEqual(s.ray_solid((0,12,-6),(0,-1,0),ramp),4)

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
        p=r.players[aid];q=r.players[bid];p.update(x=-24,y=1,z=13,yaw=0,pitch=0,shield=0);q.update(x=-24,y=1,z=5,shield=0)
        await a.send_json({'type':'input','yaw':0,'pitch':0,'w':True,'x':9999,'kills':100,'seq':1});await asyncio.sleep(.12)
        self.assertLess(p['z'],13);self.assertLess(p['x'],25);self.assertEqual(p['kills'],0)
        await a.send_json({'type':'shoot','yaw':0,'pitch':0,'shot':1});await asyncio.sleep(.06);self.assertLess(q['hp'],100)
        await a.send_str('bad json');await a.send_json({'type':'input','yaw':'NaN'});await a.send_json([])
        await a.send_json({'type':'ping','t':123})
        while True:
            d=await a.receive_json(timeout=2)
            if d['type']=='pong':
                self.assertEqual(d['t'],123)
                self.assertLess(abs(d['serverTime']-time.monotonic()),3)
                break
        code2=(await (await self.client.post('/api/rooms')).json())['room'];c,cid=await self.join(code2,'Other');self.assertEqual(len((await self.state(c))['players']),1)
        extras=[]
        for i in range(s.MAX_PLAYERS-2):
            conn,_=await self.join(code,'Extra'+str(i));extras.append(conn)
        self.assertEqual((await self.client.get('/ws/'+code)).status,409)
        await a.close();await asyncio.sleep(.05);self.assertEqual(r.host,bid)
        for conn in [b,c,*extras]:await conn.close()
    async def test_sequenced_network_snapshots_include_server_time(self):
        code=(await (await self.client.post('/api/rooms')).json())['room']
        ws,pid=await self.join(code,'Clocked')
        a=await self.state(ws);b=await self.state(ws)
        self.assertGreater(b['snapshotSeq'],a['snapshotSeq'])
        self.assertGreaterEqual(b['serverTime'],a['serverTime'])
        self.assertGreater(b['serverTime'],0)
        self.assertEqual((b['tickRate'],b['snapshotHz']),(60,20))
        self.assertEqual(b['rules']['goal'],15)
        self.assertIn('standings',b)
        self.assertEqual(len(b['standings']),1)
        self.assertEqual(b['round'],0)
        self.assertEqual(b['players'][0]['id'],pid)
        await ws.close()

    async def test_map_selector_validation_and_join_contract(self):
        registry=await (await self.client.get('/api/maps')).json()
        self.assertEqual(registry['default'],'cyberpunk');self.assertEqual(len(registry['maps']),1)
        self.assertEqual([m['id'] for m in registry['maps'] if m['available']],['cyberpunk'])
        for value in ['rainforest','solstice','missing','../server.py',None,[]]:
            response=await self.client.post('/api/rooms',json={'mapId':value});self.assertEqual(response.status,400)
        self.assertEqual((await self.client.post('/api/rooms',data='broken')).status,400)
        response=await self.client.post('/api/rooms',json={'mapId':'cyberpunk'});data=await response.json()
        self.assertEqual(data['mapId'],'cyberpunk')
        info=await (await self.client.get('/api/rooms/'+data['room'])).json();self.assertEqual(info['mapId'],'cyberpunk')
        ws=await self.client.ws_connect('/ws/'+data['room']);welcome=await ws.receive_json();self.assertEqual(welcome['mapId'],'cyberpunk')
        await ws.send_json({'type':'map','mapId':'solstice'})
        self.assertEqual((await self.state(ws))['mapId'],'cyberpunk');await ws.close()
        html=await (await self.client.get('/')).text();self.assertIn('<sup>03.6</sup>',html);self.assertIn('id="map-select"',html)
        arena=await (await self.client.get('/static/maps/cyberpunk.json')).json();self.assertEqual(arena['id'],'cyberpunk');self.assertEqual(len(arena['routes']),13)
    async def test_host_only_queues_next_mode_without_rewriting_finished_match(self):
        code=(await (await self.client.post('/api/rooms')).json())['room']
        host,hid=await self.join(code,'Host')
        guest,gid=await self.join(code,'Guest')
        room=s.rooms[code];room.phase='results';room.winner='Host'
        room.winner_id=hid;room.win_reason='time'
        await guest.send_json({'type':'mode','mode':'gungame'})
        await asyncio.sleep(.06)
        self.assertEqual(room.next_mode,'deathmatch')
        await host.send_json({'type':'mode','mode':'gungame'})
        await asyncio.sleep(.06)
        self.assertEqual(room.mode,'deathmatch')
        self.assertEqual(room.next_mode,'gungame')
        snap=room.snapshot(time.monotonic())
        self.assertEqual((snap['mode'],snap['nextMode']),('deathmatch','gungame'))
        await host.send_json({'type':'start'})
        await asyncio.sleep(.06)
        self.assertEqual(room.phase,'countdown')
        self.assertEqual(room.mode,'gungame')
        self.assertEqual(room.snapshot(time.monotonic())['rules']['goal'],12)
        await guest.close();await host.close()

    async def test_duplicate_shot_ids_do_not_consume_extra_ammunition(self):
        code=(await (await self.client.post('/api/rooms')).json())['room']
        ws,pid=await self.join(code,'Shooter')
        room=s.rooms[code];room.phase='playing';room.started=time.monotonic()
        p=room.players[pid]
        p.update(ammo=30,reload_at=0.,switch_at=0.,last_shot=-999.,shield=0.)
        packet={'type':'shoot','shot':7,'yaw':0,'pitch':0}
        await ws.send_json(packet)
        await asyncio.sleep(.08)
        self.assertEqual(p['ammo'],29)
        self.assertEqual(p['ack_shot'],7)
        # A replay after the weapon cooldown must still be ignored.
        await asyncio.sleep(.18)
        await ws.send_json(packet)
        await asyncio.sleep(.08)
        self.assertEqual(p['ammo'],29)
        self.assertEqual(p['ack_shot'],7)
        await ws.send_json({'type':'shoot','shot':0,'yaw':0,'pitch':0})
        await asyncio.sleep(.05)
        self.assertEqual(p['ammo'],29)
        await ws.send_json({'type':'shoot','shot':8,'yaw':0,'pitch':0})
        await asyncio.sleep(.08)
        self.assertEqual(p['ammo'],28)
        self.assertEqual(p['shot_seq'],8)
        await ws.close()

    async def test_http_assets_and_room_expiry(self):
        for path in ['/','/static/map.json','/static/game.js','/static/world.js','/static/models.js','/static/vendor/addons/objects/Sky.js']:
            response=await self.client.get(path);self.assertEqual(response.status,200,path)
        self.assertEqual((await self.client.get('/api/rooms/XXXXXX')).status,404)
        self.assertEqual((await (await self.client.get('/health')).json())['version'],5)
if __name__=='__main__':unittest.main()
