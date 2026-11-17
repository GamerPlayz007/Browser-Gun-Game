"""Real Chromium + two-WebSocket smoke of Dust Corridor native CROSSFire match.

Runs inside the normal CROSSFire / page with ONE WebGL context. This is not
an iframe or a second game's renderer. Exercises room setup and peer syncing.
"""
import asyncio
import math
from aiohttp.test_utils import TestClient,TestServer
from playwright.async_api import async_playwright
import server as game


async def read_until(ws,kind,limit=80):
    for _ in range(limit):
        item=await ws.receive_json(timeout=5)
        if item.get('type')==kind:return item
    raise AssertionError('No '+kind+' packet')


async def main():
    game.rooms.clear()
    client=TestClient(TestServer(game.make_app()))
    await client.start_server()
    peer=None
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=True,args=[
                '--enable-webgl','--enable-unsafe-swiftshader',
                '--use-gl=angle','--use-angle=swiftshader',
                '--disable-background-timer-throttling'])
            context=await browser.new_context(viewport={'width':1280,'height':720})
            page=await context.new_page()
            errors=[]
            page.on('pageerror',lambda err:errors.append(str(err)))
            await page.add_init_script("localStorage.setItem('cf-quality-25','performance')")
            await page.goto(str(client.make_url('/')),wait_until='domcontentloaded',timeout=30000)
            await page.locator('#create').wait_for(state='visible',timeout=60000)
            await page.locator('#map-select').select_option('dust_corridor')
            await page.locator('#name').fill('MarketTester')
            await page.locator('#create').click(timeout=30000)
            await page.locator('#hud').wait_for(state='visible',timeout=120000)
            await page.wait_for_function(
                "window.__crossfireDustMatch65?.ready===true&&window.__crossfireDustMatch65?.active===true",
                timeout=120000)
            assert await page.locator('#viewport canvas').count()==1
            source=await page.evaluate("window.__crossfireDustMatch65")
            assert source['collisionTriangles']==96588
            assert source['visualBatches']>=12
            assert source['packedScene'] is True,source
            assert source['packedChunks']>=12
            assert source['packedBytes']>0
            assert source['visualTriangles']>96588
            code=await page.locator('#room-code').inner_text()
            room=game.rooms.get(code)
            assert room is not None and room.arena.id=='dust_corridor'
            assert room.arena.data['collisionSha256']==source['sourceChecksum']
            peer=await client.ws_connect('/ws/'+code+'?name=Peer')
            welcome=await read_until(peer,'welcome')
            assert welcome['mapId']=='dust_corridor'
            state=await read_until(peer,'state')
            assert state['mapId']=='dust_corridor' and len(state['players'])>=2
            player=room.players[welcome['id']]
            await peer.send_json({'type':'input','seq':1,'spawn':player['spawn'],
                                  'yaw':math.pi,'pitch':0,'w':True})
            for _ in range(60):
                if player['seq']>=1:break
                await asyncio.sleep(.025)
            assert player['seq']>=1,'Server never acknowledged Dust player input'
            assert not errors,'Client runtime exceptions '+repr(errors[:6])
            print('Dust Corridor 6.5 Chromium: original geometry, native HUD, two '
                  'players, real WebSocket input, single main renderer PASS')
            await context.close()
            await browser.close()
    finally:
        if peer is not None:await peer.close()
        await client.close()
        game.rooms.clear()


if __name__=='__main__':
    asyncio.run(main())
