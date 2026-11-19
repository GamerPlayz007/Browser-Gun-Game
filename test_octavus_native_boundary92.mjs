/* Octavus Stage 2.1: shared Python/JS native island boundary proof. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createArenaLimit92,makeNativeArenaWall92} from './static/octavus_native_boundary92.js';

const dir='static/maps/';
const boundary=JSON.parse(readFileSync(dir+'octavus.native-boundary92.json','utf8'));
const report=JSON.parse(readFileSync(dir+'octavus.native-boundary-audit92.json','utf8'));
const arena=createArenaLimit92(boundary);
assert.equal(arena.vertices.length,58);
assert.equal(arena.edges.length,58);
assert.equal(report.wallSegments,58);
assert.equal(report.originalStartsInside,33);
assert.equal(report.wallHeight,60);
assert.ok(arena.wallTopY>=38);
assert.ok(arena.wallBaseY<=-22);
assert.ok(Math.abs(Math.abs(arena.area)-report.playableAreaSquareMeters)<.02);
assert.ok(Math.abs(arena.edges.reduce((length,[a,b])=>length+Math.hypot(a[0]-b[0],a[1]-b[1]),0)
                 -report.perimeterLengthMeters)<.02);
for(let i=0;i<58;i++)
 assert.deepEqual(arena.edges[i][1],arena.edges[(i+1)%58][0]);
const starts=JSON.parse(readFileSync(dir+'octavus.native-entities.json','utf8')).playerStarts;
assert.equal(starts.length,33);
for(const entry of starts){
 const [x,y]=entry.sourcePosition;
 const worldX=(x-4096)*.05,worldZ=(y-4096)*.05;
 assert.equal(arena.allowed(worldX,worldZ),true,
  'User-provided silhouette wall cannot cut an original spawn '+entry.id);
}
assert.equal(arena.allowed(0,0),true);
for(const [x,z] of [[65,0],[-65,0],[0,65],[0,-65],[100,100],[-180,0]])
 assert.equal(arena.allowed(x,z),false);
assert.equal(arena.allowed(...arena.vertices[0]),false);
let passed=0,blocked=0;
for(const row of report.motionFixtures){
 const got=arena.clipHorizontal(row.start,row.end);
 assert.equal(got.blocked,row.blocked,'Mismatch in sweep from '+JSON.stringify(row.start));
 assert.equal(arena.allowed(got.x,got.z),true,'Boundary sweep escaped source island');
 assert.ok(Math.hypot(got.x-row.clippedEnd[0],got.z-row.clippedEnd[1])<.00015,
  'Python/JS continuous source boundary collision parity failure');
 passed++;
 if(got.blocked)blocked++;
}
assert.ok(passed>=100);
assert.ok(blocked>=90);
const far=arena.clipHorizontal([0,0],[200,200]);
assert.equal(far.blocked,true);
assert.equal(arena.allowed(far.x,far.z),true);
// Wall and movement containment must be independent of vertical height:
assert.equal(arena.clipHorizontal([0,0],[200,200]).blocked,true);
const wall=makeNativeArenaWall92(arena);
assert.equal(wall.wallSegments,58);
assert.equal(wall.triangles,464);
assert.equal(wall.mesh.name.includes('non-jumpable'),true);
const coords=wall.mesh.geometry.getAttribute('position');
assert.equal(coords.count,464*3);
assert.equal(coords.itemSize,3);
let bottom=Infinity,top=-Infinity;
for(let i=0;i<coords.count;i++){
 const [x,y,z]=[coords.getX(i),coords.getY(i),coords.getZ(i)];
 assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z));
 bottom=Math.min(bottom,y);top=Math.max(top,y);
}
assert.equal(bottom,-22);
assert.equal(top,38);
wall.show(false);
assert.equal(wall.mesh.visible,false);
wall.show(true);
assert.equal(wall.mesh.visible,true);
wall.dispose();
const live=JSON.parse(readFileSync(dir+'octavus.json','utf8'));
assert.equal(live.collisionFormat,'OCT1');
assert.equal(live.collisionTriangles,86500);
for(const path of ['server.py','static/octavus_match.js']){
 const source=readFileSync(path,'utf8');
 assert.ok(!source.includes('octavus_native_boundary92'),
  'Premature update to existing multiplayer map in '+path);
}
assert.equal(report.liveMapModified,false);
assert.equal(report.serverMovementHookedIntoLiveGame,false);
assert.equal(report.clientMovementHookedIntoLiveGame,false);
console.log(JSON.stringify({
 status:'PASS',
 screenshotSilhouettePoints:boundary.tracing.sourceOutlinePixels.length,
 wallSegments:wall.wallSegments,
 wallTriangleCount:wall.triangles,
 wallHeight:report.wallHeight,
 originalSpawnsInside:report.originalStartsInside,
 collisionParityFixtures:passed,
 stoppedOutsideSweeps:blocked,
 playableSquareMeters:report.playableAreaSquareMeters,
 sourceNativeMapUnchanged:true
},null,2));
