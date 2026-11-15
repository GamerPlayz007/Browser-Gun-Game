"""CROSSFIRE 03.6 — real Chromium + live aiohttp WebSocket smoke.

Runs the production HTML/Three.js module in a software WebGL Chromium browser.
One second client joins as a real independent WebSocket peer.
This is an integration smoke, not an RTX/Windows FPS benchmark.
"""
import asyncio
import time
from aiohttp import WSMsgType
from aiohttp.test_utils import TestClient,TestServer
from playwright.async_api import async_playwright
import server as game
from load36 import recv_type


async def main():
    game.rooms.clear()
    client=TestClient(TestServer(game.make_app()))
    await client.start_server()
    peer=None
    peer_reader_task=None
    peer_states=[]
    peer_pongs=asyncio.Queue()
    failures=[]
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=True,args=[
                '--enable-webgl','--enable-unsafe-swiftshader',
                '--use-gl=angle','--use-angle=swiftshader',
                '--disable-background-timer-throttling',
            ])
            context=await browser.new_context(viewport={'width':1280,'height':720})
            page=await context.new_page()
            page.on('pageerror',lambda err:failures.append(str(err)))
            await page.add_init_script("localStorage.setItem('cf-quality-25','performance');")
            await page.goto(str(client.make_url('/')),wait_until='domcontentloaded',timeout=30000)
            await page.locator('#create').wait_for(state='visible',timeout=60000)
            for _ in range(120):
                if await page.locator('#create').is_enabled():break
                await asyncio.sleep(.25)
            else:
                status=await page.locator('#status').inner_text()
                raise AssertionError('Three.js browser not ready: '+status)
            assert await page.locator('#viewport canvas').count()>=1
            await page.locator('#name').fill('ChromiumTester')
            await page.locator('#create').click()
            await page.locator('#hud').wait_for(state='visible',timeout=15000)
            code=await page.locator('#room-code').inner_text()
            assert code in game.rooms
            peer=await client.ws_connect('/ws/'+code+'?name=SocketPeer')
            peer_welcome=await recv_type(peer,'welcome')
            # A real connected peer continuously reads states and responds to
            # WebSocket heartbeats. Leaving the queue unread causes a false
            # disconnect during slow software-WebGL rendering.
            async def read_peer():
                async for message in peer:
                    if message.type!=WSMsgType.TEXT:continue
                    payload=message.json()
                    if payload.get('type')=='pong':
                        peer_pongs.put_nowait(payload)
                    elif payload.get('type')=='state':
                        peer_states.append(payload['snapshotSeq'])
            peer_reader_task=asyncio.create_task(read_peer())
            for _ in range(50):
                roster=await page.locator('#roster .roster-row').count()
                if roster>=2:break
                await asyncio.sleep(.1)
            assert roster==2,'Browser failed to display second network player'
            await page.keyboard.press('F7')
            await page.locator('#perf-panel').wait_for(state='visible',timeout=4000)
            for _ in range(30):
                telemetry=await page.locator('#perf-details').inner_text()
                if 'FPS AVG' in telemetry:break
                await asyncio.sleep(.15)
            assert 'FPS AVG' in telemetry and 'JITTER' in telemetry
            assert 'DRAW CALLS' in telemetry
            # Opening the room menu is the supported way to resume match
            # setup after the game viewport takes focus/pointer lock.
            await page.locator('#menu-button').click(timeout=12000,force=True)
            await page.locator('#room-panel').wait_for(state='visible',timeout=12000)
            assert game.rooms[code].phase=='lobby'
            await page.locator('#start').wait_for(state='visible',timeout=12000)
            await page.locator('#start').click(timeout=12000)
            await asyncio.sleep(.1)
            assert game.rooms[code].phase=='countdown'
            game.rooms[code].countdown_at=time.monotonic()-.01
            for _ in range(40):
                if game.rooms[code].phase=='playing':break
                await asyncio.sleep(.05)
            assert game.rooms[code].phase=='playing'
            assert await page.locator('#mode-label').inner_text()=='DEATHMATCH'
            await peer.send_json({'type':'ping','t':123456})
            pong=await asyncio.wait_for(peer_pongs.get(),timeout=6)
            assert pong['t']==123456
            assert len(peer_states)>=3,'Peer stopped reading authoritative snapshots'
            assert not failures,'Browser JavaScript exceptions: '+repr(failures)
            # Chromium's software WebGL driver may never produce a screenshot of
            # the continuously animating scene. Gameplay assertions above are
            # the release gate; an image is supporting evidence only.
            try:
                await page.screenshot(path='stage36_chromium_smoke.png',
                                      timeout=5000,animations='allow')
            except Exception as exc:
                from playwright.async_api import TimeoutError as PlaywrightTimeout
                if not isinstance(exc,PlaywrightTimeout):raise
                print('Optional screenshot unavailable under software WebGL; '
                      'interactive browser checks passed.')
            print('Chromium real WebGL + private room + second WS client + '
                  'HUD diagnostics + match-start smoke passed.')
            print('Browser diagnostics:',telemetry.replace('\n',' | ')[:360])
            await context.close()
            await browser.close()
    finally:
        if peer_reader_task is not None:
            peer_reader_task.cancel()
            await asyncio.gather(peer_reader_task,return_exceptions=True)
        if peer is not None:await peer.close()
        await client.close()
        game.rooms.clear()


if __name__=='__main__':
    asyncio.run(main())
