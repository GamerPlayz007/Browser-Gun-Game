"""CROSSFIRE V3 — regression coverage for the server-owned Bot Assault mode."""
import asyncio
import math
import unittest
from unittest.mock import patch
from aiohttp.test_utils import TestClient,TestServer

import server
from bot57 import (MODE,BOT_COUNT,BOT_GOAL,BOT_WIN_GOAL,BOT_NAMES,
                   visible,target_for,decide,can_attack)

def start_bot_room():
    room=server.Room('AI57')
    human=server.new_player(room,'player','Operator',100)
    assert room.set_mode('player',MODE)
    assert room.start('player',101)
    room.phase='playing'
    room.started=101
    return room,human

class BotAssaultModeTests(unittest.TestCase):
    def test_five_game_modes_still_available_and_bot_mode_is_host_only(self):
        room=server.Room('MODE57')
        h=server.new_player(room,'h','Host',100)
        guest=server.new_player(room,'g','Guest',100)
        self.assertFalse(room.set_mode('g',MODE))
        self.assertTrue(room.set_mode('h',MODE))
        self.assertEqual(room.mode,MODE)
        self.assertFalse(room.bots,'No AI agents before round start')
        self.assertTrue(room.start('h',101))
        self.assertEqual(len(room.players),2)
        self.assertEqual(len(room.bots),BOT_COUNT)
        self.assertEqual(set(room.bots),{f'bot-{i}' for i in range(1,5)})
        self.assertEqual(tuple(b['name'] for b in room.bots.values()),BOT_NAMES)
        self.assertTrue(all(b['bot'] and b['hp']==100 and b['team']=='bots'
                            for b in room.bots.values()))
        snap=room.snapshot(101)
        self.assertEqual(len(snap['players']),6)
        self.assertEqual(sum(p['bot'] for p in snap['players']),4)
        self.assertEqual(len(snap['standings']),2,'Bots never appear as human ranked players')
        self.assertEqual(snap['readyStatus'],{'ready':0,'total':2})
        self.assertEqual(snap['rules']['goal'],BOT_GOAL)
        self.assertEqual(snap['rules']['botGoal'],BOT_WIN_GOAL)
        self.assertEqual(snap['botsAlive'],BOT_COUNT)

    def test_human_players_cannot_hit_each_other_in_bot_assault(self):
        room,human=start_bot_room()
        friend=server.new_player(room,'friend','Friendly',101)
        human.update(x=-24.,y=1.,z=13.,yaw=0.,pitch=0.,shield=0)
        friend.update(x=-24.,y=1.,z=10.,hp=100,shield=0)
        bot=next(iter(room.bots.values()))
        bot.update(x=-24.,y=1.,z=5.,hp=10,shield=0)
        for other in list(room.bots.values())[1:]:other['hp']=0
        with patch.object(server.random,'uniform',return_value=0):
            self.assertTrue(room.shoot(human,102,shot_id=1))
        self.assertEqual(friend['hp'],100,'Cooperative players must not damage each other')
        self.assertEqual(bot['hp'],0)
        self.assertEqual(room.ai_score,1)
        self.assertEqual(human['kills'],1)
        self.assertEqual(friend['deaths'],0)

    def test_humans_win_at_cooperative_goal(self):
        room,human=start_bot_room()
        bot=next(iter(room.bots.values()))
        human.update(x=-24.,y=1.,z=13.,yaw=0.,pitch=0.,shield=0)
        bot.update(x=-24.,y=1.,z=5.,hp=10,shield=0)
        for other in list(room.bots.values())[1:]:other['hp']=0
        room.ai_score=BOT_GOAL-1
        with patch.object(server.random,'uniform',return_value=0):
            room.shoot(human,103,shot_id=1)
        self.assertEqual(room.ai_score,BOT_GOAL)
        self.assertEqual(room.phase,'results')
        self.assertEqual(room.winner,'PLAYERS')
        self.assertIsNone(room.winner_id)
        self.assertEqual(room.win_reason,'score')
        self.assertTrue(any(e['type']=='round_end' and e['mode']==MODE
                            for e in room.events))

    def test_bots_win_if_human_eliminations_reach_limit(self):
        room,human=start_bot_room()
        bot=next(iter(room.bots.values()))
        bot.update(x=-24.,y=1.,z=13.,yaw=0.,pitch=0.,shield=0)
        human.update(x=-24.,y=1.,z=5.,hp=10,shield=0)
        room.bot_score=BOT_WIN_GOAL-1
        with patch.object(server.random,'uniform',return_value=0):
            room.shoot(bot,103,shot_id=1)
        self.assertEqual(room.bot_score,BOT_WIN_GOAL)
        self.assertEqual(room.winner,'BOTS')
        self.assertEqual(room.phase,'results')
        self.assertEqual(human['deaths'],1)

    def test_bots_can_move_but_cannot_exceed_human_player_capacity(self):
        room,human=start_bot_room()
        self.assertEqual(len(room.sockets),0)
        self.assertEqual(len(room.players),1)
        human.update(x=-24.,y=1.,z=5.,hp=100,shield=0)
        bot=next(iter(room.bots.values()))
        bot.update(x=-24.,y=1.,z=13.,hp=100,think_at=0,attack_at=999)
        room.step_bots(102)
        self.assertGreater(math.hypot(bot['vx'],bot['vz']),0,
                           'Bot should move using authoritative physics')
        self.assertEqual(len(room.players),1)
        self.assertFalse(any(b['id'] in room.sockets for b in room.bots.values()))

    def test_time_expiration_and_rematch_clear_old_bots(self):
        room,human=start_bot_room()
        room.step(server.TICK,101+server.ROUND_SECONDS+1)
        self.assertEqual(room.phase,'results')
        self.assertEqual(room.winner,'BOTS')
        self.assertTrue(room.start('player',500))
        self.assertEqual(room.phase,'countdown')
        self.assertEqual(room.ai_score,0)
        self.assertEqual(room.bot_score,0)
        self.assertEqual(len(room.bots),BOT_COUNT)
        self.assertTrue(room.set_mode('player','deathmatch') is False,
                        'Modes may not be changed during countdown')
        room.phase='results'
        self.assertTrue(room.set_mode('player','gungame'))
        self.assertTrue(room.start('player',510))
        self.assertEqual(room.mode,'gungame')
        self.assertEqual(len(room.bots),0,'Returning to PVP must remove all bots')

    def test_decision_making_never_targets_dead_players(self):
        room,human=start_bot_room()
        bot=next(iter(room.bots.values()))
        human['hp']=0
        target,can_see=target_for(bot,room.players,room.arena)
        self.assertIsNone(target)
        self.assertFalse(can_see)
        decide(bot,room.players,room.arena,102)
        self.assertIsNone(can_attack(bot,room.players,room.arena,102))
        self.assertEqual(bot['input'],{})

class BotAssaultSocketTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        server.rooms.clear()
        self.client=TestClient(TestServer(server.make_app()))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()
        server.rooms.clear()

    async def test_solo_host_starts_bots_without_additional_websockets(self):
        response=await self.client.post('/api/rooms',json={'mapId':'cyberpunk'})
        self.assertEqual(response.status,200)
        code=(await response.json())['room']
        ws=await self.client.ws_connect('/ws/'+code+'?name=Solo')
        hello=await ws.receive_json(timeout=2)
        self.assertEqual(hello['type'],'welcome')
        await ws.send_json({'type':'mode','mode':MODE})
        await asyncio.sleep(.08)
        self.assertEqual(server.rooms[code].mode,MODE)
        await ws.send_json({'type':'start'})
        await asyncio.sleep(.09)
        room=server.rooms[code]
        self.assertEqual(room.phase,'countdown')
        self.assertEqual(len(room.bots),BOT_COUNT)
        self.assertEqual(len(room.players),1)
        packet=room.snapshot(102)
        self.assertEqual(len(packet['players']),BOT_COUNT+1)
        self.assertEqual(packet['rules']['bots'],BOT_COUNT)
        response=await self.client.get('/api/rooms/'+code)
        self.assertEqual((await response.json())['players'],1,
                         'Bots never consume real room slots')
        await ws.close()

if __name__=='__main__':
    unittest.main()
