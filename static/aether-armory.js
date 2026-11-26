import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readAssetBytes} from './gallery-assets.js';
const $=id=>document.getElementById(id),canvas=$('canvas');
const scene=new T.Scene();scene.background=new T.Color(0x070d17);
const camera=new T.PerspectiveCamera(43,1,.05,100);
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.28;
scene.add(new T.HemisphereLight(0xc7e3ff,0x293451,2.4));
const key=new T.DirectionalLight(0xffffff,4.2);key.position.set(4,6,5);scene.add(key);
const rim=new T.DirectionalLight(0x9c76ff,3.4);rim.position.set(-4,2,-4);scene.add(rim);
const warm=new T.DirectionalLight(0xffbf85,.8);warm.position.set(2,-1,-2);scene.add(warm);
const floor=new T.Mesh(new T.CylinderGeometry(1.4,1.5,.09,64),new T.MeshStandardMaterial({color:0x172439,metalness:.61,roughness:.4}));floor.position.y=-1.08;scene.add(floor);
const halo=new T.Mesh(new T.RingGeometry(1.19,1.22,80),new T.MeshBasicMaterial({color:0x6386d4,transparent:true,opacity:.65,side:T.DoubleSide}));
halo.rotation.x=-Math.PI/2;halo.position.y=-1.02;scene.add(halo);
const stage=new T.Group();scene.add(stage);
const details={
 s9:{head:'AETHER',sub:'S9',description:'A compact violet-lit SMG with an open skeleton stock, layered receiver armor and a short photonic emitter.',color:'#cb87ff'},
 w12:{head:'WARDRUM',sub:'W12',description:'A broad ember-orange shotgun silhouette with twin illuminated front cores, chunky shield armor and a ribbed underbody.',color:'#ff9c6b'},
 l7:{head:'LONGWATCH',sub:'L7',description:'An extended precision-rifle silhouette with a long scope, lime-green light channels and open alloy support arches.',color:'#b7ff88'}
};
const state={weapon:'s9',finish:'midnight',auto:true,wire:false,token:0,controller:null,root:null,yaw:.61,pitch:.22,dist:4.4,dyaw:.61,dpitch:.22,ddist:4.4};
const loader=new GLTFLoader();let dirty=true,prev=performance.now();
function mark(){dirty=true}
function setStatus(t){$('status').textContent=t}
function activeButtons(){for(const b of document.querySelectorAll('[data-weapon]'))b.classList.toggle('active',b.dataset.weapon===state.weapon);for(const b of document.querySelectorAll('[data-finish]'))b.classList.toggle('active',b.dataset.finish===state.finish)}
function stats(root){const m=new Set(),t=new Set();let meshes=0,tris=0;
 root.traverse(o=>{if(!o.isMesh)return;meshes++;tris+=(o.geometry?.index?.count||o.geometry?.attributes.position?.count||0)/3;
 for(const mat of Array.isArray(o.material)?o.material:[o.material])if(mat){m.add(mat.uuid);
  for(const v of Object.values(mat))if(v?.isTexture)t.add(v.uuid);}});
 $('meshes').textContent=meshes.toLocaleString();$('triangles').textContent=Math.round(tris).toLocaleString();$('materials').textContent=m.size.toLocaleString();
 return {meshes,tris,mats:m.size,textures:t.size};}
function dispose(root){if(!root)return;const g=new Set(),m=new Set(),tex=new Set();
 root.traverse(o=>{if(o.geometry)g.add(o.geometry);for(const mat of Array.isArray(o.material)?o.material:[o.material])if(mat){m.add(mat);for(const v of Object.values(mat))if(v?.isTexture)tex.add(v);}});
 root.removeFromParent();g.forEach(x=>x.dispose());m.forEach(x=>x.dispose());tex.forEach(x=>x.dispose());}
function setWire(on){state.wire=on;$('wire').textContent='WIREFRAME: '+(on?'ON':'OFF');
 $('wire').classList.toggle('active',on);
 if(state.root)state.root.traverse(o=>{if(o.isMesh)for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)m.wireframe=on;});mark();}
function fit(root){root.updateMatrixWorld(true);const b=new T.Box3().setFromObject(root);if(b.isEmpty())throw Error('Export contains no visible geometry');
 const size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3());
 const scale=2.50/Math.max(size.x,size.y,size.z);root.scale.setScalar(scale);root.position.copy(center.multiplyScalar(-scale));
 return size;}
async function load(){const token=++state.token;state.controller?.abort();const controller=new AbortController();state.controller=controller;
 $('loading').hidden=false;activeButtons();
 const item=details[state.weapon];document.documentElement.style.setProperty('--a',item.color);
 $('hero').innerHTML=item.head+'<span>'+item.sub+'</span>';$('description').textContent=item.description;
 const url='/static/assets/aether-'+state.weapon+'-'+state.finish+'.glb';
 setStatus('LOADING '+url.toUpperCase());
 try{
  const buffer=await readAssetBytes(url,{signal:controller.signal,maxBytes:65_000_000,onProgress:(a,b)=>{if(token===state.token)setStatus('LOADING '+Math.floor(a/1024)+' KB'+(b?' / '+Math.floor(b/1024)+' KB':'')+'…');}});
  if(token!==state.token)return;
  const gltf=await new Promise((ok,fail)=>loader.parse(buffer,new URL('.',new URL(url,location.href)).href,ok,fail));
  if(token!==state.token){dispose(gltf.scene);return;}
  const root=gltf.scene;fit(root);
  if(state.root)dispose(state.root);
  stage.add(root);state.root=root;
  stats(root);$('bytes').textContent=(buffer.byteLength/1048576).toFixed(2)+' MB';
  setWire(state.wire);setStatus('READY · '+state.weapon.toUpperCase()+' / '+state.finish.toUpperCase()+' / ORBIT TO INSPECT');
 }catch(err){if(!controller.signal.aborted&&token===state.token)setStatus('ART NOT PUBLISHED YET · '+err.message);}
 finally{if(token===state.token)$('loading').hidden=true;mark();}}
document.querySelectorAll('[data-weapon]').forEach(b=>b.onclick=()=>{if(b.dataset.weapon!==state.weapon){state.weapon=b.dataset.weapon;load();}});
document.querySelectorAll('[data-finish]').forEach(b=>b.onclick=()=>{if(b.dataset.finish!==state.finish){state.finish=b.dataset.finish;load();}});
$('spin').onclick=()=>{state.auto=!state.auto;$('spin').classList.toggle('active',state.auto);$('spin').textContent='AUTO ROTATE: '+(state.auto?'ON':'OFF');mark();};
$('wire').onclick=()=>setWire(!state.wire);
$('reset').onclick=()=>{state.dyaw=.61;state.dpitch=.22;state.ddist=4.4;mark();};
const pointers=new Map();let pinch=0;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});state.auto=false;$('spin').classList.remove('active');$('spin').textContent='AUTO ROTATE: OFF';});
canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const p=pointers.get(e.pointerId);const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
 if(pointers.size===1){state.dyaw+=dx*.006;state.dpitch=Math.max(-.5,Math.min(1.25,state.dpitch+dy*.005));}
 else if(pointers.size===2){const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)state.ddist=Math.max(2.5,Math.min(8,state.ddist+(pinch-d)*.009));pinch=d;}mark();});
for(const n of ['pointerup','pointercancel'])canvas.addEventListener(n,e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinch=0;});
canvas.addEventListener('wheel',e=>{e.preventDefault();state.ddist=Math.max(2.5,Math.min(8,state.ddist+e.deltaY*.004));mark();},{passive:false});
canvas.addEventListener('dblclick',()=>{$('reset').click();});
function frame(t){requestAnimationFrame(frame);const dt=Math.min(.05,(t-prev)/1000||.016);prev=t;const w=canvas.clientWidth,h=canvas.clientHeight;if(w&&h&&(canvas.width!==Math.round(w*Math.min(devicePixelRatio,1.6))||canvas.height!==Math.round(h*Math.min(devicePixelRatio,1.6)))){renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();mark();}
 if(state.auto){state.dyaw+=dt*.25;mark();}
 state.yaw+=(state.dyaw-state.yaw)*Math.min(1,dt*9);state.pitch+=(state.dpitch-state.pitch)*Math.min(1,dt*9);state.dist+=(state.ddist-state.dist)*Math.min(1,dt*9);
 if(state.root){stage.rotation.y=state.yaw;}
 camera.position.set(0,Math.sin(state.pitch)*state.dist*.85,Math.cos(state.pitch)*state.dist);camera.lookAt(0,0,0);
 if(dirty||state.auto){renderer.render(scene,camera);dirty=false;}}
requestAnimationFrame(frame);load();