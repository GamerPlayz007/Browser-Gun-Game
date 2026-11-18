/* Octavus Phase 1.8: authoritative orientation bridge from Red Eclipse 2
 * native XYZ (Z-up) into the source-native viewer's XYZ (Y-up).
 *
 * Original engine:
 *   src/engine/worldio.cpp: orient.rotate_around_z(yaw),
 *                            rotate_around_x(pitch),
 *                            rotate_around_y(-roll)
 *   src/engine/octarender.cpp: the same transform for decal projectors.
 *
 * Viewer source coordinate mapping (world size 8192):
 *   (native x, native y, native z) -> (x,z,y)
 * This mapping swaps two axes, so its determinant is NEGATIVE. Correct
 * angular signs are (-yaw around viewer Y, -pitch around viewer X,
 * +roll around viewer Z). The source OBJ basis must also be reflected:
 * just rotating an OBJ -90deg around X gives (x,z,-y), NOT (x,z,y).
 *
 * All transforms stay on source-derived diagnostic viewers. No live
 * map/game collisions, ent ids or source positions are changed.
 */
import * as THREE from 'three';

const RAD=Math.PI/180;
const DEG=180/Math.PI;
const finite=(n,fallback=0)=>Number.isFinite(Number(n))?Number(n):fallback;
const viewerWorldUnit=.05;

export function originalNativePosition(source){
 if(!Array.isArray(source)||source.length!==3||source.some(v=>!Number.isFinite(v))){
  throw Error('Invalid source-native XYZ map position');
 }
 return new THREE.Vector3(
  (source[0]-4096)*viewerWorldUnit,
  (source[2]-2816)*viewerWorldUnit,
  (source[1]-4096)*viewerWorldUnit
 );
}

export function octavusSourceQuaternion(yaw=0,pitch=0,roll=0){
 const y=finite(yaw)*RAD,p=finite(pitch)*RAD,r=finite(roll)*RAD;
 // Three.js Euler order YXZ: Q = Ry(-yaw) * Rx(-pitch) * Rz(roll).
 // This equals the native Rz(yaw) Rx(pitch) Ry(-roll) conjugated
 // through the negative-determinant coordinate transpose P.
 return new THREE.Quaternion().setFromEuler(new THREE.Euler(-p,-y,r,'YXZ'));
}

export function octavusModelNativeToViewer(prototype){
 // Source OBJ local vector (x,y,z) -> (x,z,y) before instance yaw etc.
 // Applying scale.y=-1 before Rx(-90deg) is the required reflection.
 // Rx(-90deg) alone gave (x,z,-y) and mirrored the placement direction.
 prototype.rotation.set(-Math.PI/2,0,0);
 prototype.scale.set(1,-1,1);
 return prototype;
}

export function originalDecalSize(attrs){
 const nativeSize=Math.max(1,finite(attrs?.[4],1));
 return nativeSize*viewerWorldUnit;
}

export function sourceEntityTransform(entry){
 const attrs=entry.attrs||[];
 return {
  id:entry.id,
  position:originalNativePosition(entry.sourcePosition),
  rotation:octavusSourceQuaternion(attrs[1],attrs[2],attrs[3]),
  nativeRadius:originalDecalSize(attrs),
 };
}

export const TRANSFORM_REVISION='MAPZ-v59-axis-bridge89';
