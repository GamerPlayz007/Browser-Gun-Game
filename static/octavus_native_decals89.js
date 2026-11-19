/* Octavus Phase 1.9: original Red Eclipse 2 decals physically projected
 * onto the reconstructed native OCN2 world geometry. This file belongs
 * exclusively to the source-native inspection page and is NEVER used by
 * the live multiplayer Octavus map.
 *
 * Textures are original attributed Red Eclipse assets; original MPZ
 * decal transforms control position, yaw/pitch/roll, dimensions and UVs.
 * Original lightmaps, alpha layering and blended shader fade still differ.
 */
import * as THREE from 'three';
import {
  buildOctavusTriangleIndex,projectNativeDecal,mergeProjectedDecalParts,
  PROJECTED_DECAL_LIMIT
} from './octavus_native_decal_project90.js';

const ROOT='/static/maps/';
async function read(path){
 try{
  const r=await fetch(ROOT+path);
  return r.ok?await r.json():null;
 }catch{return null}
}
export async function createOctavusDecals(scene,quality='auto',nativeGeometry=null){
 if(!nativeGeometry||!nativeGeometry.isBufferGeometry||
    !nativeGeometry.getIndex()||!nativeGeometry.getAttribute('position')){
  throw Error('Native polygon-projected decals require reconstructed OCN2 source geometry');
 }
 const [manifest,native]=await Promise.all([
  read('octavus.decals.json'),read('octavus.native-entities.json')
 ]);
 if(manifest?.format!=='OCTAVUS-DECALS2'||!native?.visualEntities)
  throw Error('Original Octavus decal files unavailable');
 const materials=manifest.materials||{};
 const grouped=new Map();
 for(const e of native.visualEntities){
  if(e?.type!=='decal'||!Array.isArray(e.attrs)||!Array.isArray(e.sourcePosition))continue;
  const slot=String(e.attrs[0]),info=materials[slot];
  if(!info?.url?.startsWith('/static/maps/octavus_assets/'))continue;
  if(!grouped.has(slot))grouped.set(slot,[]);
  grouped.get(slot).push(e);
 }
 const sourceCount=[...grouped.values()].reduce((n,arr)=>n+arr.length,0);
 if(sourceCount!==135)throw Error('Native Red Eclipse decal manifest missing placements ('+sourceCount+')');
 const spatial=buildOctavusTriangleIndex(nativeGeometry);
 const root=new THREE.Group();
 root.name='Octavus original geometry-clipped native decal surfaces';
 scene.add(root);
 const loader=new THREE.TextureLoader();
 const meshes=[],textures=[],geometries=[];
 let projected=0,triangles=0,loadedMaterials=0,worldCandidateTests=0;
 const MAX_PARTS=150000;
 try{
  for(const [slot,instances] of grouped){
   const info=materials[slot];
   let texture=null;
   try{texture=await loader.loadAsync(info.url)}
   catch(error){
    console.warn('Missing original Octavus decal source image',slot,error);
    continue;
   }
   texture.colorSpace=THREE.SRGBColorSpace;
   texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
   texture.anisotropy=quality==='performance'?1:4;
   textures.push(texture);
   const w=texture.image?.naturalWidth||texture.image?.width||1;
   const h=texture.image?.naturalHeight||texture.image?.height||1;
   const parts=[];
   for(const entry of instances){
    const part=projectNativeDecal(nativeGeometry,spatial,entry,w,h);
    worldCandidateTests+=part.candidateTriangles;
    if(!part.triangles){part.geometry.dispose();continue}
    projected++;
    triangles+=part.triangles;
    parts.push(part);
    if(triangles>PROJECTED_DECAL_LIMIT){
     throw Error('Octavus projected decal triangle limit exceeded');
    }
   }
   if(!parts.length)continue;
   const merged=mergeProjectedDecalParts(parts);
   geometries.push(merged);
   const material=new THREE.MeshBasicMaterial({
    name:'Source Octavus projected decal '+slot,
    map:texture,
    transparent:true,
    alphaTest:.035,
    opacity:.92,
    depthWrite:false,
    side:THREE.DoubleSide,
    polygonOffset:true,
    polygonOffsetFactor:-1,
    polygonOffsetUnits:-3
   });
   const mesh=new THREE.Mesh(merged,material);
   mesh.name='Native polygon-clipped Octavus decal '+slot;
   mesh.renderOrder=8;
   mesh.frustumCulled=false;
   root.add(mesh);
   meshes.push(mesh);
   loadedMaterials++;
  }
 }catch(error){
  root.removeFromParent();
  for(const mesh of meshes)mesh.material.dispose();
  for(const g of geometries)g.dispose();
  for(const tex of textures)tex.dispose();
  throw error;
 }
 let disposed=false;
 return {
  count:sourceCount,
  projected,
  unprojected:sourceCount-projected,
  triangles,
  worldCandidateTests,
  materials:loadedMaterials,
  spatialCells:spatial.cellCount,
  eligibleSourceTriangles:spatial.eligibleTriangles,
  ignoredUnverifiedPlainTriangles:spatial.excludedUnverifiedTriangles,
  spatialOverflowTriangles:spatial.overflowCount,
  geometryMode:'native-polygon-clipped',
  setQuality(next){
   for(const t of textures)t.anisotropy=next==='performance'?1:4;
  },
  dispose(){
   if(disposed)return;
   disposed=true;
   root.removeFromParent();
   for(const mesh of meshes)mesh.material.dispose();
   for(const geo of geometries)geo.dispose();
   for(const t of textures)t.dispose();
  }
 };
}
