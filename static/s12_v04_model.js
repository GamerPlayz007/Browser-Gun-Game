/**
 * CROSSFire S-12 v0.4: approved nonfunctional, decorative shotgun game model.
 * Uses the user's approved performance GLB, preserving its actual geometry
 * and embedded PBR textures. Does not change game damage, physics, or firing.
 */
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const S12_V04_ASSET = '/static/assets/crossfire-s12-v04-performance.glb';
const ART_SCALE = .33;
// Artist model: X along silhouette and Z up. Game: -Z forward, Y up.
// Rotate without a negative determinant, preserving triangle winding.
const AXIS = new T.Matrix4().set(
  0,-1, 0,0,
  0, 0, 1,0,
 -1, 0, 0,0,
  0, 0, 0,1
);
const AXIS_ROTATION = new T.Quaternion().setFromRotationMatrix(AXIS);
const PUMP_PART = /^(?:Handguard\/|V03\/Handguard|V04\/Handguard)/i;
let templatePromise;

function normalizePartGeometry(mesh){
  // Freeze transforms and retain the three vertex channels needed by the
  // original PBR material. This allows batching many individual details.
  const source = mesh.geometry.clone();
  source.applyMatrix4(mesh.matrixWorld);
  for(const key of Object.keys(source.attributes)){
    if(!['position','normal','uv'].includes(key))source.deleteAttribute(key);
  }
  if(!source.getAttribute('normal'))source.computeVertexNormals();
  if(!source.getAttribute('uv')){
    const count=source.getAttribute('position').count;
    source.setAttribute('uv',new T.BufferAttribute(new Float32Array(count*2),2));
  }
  if(!source.index)return source;
  const plain=source.toNonIndexed();source.dispose();return plain;
}

function orientedGroup(name){
  const root=new T.Group();root.name=name;
  root.quaternion.copy(AXIS_ROTATION);
  root.scale.setScalar(ART_SCALE);
  return root;
}

async function buildTemplate(){
  const response=await fetch(S12_V04_ASSET,{cache:'force-cache'});
  if(!response.ok)throw Error('S-12 v0.4 3D asset unavailable: HTTP '+response.status);
  const buffer=await response.arrayBuffer();
  if(buffer.byteLength<100000||buffer.byteLength>4_000_000)
    throw Error('Unexpected S-12 v0.4 model size: '+buffer.byteLength);
  const loader=new GLTFLoader();
  const gltf=await new Promise((ok,fail)=>loader.parse(buffer,
    new URL('.',new URL(S12_V04_ASSET,location.href)).href,ok,fail));
  const scene=gltf.scene;scene.updateMatrixWorld(true);
  const groups=new Map(),materials=new Map(),sourceGeometries=new Set();
  let pieces=0,triangles=0;
  scene.traverse(node=>{
    if(!node.isMesh)return;
    if(Array.isArray(node.material))throw Error('Unexpected multi-material S-12 mesh');
    sourceGeometries.add(node.geometry);
    const name=node.name||'S12 cosmetic';
    const moving=PUMP_PART.test(name);
    const id=node.material.uuid+':'+Number(moving);
    const geometry=normalizePartGeometry(node);
    triangles+=geometry.getAttribute('position').count/3;
    pieces++;
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push(geometry);
    materials.set(id,node.material);
  });
  if(pieces!==274||triangles!==9904)
    throw Error('S-12 v0.4 geometry validation failed: '+pieces+' parts / '+triangles+' triangles');
  const body=new T.Group(),pump=new T.Group();
  body.name='CROSSFIRE_S12_V04_BODY';
  pump.name='CROSSFIRE_S12_V04_PUMP';
  const bodyArt=orientedGroup('S12 v0.4 body art');
  const pumpArt=orientedGroup('S12 v0.4 moving cosmetic handguard');
  body.add(bodyArt);pump.add(pumpArt);
  for(const [key,items] of groups){
    const merged=mergeGeometries(items,false);
    items.forEach(g=>g.dispose());
    if(!merged)throw Error('S-12 v0.4 material batching failed: '+key);
    const mat=materials.get(key);
    const mesh=new T.Mesh(merged,mat);
    mesh.name='S-12 v0.4 / '+(mat.name||'PBR finish');
    mesh.userData.s12Shared=true;
    mesh.castShadow=mesh.receiveShadow=true;
    (key.endsWith(':1')?pumpArt:bodyArt).add(mesh);
  }
  sourceGeometries.forEach(g=>g.dispose());
  console.info('S-12 v0.4 cosmetic asset ready',{pieces,triangles,batches:groups.size,
    sourceBytes:buffer.byteLength});
  return {body,pump};
}
function template(){
  if(!templatePromise)templatePromise=buildTemplate().catch(e=>{templatePromise=null;throw e;});
  return templatePromise;
}
/** Attach to the existing animation rig (shotgun = weapon 2). */
export function attachS12V04(rig){
  const data=rig?.userData;
  if(!data||data.id!==2)return;
  template().then(art=>{
    if(data.s12Disposed)return;
    const body=art.body.clone(true),pump=art.pump.clone(true);
    data.aetherArtGun71.add(body,pump);
    data.action.pump=pump;
    // The original decorative muzzle is at source X +2.85.
    data.flash.position.set(0,.14*ART_SCALE,-2.85*ART_SCALE);
    data.s12Ready=true;
  }).catch(error=>{data.s12Error=String(error);console.error('S-12 v0.4 art failed',error);});
}