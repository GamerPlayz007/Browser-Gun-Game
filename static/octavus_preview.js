/* Octavus world inspection — local Red Eclipse 2 geometry in CROSSFire.
 * CC BY-SA 3.0 map provenance: static/maps/OCTAVUS_ATTRIBUTION.md
 * This is an in-page 3D geometry walkthrough, not yet a multiplayer arena.
 * Engine code, navigation, shaders and replacement textures are CROSSFire code.
 */
import * as THREE from 'three';

const PARTS=8, SCALE=120/8192;
let cached=null;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const chunkName=i=>'/static/maps/octavus_'+String(i+1).padStart(2,'0')+'.b64';
async function readPacked(){
 if(cached)return cached;
 cached=(async()=>{
  const responses=await Promise.all(Array.from({length:PARTS},(_,i)=>fetch(chunkName(i))));
  if(responses.some(r=>!r.ok))throw Error('Octavus map files are missing from this deployment.');
  const encoded=(await Promise.all(responses.map(r=>r.text()))).join('').replace(/\s+/g,'');
  const raw=atob(encoded);
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const view=new DataView(bytes.buffer);
  if(bytes[0]!==79||bytes[1]!==67||bytes[2]!==84||bytes[3]!==49)throw Error('Octavus data format mismatch.');
  const vertices=view.getUint32(4,true),triangles=view.getUint32(8,true);
  if(vertices!==52061||triangles!==86500||bytes.length!==12+vertices*6+triangles*7)
   throw Error('Octavus asset checksum/size validation failed.');
  const points=new Float32Array(vertices*3);
  let offset=12;
  for(let i=0;i<points.length;i++){points[i]=view.getInt16(offset,true)*SCALE;offset+=2;}
  const groups=new Map();
  for(let i=0;i<triangles;i++){
   const a=view.getUint16(offset,true),b=view.getUint16(offset+2,true);
   const c=view.getUint16(offset+4,true),slot=bytes[offset+6];
   offset+=7;
   if(a>=vertices||b>=vertices||c>=vertices)throw Error('Invalid Octavus mesh index.');
   if(!groups.has(slot))groups.set(slot,[]);
   groups.get(slot).push(a,b,c);
  }
  return {points,groups,triangles,vertices};
 })().catch(error=>{cached=null;throw error;});
 return cached;
}
async function materialTypes(){
 const response=await fetch('/static/maps/octavus.mtl');
 if(!response.ok)return new Map();
 const text=await response.text(),map=new Map();
 const parts=text.split(/newmtl slot/);
 for(const part of parts.slice(1)){
  const match=part.match(/^(\d+)/),path=part.match(/map_Kd\s+([^\r\n]+)/);
  if(match)map.set(+match[1],path?path[1].toLowerCase():'');
 }
 return map;
}
function surfaceKind(path,slot){
 if(/grass|leaves|dirt|ground|sand|mud|rock|cliff|earth/.test(path))return 'terrain';
 if(/light|lamp|screen|window|glow|emiss/.test(path))return 'lit';
 if(/metal|trim|steel|plate|rust|pipe|vent|grate/.test(path))return 'metal';
 if(/tile|brick|floor|pave/.test(path))return 'tile';
 if(/wood|plank/.test(path))return 'wood';
 return slot%11===0?'terrain':'concrete';
}
const PALETTES={
 concrete:[163,158,145],terrain:[138,121,95],metal:[107,121,127],
 tile:[178,165,136],wood:[130,97,69],lit:[206,208,185]
};
function texture(type){
 const c=document.createElement('canvas');c.width=c.height=128;
 const ctx=c.getContext('2d'),img=ctx.createImageData(128,128),base=PALETTES[type];
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const i=(y*128+x)*4;
  const hash=((x*61+y*101+(x*y)%577)%173)/173;
  let grain=(hash-.5)*36;
  const seam=type==='tile'?(x%32<=1||y%32<=1):
   type==='concrete'?(x%64===0||y%48===0):
   type==='wood'?(y%16===0):
   type==='metal'?(x%32===0||y%40===0):false;
  if(seam)grain-=45;
  if(type==='metal'&&(x%32===3||y%40===3))grain+=18;
  if(type==='terrain')grain+=(Math.sin(x*.17+y*.12)+Math.cos(y*.21-x*.09))*12;
  for(let k=0;k<3;k++)img.data[i+k]=clamp(base[k]+grain,0,255);
  img.data[i+3]=255;
 }
 ctx.putImageData(img,0,0);
 const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=2;return tex;
}
function createScene(packed,types){
 const scene=new THREE.Scene();
 scene.background=new THREE.Color('#cdd7d7');
 scene.fog=new THREE.Fog('#cdd7d7',100,250);
 scene.add(new THREE.HemisphereLight('#f7f2e9','#5d6465',2.0));
 const sun=new THREE.DirectionalLight('#fff4df',2.6);sun.position.set(-45,100,25);scene.add(sun);
 const ground=new THREE.Group();ground.name='Octavus source geometry';scene.add(ground);
 const textures=new Map();
 for(const kind of Object.keys(PALETTES))textures.set(kind,texture(kind));
 let meshCount=0;
 for(const [slot,indices] of packed.groups){
  const path=types.get(slot)||'',kind=surfaceKind(path,slot);
  const positions=new Float32Array(indices.length*3),uvs=new Float32Array(indices.length*2);
  const all=packed.points;
  for(let i=0;i<indices.length;i+=3){
   const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
   const abx=all[b]-all[a],aby=all[b+1]-all[a+1],abz=all[b+2]-all[a+2];
   const acx=all[c]-all[a],acy=all[c+1]-all[a+1],acz=all[c+2]-all[a+2];
   const nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx;
   const axis=Math.abs(ny)>=Math.abs(nx)&&Math.abs(ny)>=Math.abs(nz)?'y':
    Math.abs(nx)>=Math.abs(nz)?'x':'z';
   for(let t=0;t<3;t++){
    const src=indices[i+t]*3,dst=(i+t)*3,uv=(i+t)*2;
    const x=all[src],y=all[src+1],z=all[src+2];
    positions[dst]=x;positions[dst+1]=y;positions[dst+2]=z;
    if(axis==='y'){uvs[uv]=x/5;uvs[uv+1]=z/5;}
    else if(axis==='x'){uvs[uv]=z/5;uvs[uv+1]=y/5;}
    else{uvs[uv]=x/5;uvs[uv+1]=y/5;}
   }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  geo.computeVertexNormals();geo.computeBoundingSphere();
  const variation=.91+(slot%13)*.012;
  const mat=new THREE.MeshLambertMaterial({
   map:textures.get(kind),color:new THREE.Color(variation,variation,variation),
   side:THREE.DoubleSide
  });
  const mesh=new THREE.Mesh(geo,mat);mesh.name='Octavus material slot '+slot;
  ground.add(mesh);meshCount++;
 }
 return {scene,meshCount,textures,dispose(){
  ground.traverse(obj=>{if(obj.isMesh){obj.geometry.dispose();obj.material.dispose();}});
  for(const tex of textures.values())tex.dispose();
 }};
}
export function createOctavusPreview(){
 let active=false,loading=false,closeCurrent=null;
 return {
  get active(){return active;},
  get loading(){return loading;},
  async open(){
   if(active||loading)return;
   loading=true;
   const shell=document.createElement('section');shell.id='octavus-preview';
   shell.style.cssText='position:fixed;inset:0;z-index:20000;background:#101a22;color:#f1f8fa;font:13px system-ui,sans-serif;';
   const banner=document.createElement('div');
   banner.style.cssText='position:absolute;left:16px;top:16px;right:16px;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap;padding:12px 16px;background:#101923e8;border:1px solid #d6d9cc55;border-radius:9px;';
   const label=document.createElement('div');
   label.innerHTML='<strong>RED ECLIPSE 2 · OCTAVUS</strong><div style="font-size:11px;margin-top:5px;color:#d1dbdc">Original 86,500-triangle terrain and architecture · Replacement procedural materials · W/A/S/D move · drag to look · Space up · C down · Shift faster</div>';
   const exit=document.createElement('button');exit.type='button';exit.textContent='RETURN TO CROSSFire';
   exit.style.cssText='background:#e8c18c;color:#111e24;border:0;border-radius:5px;padding:11px 13px;font-weight:800;cursor:pointer;';
   banner.append(label,exit);shell.append(banner);
   const status=document.createElement('div');
   status.textContent='Importing original Octavus architecture into the CROSSFire renderer…';
   status.style.cssText='position:absolute;inset:0;display:grid;place-items:center;font-size:16px;text-align:center;padding:24px;';
   shell.append(status);
   const caption=document.createElement('div');
   caption.textContent='SOURCE GEOMETRY WALKTHROUGH · NO MULTIPLAYER COLLISION YET · ATTRIBUTION: OCTAVUS_ATTRIBUTION.md';
   caption.style.cssText='position:absolute;z-index:2;left:16px;bottom:13px;background:#101923b9;border-radius:5px;padding:9px 12px;font-size:10px;letter-spacing:.5px;';
   shell.append(caption);document.body.append(shell);
   let renderer=null,geometry=null,raf=0;
   const keys=new Set(),onResize=()=>{},onMove=e=>{},onDown=e=>{},onUp=()=>{},onKey=e=>{},onKeyUp=e=>{},onBlur=()=>{};
   function close(){
    if(!active&&!loading)return;
    loading=false;active=false;cancelAnimationFrame(raf);
    window.removeEventListener('keydown',handleKeyDown);
    window.removeEventListener('keyup',handleKeyUp);
    window.removeEventListener('blur',clearKeys);
    window.removeEventListener('resize',resize);
    window.removeEventListener('pointermove',move);
    window.removeEventListener('pointerup',up);
    shell.remove();geometry?.dispose();renderer?.dispose();closeCurrent=null;
   }
   let handleKeyDown=()=>{},handleKeyUp=()=>{},clearKeys=()=>{},resize=()=>{},move=()=>{},up=()=>{};
   closeCurrent=close;exit.onclick=close;
   try{
    const [packed,types]=await Promise.all([readPacked(),materialTypes()]);
    if(!shell.isConnected)return;
    geometry=createScene(packed,types);
    const camera=new THREE.PerspectiveCamera(78,innerWidth/innerHeight,.1,350);
    camera.rotation.order='YXZ';camera.position.set(94,51,94);
    camera.lookAt(0,15,0);let yaw=camera.rotation.y,pitch=camera.rotation.x;
    renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.0));
    renderer.setSize(innerWidth,innerHeight);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.2;
    shell.insertBefore(renderer.domElement,banner);status.remove();
    renderer.domElement.style.cssText='width:100%;height:100%;display:block;cursor:grab;';
    let dragging=false,lastX=0,lastY=0,lastTime=performance.now();
    handleKeyDown=e=>{
     if(e.code==='Escape'){e.preventDefault();close();return;}
     if(['KeyW','KeyA','KeyS','KeyD','KeyC','Space','ShiftLeft','ShiftRight'].includes(e.code)){
      keys.add(e.code);e.preventDefault();
     }
    };
    handleKeyUp=e=>keys.delete(e.code);
    clearKeys=()=>{keys.clear();dragging=false;};
    resize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);};
    renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.style.cursor='grabbing';});
    up=()=>{dragging=false;if(renderer)renderer.domElement.style.cursor='grab';};
    move=e=>{
     if(!dragging)return;
     yaw-=(e.clientX-lastX)*.0035;
     pitch=clamp(pitch-(e.clientY-lastY)*.0035,-1.5,1.5);
     lastX=e.clientX;lastY=e.clientY;
    };
    window.addEventListener('keydown',handleKeyDown);
    window.addEventListener('keyup',handleKeyUp);
    window.addEventListener('blur',clearKeys);
    window.addEventListener('resize',resize);
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
    function frame(now){
     if(!active)return;
     const dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;
     const stride=(keys.has('ShiftLeft')||keys.has('ShiftRight')?34:14)*dt;
     camera.rotation.set(pitch,yaw,0,'YXZ');
     const front=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
     const right=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
     const lift=Number(keys.has('Space'))-Number(keys.has('KeyC'));
     const length=Math.max(1,Math.hypot(front,right,lift));
     camera.position.x+=(-Math.sin(yaw)*front+Math.cos(yaw)*right)*stride/length;
     camera.position.z+=(-Math.cos(yaw)*front-Math.sin(yaw)*right)*stride/length;
     camera.position.y+=lift*stride/length;
     camera.position.y=clamp(camera.position.y,1.5,95);
     renderer.render(geometry.scene,camera);raf=requestAnimationFrame(frame);
    }
    active=true;loading=false;raf=requestAnimationFrame(frame);
   }catch(error){status.textContent='Octavus preview could not initialize: '+(error?.message||error);setTimeout(()=>{if(shell.isConnected)close();},4000);throw error;}
  },
  close(){closeCurrent?.();}
 };
}
