/**
 * CROSSFire permanent Workshop Garage — artist-created asset inspector.
 * Renders unchanged artist-created GLB geometry and a separate skinned clone
 * for each scene instance. The original materials/textures/animations are shared.
 * Nothing is sent to multiplayer or to a remote service.
 */
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {HERO_GLB_BASE64, PERFORMANCE_GLB_BASE64} from './artist-mesh-v3-data.js';
import {readAssetBytes} from './gallery-assets.js';
import {WORKSHOP_CATALOG,personalToEntry,savePersonalAsset,validatePersonalGLB,getPersonalAsset} from './workshop-library.js';
import {createWorkshopLibraryUI} from './workshop-library-ui.js';
const $=id=>document.getElementById(id);
const scene=new T.Scene();scene.background=new T.Color(0x0e1a27);
const camera=new T.PerspectiveCamera(44,1,.015,250);
const canvas=$('stage');
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.1;
renderer.shadowMap.enabled=false;
scene.add(new T.HemisphereLight(0xe3f5ff,0x233244,2.2));
const key=new T.DirectionalLight(0xeaf5ff,3.2);key.position.set(-4,9,6);scene.add(key);
const fill=new T.DirectionalLight(0x90d9fa,1.45);fill.position.set(7,4,-6);scene.add(fill);
const rim=new T.DirectionalLight(0xffcd93,1.4);rim.position.set(5,6,3);scene.add(rim);
const floor=new T.Mesh(new T.PlaneGeometry(140,140),new T.MeshStandardMaterial({color:0x101f2c,roughness:.91}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.06;scene.add(floor);
const grid=new T.GridHelper(75,50,0x3d6571,0x274251);grid.position.y=-.055;
const gridMat=grid.material;gridMat.transparent=true;gridMat.opacity=.25;scene.add(grid);
const stage=new T.Group();scene.add(stage);

/**
 * Low-cost STATIC ENVIRONMENT only: a believable engineering garage.
 * Artifacts displayed in it are imported glTF meshes, never JS reconstructions.
 * This background does not connect to the game's map collision or networking.
 */
function buildWorkshopGarage(){
 const room=new T.Group();room.name='CROSSFIRE_PERMANENT_ASSET_WORKSHOP';scene.add(room);
 const mat=(color,metalness=.1,roughness=.78,emissive=0x000000,intensity=0)=>new T.MeshStandardMaterial({color,metalness,roughness,emissive,emissiveIntensity:intensity});
 const concrete=mat(0x25323d,.06,.92),panel=mat(0x1c2a32,.42,.61),steel=mat(0x4a5961,.72,.38);
 const desk=mat(0x283844,.35,.58),rubber=mat(0x0d1720,.03,.93),trim=mat(0x427d86,.57,.35);
 const cold=mat(0x8acddb,.08,.34,0x48cee6,.8),warm=mat(0xf3cb91,.08,.4,0xd68a45,.4);
 function box(name,x,y,z,w,h,d,m){
  const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.name=name;
  mesh.position.set(x,y,z);room.add(mesh);return mesh;
 }
 // The open front is deliberate: the camera looks into the garage.
 box('Back concrete wall',0,5,-17,34,10,.45,concrete);
 box('Left garage wall',-17,5,-1,.45,10,33,panel);
 box('Right garage wall',17,5,-1,.45,10,33,panel);
 box('Rear soffit',0,9.6,-16.5,34,.8,2,steel);
 for(const x of [-12,-6,0,6,12]){
  box('Workshop steel wall pillar',x,4.65,-16.68,.32,9,.33,steel);
 }
 // Large segmented roller door on the rear wall, with characteristic slats.
 box('Garage service door frame',0,4,-16.7,12.8,7.4,.31,steel);
 for(let i=0;i<12;i++){
  const m=i%2===0?desk:panel;
  box('Sectional garage door / '+(i+1),0,.7+i*.57,-16.47,11.9,.53,.13,m);
  box('Garage door divider / '+(i+1),0,.96+i*.57,-16.38,11.7,.025,.08,trim);
 }
 // Overhead suspended light strips and rafters.
 for(const x of [-11,-5.5,0,5.5,11]){
  box('Garage ceiling rail',x,8.9,-3,.24,.2,26,steel);
  for(const z of [-10,0,9]){
   box('Luminaire housing',x,8.62,z,1.65,.12,.36,steel);
   box('Luminaire diffusing panel',x,8.53,z,1.43,.045,.29,cold);
  }
 }
 // Side work surfaces, closed drawer units and storage bays.
 for(const side of [-1,1]){
  for(const z of [-10,-4,2,8]){
   const x=side*12.6;
   box('Workshop equipment drawer',x,.67,z,2.8,1.34,2.2,desk);
   for(let drawer=0;drawer<3;drawer++){
    const handleX=x-side*1.42;
    box('Drawer front',handleX,.23+drawer*.42,z,.045,.33,1.82,panel);
    box('Drawer handle',handleX-side*.09,.27+drawer*.42,z,.04,.045,.78,steel);
   }
   box('Reinforced worktop',x,1.43,z,3.35,.18,2.64,steel);
   box('Worktop rubber mat',x,1.54,z,2.65,.035,2.05,rubber);
  }
  // Vertical tool-panel silhouettes (environmental detailing only).
  box('Workshop pegboard',side*16.65,4.5,-4,.08,3,7,desk);
  for(let i=0;i<8;i++){
   box('Pegboard alignment slot',side*16.51,3.35+(i%4)*.68,-6.5+Math.floor(i/4)*4.5,.085,.09,1.6,trim);
  }
  box('Safety edge stripe',side*16.48,.12,-1,.06,.08,29,warm);
 }
 // Floor markings and safe viewing platform. No physical collision geometry.
 for(const x of [-3.6,3.6]){
  box('Asset bay alignment marker',x,-.048,0,.11,.012,9,warm);
 }
 for(const z of [-4.5,4.5]){
  box('Inspection bay crossing marker',0,-.046,z,7.25,.015,.11,trim);
 }
 const base=new T.Mesh(new T.CylinderGeometry(1.7,1.75,.1,48),rubber);
 base.position.set(0,-.12,0);base.name='Inspection turntable / stationary floor disc';room.add(base);
 const rim=new T.Mesh(new T.TorusGeometry(1.67,.035,8,64),cold);
 rim.rotation.x=-Math.PI/2;rim.position.y=-.062;rim.name='Inspection bay LED floor ring';room.add(rim);
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='#14242c';ctx.fillRect(0,0,1024,192);
 ctx.strokeStyle='#65b9c6';ctx.lineWidth=7;ctx.strokeRect(10,10,1004,172);
 ctx.fillStyle='#e3f5f9';ctx.font='bold 72px Arial';ctx.textAlign='center';ctx.fillText('CROSSFIRE / THE WORKSHOP',512,105);
 ctx.fillStyle='#78b6c6';ctx.font='24px Arial';ctx.fillText('ASSET DEVELOPMENT  •  INSPECTION  •  PERFORMANCE',512,153);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const sign=new T.Mesh(new T.PlaneGeometry(10.7,2),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));
 sign.position.set(0,7.95,-16.18);sign.name='Garage workshop identity sign';room.add(sign);
 const light=new T.PointLight(0x72dce7,12,19,2);
 light.position.set(0,6,2);room.add(light);
 return room;
}
buildWorkshopGarage();
const loader=new GLTFLoader();
const VARIANTS={HERO:{b64:HERO_GLB_BASE64,expectedBytes:162928,textureSize:1024},PERFORMANCE:{b64:PERFORMANCE_GLB_BASE64,expectedBytes:150248,textureSize:256}};
let source=null,sourceClips=[],instances=[],mixers=[],variant='HERO',sourceBytes=0,serial=0;
let toggledWire=false,autoRotate=true,count=1,running=false,results=[],loadMs=0;
let fps=0,avgFrame=0,last=performance.now(),windowMs=0,windowFrames=0,frameTimes=[];
const orbit={angle:.56,pitch:.35,distance:21,targetAngle:.56,targetPitch:.35,targetDistance:21};
let interaction=null;
const target=new T.Vector3(0,.8,0);
$('openComparison').addEventListener('click',async()=>{
 if(running){status('Complete the active benchmark before comparing.',true);return}
 try{const bay=await import('./workshop-comparison.js');await bay.openComparison()}
 catch(e){status('Comparison bay could not open: '+e.message,true);console.error(e)}
});
const reportSchema='CROSSFIRE_workshop_asset_library_v2';
let activeAsset=WORKSHOP_CATALOG[0],libraryUI=null,pendingFetch=null;
const MAX_REPOSITORY_BYTES=65_000_000;
function setProfileOptions(entry){
 const select=$('quality'),previous=select.value;select.replaceChildren();
 for(const profile of entry.profiles){
  const opt=document.createElement('option');opt.value=profile.id;opt.textContent=profile.label;select.append(opt);
 }
 select.value=entry.profiles.some(p=>p.id===previous)?previous:(entry.profiles[0]?.id||'');
 select.disabled=!entry.profiles.length||running;
 $('benchmark').disabled=entry.profiles.length<2||running;
 $('downloadAsset').disabled=!entry.profiles.length||running;
}
function syncClipOptions(){
 const sel=$('clip'),wanted=sel.value;sel.replaceChildren();
 for(const clip of sourceClips){const opt=document.createElement('option');opt.value=clip.name;opt.textContent=clip.name;sel.append(opt)}
 const pause=document.createElement('option');pause.value='Pause';pause.textContent='Pause';sel.append(pause);
 sel.value=sourceClips.some(x=>x.name===wanted)?wanted:(sourceClips[0]?.name||'Pause');
}
async function chooseLibraryAsset(entry){
 if(running||!entry?.profiles.length)return;
 const old=activeAsset;activeAsset=entry;setProfileOptions(entry);
 results=[];renderTable();
 try{await loadPreset($('quality').value)}
 catch(err){activeAsset=old;setProfileOptions(old);status('Preview unavailable: '+err.message,true)}
}
function downloadBlob(blob,name){
 const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),4000);
}
async function downloadCurrentAsset(){
 const profile=activeAsset?.profiles.find(p=>p.id===$('quality').value)||activeAsset?.profiles[0];
 if(!profile)return;
 try{
  if(profile.url){const a=document.createElement('a');a.href=profile.url;a.download=profile.url.split('/').pop();a.click();return}
  if(profile.type==='embedded'){downloadBlob(new Blob([decode64(VARIANTS[profile.id].b64)],{type:'model/gltf-binary'}),'CROSSFIRE_Fox_'+profile.id+'.glb');return}
  if(profile.type==='local'){
   const record=await getPersonalAsset(activeAsset.id);if(!record?.blob)throw Error('Saved GLB not found');
   downloadBlob(record.blob,record.name);
  }
 }catch(e){status('Download failed: '+e.message,true)}
}
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function decode64(text){const raw=atob(text);const output=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)output[i]=raw.charCodeAt(i);return output;}
function resize(){renderer.setPixelRatio(Math.min(2,Number($('pixelRatio').value)));renderer.setSize(Math.max(1,innerWidth),Math.max(1,innerHeight),false);camera.aspect=Math.max(1,innerWidth)/Math.max(1,innerHeight);camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();
function sharedStats(root){const meshes=[],materials=new Set(),textures=new Set();let triangles=0;
 root.traverse(node=>{if(!node.isMesh)return;meshes.push(node);
  const geometry=node.geometry;triangles+=(geometry?.index?.count||geometry?.attributes?.position?.count||0)/3;
  for(const m of Array.isArray(node.material)?node.material:[node.material])if(m){materials.add(m);for(const key of ['map','normalMap','metalnessMap','roughnessMap','aoMap','emissiveMap'])if(m[key])textures.add(m[key]);}
 });return{meshes:meshes.length,triangles:Math.round(triangles),materials:materials.size,textures:textures.size};}
/** Rebind cloned skinned meshes to cloned bones, without creating new geometry. */
function cloneAnimated(root){
 const clone=root.clone(true),sourceNodes=[],clonedNodes=[];
 root.traverse(o=>sourceNodes.push(o));clone.traverse(o=>clonedNodes.push(o));
 if(sourceNodes.length!==clonedNodes.length)throw Error('Cloned hierarchy does not match source rig');
 const mapping=new Map(sourceNodes.map((n,i)=>[n,clonedNodes[i]]));
 for(let i=0;i<sourceNodes.length;i++){
  const s=sourceNodes[i],d=clonedNodes[i];
  if(!s.isSkinnedMesh)continue;
  const bones=s.skeleton.bones.map(b=>mapping.get(b));
  if(bones.some(b=>!b))throw Error('Skin contains bones outside its cloned hierarchy');
  const skeleton=new T.Skeleton(bones,s.skeleton.boneInverses.map(m=>m.clone()));
  d.bind(skeleton,s.bindMatrix.clone());
  d.bindMode=s.bindMode;
 }
 return clone;
}
function clearInstances(){for(const m of mixers)m.stopAllAction();mixers=[];
 for(const obj of instances){obj.traverse(n=>{if(n.isSkinnedMesh&&n.skeleton)n.skeleton.dispose()});obj.removeFromParent();}
 instances=[];
}
function disposeSource(){clearInstances();if(!source)return;
 const g=new Set(),m=new Set(),t=new Set();
 source.traverse(node=>{if(!node.isMesh)return;g.add(node.geometry);
  for(const mat of Array.isArray(node.material)?node.material:[node.material])if(mat){m.add(mat);for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'])if(mat[k])t.add(mat[k]);}
 });g.forEach(x=>x.dispose());t.forEach(x=>x.dispose());m.forEach(x=>x.dispose());source=null;}
function applyWireframe(){for(const obj of instances)obj.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m&&'wireframe' in m)m.wireframe=toggledWire;});}
function playAnimation(){const clipName=$('clip').value;
 for(let i=0;i<mixers.length;i++){
  const mixer=mixers[i];mixer.stopAllAction();if(clipName==='Pause')continue;
  const clip=sourceClips.find(x=>x.name===clipName)||sourceClips[0];
  if(clip){const act=mixer.clipAction(clip);act.reset();act.time=(i%9)*.13;act.play();}
 }
}
function buildInstances(n){if(!source)return;clearInstances();count=n;
 $('workbench').classList.toggle('on',n===1);$('stress').classList.toggle('on',n===24);
 const side=Math.ceil(Math.sqrt(n));const sep=1.75;const origin=(side-1)/2;
 for(let i=0;i<n;i++){
  const obj=cloneAnimated(source),x=(i%side-origin)*sep,z=(Math.floor(i/side)-origin)*sep;
  // The same source transforms and geometry are used for every clone.
  obj.position.set(source.position.x+x,source.position.y,source.position.z+z);
  obj.rotation.y=(i%8)*Math.PI/4;
  obj.traverse(node=>{if(node.isMesh){node.frustumCulled=true;node.castShadow=false;node.receiveShadow=false;}});
  stage.add(obj);instances.push(obj);
  mixers.push(new T.AnimationMixer(obj));
 }
 playAnimation();applyWireframe();
 orbit.targetDistance=Math.max(6,Math.min(33,5.4+Math.sqrt(n)*2.85));
 $('inventory').textContent=`${sharedStats(source).meshes} mesh · ${sourceClips.length} clips × ${n}`;
 $('geometry').textContent=`${sharedStats(source).triangles.toLocaleString()} × ${n} triangles (source)`;
}
function mount(gltf,mode,bytes,elapsed){
 if(!gltf?.scene)throw Error('Missing GLB scene');
 const old=source;disposeSource();
 source=gltf.scene;sourceClips=gltf.animations||[];
 const bounds=new T.Box3().setFromObject(source);
 if(bounds.isEmpty())throw Error('No drawable geometry');
 const size=bounds.getSize(new T.Vector3());
 const scale=1.5/Math.max(size.x,size.y,size.z,1e-6);
 source.scale.setScalar(scale);source.updateMatrixWorld(true);
 const scaled=new T.Box3().setFromObject(source),mid=scaled.getCenter(new T.Vector3());
 source.position.set(-mid.x,-scaled.min.y,-mid.z);source.updateMatrixWorld(true);
 variant=mode;sourceBytes=bytes;loadMs=elapsed;
 if(mode!=='CUSTOM')$('quality').value=mode;
 syncClipOptions();
 buildInstances(Number($('count').value));
 const s=sharedStats(source);
 status(`${mode==='CUSTOM'?'CUSTOM IMPORT':'ARTIST GLB'} READY · ${(bytes/1024).toFixed(1)} KB · decode ${elapsed.toFixed(0)} ms\n${s.triangles} original triangles, ${s.meshes} mesh, ${s.materials} materials, ${s.textures} textures. Skin/animations: ${sourceClips.length} clips.`);
 if(old&&old===source)throw Error('Source was unexpectedly reused');
}
/**
 * The Workshop only fetches paths present in its versioned repository catalog,
 * or GLBs saved in this browser's IndexedDB. No game network endpoints.
 */
async function loadPreset(mode){
 const entry=activeAsset,profile=entry.profiles.find(p=>p.id===mode);
 if(!profile)throw Error('Unknown asset version');
 const own=++serial,started=performance.now();
 pendingFetch?.abort();pendingFetch=null;
 status('Loading '+entry.title+' · '+profile.label+'…');
 try{
  let payload,bytesCount=0;
  if(profile.type==='embedded'){
   const bytes=decode64(VARIANTS[mode]?.b64||'');
   if(bytes.byteLength!==profile.bytes)throw Error('Bundled reference asset mismatch');
   payload=bytes.buffer;bytesCount=bytes.byteLength;
  }else if(profile.type==='url'||profile.type==='gltf'){
   const ctl=new AbortController();pendingFetch=ctl;
   if(profile.type==='url'){
    payload=await readAssetBytes(profile.url,{signal:ctl.signal,maxBytes:MAX_REPOSITORY_BYTES});
    bytesCount=payload.byteLength;
   }else{
    const response=await fetch(profile.url,{signal:ctl.signal});
    if(!response.ok)throw Error('HTTP '+response.status);
    payload=await response.text();bytesCount=new TextEncoder().encode(payload).byteLength;
   }
   if(bytesCount!==profile.bytes)throw Error('Repository asset size changed. Refresh the workshop.');
  }else if(profile.type==='local'){
   const saved=await getPersonalAsset(entry.id);
   if(!saved?.blob)throw Error('This model is no longer saved in this browser');
   payload=await saved.blob.arrayBuffer();bytesCount=payload.byteLength;
  }else throw Error('Unsupported model source');
  if(own!==serial)return;
  const gltf=await loader.parseAsync(payload,'');
  if(own!==serial)return;
  mount(gltf,mode,bytesCount,performance.now()-started);
  libraryUI?.setActive(entry.id);
 }catch(err){if(own===serial&&err.name!=='AbortError')status('ASSET FAILED: '+err.message,true);throw err}
 finally{if(own===serial)pendingFetch=null}
}
async function loadFile(file){
 if(!file||running)return;
 const own=++serial,started=performance.now();
 pendingFetch?.abort();pendingFetch=null;
 try{
  await validatePersonalGLB(file);
  const buffer=await file.arrayBuffer();
  const gltf=await loader.parseAsync(buffer,'');
  if(own!==serial)return;
  results=[];renderTable();
  let saved=null,saveError=null;
  try{saved=await savePersonalAsset(file)}catch(err){saveError=err}
  if(own!==serial)return;
  if(saved){
   activeAsset=personalToEntry(saved);setProfileOptions(activeAsset);
   mount(gltf,'LOCAL',file.size,performance.now()-started);
   await libraryUI.refresh();libraryUI.setActive(saved.id);
   status('SAVED IN THIS BROWSER: '+saved.name+' · '+sourceClips.length+' animation clips. Not uploaded to the game or GitHub.');
  }else{
   activeAsset={id:'temporary-preview',title:file.name,category:'personal',profiles:[]};
   setProfileOptions(activeAsset);mount(gltf,'CUSTOM',file.size,performance.now()-started);
   $('quality').disabled=true;
   status('TEMPORARY PREVIEW: '+file.name+'. Browser storage unavailable: '+(saveError?.message||'unknown reason'),true);
  }
 }catch(err){if(own===serial)status('IMPORT FAILED: '+err.message,true)}
}
function renderTable(){const body=$('resultRows');body.replaceChildren();
 if(!results.length){const r=document.createElement('tr'),c=document.createElement('td');c.colSpan=5;c.textContent='No measurements yet. Run A/B or measure this view.';r.appendChild(c);body.appendChild(r);return;}
 for(const item of results){const r=document.createElement('tr');if(item.profile==='PERFORMANCE')r.className='highlight';
  for(const value of [item.profile,item.copies,item.avgFps.toFixed(1),item.low1pctFps.toFixed(1),item.drawCalls]){
   const c=document.createElement('td');c.textContent=String(value);r.appendChild(c);
  }body.appendChild(r);
 }
}
let capture=null;
function finishCapture(){if(!capture)return;
 const c=capture;capture=null;
 if(c.frames.length<15){c.reject(Error('Insufficient visible frames. Keep this tab active.'));return;}
 const sorted=[...c.frames].sort((a,b)=>a-b),time=c.frames.reduce((a,b)=>a+b,0);
 const meanMs=time/c.frames.length,slowMs=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.99))];
 const result={assetId:activeAsset.id,assetTitle:activeAsset.title,profile:variant,copies:count,avgFps:1000/meanMs,low1pctFps:1000/slowMs,
  medianFps:1000/sorted[Math.floor(sorted.length*.5)],frames:sorted.length,avgFrameMs:meanMs,
  drawCalls:renderer.info.render.calls,renderedTriangles:renderer.info.render.triangles,
  geometryCount:renderer.info.memory.geometries,textureCount:renderer.info.memory.textures,
  pixelRatio:renderer.getPixelRatio(),animation:$('clip').value,sourceBytes,loadMs,
  userAgent:navigator.userAgent,measuredAt:new Date().toISOString()};
 c.resolve(result);
}
function collectFramesFor(milliseconds){return new Promise((resolve,reject)=>{
 if(capture)return reject(Error('Capture already in progress'));
 capture={frames:[],resolve,reject,start:performance.now(),duration:milliseconds};
});}
function idle(milliseconds){return new Promise(resolve=>setTimeout(resolve,milliseconds));}
async function measure(duration=2400){if(document.hidden)throw Error('Benchmark tab must remain visible');
 await idle(750);return collectFramesFor(duration);
}
function lockUI(locked){running=locked;
 for(const id of ['benchmark','measure','quality','count','clip','pixelRatio','file','workbench','stress','downloadAsset','importAsset','assetSearch','assetFilter','openComparison'])$(id).disabled=locked;
 if(!locked)setProfileOptions(activeAsset);
 libraryUI?.setBusy(locked);
}
async function runOne(){if(running)return;lockUI(true);
 try{status('Warming up renderer, then measuring visible frames…');const item=await measure(3000);
  results.push(item);renderTable();status(`${item.profile} / ${item.copies} copies: ${item.avgFps.toFixed(1)} FPS average, ${item.low1pctFps.toFixed(1)} FPS 1% low. (${item.frames} frames)`);
 }catch(e){status('MEASUREMENT FAILED: '+e.message,true)}finally{lockUI(false)}
}
async function runAB(){
 if(running)return;
 if(!activeAsset||activeAsset.profiles.length<2){status('A/B requires an asset with two or more versions.',true);return}
 const profiles=activeAsset.profiles;
 const one=profiles.find(p=>p.id==='HERO')||profiles[0];
 const two=profiles.find(p=>p.id==='PERFORMANCE'&&p.id!==one.id)||profiles.find(p=>p.id!==one.id);
 lockUI(true);const saved={mode:variant,count:Number($('count').value),clip:$('clip').value};
 try{
  results=[];renderTable();
  if(sourceClips.some(x=>x.name==='Walk'))$('clip').value='Walk';
  // Identical cameras and renderer profile across four real asset scenarios.
  const scenarios=[[one.id,1],[two.id,1],[one.id,24],[two.id,24]];
  for(let i=0;i<scenarios.length;i++){
   if(document.hidden)throw Error('Keep this tab visible during all four measurements');
   const [mode,n]=scenarios[i];status(`A/B TEST ${i+1}/4 — ${mode}, ${n} animated copies\nLoading original artist geometry…`);
   $('count').value=String(n);
   await loadPreset(mode);
   const item=await measure(2600);
   results.push(item);renderTable();
   status(`A/B TEST ${i+1}/4 COMPLETE · ${item.avgFps.toFixed(1)} FPS, ${item.drawCalls} draw calls`);
  }
  status('FOUR-SCENE A/B TEST COMPLETE. Export the results for repeatable comparisons.');
 }catch(e){status('A/B TEST STOPPED: '+e.message,true)}
 finally{
  $('clip').value=saved.clip;$('count').value=String(saved.count);
  try{if(saved.mode!=='CUSTOM'&&activeAsset.profiles.some(p=>p.id===saved.mode)){await loadPreset(saved.mode)}else if(source){buildInstances(saved.count)}}catch(e){status('Restore failed: '+e.message,true)}
  lockUI(false);
 }
}
function download(text,filename,type){const blob=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
function exportReport(format){if(!results.length){status('Take a measurement before exporting.',true);return;}
 if(format==='json')download(JSON.stringify({schema:reportSchema,notes:'Client-side rAF measurements. Hardware/browser-specific. Copies share geometry and textures but use independently animated rigs.',renderer:{pixelRatio:renderer.getPixelRatio(),quality:renderer.capabilities.precision},scenarios:results},null,2),'CROSSFIRE_Workshop_Library_Benchmark.json','application/json');
 else {const keys=['profile','copies','avgFps','low1pctFps','medianFps','avgFrameMs','drawCalls','renderedTriangles','geometryCount','textureCount','pixelRatio','frames','sourceBytes','loadMs','animation','measuredAt'];
  download([keys.join(','),...results.map(r=>keys.map(k=>JSON.stringify(r[k])).join(','))].join('\n'),'CROSSFIRE_Workshop_Library_Benchmark.csv','text/csv');}
}
$('workbench').addEventListener('click',()=>{if(running)return;$('count').value='1';buildInstances(1);status('INSPECTION BENCH READY · one imported art asset.');});
$('stress').addEventListener('click',()=>{if(running)return;$('count').value='24';buildInstances(24);status('STRESS BAY READY · 24 independently animated art assets.');});
libraryUI=createWorkshopLibraryUI({
 onOpen:chooseLibraryAsset,
 onUnavailable:message=>status(message,true),
 onDeleteActive:()=>chooseLibraryAsset(WORKSHOP_CATALOG[0]),
 isBusy:()=>running
});
setProfileOptions(activeAsset);
libraryUI.refresh().catch(e=>status('Library could not initialize: '+e.message,true));
$('importAsset').addEventListener('click',()=>$('file').click());
$('downloadAsset').addEventListener('click',downloadCurrentAsset);
$('quality').addEventListener('change',e=>loadPreset(e.target.value).catch(()=>{}));
$('count').addEventListener('change',e=>buildInstances(Number(e.target.value)));
$('clip').addEventListener('change',playAnimation);
$('pixelRatio').addEventListener('change',resize);
$('toggleWire').addEventListener('click',()=>{toggledWire=!toggledWire;applyWireframe();$('toggleWire').textContent='WIREFRAME: '+(toggledWire?'ON':'OFF');$('toggleWire').classList.toggle('on',toggledWire);});
$('toggleRotate').addEventListener('click',()=>{autoRotate=!autoRotate;$('toggleRotate').textContent='ROTATION: '+(autoRotate?'ON':'OFF');$('toggleRotate').classList.toggle('on',autoRotate);});
$('benchmark').addEventListener('click',runAB);
$('measure').addEventListener('click',runOne);
$('saveReport').addEventListener('click',()=>exportReport('json'));
$('saveCsv').addEventListener('click',()=>exportReport('csv'));
$('file').addEventListener('change',e=>loadFile(e.target.files?.[0]));
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);interaction={x:e.clientX,y:e.clientY};autoRotate=false;$('toggleRotate').textContent='ROTATION: OFF';$('toggleRotate').classList.remove('on');});
canvas.addEventListener('pointermove',e=>{if(!interaction)return;orbit.targetAngle-=(e.clientX-interaction.x)*.006;orbit.targetPitch=T.MathUtils.clamp(orbit.targetPitch+(e.clientY-interaction.y)*.004,-.9,1.4);interaction={x:e.clientX,y:e.clientY};});
for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>{interaction=null});
canvas.addEventListener('wheel',e=>{e.preventDefault();orbit.targetDistance=T.MathUtils.clamp(orbit.targetDistance+Math.sign(e.deltaY)*1.0,2.8,65)},{passive:false});
let graph=[];function drawChart(){const c=$('chart'),ctx=c.getContext('2d');if(!ctx)return;
 const W=c.width,H=c.height;ctx.clearRect(0,0,W,H);
 for(let i=1;i<=3;i++){const y=(H-22)*i/4;ctx.strokeStyle='#223f4c';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
 if(graph.length<2)return;
 ctx.strokeStyle='#6ce1e8';ctx.lineWidth=3;ctx.beginPath();const hi=Math.max(65,...graph.map(x=>x));
 graph.forEach((x,i)=>{const px=i/(graph.length-1)*(W-7)+3,py=(H-25)*(1-x/hi)+5;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);});ctx.stroke();
 ctx.fillStyle='#a8c6ce';ctx.font='18px monospace';ctx.fillText(`RECENT FPS · PEAK ${Math.round(hi)}`,14,H-8);
}
function frame(now){requestAnimationFrame(frame);
 const raw=now-last;last=now;
 if(document.hidden || !$('comparisonBay').hidden){frameTimes=[];windowMs=0;windowFrames=0;return;}
 const ms=Math.min(180,Math.max(0,raw)),dt=Math.min(.075,ms/1000);
 if(autoRotate)orbit.targetAngle+=dt*.13;
 const smooth=1-Math.exp(-dt*9);
 orbit.angle+=(orbit.targetAngle-orbit.angle)*smooth;orbit.pitch+=(orbit.targetPitch-orbit.pitch)*smooth;orbit.distance+=(orbit.targetDistance-orbit.distance)*smooth;
 const cp=Math.cos(orbit.pitch);camera.position.set(Math.sin(orbit.angle)*cp*orbit.distance,2.2+Math.sin(orbit.pitch)*orbit.distance,Math.cos(orbit.angle)*cp*orbit.distance);camera.lookAt(target);
 for(const mixer of mixers)mixer.update(dt);
 renderer.render(scene,camera);
 if(capture){if(!document.hidden&&ms>0&&ms<150)capture.frames.push(ms);if(now-capture.start>=capture.duration)finishCapture();}
 if(ms>0&&ms<150){windowMs+=ms;windowFrames++}
 if(windowMs>=1000){fps=1000*windowFrames/windowMs;avgFrame=windowMs/windowFrames;
  $('fps').textContent=fps.toFixed(0);$('draws').textContent=renderer.info.render.calls.toLocaleString();$('tris').textContent=renderer.info.render.triangles.toLocaleString();
  graph.push(fps);if(graph.length>100)graph.shift();drawChart();windowMs=0;windowFrames=0;}
}
requestAnimationFrame(frame);
loadPreset(activeAsset.profiles[0].id).catch(()=>{});