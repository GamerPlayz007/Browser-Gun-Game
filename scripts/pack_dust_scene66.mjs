/**
 * CROSSFire 6.6: offline, source-faithful Dust Corridor scene compiler.
 * Generates the exact authored triangles, geometry attributes and dynamic
 * definitions ONCE in CI. Runtime never rebuilds the static market.
 *
 * Chunk assignment moves existing indexed triangles into ~32m cells.
 * No triangles are removed. Position/UV remain exact float32; tangent normals
 * are signed normalized i16, colors/wear normalized u8, material layers u8.
 *
 * Output: static/maps/dust_scene66.bin.gz, dust_scene66.meta.json
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {MapGenerator} from '../static/dust_corridor/src/world/MapGenerator.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DEST=path.join(ROOT,'static','maps');
const SOURCE_SHA='82dadbb5b72efd6b8095994ca783f4a6a8afe2c84a7682507abbc1f0ab36887b';
const CELL=32;

function encodeChunk(name,cell){
 const vcount=cell.map.size;
 const source={
  position:new Float32Array(cell.position),
  normal:Int16Array.from(cell.normal,x=>Math.round(Math.max(-1,Math.min(1,x))*32767)),
  uv:new Float32Array(cell.uv),
  aLayer:Uint8Array.from(cell.aLayer,x=>Math.max(0,Math.min(255,Math.round(x)))),
  aTint:Uint8Array.from(cell.aTint,x=>Math.max(0,Math.min(255,Math.round(x*255)))),
  aWear:Uint8Array.from(cell.aWear,x=>Math.max(0,Math.min(255,Math.round(x*255))))
 };
 const index=vcount>65535?new Uint32Array(cell.indices):new Uint16Array(cell.indices);
 return {name,x:cell.x,z:cell.z,vertices:vcount,triangles:index.length/3,
  attrs:source,index};
}
function chunkGeometry(geometry,batchName){
 const pos=geometry.getAttribute('position').array;
 const index=geometry.index.array;
 const attrs=['position','normal','uv','aLayer','aTint','aWear'];
 const info=Object.fromEntries(attrs.map(k=>[k,geometry.getAttribute(k)]));
 const chunks=new Map();
 for(let i=0;i<index.length;i+=3){
  const a=index[i],b=index[i+1],c=index[i+2];
  const midx=(pos[a*3]+pos[b*3]+pos[c*3])/3;
  const midz=(pos[a*3+2]+pos[b*3+2]+pos[c*3+2])/3;
  const gx=Math.floor(midx/CELL),gz=Math.floor(midz/CELL),id=gx+','+gz;
  let chunk=chunks.get(id);
  if(!chunk){
   chunk={x:gx,z:gz,map:new Map(),indices:[]};
   for(const attr of attrs)chunk[attr]=[];
   chunks.set(id,chunk);
  }
  for(const srcIndex of [a,b,c]){
   let dest=chunk.map.get(srcIndex);
   if(dest===undefined){
    dest=chunk.map.size;chunk.map.set(srcIndex,dest);
    for(const attr of attrs){
     const a=info[attr];
     for(let k=0;k<a.itemSize;k++)chunk[attr].push(a.array[srcIndex*a.itemSize+k]);
    }
   }
   chunk.indices.push(dest);
  }
 }
 return [...chunks].sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([id,data])=>encodeChunk(batchName+'@'+id,data));
}
function arrayBufferView(arr){
 return Buffer.from(arr.buffer,arr.byteOffset,arr.byteLength);
}
function pack(original){
 const entries=[];
 const buffers=[];
 let offset=0;
 function add(typed){
  // 4-byte alignment lets the browser build Uint32/Float32 views *without*
  // cloning the entire scene into an extra unpacked copy.
  const pad=(4-offset%4)%4;
  if(pad){buffers.push(Buffer.alloc(pad));offset+=pad;}
  const start=offset,buffer=arrayBufferView(typed);
  buffers.push(buffer);offset+=buffer.length;
  return {offset:start,bytes:buffer.length,count:typed.length};
 }
 for(const entry of original){
  const out={name:entry.name,cellX:entry.x,cellZ:entry.z,
   vertices:entry.vertices,triangles:entry.triangles,attributes:{}};
  for(const [name,array] of Object.entries(entry.attrs)){
   const format=array instanceof Float32Array?'f32':array instanceof Int16Array?'i16':'u8';
   const normalized=name==='normal'||name==='aTint'||name==='aWear';
   out.attributes[name]={...add(array),format,itemSize:{position:3,normal:3,uv:2,aLayer:1,aTint:3,aWear:1}[name],normalized};
  }
  out.index={...add(entry.index),format:entry.index instanceof Uint32Array?'u32':'u16'};
  entries.push(out);
 }
 return {entries,binary:Buffer.concat(buffers,offset)};
}
const start=performance.now();
const map=new MapGenerator().generate();
if(map.soup.count!==96588)throw Error('Pinned source triangle count changed');
let chunks=[],originalTris=0,sourceVertices=0;
for(const batch of map.batches){
 const geometry=batch.build();
 originalTris+=geometry.index.count/3;
 sourceVertices+=geometry.getAttribute('position').count;
 chunks.push(...chunkGeometry(geometry,batch.name));
 geometry.dispose();
}
const chunksTris=chunks.reduce((n,v)=>n+v.triangles,0);
if(originalTris!==chunksTris)throw Error('A source triangle was lost');
const packed=pack(chunks);
const data={
  version:66,format:'DUSTPK66',source:'Leonxlnx/claude-of-duty@7f8a15ae',
  collisionSha256:SOURCE_SHA,
  triangleCount:map.soup.count,
  originalVisualTriangles:originalTris,
  packedVisualTriangles:chunksTris,
  originalVisualVertices:sourceVertices,
  packedVisualVertices:chunks.reduce((n,e)=>n+e.vertices,0),
  chunkSize:CELL,
  playBounds:map.playBounds,
  spawns:Object.fromEntries(Object.entries(map.spawns).map(([side,arr])=>[side,arr.map(v=>[v.x,v.y,v.z])])),
  footprints:map.buildings.map(b=>({x0:b.x0,x1:b.x1,z0:b.z0,z1:b.z1})),
  cloth:map.cloth,cables:map.cables,
  chunks:packed.entries
};
const json=Buffer.from(JSON.stringify(data),'utf8');
const padding=(4-(12+json.length)%4)%4;
const header=Buffer.alloc(12);header.write('DUSTPK66',0,'ascii');header.writeUInt32LE(json.length,8);
const raw=Buffer.concat([header,json,Buffer.alloc(padding),packed.binary]);
const rawSha256=createHash('sha256').update(raw).digest('hex');
const compressed=gzipSync(raw,{level:7,mtime:0});
fs.mkdirSync(DEST,{recursive:true});
fs.writeFileSync(path.join(DEST,'dust_scene66.bin.gz'),compressed);
const manifest={
  format:'DUSTPK66',version:66,
  collisionSha256:SOURCE_SHA,rawSha256,
  sourceTriangles:map.soup.count,
  originalVisualTriangles:originalTris,packedVisualTriangles:chunksTris,
  originalVisualVertices:sourceVertices,
  packedVisualVertices:data.packedVisualVertices,
  chunkCount:chunks.length,
  gzipBytes:compressed.length,rawBytes:raw.length,
  elapsedBuildMs:Math.round(performance.now()-start)
};
fs.writeFileSync(path.join(DEST,'dust_scene66.meta.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Dust 6.6 offline pack:',JSON.stringify(manifest));
