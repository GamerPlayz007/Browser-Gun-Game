/* Stage 2.2 authoritative-source collision candidate browser/server
 * binary check; STRICTLY NOT PLAYABLE YET.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeInteriorNative95} from './static/octavus_native_interior95.js';
const ROOT='static/maps/';
const metadata=JSON.parse(readFileSync(ROOT+'octavus.native-interior93.json','utf8'));
const report=JSON.parse(readFileSync(ROOT+'octavus.native-interior-preflight94.json','utf8'));
const compressed=readFileSync(ROOT+'octavus.native-interior93.bin.gz');
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(compressed),metadata.sha256);
assert.equal(report.sourceCollisionSHA256,metadata.sha256);
const decoded=decodeInteriorNative95(gunzipSync(compressed),metadata);
assert.equal(sha(Buffer.from(decoded.positions.buffer)),report.float32TriangleSoupSHA256);
assert.equal(decoded.positions.byteLength,report.float32ByteLength);
assert.equal(decoded.collisionReadyForGame,false);
assert.equal(decoded.triangleCount,metadata.triangles);
assert.ok(decoded.plainSurfaceCandidates>0);
assert.ok(decoded.triangleCount<863803);
assert.ok(decoded.triangleCount>50000);
assert.equal(report.originalStartsExamined,33);
assert.ok(report.surveyCounts.totalNeighborSamplesInside>=600);
assert.equal(report.liveMapModified,false);
assert.equal(report.physicallyCompleteInsideFootprint,false);
assert.equal(metadata.exactNativeRendererVisibility,false);
const old=JSON.parse(readFileSync(ROOT+'octavus.native-core.json','utf8'));
assert.equal(old.triangles,98358);
const live=JSON.parse(readFileSync(ROOT+'octavus.json','utf8'));
assert.equal(live.collisionFormat,'OCT1');
assert.equal(live.collisionTriangles,86500);
for(const p of ['server.py','static/game.js','static/octavus_match.js','octavus_world.py']){
 const text=readFileSync(p,'utf8');
 assert.ok(!text.includes('octavus_native_interior95'),
   'Unsafe early live collision integration in '+p);
 assert.ok(!text.includes('octavus.native-interior93'),
   'Unverified map promotion in '+p);
}
console.log(JSON.stringify({
 result:'PASS',stagingOnly:true,
 islandCollisionTriangles:decoded.triangleCount,
 originalSlotOneCandidates:decoded.plainSurfaceCandidates,
 oldArchitectureOnlyTriangles:old.triangles,
 originalStartsSurveyed:report.originalStartsExamined,
 actualInteriorFloorSamples:report.surveyCounts.totalNeighborSamplesInside,
 pythonJavaScriptFloat32Sha:report.float32TriangleSoupSHA256,
 liveMapChanged:false
},null,2));
