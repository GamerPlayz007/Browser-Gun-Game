/**
 * CROSSFire Artist-Mesh v4 — browser-only, non-weapon asset benchmark.
 * Renders unchanged artist-created GLB geometry and a separate skinned clone
 * for each scene instance. The original materials/textures/animations are shared.
 * Nothing is sent to multiplayer or to a remote service.
 */
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {HERO_GLB_BASE64, PERFORMANCE_GLB_BASE64} from './artist-mesh-v3-data.js';
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
const loader=new GLTFLoader();
const VARIANTS={HERO:{b64:HERO_GLB_BASE64,expectedBytes:162928,textureSize:1024},PERFORMANCE:{b64:PERFORMANCE_GLB_BASE64,expectedBytes:150248,textureSize:256}};
let source=null,sourceClips=[],instances=[],mixers=[],variant='HERO',sourceBytes=0,serial=0;
let toggledWire=false,autoRotate=true,count=24,running=false,results=[],loadMs=0;
let fps=0,avgFrame=0,last=performance.now(),windowMs=0,windowFrames=0,frameTimes=[];
const orbit={angle:.56,pitch:.35,distance:21,targetAngle:.56,targetPitch:.35,targetDistance:21};
let interaction=null;
const target=new T.Vector3(0,.8,0);
const reportSchema='CROSSFIRE_artist_asset_benchmark_v4';
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
 buildInstances(Number($('count').value));
 const s=sharedStats(source);
 status(`${mode==='CUSTOM'?'CUSTOM IMPORT':'ARTIST GLB'} READY · ${(bytes/1024).toFixed(1)} KB · decode ${elapsed.toFixed(0)} ms\n${s.triangles} original triangles, ${s.meshes} mesh, ${s.materials} materials, ${s.textures} textures. Skin/animations: ${sourceClips.length} clips.`);
 if(old&&old===source)throw Error('Source was unexpectedly reused');
}
async function loadPreset(mode){
 const own=++serial,started=performance.now();status(`Loading ${mode} GLB…`);
 try{
  const bytes=decode64(VARIANTS[mode].b64);
  if(bytes.byteLength!==VARIANTS[mode].expectedBytes)throw Error('Bundled asset byte length mismatch');
  const gltf=await loader.parseAsync(bytes.buffer,'');
  if(own!==serial)return;
  mount(gltf,mode,bytes.byteLength,performance.now()-started);
 }catch(err){if(own===serial)status(`ASSET FAILED: ${err.message}`,true);throw err;}
}
async function loadFile(file){if(!file)return;
 if(!/\.glb$/i.test(file.name)||file.size>30_000_000){status('Choose an embedded .GLB up to 30 MB.',true);return;}
 const own=++serial,started=performance.now();
 try{const data=await file.arrayBuffer();const gltf=await loader.parseAsync(data,'');if(own!==serial)return;
  results=[];renderTable();mount(gltf,'CUSTOM',file.size,performance.now()-started);
  $('quality').disabled=true;status(`Local-only import: ${file.name} · ${sourceClips.length} animation clips.`);
 }catch(err){if(own===serial)status(`IMPORT ERROR: ${err.message}`,true);}
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
 const result={profile:variant,copies:count,avgFps:1000/meanMs,low1pctFps:1000/slowMs,
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
 for(const id of ['benchmark','measure','quality','count','clip','pixelRatio','file'])$(id).disabled=locked;
 if(!locked&&variant==='CUSTOM')$('quality').disabled=true;
}
async function runOne(){if(running)return;lockUI(true);
 try{status('Warming up renderer, then measuring visible frames…');const item=await measure(3000);
  results.push(item);renderTable();status(`${item.profile} / ${item.copies} copies: ${item.avgFps.toFixed(1)} FPS average, ${item.low1pctFps.toFixed(1)} FPS 1% low. (${item.frames} frames)`);
 }catch(e){status('MEASUREMENT FAILED: '+e.message,true)}finally{lockUI(false)}
}
async function runAB(){if(running)return;lockUI(true);const saved={mode:variant,count:Number($('count').value),clip:$('clip').value};
 try{
  results=[];renderTable();$('clip').value='Walk';
  // Identical animated workload, camera policy and render profile for all cases.
  const scenarios=[['HERO',1],['PERFORMANCE',1],['HERO',24],['PERFORMANCE',24]];
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
  try{if(saved.mode!=='CUSTOM'){await loadPreset(saved.mode);}else if(source){buildInstances(saved.count)}}catch(e){status('Restore failed: '+e.message,true)}
  lockUI(false);
 }
}
function download(text,filename,type){const blob=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
function exportReport(format){if(!results.length){status('Take a measurement before exporting.',true);return;}
 if(format==='json')download(JSON.stringify({schema:reportSchema,notes:'Client-side rAF measurements. Hardware/browser-specific. Copies share geometry and textures but use independently animated rigs.',renderer:{pixelRatio:renderer.getPixelRatio(),quality:renderer.capabilities.precision},scenarios:results},null,2),'CROSSFIRE_ArtistMesh_v4_Benchmark.json','application/json');
 else {const keys=['profile','copies','avgFps','low1pctFps','medianFps','avgFrameMs','drawCalls','renderedTriangles','geometryCount','textureCount','pixelRatio','frames','sourceBytes','loadMs','animation','measuredAt'];
  download([keys.join(','),...results.map(r=>keys.map(k=>JSON.stringify(r[k])).join(','))].join('\n'),'CROSSFIRE_ArtistMesh_v4_Benchmark.csv','text/csv');}
}
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
 if(document.hidden){frameTimes=[];windowMs=0;windowFrames=0;return;}
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
loadPreset('HERO').catch(()=>{});