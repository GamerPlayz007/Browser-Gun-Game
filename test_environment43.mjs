import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {planEnvironment43,createEnvironment43,STORY_SIGNS,DISTRICT_STORIES} from './static/environment43.js';
import {createCyberMaterialLibrary} from './static/materials41.js';

const ctx=new Proxy({}, {get:(_,key)=>()=>{}});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
const map=JSON.parse(fs.readFileSync('static/map.json','utf8'));
const before=JSON.stringify({boxes:map.boxes,routes:map.routes,spawns:map.spawns});
const plan=planEnvironment43(map);
assert.ok(plan.stats.parts>=700,'City should have hundreds of authored visual objects');
assert.equal(plan.stats.signs,24,'Exactly 24 unique story signs');
assert.ok(plan.stats.wires>=20,'Wiring should be derived from many existing facades');
assert.ok(plan.stats.facades>=40,'Large existing walls should get mechanical details');
assert.ok(plan.stats.floorMarkings>=25,'Street markings need to be visible');
assert.deepEqual(Object.keys(DISTRICT_STORIES).sort(),map.zones.map(z=>z.id).sort());
for(const zone of Object.keys(DISTRICT_STORIES)){
 assert.equal(plan.signs.filter(s=>s.zone===zone).length,6);
 assert.ok(plan.zoneCounts[zone]>=70,'No district is left empty: '+zone);
}
assert.equal(STORY_SIGNS.length,24);
assert.ok(plan.parts.every(b=>[b.x,b.y,b.z,b.w,b.h,b.d].every(Number.isFinite)
 &&b.w>0&&b.h>0&&b.d>0),'No invalid decorative bounds');
assert.ok(plan.parts.every(b=>b.tier>=0&&b.tier<=2),'Graphics tiers must be bounded');
assert.ok(plan.parts.every(b=>DISTRICT_STORIES[b.zone]),'All props belong to existing districts');
const library=createCyberMaterialLibrary(T);
const environment=createEnvironment43(T,map,library);
assert.ok(environment.group.isGroup);
assert.equal(environment.stats.parts,plan.stats.parts);
assert.equal(environment.stats.signs,24);
assert.ok(environment.stats.batches<=40,'Draw call budget must be maintained');
assert.ok(environment.group.children.every(m=>m.userData.collidable===false));
assert.ok(environment.group.children.some(m=>m.name.includes('phase43-signs')));
assert.ok(environment.group.children.some(m=>m.name.includes('phase43-overhead-cables')));
const qualityCount=mode=>{
 environment.setQuality(mode);
 return environment.group.children.filter(m=>m.visible).length;
};
const performance=qualityCount('performance'),high=qualityCount('high'),ultra=qualityCount('ultra');
assert.ok(performance<high&&high<ultra,'Graphics presets expose progressive density');
assert.equal(ultra,environment.group.children.length,'Ultra enables all scene detail');
environment.setQuality('high');
environment.setDetail(false);
assert.equal(environment.group.children.filter(m=>m.visible).length,performance,
 'Auto quality reduction keeps core landmarks');
environment.setDetail(true);
assert.equal(environment.group.children.filter(m=>m.visible).length,high,
 'Full detail must recover after quality reduction');
assert.equal(JSON.stringify({boxes:map.boxes,routes:map.routes,spawns:map.spawns}),before,
 'Visual set dressing must not mutate gameplay');
const scene=new T.Scene();scene.add(environment.group);
environment.dispose();library.dispose();
assert.equal(scene.children.length,0,'Environment should dispose cleanly on map replacement');
console.log('Phase 4.3: '+plan.stats.parts+' batched noncolliding details, storefronts, cyber signage,');
console.log('road markings, performance tiers, and unchanged collision topology passed.');
