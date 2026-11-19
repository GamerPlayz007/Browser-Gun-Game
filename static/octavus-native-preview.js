/* Octavus Phase 1.3 - independent native MPZ geometry inspector.
 * Original Red Eclipse 2 Octavus map CC BY-SA 3.0, Ricky Thomson.
 * OCN2 staging data is not the active multiplayer map.
 */
import * as THREE from 'three';
import {OctavusNativeMaterialPreview} from './octavus_native_material_preview87.js';
import {OctavusNativeScenery} from './octavus_native_scenery88.js';
import {loadNativeArenaBoundary92,makeNativeArenaWall92} from './octavus_native_boundary92.js';
import {loadNativeCollision91} from './octavus_native_collision91.js';
const ROOT='/static/maps/';
const $=id=>document.getElementById(id);
const fmt=n=>Number(n).toLocaleString('en-US');
const viewport=$('viewport'),state=$('load-state'),diag=$('diagnostic');
const canvasRenderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
canvasRenderer.setPixelRatio(Math.min(1.25,window.devicePixelRatio||1));
canvasRenderer.outputColorSpace=THREE.SRGBColorSpace;
canvasRenderer.toneMapping=THREE.ACESFilmicToneMapping;
canvasRenderer.toneMappingExposure=1.07;
viewport.insertBefore(canvasRenderer.domElement,viewport.firstChild);
const scene=new THREE.Scene();
scene.background=new THREE.Color('#101b29');
const camera=new THREE.PerspectiveCamera(60,1,.1,1300);
const originalHemi=new THREE.HemisphereLight('#f3e7d3','#41556b',1.65);
scene.add(originalHemi);
const sun=new THREE.DirectionalLight('#ffdfb4',2.15);
sun.position.set(-40,95,75);scene.add(sun);
const grid=new THREE.GridHelper(420,42,0x57687a,0x233449);
grid.position.y=-15.2;
grid.material.opacity=.38;grid.material.transparent=true;
scene.add(grid);
const nativeMaterialPreview=new OctavusNativeMaterialPreview();
const originalScenery=new OctavusNativeScenery(scene,{sourceHemisphere:originalHemi,sourceSun:sun});
let arenaLimit92=null,arenaWall92=null;
originalScenery.onNotice=message=>note(message);
originalScenery.onCounts=counts=>{
 $('metric-props').textContent=fmt(counts.models);
 $('metric-anchors').textContent=fmt(counts.anchors);
 $('metric-decals').textContent=fmt(counts.decals);
 $('metric-projected').textContent=fmt(counts.projectedDecals);
 $('metric-decal-tris').textContent=fmt(counts.projectedTriangles);
 $('metric-lights').textContent=fmt(counts.lightEntities);
 $('metric-skybox').textContent=counts.skybox?'Loaded':'Off';
};
const markers=new THREE.Group();markers.name='33 original MPZ player starts';markers.visible=false;scene.add(markers);
const collisionMarkers=new THREE.Group();
collisionMarkers.name='Source-native collision pilot clearance markers, not live spawn locations';
collisionMarkers.visible=false;
scene.add(collisionMarkers);
const clearSpawnMaterial=new THREE.MeshBasicMaterial({color:0x4ee2ac,depthTest:false});
const reviewSpawnMaterial=new THREE.MeshBasicMaterial({color:0xffad57,depthTest:false});
const collisionMarkerGeometry=new THREE.IcosahedronGeometry(.85,1);
let collisionPilotLoaded=false;
const markerGeom=new THREE.SphereGeometry(.7,8,6);
const markerMat=new THREE.MeshBasicMaterial({color:0x8ee1b7});
const stemGeom=new THREE.CylinderGeometry(.12,.12,2,6);
const stemMat=new THREE.MeshBasicMaterial({color:0x64ae97});
const target=new THREE.Vector3(0,2,0);
let yaw=.7,pitch=.55,distance=142,drag=null,current=null,active='core',requestID=0,starts=[],propFocus=null;
let lastFrame=performance.now(),frames=0,fpsBegin=lastFrame;
function note(msg){diag.textContent=msg+'\n'+diag.textContent.slice(0,1250)}
function updateCamera(){
 pitch=Math.max(-.18,Math.min(Math.PI/2-.015,pitch));
 distance=Math.max(3,Math.min(550,distance));
 camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,
  target.y+Math.sin(pitch)*distance,
  target.z+Math.cos(yaw)*Math.cos(pitch)*distance);
 camera.lookAt(target);camera.updateMatrixWorld();
 $('camera-label').textContent='Focus distance: '+distance.toFixed(0)+' m';
}
function sizeCanvas(){
 const w=Math.max(1,viewport.clientWidth),h=Math.max(1,viewport.clientHeight);
 camera.aspect=w/h;camera.updateProjectionMatrix();
 canvasRenderer.setSize(w,h,false);
}
function home(){target.set(0,2,0);yaw=.7;pitch=.55;distance=142;updateCamera()}
async function initializeIslandWall(){
 try{
  const ring=await loadNativeArenaBoundary92();
  if(arenaWall92)return;
  arenaLimit92=ring;
  arenaWall92=makeNativeArenaWall92(ring);
  scene.add(arenaWall92.mesh);
  arenaWall92.show($('arena-wall').checked);
  $('metric-wall-segments').textContent=fmt(arenaWall92.wallSegments);
  $('metric-wall-height').textContent=fmt(ring.wallTopY-ring.wallBaseY)+' m';
  $('metric-playable-area').textContent=fmt(Math.round(Math.abs(ring.area)))+' m²';
  updateIslandStarts();
  note('STAGE 2.1 NATIVE ARENA: '+arenaWall92.wallSegments+' connected sandstone wall segments enclose the island in your reference image, '+fmt(ring.wallTopY-ring.wallBaseY)+'m tall. Outside world is non-playable in the planned multiplayer replacement. The 58-segment source polygon is shared with Python server prototype; LIVE GAME STILL UNCHANGED.');
 }catch(e){
  $('metric-wall-segments').textContent='Error';
  note('NATIVE ISLAND WALL UNAVAILABLE: '+(e.message||String(e)));
 }
}
function updateIslandStarts(){
 if(!arenaLimit92||!starts.length)return;
 const inside=starts.filter(e=>{
  const [x,,z]=toWorld(e.sourcePosition);
  return arenaLimit92.allowed(x,z);
 }).length;
 $('metric-wall-spawns').textContent=inside+' / '+starts.length;
}
$('arena-wall').addEventListener('change',()=>{
 if(arenaWall92)arenaWall92.show($('arena-wall').checked);
 note($('arena-wall').checked?'Island perimeter wall visible (stage 2.1 staging-only).':'Island perimeter wall hidden for geometry comparison; gameplay mask data remains unchanged.');
});
$('home-btn').addEventListener('click',home);
$('top-btn').addEventListener('click',()=>{
 target.set(0,2,0);yaw=0;pitch=Math.PI/2-.015;distance=230;updateCamera();
});
$('spawn-btn').addEventListener('click',()=>{
 if(!starts.length){note('Native player starts have not loaded.');return}
 const p=toWorld(starts[0].sourcePosition);
 target.set(...p);distance=36;yaw=.9;pitch=.38;
 $('spawns').checked=true;markers.visible=true;updateCamera();
});
$('native-collision-btn').addEventListener('click',async()=>{
 const button=$('native-collision-btn');
 if(button.disabled)return;
 if(collisionPilotLoaded){
  collisionMarkers.visible=!collisionMarkers.visible;
  button.textContent=collisionMarkers.visible?'Hide spawn checks':'Show spawn checks';
  return;
 }
 button.disabled=true;button.textContent='Verifying source collision…';
 try{
  const pilot=await loadNativeCollision91();
  const rows=pilot.originalStarts;
  if(pilot.soup.count!==98358||rows?.length!==33||!pilot.validatedFloat32Checksum)
   throw Error('Native collision pilot is not verified against server data');
  let clearCount=0;
  for(const row of rows){
   const safe=!!row.potentiallyUsable;
   const sphere=new THREE.Mesh(collisionMarkerGeometry,safe?clearSpawnMaterial:reviewSpawnMaterial);
   sphere.position.set(...row.worldPosition);
   sphere.position.y+=1.7;
   sphere.renderOrder=100;
   sphere.userData.sourceEntityID=row.entityID;
   sphere.userData.capsuleClear=row.capsuleClear;
   sphere.userData.floorSupported=row.supportedAtOriginalHeight;
   sphere.userData.potentiallyUsable=safe;
   collisionMarkers.add(sphere);
   if(safe)clearCount++;
  }
  $('metric-collision-tris').textContent=fmt(pilot.soup.count);
  $('metric-collision-safe').textContent=fmt(clearCount);
  $('metric-collision-review').textContent=fmt(rows.length-clearCount);
  collisionMarkers.visible=true;
  collisionPilotLoaded=true;
  button.textContent='Hide spawn checks';
  note('NATIVE COLLISION PILOT: Python and JavaScript produced byte-identical collision vertex coordinates from the same SHA256 source archive. '+clearCount+' of '+rows.length+' original MPZ spawn positions passed initial floor and capsule checks; '+(rows.length-clearCount)+' orange markers require investigation. The 98K architecture-only prototype still excludes material slot 1 and is NOT yet safe to use as authoritative multiplayer collision.');
 }catch(e){
  button.textContent='Check original spawn collision';
  note('NATIVE COLLISION PILOT UNAVAILABLE: '+(e.message||String(e)));
 }finally{
  button.disabled=false;
 }
});
viewport.addEventListener('pointerdown',e=>{
 if(e.target!==canvasRenderer.domElement)return;
 drag={id:e.pointerId,x:e.clientX,y:e.clientY,pan:e.shiftKey||e.button===2};
 canvasRenderer.domElement.setPointerCapture(e.pointerId);
});
viewport.addEventListener('pointermove',e=>{
 if(!drag||e.pointerId!==drag.id)return;
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
 if(drag.pan){
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
  const up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
  target.addScaledVector(right,-dx*distance*.0015);
  target.addScaledVector(up,dy*distance*.0015);
 }else{yaw-=dx*.007;pitch+=dy*.006}
 updateCamera();
});
viewport.addEventListener('pointerup',e=>{if(drag&&drag.id===e.pointerId)drag=null});
viewport.addEventListener('pointercancel',()=>{drag=null});
viewport.addEventListener('contextmenu',e=>e.preventDefault());
viewport.addEventListener('wheel',e=>{e.preventDefault();distance*=Math.exp(e.deltaY*.001);updateCamera()},{passive:false});
new ResizeObserver(sizeCanvas).observe(viewport);
window.addEventListener('resize',sizeCanvas);sizeCanvas();home();

function toWorld(xyz){
 // Source XYZ: X/Y ground, Z vertical. Center source map at 4096.
 return [(xyz[0]-4096)*.05,(xyz[2]-2816)*.05,(xyz[1]-4096)*.05];
}
async function json(path){
 const r=await fetch(path,{cache:'no-cache'});
 if(!r.ok)throw Error('Missing '+path+' (HTTP '+r.status+')');
 return r.json();
}
function hex(buffer){return [...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function download(which){
 const base=which==='core'?'octavus.native-core':which==='optimized'?'octavus.native-optimized':which==='merged'?'octavus.native-merged':'octavus.native-stage1';
 const manifestPath=ROOT+base+'.json',binaryPath=ROOT+base+'.bin.gz';
 const [meta,response]=await Promise.all([json(manifestPath),fetch(binaryPath,{cache:'no-cache'})]);
 if(!response.ok)throw Error('Native geometry is unavailable (HTTP '+response.status+')');
 if(typeof DecompressionStream==='undefined')throw Error('A recent Chrome or Edge browser is required for gzip decoding');
 const compressed=await response.arrayBuffer();
 const sha=hex(await crypto.subtle.digest('SHA-256',compressed));
 const expected=which==='raw'?meta.stagingSHA256:meta.sha256;
 if(sha!==expected)throw Error('Native geometry checksum mismatch');
 if(meta.format!=='OCN2'||meta.status!=='staging-only-not-live')throw Error('Source stage metadata is invalid');
 const decoded=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 if(decoded.byteLength<12)throw Error('Native mesh truncated');
 const dv=new DataView(decoded),magic=String.fromCharCode(...new Uint8Array(decoded,0,4));
 const nv=dv.getUint32(4,true),nt=dv.getUint32(8,true);
 if(magic!=='OCN2'||nv!==meta.vertices||nt!==meta.triangles||
    decoded.byteLength!==12+nv*12+nt*14)throw Error('Native geometry header or size mismatch');
 return {dv,meta,nv,nt,which};
}
function construct(asset){
 const {dv,nv,nt,which}=asset;
 const position=new Float32Array(nv*3),heightColor=new Float32Array(nv*3);
 const low=which==='core'?-16:-142,range=which==='core'?36:180;
 const tmp=new THREE.Color();
 for(let i=0;i<nv;i++){
  const base=12+i*12;
  const x=dv.getUint32(base,true),y=dv.getUint32(base+4,true),z=dv.getUint32(base+8,true);
  position[i*3]=(x/8-4096)*.05;
  position[i*3+1]=(z/8-2816)*.05;
  position[i*3+2]=(y/8-4096)*.05;
  const t=Math.max(0,Math.min(1,(position[i*3+1]-low)/range));
  tmp.setHSL(.62-.53*t,.47,.38+.17*t);
  heightColor[i*3]=tmp.r;heightColor[i*3+1]=tmp.g;heightColor[i*3+2]=tmp.b;
 }
 const bySlot=new Map();
 for(let i=0;i<nt;i++){
  const p=12+nv*12+i*14;
  const a=dv.getUint32(p,true),b=dv.getUint32(p+4,true),c=dv.getUint32(p+8,true),slot=dv.getUint16(p+12,true);
  if(a>=nv||b>=nv||c>=nv)throw Error('OCN2 references an invalid native vertex');
  let arr=bySlot.get(slot);
  if(!arr){arr=[];bySlot.set(slot,arr)}
  arr.push(a,b,c);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(position,3));
 geometry.setAttribute('color',new THREE.BufferAttribute(heightColor,3));
 const index=new Uint32Array(nt*3),materials=[],slots=[];
 let offset=0;
 for(const [slot,arr] of [...bySlot].sort((a,b)=>a[0]-b[0])){
  index.set(arr,offset);geometry.addGroup(offset,arr.length,materials.length);
  slots.push(slot);
  materials.push(new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:.87,metalness:.02,flatShading:true}));
  offset+=arr.length;
 }
 geometry.setIndex(new THREE.BufferAttribute(index,1));
 // Preserve original texture-slot ids so the staging decal projector
 // can distinguish still-unverified plain source faces from the
 // original detailed architecture, without touching map rendering.
 geometry.userData.octavusNativeSlotByMaterial=slots;
 geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const mesh=new THREE.Mesh(geometry,materials);
 mesh.name='Octavus source-native '+which;
 return {mesh,materials,slots,geometry,meta:asset.meta,which};
}
function recolor(){
 if(!current)return;
 const mode=$('mode').value,wire=$('wire').checked;
 if(mode!=='source')nativeMaterialPreview.reset(current);
 const sourceMesh=current;
 current.materials.forEach((m,i)=>{
  const slot=current.slots[i];
  m.wireframe=wire;m.vertexColors=mode==='height';
  m.transparent=false;m.opacity=1;m.depthWrite=true;
  if(mode==='slot'){
   m.color.setHSL((slot*.61803398875)%1,.55,.55);
  }else if(mode==='height'){
   m.color.set('#ffffff');
  }else if(slot===1&&current.which!=='core'){
   m.color.set('#e99caa');m.transparent=true;m.opacity=.27;m.depthWrite=false;
  }else{
   const n=.90+((slot*37)%13)*.014;
   m.color.setRGB(n,n*.92,n*.81);
  }
  m.needsUpdate=true;
 });
 $('view-label').textContent=current.which==='core'?'NATIVE ARCHITECTURE CORE':current.which==='optimized'?'NATIVE PARTIAL-VISIBILITY CANDIDATE':current.which==='merged'?'SOURCE PLANE-MERGED CANDIDATE':'HEAVY UNCULLED CANDIDATE';
 $('render-label').textContent=current.which==='core'
  ?fmt(current.slots.length)+' native material slots; plain slot 1 deliberately omitted'
  :current.which==='optimized'?'New triangle-occlusion plus exact plane merging; NOT native renderer parity':current.which==='merged'?'Exact source rectangle tessellation merged; plain slot 1 is still unverified':'Source slot 1 marked pink; most raw faces are not proven visible';
 if(mode==='source'){
  $('render-label').textContent='Loading attributed original source images; projected UVs are an approximation';
  nativeMaterialPreview.apply(sourceMesh,()=>current===sourceMesh&&$('mode').value==='source')
    .then(out=>{
     if(!out||current!==sourceMesh||$('mode').value!=='source')return;
     $('render-label').textContent=fmt(out.mappedSlots)+' material slots using '+fmt(out.distinctSourceImages)+' original image files; UV parity pending';
     note('SOURCE TEXTURES: '+fmt(out.mappedSlots)+' native material slots using '+fmt(out.distinctSourceImages)+' attributed source images. '+fmt(out.appliedTriangles)+' candidate triangles have source images; '+fmt(out.missingSlots)+' slots are fallback or deliberately untrusted. The texture projection is approximate, not an engine-exact reproduction.');
    })
    .catch(e=>{
     if(current===sourceMesh&&$('mode').value==='source')
       note('SOURCE TEXTURES UNAVAILABLE: '+e.message);
    });
 }
}
function disposeOld(){
 if(!current)return;
 scene.remove(current.mesh);
 current.geometry.dispose();current.materials.forEach(m=>m.dispose());current=null;
}
async function activate(which){
 const id=++requestID;active=which;
 state.hidden=false;
 $('load-title').textContent=which==='core'?'Loading native Octavus architecture':which==='optimized'?'Loading visibility-corrected Octavus candidate':which==='merged'?'Loading plane-merged Octavus candidate':'Loading raw candidate (heavy)';
 $('load-detail').textContent=which==='core'
  ?'Validating compressed source geometry and rebuilding 98,358 triangles.'
  :which==='optimized'?'Loading 863,803 triangles with source partial-face occlusion and lossless planar merging.':which==='merged'?'Loading 1.12m source triangles with exact coplanar merging; some interior faces remain unverified.':'This diagnostic loads 1,661,200 unverified candidate triangles; it may be slow.';
 $('raw-btn').setAttribute('aria-pressed',String(which==='raw'));
 $('merged-btn').setAttribute('aria-pressed',String(which==='merged'));
 $('optimized-btn').setAttribute('aria-pressed',String(which==='optimized'));
 $('core-btn').setAttribute('aria-pressed',String(which==='core'));
 try{
  const asset=await download(which);if(id!==requestID)return;
  const next=construct(asset);
  if(id!==requestID){next.geometry.dispose();next.materials.forEach(m=>m.dispose());return}
  disposeOld();current=next;scene.add(next.mesh);
  originalScenery.setNativeGeometry(next.geometry);
  recolor();
  $('metric-tris').textContent=fmt(asset.nt);
  $('metric-verts').textContent=fmt(asset.nv);
  $('metric-slots').textContent=fmt(next.slots.length);
  state.hidden=true;
  note('PASS: '+which+' source mesh checksum, binary size and triangle indices validated. '+fmt(asset.nv)+' vertices / '+fmt(asset.nt)+' triangles. Exact original-renderer parity: NOT VERIFIED. Live collision: UNCHANGED.');
 }catch(e){
  if(id!==requestID)return;
  $('load-title').textContent='Native preview could not load';
  $('load-detail').textContent=e.message+' — Check whether Render has deployed the new assets.';
  note('ERROR: '+(e.stack||e.message));
 }
}
$('mode').addEventListener('change',recolor);
$('wire').addEventListener('change',recolor);
function focusOriginalProps(){
 if(!propFocus){note('Original source model placements have not loaded.');return}
 target.set(...toWorld(propFocus.sourcePosition));
 distance=38;yaw=.75;pitch=.47;updateCamera();
 note('SOURCE PROP CLOSE-UP: moved inspection camera to native mapmodel entity #'+propFocus.id+' inside the densest original prop sector (no source geometry moved).');
}
$('prop-focus-btn').addEventListener('click',focusOriginalProps);
$('spawns').addEventListener('change',()=>{markers.visible=$('spawns').checked});
$('source-anchors').addEventListener('change',()=>{
 originalScenery.setAnchorDebug($('source-anchors').checked);
});
$('restored-btn').addEventListener('click',async()=>{
 const button=$('restored-btn');
 if(button.disabled)return;
 button.disabled=true;button.textContent='Loading source scene…';
 try{
  await activate('optimized');
  if(current?.which!=='optimized')throw Error('Corrected native source geometry did not finish loading');
  $('mode').value='source';recolor();
  const layers=[
   ['source-env','environment'],
   ['source-props','props'],
   ['source-decals','decals']
  ];
  await Promise.all(layers.map(async([control,name])=>{
   $(control).checked=true;
   await originalScenery.switch(name,true);
  }));
  if(propFocus)focusOriginalProps();
  else if(starts.length){
   target.set(...toWorld(starts[0].sourcePosition));
   distance=42;yaw=.72;pitch=.42;updateCamera();
  }
  note('RESTORED SOURCE SCENE: visibility-corrected native terrain, attributed texture images, all recovered original decorative OBJ placements, source decals and Redcliff lighting. Visual parity and original collision remain incomplete.');
 }catch(error){
  note('RESTORE PRESET FAILED: '+(error.message||String(error)));
 }finally{
  button.disabled=false;button.textContent='Show restored scene';
 }
});

for(const [control,layer] of [['source-env','environment'],['source-props','props'],['source-decals','decals']]){
 $(control).addEventListener('change',()=>{void originalScenery.switch(layer,$(control).checked)});
}
$('core-btn').addEventListener('click',()=>{if(active!=='core')activate('core')});
$('optimized-btn').addEventListener('click',()=>{
 if(active==='optimized')return;
 if(!window.confirm('This source visibility candidate still has 864k triangles and is not yet renderer-exact. It may be slow. View the corrected stage?'))return;
 activate('optimized');
});
$('merged-btn').addEventListener('click',()=>{
 if(active==='merged')return;
 if(!window.confirm('The source plane-merged MPZ candidate contains 1.12 million triangles. It is NOT a finished original renderer and may be slow. Display it for inspection?'))return;
 activate('merged');
});
$('raw-btn').addEventListener('click',()=>{
 if(active==='raw')return;
 if(!window.confirm('Raw candidate mode loads 1.66 million unverified triangles and may lag. It is NOT the original finished world. Proceed?'))return;
 activate('raw');
});
async function spawnMarkers(){
 try{
  const source=await json(ROOT+'octavus.native-entities.json');
  if(source.format!=='MAPZ'||source.playerStarts?.length!==33)throw Error('Original MPZ player-start metadata invalid');
  starts=source.playerStarts;
  updateIslandStarts();
  // The most populated model sector is a meaningful camera target for
  // users to visually validate the original authored placements.
  const models=(source.visualEntities||[]).filter(e=>e.type==='mapmodel'&&Array.isArray(e.sourcePosition));
  let most=-1;
  for(const e of models){
   const a=toWorld(e.sourcePosition);
   const count=models.filter(other=>{
    const b=toWorld(other.sourcePosition);
    return (a[0]-b[0])**2+(a[2]-b[2])**2<=35*35;
   }).length;
   if(count>most){most=count;propFocus=e;}
  }
  for(const e of starts){
   const p=toWorld(e.sourcePosition);
   const orb=new THREE.Mesh(markerGeom,markerMat);
   orb.position.set(p[0],p[1]+1.3,p[2]);orb.userData.nativeEntityID=e.id;markers.add(orb);
   const stem=new THREE.Mesh(stemGeom,stemMat);
   stem.position.set(p[0],p[1],p[2]);markers.add(stem);
  }
  $('metric-starts').textContent=fmt(starts.length);
  note('PASS: all 33 authentic native player starts available for inspection.');
 }catch(e){note('Native start markers unavailable: '+e.message)}
}
$('original-mapshot').addEventListener('error',()=>{$('image-fallback').hidden=false});
function frame(now){
 requestAnimationFrame(frame);if(document.hidden){lastFrame=now;return}
 if(now-lastFrame<500)frames++;
 lastFrame=now;
 if(now-fpsBegin>1100){
  $('fps-label').textContent=Math.round(frames*1000/(now-fpsBegin))+' FPS';
  fpsBegin=now;frames=0;
 }
 originalScenery.animate(now/1000,target);
 canvasRenderer.render(scene,camera);
}
requestAnimationFrame(frame);
void activate('core');
void spawnMarkers();
void initializeIslandWall();
