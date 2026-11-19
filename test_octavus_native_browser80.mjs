/* Real Chromium rendering smoke for the isolated Octavus native preview.
 * Runs in GitHub Actions against an HTTP server from repo root.
 */
import assert from 'node:assert/strict';
import {existsSync,statSync,writeFileSync,readFileSync} from 'node:fs';
import puppeteer from 'puppeteer-core';

const chrome=[
 process.env.CHROME_BIN,
 '/usr/bin/google-chrome',
 '/usr/bin/google-chrome-stable',
 '/opt/google/chrome/chrome'
].filter(Boolean).find(p=>existsSync(p));
assert.ok(chrome,'Chromium/Google Chrome executable missing on runner');
// Source-native alignment fixes must NEVER change the deployed game's
// existing prop/decal loaders until the new world and collision are ready.
const liveProps=readFileSync('static/octavus_props.js','utf8');
const liveDecals=readFileSync('static/octavus_decals.js','utf8');
const nativeProps=readFileSync('static/octavus_native_props89.js','utf8');
const nativeDecals=readFileSync('static/octavus_native_decals89.js','utf8');
const previewScenery=readFileSync('static/octavus_native_scenery88.js','utf8');
assert.ok(!liveProps.includes('octavus_native_transform89.js'));
assert.ok(!liveDecals.includes('octavus_native_transform89.js'));
assert.ok(nativeProps.includes('octavus_native_transform89.js'));
assert.ok(nativeDecals.includes('octavus_native_decal_project90.js'));
assert.ok(previewScenery.includes('octavus_native_props89.js'));
assert.ok(previewScenery.includes('octavus_native_decals89.js'));
assert.ok(!previewScenery.includes("from './octavus_props.js'"));
assert.ok(!previewScenery.includes("from './octavus_decals.js'"));
const projectorSource=readFileSync('static/octavus_native_decal_project90.js','utf8');
const nativeDecalSource=readFileSync('static/octavus_native_decals89.js','utf8');
assert.ok(projectorSource.includes('clipNativeDecalPolygon'));
assert.ok(nativeDecalSource.includes('projectNativeDecal'));
assert.ok(nativeDecalSource.includes('nativeGeometry'));
assert.ok(!nativeDecalSource.includes('new THREE.PlaneGeometry'));
assert.ok(!liveDecals.includes('octavus_native_decal_project90.js'));
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
 // Stage 2.1: the SOURCE SCREENSHOT playable island must draw as a
 // sealed 58-segment, 60m sandstone wall on the ACTUAL OCN2 scene.
 await page.waitForFunction(()=>{
  return document.getElementById('metric-wall-segments')?.textContent==='58'
   && document.getElementById('metric-wall-height')?.textContent==='60 m'
   && document.getElementById('metric-wall-spawns')?.textContent==='33 / 33'
   && document.getElementById('arena-wall')?.checked===true;
 },{timeout:25000});
 const arenaWallData=await page.evaluate(async()=>{
  const {loadNativeArenaBoundary92,makeNativeArenaWall92}
    =await import('/static/octavus_native_boundary92.js');
  const island=await loadNativeArenaBoundary92();
  const segment=makeNativeArenaWall92(island);
  const result={
   segments:segment.wallSegments,
   triangles:segment.triangles,
   wallHeight:island.wallTopY-island.wallBaseY,
   centerAllowed:island.allowed(0,0),
   outerBlocked:!island.allowed(100,0),
   stoppedCrossing:island.clipHorizontal([0,0],[140,140]).blocked,
   playableArea:Math.round(Math.abs(island.area)),
  };
  segment.dispose();return result;
 });
 assert.equal(arenaWallData.segments,58);
 assert.equal(arenaWallData.triangles,464);
 assert.equal(arenaWallData.wallHeight,60);
 assert.equal(arenaWallData.centerAllowed,true);
 assert.equal(arenaWallData.outerBlocked,true);
 assert.equal(arenaWallData.stoppedCrossing,true);
 assert.ok(arenaWallData.playableArea>=8000&&arenaWallData.playableArea<=9000);
 await page.click('#top-btn');
 const arenaWallCanvas=await page.$('#viewport canvas');
 const wallScreenshot=await arenaWallCanvas.screenshot();
 assert.ok(wallScreenshot.byteLength>12000);
 writeFileSync('/tmp/octavus-native-island-boundary-wall.png',wallScreenshot);
 await page.click('#arena-wall');
 await page.waitForFunction(()=>document.getElementById('arena-wall')?.checked===false);
 const unboundedScreenshot=await arenaWallCanvas.screenshot();
 assert.ok(unboundedScreenshot.byteLength>12000);
 writeFileSync('/tmp/octavus-native-island-unbounded-comparison.png',unboundedScreenshot);
 assert.notDeepEqual(wallScreenshot,unboundedScreenshot,
  'Visible island perimeter must actually render different from no wall');
 await page.click('#arena-wall');
 assert.equal(await page.evaluate(()=>document.getElementById('arena-wall').checked),true);
 await page.click('#home-btn');
 // Stage 2.2: expose real interior-floor gaps, not a generic
 // debug-grid animation. Verify the exact compact native octree loads
 // with original solid/empty/deformed cell identity in actual Chrome.
 await page.click('#interior-survey-btn');
 await page.waitForFunction(()=>{
  return document.getElementById('metric-interior-samples')?.textContent==='775'
    && document.getElementById('metric-interior-supported')?.textContent==='597 / 775'
    && document.getElementById('metric-interior-new')?.textContent==='14'
    && document.getElementById('metric-interior-cubes')?.textContent==='690,939'
    && document.getElementById('interior-survey-btn')?.textContent==='Hide interior floor survey'
    && !document.getElementById('interior-survey-btn')?.disabled;
 },{timeout:90000});
 const nativeOccupancy=await page.evaluate(async()=>{
  const {loadNativeOccupancy96}=await import('/static/octavus_native_occupancy96.js');
  const {index,manifest,validatedSha256}=await loadNativeOccupancy96();
  const start=manifest.actualSourceOccupancyFixtures[0];
  const leaf=index.lookup(start.native);
  return {
   cells:index.count,
   kinds:index.cellsByKind,
   verified:validatedSha256===manifest.compressedSha256,
   sampleParity:(leaf?.kind??null)===start.kind,
   unresolvedDeformedCollision:!index.deformedCollisionProven,
   sourceFirstPlayerStart:document.getElementById('metric-starts').textContent,
  };
 });
 assert.equal(nativeOccupancy.cells,690939);
 assert.equal(nativeOccupancy.verified,true);
 assert.equal(nativeOccupancy.sampleParity,true);
 assert.equal(nativeOccupancy.unresolvedDeformedCollision,true);
 assert.ok(nativeOccupancy.kinds.solid>0&&nativeOccupancy.kinds.deformed>0);
 const floorOverlayImage=await (await page.$('#viewport canvas')).screenshot();
 assert.ok(floorOverlayImage.byteLength>12000);
 writeFileSync('/tmp/octavus-native-interior-floor-survey.png',floorOverlayImage);
 await page.click('#interior-survey-btn');
 await page.waitForFunction(()=>document.getElementById('interior-survey-btn')?.textContent==='Show interior floor survey');
 // Phase 2.0: the original-native collision pilot must LOAD through
 // the actual browser fetch+gzip+SHA256 path and expose source spawn
 // clearance marks while leaving the existing gameplay map untouched.
 await page.click('#native-collision-btn');
 await page.waitForFunction(()=>{
  return document.getElementById('metric-collision-tris')?.textContent==='98,358'
    && Number(document.getElementById('metric-collision-safe')?.textContent)>=20
    && Number(document.getElementById('metric-collision-review')?.textContent)>=1
    && !document.getElementById('native-collision-btn')?.disabled;
 },{timeout:60000});
 const pilotVisible=await page.evaluate(()=>({
  sourceTriangles:document.getElementById('metric-collision-tris').textContent,
  safe:Number(document.getElementById('metric-collision-safe').textContent),
  review:Number(document.getElementById('metric-collision-review').textContent),
  button:document.getElementById('native-collision-btn').textContent,
  shaMessage:document.getElementById('diagnostic').textContent.includes('byte-identical collision vertex coordinates'),
 }));
 assert.equal(pilotVisible.safe+pilotVisible.review,33);
 assert.equal(pilotVisible.sourceTriangles,'98,358');
 assert.equal(pilotVisible.button,'Hide spawn checks');
 assert.equal(pilotVisible.shaMessage,true);
 const collisionScreenshot=await (await page.$('#viewport canvas')).screenshot();
 assert.ok(collisionScreenshot.byteLength>12000);
 writeFileSync('/tmp/octavus-native-collision-spawn-review.png',collisionScreenshot);
 await page.click('#native-collision-btn');
 assert.equal(await page.evaluate(()=>document.getElementById('native-collision-btn').textContent),'Show spawn checks');
 // Phase 1.8 checks original engine axis handedness directly rather
 // than merely checking that a model loader returned 135 objects.
 const transformProof=await page.evaluate(async()=>{
  const THREE=await import('three');
  const bridge=await import('/static/octavus_native_transform89.js');
  const near=(a,b)=>a.distanceTo(b)<1e-6;
  const sourceY=new THREE.Vector3(0,1,0);
  const axisZ=new THREE.Vector3(0,0,1);
  const axisX=new THREE.Vector3(1,0,0);
  const yaw=axisX.clone().applyQuaternion(bridge.octavusSourceQuaternion(90,0,0));
  const pitch=axisZ.clone().applyQuaternion(bridge.octavusSourceQuaternion(0,90,0));
  const roll=new THREE.Vector3(0,1,0).applyQuaternion(bridge.octavusSourceQuaternion(0,0,90));
  const object=new THREE.Group();
  bridge.octavusModelNativeToViewer(object);object.updateMatrix();
  const mappedNativeY=sourceY.clone().applyMatrix4(object.matrix);
  const origin=bridge.originalNativePosition([4096,4096,2816]);
  return {
   nativeYaw90MapsXToPosZ:near(yaw,axisZ),
   nativePitch90MapsYToPosVertical:near(pitch,sourceY),
   nativeRoll90MapsZToNegX:near(roll,axisX.clone().negate()),
   nativeObjYMapsViewerZ:near(mappedNativeY,axisZ),
   originAtWorldZero:near(origin,new THREE.Vector3()),
   originalDecal50to2p5:bridge.originalDecalSize([0,0,0,0,50])===2.5,
   transformRevision:bridge.TRANSFORM_REVISION
  };
 });
 assert.deepEqual(transformProof,{
  nativeYaw90MapsXToPosZ:true,
  nativePitch90MapsYToPosVertical:true,
  nativeRoll90MapsZToNegX:true,
  nativeObjYMapsViewerZ:true,
  originAtWorldZero:true,
  originalDecal50to2p5:true,
  transformRevision:'MAPZ-v59-axis-bridge89'
 },'Native world-model transforms must match Red Eclipse original Euler axes');
 // Phase 1.9: prove physical clipping instead of floating billboard
 // proxies on small synthetic geometry before importing the full native map.
 const projectionProof=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {buildOctavusTriangleIndex,projectNativeDecal,clipNativeDecalPolygon}
       =await import('/static/octavus_native_decal_project90.js');
  function square(z,reverse=false){
   const g=new THREE.BufferGeometry();
   g.setAttribute('position',new THREE.Float32BufferAttribute([
    -2,-2,z,2,-2,z,2,2,z,-2,2,z
   ],3));
   g.setIndex(reverse?[0,2,1,0,3,2]:[0,1,2,0,2,3]);
   return g;
  }
  const entry={id:9999,sourcePosition:[4096,4096,2816],
               attrs:[30,0,0,0,50]};
  const wall=square(.5),back=square(.5,true),outside=square(3);
  const face=projectNativeDecal(wall,buildOctavusTriangleIndex(wall),entry,100,100);
  const wrongSide=projectNativeDecal(back,buildOctavusTriangleIndex(back),entry,100,100);
  const outsideVolume=projectNativeDecal(outside,buildOctavusTriangleIndex(outside),entry,100,100);
  const p=face.geometry.getAttribute('position');
  const uv=face.geometry.getAttribute('uv');
  let b={xmin:1e6,xmax:-1e6,ymin:1e6,ymax:-1e6,zmin:1e6,zmax:-1e6,uMin:1e6,uMax:-1e6,vMin:1e6,vMax:-1e6};
  for(let i=0;i<p.count;i++){
   b.xmin=Math.min(b.xmin,p.getX(i));b.xmax=Math.max(b.xmax,p.getX(i));
   b.ymin=Math.min(b.ymin,p.getY(i));b.ymax=Math.max(b.ymax,p.getY(i));
   b.zmin=Math.min(b.zmin,p.getZ(i));b.zmax=Math.max(b.zmax,p.getZ(i));
   b.uMin=Math.min(b.uMin,uv.getX(i));b.uMax=Math.max(b.uMax,uv.getX(i));
   b.vMin=Math.min(b.vMin,uv.getY(i));b.vMax=Math.max(b.vMax,uv.getY(i));
  }
  const result={
   clipped:face.triangles>=2,
   backFacingRejected:wrongSide.triangles===0,
   projectorDepthRejected:outsideVolume.triangles===0,
   staysOnActualSourceSurface:Math.abs(b.zmin-.503)<.0005&&Math.abs(b.zmax-.503)<.0005,
   uClamped:b.uMin>=-.0001&&b.uMax<=1.0001,
   vClamped:b.vMin>=-.0001&&b.vMax<=1.0001,
   boundsClipped:b.xmin>=-1.2501&&b.xmax<=1.2501&&
                 b.ymin>=-1.2501&&b.ymax<=1.2501,
   noOutsidePolygon:clipNativeDecalPolygon([[4,4,4],[5,4,4],[4,5,4]],2.5,2.5,2.5).length===0
  };
  for(const g of [wall,back,outside,face.geometry,wrongSide.geometry,outsideVolume.geometry])g.dispose();
  return result;
 });
 assert.deepEqual(projectionProof,{
  clipped:true,backFacingRejected:true,projectorDepthRejected:true,
  staysOnActualSourceSurface:true,uClamped:true,vClamped:true,
  boundsClipped:true,noOutsidePolygon:true
 },'Native decal must clip original world triangles, never float across open space');
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
 try{
  await page.waitForFunction(()=>{
   return document.getElementById('metric-props')?.textContent==='135'
     && document.getElementById('metric-lights')?.textContent==='233'
     && document.getElementById('metric-skybox')?.textContent==='Loaded'
     && document.getElementById('metric-decals')?.textContent==='135'
     && document.getElementById('metric-tris')?.textContent==='863,803'
     && document.getElementById('mode')?.value==='source'
     && !document.getElementById('restored-btn')?.disabled;
  },{timeout:45000});
 }catch(error){
  const state=await Promise.race([
   page.evaluate(()=>({
     props:document.getElementById('metric-props')?.textContent,
     decals:document.getElementById('metric-decals')?.textContent,
     projected:document.getElementById('metric-projected')?.textContent,
     projectedTriangles:document.getElementById('metric-decal-tris')?.textContent,
     lights:document.getElementById('metric-lights')?.textContent,
     sky:document.getElementById('metric-skybox')?.textContent,
     button:document.getElementById('restored-btn')?.disabled,
     diagnostic:document.getElementById('diagnostic')?.textContent.slice(0,3500)
   })),
   new Promise(resolve=>setTimeout(()=>resolve({unresponsiveBrowser:true}),6500))
  ]);
  console.error('Octavus decal browser diagnostic:',JSON.stringify(state,null,2),'PAGE ERRORS',errors);
  throw error;
 }
 assert.ok(await page.evaluate(()=>document.getElementById('diagnostic').textContent.includes('RESTORED SOURCE SCENE')));
 await page.waitForFunction(()=>{
  const count=Number(document.getElementById('metric-projected')?.textContent);
  const tris=Number(document.getElementById('metric-decal-tris')?.textContent.replace(/,/g,''));
  return count>0&&tris>0;
 },{timeout:60000});
 const decalCoverage=await page.evaluate(()=>({
  projected:Number(document.getElementById('metric-projected').textContent),
  triangles:Number(document.getElementById('metric-decal-tris').textContent.replace(/,/g,''))
 }));
 assert.ok(decalCoverage.projected>=130&&decalCoverage.projected<=135,
  'Almost all available source decal placements must find actual reconstructed surfaces');
 assert.ok(decalCoverage.triangles>=decalCoverage.projected);
 assert.ok(decalCoverage.triangles<50000,
  'Projected decals must not recreate huge stacks of hidden interior geometry');
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
 // Distinguish authentic entity anchors from decorative geometry: exact
 // source MPZ positions must be inspectable and fully removable.
 await page.click('#source-anchors');
 await page.waitForFunction(()=>document.getElementById('metric-anchors')?.textContent==='135',{timeout:15000});
 await page.click('#prop-focus-btn');
 await page.waitForFunction(()=>document.getElementById('camera-label')?.textContent.includes('38 m'),{timeout:15000});
 const anchoredImage=await canvas.screenshot();
 assert.ok(anchoredImage.byteLength>12000);
 writeFileSync('/tmp/octavus-native-geometry-anchors-preview.png',anchoredImage);
 await page.click('#source-anchors');
 await page.waitForFunction(()=>document.getElementById('metric-anchors')?.textContent==='0',{timeout:15000});
 const scenicImage=await canvas.screenshot();
 assert.ok(scenicImage.byteLength>12000,'Scenic WebGL canvas failed');
 writeFileSync('/tmp/octavus-native-source-scenery-preview.png',scenicImage);
 await page.screenshot({path:'/tmp/octavus-native-source-scenery-full.png',fullPage:true});
 assert.deepEqual(shaderErrors,[],'Source props, decals, and Redcliff sky must not break WebGL shaders');
 assert.deepEqual(errors,[],'Native scenery must not create browser page errors');
 await page.click('#source-decals');
 await page.waitForFunction(()=>{
  return document.getElementById('metric-decals').textContent==='0'
     && document.getElementById('metric-projected').textContent==='0'
     && document.getElementById('metric-decal-tris').textContent==='0';
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
 console.log(JSON.stringify({...stats,previewPngBytes:image.byteLength,optimizedPngBytes:enhancedImage.byteLength,sourceTexturePngBytes:textureImage.byteLength,sourceSceneryPngBytes:scenicImage.byteLength,alignmentAnchorPngBytes:anchoredImage.byteLength,decalProjection:decalCoverage,collisionPilot:pilotVisible,collisionPilotPngBytes:collisionScreenshot.byteLength,nativeArenaWall:arenaWallData,arenaWallScreenshotBytes:wallScreenshot.byteLength,nativeOctreeOccupancy:nativeOccupancy,interiorSurveyImageBytes:floorOverlayImage.byteLength},null,2));
}finally{
 await browser.close();
}
