/**
 * CROSSFire 6.6: compressed static Dust Corridor scene loader.
 *
 * The authoritative MIT map generator runs ONCE at build time.
 * Chrome/Edge decode the packed original scene and full triangle soup using
 * native gzip streaming, without runtime procedural generation or UV changes.
 * No assets, architecture or props are removed at any quality setting.
 */
import * as THREE from 'three';

const SOURCE_TRIANGLES=96588;
const PACK_URI='/static/maps/dust_scene66.bin.gz';
const COLLISION_URI='/static/maps/dust_collision63.bin.gz';
const META_URI='/static/maps/dust_scene66.meta.json';
const formats={f32:Float32Array,i16:Int16Array,u8:Uint8Array,u16:Uint16Array,u32:Uint32Array};
let cache=null,loadedPromise=null;

const align4=n=>(n+3)&~3;

async function unzip(response){
 if(!response.ok)throw Error('Dust scene resource HTTP '+response.status);
 if(!response.body||typeof DecompressionStream!=='function')
  throw Error('Native gzip decoding unavailable on this browser');
 return await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
function asGeometry(buffer,start,row){
 const geometry=new THREE.BufferGeometry();
 for(const [name,desc] of Object.entries(row.attributes)){
  const Type=formats[desc.format];
  if(!Type||desc.count%desc.itemSize!==0)throw Error('Invalid packed attribute '+name);
  const location=start+desc.offset;
  if(location%Type.BYTES_PER_ELEMENT)throw Error('Misaligned packed attribute');
  const view=new Type(buffer,location,desc.count);
  geometry.setAttribute(name,new THREE.BufferAttribute(view,desc.itemSize,desc.normalized));
 }
 const d=row.index,Type=formats[d.format];
 if(!Type||d.count!==row.triangles*3)throw Error('Invalid packed indices');
 geometry.setIndex(new THREE.BufferAttribute(new Type(buffer,start+d.offset,d.count),1));
 if(geometry.getAttribute('position').count!==row.vertices)throw Error('Invalid source vertex count');
 geometry.computeBoundingSphere();
 geometry.computeBoundingBox();
 geometry.name=row.name;
 return geometry;
}
function unpackScene(raw,manifest,collision){
 const view=new DataView(raw);
 const magic=new TextDecoder().decode(new Uint8Array(raw,0,8));
 if(magic!=='DUSTPK66')throw Error('Dust scene package signature mismatch');
 const jsonLength=view.getUint32(8,true);
 if(jsonLength<100||jsonLength>raw.byteLength-12)throw Error('Bad scene package header');
 const desc=JSON.parse(new TextDecoder().decode(new Uint8Array(raw,12,jsonLength)));
 const offset=align4(12+jsonLength);
 if(desc.version!==66||desc.collisionSha256!==manifest.collisionSha256||
    desc.triangleCount!==SOURCE_TRIANGLES)throw Error('Dust scene version/hash mismatch');
 const total=desc.chunks.reduce((n,row)=>n+row.triangles,0);
 if(total!==desc.originalVisualTriangles||total!==manifest.originalVisualTriangles)
  throw Error('Source triangles have been removed from packed scene');
 const cmagic=new TextDecoder().decode(new Uint8Array(collision,0,8));
 if(cmagic!=='DUSTCOL3'||new DataView(collision).getUint32(8,true)!==SOURCE_TRIANGLES)
  throw Error('Original physics triangle soup mismatch');
 const normalsize=SOURCE_TRIANGLES*9;
 const physicsEnd=12+normalsize*4;
 if(collision.byteLength!==physicsEnd+SOURCE_TRIANGLES)
  throw Error('Original physics payload length mismatch');
 // Shared typed views; not cloned into a second giant ArrayBuffer.
 const soup={
  count:SOURCE_TRIANGLES,
  positions:new Float32Array(collision,12,normalsize),
  surfaces:new Uint8Array(collision,physicsEnd,SOURCE_TRIANGLES)
 };
 const revive=object=>{
  if(Array.isArray(object))return object.map(revive);
  if(object&&typeof object==='object'){
   const keys=Object.keys(object);
   if(keys.length===3&&['x','y','z'].every(k=>typeof object[k]==='number'))
    return new THREE.Vector3(object.x,object.y,object.z);
   return Object.fromEntries(keys.map(k=>[k,revive(object[k])]));
  }
  return object;
 };
 return {
  soup,
  triangleCount:SOURCE_TRIANGLES,
  visualTriangles:total,
  packed:true,
  chunkCount:desc.chunks.length,
  sourceBytes:raw.byteLength,
  transferBytes:manifest.gzipBytes,
  playBounds:desc.playBounds,
  buildings:desc.footprints,
  cloth:revive(desc.cloth),
  cables:revive(desc.cables),
  spawns:Object.fromEntries(Object.entries(desc.spawns).map(([side,points])=>[
   side,points.map(p=>new THREE.Vector3(...p))
  ])),
  // New BufferGeometry wrappers share the immutable packed views, but each
  // owns its GPU handles. Normal world.dispose() releases them safely.
  batches:desc.chunks.map(row=>({
   name:row.name,
   build(){return asGeometry(raw,offset,row);}
  }))
 };
}

async function fetchOriginalSource(expectedHash){
 if(!expectedHash)throw Error('Missing Dust collision source hash');
 // A missing bundle in a local dev checkout can still run the original map.
 const [metaResponse,sceneResponse,collisionResponse]=await Promise.all([
  fetch(META_URI),fetch(PACK_URI),fetch(COLLISION_URI)
 ]);
 if(metaResponse.status===404||sceneResponse.status===404){
  const {MapGenerator}=await import('./dust_corridor/src/world/MapGenerator.js');
  const source=new MapGenerator().generate();
  source.packed=false;source.chunkCount=source.batches.length;
  source.visualTriangles=source.batches.reduce((n,b)=>n+b.triangleCount,0);
  return source;
 }
 if(!metaResponse.ok)throw Error('Dust package metadata unavailable');
 const manifest=await metaResponse.json();
 if(manifest.collisionSha256!==expectedHash)
  throw Error('Dust package source does not match the live room');
 if(!globalThis.DecompressionStream){
  // Older browsers retain compatibility via the actual original generator;
  // never substitute blocks or simplified placeholder meshes.
  const {MapGenerator}=await import('./dust_corridor/src/world/MapGenerator.js');
  const source=new MapGenerator().generate();
  source.packed=false;source.chunkCount=source.batches.length;
  source.visualTriangles=source.batches.reduce((n,b)=>n+b.triangleCount,0);
  return source;
 }
 const [raw,collision]=await Promise.all([
  unzip(sceneResponse),unzip(collisionResponse)
 ]);
 const source=unpackScene(raw,manifest,collision);
 if(source.soup.count!==manifest.sourceTriangles)
  throw Error('Dust source triangles mismatch');
 return source;
}

export function loadDustSource66(hash){
 if(cache&&cache.hash===hash)return Promise.resolve(cache.source);
 if(loadedPromise&&loadedPromise.hash===hash)return loadedPromise.promise;
 const pending=fetchOriginalSource(hash).then(source=>{
  cache={hash,source};return source;
 }).catch(error=>{
  if(loadedPromise?.hash===hash)loadedPromise=null;
  throw error;
 });
 loadedPromise={hash,promise:pending};
 return pending;
}
export function getDustCacheStats66(){
 if(!cache)return {ready:false};
 const source=cache.source;
 return {ready:true,packed:source.packed,chunkCount:source.chunkCount,
  triangles:source.triangleCount,visualTriangles:source.visualTriangles,
  sourceBytes:source.sourceBytes||0,transferBytes:source.transferBytes||0};
}
