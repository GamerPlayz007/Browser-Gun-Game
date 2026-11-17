/* Octavus original environmental lighting and Redcliff sky.
 * Source MPZ environment and map entities: Red Eclipse 2 revision 829.
 * Original map content CC BY-SA 3.0; see Octavus attribution.
 * This is a browser-friendly adaptation of the source environment,
 * not the original engine's baked-lightmap implementation.
 */
import * as THREE from 'three';
const ROOT='/static/maps/';
const SKY_PATH='octavus.skybox.json';
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const decodeHex=n=>new THREE.Color(Number.isFinite(n)?n:0x998577);
function originToGame(source){
 // Red Eclipse native entity o=(X,Y,Z) has Z-up coordinates 0..8192;
 // Cube-2 OBJ exporter centers X,Y around 4096 and makes Y vertical.
 return new THREE.Vector3((source[0]-4096)*.05,
   (source[2]-2816)*.05,(source[1]-4096)*.05);
}
export {originToGame as octavusEntityPosition};

async function sourceJSON(path,fallback){
 try{const response=await fetch(ROOT+path);if(!response.ok)return fallback;return await response.json();}
 catch(error){console.warn('Octavus source environment unavailable:',path);return fallback;}
}
export async function createOctavusEnvironment(scene,quality='auto'){
 const [native,record,skyInfo]=await Promise.all([
  sourceJSON('octavus.native-entities.json',{visualEntities:[]}),
  sourceJSON('octavus.environment.json',{ambient:0x4f4842,sunlight:0xbca48d,fog:1800,skybox:'jojo/redcliff'}),
  sourceJSON(SKY_PATH,null)
 ]);
 const owned=[],lights=[];
 let sky=null;
 if(skyInfo?.name==='jojo/redcliff'&&skyInfo?.format==='OCTAVUS-SKY1'){
  try{
   const sides=['rt','lf','up','dn','ft','bk'].map(side=>skyInfo.sides?.[side]?.url);
   if(sides.every(s=>typeof s==='string'&&s.startsWith('/static/maps/octavus_assets/'))){
    sky=await new THREE.CubeTextureLoader().loadAsync(sides);
    sky.colorSpace=THREE.SRGBColorSpace;scene.background=sky;
   }
  }catch(error){console.warn('Octavus original Redcliff skybox failed to load',error);}
 }
 if(!sky)scene.background=new THREE.Color('#b99180');
 const fogColor=new THREE.Color(record.fogColour||'#a27d68');
 scene.fog=new THREE.FogExp2(fogColor,.0034);
 const ambient=decodeHex(record.ambient);
 const hemi=new THREE.HemisphereLight('#fff0df',ambient.clone().multiplyScalar(1.15),1.18);
 hemi.name='Octavus original ambient & sky fill';scene.add(hemi);owned.push(hemi);
 const sunColor=decodeHex(record.sunlight).lerp(new THREE.Color('#ffe9c9'),.34);
 const sun=new THREE.DirectionalLight(sunColor,2.10);
 sun.name='Octavus imported sunlight';
 const yaw=(Number(record.sunYaw)||285)*Math.PI/180,
       pitch=(Number(record.sunPitch)||35)*Math.PI/180;
 sun.position.set(Math.sin(yaw)*Math.cos(pitch)*170,Math.sin(pitch)*170,
                  Math.cos(yaw)*Math.cos(pitch)*170);
 sun.target.position.set(0,0,0);scene.add(sun);scene.add(sun.target);
 owned.push(sun,sun.target);
 sun.shadow.camera.left=sun.shadow.camera.bottom=-135;
 sun.shadow.camera.right=sun.shadow.camera.top=135;
 sun.shadow.camera.near=1;sun.shadow.camera.far=400;
 sun.shadow.normalBias=.03;
 // Original MPZ light entities are read rather than invented. To keep
 // real-time performance sane, only a small nearby subset is active.
 const sourceLights=(native.visualEntities||[]).filter(e=>
  e?.type==='light'&&Array.isArray(e.attrs)&&e.attrs.length>=4&&
  Array.isArray(e.sourcePosition)).map(e=>{
   const pos=originToGame(e.sourcePosition);
   const a=e.attrs;
   return {
    pos,
    radius:clamp((Number(a[0])||65)*.05,1.8,65),
    color:new THREE.Color().setRGB(
      clamp(a[1]/255,0,1),clamp(a[2]/255,0,1),clamp(a[3]/255,0,1)),
    id:e.id
   };
 });
 const MAX_LIGHTS=24;
 for(let i=0;i<MAX_LIGHTS;i++){
  const light=new THREE.PointLight(0xffffff,0,12,2);
  light.name='Octavus original light '+i;
  light.castShadow=false;light.visible=false;
  scene.add(light);lights.push(light);owned.push(light);
 }
 let tier=quality,visibleMax=12,lastUpdate=-100,activeLights=0;
 function setQuality(next){
  tier=next;
  visibleMax=next==='performance'?5:next==='ultra'?24:next==='high'?18:12;
  sun.castShadow=(next==='high'||next==='ultra');
  sun.shadow.mapSize.set(next==='ultra'?2048:1024,next==='ultra'?2048:1024);
  if(sun.castShadow)sun.shadow.needsUpdate=true;
  scene.fog.density=next==='performance'?.0048:next==='ultra'?.0026:.0035;
  for(let i=visibleMax;i<lights.length;i++)lights[i].visible=false;
 }
 setQuality(quality);
 function animate(now,position){
  if(now-lastUpdate<.18)return;
  lastUpdate=now;
  const p=position&&Number.isFinite(position.x)?position:{x:0,y:2,z:0};
  const candidates=[];
  for(const light of sourceLights){
   const dist2=(light.pos.x-p.x)**2+(light.pos.y-p.y)**2+(light.pos.z-p.z)**2;
   const maxDist=light.radius+24;
   if(dist2>maxDist*maxDist)continue;
   const score=dist2 / Math.max(light.radius,1);
   candidates.push({light,score});
  }
  candidates.sort((a,b)=>a.score-b.score);
  activeLights=Math.min(visibleMax,candidates.length);
  for(let i=0;i<lights.length;i++){
   if(i>=activeLights){lights[i].visible=false;continue;}
   const src=candidates[i].light,pt=lights[i];
   pt.visible=true;pt.position.copy(src.pos);
   pt.color.copy(src.color);
   pt.distance=Math.max(5,src.radius*2.1);
   pt.intensity=clamp(src.radius*.6,1.4,20);
  }
 }
 return {
  skybox:!!sky,sourceLightCount:sourceLights.length,
  get activeLightCount(){return activeLights;},
  setQuality,animate,
  dispose(){
   for(const child of owned)child.removeFromParent();
   sky?.dispose();scene.fog=null;scene.background=null;
   sun.shadow.map?.dispose();
  }
 };
}
