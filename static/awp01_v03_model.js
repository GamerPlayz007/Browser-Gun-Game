/**
 * CROSSFire AWP-01 v0.3 — approved, nonfunctional 3D sniper cosmetic.
 * The original GLB stays byte-for-byte identical to the Workshop asset.
 * Animation and multiplayer rules live in the existing shared game engine.
 */
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const AWP01_V03_ASSET='/static/assets/CROSSFIRE_AWP_ReferenceInspired_v03.glb';
export const AWP01_V03_BYTES=4682872;
const MODEL_LENGTH=1.67; // scene-space display sizing, unrelated to gameplay physics
const MIN_PARTS=396;
let cachedTemplate=null;

function partGeometry(mesh){
 const geometry=mesh.geometry.clone();
 geometry.applyMatrix4(mesh.matrixWorld);
 for(const name of Object.keys(geometry.attributes))
  if(!['position','normal','uv'].includes(name))geometry.deleteAttribute(name);
 if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();
 if(!geometry.getAttribute('uv')){
  const count=geometry.getAttribute('position').count;
  geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(count*2),2));
 }
 if(!geometry.index)return geometry;
 const flat=geometry.toNonIndexed();geometry.dispose();return flat;
}
async function loadOriginal(){
 const response=await fetch(AWP01_V03_ASSET,{cache:'force-cache'});
 if(!response.ok)throw Error('AWP-01 v0.3 artwork could not load: HTTP '+response.status);
 const buffer=await response.arrayBuffer();
 if(buffer.byteLength!==AWP01_V03_BYTES)
  throw Error('Unexpected AWP-01 artwork size: '+buffer.byteLength);
 return new Promise((resolve,reject)=>new GLTFLoader().parse(buffer,
  new URL('.',new URL(AWP01_V03_ASSET,location.href)).href,resolve,reject));
}
async function buildTemplate(){
 const gltf=await loadOriginal();
 gltf.scene.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(gltf.scene);
 const width=bounds.max.x-bounds.min.x;
 if(!Number.isFinite(width)||width<1)throw Error('Invalid AWP-01 scene dimensions');
 const batches=new Map(),sourceGeometries=new Set(),sourceMaterials=new Map();
 let parts=0,triangles=0;
 gltf.scene.traverse(node=>{
  if(!node.isMesh)return;
  if(Array.isArray(node.material))throw Error('Unexpected AWP-01 multi-material mesh');
  sourceGeometries.add(node.geometry);
  const material=node.material;
  const geometry=partGeometry(node);
  parts++;
  triangles+=geometry.getAttribute('position').count/3;
  const group=material.uuid;
  if(!batches.has(group))batches.set(group,[]);
  batches.get(group).push(geometry);
  sourceMaterials.set(group,material);
 });
 if(parts!==MIN_PARTS||triangles<25000||triangles>40000)
  throw Error('AWP-01 v0.3 identity check failed: '+parts+' meshes / '+triangles+' triangles');
 const center=bounds.getCenter(new T.Vector3());
 const scene=new T.Group();scene.name='AWP-01 v0.3 / decorative original';
 const art=new T.Group();art.name='AWP-01 artwork / -X converted to -Z';
 art.rotation.y=-Math.PI/2;
 art.scale.setScalar(MODEL_LENGTH/width);
 art.position.set(0,.11,-.10);
 const centering=new T.Group();centering.position.copy(center).negate();
 scene.add(art);art.add(centering);
 for(const [key,items] of batches){
  const merged=mergeGeometries(items,false);
  items.forEach(g=>g.dispose());
  if(!merged)throw Error('AWP-01 batching failed: '+key);
  const mesh=new T.Mesh(merged,sourceMaterials.get(key));
  mesh.userData.awp03Shared=true;
  mesh.name='AWP-01 v0.3 / '+(mesh.material.name||'surface');
  mesh.castShadow=true;mesh.receiveShadow=true;
  centering.add(mesh);
 }
 sourceGeometries.forEach(g=>g.dispose());
 console.info('AWP-01 v0.3 exact GLB ready',{parts,triangles,drawCalls:batches.size,bytes:bufferByteCount()});
 return scene;
}
function bufferByteCount(){return AWP01_V03_BYTES;}
function template(){
 if(!cachedTemplate)cachedTemplate=buildTemplate().catch(e=>{cachedTemplate=null;throw e;});
 return cachedTemplate;
}
/** The shared game rig remains responsible for all existing motion/position. */
export function attachAWP01V03(rig){
 const d=rig?.userData;
 if(!d||d.id!==3)return;
 // Node CI tests must not attempt real browser asset I/O.
 if(typeof window==='undefined'||typeof location==='undefined')return;
 template().then(original=>{
  if(d.awp03Disposed)return;
  const art=original.clone(true);
  d.aetherArtGun71.add(art);
  d.awp03Ready=true;
 }).catch(error=>{
  d.awp03Error=String(error);
  console.warn('AWP-01 v0.3 cosmetic unavailable',error);
 });
}
