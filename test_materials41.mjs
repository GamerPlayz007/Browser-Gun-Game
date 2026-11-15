import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {SURFACE_STYLES,createCyberMaterialLibrary,createSurfaceBoxGeometry} from './static/materials41.js';
import {createStage5VisualLayer} from './static/stage5_visual_layer.js';
import {createStage6VisualLayer} from './static/stage6_visual_layer.js';

const ctx=new Proxy({}, {get:(_,key)=>()=>{}});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
const map=JSON.parse(fs.readFileSync('static/map.json','utf8'));
const initialColliderCount=map.boxes.length;
const materials=createCyberMaterialLibrary(THREE);
for(const style of SURFACE_STYLES){
 const m=materials.get(style);
 assert.ok(m.isMeshStandardMaterial,style+' must be PBR');
 for(const name of ['map','roughnessMap','bumpMap','emissiveMap'])
  assert.ok(m[name],style+' missing '+name);
}
assert.equal(materials.atlasCount,SURFACE_STYLES.length,'Each style must have one shared atlas');
const warm=materials.get('window',{emissive:'#ffbd86',glow:1.4});
const cyan=materials.get('window',{emissive:'#6be9ff',glow:1.4});
assert.strictEqual(warm.map,cyan.map,'Colored window variants must share texture memory');
assert.notStrictEqual(warm,cyan,'Distinct window colors must be separate materials');
const oldMap=warm.map;
materials.setQuality('performance');
assert.equal(warm.bumpMap,null);
assert.strictEqual(warm.map,oldMap);
assert.ok(warm.emissiveMap,'Performance must retain lit windows');
materials.setQuality('ultra');
assert.ok(warm.bumpMap,'Ultra restores surface bump');
const sample=createSurfaceBoxGeometry(THREE,{x:2,y:1,z:3,w:12,h:8,d:1},2.5);
const uvs=sample.attributes.uv.array;
assert.ok(uvs.some(v=>Math.abs(v)>1),'Large walls must tile, not stretch, PBR maps');
sample.dispose();
const s5=createStage5VisualLayer(THREE,map,'ultra',materials);
const s6=createStage6VisualLayer(THREE,map,'ultra',materials);
assert.ok(s5.children.length>10,'Architectural finishes must be present');
assert.ok(s6.children.length>10,'Surrounding skyline must be present');
assert.ok(s5.children.every(o=>o.isMesh&&o.material.isMeshStandardMaterial));
assert.ok(s6.children.every(o=>o.isMesh&&o.material.isMeshStandardMaterial));
assert.ok(s5.children.every(o=>o.userData.collidable===false));
assert.ok(s6.children.every(o=>o.userData.collidable===false));
assert.ok(s6.children.some(o=>o.name.includes('urbanWindow')&&o.material.emissiveIntensity>1),
 'The extended skyline must have lit windows');
assert.equal(map.boxes.length,initialColliderCount,'Visual material passes cannot alter collision data');
s5.userData.disposeStage5();s6.userData.disposeStage6();materials.dispose();
console.log('Phase 4.1: shared PBR atlases, tiled UVs, lit skyline, tiers and collision isolation passed.');
