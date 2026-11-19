/* Octavus Stage 2.2: exact compact original r829 octree leaf lookup.
 * EMPTY=source empty cube, SOLID=original full cube, NORMAL=original
 * DEFORMED cube (needs exact edge-plane physics before gameplay).
 *
 * Uses the same binary OCO1 record and native XYZ coordinates as
 * Python scripts/build_octavus_occupancy96.py.
 * Not imported by static/game.js or live server.
 */
const ROOT='/static/maps/';
const ARCHIVE='octavus.native-occupancy96.bin.gz';
const MANIFEST='octavus.native-occupancy96.json';
const MAGIC='OCO1',RECORD_BYTES=21;
let cached=null;
const byteView=x=>x instanceof Uint8Array?x:new Uint8Array(x);
function compactKey(x,y,z){
 return x*67108864+y*8192+z; // 3 native 13-bit coordinates, exact JS int
}
export function decodeNativeOccupancy96(input,manifest){
 const bytes=byteView(input);
 if(bytes.byteLength<12)throw Error('Truncated original source octree occupancy');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(String.fromCharCode(...bytes.slice(0,4))!==MAGIC||
    view.getUint32(4,true)!==829)
   throw Error('Original native octree format/revision mismatch');
 if(manifest?.format!=='OCTAVUS-NATIVE-OCCUPANCY96'||
    manifest.status!=='staging-only-not-live'||
    manifest.liveMapModified!==false||
    manifest.fullSourceSolidCollisionReady!==false)
   throw Error('Native octree occupancy must remain staging-only');
 const count=view.getUint32(8,true);
 if(count!==manifest.occupancyCells||
    bytes.byteLength!==12+count*RECORD_BYTES)
   throw Error('Source native occupancy cube count/stride invalid');
 const maps=new Map(),byKind={empty:0,solid:0,deformed:0};
 const names={1:'empty',2:'solid',3:'deformed'};
 const kinds=new Uint8Array(count),origins=new Uint16Array(count*4);
 // The exact original kind numbering is read from manifest source
 // rather than guessed in the game. Empty/solid/normal flags originate
 // from Red Eclipse 2 octa.h and must match this r829 exporter.
 for(let i=0;i<count;i++){
  const row=12+i*RECORD_BYTES;
  const x=view.getUint16(row,true),y=view.getUint16(row+2,true),
        z=view.getUint16(row+4,true),size=view.getUint16(row+6,true),
        kind=view.getUint8(row+8);
  if(!size||size>4096||size&(size-1)||
     x>=8192||y>=8192||z>=8192||
     x%size||y%size||z%size||
     !(kind in names))
    throw Error('Invalid original source octree cube alignment or kind');
  if(!maps.has(size))maps.set(size,new Map());
  const index=compactKey(x,y,z),layer=maps.get(size);
  if(layer.has(index))throw Error('Duplicate native source octree origin');
  layer.set(index,i);
  origins.set([x,y,z,size],i*4);
  kinds[i]=kind;
  byKind[names[kind]]++;
 }
 for(const [kind,value]of Object.entries(byKind))
  if(value!==manifest.cellCounts[kind])
   throw Error('Native octree kind distribution differs from source manifest');
 const sizes=[...maps.keys()].sort((a,b)=>a-b);
 function lookup([x,y,z]){
  if([x,y,z].some(p=>p<0||p>=8192||!Number.isFinite(p)))return null;
  for(const size of sizes){
   const ix=Math.floor(x/size)*size,
         iy=Math.floor(y/size)*size,
         iz=Math.floor(z/size)*size;
   const cell=maps.get(size).get(compactKey(ix,iy,iz));
   if(cell===undefined)continue;
   const row=12+cell*RECORD_BYTES;
   return {
    kind:kinds[cell],
    origin:[origins[cell*4],origins[cell*4+1],origins[cell*4+2]],
    size,
    edgeBytes:bytes.slice(row+9,row+21),
    deformedUnresolved:kinds[cell]===3
   };
  }
  return null; // outside original-island export bounds
 }
 return {
  count,
  cellsByKind:byKind,
  sizes,
  lookup,
  scope:'original-native-source-cubes',
  gameCollisionReady:false,
  deformedCollisionProven:false
 };
}
async function hash256(bytes){
 const digest=await crypto.subtle.digest('SHA-256',byteView(bytes));
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function loadNativeOccupancy96(){
 if(cached)return cached;
 cached=(async()=>{
  const [metaResponse,archiveResponse]=await Promise.all([
   fetch(ROOT+MANIFEST,{cache:'no-cache'}),
   fetch(ROOT+ARCHIVE,{cache:'no-cache'})
  ]);
  if(!metaResponse.ok||!archiveResponse.ok)
   throw Error('Source-native occupancy pack is not published yet');
  const [manifest,compressed]=await Promise.all([
   metaResponse.json(),archiveResponse.arrayBuffer()
  ]);
  if(await hash256(compressed)!==manifest.compressedSha256)
   throw Error('Original native solid/empty octree pack SHA mismatch');
  if(!('DecompressionStream' in globalThis))
   throw Error('Browser cannot decompress original source occupancy pack');
  const raw=await new Response(
   new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))
  ).arrayBuffer();
  const index=decodeNativeOccupancy96(raw,manifest);
  return {index,manifest,validatedSha256:manifest.compressedSha256,
   originalOctreeParity:true,fullGameCollisionReady:false};
 })().catch(e=>{cached=null;throw e});
 return cached;
}
