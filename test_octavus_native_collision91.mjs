/* Phase 2.0: verify native source geometry is bit-identical for
 * prospective client and server physics. No live map changes.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeNativeCollision91,sourceNativePosition91} from './static/octavus_native_collision91.js';

const root='static/maps/';
const meta=JSON.parse(readFileSync(root+'octavus.native-core.json','utf8'));
const report=JSON.parse(readFileSync(root+'octavus.native-collision-preflight91.json','utf8'));
const source=readFileSync(root+'octavus.native-core.bin.gz');
const archiveSha=createHash('sha256').update(source).digest('hex');
assert.equal(archiveSha,meta.sha256);
assert.equal(report.sourceSHA256,archiveSha);
assert.equal(report.format,'OCTAVUS-NATIVE-COLLISION-PILOT91');
assert.equal(report.status,'staging-only-not-live');
assert.equal(report.liveMapModified,false);
assert.equal(report.clientServerParityVerified,false);
assert.equal(report.gameplayMotionParityVerified,false);
assert.equal(report.collisionCandidateHasOriginalSlot1Floor,false);
const candidate=decodeNativeCollision91(gunzipSync(source),meta);
assert.equal(candidate.soup.count,98358);
assert.equal(candidate.vertexCount,123915);
assert.equal(candidate.sourcePilotOnly,true);
assert.equal(candidate.collisionReadyForGame,false);
assert.ok(candidate.soup.positions.every(Number.isFinite));
assert.equal(candidate.soup.surfaces.length,candidate.soup.count);
const floatSha=createHash('sha256')
 .update(Buffer.from(candidate.soup.positions.buffer)).digest('hex');
assert.equal(floatSha,report.float32TriangleSoupSHA256,
 'Native collision float32 bytes disagree between Python and browser');
assert.equal(candidate.soup.positions.byteLength,report.float32ByteLength);
const original=JSON.parse(readFileSync(root+'octavus.native-entities.json','utf8'));
assert.equal(original.revision,829);
assert.equal(original.playerStarts.length,33);
assert.equal(report.sourceSpawns.length,33);
for(const [index,entry] of original.playerStarts.entries()){
 const [x,y,z]=entry.sourcePosition;
 const p=sourceNativePosition91(x*8,y*8,z*8);
 const row=report.sourceSpawns[index];
 assert.equal(row.entityID,entry.id);
 for(let dim=0;dim<3;dim++)
  assert.ok(Math.abs(p[dim]-row.worldPosition[dim])<.00011,
   'Original native start transform disagreement');
}
const liveMap=JSON.parse(readFileSync(root+'octavus.json','utf8'));
assert.equal(liveMap.collisionFormat,'OCT1');
assert.equal(liveMap.collisionTriangles,86500);
const liveServer=readFileSync('server.py','utf8');
const liveClient=readFileSync('static/octavus_match.js','utf8');
assert.ok(!liveServer.includes('octavus_native_collision91'));
assert.ok(!liveClient.includes('octavus_native_collision91'));
assert.ok(!liveClient.includes('octavus.native-core.bin.gz'));
assert.ok(!liveMap.nativeCollisionStage91);
console.log(JSON.stringify({
 status:'PASS',
 source:'Red Eclipse 2 Octavus original MPZ r829 architecture',
 nativeVertices:candidate.vertexCount,
 candidateTriangles:candidate.soup.count,
 compressedSha:archiveSha,
 pythonJsFloat32Sha:floatSha,
 nativePlayerStarts:report.sourceSpawnCount,
 verifiedStagingOnly:true,
 gameCollisionUnchanged:true,
 candidateReadiness:'NOT YET PLAYABLE'
},null,2));
