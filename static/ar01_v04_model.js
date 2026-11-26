/**
 * CROSSFire AR-01 v0.4 exterior: 229 source shape operations, lightweight
 * browser reconstruction. The art is cosmetic and has no gameplay authority.
 * Existing ammo, damage, collision, reload timing and network logic are unchanged.
 */
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {AR04_RECIPE_BASE64} from './ar01_v04_data.js';

const SWATCHES = [
 [61,70,74,.44,.87],[49,58,62,.51,.85],[91,97,96,.35,.84],
 [38,44,47,.41,.9],[71,80,79,.42,.8],[18,24,27,.68,.74],
 [104,107,102,.37,.94],[114,114,104,.43,.83],[48,54,56,.44,.86],
 [127,116,96,.76,.04],[36,41,42,.87,.01],[65,69,65,.76,.04],
 [124,113,93,.86,.02],[52,61,63,.46,.86],[80,88,90,.36,.93],
 [38,46,51,.28,.96],[39,48,50,.5,.8],[62,58,53,.39,.95],
 [50,55,51,.86,.02],[29,34,37,.82,.1],[128,116,96,.71,.12],
 [68,70,68,.71,.12],[82,84,77,.42,.9],[123,113,95,.46,.84],
 [121,111,92,.41,.9],[49,57,61,.46,.84],[73,79,82,.37,.87],
 [38,94,113,.16,.14]
];
const MATERIAL_NAMES = [
 'receiver_anodized','lower_anodized','receiver_spine','handguard_rail',
 'receiver_inlay','receiver_recess','fastener_steel','marking_steel',
 'stock_support','tan_stock','rubber_butt','polymer_stock','tan_grip',
 'handguard_armor','rail_teeth','barrel_steel','iron_sight','muzzle_treated',
 'polymer_grip','mag_base','tan_mag','polymer_mag','optic_mount','tan_optic',
 'tan_rail','optic_housing','optic_rims','optic_lens'
];
const S = .46; // blockout units -> local first-person weapon scale
const MAPPING = new T.Matrix4();
let templatePromise = null;

function mapPoint(p){
  // Source artwork is X-forward / Z-up; game weapon is -Z-forward / Y-up.
  return new T.Vector3(p[1],p[2],-p[0]);
}
function seedNoise(seed){
 let state=(seed+1)*2654435761>>>0;
 return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296};
}
function makeMaterials(){
 return SWATCHES.map((a,i)=>{
  // GPU-uploadable noise texture, without a canvas or DOM dependency.
  const pixels=new Uint8Array(64*64*4);
  const rand=seedNoise(i*19+7);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
   const j=(y*64+x)*4;
   const grain=(rand()-.5)*16 + (i%5===0?Math.sin(y*.41)*2:0);
   for(let k=0;k<3;k++)pixels[j+k]=Math.max(0,Math.min(255,a[k]+grain));
   pixels[j+3]=255;
  }
  const tex=new T.DataTexture(pixels,64,64,T.RGBAFormat);
  tex.needsUpdate=true;tex.colorSpace=T.SRGBColorSpace;
  tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=2;
  const mat=new T.MeshStandardMaterial({
   map:tex,metalness:a[4],roughness:a[3],side:T.DoubleSide
  });
  if(i===27){mat.transparent=true;mat.opacity=.88;mat.emissive.setHex(0x05232e);}
  mat.name='AR01_v04_'+MATERIAL_NAMES[i];
  return mat;
 });
}
function outline(coords){
 const s=new T.Shape();
 for(let i=0;i<coords.length;i++){
  const p=coords[i];
  if(i===0)s.moveTo(p[0],p[1]);else s.lineTo(p[0],p[1]);
 }
 s.closePath();return s;
}
function extrude(coords,holes,half,y,bevel=0){
 const shape=outline(coords);
 for(const poly of holes){
  const path=new T.Path();
  const clockwise=points=>T.ShapeUtils.isClockWise(points.map(p=>new T.Vector2(p[0],p[1])));
  const reverse=clockwise(poly)===clockwise(coords);
  const points=reverse?[...poly].reverse():poly;
  for(let i=0;i<points.length;i++){
   const p=points[i];if(i===0)path.moveTo(p[0],p[1]);else path.lineTo(p[0],p[1]);
  }
  path.closePath();shape.holes.push(path);
 }
 const enableBevel=bevel>.001;
 const g=new T.ExtrudeGeometry(shape,{depth:half*2,steps:1,curveSegments:8,
  bevelEnabled:enableBevel,bevelThickness:Math.min(half*.22,bevel*.55),
  bevelSize:Math.min(.012,bevel*.40),bevelSegments:2});
 // (sourceX, sourceZ, sourceY) => (gameX,gameY,gameZ)
 MAPPING.set(0,0,1,y-half, 0,1,0,0, -1,0,0,0, 0,0,0,1);
 g.applyMatrix4(MAPPING);return g;
}
function orientCylinder(g,p,axis){
 const direction=axis==='x'?new T.Vector3(0,0,-1):
                 axis==='y'?new T.Vector3(1,0,0):new T.Vector3(0,1,0);
 g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction));
 g.translate(...mapPoint(p).toArray());return g;
}
function makeGeometry(op){
 const type=op[0];
 if(type==='p')return extrude(op[2],[],op[3],op[4],op[6]);
 if(type==='h')return extrude(op[2],op[3],op[4],op[5]);
 if(type==='b'){
  const c=mapPoint(op[2]),s=op[3];
  const g=new T.BoxGeometry(s[1],s[2],s[0]);
  g.translate(c.x,c.y,c.z);return g;
 }
 if(type==='c'){
  const g=new T.CylinderGeometry(op[3],op[3],op[4],op[6],1,false);
  return orientCylinder(g,op[2],op[5]);
 }
 if(type==='d'){
  const a=mapPoint(op[2]),b=mapPoint(op[3]),diff=b.clone().sub(a);
  const g=new T.CylinderGeometry(op[4],op[4],diff.length(),op[5]);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),diff.normalize()));
  g.translate(...a.add(b).multiplyScalar(.5).toArray());return g;
 }
 if(type==='r'){
  // Decorative hollow collar, rather than a solid disc.
  const outer=op[3],inner=op[4],width=op[5];
  const shape=new T.Shape();shape.absarc(0,0,outer,0,Math.PI*2,false);
  const hole=new T.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole);
  const g=new T.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false,curveSegments:op[7]});
  g.translate(0,0,-width/2);
  const direction=op[6]==='x'?new T.Vector3(0,0,-1):
                  op[6]==='y'?new T.Vector3(1,0,0):new T.Vector3(0,1,0);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),direction));
  g.translate(...mapPoint(op[2]).toArray());return g;
 }
 throw Error('Unexpected AR art primitive '+type);
}
async function decodeRecipe(){
 if(typeof DecompressionStream==='undefined')
  throw Error('This browser does not support the compressed art loader.');
 const encoded=Uint8Array.from(atob(AR04_RECIPE_BASE64),c=>c.charCodeAt(0));
 const decoded=await new Response(
  new Blob([encoded]).stream().pipeThrough(new DecompressionStream('deflate'))
 ).json();
 if(!Array.isArray(decoded)||decoded.length!==229)
  throw Error('AR-01 v0.4 asset data failed validation');
 return decoded;
}
async function makeTemplate(){
 const ops=await decodeRecipe(), mats=makeMaterials();
 const buckets=new Map();
 let triangleCount=0;
 for(const op of ops){
  const id=op[1],isMagazine=op[op.length-1]===1;
  const bucketKey=id+':'+(isMagazine?1:0);
  let g;
  try{g=makeGeometry(op);}catch(e){console.warn('AR-01 art piece omitted',e);continue;}
  if(g.index){const plain=g.toNonIndexed();g.dispose();g=plain;}
  triangleCount+=g.attributes.position.count/3;
  if(!buckets.has(bucketKey))buckets.set(bucketKey,[]);
  buckets.get(bucketKey).push(g);
 }
 const body=new T.Group(),magazine=new T.Group();
 for(const [key,parts] of buckets){
  const [id,mag]=key.split(':').map(Number);
  const combined=mergeGeometries(parts,false);
  for(const part of parts)part.dispose();
  if(!combined)throw Error('Unable to batch AR-01 cosmetic geometry');
  const mesh=new T.Mesh(combined,mats[id]);
  mesh.name='AR-01 v0.4 / '+MATERIAL_NAMES[id];
  mesh.userData.ar04Shared=true;
  mesh.castShadow=true;
  (mag?magazine:body).add(mesh);
 }
 body.name='CROSSFIRE_AR01_V04_BODY';
 magazine.name='CROSSFIRE_AR01_V04_MAGAZINE';
 console.info('AR-01 v0.4 cosmetic loaded', {pieces:ops.length,triangles:triangleCount,batches:buckets.size});
 return {body,magazine};
}
function getTemplate(){
 if(!templatePromise)templatePromise=makeTemplate().catch(err=>{templatePromise=null;throw err});
 return templatePromise;
}
export function attachAR01V04(rig){
 if(!rig?.userData||rig.userData.id!==0)return;
 const d=rig.userData;
 // No previous AR geometry is created. The game gets one immutable art design.
 getTemplate().then(asset=>{
  if(d.ar04Disposed)return;
  const gun=d.aetherArtGun71;
  const body=asset.body.clone(true);body.scale.setScalar(S);
  const mag=asset.magazine.clone(true);mag.scale.setScalar(S);
  // Magazine prop follows the existing game's cosmetic reload animation.
  mag.position.set(0,.10,.035);
  gun.add(body);d.magazine.add(mag);
  d.flash.position.set(0,.292*S,-2.32*S);
  d.ar04Ready=true;
 }).catch(error=>console.error('AR-01 v0.4 art failed',error));
}
