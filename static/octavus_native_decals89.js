/* Phase 1.8 source-corrected ORIENTATION module for standalone geometry lab only. Never imported into live CROSSFire map. */
/* Authentic Red Eclipse Octavus native decal placements.
 * Original source images retain original module authorship and credits.
 * Correct source positions and authored native yaw/pitch/roll rotations;
 * instanced proxy planes still do NOT reproduce Red Eclipse's polygon
 * projector clipping against original world geometry. This distinction
 * is intentionally exposed to visual QA before declaring parity.
 */
import * as THREE from 'three';
import {originalNativePosition,octavusSourceQuaternion,originalDecalSize} from './octavus_native_transform89.js';

const ROOT='/static/maps/';
async function read(path){
 try{const r=await fetch(ROOT+path);return r.ok?await r.json():null;}
 catch{return null;}
}
export async function createOctavusDecals(scene,quality='auto'){
 const [manifest,native]=await Promise.all([
  read('octavus.decals.json'),read('octavus.native-entities.json')
 ]);
 if(manifest?.format!=='OCTAVUS-DECALS2'||!native?.visualEntities)
  return {count:0,materials:0,setQuality(){},dispose(){}};
 const materials=manifest.materials||{};
 const items=new Map();
 for(const e of native.visualEntities){
  if(e?.type!=='decal'||!Array.isArray(e.attrs)||!Array.isArray(e.sourcePosition))continue;
  const index=String(e.attrs[0]),material=materials[index];
  if(!material?.url?.startsWith('/static/maps/octavus_assets/'))continue;
  if(!items.has(index))items.set(index,[]);
  items.get(index).push(e);
 }
 const loader=new THREE.TextureLoader(),root=new THREE.Group();
 root.name='Original Octavus native scene decals';
 scene.add(root);
 const textures=[],meshes=[],geometries=[];
 let placed=0,loaded=0;
 for(const [index,instances]of items){
  const info=materials[index];
  let map;
  try{map=await loader.loadAsync(info.url);}catch(e){continue;}
  map.colorSpace=THREE.SRGBColorSpace;
  map.anisotropy=quality==='performance'?1:4;
  map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;
  const geo=new THREE.PlaneGeometry(1,1);
  const mat=new THREE.MeshBasicMaterial({
   map,transparent:true,alphaTest:.028,opacity:.90,depthWrite:false,
   side:THREE.DoubleSide,polygonOffset:true,
   polygonOffsetFactor:-1,polygonOffsetUnits:-2
  });
  const mesh=new THREE.InstancedMesh(geo,mat,instances.length);
  mesh.name='Octavus original decal '+index;
  mesh.frustumCulled=false;
  const obj=new THREE.Object3D();
  for(let i=0;i<instances.length;i++){
   const entry=instances[i],a=entry.attrs;
   obj.position.copy(originalNativePosition(entry.sourcePosition));
   // Native gendecal(): yaw Z, pitch X, -roll Y.
   // This is a visual projector proxy, NOT the final clipped decal.
   obj.quaternion.copy(octavusSourceQuaternion(a[1],a[2],a[3]));
   const radius=originalDecalSize(a);
   obj.scale.set(radius,radius,1);
   obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;
  root.add(mesh);textures.push(map);meshes.push(mesh);geometries.push(geo);
  loaded++;placed+=instances.length;
 }
 return {
  count:placed,materials:loaded,
  setQuality(next){
   const low=next==='performance';
   root.visible=true;
   for(const t of textures)t.anisotropy=low?1:4;
  },
  dispose(){
   root.removeFromParent();
   for(const mesh of meshes)mesh.material.dispose();
   for(const geo of geometries)geo.dispose();
   for(const t of textures)t.dispose();
  }
 };
}
