"""CROSSFIRE Stage 3.6 — live-in-process HTTP + WebSocket load regression."""
import asyncio
import time
import unittest
from aiohttp.test_utils import TestClient,TestServer
import server as game
from load36 import run_room_probe,recv_type
from perf36 import ServerMetrics,percentile


class MetricsTests(unittest.TestCase):
    def test_metrics_bounded_and_no_sensitive_fields(self):
        m=ServerMetrics(clock=lambda:100.)
        for ms in (1.,2.,3.,4.,5.):
            m.observe_loop(ms)
        for size in (1000,1200,1000):m.observe_snapshot(size,4)
        m.observe_loop(float('nan'));m.observe_loop(-1)
        summary=m.summary(clients=8,rooms=1)
        self.assertEqual((summary['clients'],summary['rooms']),(8,1))
        self.assertEqual((summary['serverWorkMsP95'],summary['snapshotBytesP95']),(5.,1200))
        self.assertEqual(summary['bytesToRecipients'],12800)
        self.assertEqual(summary['loops'],5)
        self.assertNotIn('names',summary)
        self.assertEqual(percentile([],.95),0)


class MultiplayerLoadTests(unittest.IsolatedAsyncioTestCase):
    async def test_two_player_loopback(self):
        measured=await run_room_probe(2,seconds=.8)
        self.assertGreaterEqual(measured['snapshotsMin'],2)
        print('CROSSFIRE 03.6 / 2 clients:',measured)

    async def test_four_player_gungame_loopback(self):
        measured=await run_room_probe(4,seconds=.8,mode='gungame')
        self.assertGreaterEqual(measured['snapshotsMin'],2)
        print('CROSSFIRE 03.6 / 4 clients:',measured)

    async def test_eight_player_loopback(self):
        measured=await run_room_probe(8,seconds=.8)
        self.assertGreaterEqual(measured['snapshotsMin'],2)
        print('CROSSFIRE 03.6 / 8 clients:',measured)

    async def test_full_room_host_transfer_and_reconnect(self):
        game.rooms.clear()
        client=TestClient(TestServer(game.make_app()))
        await client.start_server()
        sockets=[]
        try:
            room_id=(await (await client.post('/api/rooms')).json())['room']
            for i in range(8):
                ws=await client.ws_connect(f'/ws/{room_id}?name=H{i}')
                player=await recv_type(ws,'welcome')
                sockets.append((ws,player['id']))
            room=game.rooms[room_id]
            self.assertEqual(len(room.players),8)
            self.assertEqual((await client.get('/ws/'+room_id)).status,409)
            original_host=room.host
            await sockets[0][0].close()
            for _ in range(40):
                if room.host!=original_host:break
                await asyncio.sleep(.02)
            self.assertEqual(room.host,sockets[1][1])
            self.assertEqual(len(room.players),7)
            replacement=await client.ws_connect(f'/ws/{room_id}?name=Replacement')
            joined=await recv_type(replacement,'welcome')
            sockets.append((replacement,joined['id']))
            self.assertEqual(len(room.players),8)
            state=await recv_type(replacement,'state')
            self.assertEqual(len(state['players']),8)
            self.assertEqual(state['host'],sockets[1][1])
            self.assertEqual(len({p['id'] for p in state['players']}),8)
        finally:
            await asyncio.gather(*(ws.close() for ws,_ in sockets),return_exceptions=True)
            await client.close();game.rooms.clear()

    async def test_two_four_player_rooms_are_isolated(self):
        game.rooms.clear()
        client=TestClient(TestServer(game.make_app()))
        await client.start_server()
        rooms=[];sockets=[]
        try:
            for room_idx in range(2):
                code=(await (await client.post('/api/rooms')).json())['room']
                ids=[]
                for i in range(4):
                    ws=await client.ws_connect(f'/ws/{code}?name=R{room_idx}_{i}')
                    ids.append((await recv_type(ws,'welcome'))['id'])
                    sockets.append((room_idx,ws))
                rooms.append((code,ids))
            self.assertEqual(len(game.rooms),2)
            for index,(code,ids) in enumerate(rooms):
                mine=next(ws for which,ws in sockets if which==index)
                # A freshly connected socket can have an older queued state
                # from before the fourth client joined. Require convergence.
                state=await recv_type(mine,'state')
                for _ in range(30):
                    if {p['id'] for p in state['players']}==set(ids):break
                    state=await recv_type(mine,'state')
                self.assertEqual({p['id'] for p in state['players']},set(ids))
                self.assertEqual(state['mapId'],'cyberpunk')
                other_ids=set(rooms[1-index][1])
                self.assertFalse(set(ids)&other_ids)
            await sockets[0][1].send_json({'type':'mode','mode':'gungame'})
            await asyncio.sleep(.07)
            self.assertEqual(game.rooms[rooms[0][0]].mode,'gungame')
            self.assertEqual(game.rooms[rooms[1][0]].mode,'deathmatch')
            status=await (await client.get('/health')).json()
            self.assertEqual((status['metrics']['clients'],status['metrics']['rooms']),(8,2))
        finally:
            await asyncio.gather(*(ws.close() for _,ws in sockets),return_exceptions=True)
            await client.close();game.rooms.clear()


if __name__=='__main__':unittest.main()
