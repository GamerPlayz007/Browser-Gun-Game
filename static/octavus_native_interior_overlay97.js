/* Stage 2.2 native-source interior surface survey overlay.
 *
 * Source authored r829 floor probes from Python native collision audit;
 * no synthetic floors, no teleportation, no physics replacement.
 */
import * as THREE from 'three';
import {loadNativeOccupancy96} from './octavus_native_occupancy96.js';

const ROOT='/static/maps/';
const $=id=>document.getElementById(id);

async function fetchReport(){
 const response=await fetch(ROOT+'octavus.native-interior-preflight94.json',{cache:'no-cache'});
 if(!response.ok)throw Error('Native interior floor survey not published yet');
 const j=await response.json();
 if(j.format!=='OCTAVUS-NATIVE-INTERIOR-PREFLIGHT94'||
    j.status!=='staging-only-not-live'||j.liveMapModified!==false||
    j.physicallyCompleteInsideFootprint!==false||
    j.originalStartsExamined!==33||
    j.nearSpawnSurvey?.length<600)
  throw Error('Unverified original source collision survey');
 return j;
}
export class OctavusInteriorSurvey97 {
 constructor(scene){
  this.scene=scene;
  this.mesh=null;
  this.report=null;
  this.occupancy=null;
  this.visible=false;
  this.loading=null;
  this.geometry=null;
  this.material=null;
 }
 async enable(){
  if(this.mesh){this.mesh.visible=true;this.visible=true;return this.stats()}
  if(this.loading)return this.loading;
  this.loading=this._initialize().finally(()=>{this.loading=null});
  return this.loading;
 }
 async _initialize(){
  // The source octree is decoded and SHA256 validated at runtime,
  // not just represented as a count in a static report.
  const [report,occ]=await Promise.all([fetchReport(),loadNativeOccupancy96()]);
  if(!occ.originalOctreeParity||!occ.validatedSha256)
   throw Error('Original source octree source parity check missing');
  if(report.sourceRevision!==undefined&&report.sourceRevision!==829)
   throw Error('Wrong original native Red Eclipse revision');
  const points=report.nearSpawnSurvey;
  const geom=new THREE.IcosahedronGeometry(.22,0);
  const mat=new THREE.MeshBasicMaterial({
   transparent:true,opacity:.95,depthTest:false,depthWrite:false,
   vertexColors:false
  });
  const mesh=new THREE.InstancedMesh(geom,mat,points.length);
  mesh.name='Octavus original native interior floor probe QA: 775 source positions';
  mesh.renderOrder=105;
  mesh.frustumCulled=false;
  const p=new THREE.Object3D();
  const color=new THREE.Color();
  const categoryCounts={supported:0,missing:0,newlyRecovered:0,sourcePlain:0,farFromReference:0};
  for(let i=0;i<points.length;i++){
   const entry=points[i],delta=entry.newFloorHeightDelta;
   const good=delta!==null&&delta>=-.65&&delta<=.8;
   if(!entry.newFloorFound){
    color.set('#fb697c');categoryCounts.missing++;
   }else if(!entry.oldFloorFound){
    color.set('#30ddf1');categoryCounts.newlyRecovered++;
   }else if(entry.newFloorSlot===1){
    color.set('#d38dff');categoryCounts.sourcePlain++;
   }else if(good){
    color.set('#5cffa6');categoryCounts.supported++;
   }else{
    color.set('#ffc978');categoryCounts.farFromReference++;
   }
   const x=entry.worldXZ[0],z=entry.worldXZ[1];
   const y=entry.referenceSourceY+(entry.newFloorFound?delta:0);
   p.position.set(x,y+.42,z);
   p.rotation.set(0,0,0);p.scale.setScalar(1);
   p.updateMatrix();
   mesh.setMatrixAt(i,p.matrix);
   mesh.setColorAt(i,color);
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.userData.referenceSha=report.sourceCollisionSHA256;
  mesh.userData.originalSourceCount=33;
  mesh.userData.visualParityProven=false;
  this.scene.add(mesh);
  this.mesh=mesh;this.geometry=geom;this.material=mat;
  this.report=report;this.occupancy=occ;
  this.visible=true;mesh.visible=true;
  return this.stats();
 }
 stats(){
  const j=this.report,o=this.occupancy;
  return {
   samples:j.nearSpawnSurvey.length,
   nearGround:j.surveyCounts.neighborSamplesWithNearbyFloor,
   totalGround:j.surveyCounts.neighborSamplesWithFloor,
   extra:j.surveyCounts.newlyFoundFloorOverCore,
   plain:j.surveyCounts.neighborSamplesOnSlot1,
   originalStarts:j.originalStartsExamined,
   nativeCells:o.index.count,
   solidCells:o.index.cellsByKind.solid,
   emptyCells:o.index.cellsByKind.empty,
   deformedCells:o.index.cellsByKind.deformed,
   originalOccupancyByteVerified:o.originalOctreeParity,
   gameCollisionReady:false
  };
 }
 disable(){
  this.visible=false;
  if(this.mesh)this.mesh.visible=false;
 }
 dispose(){
  this.disable();
  this.mesh?.removeFromParent();
  this.geometry?.dispose();
  this.material?.dispose();
  this.mesh=null;this.geometry=null;this.material=null;
 }
}
