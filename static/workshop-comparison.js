/**
 * CROSSFire Workshop / Phase 2 Stage 2.
 * Side-by-side 3D production inspection using a single WebGL renderer,
 * two independent GLB scenes, and one shared camera orbit. No game state.
 */
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WORKSHOP_CATALOG,listPersonalAssets,personalToEntry,getPersonalAsset} from './workshop-library.js';
import {readAssetBytes} from './gallery-assets.js';
import {HERO_GLB_BASE64,PERFORMANCE_GLB_BASE64} from './artist-mesh-v3-data.js';

const $=id=>document.getElementById(id);
const loader=new GLTFLoader();
const shell=$('comparisonBay'),canvas=$('comparisonCanvas');
const orbit={yaw:.6,pitch:.27,distance:4.7,dragging:false,x:0,y:0};
const sides=['A','B'].map(id=>({id,scene:null,camera:null,model:null,mixer:null,clips:[],
  entry:null,profile:null,stats:null,seq:0,controller:null}));
let renderer,initialized=false,open=false,entries=[],last=0,frames=0,seconds=0;
const size=n=>n>=1000000?(n/1000000).toFixed(2)+' MB':(n/1000).toFixed(1)+' KB';
const status=(id,s,error=false)=>{const el=$('comparisonStatus'+id);el.textContent=s;el.classList.toggle('bad',error)};

function makeScene(side){
 const scene=new T.Scene();scene.background=new T.Color(0x12202d);
 scene.add(new T.HemisphereLight(0xeaf9ff,0x213746,2.2));
 const key=new T.DirectionalLight(0xf1faff,3.3);key.position.set(4,8,5);scene.add(key);
 const rim=new T.DirectionalLight(0x83ccdf,1.5);rim.position.set(-4,3,-4);scene.add(rim);
 const floor=new T.Mesh(new T.PlaneGeometry(20,20),
  new T.MeshStandardMaterial({color:0x1a2b37,roughness:.88}));
 floor.rotation.x=-Math.PI/2;floor.position.y=-.045;scene.add(floor);
 const grid=new T.GridHelper(20,20,0x426b79,0x284956);
 grid.material.transparent=true;grid.material.opacity=.4;grid.position.y=-.035;scene.add(grid);
 side.scene=scene;side.camera=new T.PerspectiveCamera(44,1,.05,100);
}
function dispose(side){
 if(side.mixer){side.mixer.stopAllAction();side.mixer.uncacheRoot(side.model)}
 if(!side.model)return;
 const geometries=new Set(),materials=new Set(),textures=new Set();
 side.model.traverse(o=>{if(!o.isMesh)return;
  if(o.geometry)geometries.add(o.geometry);
  for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){
   materials.add(m);
   for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap'])
    if(m[k])textures.add(m[k]);
  }
 });
 side.model.removeFromParent();
 geometries.forEach(x=>x.dispose());textures.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());
 side.model=null;side.mixer=null;side.stats=null;
}
function meshStats(root,bytes,clips,dimensions){
 let meshes=0,triangles=0,vertices=0,uvMeshes=0,bones=0;
 const mats=new Set(),textures=new Set();
 root.traverse(o=>{
  if(o.isBone)bones++;
  if(!o.isMesh)return;meshes++;
  const g=o.geometry;if(g){triangles+=(g.index?.count||g.attributes.position?.count||0)/3;
   vertices+=g.attributes.position?.count||0;if(g.attributes.uv)uvMeshes++}
  for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){
   mats.add(m);
   for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'])
    if(m[k])textures.add(m[k]);
  }
 });
 return{bytes,meshes,triangles:Math.round(triangles),vertices,uvMeshes,bones,
  materials:mats.size,textures:textures.size,animations:clips.map(c=>c.name),
  sourceDimensions:dimensions};
}
function info(){
 const a=sides[0].stats,b=sides[1].stats;
 $('comparisonDelta').textContent=a&&b?
  'B versus A: '+(b.triangles-a.triangles)+' triangles · '+((b.bytes/a.bytes-1)*100).toFixed(1)+
  '% file size · '+(b.textures-a.textures)+' texture slots. Fit is normalized; source dimensions are in JSON.':
  'Choose two versions. Rotation and zoom are synchronized.';
}
function mount(side,gltf,entry,profile,bytes){
 const model=gltf.scene;
 if(!model)throw Error('GLB has no scene');
 const box=new T.Box3().setFromObject(model);
 if(box.isEmpty())throw Error('GLB has no drawable mesh');
 const span=box.getSize(new T.Vector3()),length=Math.max(span.x,span.y,span.z);
 if(!Number.isFinite(length)||length<1e-8)throw Error('Invalid mesh bounds');
 const original=span.toArray().map(x=>Number(x.toFixed(4)));
 model.scale.setScalar(1.85/length);model.updateMatrixWorld(true);
 const aligned=new T.Box3().setFromObject(model),center=aligned.getCenter(new T.Vector3());
 model.position.set(-center.x,-aligned.min.y,-center.z);
 dispose(side);side.scene.add(model);
 side.model=model;side.entry=entry;side.profile=profile;side.clips=gltf.animations||[];
 side.mixer=new T.AnimationMixer(model);
 if(side.clips.length)side.mixer.clipAction(side.clips[0]).reset().play();
 side.stats=meshStats(model,bytes,side.clips,original);
 const s=side.stats;
 $('comparisonStats'+side.id).textContent=s.triangles.toLocaleString()+
  ' triangles · '+s.meshes+' meshes · '+s.materials+' materials · '+s.textures+
  ' textures · '+s.uvMeshes+'/'+s.meshes+' UVs · '+s.bones+' bones · '+
  s.animations.length+' animations · '+size(bytes);
 status(side.id,entry.title+' / '+profile.label+' loaded');info();
}
async function payloadFor(asset,p,signal){
 if(p.type==='embedded'){
  const data=atob(p.id==='HERO'?HERO_GLB_BASE64:PERFORMANCE_GLB_BASE64);
  const raw=new Uint8Array(data.length);for(let i=0;i<data.length;i++)raw[i]=data.charCodeAt(i);
  if(raw.length!==p.bytes)throw Error('Reference checksum/length mismatch');
  return{payload:raw.buffer,bytes:raw.length};
 }
 if(p.type==='local'){
  const saved=await getPersonalAsset(asset.id);
  if(!saved?.blob)throw Error('Personal GLB not found on this browser');
  const payload=await saved.blob.arrayBuffer();return{payload,bytes:payload.byteLength};
 }
 if(p.type==='url'){
  const payload=await readAssetBytes(p.url,{signal,maxBytes:65_000_000});
  if(payload.byteLength!==p.bytes)throw Error('Repository file length changed');
  return{payload,bytes:payload.byteLength};
 }
 if(p.type==='gltf'){
  const response=await fetch(p.url,{signal});if(!response.ok)throw Error('HTTP '+response.status);
  const payload=await response.text(),bytes=new TextEncoder().encode(payload).byteLength;
  if(bytes!==p.bytes)throw Error('Repository glTF length changed');
  return{payload,bytes};
 }
 throw Error('Unsupported model source');
}
async function load(side){
 if(!open)return;
 const entry=entries.find(a=>a.id===$('comparisonAsset'+side.id).value);
 const profile=entry?.profiles.find(p=>p.id===$('comparisonProfile'+side.id).value);
 if(!profile){status(side.id,'Select an available version.',true);return}
 side.controller?.abort();
 const controller=new AbortController();side.controller=controller;
 const seq=++side.seq;status(side.id,'Loading '+entry.title+'...');
 try{
  const {payload,bytes}=await payloadFor(entry,profile,controller.signal);
  if(!open||seq!==side.seq)return;
  const gltf=await loader.parseAsync(payload,'');
  if(!open||seq!==side.seq)return;
  mount(side,gltf,entry,profile,bytes);
 }catch(err){if(seq===side.seq&&err.name!=='AbortError')status(side.id,'Import failed: '+err.message,true)}
 finally{if(seq===side.seq)side.controller=null}
}
function showProfiles(side){
 const entry=entries.find(a=>a.id===$('comparisonAsset'+side.id).value);
 const select=$('comparisonProfile'+side.id);select.replaceChildren();
 for(const p of entry?.profiles||[]){
  const option=document.createElement('option');option.value=p.id;
  option.textContent=p.label+' · '+size(p.bytes);select.append(option);
 }
 if(entry?.profiles.length)load(side);
}
async function populate(){
 let personal=[];
 try{personal=(await listPersonalAssets()).map(personalToEntry)}catch{}
 entries=[...WORKSHOP_CATALOG,...personal].filter(e=>e.profiles.length&&
  e.profiles.some(p=>['embedded','url','gltf','local'].includes(p.type)));
 for(const side of sides){
  const sel=$('comparisonAsset'+side.id),previous=sel.value;sel.replaceChildren();
  for(const e of entries){
   const option=document.createElement('option');option.value=e.id;option.textContent=e.title;
   sel.append(option);
  }
  const desired=new URLSearchParams(location.search).get('asset');
  sel.value=entries.some(e=>e.id===previous)?previous:(entries.some(e=>e.id===desired)?desired:'fox-reference');
  const p=$('comparisonProfile'+side.id);p.replaceChildren();
  const entry=entries.find(e=>e.id===sel.value);
  for(const v of entry?.profiles||[]){
   const o=document.createElement('option');o.value=v.id;o.textContent=v.label+' · '+size(v.bytes);p.append(o);
  }
  if(sel.value==='fox-reference'||sel.value==='l7-native')p.value=side.id==='A'?'HERO':'PERFORMANCE';
 }
}
function resize(){
 if(!renderer)return;
 const w=Math.max(2,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(w,h,false);
 for(const side of sides){side.camera.aspect=(w/2)/h;side.camera.updateProjectionMatrix()}
}
function animate(time){
 if(!open)return;
 const dt=Math.max(0,Math.min(.08,(time-last)/1000));last=time;
 const c=Math.cos(orbit.pitch),pos=[Math.sin(orbit.yaw)*c*orbit.distance,
  .85+Math.sin(orbit.pitch)*orbit.distance,Math.cos(orbit.yaw)*c*orbit.distance];
 const w=canvas.clientWidth,h=canvas.clientHeight,half=Math.floor(w/2);
 renderer.setScissorTest(true);
 for(let i=0;i<2;i++){
  const side=sides[i];side.mixer?.update(dt);
  side.camera.position.set(...pos);side.camera.lookAt(0,.75,0);
  const x=i===0?0:half,width=i===0?half:w-half;
  renderer.setViewport(x,0,width,h);renderer.setScissor(x,0,width,h);
  renderer.render(side.scene,side.camera);
 }
 renderer.setScissorTest(false);
 seconds+=dt;frames++;if(seconds>=1){$('comparisonFps').textContent=Math.round(frames/seconds)+' FPS · split';
  frames=0;seconds=0}
}
function init(){
 renderer=new T.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
 renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 sides.forEach(makeScene);
 for(const side of sides){
  $('comparisonAsset'+side.id).addEventListener('change',()=>showProfiles(side));
  $('comparisonProfile'+side.id).addEventListener('change',()=>load(side));
 }
 $('comparisonClose').addEventListener('click',closeComparison);
 $('comparisonReset').addEventListener('click',()=>{
  orbit.yaw=.6;orbit.pitch=.27;orbit.distance=4.7;
 });
 $('comparisonExport').addEventListener('click',()=>{
  const result={schema:'CROSSFIRE_Asset_Comparison_v1',
   note:'Models are normalized for viewing; source dimensions are preserved in the report.',
   camera:{yaw:orbit.yaw,pitch:orbit.pitch,distance:orbit.distance},
   sides:sides.map(s=>({asset:s.entry?.id||null,version:s.profile?.id||null,stats:s.stats})),
   date:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='CROSSFIRE_Comparison_Report.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 canvas.addEventListener('pointerdown',e=>{
  canvas.setPointerCapture(e.pointerId);orbit.dragging=true;orbit.x=e.clientX;orbit.y=e.clientY;
 });
 canvas.addEventListener('pointermove',e=>{
  if(!orbit.dragging)return;
  orbit.yaw+=(orbit.x-e.clientX)*.007;
  orbit.pitch=T.MathUtils.clamp(orbit.pitch+(e.clientY-orbit.y)*.005,-.7,1.25);
  orbit.x=e.clientX;orbit.y=e.clientY;
 });
 for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>orbit.dragging=false);
 canvas.addEventListener('wheel',e=>{
  e.preventDefault();orbit.distance=T.MathUtils.clamp(orbit.distance+Math.sign(e.deltaY)*.35,2,18);
 },{passive:false});
 window.addEventListener('resize',resize);
 document.addEventListener('keydown',e=>{if(open&&e.key==='Escape')closeComparison()});
 initialized=true;
}
export async function openComparison(){
 if(!initialized)init();
 shell.hidden=false;open=true;last=performance.now();
 await populate();resize();
 renderer.setAnimationLoop(animate);
 await Promise.all(sides.map(load));
}
export function closeComparison(){
 if(!open)return;
 open=false;shell.hidden=true;renderer?.setAnimationLoop(null);
 for(const side of sides){side.seq++;side.controller?.abort();side.controller=null}
}
