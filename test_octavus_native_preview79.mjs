/* Octavus Phase 1.3 checks: source-native staging is valid and isolated. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const root='static/maps/';
const cases=[
 {prefix:'octavus.native-core',triangles:98358,vertices:123915,slot1:0},
 {prefix:'octavus.native-stage1',triangles:1661200,vertices:822787,slot1:1562842},
];
for(const item of cases){
 const path=root+item.prefix;
 const meta=JSON.parse(readFileSync(path+'.json','utf8'));
 assert.equal(meta.format,'OCN2');
 assert.equal(meta.status,'staging-only-not-live');
 const compressed=readFileSync(path+'.bin.gz');
 const hash=createHash('sha256').update(compressed).digest('hex');
 assert.equal(hash,meta.sha256??meta.stagingSHA256);
 const raw=gunzipSync(compressed);
 assert.equal(raw.toString('ascii',0,4),'OCN2');
 const nv=raw.readUInt32LE(4),nt=raw.readUInt32LE(8);
 assert.equal(nv,item.vertices);
 assert.equal(nt,item.triangles);
 assert.equal(raw.length,12+12*nv+14*nt);
 assert.ok(meta.liveMapModified===false);
 let countSlot1=0;
 const slots=new Set();
 for(let i=0;i<nt;i++){
  const off=12+nv*12+i*14;
  const a=raw.readUInt32LE(off),b=raw.readUInt32LE(off+4),c=raw.readUInt32LE(off+8);
  const slot=raw.readUInt16LE(off+12);
  assert.ok(a<nv&&b<nv&&c<nv);
  if(slot===1)countSlot1++;
  slots.add(slot);
 }
 assert.equal(countSlot1,item.slot1);
 assert.ok(slots.size>=195);
 console.log(item.prefix+': PASS '+nv+' vertices / '+nt+' triangles / '+slots.size+' material slots');
}
const starts=JSON.parse(readFileSync(root+'octavus.native-entities.json','utf8'));
assert.equal(starts.playerStarts.length,33);
const audit=JSON.parse(readFileSync(root+'octavus.native-spawn-audit.json','utf8'));
assert.equal(audit.originalPlayerStartCount,33);
assert.equal(audit.withProjectedNativeMeshSurfaceWithin8Units,32);
const html=readFileSync('static/octavus-native-preview.html','utf8');
const js=readFileSync('static/octavus-native-preview.js','utf8');
assert.ok(html.includes('/static/octavus-native-preview.js'));
assert.ok(html.includes('"/static/vendor/three.module.js"'));
assert.ok(html.includes('octavus.png'));
assert.ok(html.includes('REVISION 829')||html.includes('revision 829'));
assert.ok(html.includes('id="load-state"'));
assert.ok(html.includes('id="metric-tris"'));
assert.ok(html.includes('id="raw-btn"'));
assert.ok(js.includes('DecompressionStream'));
assert.ok(js.includes("crypto.subtle.digest('SHA-256'"));
assert.ok(js.includes("void activate('core')"));
assert.ok(js.includes("void spawnMarkers()"));
assert.ok(!js.includes("import './game.js'"));
assert.ok(existsSync('static/vendor/three.module.js'));
console.log('Octavus native geometry browser-inspection smoke: PASS');
