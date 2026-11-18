/* Real Chromium rendering smoke for the isolated Octavus native preview.
 * Runs in GitHub Actions against an HTTP server from repo root.
 */
import assert from 'node:assert/strict';
import {existsSync,statSync,writeFileSync} from 'node:fs';
import puppeteer from 'puppeteer-core';

const chrome=[
 process.env.CHROME_BIN,
 '/usr/bin/google-chrome',
 '/usr/bin/google-chrome-stable',
 '/opt/google/chrome/chrome'
].filter(Boolean).find(p=>existsSync(p));
assert.ok(chrome,'Chromium/Google Chrome executable missing on runner');
const browser=await puppeteer.launch({
 executablePath:chrome,
 headless:true,
 defaultViewport:{width:1440,height:900,deviceScaleFactor:1},
 args:[
  '--no-sandbox','--disable-dev-shm-usage',
  '--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--ignore-gpu-blocklist',
  '--disable-gpu-sandbox'
 ]
});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:8765/static/octavus-native-preview.html',{
  waitUntil:'domcontentloaded',timeout:25000
 });
 await page.waitForFunction(()=>{
  return document.getElementById('metric-tris')?.textContent==='98,358'
   && document.getElementById('load-state')?.hidden===true;
 },{timeout:60000});
 await page.waitForFunction(()=>{
  return document.getElementById('metric-starts')?.textContent==='33';
 },{timeout:15000});
 await page.waitForFunction(()=>{
  const image=document.getElementById('original-mapshot');
  return image?.complete && image.naturalWidth>=128 && image.naturalHeight>=128;
 },{timeout:15000});
 const stats=await page.evaluate(()=>{
  const canvas=document.querySelector('#viewport canvas');
  return {
   triangles:document.getElementById('metric-tris').textContent,
   vertices:document.getElementById('metric-verts').textContent,
   slots:document.getElementById('metric-slots').textContent,
   starts:document.getElementById('metric-starts').textContent,
   canvas:{width:canvas.width,height:canvas.height},
   info:document.getElementById('diagnostic').textContent,
   view:document.getElementById('view-label').textContent
  };
 });
 assert.equal(stats.triangles,'98,358');
 assert.equal(stats.vertices,'123,915');
 assert.equal(stats.slots,'195');
 assert.equal(stats.starts,'33');
 assert.ok(stats.canvas.width>400&&stats.canvas.height>250);
 assert.ok(stats.info.includes('PASS: core source mesh checksum'));
 const canvas=await page.$('#viewport canvas');
 const image=await canvas.screenshot();
 assert.ok(image.byteLength>12000,
  'Rendered WebGL image appears unexpectedly empty: '+image.byteLength+' bytes');
 writeFileSync('/tmp/octavus-native-core-preview.png',image);
 await page.screenshot({path:'/tmp/octavus-native-side-by-side.png',fullPage:true});
 await page.click('#top-btn');
 await page.click('#spawns');
 await page.select('#mode','slot');
 await page.click('#wire');
 const overlays=await page.evaluate(()=>({
  spawnChecked:document.getElementById('spawns').checked,
  wireChecked:document.getElementById('wire').checked,
  materialMode:document.getElementById('mode').value
 }));
 assert.deepEqual(overlays,{spawnChecked:true,wireChecked:true,materialMode:'slot'});
 assert.deepEqual(errors,[],'No browser runtime errors permitted');
 console.log('Octavus native preview headless Chrome: PASS');
 console.log(JSON.stringify({...stats,previewPngBytes:image.byteLength},null,2));
}finally{
 await browser.close();
}
