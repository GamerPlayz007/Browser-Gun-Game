import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const page=readFileSync(new URL('../static/map-art-v5.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../static/map-art-v5.js',import.meta.url),'utf8');
for(const id of ['stage','assetQuality','cityQuality','animation','site','fps','calls','triangles','report','stats','rotate','wire','hide','reset'])assert.ok(page.includes(`id="${id}"`),`missing control ${id}`);
assert.match(page,/\/static\/vendor\/three\.module\.js/);
assert.match(script,/import \{buildWorld\} from '\.\/world\.js'/);
assert.match(script,/import \{HERO_GLB_BASE64,PERFORMANCE_GLB_BASE64\}/);
assert.match(script,/new GLTFLoader\(\)/);
assert.match(script,/loader\.parseAsync\(buffer,''\)/);
assert.match(script,/buildWorld\(scene,map,\{renderer,quality:'performance'\}\)/);
assert.match(script,/map\.spawns\?\.some/);
assert.match(script,/world\?\.animate\(now\*\.001\)/);
assert.ok(!script.includes('fetch(\'/api/rooms')&&!script.includes('new WebSocket('),'Preview must be offline from multiplayer protocol');
assert.ok(!script.includes('BoxGeometry')&&!script.includes('CylinderGeometry'),'No procedural artist mesh geometry');
const sample=readFileSync(new URL('../static/artist-mesh-v3-data.js',import.meta.url),'utf8');
for(const [name,sha,expectedBytes] of [
 ['HERO','a6af5fbe7e78c282e5ae5a4e6374560cd55adedc83dcdffe6733a53866e57c72',162928],
 ['PERFORMANCE','01907788aa11ffe7f0c63a5e7a2dc57b86e42c132093fc17f4260f295374dbdc',150248]
]){
 const match=sample.match(new RegExp('export const '+name+'_GLB_BASE64 = "([A-Za-z0-9+/=]+)";'));
 assert.ok(match,`missing original ${name} glTF asset`);
 const raw=Buffer.from(match[1],'base64');
 assert.equal(raw.length,expectedBytes);
 assert.equal(createHash('sha256').update(raw).digest('hex'),sha);
 assert.equal(raw.toString('utf8',0,4),'glTF');
 const len=raw.readUInt32LE(12);
 const gltf=JSON.parse(raw.toString('utf8',20,20+len));
 assert.equal(gltf.skins.length,1);
 assert.equal(gltf.animations.length,3);
 const prim=gltf.meshes[0].primitives[0];
 const accessorId=prim.indices??prim.attributes.POSITION;
 assert.equal(gltf.accessors[accessorId].count/3,576);
}

console.log('PASS: Map Stage v5 controls, imported GLBs, real Daybreak renderer, multiplayer isolation');