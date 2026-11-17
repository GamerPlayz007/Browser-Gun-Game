
/* CROSSFIRE 6.2: renders the original Dust Corridor world via OUR existing
 * WebGLRenderer/canvas. Upstream provenance: integrations/dust_corridor/LICENSE.
 * Preview ONLY; authoritative collision and multiplayer arrive in 6.3–6.5. */
import * as T from 'three';
import {createDustMinimap64} from './dust_minimap64.js';

const vertex = `
in float aLayer;
in vec3 aTint;
in float aWear;
out vec2 vUv;
out vec3 vPos;
out vec3 vNormal;
out vec3 vTint;
out float vWear;
flat out int vLayer;
void main(){
  vec4 wp=modelMatrix*vec4(position,1.);
  vPos=wp.xyz; vNormal=normalize(mat3(modelMatrix)*normal);
  vUv=uv;vTint=aTint;vWear=aWear;vLayer=int(aLayer+.5);
  gl_Position=projectionMatrix*viewMatrix*wp;
}`;
const fragment = `
precision highp sampler2DArray;
in vec2 vUv;in vec3 vPos;in vec3 vNormal;in vec3 vTint;in float vWear;
flat in int vLayer;
uniform sampler2DArray uAlbedo;
uniform sampler2DArray uNormalTex;
uniform sampler2DArray uOrm;
uniform bool uOriginal;
uniform vec3 uEye;
out vec4 outColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
vec3 fallback(int i){
  if(i==3||i==5||i==18)return vec3(.62,.35,.26);
  if(i==4)return vec3(.37,.52,.58);
  if(i==2||i==9||i==15)return vec3(.37,.35,.32);
  if(i==6||i==7||i==14||i==19)return vec3(.34,.36,.38);
  if(i==8)return vec3(.51,.36,.23);
  if(i==10||i==12)return vec3(.72,.58,.38);
  if(i==11||i==17)return vec3(.57,.48,.37);
  return vec3(.74,.68,.57);
}
void main(){
  vec3 texColor;
  vec3 texNormal=vec3(0.,0.,1.);
  vec3 orm=vec3(1.,.8,0.);
  vec3 uvw=vec3(fract(vUv),float(vLayer));
  if(uOriginal){
    texColor=texture(uAlbedo,uvw).rgb;
    texNormal=texture(uNormalTex,uvw).rgb*2.-1.;
    orm=texture(uOrm,uvw).rgb;
  }else{
    texColor=fallback(vLayer)*(.83+.12*hash(floor(vUv*81.))+.08*hash(floor(vUv*9.)));
  }
  vec3 n=normalize(vNormal);
  if(uOriginal){
    vec3 dx=dFdx(vPos),dy=dFdy(vPos);
    vec2 tx=dFdx(vUv),ty=dFdy(vUv);
    vec3 t=dx*ty.y-dy*tx.y, b=dy*tx.x-dx*ty.x;
    if(dot(t,t)>1e-5&&dot(b,b)>1e-5)
      n=normalize(n+.40*(normalize(t)*texNormal.x+normalize(b)*texNormal.y));
  }
  vec3 sun=normalize(vec3(-.47,.83,.27));
  float diffuse=max(0.,dot(n,sun));
  float ao=mix(.65,1.,orm.r);
  vec3 base=texColor*vTint*(1.-min(.12,vWear*.07));
  vec3 color=base*(vec3(.55,.57,.60)+vec3(1.08,1.01,.90)*diffuse*.95)*ao;
  vec3 h=normalize(sun+normalize(uEye-vPos));
  color+=vec3(1.0,.93,.8)*pow(max(dot(n,h),0.),mix(7.,70.,1.-orm.g))*(.04+.17*orm.b);
  float fog=1.-exp(-length(uEye-vPos)*.006);
  color=mix(color,vec3(.68,.70,.66),fog*.6);
  outColor=vec4(color,1.);
}`;
export function makeDustMaterial65(bake=null){
 return new T.ShaderMaterial({
  glslVersion:T.GLSL3,vertexShader:vertex,fragmentShader:fragment,side:T.DoubleSide,
  uniforms:{
    uAlbedo:{value:bake?.albedo||null},uNormalTex:{value:bake?.normal||null},
    uOrm:{value:bake?.orm||null},uOriginal:{value:!!bake?.albedo},
    uEye:{value:new T.Vector3()}
  }
 });
}
const views={
 Street:[[1,2.9,-54],[0,2.5,-12]],
 Market:[[5,3.25,-4],[0,2.6,16]],
 Plaza:[[-7,4.5,54],[0,3.5,39]]
};
export function createDustCorridorPreview({renderer,getQuality}){
 let active=false,loading=false,world=null,toolbar=null,homeWasHidden=false,shadeDisplay='';
 let walk=null,mode='walk',tickBank=0,modeButton=null,sourceContract=null;
 const keys=new Set();
 const camera=new T.PerspectiveCamera(74,1,.065,400);
 camera.rotation.order='YXZ';
 let yaw=0,pitch=0,dragging=false,lastX=0,lastY=0;
 const selectView=name=>{
  if(active&&mode==='walk'){mode='fly';tickBank=0;updateModeButton();}
  const [pos,look]=views[name];
  camera.position.fromArray(pos);
  const dir=new T.Vector3(...look).sub(camera.position).normalize();
  yaw=Math.atan2(-dir.x,-dir.z);
  pitch=Math.asin(T.MathUtils.clamp(dir.y,-1,1));
  camera.rotation.set(pitch,yaw,0,'YXZ');
 };
 const onDown=e=>{if(active&&e.target===renderer.domElement){
  dragging=true;lastX=e.clientX;lastY=e.clientY;e.preventDefault();
 }};
 const onMove=e=>{if(!active||!dragging)return;
  yaw-=(e.clientX-lastX)*.003;pitch=T.MathUtils.clamp(pitch-(e.clientY-lastY)*.003,-1.45,1.45);
  lastX=e.clientX;lastY=e.clientY;camera.rotation.set(pitch,yaw,0,'YXZ');
 };
 const onKey=e=>{
  if(!active)return;
  if(e.code==='Escape'){e.preventDefault();close();return;}
  if(mode==='walk'&&(e.code==='ControlLeft'||e.code==='ControlRight')){
    e.preventDefault();if(!e.repeat)walk?.toggleCrouch();return;
  }
  if(mode==='walk'&&e.code==='Space'){
    e.preventDefault();if(!e.repeat)walk?.requestJump();return;
  }
  if(/^(Key[WASDQE]|ShiftLeft|ShiftRight|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(e.code)){
    keys.add(e.code);e.preventDefault();
  }
 };
 document.addEventListener('mousedown',onDown);
 document.addEventListener('mousemove',onMove);
 document.addEventListener('mouseup',()=>dragging=false);
 document.addEventListener('keydown',onKey);
 document.addEventListener('keyup',e=>keys.delete(e.code));
 window.addEventListener('blur',()=>{keys.clear();dragging=false;});
 function updateModeButton(){
  if(modeButton)modeButton.textContent=mode==='walk'?'FREE FLY / INSPECT':'WALK / COLLISION ON';
 }
 function warpToSafeSpawn64(side){
  const safe=sourceContract?.validatedSpawns?.[side]?.safeIndices||[];
  if(!walk||!safe.length)return;
  walk.resetSpawn(side,safe[0]);mode='walk';tickBank=0;keys.clear();
  updateModeButton();
 }
 function controls(){
  toolbar=document.createElement('div');toolbar.id='cf-dust62-controls';
  toolbar.style.cssText='position:fixed;z-index:10000;top:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;padding:12px;border:1px solid #dcc9a4;background:#141b1bea;color:#f8f0e2;font:12px system-ui,sans-serif;border-radius:8px;box-shadow:0 8px 32px #0008;';
  const label=document.createElement('strong');
  label.textContent='DUST CORRIDOR · NATIVE RENDER PREVIEW';
  toolbar.append(label);
  modeButton=document.createElement('button');modeButton.type='button';modeButton.id='cf-dust63-mode';
  modeButton.style.cssText='border:1px solid #a9daa6;background:#24362a;color:#c6ffd1;padding:8px;border-radius:5px;font-weight:bold;cursor:pointer;';
  modeButton.onclick=()=>{
    if(!walk)return;
    mode=mode==='walk'?'fly':'walk';
    if(mode==='walk')walk.resetSpawn('A');
    tickBank=0;keys.clear();updateModeButton();
  };
  updateModeButton();toolbar.append(modeButton);
  for(const side of ['A','B']){
   const button=document.createElement('button');button.type='button';
   button.id='cf-dust64-spawn-'+side.toLowerCase();
   button.textContent='SPAWN '+side;
   button.style.cssText='border:1px solid #a9b8b3;background:#1e3536;color:white;padding:8px;border-radius:5px;cursor:pointer;';
   button.onclick=()=>warpToSafeSpawn64(side);
   button.disabled=!(sourceContract?.validatedSpawns?.[side]?.safeIndices||[]).length;
   toolbar.append(button);
  }
  for(const name of Object.keys(views)){
   const button=document.createElement('button');button.type='button';button.textContent=name.toUpperCase();
   button.style.cssText='border:1px solid #8f8c7d;background:#222a29;color:#fff;padding:8px;border-radius:5px;cursor:pointer;';
   button.onclick=()=>selectView(name);toolbar.append(button);
  }
  const back=document.createElement('button');back.type='button';back.id='cf-dust63-back';back.textContent='RETURN TO LOBBY';
  back.style.cssText='border:0;background:#e4c99b;color:#222;padding:8px;border-radius:5px;font-weight:bold;cursor:pointer;';
  back.onclick=close;toolbar.append(back);
  const hint=document.createElement('small');hint.textContent='WASD move · Shift sprint · Space jump · Ctrl crouch · Free fly: Q/E vertical · Drag mouse to look';
  hint.style.cssText='flex-basis:100%;text-align:center;opacity:.8';toolbar.append(hint);
  document.body.append(toolbar);
 }
 async function open(){
  if(active||loading)return;
  loading=true;let bake=null,mat=null,cloth=null,cables=null;
  const geos=[];
  try{
   if(!renderer.capabilities.isWebGL2)throw Error('WebGL2 is required.');
   const [{MapGenerator},{MaterialLibrary},{ClothSystem,CableSystem},{createDustWalk63}]=await Promise.all([
     import('./dust_corridor/src/world/MapGenerator.js'),
     import('./dust_corridor/src/world/MaterialLibrary.js'),
     import('./dust_corridor/src/world/ClothSystem.js'),
     import('./dust_corridor_walk63.js')
   ]);
   const data=new MapGenerator().generate();
   // Server-side contract comes from the SAME CROSSFire deployment.
   // Fail closed on source mismatch rather than silently enabling fake spawns.
   const response=await fetch('/api/dust-corridor/preview64',{cache:'no-store'});
   if(!response.ok)throw Error('Dust Corridor server map contract unavailable');
   const contract=await response.json();
   if(contract.available!==false||contract.multiplayer!==false||
      contract.triangleCount!==data.soup.count||
      contract.collisionFormat!=='DUSTCOL3')
     throw Error('Dust Corridor server and browser collision disagree');
   for(const side of ['A','B']){
    if(!(contract.validatedSpawns?.[side]?.safeIndices||[]).length)
      throw Error('No server-validated Dust Corridor spawn for '+side);
   }
   sourceContract=contract;
   // Original triangles + original BVH/capsule: collision geometry matches visuals.
   walk=createDustWalk63(data);
   const q=getQuality();const size=q==='performance'?96:q==='high'?192:q==='ultra'||q==='native'?256:128;
   if(q!=='performance'){
    try{
     bake=new MaterialLibrary(renderer,size,4);
     await bake.compile();await bake.draw();
    }catch(err){
     console.warn('Dust: original textures unavailable; preserving all source geometry.',err);
     bake?.dispose();bake=null;
    }
   }
   // Low-end mode avoids costly GPU texture-array compilation but retains
   // ALL original building, stall, and prop geometry and authored vertex tints.
   mat=makeDustMaterial65(bake);
   const scene=new T.Scene();scene.background=new T.Color('#b4c6ce');
   const mini=createDustMinimap64({source:data,contract});
   for(const batch of data.batches){
    const geo=batch.build();geos.push(geo);
    const mesh=new T.Mesh(geo,mat);
    mesh.name='Dust original '+batch.name;
    scene.add(mesh);
   }
   cloth=new ClothSystem(data.cloth,mat);
   cables=new CableSystem(data.cables,mat);
   scene.add(cloth.mesh,cables.mesh);
   world={scene,geos,mat,bake,cloth,cables,minimap:mini,
    stats:{triangles:data.triangleCount,batches:data.batches.length,cloth:data.cloth.length,
      cables:data.cables.length,originalMaterialLayers:bake?20:0,
      collisionTriangles:walk.triangles,collisionSystem:'original-triangle-bvh',
      serverValidatedA:contract.validatedSpawns.A.safeIndices.length,
      serverValidatedB:contract.validatedSpawns.B.safeIndices.length,
      serverChecksum:contract.sha256}};
   selectView('Street');mode='walk';tickBank=0;
   walk.resetSpawn('A',contract.validatedSpawns.A.safeIndices[0]);
   const home=document.getElementById('home'),shade=document.getElementById('shade');
   homeWasHidden=home.hidden;shadeDisplay=shade.style.display;
   home.hidden=true;shade.style.display='none';controls();active=true;
   window.__crossfireDustPreview62={
    ready:true,usingMainRenderer:true,stats:world.stats,
    get mode(){return mode;},
    get position(){return walk?.position.toArray()||null;},
    get grounded(){return walk?.grounded??false;},
    get crouched(){return walk?.crouched??false;},
    get steps(){return walk?.steps??0;},
    get sourceMatched(){return sourceContract?.triangleCount===walk?.triangles;},
    get bounds(){return sourceContract?.playBounds||null;}
   };
  }catch(err){
   cloth?.dispose();cables?.dispose();mat?.dispose();bake?.dispose();
   for(const geo of geos)geo.dispose();
   world?.minimap?.dispose();
   walk=null;sourceContract=null;world=null;
   document.getElementById('cf-dust64-map')?.remove();
   throw err;
  }finally{loading=false;}
 }
 function close(){
  if(!active)return;
  active=false;dragging=false;keys.clear();toolbar?.remove();toolbar=null;modeButton=null;tickBank=0;
  document.getElementById('home').hidden=homeWasHidden;
  document.getElementById('shade').style.display=shadeDisplay;
  world.cloth.dispose();world.cables.dispose();
  for(const geo of world.geos)geo.dispose();
  world.mat.dispose();world.bake?.dispose();world.minimap?.dispose();world=null;walk=null;sourceContract=null;
  const status=document.getElementById('status');
  if(status)status.textContent='Dust Corridor collision preview closed. Existing arenas are ready.';
  delete window.__crossfireDustPreview62;
 }
 function render(dt,now){
  if(!active||!world)return;
  const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
  const strafe=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  const rise=Number(keys.has('KeyE'))-Number(keys.has('KeyQ'));
  if(mode==='walk'){
   // Conservative fixed-step collision, even with an uneven browser frame rate.
   tickBank=Math.min(.12,tickBank+Math.min(.12,dt));
   let count=0;
   while(tickBank>=1/60&&count++<7){
    walk.step(1/60,{forward,strafe,yaw,
     sprint:keys.has('ShiftLeft')||keys.has('ShiftRight')});
    tickBank-=1/60;
   }
   const pos=walk.position;
   camera.position.set(pos.x,pos.y+(walk.crouched?.9:1.56),pos.z);
  }else{
   const move=(keys.has('ShiftLeft')||keys.has('ShiftRight')?26:11)*Math.min(dt,.05)/Math.max(1,Math.hypot(forward,strafe,rise));
   camera.position.x+=(-forward*Math.sin(yaw)+strafe*Math.cos(yaw))*move;
   camera.position.z+=(-forward*Math.cos(yaw)-strafe*Math.sin(yaw))*move;
   camera.position.y+=rise*move;
   camera.position.x=T.MathUtils.clamp(camera.position.x,-107,107);
   camera.position.z=T.MathUtils.clamp(camera.position.z,-137,137);
   camera.position.y=T.MathUtils.clamp(camera.position.y,.45,38);
  }
  const size=renderer.getDrawingBufferSize(new T.Vector2());
  camera.aspect=Math.max(.1,size.x/Math.max(1,size.y));camera.updateProjectionMatrix();
  world.minimap?.draw(mode==='walk'?walk.position:camera.position,yaw,now,mode);
  world.mat.uniforms.uEye.value.copy(camera.position);
  world.cloth.update(dt,now);world.cables.update(dt,now);
  renderer.setRenderTarget(null);renderer.clear(true,true,true);renderer.render(world.scene,camera);
 }
 return {get active(){return active;},get loading(){return loading;},open,close,render};
}
