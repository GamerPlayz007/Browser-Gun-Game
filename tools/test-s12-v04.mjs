import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root));
const glb=read('static/assets/crossfire-s12-v04-performance.glb');
assert.equal(glb.subarray(0,4).toString('ascii'),'glTF','approved S-12 must be a binary glTF');
assert.equal(glb.readUInt32LE(4),2,'glTF version 2');
assert.equal(glb.readUInt32LE(8),glb.length,'valid GLB byte length');
assert.ok(glb.length>1_000_000 && glb.length<4_000_000,'school laptop download budget');
assert.equal(glb.toString('ascii',16,20),'JSON');
const jsonLength=glb.readUInt32LE(12);
const doc=JSON.parse(glb.subarray(20,20+jsonLength).toString('utf8'));
assert.equal(doc.meshes.length,274,'approved performance model mesh count');
assert.equal(doc.materials.length,19,'approved performance material count');
const triangles=doc.meshes.reduce((n,mesh)=>n+mesh.primitives.reduce((s,p)=>
 s+(p.indices!==undefined?doc.accessors[p.indices].count/3:doc.accessors[p.attributes.POSITION].count/3),0),0);
assert.equal(triangles,9904,'approved performance model triangle count');
const names=doc.nodes.map(node=>node.name||'');
assert.ok(names.some(name=>name.startsWith('Handguard/Rib')),'handguard detail should be present');
assert.ok(names.some(name=>name.startsWith('Stock/Perforated')),'stock cutouts should be present');
const model=read('static/models.js').toString('utf8');
const game=read('static/game.js').toString('utf8');
assert.match(model,/id===2\?makeS12V04Scaffold\(model,magazine\)/,'active shotgun must use S-12 rig');
assert.match(model,/if\(id===2\)attachS12V04\(root\)/,'shotgun 3D art must attach');
assert.match(model,/makeAWP01V03Scaffold\(model,magazine\)/,'approved AWP-01 v0.3 sniper must replace older art');
assert.match(game,/S-12 V0\.4/,'shotgun label updated');
console.log('S-12 v0.4 approved game asset validated', {meshes:doc.meshes.length,materials:doc.materials.length,triangles,bytes:glb.length});