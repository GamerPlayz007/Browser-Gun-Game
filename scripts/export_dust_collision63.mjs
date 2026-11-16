/**
 * Build the complete original Dust Corridor collision triangle soup as a
 * compact deterministic asset shared by client/server.
 * No geometry simplification or collider approximation is performed.
 *
 * node scripts/export_dust_collision63.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {MapGenerator,MAP} from '../static/dust_corridor/src/world/MapGenerator.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dest=path.join(root,'static','maps');
const map=new MapGenerator().generate();
const count=map.soup.count;
if(!Number.isInteger(count)||count<1000||count>1000000)
  throw Error('Invalid Dust Corridor triangle count: '+count);
if(new Uint8Array(new Uint16Array([1]).buffer)[0]!==1)
  throw Error('Collision export requires a little-endian host');
const vertices=Buffer.from(map.soup.positions.buffer,map.soup.positions.byteOffset,count*9*4);
const surfaces=Buffer.from(map.soup.surfaces.buffer,map.soup.surfaces.byteOffset,count);
const header=Buffer.alloc(12);
header.write('DUSTCOL3',0,'ascii');
header.writeUInt32LE(count,8);
const raw=Buffer.concat([header,vertices,surfaces]);
const sha=createHash('sha256').update(raw).digest('hex');
const compressed=gzipSync(raw,{level:9,mtime:0});
fs.mkdirSync(dest,{recursive:true});
fs.writeFileSync(path.join(dest,'dust_collision63.bin.gz'),compressed);
const convert=spawns=>spawns.map(v=>[v.x,v.y,v.z].map(n=>Number(n.toFixed(5))));
const metadata={
  format:'DUSTCOL3',version:1,
  source:'Leonxlnx/claude-of-duty@7f8a15ae54dd65e7ce22c80c074f9b1da7daee2f',
  triangleCount:count,positionBytes:vertices.byteLength,surfaceBytes:surfaces.byteLength,
  rawSha256:sha,gzipBytes:compressed.length,
  coordinateSystem:'threejs-y-up',bounds:MAP,playBounds:map.playBounds,
  spawns:{A:convert(map.spawns.A),B:convert(map.spawns.B)}
};
fs.writeFileSync(path.join(dest,'dust_collision63.meta.json'),JSON.stringify(metadata,null,2)+'\n');
console.log('Dust Corridor collision exported:',count,'triangles,',compressed.length,'bytes compressed, checksum:',sha);
