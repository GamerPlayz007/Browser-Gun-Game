"""CROSSFIRE 03.6 — real loopback TCP/WebSocket multiplayer load probe.

This exercises aiohttp's real HTTP and WebSocket server code in-process:
real clients and snapshots, not simulated network latency or a GPU benchmark.
"""
import asyncio
import json
import math
import statistics
import time
from aiohttp.test_utils import TestClient, TestServer
import server as game
from perf36 import percentile


async def recv_type(ws,expected,timeout=2.):
    deadline=asyncio.get_running_loop().time()+timeout
    while True:
        remaining=deadline-asyncio.get_running_loop().time()
        if remaining<=0:raise TimeoutError(f"No {expected} message")
        message=await ws.receive_json(timeout=remaining)
        if message.get('type')==expected:return message


async def run_room_probe(size=8,seconds=.8,mode='deathmatch'):
    if not 2<=size<=8:raise ValueError('CROSSFIRE rooms allow 2–8 players')
    game.rooms.clear()
    client=TestClient(TestServer(game.make_app()))
    await client.start_server()
    sockets=[]
    try:
        response=await client.post('/api/rooms',json={'mapId':'cyberpunk'})
        assert response.status==200
        room_id=(await response.json())['room']
        identities=[]
        for n in range(size):
            ws=await client.ws_connect(f'/ws/{room_id}?name=Stress{n}')
            welcome=await recv_type(ws,'welcome')
            sockets.append(ws);identities.append(welcome['id'])
        room=game.rooms[room_id]
        assert len(room.players)==size
        if mode!='deathmatch':
            await sockets[0].send_json({'type':'mode','mode':mode})
            await asyncio.sleep(.04)
        await sockets[0].send_json({'type':'start'})
        await asyncio.sleep(.07)
        assert room.phase=='countdown'
        # Advance only the 3-second lobby countdown; the actual network loop
        # and player movement continue on their real clocks from here.
        room.countdown_at=time.monotonic()-.01
        await asyncio.sleep(.08)
        assert room.phase=='playing'
        async def watch(ws):
            deadline=asyncio.get_running_loop().time()+seconds
            arrivals=[];sequences=[];latest=None;bytes_rx=0
            while True:
                remain=deadline-asyncio.get_running_loop().time()
                if remain<=0:break
                try:msg=await ws.receive_json(timeout=remain)
                except (asyncio.TimeoutError, TimeoutError):break
                if msg.get('type')!='state' or msg.get('phase')!='playing':continue
                arrivals.append(time.perf_counter())
                sequences.append(msg['snapshotSeq'])
                bytes_rx+=len(json.dumps(msg,separators=(',',':')).encode('utf-8'))
                latest=msg
            return dict(arrivals=arrivals,sequences=sequences,
                        latest=latest,bytes=bytes_rx)

        watchers=[asyncio.create_task(watch(ws)) for ws in sockets]
        started=time.perf_counter()
        sent=0
        while time.perf_counter()-started<seconds*.70:
            sent+=1
            for i,ws in enumerate(sockets):
                await ws.send_json({'type':'input','seq':sent,'spawn':room.players[identities[i]]['spawn'],
                    'w':i%2==0,'a':i%3==0,'sprint':True,
                    'jump':sent%13==0,'yaw':0,'pitch':0})
            await asyncio.sleep(.045)
        result=await asyncio.gather(*watchers)
        for i,x in enumerate(result):
            assert len(x['sequences'])>=2,(size,i,len(x['sequences']))
            assert all(b>a for a,b in zip(x['sequences'],x['sequences'][1:])), 'Snapshot sequence rewound'
            last=x['latest']
            assert last and len(last['players'])==size
            assert last['mode']==mode
            assert {p['id'] for p in last['players']}==set(identities)
            assert last['mapId']=='cyberpunk'
            assert last['rules']['goal']==(12 if mode=='gungame' else 15)
            for p in last['players']:
                assert all(math.isfinite(p[k]) for k in ('x','y','z','vx','vy','vz'))
            assert room.players[identities[i]]['seq']>0,'Simulation did not acknowledge inputs'
        rtts=[]
        for ws in sockets:
            sent_at=time.perf_counter()
            await ws.send_json({'type':'ping','t':12345})
            pong=await recv_type(ws,'pong')
            assert pong['t']==12345
            rtts.append((time.perf_counter()-sent_at)*1000)
        health=await (await client.get('/health')).json()
        stats=health['metrics']
        assert health['version']>=5
        assert stats['clients']==size and stats['rooms']==1
        assert stats['loops']>0 and stats['snapshotPackets']>0
        assert stats['snapshotBytesP95']>0 and stats['serverWorkMsP95']>=0
        return dict(players=size,mode=mode,
            snapshotsMin=min(len(x['sequences']) for x in result),
            snapshotsMax=max(len(x['sequences']) for x in result),
            snapshotIntervalP95Ms=round(percentile([
                (b-a)*1000 for x in result
                for a,b in zip(x['arrivals'],x['arrivals'][1:])
            ],.95),2),
            localRttP95Ms=round(percentile(rtts,.95),2),
            localServerWorkP95Ms=stats['serverWorkMsP95'],
            snapshotBytesP95=stats['snapshotBytesP95'],
            totalClientBytes=sum(x['bytes'] for x in result),
            missingSequenceEst=sum(sum(max(0,b-a-1) for a,b in
                zip(x['sequences'],x['sequences'][1:])) for x in result),
            acknowledgedInputsMin=min(room.players[p]['seq'] for p in identities))
    finally:
        await asyncio.gather(*(ws.close() for ws in sockets),return_exceptions=True)
        await client.close()
        game.rooms.clear()


async def main():
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--out',default='stage36_loopback_metrics.json')
    args=parser.parse_args()
    results=[]
    for size,mode in [(2,'deathmatch'),(4,'gungame'),(8,'deathmatch')]:
        results.append(await run_room_probe(size,seconds=1.1,mode=mode))
    payload=dict(version='03.6',environment='GitHub Actions local aiohttp loopback',
        disclaimer='Not Internet latency, actual browser frame rate or GPU performance',
        measurements=results)
    with open(args.out,'w',encoding='utf-8') as f:
        json.dump(payload,f,indent=2)
    print(json.dumps(payload,indent=2))


if __name__=='__main__':
    asyncio.run(main())
