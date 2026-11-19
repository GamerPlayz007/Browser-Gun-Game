/* Instanced original Octavus mapmodels — CROSSFire Stage 2.6.
 * The source OBJ geometry, authored MPZ positions and skin textures are
 * preserved. Repeated placements become one GPU InstancedMesh per OBJ part.
 * No generated boxes or replacement models are introduced.
 */
import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {octavusEntityPosition} from './octavus_environment.js';
import {octavusPropInside,octavusPropVisible} from './octavus_prop_lod.js';

const base='/static/maps/';
const RAD=Math.PI/180;
async function fetchSource(path){
 try{const r=await fetch(base+path);return r.ok?await r.json():null;}
 catch{return null;}
}
const emptyResult=()=>({
 instances:0,modelTypes:0,missing:0,excluded:0,
 originalDrawUnits:0,instancedDrawBatches:0,
 renderedInstances:0,setQuality(){},animate(){},dispose(){}
});

export async function createOctavusProps(scene,quality='auto',playBounds=null){
 const [manifest,entitiesResponse,sourceCFG]=await Promise.all([
  fetchSource('octavus.props.json'),
  fetchSource('octavus.native-entities.json'),
  fetch('/static/maps/octavus.original.cfg').then(r=>r.ok?r.text():'').catch(()=> '')
 ]);
 if(manifest?.format!=='OCTAVUS-PROPS3'||!entitiesResponse?.visualEntities)
  return emptyResult();

 const aliases=[...sourceCFG.matchAll(/^mapmodel\s+"([^"]+)"/gm)].map(x=>x[1]);
 const candidates=entitiesResponse.visualEntities.filter(e=>
  e?.type==='mapmodel'&&Array.isArray(e.attrs)&&
  Number.isInteger(e.attrs[0])&&aliases[e.attrs[0]]&&
  Array.isArray(e.sourcePosition));
 const inside=candidates.filter(e=>octavusPropInside(e.sourcePosition,playBounds));
 const placements=new Map();
 for(const entry of inside){
  const alias=aliases[entry.attrs[0]],info=manifest.models?.[alias];
  if(info?.missing||!['gzip-obj','obj'].includes(info?.codec)||
     !info.url?.startsWith('/static/maps/octavus_props/'))continue;
  if(!placements.has(alias))placements.set(alias,[]);
  placements.get(alias).push(entry);
 }

 const root=new THREE.Group();
 root.name='Octavus original MPZ mapmodels — instanced';
 scene.add(root);
 const loader=new OBJLoader();
 const geometries=new Set(),materials=new Set(),originalTextures=new Set();
 const groups=[];
 let disposed=false;
 async function loadSkin(info){
  // Source artwork ships locally so multiplayer never depends on GitHub or
  // the upstream asset server. The large radio dish image is High/Ultra only.
  let url=info.skinUrl;
  if(typeof info.skinB64Url==='string'&&
     info.skinB64Url.startsWith('/static/maps/octavus_props/')){
   const r=await fetch(info.skinB64Url);
   if(!r.ok)throw Error('Octavus original skin bundle not found');
   const encoded=(await r.text()).replace(/\s+/g,'');
   if(!encoded.startsWith('iVBORw0KGgo'))throw Error('Invalid source PNG');
   url='data:image/png;base64,'+encoded;
  }
  if(typeof url!=='string'||!(url.startsWith('/static/maps/octavus_props/')||
    url.startsWith('data:image/png;base64,')))return null;
  const texture=await new THREE.TextureLoader().loadAsync(url);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=quality==='performance'?1:4;
  return texture;
 }
 let modelTypes=0,loadedInstances=0,originalDrawUnits=0,instancedDrawBatches=0;

 for(const [alias,list]of placements){
  const info=manifest.models[alias];
  let prototype;
  try{
   const response=await fetch(info.url);
   if(!response.ok||typeof DecompressionStream==='undefined')continue;
   let sourceText;
   if(info.codec==='gzip-obj'){
    if(typeof DecompressionStream==='undefined')continue;
    const compressed=await response.arrayBuffer();
    const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    sourceText=await new Response(stream).text();
   }else sourceText=await response.text();
   prototype=loader.parse(sourceText);
   if(!prototype)continue;
   prototype.rotation.x=-Math.PI/2; // Preserve native Z-up -> Three Y-up.
   // Some source models (the original Luckystrike door) specify mdlyaw.
   // Apply it in original Z-up coordinates before the Three.js conversion.
   if(Number.isFinite(Number(info.yaw))&&Number(info.yaw)!==0)
    prototype.rotateZ(Number(info.yaw)*RAD);
  }catch(error){
   console.warn('Octavus source OBJ unavailable:',alias,error);
   continue;
  }
  const baseScale=(Number(info.sourceScale)||100)/100*.05;
  if(!Number.isFinite(baseScale)||baseScale<=0||baseScale>35)continue;

  let skin=null;
  const hasDeferredSkin=!!info.skinHighOnly;
  if(!hasDeferredSkin||quality==='high'||quality==='ultra'){
   try{
    skin=await loadSkin(info);
    if(skin)originalTextures.add(skin);
   }catch(error){console.warn('Octavus source skin unavailable:',alias,error);}
  }

  const parts=[],skinMaterials=[];
  prototype.traverse(child=>{
   if(!child.isMesh)return;
   geometries.add(child.geometry);
   materials.add(child.material);
   if(!child.material?.map){
    const name=alias.toLowerCase();
    const color=/weed|bush|plant/.test(name)?0x718569:
      /glow|light/.test(name)?0x89c6c9:
      /crate|door/.test(name)?0x9a7860:0x8d9397;
    const mat=new THREE.MeshStandardMaterial({
     color:skin?0xffffff:color,map:skin,roughness:.72,
     metalness:/metal|pipe|plate|rail|barrel/.test(name)?.48:.12,
     transparent:!!skin&&/weed|bush|plant/.test(name),
     alphaTest:!!skin&&/weed|bush|plant/.test(name)?.16:0,
     emissive:/glow|light/.test(name)?new THREE.Color('#2d6c76'):new THREE.Color('#000000'),
     emissiveIntensity:/glow|light/.test(name)?.65:0,
     side:THREE.DoubleSide
    });
    child.material=mat;materials.add(mat);
    if(!skin)skinMaterials.push(mat);
   }
   parts.push(child);
  });
  if(!parts.length)continue;

  // Build a complete instance transform from the native MPZ entity, including
  // any nested transforms in the actual OBJ. No model geometry is rewritten.
  const staging=new THREE.Group();
  staging.add(prototype);
  staging.rotation.order='YXZ';
  const transforms=parts.map(()=>[]);
  const locations=[];
  for(const entry of list){
   staging.position.copy(octavusEntityPosition(entry.sourcePosition));
   staging.rotation.set((Number(entry.attrs[2])||0)*RAD,
    -(Number(entry.attrs[1])||0)*RAD,(Number(entry.attrs[3])||0)*RAD);
   const attrScale=Number(entry.attrs[5])>0?Number(entry.attrs[5])/100:1;
   staging.scale.setScalar(baseScale*attrScale);
   staging.updateMatrixWorld(true);
   locations.push({x:staging.position.x,z:staging.position.z});
   for(let i=0;i<parts.length;i++)
    transforms[i].push(parts[i].matrixWorld.clone());
  }

  const batches=[];
  for(let i=0;i<parts.length;i++){
   const original=parts[i];
   const mesh=new THREE.InstancedMesh(original.geometry,original.material,list.length);
   mesh.name='Octavus original '+alias+' · source part '+i;
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   mesh.castShadow=quality==='ultra';
   mesh.receiveShadow=true;
   mesh.frustumCulled=true;
   // Initialize the complete original spatial extent ONCE so dynamic LOD
   // compaction never wrongly culls a nearby instance after a camera move.
   for(let k=0;k<list.length;k++)mesh.setMatrixAt(k,transforms[i][k]);
   mesh.instanceMatrix.needsUpdate=true;
   mesh.computeBoundingSphere();
   root.add(mesh);batches.push({mesh,transforms:transforms[i]});
   instancedDrawBatches++;
  }
  originalDrawUnits+=list.length*parts.length;
  loadedInstances+=list.length;modelTypes++;
  groups.push({alias,locations,batches,skinMaterials,skin,info,skinLoading:false});
 }

 let tier=quality,rendered=0,last=-1e9;
 async function loadDeferredSourceSkin(group){
  if(disposed||group.skinLoading||group.skin||!group.info.skinB64Url)return;
  group.skinLoading=true;
  try{
   const tex=await loadSkin(group.info);
   if(disposed){tex?.dispose();return;}
   if(tex){
    group.skin=tex;originalTextures.add(tex);
    for(const mat of group.skinMaterials){
     mat.map=tex;
     mat.color.set(0xffffff);
     mat.needsUpdate=true;
    }
    tex.anisotropy=tier==='performance'?1:4;
   }
  }catch(error){console.warn('Octavus original detail skin unavailable:',group.alias,error);}
  finally{group.skinLoading=false;}
 }
 function setQuality(next){
  tier=next;last=-1e9;
  for(const group of groups){
   for(const batch of group.batches)batch.mesh.castShadow=next==='ultra';
   if((next==='high'||next==='ultra')&&group.info.skinHighOnly)
    void loadDeferredSourceSkin(group);
  }
  for(const texture of originalTextures)
   texture.anisotropy=next==='performance'?1:4;
 }
 function animate(time,player){
  if(time-last<.42)return;
  last=time;
  const x=Number.isFinite(player?.x)?player.x:0;
  const z=Number.isFinite(player?.z)?player.z:0;
  let shown=0;
  for(const group of groups){
   const visible=[];
   for(let i=0;i<group.locations.length;i++){
    const p=group.locations[i];
    if(octavusPropVisible(p.x,p.z,x,z,tier,group.alias))
     visible.push(i);
   }
   shown+=visible.length;
   for(const batch of group.batches){
    const {mesh,transforms}=batch;
    for(let i=0;i<visible.length;i++)
     mesh.setMatrixAt(i,transforms[visible[i]]);
    // Unlike zero-scale hiding, reduce actual GPU instance count.
    mesh.count=visible.length;
    mesh.visible=visible.length>0;
    mesh.instanceMatrix.needsUpdate=true;
   }
  }
  rendered=shown;
 }
 setQuality(quality);
 animate(0,{x:0,z:0});
 return {
  instances:loadedInstances,modelTypes,
  missing:inside.length-loadedInstances,excluded:candidates.length-inside.length,
  originalDrawUnits,instancedDrawBatches,
  get renderedInstances(){return rendered;},setQuality,animate,
  dispose(){
   disposed=true;
   root.removeFromParent();
   // Geometry/material ownership is per imported type, not per placement.
   for(const geometry of geometries)geometry.dispose();
   for(const material of materials)material?.dispose?.();
   for(const tex of originalTextures)tex.dispose();
  }
 };
}
