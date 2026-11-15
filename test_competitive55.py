"""CROSSFIRE 05.5 competitive fairness and room authority regression tests."""
import asyncio
import unittest

from aiohttp.test_utils import TestClient,TestServer
import server as s
from competitive55 import (SPAWN_REUSE_WINDOW,MIN_SPAWN_SEPARATION,
    balanced_draft,spawn_score,ready_summary)
from match35 import standings

class CompetitiveFairnessTests(unittest.TestCase):
    def test_spawn_history_deterrence_and_occupied_positions(self):
        pos=(-24.,1.,13.)
        p=dict(id='me',team=None,hp=100,x=0,z=0)
        empty=spawn_score(pos,p,{}, {},100,[])
        reused=spawn_score(pos,p,{}, {pos:99.},100,[])
        self.assertLess(reused,empty-25)
        expired=spawn_score(pos,p,{}, {pos:100-SPAWN_REUSE_WINDOW-1},100,[])
        self.assertEqual(expired,empty)
        nearby=dict(id='other',team=None,hp=100,x=-24.2,y=1,z=13.)
        crowded=spawn_score(pos,p,{'other':nearby},{},100,[])
        self.assertLess(crowded,empty-100)
        exposed=spawn_score(pos,p,{}, {},100,[{'id':'enemy'}])
        self.assertLess(exposed,empty)
        self.assertGreater(MIN_SPAWN_SEPARATION,4.)

    def test_room_spawns_do_not_overlap_and_track_recent_use(self):
        r=s.Room('SPAWN55')
        a=s.new_player(r,'a','Alpha',100)
        b=s.new_player(r,'b','Bravo',100)
        self.assertNotEqual((a['x'],a['y'],a['z']),(b['x'],b['y'],b['z']))
        self.assertGreaterEqual(len(r.spawn_history),2)

    def test_previous_round_form_both_balances_counts_and_spreads_leaders(self):
        entries=[('a',14,2),('b',12,4),('c',9,4),('d',2,7)]
        players={id:dict(id=id,name=id,kills=k,deaths=d,headshots=0)
                 for id,k,d in entries}
        counts=balanced_draft(players)
        self.assertEqual(counts,{'azure':2,'ember':2})
        self.assertEqual([players[k]['team'] for k,_,_ in entries],
                         ['azure','ember','ember','azure'])
        self.assertNotEqual(players['a']['team'],players['b']['team'])

    def test_ready_cannot_be_changed_by_others_and_is_not_required_to_start(self):
        r=s.Room('READY55')
        a=s.new_player(r,'a','Alpha',100)
        b=s.new_player(r,'b','Bravo',100)
        self.assertFalse(r.set_ready('fake',True))
        self.assertTrue(r.set_ready('b',True))
        self.assertFalse(a['ready'])
        self.assertTrue(b['ready'])
        self.assertEqual(ready_summary(r.players),{'ready':1,'total':2})
        self.assertEqual(r.snapshot(100)['readyStatus'],{'ready':1,'total':2})
        self.assertTrue(r.start('a',101),'Ready is informative, never a start blocker')
        self.assertFalse(a['ready'])
        self.assertFalse(b['ready'])
        self.assertFalse(r.set_ready('b',True),'No ready toggles during countdown')
        self.assertFalse(r.balance('a'),'No balancing mid-round')

    def test_only_host_can_balance_between_rounds_and_match_is_team_scoped(self):
        r=s.Room('DRAFT55')
        for id in ['a','b','c','d']:s.new_player(r,id,id,100)
        self.assertFalse(r.balance('a'),'FFA cannot use team balance')
        self.assertTrue(r.set_mode('a','teamdeathmatch'))
        self.assertTrue(r.set_ready('b',True))
        self.assertFalse(r.balance('b'))
        self.assertTrue(r.balance('a'))
        self.assertFalse(r.players['b']['ready'],
                         'Balancing teams resets obsolete readiness')
        r.players['a']['kills']=20
        r.players['b']['kills']=14
        r.players['c']['kills']=9
        r.players['d']['kills']=2
        self.assertTrue(r.balance('a'))
        self.assertEqual([r.players[id]['team'] for id in ['a','b','c','d']],
                         ['azure','ember','ember','azure'])
        self.assertTrue(r.start('a',102))
        self.assertFalse(r.balance('a'))
        self.assertTrue(all(p['kills']==0 for p in r.players.values()))

    def test_changing_game_mode_resets_readiness(self):
        r=s.Room('MODE55')
        a=s.new_player(r,'a','Alpha',100)
        b=s.new_player(r,'b','Bravo',100)
        self.assertTrue(r.set_ready('a',True))
        self.assertTrue(r.set_ready('b',True))
        self.assertEqual(ready_summary(r.players)['ready'],2)
        self.assertTrue(r.set_mode('a','control'))
        self.assertEqual(ready_summary(r.players)['ready'],0)

    def test_team_standings_rank_within_sides_ffa_ties_unchanged(self):
        ps={id:dict(id=id,name=id,kills=k,deaths=d,headshots=0,weapon=0,
                streak=0,best_streak=0,team=t,ready=False)
            for id,k,d,t in [('a',9,2,'azure'),('b',13,1,'ember'),
                             ('c',4,5,'ember'),('d',6,3,'azure')]}
        teams=standings(ps,'teamdeathmatch')
        self.assertEqual([p['id'] for p in teams],['a','d','b','c'])
        self.assertEqual([p['rank'] for p in teams],[1,2,1,2])
        self.assertEqual([p['team'] for p in teams],['azure','azure','ember','ember'])
        free=standings(ps,'deathmatch')
        self.assertEqual([p['id'] for p in free],['b','a','d','c'])
        self.assertEqual([p['rank'] for p in free],[1,2,3,4])

class CompetitiveSocketTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        s.rooms.clear()
        self.client=TestClient(TestServer(s.make_app()))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()
        s.rooms.clear()

    async def test_forged_ready_and_balance_actions_cannot_change_other_players(self):
        resp=await self.client.post('/api/rooms',json={'mapId':'cyberpunk'})
        code=(await resp.json())['room']
        host=await self.client.ws_connect('/ws/'+code+'?name=Host')
        owner=await host.receive_json(timeout=2)
        guest=await self.client.ws_connect('/ws/'+code+'?name=Guest')
        visitor=await guest.receive_json(timeout=2)
        room=s.rooms[code]
        await host.send_json({'type':'mode','mode':'teamdeathmatch'})
        await asyncio.sleep(.10)
        await guest.send_json({'type':'ready','ready':True,'id':owner['id']})
        await guest.send_json({'type':'balance','target':owner['id']})
        await asyncio.sleep(.10)
        self.assertTrue(room.players[visitor['id']]['ready'])
        self.assertFalse(room.players[owner['id']]['ready'])
        self.assertEqual(room.players[owner['id']]['team'],'azure')
        self.assertEqual(room.players[visitor['id']]['team'],'ember')
        await host.send_json({'type':'ready','ready':True})
        await asyncio.sleep(.08)
        self.assertEqual(room.snapshot(100)['readyStatus'],{'ready':2,'total':2})
        await host.send_json({'type':'start'})
        await asyncio.sleep(.08)
        self.assertEqual(room.phase,'countdown')
        self.assertFalse(any(p['ready'] for p in room.players.values()))
        await guest.close()
        await host.close()

if __name__=='__main__':
    unittest.main()
