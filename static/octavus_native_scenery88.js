/* Octavus Phase 1.7 — original MPZ environmental entities in the
 * isolated native-source browser inspector.
 *
 * REUSE already attributed, source-derived Red Eclipse 2 r829 objects;
 * never replace map collision, invent models, or enable game weapons.
 *
 * Native source XYZ -> Three XYZ matches native OCN2 viewer:
 *   x=(X-4096)*.05, y=(Z-2816)*.05, z=(Y-4096)*.05.
 *
 * Original models are source OBJ geometry, original MPZ coordinates,
 * original Redcliff cube skybox, authored decal atlas and 233 lights.
 * Some 14 source models are unavailable; do not generate replacements.
 */
import * as THREE from 'three';
import {createOctavusEnvironment} from './octavus_environment.js';
import {createOctavusProps} from './octavus_native_props89.js';
import {createOctavusDecals} from './octavus_native_decals89.js';

function assertNativeEnvironment(){
 // Restrict to controlled geometry lab, not imported gameplay.
 if(!document.getElementById('viewport')||
    !document.getElementById('metric-tris')){
   throw Error('Octavus scenery is only enabled in standalone source viewer');
 }
}
const $=id=>document.getElementById(id);

export class OctavusNativeScenery {
 constructor(scene,{sourceHemisphere=null,sourceSun=null}={}){
  assertNativeEnvironment();
  this.scene=scene;
  this.originalHemisphere=sourceHemisphere;
  this.originalSun=sourceSun;
  this.environment=null;
  this.props=null;
  this.decals=null;
  this.nativeGeometry=null;
  this.requestIds={environment:0,props:0,decals:0};
  this.onNotice=null;
  this.onCounts=null;
  this.lastUpdate=0;
  this.tier='auto';
  this.disposed=false;
  this.anchorDebug=false;
  this.active={environment:false,props:false,decals:false};
  this.originalBackground=scene.background;
  this.originalFog=scene.fog;
 }
 report(message){
  if(typeof this.onNotice==='function')this.onNotice(message);
 }
 metrics(){
  if(typeof this.onCounts==='function'){
   this.onCounts({
    models:this.props?.instances??0,
    anchors:this.anchorDebug?(this.props?.anchorCount??0):0,
    modelTypes:this.props?.modelTypes??0,
    missingModels:this.props?.missing??0,
    decals:this.decals?.count??0,
    projectedDecals:this.decals?.projected??0,
    projectedTriangles:this.decals?.triangles??0,
    decalMaterials:this.decals?.materials??0,
    lightEntities:this.environment?.sourceLightCount??0,
    lights:this.environment?.activeLightCount??0,
    skybox:!!this.environment?.skybox
   });
  }
 }
 restoreLighting(){
  if(this.originalHemisphere)this.originalHemisphere.visible=!this.environment;
  if(this.originalSun)this.originalSun.visible=!this.environment;
  if(!this.environment){
   this.scene.background=this.originalBackground;
   this.scene.fog=this.originalFog;
  }
 }
 async switch(type,enabled){
  if(this.disposed)return;
  if(!['environment','props','decals'].includes(type))throw Error('Invalid native scenery layer '+type);
  const id=++this.requestIds[type];
  this.active[type]=enabled;
  if(!enabled){
   const old=this[type];
   this[type]=null;
   if(old)old.dispose();
   this.restoreLighting();
   this.metrics();
   this.report('SOURCE SCENERY: '+type+' hidden; all original file assets kept untouched.');
   return;
  }
  if(this[type]){
   this.restoreLighting();this.metrics();return;
  }
  this.report('Loading source-native '+type+' directly from the original MPZ entity positions…');
  try{
   let next;
   if(type==='environment')next=await createOctavusEnvironment(this.scene,this.tier);
   if(type==='props')next=await createOctavusProps(this.scene,this.tier);
   if(type==='decals')next=await createOctavusDecals(this.scene,this.tier,this.nativeGeometry);
   // Toggle may be switched off while async asset requests are pending.
   if(id!==this.requestIds[type]||!this.active[type]||this.disposed){
    next?.dispose();
    this.restoreLighting();return;
   }
   this[type]=next;
   if(type==='props')next.setAnchorMarkers?.(this.anchorDebug);
   this.restoreLighting();
   this.metrics();
   if(type==='environment')
    this.report('SOURCE ENVIRONMENT: '+next.sourceLightCount+' original authored MPZ light positions; Redcliff skybox '+(next.skybox?'LOADED':'UNAVAILABLE')+'. Runtime dynamic lights are capped for performance. Original baked lightmaps pending.');
   if(type==='props')
    this.report('SOURCE MAP MODELS: '+next.instances+' placed from MPZ positions, '+next.modelTypes+' original OBJ types. Missing '+next.missing+' unavailable source models. No synthetic substitutes.');
   if(type==='decals')
    this.report('SOURCE DECALS: '+next.projected+' of '+next.count+' original MPZ decals successfully projected onto '+next.triangles+' clipped world polygons; '+next.materials+' source textures, '+next.spatialCells+' spatial bins. '+next.ignoredUnverifiedPlainTriangles+' unverified plain-material source triangles excluded from decals ONLY; original map mesh untouched. Unmatched decals receive no floating substitute.');
  }catch(error){
   if(id!==this.requestIds[type])return;
   this.active[type]=false;
   const checkbox=$(type==='environment'?'source-env':type==='props'?'source-props':'source-decals');
   if(checkbox)checkbox.checked=false;
   this.report('SOURCE SCENERY ERROR ('+type+'): '+(error.message||String(error)));
   this.restoreLighting();this.metrics();
  }
 }
 animate(now,position){
  if(this.disposed||now-this.lastUpdate<.25)return;
  this.lastUpdate=now;
  // Focus target is the actual map position a user inspects.
  // Camera overview can be >150m away from the whole arena.
  const center=position&&Number.isFinite(position.x)?position:new THREE.Vector3();
  this.environment?.animate(now,center);
  this.props?.animate(now,center);
  this.metrics();
 }
 setNativeGeometry(geometry){
  if(geometry===this.nativeGeometry)return;
  this.nativeGeometry=geometry;
  if(this.active.decals){
   // Rebuild projectors against the NEW world, never leave decal faces
   // floating on geometry that has since been removed from scene.
   void this.switch('decals',false).then(()=>this.switch('decals',true));
  }
 }
 setAnchorDebug(enabled){
  this.anchorDebug=!!enabled;
  this.props?.setAnchorMarkers?.(this.anchorDebug);
  this.metrics();
  this.report(this.anchorDebug?'ALIGNMENT INSPECTION: cyan markers show exact original MPZ model anchors. Markers never shift the authored models.':'ALIGNMENT INSPECTION: original MPZ anchor markers hidden.');
 }
 setQuality(tier){
  if(!['auto','performance','high','ultra'].includes(tier))throw Error('Invalid scenic quality');
  this.tier=tier;
  this.environment?.setQuality(tier);
  this.props?.setQuality(tier);
  this.decals?.setQuality(tier);
 }
 dispose(){
  this.disposed=true;
  for(const type of ['environment','props','decals']){
   this.requestIds[type]++;
   this.active[type]=false;
   this[type]?.dispose();
   this[type]=null;
  }
  this.restoreLighting();
  this.metrics();
 }
}
