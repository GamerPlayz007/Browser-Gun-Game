/* Stage 2.2 binary parity — source original Red Eclipse octree kinds.
 * A cube marked NORMAL/deformed is never treated as a full solid.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeNativeOccupancy96} from './static/octavus_native_occupancy96.js';

const root='static/maps/';
const m=JSON.parse(readFileSync(root+'octavus.native-occupancy96.json','utf8'));
const compressed=readFileSync(root+'octavus.native-occupancy96.bin.gz');
assert.equal(createHash('sha256').update(compressed).digest('hex'),m.compressedSha256);
const decoded=decodeNativeOccupancy96(gunzipSync(compressed),m);
assert.ok(decoded.count>1000);
assert.equal(decoded.count,m.occupancyCells);
assert.equal(decoded.gameCollisionReady,false);
assert.equal(decoded.deformedCollisionProven,false);
assert.ok(decoded.cellsByKind.empty>0&&decoded.cellsByKind.solid>0&&decoded.cellsByKind.deformed>0);
assert.equal(decoded.cellsByKind.empty+decoded.cellsByKind.solid+decoded.cellsByKind.deformed,decoded.count);
assert.equal(m.sourceRevision,829);
assert.equal(m.allSampledKindsMatchOriginalOctree,true);
assert.ok(m.sourceQuerySampleCount>=2200);
const cases=m.actualSourceOccupancyFixtures;
assert.equal(cases.length,m.sourceQuerySampleCount);
for(const [idx,p] of cases.entries()){
 const q=decoded.lookup(p.native);
 assert.equal(q?.kind??null,p.kind,
  'Python/JS original occupancy kind mismatch at fixture '+idx+' '+JSON.stringify(p.native));
 assert.equal(q?.size??null,p.size,
  'Original native leaf size mismatch at fixture '+idx);
 if(q){
  assert.equal(q.edgeBytes.length,12);
  assert.equal(q.deformedUnresolved,q.kind===3);
 }
}
assert.equal(decoded.lookup([-100,4096,2816]),null);
assert.equal(decoded.lookup([8192,4096,2816]),null);
const live=JSON.parse(readFileSync(root+'octavus.json','utf8'));
assert.equal(live.collisionFormat,'OCT1');
assert.equal(live.collisionTriangles,86500);
for(const p of ['server.py','static/game.js','static/octavus_match.js','octavus_world.py']){
 const source=readFileSync(p,'utf8');
 assert.ok(!source.includes('octavus_native_occupancy96'));
 assert.ok(!source.includes('octavus.native-occupancy96.bin.gz'));
}
console.log(JSON.stringify({
 status:'PASS',
 sourceLeaves:m.sourceOctreeLeaves,
 islandCells:decoded.count,
 kindCounts:decoded.cellsByKind,
 exactPythonBrowserOctreeQueries:cases.length,
 rawBytes:m.binaryUncompressedBytes,
 gzipBytes:m.compressedBytes,
 stage:'original source occupancy diagnostics only',
 liveMapChanged:false
},null,2));
