/* Authentic Red Eclipse Octavus native decal placements.
 * Original source images retain original module authorship and credits.
 * Correct source positions and authored rotations; InstancedMesh groups
 * drastically reduce draw calls compared to 141 individual decal objects.
 */
import * as THREE from 'three';
import {octavusEntityPosition} from './octavus_environment.js';

const ROOT='/static/maps/';
const radians=degrees=>Number(degrees||0)*Math.PI/180;
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
   obj.position.copy(octavusEntityPosition(entry.sourcePosition));
   // Red Eclipse decal angle order is yaw, pitch, roll in degrees.
   obj.rotation.set(-radians(a[2]),radians(a[1]),radians(a[3]),'YXZ');
   const radius=Math.min(12,Math.max(.20,(Math.abs(a[4]||45))*.05));
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
