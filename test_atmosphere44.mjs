import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {ATMOSPHERE_PRESETS,planPuddles44,createAtmosphere44} from './static/atmosphere44.js';
import {createCyberMaterialLibrary} from './static/materials41.js';
import {CINEMATIC_PRESETS} from './static/postfx.js';

const map=JSON.parse(fs.readFileSync('static/map.json','utf8'));
const before=JSON.stringify({boxes:map.boxes,spawns:map.spawns,routes:map.routes});
const puddles=planPuddles44(map);
assert.ok(puddles.length>=25,'Street-level reflections must cover the four districts');
for(const zone of ['market','plaza','atrium','transit'])
 assert.ok(puddles.some(p=>p.zone===zone),'Wet pavement missing from '+zone);
for(const p of puddles){
 assert.ok([p.x,p.y,p.z,p.w,p.d].every(Number.isFinite),'Invalid puddle coordinate');
 assert.ok(p.w>0&&p.d>0,'Invalid puddle extent');
}
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#08172c',.01);
const fx=createAtmosphere44(THREE,map,scene);scene.add(fx.group);
assert.equal(fx.group.userData.collidable,false);
assert.equal(fx.group.children.length,6,'Two GPU particle meshes + four wet-surface batches');
assert.ok(fx.group.children.every(node=>node.userData.collidable===false));
assert.equal(fx.rain.geometry.getAttribute('position').count,850);
assert.equal(fx.motes.geometry.getAttribute('position').count,320);
const modes=['performance','auto','high','ultra','native'];
for(const mode of modes){
 fx.setQuality(mode);
 const cfg=ATMOSPHERE_PRESETS[mode];
 assert.equal(fx.rain.geometry.drawRange.count,cfg.rain);
 assert.equal(fx.motes.geometry.drawRange.count,cfg.motes);
 assert.equal(fx.puddleMeshes.filter(m=>m.visible).length,0,'Daylight should have dry streets');
 assert.equal(fx.wetness,cfg.wetness);
 assert.equal(scene.fog.density,cfg.fog);
 assert.equal(fx.rain.visible,cfg.rain>0);
 assert.equal(CINEMATIC_PRESETS[mode].bloom===0,mode==='performance');
 assert.equal(cfg.rain,0,'Clear skies have no precipitation');
 assert.equal(cfg.wetness,0,'Road materials remain dry');
}
fx.setQuality('auto');fx.setDetail(false);
assert.ok(fx.motes.geometry.drawRange.count<ATMOSPHERE_PRESETS.auto.motes,
 'Adaptive detail should reduce floating daytime dust');
assert.equal(fx.puddleMeshes.filter(m=>m.visible).length,0);
fx.setDetail(true);
assert.equal(fx.motes.geometry.drawRange.count,ATMOSPHERE_PRESETS.auto.motes);
fx.animate(12.125);
assert.equal(fx.rain.material.uniforms.uTime.value,12.125);
assert.ok(fx.puddleMeshes.every(m=>m.material.uniforms.uTime.value===12.125));
const ctx=new Proxy({}, {get:(_,key)=>()=>{}});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
const library=createCyberMaterialLibrary(THREE),road=library.get('road'),facade=library.get('facade');
const dryRoad=road.roughness,dryFacade=facade.roughness;
library.setQuality('ultra');library.setWetness(ATMOSPHERE_PRESETS.ultra.wetness);
assert.equal(road.roughness,dryRoad,'Dry daylight must not make asphalt glossy');
assert.equal(facade.roughness,dryFacade,'Rain must not change unrelated facades');
library.setQuality('performance');library.setWetness(0);
assert.equal(road.roughness,dryRoad,'Performance should restore dry-road roughness');
assert.equal(road.bumpMap,null);
library.dispose();
assert.equal(JSON.stringify({boxes:map.boxes,spawns:map.spawns,routes:map.routes}),before,
 'Atmosphere may not mutate gameplay map or spawn definitions');
fx.dispose();
assert.equal(scene.children.length,0,'Atmospheric meshes should be cleaned on arena unload');
console.log('Daybreak 6.6: dry streets, clear sky, lightweight dust and pale distance haze,');
console.log('adaptive quality, daylight grading and unchanged collision topology passed.');
