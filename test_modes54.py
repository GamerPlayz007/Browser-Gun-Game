"""Phase 5.4 regression tests for team assignments, scoring and objective authority."""
import math
import random
import unittest
import server as s
from modes54 import (TEAM_IDS,TEAM_KILL_GOAL,CONTROL_GOAL,CONTROL_POINT,
    team_counts,next_team,balance_teams,winner_team,presence,controller)

def room(mode):
    random.seed(42)
    r=s.Room('MODES54')
    a=s.new_player(r,'a','Alpha',100)
    b=s.new_player(r,'b','Bravo',100)
    assert r.set_mode('a',mode)
    return r,a,b

class TeamModeTests(unittest.TestCase):
    def test_host_selection_balances_teams_and_blocks_unauthorized_changes(self):
        r,a,b=room('teamdeathmatch')
        self.assertFalse(r.set_mode('b','control'))
        self.assertEqual((a['team'],b['team']),('azure','ember'))
        c=s.new_player(r,'c','Charlie',100)
        d=s.new_player(r,'d','Delta',100)
        self.assertEqual((c['team'],d['team']),('azure','ember'))
        self.assertEqual(team_counts(r.players),{'azure':2,'ember':2})
        self.assertFalse(r.set_mode('a','invalid'))
        self.assertEqual(r.mode,'teamdeathmatch')
        self.assertTrue(r.set_mode('a','deathmatch'))
        self.assertTrue(all(p['team'] is None for p in r.players.values()))
        self.assertTrue(r.set_mode('a','control'))
        self.assertEqual(team_counts(r.players),{'azure':2,'ember':2})
        self.assertEqual(r.snapshot(100)['rules']['goal'],CONTROL_GOAL)
        self.assertTrue(r.snapshot(100)['rules']['teamBased'])

    def test_friendly_fire_disabled_but_enemy_still_receives_server_hits(self):
        r,a,b=room('teamdeathmatch')
        friend=s.new_player(r,'c','Charlie',100)
        self.assertEqual(friend['team'],a['team'])
        r.phase='playing';r.started=100
        a.update(x=-24.,y=1.,z=13.,yaw=0.,pitch=-math.atan(.5/8),
                 shield=0,ammo=30,assigned=None,input={},last_shot=100)
        friend.update(x=-24.,y=1.,z=9.,shield=0)
        b.update(x=-24.,y=1.,z=5.,shield=0)
        self.assertTrue(r.shoot(a,101,shot_id=1))
        self.assertEqual(friend['hp'],100)
        self.assertLess(b['hp'],100)
        self.assertFalse(any(e['type']=='hit' and e['victim']=='c' for e in r.events))

    def test_team_deathmatch_winner_and_rematch_reset(self):
        r,a,b=room('teamdeathmatch')
        r.phase='playing';r.started=100
        a.update(x=-24.,y=1.,z=13.,yaw=0.,pitch=-math.atan(.5/8),
                 shield=0,last_input=100,input={})
        b.update(x=-24.,y=1.,z=5.,shield=0)
        for i in range(4):
            self.assertTrue(r.shoot(a,101+i*.2,shot_id=i+1))
        self.assertEqual(r.team_scores,{'azure':1,'ember':0})
        self.assertEqual(r.phase,'playing')
        b.update(hp=10,shield=0,respawn_at=0)
        r.team_scores['azure']=TEAM_KILL_GOAL-1
        self.assertTrue(r.shoot(a,103,shot_id=9))
        self.assertEqual(r.phase,'results')
        self.assertEqual((r.winner_team,r.winner_id,r.winner),('azure',None,'AZURE TEAM'))
        self.assertEqual(r.win_reason,'score')
        self.assertEqual(r.snapshot(103)['winnerTeam'],'azure')
        self.assertTrue(r.start('a',104))
        self.assertEqual(r.team_scores,{'azure':0,'ember':0})
        self.assertIsNone(r.winner_team)
        self.assertEqual(r.phase,'countdown')

    def test_time_limit_uses_team_points_and_ties_draw(self):
        r,a,b=room('control')
        r.phase='playing';r.started=100
        r.team_scores.update(azure=19,ember=22)
        self.assertTrue(r.finish(450,reason='time'))
        self.assertEqual(r.winner_team,'ember')
        self.assertIsNone(r.winner_id)
        r,a,b=room('teamdeathmatch')
        r.phase='playing';r.team_scores.update(azure=7,ember=7)
        self.assertTrue(r.finish(450,reason='time'))
        self.assertIsNone(r.winner_team)
        self.assertEqual(r.winner,'DRAW')

    def test_control_point_presence_contestation_and_tick_scoring(self):
        r,a,b=room('control')
        r.phase='playing';r.started=100
        a.update(x=CONTROL_POINT['x'],y=CONTROL_POINT['y'],
                 z=CONTROL_POINT['z'],hp=100,vx=0,vz=0)
        b.update(x=25,y=1,z=20,hp=100,vx=0,vz=0)
        self.assertEqual(controller(r.players)[:2],('azure',False))
        for i in range(60):r.step(s.TICK,101+i*s.TICK)
        self.assertEqual(r.team_scores['azure'],1)
        self.assertEqual(r.control_owner,'azure')
        self.assertFalse(r.control_contested)
        snap=r.snapshot(102)
        self.assertEqual(snap['objective']['controller'],'azure')
        self.assertEqual(snap['objective']['presence'],{'azure':1,'ember':0})
        self.assertEqual(snap['teamScores']['azure'],1)
        b.update(x=CONTROL_POINT['x'],y=0,z=CONTROL_POINT['z'])
        self.assertEqual(controller(r.players)[:2],(None,True))
        for i in range(90):r.step(s.TICK,102+i*s.TICK)
        self.assertTrue(r.control_contested)
        self.assertEqual(r.team_scores['azure'],1,'Contested objective must pause scoring')
        b['y']=9
        self.assertEqual(controller(r.players)[:2],('azure',False))
        for i in range(60):r.step(s.TICK,104+i*s.TICK)
        self.assertEqual(r.team_scores['azure'],2,'Players on a different floor do not contest')
        r.team_scores['azure']=CONTROL_GOAL-1
        for i in range(60):r.step(s.TICK,105+i*s.TICK)
        self.assertEqual(r.phase,'results')
        self.assertEqual(r.winner_team,'azure')
        self.assertEqual(r.win_reason,'objective')
        self.assertEqual(r.snapshot(107)['teamScores']['azure'],CONTROL_GOAL)

class TeamModeSocketTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from aiohttp.test_utils import TestClient,TestServer
        s.rooms.clear()
        self.client=TestClient(TestServer(s.make_app()))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()
        s.rooms.clear()

    async def test_two_websocket_clients_receive_team_authority_and_objective(self):
        import asyncio
        response=await self.client.post('/api/rooms',json={'mapId':'cyberpunk'})
        code=(await response.json())['room']
        host=await self.client.ws_connect('/ws/'+code+'?name=Host')
        welcome=await host.receive_json(timeout=2)
        guest=await self.client.ws_connect('/ws/'+code+'?name=Guest')
        other=await guest.receive_json(timeout=2)
        await host.send_json({'type':'mode','mode':'control'})
        await asyncio.sleep(.12)
        room=s.rooms[code]
        self.assertEqual(room.mode,'control')
        self.assertEqual(room.players[welcome['id']]['team'],'azure')
        self.assertEqual(room.players[other['id']]['team'],'ember')
        await guest.send_json({'type':'mode','mode':'deathmatch'})
        await guest.send_json({'type':'team','team':'azure'})
        await asyncio.sleep(.09)
        self.assertEqual(room.mode,'control')
        self.assertEqual(room.players[other['id']]['team'],'ember')
        state=room.snapshot(100)
        self.assertEqual(state['objective']['id'],'neon-beacon')
        self.assertEqual(state['teamScores'],{'azure':0,'ember':0})
        self.assertEqual(state['rules']['goal'],CONTROL_GOAL)
        await host.send_json({'type':'start'})
        await asyncio.sleep(.08)
        self.assertEqual(room.phase,'countdown')
        await guest.close()
        await host.close()

if __name__=='__main__':
    unittest.main()
