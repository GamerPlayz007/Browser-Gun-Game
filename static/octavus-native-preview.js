/* Octavus Phase 1.3 - independent native MPZ geometry inspector.
 * Original Red Eclipse 2 Octavus map CC BY-SA 3.0, Ricky Thomson.
 * OCN2 staging data is not the active multiplayer map.
 */
import * as THREE from 'three';
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
scene.add(new THREE.HemisphereLight('#f3e7d3','#41556b',1.65));
const sun=new THREE.DirectionalLight('#ffdfb4',2.15);
sun.position.set(-40,95,75);scene.add(sun);
const grid=new THREE.GridHelper(420,42,0x57687a,0x233449);
grid.position.y=-15.2;
grid.material.opacity=.38;grid.material.transparent=true;
scene.add(grid);
const markers=new THREE.Group();markers.name='33 original MPZ player starts';markers.visible=false;scene.add(markers);
const markerGeom=new THREE.SphereGeometry(.7,8,6);
const markerMat=new THREE.MeshBasicMaterial({color:0x8ee1b7});
const stemGeom=new THREE.CylinderGeometry(.12,.12,2,6);
const stemMat=new THREE.MeshBasicMaterial({color:0x64ae97});
const target=new THREE.Vector3(0,2,0);
let yaw=.7,pitch=.55,distance=142,drag=null,current=null,active='core',requestID=0,starts=[];
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
 const base=which==='core'?'octavus.native-core':'octavus.native-stage1';
 const manifestPath=ROOT+base+'.json',binaryPath=ROOT+base+'.bin.gz';
 const [meta,response]=await Promise.all([json(manifestPath),fetch(binaryPath,{cache:'no-cache'})]);
 if(!response.ok)throw Error('Native geometry is unavailable (HTTP '+response.status+')');
 if(typeof DecompressionStream==='undefined')throw Error('A recent Chrome or Edge browser is required for gzip decoding');
 const compressed=await response.arrayBuffer();
 const sha=hex(await crypto.subtle.digest('SHA-256',compressed));
 const expected=which==='core'?meta.sha256:meta.stagingSHA256;
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
 geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const mesh=new THREE.Mesh(geometry,materials);
 mesh.name='Octavus source-native '+which;
 return {mesh,materials,slots,geometry,meta:asset.meta,which};
}
function recolor(){
 if(!current)return;
 const mode=$('mode').value,wire=$('wire').checked;
 current.materials.forEach((m,i)=>{
  const slot=current.slots[i];
  m.wireframe=wire;m.vertexColors=mode==='height';
  m.transparent=false;m.opacity=1;m.depthWrite=true;
  if(mode==='slot'){
   m.color.setHSL((slot*.61803398875)%1,.55,.55);
  }else if(mode==='height'){
   m.color.set('#ffffff');
  }else if(slot===1&&current.which==='raw'){
   m.color.set('#e99caa');m.transparent=true;m.opacity=.27;m.depthWrite=false;
  }else{
   const n=.90+((slot*37)%13)*.014;
   m.color.setRGB(n,n*.92,n*.81);
  }
  m.needsUpdate=true;
 });
 $('view-label').textContent=current.which==='core'?'NATIVE ARCHITECTURE CORE':'HEAVY UNCULLED CANDIDATE';
 $('render-label').textContent=current.which==='core'
  ?fmt(current.slots.length)+' native material slots; plain slot 1 deliberately omitted'
  :'Source slot 1 marked pink; most raw faces are not proven visible';
}
function disposeOld(){
 if(!current)return;
 scene.remove(current.mesh);
 current.geometry.dispose();current.materials.forEach(m=>m.dispose());current=null;
}
async function activate(which){
 const id=++requestID;active=which;
 state.hidden=false;
 $('load-title').textContent=which==='core'?'Loading native Octavus architecture':'Loading raw candidate (heavy)';
 $('load-detail').textContent=which==='core'
  ?'Validating compressed source geometry and rebuilding 98,358 triangles.'
  :'This diagnostic loads 1,661,200 unverified candidate triangles; it may be slow.';
 $('raw-btn').setAttribute('aria-pressed',String(which==='raw'));
 $('core-btn').setAttribute('aria-pressed',String(which==='core'));
 try{
  const asset=await download(which);if(id!==requestID)return;
  const next=construct(asset);
  if(id!==requestID){next.geometry.dispose();next.materials.forEach(m=>m.dispose());return}
  disposeOld();current=next;scene.add(next.mesh);
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
$('spawns').addEventListener('change',()=>{markers.visible=$('spawns').checked});
$('core-btn').addEventListener('click',()=>{if(active!=='core')activate('core')});
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
 canvasRenderer.render(scene,camera);
}
requestAnimationFrame(frame);
void activate('core');
void spawnMarkers();
