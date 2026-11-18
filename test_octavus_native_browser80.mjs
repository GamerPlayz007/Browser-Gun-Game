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
 // Verify the stronger phase1.5 source stage actually loads as WebGL,
 // rather than trusting binary and syntax checks alone.
 await page.click('#wire'); // turn wireframe off for performance
 await page.select('#mode','neutral');
 await page.click('#home-btn');
 page.on('dialog',dialog=>dialog.accept());
 await page.click('#optimized-btn');
 await page.waitForFunction(()=>{
  return document.getElementById('metric-tris')?.textContent==='863,803'
      && document.getElementById('load-state')?.hidden===true;
 },{timeout:90000});
 const corrected=await page.evaluate(()=>({
  triangles:document.getElementById('metric-tris').textContent,
  vertices:document.getElementById('metric-verts').textContent,
  slots:Number(document.getElementById('metric-slots').textContent),
  mode:document.getElementById('view-label').textContent,
  diagnostic:document.getElementById('diagnostic').textContent.slice(0,220)
 }));
 assert.equal(corrected.triangles,'863,803');
 assert.equal(corrected.vertices,'679,837');
 assert.ok(corrected.slots>=195);
 assert.ok(corrected.mode.includes('PARTIAL-VISIBILITY'));
 assert.ok(corrected.diagnostic.includes('PASS: optimized source mesh checksum'));
 const enhancedImage=await canvas.screenshot();
 assert.ok(enhancedImage.byteLength>12000);
 writeFileSync('/tmp/octavus-native-optimized-preview.png',enhancedImage);
 // Verify the original, attributed source images are really usable by
 // the renderer, not just linked in a JSON manifest.
 const shaderErrors=[];
 page.on('console',msg=>{
  if(msg.type()==='error'&&/Shader Error|WebGLProgram|GL_INVALID_OPERATION|ERROR: 0:/.test(msg.text()))
   shaderErrors.push(msg.text().slice(0,1000));
 });
 await page.select('#mode','source');
 await page.waitForFunction(()=>{
  return document.getElementById('diagnostic')?.textContent.includes('SOURCE TEXTURES:');
 },{timeout:60000});
 const sourceMode=await page.evaluate(()=>({
  mode:document.getElementById('mode').value,
  status:document.getElementById('render-label').textContent,
  diagnostic:document.getElementById('diagnostic').textContent.slice(0,500)
 }));
 assert.equal(sourceMode.mode,'source');
 assert.ok(sourceMode.diagnostic.includes('SOURCE TEXTURES:'));
 assert.ok(sourceMode.status.includes('original image files'));
 const matched=sourceMode.status.match(/^(\d+) material slots using (\d+) original image files/);
 assert.ok(matched,'Source texture preview must report an actual count');
 assert.ok(Number(matched[1])>=150,'Too few source-native material slots resolved');
 assert.ok(Number(matched[2])>=30,'Too few distinct original images loaded');
 await page.waitForFunction(()=>{
   return document.getElementById('fps-label')?.textContent.includes('FPS');
 },{timeout:15000});
 const textureImage=await canvas.screenshot();
 assert.ok(textureImage.byteLength>12000);
 writeFileSync('/tmp/octavus-native-source-textures-preview.png',textureImage);
 // One-click player-friendly preview must load all source scenery onto
 // the native reconstructed map, without modifying the live game.
 await page.click('#restored-btn');
 await page.waitForFunction(()=>{
  return document.getElementById('metric-props')?.textContent==='135'
    && document.getElementById('metric-lights')?.textContent==='233'
    && document.getElementById('metric-skybox')?.textContent==='Loaded'
    && document.getElementById('metric-decals')?.textContent==='135'
    && document.getElementById('metric-tris')?.textContent==='863,803'
    && document.getElementById('mode')?.value==='source'
    && !document.getElementById('restored-btn')?.disabled;
 },{timeout:120000});
 assert.ok(await page.evaluate(()=>document.getElementById('diagnostic').textContent.includes('RESTORED SOURCE SCENE')));
 const sceneryStats=await page.evaluate(()=>({
  originalProps:document.getElementById('metric-props').textContent,
  originalDecals:document.getElementById('metric-decals').textContent,
  sourceLights:document.getElementById('metric-lights').textContent,
  sky:document.getElementById('metric-skybox').textContent,
  url:location.pathname
 }));
 assert.deepEqual(sceneryStats,{
  originalProps:'135',originalDecals:'135',sourceLights:'233',
  sky:'Loaded',url:'/static/octavus-native-preview.html'
 });
 const scenicImage=await canvas.screenshot();
 assert.ok(scenicImage.byteLength>12000,'Scenic WebGL canvas failed');
 writeFileSync('/tmp/octavus-native-source-scenery-preview.png',scenicImage);
 await page.screenshot({path:'/tmp/octavus-native-source-scenery-full.png',fullPage:true});
 assert.deepEqual(shaderErrors,[],'Source props, decals, and Redcliff sky must not break WebGL shaders');
 assert.deepEqual(errors,[],'Native scenery must not create browser page errors');
 await page.click('#source-decals');
 await page.waitForFunction(()=>{
  return document.getElementById('metric-decals').textContent==='0';
 },{timeout:15000});
 await page.click('#source-props');
 await page.waitForFunction(()=>{
  return document.getElementById('metric-props').textContent==='0';
 },{timeout:15000});
 await page.click('#source-env');
 await page.waitForFunction(()=>{
  return document.getElementById('metric-lights').textContent==='0'
      && document.getElementById('metric-skybox').textContent==='Off';
 },{timeout:15000});
 assert.deepEqual(shaderErrors,[],'Native scenery disposal must not break WebGL');
 assert.deepEqual(shaderErrors,[],'Native texture source projection must compile in Chrome WebGL');
 assert.deepEqual(errors,[],'No browser runtime errors permitted');
 console.log('Octavus native preview headless Chrome: PASS');
 console.log(JSON.stringify({...stats,previewPngBytes:image.byteLength,optimizedPngBytes:enhancedImage.byteLength,sourceTexturePngBytes:textureImage.byteLength,sourceSceneryPngBytes:scenicImage.byteLength},null,2));
}finally{
 await browser.close();
}
