/** Stage 6.6: exact original geometry invariants in the offline scene pack. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {MapGenerator} from './static/dust_corridor/src/world/MapGenerator.js';

const manifest=JSON.parse(fs.readFileSync('static/maps/dust_scene66.meta.json','utf8'));
const compressed=fs.readFileSync('static/maps/dust_scene66.bin.gz');
const raw=gunzipSync(compressed);
const head=raw.subarray(0,8).toString();
assert.equal(head,'DUSTPK66');
assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.rawSha256);
const n=raw.readUInt32LE(8);
const desc=JSON.parse(raw.subarray(12,12+n).toString('utf8'));
const start=Math.ceil((12+n)/4)*4;
assert.equal(desc.version,66);
assert.equal(desc.collisionSha256,manifest.collisionSha256);
assert.equal(desc.triangleCount,96588);
assert.equal(desc.originalVisualTriangles,manifest.originalVisualTriangles);
assert.equal(desc.packedVisualTriangles,desc.originalVisualTriangles);
assert.equal(desc.chunks.length,manifest.chunkCount);
assert.ok(desc.chunks.length>12,'The source map must have spatial draw chunks');
assert.ok(manifest.gzipBytes===compressed.length&&manifest.rawBytes===raw.length);
assert.ok(compressed.length<raw.length*.80,'Scene compression should be worthwhile');
const source=new MapGenerator().generate();
const originalTriangles=source.batches.reduce((v,b)=>v+b.triangleCount,0);
assert.equal(desc.originalVisualTriangles,originalTriangles);
assert.equal(desc.spawns.A.length,source.spawns.A.length);
assert.equal(desc.spawns.B.length,source.spawns.B.length);
assert.equal(desc.cloth.length,source.cloth.length);
assert.equal(desc.cables.length,source.cables.length);
assert.equal(desc.footprints.length,source.buildings.length);

const sourceGeom=source.batches.map(b=>b.build());
let expectedSum=0,actualSum=0,summedTriangles=0;
const F32=x=>{const a=new Float32Array([x]);return new Uint32Array(a.buffer)[0]};
// Commutative fingerprint verifies that all source triangle positions survive
// spatial partitioning unchanged, with no holes or simplified building faces.
function mix(a,b,c){
 let h=Math.imul((a^0x85ebca6b)>>>0,0xc2b2ae35);
 h=Math.imul((h^b)>>>0,0x27d4eb2f);
 return (h^c)>>>0;
}
function vertexHash(pos,i){
 return mix(F32(pos[i*3]),F32(pos[i*3+1]),F32(pos[i*3+2]));
}
for(const geo of sourceGeom){
 const pos=geo.attributes.position.array,idx=geo.index.array;
 for(let i=0;i<idx.length;i+=3){
  expectedSum=(expectedSum+mix(vertexHash(pos,idx[i]),
   vertexHash(pos,idx[i+1]),vertexHash(pos,idx[i+2])))>>>0;
 }
 geo.dispose();
}
for(const row of desc.chunks){
 const pd=row.attributes.position,uv=row.attributes.uv;
 const nrm=row.attributes.normal,tint=row.attributes.aTint,wear=row.attributes.aWear;
 const layer=row.attributes.aLayer;
 assert.equal(pd.count,row.vertices*3);
 assert.equal(uv.count,row.vertices*2);
 assert.equal(nrm.count,row.vertices*3);
 assert.equal(tint.count,row.vertices*3);
 assert.equal(wear.count,row.vertices);
 assert.equal(layer.count,row.vertices);
 assert.equal(row.index.count,row.triangles*3);
 for(const attribute of Object.values(row.attributes)){
  const elementSize={f32:4,i16:2,u8:1}[attribute.format];
  assert.ok(elementSize,'Known material encoding');
  assert.ok(start+attribute.offset+attribute.bytes<=raw.length);
  assert.equal(attribute.bytes,attribute.count*elementSize);
 }
 const pos=new Float32Array(raw.buffer,raw.byteOffset+start+pd.offset,pd.count);
 const idx=row.index.format==='u16'?
   new Uint16Array(raw.buffer,raw.byteOffset+start+row.index.offset,row.index.count):
   new Uint32Array(raw.buffer,raw.byteOffset+start+row.index.offset,row.index.count);
 for(let i=0;i<idx.length;i+=3){
  assert.ok(idx[i]<row.vertices&&idx[i+1]<row.vertices&&idx[i+2]<row.vertices);
  actualSum=(actualSum+mix(vertexHash(pos,idx[i]),
   vertexHash(pos,idx[i+1]),vertexHash(pos,idx[i+2])))>>>0;
 }
 summedTriangles+=row.triangles;
}
assert.equal(summedTriangles,originalTriangles,'No dropped or added source triangles');
assert.equal(actualSum,expectedSum,'The exact original triangle positions must remain unchanged');
console.log('Dust 6.6 scene pack validated:',JSON.stringify({
 chunks:desc.chunks.length,
 visualTriangles:originalTriangles,
 packedMb:+(compressed.length/1048576).toFixed(2),
 rawMb:+(raw.length/1048576).toFixed(2),
 preserved:true
}));
