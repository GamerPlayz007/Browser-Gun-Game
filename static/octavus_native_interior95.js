/* Octavus Stage 2.2: source-native island collision proof across Python
 * and browser. This is a strict diagnostic decoder only. It is not
 * imported by the active multiplayer Octavus controller.
 *
 * Input is original reconstructed OCN2 + original MPZ derived island
 * geometry candidate, with SHA pinned to Python preflight.
 */
import {sourceNativePosition91} from './octavus_native_collision91.js';
const DIR='/static/maps/';
const META='octavus.native-interior93.json';
const REPORT='octavus.native-interior-preflight94.json';
const DATA='octavus.native-interior93.bin.gz';
let cached=null;
const signature=bytes=>String.fromCharCode(...bytes.slice(0,4));
const arrayOf=input=>input instanceof Uint8Array?input:new Uint8Array(input);
const digest=async input=>{
 const raw=arrayOf(input);
 const hash=await crypto.subtle.digest('SHA-256',raw);
 return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');
};
export function decodeInteriorNative95(input,meta){
 const bytes=arrayOf(input);
 if(signature(bytes)!=='OCN2')throw Error('Invalid source island OCN2 header');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const nv=view.getUint32(4,true),nt=view.getUint32(8,true);
 if(meta?.format!=='OCN2'||meta.status!=='staging-only-not-live'||
    meta.collisionScope!=='island-interior-candidate'||
    meta.nativeAuthoritativeCollisionReady!==false||
    meta.liveMapModified!==false)throw Error('Unverified native island collision scope');
 if(nv!==meta.vertices||nt!==meta.triangles||
    bytes.byteLength!==12+nv*12+nt*14)
    throw Error('Original island source collision binary is incomplete');
 if(nt<50000||nt>850000)throw Error('Suspicious source island collision count');
 const positions=new Float32Array(nt*9);
 const materialSlots=new Uint8Array(nt);
 const vertexStart=12,triangleStart=12+12*nv;
 let slotOne=0;
 for(let i=0;i<nt;i++){
  const row=triangleStart+14*i;
  const a=view.getUint32(row,true),b=view.getUint32(row+4,true),
        c=view.getUint32(row+8,true),slot=view.getUint16(row+12,true);
  if(Math.max(a,b,c)>=nv||slot>=223)throw Error('Invalid source island collision triangle');
  materialSlots[i]=slot;
  if(slot===1)slotOne++;
  let output=i*9;
  for(const v of [a,b,c]){
   const raw=[view.getUint32(vertexStart+12*v,true),
              view.getUint32(vertexStart+12*v+4,true),
              view.getUint32(vertexStart+12*v+8,true)];
   const xyz=sourceNativePosition91(...raw);
   positions[output++]=xyz[0];
   positions[output++]=xyz[1];
   positions[output++]=xyz[2];
  }
 }
 if(slotOne!==meta.retainedNativeSlotOneTriangles||
    nt-slotOne!==meta.detailedNativeTriangles)
   throw Error('Native source collision material budget drifted');
 return {
  triangleCount:nt,
  vertexCount:nv,
  plainSurfaceCandidates:slotOne,
  surfaces:materialSlots,
  positions,
  collisionReadyForGame:false,
  coordinateSystem:'native-source-XZY-to-Three-XYZ'
 };
}
async function fetchChecked(url){
 const response=await fetch(DIR+url,{cache:'no-cache'});
 if(!response.ok)throw Error('Source interior collision asset missing: '+url);
 return response;
}
export async function loadNativeInterior95(){
 if(cached)return cached;
 cached=(async()=>{
  const [mResponse,rResponse,bResponse]=await Promise.all([
   fetchChecked(META),fetchChecked(REPORT),fetchChecked(DATA)
  ]);
  const [meta,report,compressed]=await Promise.all([
   mResponse.json(),rResponse.json(),bResponse.arrayBuffer()
  ]);
  if(report?.format!=='OCTAVUS-NATIVE-INTERIOR-PREFLIGHT94'||
     report.status!=='staging-only-not-live'||
     report.physicallyCompleteInsideFootprint!==false||
     report.liveMapModified!==false)
    throw Error('Source collision survey has not passed staging gate');
  if(meta.sha256!==report.sourceCollisionSHA256||
     meta.sha256!==await digest(compressed))
    throw Error('Native source island archive SHA256 mismatch');
  if(!('DecompressionStream' in globalThis))
    throw Error('Browser must support gzip OCN2 decoding');
  const uncompressed=await new Response(
   new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))
  ).arrayBuffer();
  const candidate=decodeInteriorNative95(uncompressed,meta);
  const sha=await digest(candidate.positions.buffer);
  if(sha!==report.float32TriangleSoupSHA256)
   throw Error('Server/client native island collision Float32 coordinate parity failed');
  if(report.originalStartsExamined!==33||
     report.surveyCounts.totalNeighborSamplesInside<600)
   throw Error('Original source navigation preflight incomplete');
  return {candidate,meta,report,
   verifiedByteParity:true,
   sourceArchiveSha256:meta.sha256,
   collisionReadyForGame:false};
 })().catch(error=>{cached=null;throw error});
 return cached;
}
