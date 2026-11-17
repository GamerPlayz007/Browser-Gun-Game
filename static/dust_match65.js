/**
 * CROSSFire Stage 6.5: ORIGINAL Dust Corridor in ordinary multiplayer scene.
 *
 * Retains original source-built geometry, props, cloth and cables. Unlike the
 * inspect-only preview, this uses game.js's existing renderer, scene, camera,
 * opponents, weapons, post effects, HUD and network synchronization.
 * License: Leonxlnx/claude-of-duty @ 7f8a15ae (MIT); THIRD_PARTY.md.
 */
import * as THREE from 'three';
import {ClothSystem,CableSystem} from './dust_corridor/src/world/ClothSystem.js';
import {createDustPhysics65} from './dust_motion65.js';
import {makeDustMaterial65} from './dust_corridor_preview.js';

export function buildDustMatch65(scene,map,{quality='auto',source=null}={}){
 if(map.id!=='dust_corridor'||map.collisionFormat!=='DUSTCOL3'||!map.dustOriginal)
  throw Error('Refusing to render an unverified native Dust Corridor map');
 if(!source)throw Error('Dust 6.6 scene must be loaded before renderer creation');
 const data=source;
 if(!data?.soup?.count||data.soup.count!==96588)
  throw Error('Dust Corridor source triangle count mismatch');
 const physics=createDustPhysics65(data);
 // Feed the existing multiplayer minimap the EXACT source footprints.
 // This does not simplify or replace a single rendered building.
 map.dustFootprints=data.buildings.map(b=>({
  x0:b.x0,z0:b.z0,x1:b.x1,z1:b.z1
 }));
 const group=new THREE.Group();group.name='CROSSFIRE native Dust Corridor original district';
 scene.add(group);
 scene.background=new THREE.Color('#bdc9c9');
 const mat=makeDustMaterial65(null);
 const meshes=[],geometries=[];
 let cloth=null,cables=null,last=0;
 try{
  // Authored structures, ground, original granular props and clutter — all
  // five original mesh batches, without baking an alternate simplified city.
  for(const batch of data.batches){
   const geometry=batch.build();geometries.push(geometry);
   const mesh=new THREE.Mesh(geometry,mat);
   mesh.name='original-dust-'+batch.name;
   mesh.frustumCulled=true;
   group.add(mesh);meshes.push(mesh);
  }
  cloth=new ClothSystem(data.cloth,mat);
  cables=new CableSystem(data.cables,mat);
  group.add(cloth.mesh,cables.mesh);
 }catch(error){
  cloth?.dispose();cables?.dispose();
  for(const geo of geometries)geo.dispose();
  mat.dispose();group.removeFromParent();throw error;
 }
 const sun=new THREE.DirectionalLight(0xffe7c1,.9);
 sun.position.set(-24,57,24);
 const hemi=new THREE.HemisphereLight(0xf2f3e7,0x705a40,1.1);
 group.add(sun,hemi);
 const targets=new Map(); // No artificial targets over the source district.
 let detail=true,setting=quality;
 const world={
  isDustCorridor65:true,
  targets,
  staticBatches:meshes.length,
  originalVisualTriangles:data.visualTriangles||
   data.batches.reduce((n,b)=>n+b.triangleCount,0),
  packedScene66:!!data.packed,
  packedTransferBytes66:data.transferBytes||0,
  featureCount:data.buildings.length,
  environmentCount:data.cloth.length+data.cables.length,
  environmentSigns:0,
  physics,
  dustSource:data,
  get resourceProfile68(){return{
    fullArchitecture:true,hasEnvironment:true,atlasSize:0,atlases:0,
    atlasRebuilds:0,stage5Meshes:meshes.length,stage6Meshes:0
  };},
  setQuality(mode){setting=mode;},
  setDetail(value){
   // Throttle updates instead of removing decorative detail. Awnings and
   // cables are visible at every quality level, including Performance.
   detail=Boolean(value);
  },
  animate(time,player=null){
   if(player&&Number.isFinite(player.x)){
    mat.uniforms.uEye.value.set(player.x,player.y+1.55,player.z);
   }
   const frequency=setting==='performance'?15:
    setting==='auto'&&!detail?22:45;
   if(time-last<1/frequency)return;
   const dt=Math.max(0,Math.min(.05,time-last));last=time;
   cloth.update(dt,time);cables.update(dt,time);
  },
  dispose(){
   cloth.dispose();cables.dispose();
   for(const geo of geometries)geo.dispose();
   mat.dispose();
   group.removeFromParent();
   scene.background=null;
  }
 };
 world.setQuality(setting);
 return world;
}
