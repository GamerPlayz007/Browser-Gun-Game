/**
 * CROSSFire Artist Mesh Lab v3 (isolated from multiplayer)
 * Renders actual imported artist-created GLB bytes. Never generates replacement
 * mesh geometry for the displayed model. Cosmetic laboratory only.
 */
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {HERO_GLB_BASE64, PERFORMANCE_GLB_BASE64} from './artist-mesh-v3-data.js';

const $ = id => document.getElementById(id);
const canvas=$('stage');
const scene=new T.Scene();scene.background=new T.Color(0x101824);
const camera=new T.PerspectiveCamera(42,1,.005,500);
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=false;
renderer.shadowMap.type=T.PCFSoftShadowMap;

const ambient=new T.HemisphereLight(0xf5fbff,0x233446,2.5);scene.add(ambient);
for(const [pos,strength,color] of [
  [[3,6,5],3.4,0xffffff], [[-4,2,2],1.8,0xa7c9ff], [[2,3,-5],2.8,0xffd1a4]
]){
 const light=new T.DirectionalLight(color,strength);light.position.set(...pos);
 light.castShadow=pos[0]===3;light.shadow.mapSize.set(1024,1024);
 light.shadow.camera.left=-6;light.shadow.camera.right=6;
 light.shadow.camera.top=6;light.shadow.camera.bottom=-6;
 scene.add(light);
}
const floor=new T.Mesh(new T.PlaneGeometry(80,80),
 new T.MeshStandardMaterial({color:0x162536,roughness:.83,metalness:.07}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.011;floor.receiveShadow=true;scene.add(floor);
const grid=new T.GridHelper(20,20,0x324b59,0x253a48);
grid.position.y=.0004;grid.material.transparent=true;grid.material.opacity=.24;scene.add(grid);
const loader=new GLTFLoader();
const stage=new T.Group();scene.add(stage);
const variants={
 HERO:{name:'HERO',b64:HERO_GLB_BASE64,bytes:162928,texture:1024},
 PERFORMANCE:{name:'PERFORMANCE',b64:PERFORMANCE_GLB_BASE64,bytes:150248,texture:256}
};
let object=null,mixer=null,action=null,clips=[],wire=false,turntable=true,shadow=false;
let currentMode='HERO',currentBytes=variants.HERO.bytes,currentStats=null;
let pendingLoad=0,last=performance.now(),frameCounter=0,frameTime=0,fpsAverage=0;
const orbit={yaw:.6,pitch:.32,dist:4.3,yawTarget:.6,pitchTarget:.32,distTarget:4.3},
      center=new T.Vector3(0,1,0),desiredCenter=new T.Vector3(0,1,0);
const pointers=new Map();let pinchPrev=0;

function status(message,error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error)}
function uint8(b64){const binary=atob(b64);const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
function shapeStats(root){
 const mats=new Set(),textures=new Set(),geometry=new Set();let meshes=0,triangles=0,vertices=0;
 root.traverse(node=>{if(!node.isMesh)return;meshes++;
  const g=node.geometry; if(g){geometry.add(g);vertices+=g.attributes.position?.count||0;
   const primitive=(g.index?.count||g.attributes.position?.count||0)/3;
   triangles+=primitive*(node.isInstancedMesh?node.count:1);
  }
  for(const mat of Array.isArray(node.material)?node.material:[node.material]){
   if(!mat)continue;mats.add(mat);
   for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap'])
    if(mat[key])textures.add(mat[key]);
  }
 });
 return {meshes,triangles:Math.round(triangles),vertices,materials:mats.size,textures:textures.size,
  geometries:geometry.size};
}
function updateModelStats(data){
 $('meshCount').textContent=data.meshes.toLocaleString();
 $('triCount').textContent=data.triangles.toLocaleString();
 $('clipCount').textContent=clips.length.toLocaleString();
 $('texCount').textContent=data.textures.toLocaleString();
}
function disposeModel(node){
 if(!node)return;
 const gs=new Set(),ms=new Set(),ts=new Set();
 node.traverse(o=>{if(!o.isMesh)return;if(o.geometry)gs.add(o.geometry);
  for(const m of Array.isArray(o.material)?o.material:[o.material]){
   if(!m)continue;ms.add(m);
   for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap'])
    if(m[key])ts.add(m[key]);
  }
 });
 stage.remove(node);
 gs.forEach(g=>g.dispose());ts.forEach(t=>t.dispose());ms.forEach(m=>m.dispose());
}
function fit(node){
 node.position.set(0,0,0);node.rotation.set(0,0,0);node.scale.setScalar(1);
 node.updateMatrixWorld(true);
 const a=new T.Box3().setFromObject(node);
 if(a.isEmpty())throw Error('No displayable meshes in GLB');
 const size=a.getSize(new T.Vector3());
 if(!Number.isFinite(size.length())||size.length()<=1e-8)throw Error('Model dimensions are invalid');
 const k=2.35/Math.max(size.x,size.y,size.z);
 node.scale.setScalar(k);node.updateMatrixWorld(true);
 const b=new T.Box3().setFromObject(node);
 const mid=b.getCenter(new T.Vector3());
 node.position.set(-mid.x,-b.min.y,-mid.z);node.updateMatrixWorld(true);
 const c=new T.Box3().setFromObject(node),d=c.getSize(new T.Vector3());
 desiredCenter.set(0,Math.max(.3,d.y*.48),0);
 orbit.distTarget=T.MathUtils.clamp(Math.max(3.5,d.length()*1.25),3.5,12);
 orbit.yawTarget=.65;orbit.pitchTarget=.26;
}
function playClip(){
 if(!mixer)return;
 if(action){action.stop();action=null}
 const name=$('clip').value;
 if(name==='Pause')return;
 const clip=clips.find(a=>a.name===name);
 if(clip){action=mixer.clipAction(clip);action.reset().play()}
}
function setOptions(){
 const wanted=$('clip').value;
 const select=$('clip');select.replaceChildren();
 for(const clip of clips){const opt=document.createElement('option');opt.value=clip.name;opt.textContent=clip.name;select.appendChild(opt)}
 const pause=document.createElement('option');pause.value='Pause';pause.textContent='Pause';select.appendChild(pause);
 select.value=clips.some(c=>c.name===wanted)?wanted:(clips[0]?.name||'Pause');
 playClip();
}
function setWire(){if(!object)return;object.traverse(o=>{if(!o.isMesh)return;
 for(const m of Array.isArray(o.material)?o.material:[o.material])if(m&&'wireframe' in m)m.wireframe=wire;});}
function setComparison(mode){
 if(mode==='CUSTOM'){
  $('comparison').textContent='Custom GLB loaded. The model remains local to this browser; nothing is uploaded to the server.';
  return;
 }
 const h=variants.HERO,p=variants.PERFORMANCE;
 const saving=(100*(h.bytes-p.bytes)/h.bytes).toFixed(1);
 $('comparison').textContent=`Hero: ${(h.bytes/1024).toFixed(1)} KB, ${h.texture}px texture. Performance: ${(p.bytes/1024).toFixed(1)} KB, ${p.texture}px texture. Saved ${saving}% on disk. Geometry and all three animation clips are unchanged. GPU performance must be measured separately.`;
}
function mount(gltf,label,mode,byteCount){
 const next=gltf.scene;
 if(!next)throw Error('glTF file contains no scene');
 next.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true}});
 fit(next);
 if(mixer)mixer.stopAllAction();mixer=null;action=null;
 if(object)disposeModel(object);
 object=next;stage.add(object);
 clips=gltf.animations||[];
 mixer=new T.AnimationMixer(object);
 setOptions();setWire();
 currentStats=shapeStats(object);currentMode=mode;currentBytes=byteCount;
 updateModelStats(currentStats);setComparison(mode);
 $('assetLabel').textContent=label;
 $('quality').disabled=mode==='CUSTOM';
 status('LOADED: '+label+'\n'+currentStats.meshes+' mesh · '+currentStats.triangles+' triangles · '+clips.length+' clips');
}
async function loadPreset(mode){
 const serial=++pendingLoad;status('DECODING '+mode+' ARTIST-ORIGINAL GLB…');
 try{
  const bytes=uint8(variants[mode].b64);
  const gltf=await loader.parseAsync(bytes.buffer,'');
  if(serial!==pendingLoad){disposeModel(gltf.scene);return}
  mount(gltf,`FOX · ${mode} · ARTIST ORIGINAL`,mode,bytes.byteLength);
 }catch(e){if(serial===pendingLoad)status('MODEL FAILED TO LOAD: '+e.message,true);console.error(e)}
}
async function loadFile(file){
 if(!file)return;
 if(!/\.glb$/i.test(file.name)){status('Only standalone .GLB files are supported.',true);return}
 if(file.size>30_000_000){status('File exceeds the 30 MB browser safety limit.',true);return}
 const serial=++pendingLoad;status('IMPORTING '+file.name+'…');
 try{
  const bytes=await file.arrayBuffer();
  const gltf=await loader.parseAsync(bytes,'');
  if(serial!==pendingLoad){disposeModel(gltf.scene);return}
  mount(gltf,file.name,'CUSTOM',bytes.byteLength);
 }catch(e){if(serial===pendingLoad)status('IMPORT FAILED: '+e.message,true);console.error(e)}
}
function setQuality(mode){$('quality').value=mode;$('quality').disabled=false;return loadPreset(mode)}
$('quality').onchange=e=>setQuality(e.target.value);
$('clip').onchange=playClip;
$('renderScale').onchange=resize;
$('wire').onclick=()=>{wire=!wire;setWire();$('wire').textContent='Wireframe: '+(wire?'ON':'OFF');$('wire').classList.toggle('on',wire)};
$('rotate').onclick=()=>{turntable=!turntable;$('rotate').textContent='Turntable: '+(turntable?'ON':'OFF');$('rotate').classList.toggle('on',turntable)};
$('shadows').onclick=()=>{shadow=!shadow;renderer.shadowMap.enabled=shadow;renderer.shadowMap.needsUpdate=true;
 $('shadows').textContent='Shadows: '+(shadow?'ON':'OFF');$('shadows').classList.toggle('on',shadow)};
$('reset').onclick=()=>{orbit.yawTarget=.65;orbit.pitchTarget=.26;orbit.distTarget=4.3};
$('restore').onclick=()=>setQuality('HERO');
$('file').onchange=e=>loadFile(e.target.files?.[0]);
$('downloadReport').onclick=()=>{
 if(!currentStats)return;
 const result={asset:$('assetLabel').textContent,profile:currentMode,byteCount:currentBytes,
  ...currentStats,clips:clips.map(clip=>clip.name),render:{fps:fpsAverage,
   calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
   rendererPixelRatio:renderer.getPixelRatio(),shadows:shadow},
  sampleProvenance:'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox',
  note:'Runtime observation; does not modify gameplay or save model.'};
 const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});
 const link=document.createElement('a');link.href=URL.createObjectURL(blob);
 link.download='CROSSFIRE_artist_mesh_runtime_report.json';link.click();
 setTimeout(()=>URL.revokeObjectURL(link.href),1000);
};
canvas.addEventListener('pointerdown',ev=>{canvas.setPointerCapture(ev.pointerId);pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
 turntable=false;$('rotate').classList.remove('on');$('rotate').textContent='Turntable: OFF'});
canvas.addEventListener('pointermove',ev=>{if(!pointers.has(ev.pointerId))return;
 const p=pointers.get(ev.pointerId),dx=ev.clientX-p.x,dy=ev.clientY-p.y;p.x=ev.clientX;p.y=ev.clientY;
 if(pointers.size===1){orbit.yawTarget-=dx*.006;orbit.pitchTarget=T.MathUtils.clamp(orbit.pitchTarget+dy*.005,-1,1.35)}
 else if(pointers.size===2){const a=[...pointers.values()];const n=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
  if(pinchPrev)orbit.distTarget=T.MathUtils.clamp(orbit.distTarget+(pinchPrev-n)*.014,1.5,30);pinchPrev=n;}
});
for(const name of ['pointerup','pointercancel'])canvas.addEventListener(name,ev=>{pointers.delete(ev.pointerId);if(pointers.size<2)pinchPrev=0});
canvas.addEventListener('wheel',ev=>{ev.preventDefault();orbit.distTarget=T.MathUtils.clamp(orbit.distTarget+Math.sign(ev.deltaY)*.31,1.5,30)},{passive:false});
const overlay=$('overlay');
for(const kind of ['dragenter','dragover'])window.addEventListener(kind,ev=>{if(ev.dataTransfer?.types.includes('Files')){ev.preventDefault();overlay.classList.add('visible')}});
window.addEventListener('dragleave',ev=>{if(ev.relatedTarget===null)overlay.classList.remove('visible')});
window.addEventListener('drop',ev=>{ev.preventDefault();overlay.classList.remove('visible');loadFile(ev.dataTransfer?.files?.[0])});
function resize(){const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);
 renderer.setPixelRatio(Math.min(Number($('renderScale').value),2));
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();
function frame(t){requestAnimationFrame(frame);
 const dt=Math.min(.08,Math.max(0,(t-last)/1000));last=t;
 if(document.hidden)return;
 if(turntable&&object)object.rotation.y+=dt*.22;
 if(mixer)mixer.update(dt);
 const smooth=1-Math.exp(-dt*8);
 orbit.yaw+=(orbit.yawTarget-orbit.yaw)*smooth;
 orbit.pitch+=(orbit.pitchTarget-orbit.pitch)*smooth;
 orbit.dist+=(orbit.distTarget-orbit.dist)*smooth;
 center.lerp(desiredCenter,smooth);
 const c=Math.cos(orbit.pitch);
 camera.position.set(center.x+Math.sin(orbit.yaw)*c*orbit.dist,
  center.y+Math.sin(orbit.pitch)*orbit.dist,center.z+Math.cos(orbit.yaw)*c*orbit.dist);
 camera.lookAt(center);
 renderer.render(scene,camera);
 frameCounter++;frameTime+=dt;
 if(frameTime>=1){fpsAverage=Math.round(frameCounter/frameTime);
  $('fps').textContent=String(fpsAverage);
  $('draws').textContent=String(renderer.info.render.calls);
  $('renderTris').textContent=renderer.info.render.triangles.toLocaleString();
  frameTime=0;frameCounter=0;
 }
}
requestAnimationFrame(frame);
loadPreset('HERO');