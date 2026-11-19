/* CROSSFire Octavus Phase 2.0: shared ORIGINAL source-native OCN2
 * collision-pilot decoder, strictly separate from the live game.
 *
 * Both this module and Python octavus_native_collision91.py consume the
 * SAME pinned SHA-256 Red Eclipse r829 architectural-core file, with
 * the same world transform and identical IEEE754 Float32 triangle soup.
 *
 * 98,358 source triangles are a provisional architecture subset,
 * NOT the full 863,803-triangle visual map. Missing material slot 1,
 * source model collisions, and real motion parity remain to validate.
 */
const ROOT='/static/maps/';
const FORMAT='OCTAVUS-NATIVE-COLLISION-PILOT91';
const CORE='octavus.native-core.bin.gz';
const META='octavus.native-core.json';
const REPORT='octavus.native-collision-preflight91.json';
const SCALE=.05;
const NATIVE_CENTER_X=4096,NATIVE_CENTER_Y=4096,NATIVE_CENTER_Z=2816;
let cached=null;

export function sourceNativePosition91(x,y,z){
 return [(x/8-NATIVE_CENTER_X)*SCALE,
         (z/8-NATIVE_CENTER_Z)*SCALE,
         (y/8-NATIVE_CENTER_Y)*SCALE];
}
function byteView(input){
 if(input instanceof Uint8Array)return input;
 if(input instanceof ArrayBuffer)return new Uint8Array(input);
 throw Error('Expected binary OCN2 native source archive');
}
export function decodeNativeCollision91(input,manifest){
 const bytes=byteView(input);
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.byteLength<12||
    String.fromCharCode(...bytes.slice(0,4))!=='OCN2')
  throw Error('Invalid source OCN2 header');
 const nv=view.getUint32(4,true),nt=view.getUint32(8,true);
 if(nv!==123915||nt!==98358||
    nv!==manifest.vertices||nt!==manifest.triangles){
  throw Error('Source-native architecture counts do not match pinned manifest');
 }
 if(bytes.byteLength!==12+nv*12+nt*14)
  throw Error('Original native architecture binary truncated or oversized');
 if(manifest.excludedMaterial!==1||manifest.status!=='staging-only-not-live')
  throw Error('This native collision prototype cannot be promoted to live gameplay');
 const vertexDataStart=12;
 const indexDataStart=12+12*nv;
 const positions=new Float32Array(nt*9);
 const surfaces=new Uint8Array(nt);
 const materialCounts=new Map();
 const vertex=(i,dimension)=>view.getUint32(vertexDataStart+12*i+dimension*4,true);
 for(let tri=0;tri<nt;tri++){
  const k=indexDataStart+tri*14;
  const ia=view.getUint32(k,true),ib=view.getUint32(k+4,true),
        ic=view.getUint32(k+8,true),slot=view.getUint16(k+12,true);
  if(ia>=nv||ib>=nv||ic>=nv||slot>255)
   throw Error('Original native collision invalid index/material');
  if(slot===1)
   throw Error('This native collision candidate intentionally excludes uncertain plain slot 1');
  let p=tri*9;
  for(const index of [ia,ib,ic]){
   const world=sourceNativePosition91(vertex(index,0),vertex(index,1),vertex(index,2));
   positions[p++]=world[0];
   positions[p++]=world[1];
   positions[p++]=world[2];
  }
  surfaces[tri]=slot;
  materialCounts.set(slot,(materialCounts.get(slot)||0)+1);
 }
 const expectedMaterials=manifest.triangleMaterials||{};
 for(const [slot,count] of Object.entries(expectedMaterials)){
  if(materialCounts.get(Number(slot))!==count)
   throw Error('Native collision material identity changed at slot '+slot);
 }
 return {
  soup:{count:nt,positions,surfaces},
  vertexCount:nv,
  triangleCount:nt,
  materialCounts,
  sourceScale:SCALE,
  sourceArchiveSha256:manifest.sha256,
  coordinateSystem:'native-source-XZY-to-Three-XYZ',
  nativeOctavus:true,
  sourcePilotOnly:true,
  collisionReadyForGame:false,
  missingNativeMaterialSlot:1
 };
}
async function sha256(input){
 const b=byteView(input);
 const digest=await crypto.subtle.digest('SHA-256',b);
 return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function loadNativeCollision91(){
 if(cached)return cached;
 cached=(async()=>{
  const [metaResponse,binResponse,reportResponse]=await Promise.all([
   fetch(ROOT+META),fetch(ROOT+CORE),fetch(ROOT+REPORT)
  ]);
  if(!metaResponse.ok||!binResponse.ok||!reportResponse.ok)
   throw Error('Source collision pilot assets not published on this deployment');
  const [manifest,compressed,report]=await Promise.all([
   metaResponse.json(),binResponse.arrayBuffer(),reportResponse.json()
  ]);
  if(report.format!==FORMAT||report.status!=='staging-only-not-live'||
     report.liveMapModified!==false||report.collisionCandidateHasOriginalSlot1Floor!==false){
    throw Error('Native collision report is not a verified staging-only contract');
  }
  if(await sha256(compressed)!==manifest.sha256||
     manifest.sha256!==report.sourceSHA256)
    throw Error('Original native collision archive SHA256 mismatch');
  if(!('DecompressionStream' in globalThis))
    throw Error('This browser does not support source OCN2 gzip decompression');
  const decoded=await new Response(
   new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))
  ).arrayBuffer();
  const candidate=decodeNativeCollision91(decoded,manifest);
  if(await sha256(candidate.soup.positions.buffer)!==report.float32TriangleSoupSHA256)
   throw Error('Python/JS source-native collision coordinates do not match');
  return {...candidate,
    validatedFloat32Checksum:report.float32TriangleSoupSHA256,
    spawnPreflightCounts:report.spawnPreflightCounts,
    originalStarts:report.sourceSpawns};
 })().catch(error=>{cached=null;throw error});
 return cached;
}
