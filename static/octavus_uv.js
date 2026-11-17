/* Octavus Stage 1.2 — authored Wavefront texture coordinates, source-preserved.
 * Derived from Calinou/game-maps-obj/redeclipse/octavus.obj
 * blob ad408f0c35ffb98aa1c19d4fb01943decac3b8de.
 * Geometry/layout adaptation: CC BY-SA 3.0; see OCTAVUS_ATTRIBUTION.md.
 *
 * OCU1 layout: 4-byte magic; u32LE vtCount; u32LE triangleCount;
 * 2 float32LE components per original vt; 3 u24LE vt indices per face.
 * Faces are sorted by material slot in the same order as OCT1.
 * Keep all 65,636 original texture vertices, including their tiling ranges.
 */
const PARTS=11,VERTICES=65636,TRIANGLES=86500;
let pending=null;
const file=i=>'/static/maps/octavus_uv_'+String(i+1).padStart(2,'0')+'.b64';
export async function loadOctavusOriginalUV(){
 if(pending)return pending;
 pending=(async()=>{
  const responses=await Promise.all(Array.from({length:PARTS},(_,i)=>fetch(file(i))));
  if(responses.some(r=>!r.ok))throw Error('Octavus original UV map chunks are missing');
  const base64=(await Promise.all(responses.map(r=>r.text()))).join('').replace(/\s+/g,'');
  const decoded=atob(base64),bytes=new Uint8Array(decoded.length);
  for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
  const view=new DataView(bytes.buffer);
  const vertices=view.getUint32(4,true),triangles=view.getUint32(8,true);
  if(bytes[0]!==79||bytes[1]!==67||bytes[2]!==85||bytes[3]!==49||
     vertices!==VERTICES||triangles!==TRIANGLES||
     bytes.length!==12+VERTICES*8+TRIANGLES*9)
   throw Error('Octavus original UV format or data length is invalid');
  const coordinates=new Float32Array(VERTICES*2);
  let offset=12;
  for(let i=0;i<coordinates.length;i++){
   coordinates[i]=view.getFloat32(offset,true);offset+=4;
   if(!Number.isFinite(coordinates[i]))throw Error('Invalid Octavus source UV');
  }
  const indices=new Uint32Array(TRIANGLES*3);
  for(let i=0;i<indices.length;i++){
   const id=bytes[offset]|(bytes[offset+1]<<8)|(bytes[offset+2]<<16);
   if(id>=VERTICES)throw Error('Octavus source UV index out of range');
   indices[i]=id;offset+=3;
  }
  return {coordinates,indices,triangleCount:TRIANGLES,textureVertexCount:VERTICES,originalSource:true};
 })().catch(error=>{pending=null;throw error;});
 return pending;
}
