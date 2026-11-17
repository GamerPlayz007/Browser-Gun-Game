"""Chromium smoke for Stage 6.3 Dust Corridor native collision preview.

Checks the real CROSSFire page and existing canvas. Never starts or loads
the original standalone game, and never registers Dust in multiplayer.
"""
import asyncio
from aiohttp.test_utils import TestClient,TestServer
from playwright.async_api import async_playwright
import server as game


async def main():
    game.rooms.clear()
    app=TestClient(TestServer(game.make_app()))
    await app.start_server()
    try:
        async with async_playwright() as playwright:
            browser=await playwright.chromium.launch(
                headless=True,
                args=['--enable-webgl','--enable-unsafe-swiftshader',
                      '--use-gl=angle','--use-angle=swiftshader',
                      '--disable-background-timer-throttling'])
            context=await browser.new_context(viewport={'width':1280,'height':720})
            page=await context.new_page()
            errors=[]
            page.on('pageerror',lambda exc: errors.append(str(exc)))
            await page.add_init_script("localStorage.setItem('cf-quality-25','performance')")
            await page.goto(str(app.make_url('/')),wait_until='domcontentloaded',timeout=30000)
            await page.locator('#dust-preview-62').wait_for(state='visible',timeout=60000)
            assert await page.locator('#viewport canvas').count()==1
            await page.locator('#dust-preview-62').click(timeout=30000)
            await page.wait_for_function(
                "window.__crossfireDustPreview62?.ready===true",timeout=120000)
            meta=await page.evaluate('window.__crossfireDustPreview62.stats')
            assert meta['collisionTriangles']>1000,meta
            assert meta['collisionSystem']=='original-triangle-bvh',meta
            assert meta['serverValidatedA']>=1,meta
            assert meta['serverValidatedB']>=1,meta
            assert await page.evaluate('window.__crossfireDustPreview62.sourceMatched')
            assert await page.locator('#cf-dust64-map canvas').count()==1
            contract=await (await app.get('/api/dust-corridor/preview64')).json()
            assert contract['triangleCount']==meta['collisionTriangles']
            assert contract['sha256']==meta['serverChecksum']
            assert await page.evaluate('window.__crossfireDustPreview62.mode')=='walk'
            assert await page.locator('#home').is_hidden()
            assert await page.locator('#viewport canvas').count()==1

            await page.keyboard.press('ControlLeft')
            await page.wait_for_function(
                'window.__crossfireDustPreview62?.crouched===true',timeout=6000)
            await page.keyboard.press('ControlLeft')
            await page.wait_for_function(
                'window.__crossfireDustPreview62?.crouched===false',timeout=6000)
            await page.locator('#cf-dust64-spawn-b').click(timeout=10000)
            await page.wait_for_function('window.__crossfireDustPreview62.position[2]>45',timeout=10000)
            await page.locator('#cf-dust64-spawn-a').click(timeout=10000)
            await page.wait_for_function('window.__crossfireDustPreview62.position[2]<-45',timeout=10000)
            await page.locator('#cf-dust63-mode').click(timeout=10000)
            assert await page.evaluate('window.__crossfireDustPreview62.mode')=='fly'
            await page.locator('#cf-dust63-mode').click(timeout=10000)
            assert await page.evaluate('window.__crossfireDustPreview62.mode')=='walk'
            await page.locator('#cf-dust63-back').click(timeout=10000)
            assert await page.locator('#home').is_visible()
            assert await page.evaluate('window.__crossfireDustPreview62===undefined')
            assert not errors,'Browser errors: '+repr(errors[:8])
            print('Stage 6.3 Chromium: native original map, triangle collision, '
                  'crouch, camera mode switching, and lobby recovery passed.')
            await context.close()
            await browser.close()
    finally:
        await app.close()
        game.rooms.clear()


if __name__=='__main__':
    asyncio.run(main())
