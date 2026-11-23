/**
 * CROSSFire / Blender Phase 1 / Asset Review
 * A reusable, format-native glTF 2.0 / GLB viewer for original game assets.
 * All sample geometry comes from asset files, not runtime shape assembly.
 */
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $=id=>document.getElementById(id);
const status=$('status'),progress=$('progress'),viewport=$('canvas');
const scene=new T.Scene();scene.background=new T.Color('#08111b');
const camera=new T.PerspectiveCamera(44,1,.05,150);
const renderer=new T.WebGLRenderer({canvas:viewport,antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.28;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;
const ambient=new T.HemisphereLight(0xa8daff,0x223341,2.3);scene.add(ambient);
const key=new T.DirectionalLight(0xe5efff,4.1);
key.position.set(4,7,5);key.castShadow=true;
key.shadow.mapSize.set(1024,1024);
key.shadow.camera.left=-6;key.shadow.camera.right=6;
key.shadow.camera.top=6;key.shadow.camera.bottom=-6;
key.shadow.bias=-.00015;scene.add(key);
const rim=new T.DirectionalLight(0x57cfff,3);
rim.position.set(-4,3,-4);scene.add(rim);
const warm=new T.DirectionalLight(0xffaa75,.95);
warm.position.set(3,-1,-3);scene.add(warm);
const stand=new T.Mesh(new T.CylinderGeometry(1.40,1.44,.09,64),
 new T.MeshStandardMaterial({color:0x172635,metalness:.65,roughness:.35}));
stand.position.y=-.085;stand.receiveShadow=true;scene.add(stand);
const halo=new T.Mesh(new T.RingGeometry(1.20,1.22,90),
 new T.MeshBasicMaterial({color:0x4aadd1,transparent:true,opacity:.55,side:T.DoubleSide}));
halo.rotation.x=-Math.PI/2;halo.position.y=-.035;scene.add(halo);
const assetRoot=new T.Group();scene.add(assetRoot);
const gltfLoader=new GLTFLoader();
let active=null,loadedName='',loadingSeq=0;
const orbit={yaw:.74,pitch:.28,dist:4.5,yawTarget:.74,pitchTarget:.28,distTarget:4.5,
 auto:true,interacting:false};
const target=new T.Vector3(0,1.05,0),targetDesired=target.clone();
let dramatic=false,wire=false;
const pointers=new Map();
let lastPinch=0;
const show=(message,error=false)=>{status.textContent=message;status.classList.toggle('error',error)};
function stats(root){
 const stats={mesh:0,triangle:0,vertices:0,materials:new Set(),textures:new Set()};
 root.traverse(o=>{
  if(!o.isMesh)return;
  stats.mesh++;
  const g=o.geometry;stats.vertices+=g.attributes?.position?.count||0;
  stats.triangle+=(g.index?.count||g.attributes?.position?.count||0)/3;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  for(const m of mats){if(!m)continue;stats.materials.add(m.uuid);
   for(const key of ['map','normalMap','metalnessMap','roughnessMap','aoMap','emissiveMap'])
    if(m[key])stats.textures.add(m[key].uuid);
  }
 });
 return {meshes:stats.mesh,triangles:Math.round(stats.triangle),
  vertices:stats.vertices,materials:stats.materials.size,textures:stats.textures.size};
}
function updateStats(s){
 $('meshes').textContent=s.meshes.toLocaleString();
 $('tris').textContent=s.triangles.toLocaleString();
 $('materials').textContent=s.materials.toLocaleString();
 $('textures').textContent=s.textures.toLocaleString();
}
function disposeRoot(root){
 if(!root)return;
 const materials=new Set(),textures=new Set(),geos=new Set();
 root.traverse(o=>{
  if(!o.isMesh)return;
  if(o.geometry)geos.add(o.geometry);
  const mm=Array.isArray(o.material)?o.material:[o.material];
  for(const m of mm){if(!m)continue;materials.add(m);
   for(const prop of ['map','normalMap','metalnessMap','roughnessMap','aoMap','emissiveMap'])
    if(m[prop])textures.add(m[prop]);
  }
 });
 geos.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());
 root.removeFromParent();
}
function fit(root){
 root.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(root);
 if(bounds.isEmpty())throw Error('No visible geometry in this file');
 const size=bounds.getSize(new T.Vector3());
 const longest=Math.max(.0001,size.x,size.y,size.z);
 const scale=2.45/longest;
 if(!Number.isFinite(scale)||scale<=0)throw Error('Invalid model dimensions');
 root.scale.setScalar(scale);
 root.updateMatrixWorld(true);
 const normalized=new T.Box3().setFromObject(root);
 const center=normalized.getCenter(new T.Vector3());
 const low=normalized.min.y;
 root.position.x-=center.x;root.position.z-=center.z;root.position.y-=low;
 root.updateMatrixWorld(true);
 const after=new T.Box3().setFromObject(root);
 const fitted=after.getSize(new T.Vector3());
 targetDesired.set(0,Math.max(.5,fitted.y*.48),0);
 orbit.distTarget=T.MathUtils.clamp(Math.max(3.6,fitted.length()*1.34),3.6,9);
}
function syncWire(){
 if(!active)return;
 active.traverse(o=>{if(!o.isMesh)return;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  mats.forEach(m=>{if(m&&'wireframe' in m)m.wireframe=wire});
 });
}
function mountGltf(gltf,name){
 if(!gltf?.scene)throw Error('No glTF scene');
 const next=gltf.scene;
 next.traverse(o=>{
  if(o.isMesh){o.castShadow=true;o.receiveShadow=true;
   o.frustumCulled=true;}
 });
 fit(next);
 if(active)disposeRoot(active);
 active=next;assetRoot.add(next);
 loadedName=name;wire=false;$('wire').classList.remove('active');
 updateStats(stats(next));
 show('ASSET LOADED · '+name.toUpperCase());
 $('asset-name').textContent=name.replace(/\.[^.]+$/,'');
 $('loading').hidden=true;$('instructions').textContent='DRAG TO ORBIT · SCROLL TO ZOOM · REPLACE VIA GLB IMPORT';
}
async function loadPreset(which='specter'){
 const beacon=which==='beacon';
 const id=++loadingSeq;
 $('loading').hidden=false;
 show('LOADING BLENDER-ASSET GLB…');
 try{
  const gltf=await gltfLoader.loadAsync(beacon?'/static/assets/aether9-specter.glb':'/static/assets/aether9-specter-phase1.glb');
  if(id!==loadingSeq){disposeRoot(gltf.scene);return}
  mountGltf(gltf,beacon?'ORIGINAL SPECTER':'AETHER-9 BLENDER PHASE 1');
 }catch(e){if(id===loadingSeq){$('loading').hidden=true;show('COULD NOT LOAD DEMO ASSET: '+(e?.message||e),true)}}
}
async function importLocal(file){
 if(!file)return;
 if(!/\.(glb|gltf)$/i.test(file.name)){show('CHOOSE A .GLB OR EMBEDDED .GLTF FILE',true);return}
 if(file.size>35_000_000){show('ASSET TOO LARGE FOR THIS PREVIEW (35 MB LIMIT)',true);return}
 const seq=++loadingSeq;
 $('loading').hidden=false;show('DECODING '+file.name+'…');
 try{
  const data=await file.arrayBuffer();
  const result=await new Promise((resolve,reject)=>{
   const input=/\.glb$/i.test(file.name)?data:new TextDecoder().decode(data);
   gltfLoader.parse(input,'',resolve,reject);
  });
  if(seq!==loadingSeq){disposeRoot(result.scene);return}
  mountGltf(result,file.name);
 }catch(e){
  if(seq===loadingSeq){$('loading').hidden=true;show('IMPORT FAILED: '+(e?.message||e),true)}
 }
}
$('file').addEventListener('change',e=>importLocal(e.target.files?.[0]));
$('preset').addEventListener('click',()=>loadPreset('specter'));
$('beacon').addEventListener('click',()=>loadPreset('beacon'));
$('wire').addEventListener('click',()=>{wire=!wire;syncWire();$('wire').classList.toggle('active',wire)});
$('auto').addEventListener('click',()=>{
 orbit.auto=!orbit.auto;$('auto').classList.toggle('active',orbit.auto);
 $('auto').textContent=orbit.auto?'AUTO ROTATE: ON':'AUTO ROTATE: OFF';
});
$('light').addEventListener('click',()=>{
 dramatic=!dramatic;key.intensity=dramatic?2.35:4.1;
 rim.intensity=dramatic?5.2:3;warm.intensity=dramatic?.25:.95;
 renderer.toneMappingExposure=dramatic?1.40:1.28;
 $('light').classList.toggle('active',dramatic);
 $('light').textContent=dramatic?'LIGHT: DRAMATIC':'LIGHT: STUDIO';
});
function reset(){orbit.yawTarget=.74;orbit.pitchTarget=.28;
 orbit.distTarget=4.5;orbit.auto=false;
 $('auto').classList.remove('active');
 $('auto').textContent='AUTO ROTATE: OFF';}
$('reset').addEventListener('click',reset);
function pauseRotation(){orbit.auto=false;$('auto').classList.remove('active');
 $('auto').textContent='AUTO ROTATE: OFF';}
viewport.addEventListener('pointerdown',e=>{
 viewport.setPointerCapture(e.pointerId);
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 pauseRotation();
});
viewport.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId))return;
 const p=pointers.get(e.pointerId),dx=e.clientX-p.x,dy=e.clientY-p.y;
 p.x=e.clientX;p.y=e.clientY;
 if(pointers.size===1){
  orbit.yawTarget-=dx*.007;
  orbit.pitchTarget=T.MathUtils.clamp(orbit.pitchTarget+dy*.005,-.5,1.35);
 }else if(pointers.size===2){
  const ps=[...pointers.values()],dist=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);
  if(lastPinch>0)orbit.distTarget=T.MathUtils.clamp(orbit.distTarget+(lastPinch-dist)*.009,2.3,16);
  lastPinch=dist;
 }
});
for(const e of ['pointerup','pointercancel'])viewport.addEventListener(e,ev=>{
 pointers.delete(ev.pointerId);if(pointers.size<2)lastPinch=0;
});
viewport.addEventListener('wheel',e=>{
 e.preventDefault();pauseRotation();
 orbit.distTarget=T.MathUtils.clamp(orbit.distTarget+Math.sign(e.deltaY)*.32,2.3,16);
},{passive:false});
viewport.addEventListener('dblclick',reset);
const drop=$('dropzone');
for(const e of ['dragenter','dragover'])document.addEventListener(e,ev=>{
 if(ev.dataTransfer?.types.includes('Files')){ev.preventDefault();drop.hidden=false}
});
document.addEventListener('dragleave',ev=>{
 if(ev.relatedTarget===null)drop.hidden=true;
});
document.addEventListener('drop',ev=>{
 ev.preventDefault();drop.hidden=true;importLocal(ev.dataTransfer?.files?.[0]);
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape')drop.hidden=true;
 if(e.key.toLowerCase()==='r')reset();
});
function resize(){
 const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,w<800?1.25:1.65));
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);
resize();
let prev=performance.now();
function frame(time){
 requestAnimationFrame(frame);
 const dt=Math.min(.08,Math.max(0,(time-prev)/1000));prev=time;
 if(document.hidden)return;
 if(orbit.auto)orbit.yawTarget+=dt*.18;
 const smooth=1-Math.exp(-dt*9);
 orbit.yaw+=(orbit.yawTarget-orbit.yaw)*smooth;
 orbit.pitch+=(orbit.pitchTarget-orbit.pitch)*smooth;
 orbit.dist+=(orbit.distTarget-orbit.dist)*smooth;
 target.lerp(targetDesired,smooth);
 const cs=Math.cos(orbit.pitch);
 camera.position.set(target.x+Math.sin(orbit.yaw)*cs*orbit.dist,
  target.y+Math.sin(orbit.pitch)*orbit.dist,
  target.z+Math.cos(orbit.yaw)*cs*orbit.dist);
 camera.lookAt(target);
 renderer.render(scene,camera);
}
requestAnimationFrame(frame);
loadPreset('specter');
