/** Stage 6.3 regression: exact sourced collision, physics, deterministic export. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {MapGenerator,groundHeightAt} from './static/dust_corridor/src/world/MapGenerator.js';
import {createDustWalk63} from './static/dust_corridor_walk63.js';

const data=new MapGenerator().generate();
const walker=createDustWalk63(data);
assert.ok(walker.triangles>1000,'Original map soup should contain collision triangles');
assert.equal(walker.triangles,data.soup.count);
assert.ok(data.spawns.A.length>=8&&data.spawns.B.length>=8,'Original spawn sets retained');
const start=walker.position.clone();
for(let i=0;i<80;i++)walker.step(1/60,{yaw:Math.PI});
assert.ok(Math.abs(walker.position.y-groundHeightAt(start.x,start.z))<.75,'Ground contact');
assert.ok(walker.position.distanceTo(start)<.85,'Idle player must not drift');
walker.requestJump();
for(let i=0;i<15;i++)walker.step(1/60,{yaw:Math.PI});
assert.ok(walker.position.y>start.y+.15,'Jump increases player height');
for(let i=0;i<150;i++)walker.step(1/60,{yaw:Math.PI});
assert.ok(walker.grounded,'Player returns to source-authored terrain');
walker.toggleCrouch();
assert.ok(walker.crouched,'Crouch reduces capsule height');
walker.toggleCrouch();
assert.ok(!walker.crouched,'Standing is possible in the open');
walker.resetSpawn('B');
assert.ok(walker.position.z>35,'North-side spawn present');

const packed=gunzipSync(fs.readFileSync('static/maps/dust_collision63.bin.gz'));
const meta=JSON.parse(fs.readFileSync('static/maps/dust_collision63.meta.json','utf8'));
assert.equal(packed.subarray(0,8).toString('ascii'),'DUSTCOL3');
assert.equal(packed.readUInt32LE(8),data.soup.count);
assert.equal(packed.length,12+37*data.soup.count);
assert.equal(createHash('sha256').update(packed).digest('hex'),meta.rawSha256);
assert.deepEqual(meta.spawns.A[0],data.spawns.A[0].toArray().map(n=>Number(n.toFixed(5))));
for(const i of [0,Math.floor(data.soup.count/2),data.soup.count-1]){
  const base=12+i*36;
  for(let v=0;v<9;v++)assert.equal(packed.readFloatLE(base+v*4),data.soup.positions[i*9+v]);
  assert.equal(packed[12+data.soup.count*36+i],data.soup.surfaces[i]);
}
console.log('CROSSFire Dust 6.3: exact collision geometry, source BVH/controller and export OK');
