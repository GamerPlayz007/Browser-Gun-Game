/**
 * CROSSFire v5: artist-created glTF inside the ACTUAL Daybreak City rendering code.
 * Never enters the multiplayer game, map registry, physics, or server authority.
 * Artist mesh is loaded from the unchanged v3 bundled GLB, not recreated by JS primitives.
 */
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildWorld} from './world.js';
import {HERO_GLB_BASE64,PERFORMANCE_GLB_BASE64} from './artist-mesh-v3-data.js';

const $=name=>document.getElementById(name);
const sites=[[-5,0,22],[-24,1,13],[25,1,20]]; // existing spawn-safe locations
const scene=new T.Scene();
const renderer=new T.WebGLRenderer({canvas:$('stage'),antialias:false,powerPreference:'high-performance'});
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
renderer.shadowMap.enabled=false;renderer.shadowMap.type=T.PCFSoftShadowMap;
const camera=new T.PerspectiveCamera(66,1,.05,450);
const loader=new GLTFLoader(), center=new T.Vector3(), target=new T.Vector3();
const input={yaw:.72,pitch:.36,dist:6.3,yawTarget:.72,pitchTarget:.36,distTarget:6.3,rotate:true};
let world=null,actor=null,mixer=null,clip=null,sequence=0,map=null,visible=true,wire=false;
let sampleFrames=0,sampleSeconds=0,last=performance.now(),recentFPS=0;
const pointers=new Map();
function status(s,failed=false){$('stats').textContent=s;$('stats').classList.toggle('error',failed)}
function decode(s){const raw=atob(s),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes.buffer}
function fitArtist(root){
 root.rotation.set(0,0,0);root.position.set(0,0,0);root.scale.setScalar(1);root.updateMatrixWorld(true);
 const box=new T.Box3().setFromObject(root);if(box.isEmpty())throw Error('Artist GLB has no geometry');
 const span=box.getSize(new T.Vector3()),longest=Math.max(span.x,span.y,span.z);
 if(!Number.isFinite(longest)||longest<.01)throw Error('Artist GLB dimensions are invalid');
 root.scale.setScalar(1.6/longest);root.updateMatrixWorld(true);
 const scaled=new T.Box3().setFromObject(root);const c=scaled.getCenter(new T.Vector3());
 root.position.set(-c.x,-scaled.min.y,-c.z);
 const [x,y,z]=sites[Number($('site').value)];
 root.position.add(new T.Vector3(x,y,z));
 target.set(x,y+1.05,z);center.copy(target);
}
function release(node){if(!node)return;node.removeFromParent();const geos=new Set(),mats=new Set(),tex=new Set();node.traverse(n=>{if(!n.isMesh)return;if(n.geometry)geos.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material]){if(!m)continue;mats.add(m);for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap'])if(m[k])tex.add(m[k]);}});for(const v of geos)v.dispose();for(const v of tex)v.dispose();for(const v of mats)v.dispose()}
function animation(){if(!mixer)return;mixer.stopAllAction();const selected=$('animation').value;if(selected==='Pause')return;const chosen=clip.find(v=>v.name===selected);if(chosen)mixer.clipAction(chosen).reset().play()}
function wireArtist(){actor?.traverse(n=>{if(n.isMesh){for(const m of Array.isArray(n.material)?n.material:[n.material])if(m)m.wireframe=wire}})}
function reposition(){if(!actor)return;fitArtist(actor);input.yawTarget=.72;input.pitchTarget=.36;input.distTarget=6.3;}
async function loadArtist(mode){
 const serial=++sequence;
 status('Decoding '+mode+' artist GLB…');
 try{
  const buffer=decode(mode==='HERO'?HERO_GLB_BASE64:PERFORMANCE_GLB_BASE64);
  const gltf=await loader.parseAsync(buffer,'');
  if(serial!==sequence){release(gltf.scene);return}
  const next=gltf.scene;
  fitArtist(next);
  if(mixer)mixer.stopAllAction();if(actor)release(actor);
  actor=next;scene.add(actor);actor.visible=visible;
  actor.traverse(n=>{if(n.isMesh){n.castShadow=false;n.receiveShadow=true;}});
  clip=gltf.animations||[];mixer=new T.AnimationMixer(actor);wireArtist();animation();
  let count=0,tri=0;actor.traverse(n=>{if(n.isMesh){count++;tri+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3}});
  status(`${mode} imported successfully\n${count} mesh · ${Math.round(tri)} source triangles · ${clip.length} animations\nRendered in the real Daybreak City scene`);
 }catch(err){if(serial===sequence)status('Artist import failed: '+err.message,true);console.error(err)}
}
function resize(){const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.4));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
window.addEventListener('resize',resize);resize();
$('assetQuality').onchange=ev=>loadArtist(ev.target.value);
$('cityQuality').onchange=ev=>{
 try{world?.setQuality(ev.target.value);renderer.shadowMap.enabled=ev.target.value==='high';renderer.shadowMap.needsUpdate=true;}
 catch(err){status('City quality switch failed: '+err.message,true)}
};
$('animation').onchange=animation;$('site').onchange=reposition;
$('rotate').onclick=()=>{input.rotate=!input.rotate;$('rotate').textContent='Orbit: '+(input.rotate?'ON':'OFF');$('rotate').classList.toggle('on',input.rotate)};
$('wire').onclick=()=>{wire=!wire;wireArtist();$('wire').textContent='Wireframe: '+(wire?'ON':'OFF');$('wire').classList.toggle('on',wire)};
$('hide').onclick=()=>{visible=!visible;if(actor)actor.visible=visible;$('hide').textContent='Asset: '+(visible?'VISIBLE':'HIDDEN');$('hide').classList.toggle('on',!visible)};
$('reset').onclick=()=>{input.yawTarget=.72;input.pitchTarget=.36;input.distTarget=6.3};
$('report').onclick=()=>{
 const report={stage:'Daybreak City / artist asset map preview v5',map:map?.id||null,
  asset:$('assetQuality').value,location:sites[Number($('site').value)],worldQuality:$('cityQuality').value,
  animation:$('animation').value,assetVisible:visible,wireframe:wire,fps:recentFPS,
  renderer:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures},
  note:'Observational demo performance only; not a controlled hardware comparison. No multiplayer modifications.'};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='CROSSFIRE_map_artist_v5_report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
};
const canvas=$('stage');canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});input.rotate=false;$('rotate').textContent='Orbit: OFF';$('rotate').classList.remove('on')};
canvas.onpointermove=e=>{const p=pointers.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
 if(pointers.size===1){input.yawTarget-=dx*.006;input.pitchTarget=T.MathUtils.clamp(input.pitchTarget+dy*.004,-.25,1.28)}};
for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,e=>pointers.delete(e.pointerId));
canvas.addEventListener('wheel',e=>{e.preventDefault();input.distTarget=T.MathUtils.clamp(input.distTarget+Math.sign(e.deltaY)*.75,2.6,28)},{passive:false});
let fatal=false;
async function start(){
 try{
  const res=await fetch('/static/maps/cyberpunk.json');if(!res.ok)throw Error('City map download failed: '+res.status);
  map=await res.json();if(map.id!=='cyberpunk')throw Error('Unexpected city map file');
  const marker=sites[0],found=map.spawns?.some(p=>p.every((v,i)=>Math.abs(v-marker[i])<.001));
  if(!found)throw Error('City staging site is not a validated map spawn');
  world=buildWorld(scene,map,{renderer,quality:'performance'});
  await loadArtist('PERFORMANCE');
 }catch(err){fatal=true;status('Map preview could not start: '+err.message,true);console.error(err)}
}
function frame(now){requestAnimationFrame(frame);
 const dt=Math.max(0,Math.min(.06,(now-last)*.001));last=now;if(document.hidden||fatal)return;
 if(input.rotate)input.yawTarget+=dt*.13;
 const k=1-Math.exp(-dt*7);
 input.yaw+=k*(input.yawTarget-input.yaw);input.pitch+=k*(input.pitchTarget-input.pitch);input.dist+=k*(input.distTarget-input.dist);
 center.lerp(target,k);
 const cy=Math.cos(input.pitch);camera.position.set(center.x+Math.sin(input.yaw)*cy*input.dist,center.y+Math.sin(input.pitch)*input.dist,center.z+Math.cos(input.yaw)*cy*input.dist);
 camera.lookAt(center);
 mixer?.update(dt);world?.animate(now*.001);
 renderer.info.reset();renderer.render(scene,camera);
 if((sampleSeconds+=dt)>=1){recentFPS=Math.round(sampleFrames/sampleSeconds);$('fps').textContent=recentFPS;$('calls').textContent=renderer.info.render.calls.toLocaleString();$('triangles').textContent=Math.round(renderer.info.render.triangles).toLocaleString();sampleFrames=0;sampleSeconds=0}else sampleFrames++;
}
requestAnimationFrame(frame);start();