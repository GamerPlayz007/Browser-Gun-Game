/**
 * CROSSFire SMG-05 v0.2 game-art integration.
 * Exact approved nonfunctional exterior mesh, with resized source PBR textures.
 * Only renders cosmetics: no server-authoritative combat, weapon logic or physics.
 */
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SMG05_MESH_BASE64} from './smg05_v02_mesh_data.js';
import {SMG05_PBR96_BASE64, SMG05_TEXTURE_SIZE} from './smg05_v02_texture_data.js';

const ART_SCALE=.27;
const FRONT_BACK_CENTER_X=3.62;
let templatePromise;

async function inflateBase64(source){
 if(typeof DecompressionStream==='undefined')throw Error('Compressed SMG-05 artwork requires DecompressionStream');
 const bytes=Uint8Array.from(atob(source.replace(/\s+/g,'')),char=>char.charCodeAt(0));
 return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
}
function imageTexture(bytes,offset,size,isColor=false){
 const amount=size*size*4;
 const pixels=new Uint8Array(amount);
 pixels.set(bytes.subarray(offset,offset+amount));
 const tex=new T.DataTexture(pixels,size,size,T.RGBAFormat,T.UnsignedByteType);
 tex.name='SMG-05 v0.2 PBR';
 tex.needsUpdate=true;
 tex.flipY=false;
 tex.wrapS=tex.wrapT=T.RepeatWrapping;
 tex.anisotropy=2;
 if(isColor)tex.colorSpace=T.SRGBColorSpace;
 return tex;
}
async function makeMaterials(names){
 const bytes=new Uint8Array(await inflateBase64(SMG05_PBR96_BASE64));
 const size=SMG05_TEXTURE_SIZE;
 const stride=size*size*4;
 if(bytes.byteLength!==names.length*3*stride)throw Error('SMG-05 material asset length mismatch');
 return names.map((name,i)=>{
  const o=i*3*stride;
  const base=imageTexture(bytes,o,size,true),
    mr=imageTexture(bytes,o+stride,size),
    normal=imageTexture(bytes,o+2*stride,size);
  const mat=new T.MeshStandardMaterial({
   name:'SMG05_v02_'+name,
   map:base,metalnessMap:mr,roughnessMap:mr,normalMap:normal,
   metalness:1,roughness:1,side:T.DoubleSide,
   normalScale:new T.Vector2(.37,.37),
   transparent:name==='CF_branding_plate',
   depthWrite:name!=='CF_branding_plate'
  });
  return mat;
 });
}
function partGeometry(part,scale){
 const raw=part.v;
 if(!Array.isArray(raw)||raw.length%3!==0||!Array.isArray(part.f)||part.f.length%3!==0)
  throw Error('SMG-05 part contains invalid vertex or face data: '+part.n);
 const count=raw.length/3;
 const positions=new Float32Array(raw.length),uvs=new Float32Array(count*2);
 // Geometry source is X-long, Y-depth, Z-up. Map to -Z-forward / Y-up.
 const mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];
 for(let v=0;v<count;v++){
  const i=v*3,x=raw[i]/scale,y=raw[i+1]/scale,z=raw[i+2]/scale;
  positions[i]=y*ART_SCALE;
  positions[i+1]=z*ART_SCALE;
  positions[i+2]=(x-FRONT_BACK_CENTER_X)*ART_SCALE;
  for(const [k,value] of [[0,x],[1,y],[2,z]]){mins[k]=Math.min(mins[k],value);maxs[k]=Math.max(maxs[k],value);}
 }
 const axes=[0,1,2].sort((a,b)=>(maxs[b]-mins[b])-(maxs[a]-mins[a]));
 for(let v=0;v<count;v++){
  const i=v*3;
  for(let t=0;t<2;t++){
   const k=axes[t];
   const source=raw[i+k]/scale;
   uvs[v*2+t]=(source-mins[k])/Math.max(.05,maxs[k]-mins[k]);
  }
 }
 const faces=new Uint16Array(part.f);
 for(const f of faces)if(f>=count)throw Error('SMG-05 invalid triangle index');
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.BufferAttribute(positions,3));
 geometry.setAttribute('uv',new T.BufferAttribute(uvs,2));
 geometry.setIndex(new T.BufferAttribute(faces,1));
 geometry.computeVertexNormals();
 return geometry;
}
async function buildTemplate(){
 const [buffer]=await Promise.all([inflateBase64(SMG05_MESH_BASE64)]);
 const info=JSON.parse(new TextDecoder().decode(buffer));
 if(info.scale!==1000||!Array.isArray(info.meshes)||info.meshes.length!==157||info.materials.length!==15)
  throw Error('SMG-05 v0.2 mesh validation failed');
 const materials=await makeMaterials(info.materials);
 const buckets=new Map();let triangles=0;
 for(const part of info.meshes){
  const isMag=part.n.startsWith('magazine_');
  const key=part.m+':'+Number(isMag);
  const geometry=partGeometry(part,info.scale);
  triangles+=geometry.index.count/3;
  if(!buckets.has(key))buckets.set(key,[]);
  buckets.get(key).push(geometry);
 }
 if(triangles!==10542)throw Error('SMG-05 geometry triangles changed unexpectedly: '+triangles);
 const body=new T.Group(),magazine=new T.Group();
 body.name='CROSSFIRE_SMG05_V02_BODY';
 magazine.name='CROSSFIRE_SMG05_V02_MAGAZINE';
 for(const [key,parts] of buckets){
  const [matId,magFlag]=key.split(':').map(Number);
  const combined=mergeGeometries(parts,false);
  for(const geo of parts)geo.dispose();
  if(!combined)throw Error('SMG-05 mesh batch failed: '+key);
  const mesh=new T.Mesh(combined,materials[matId]);
  mesh.name='SMG-05 v0.2 / '+info.materials[matId];
  mesh.userData.smg05Shared=true;
  mesh.castShadow=mesh.receiveShadow=true;
  (magFlag?magazine:body).add(mesh);
 }
 console.info('CROSSFire SMG-05 v0.2 geometry ready', {pieces:157,triangles,drawBatches:buckets.size});
 return {body,magazine,triangles,materials};
}
function getTemplate(){
 if(!templatePromise)templatePromise=buildTemplate().catch(error=>{templatePromise=null;throw error;});
 return templatePromise;
}
/** Attach approved art to existing weapon rig without changing its animations or damage. */
export function attachSMG05V02(rig){
 if(rig?.userData?.id!==1)return;
 const d=rig.userData;
 getTemplate().then(art=>{
  if(d.smg05Disposed)return;
  const body=art.body.clone(true),mag=art.magazine.clone(true);
  d.aetherArtGun71.add(body);
  // The game's default magazine group position is animated to (0,-.1,-.035).
  // These compensating offsets preserve the model's original resting position.
  mag.position.set(0,.10,.035);
  d.magazine.add(mag);
  d.flash.position.set(0,.10,(.08-FRONT_BACK_CENTER_X)*ART_SCALE);
  d.smg05Ready=true;
 }).catch(error=>{d.smg05Error=String(error);console.error('SMG-05 art loading failed',error);});
}