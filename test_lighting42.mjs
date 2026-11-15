import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {createCinematicLighting,LIGHTING_PRESETS,DISTRICT_LIGHTS} from './static/lighting42.js';

const map=JSON.parse(fs.readFileSync('static/map.json','utf8'));
const startBoxes=map.boxes.length,startDecor=map.decor.length;
const scene=new T.Scene();scene.fog=new T.FogExp2('#0b1727',.0085);
const root=new T.Group();scene.add(root);
const lights=createCinematicLighting(T,scene,root,map);
assert.equal(lights.districtLights.length,4);
assert.equal(lights.spotAnchors.length,4);
assert.equal(lights.signLights.length,map.signs.length);
assert.equal(lights.pools.length,4);
assert.equal(lights.strips.children.length,map.signs.length);
assert.deepEqual(DISTRICT_LIGHTS.map(p=>p.zone),map.zones.map(z=>z.id));
for(const name of ['performance','auto','high','ultra','native']){
 lights.setQuality(name);
 assert.equal(lights.quality,name);
 const mode=LIGHTING_PRESETS[name];
 assert.equal(lights.moon.castShadow,mode.shadow);
 assert.equal(lights.moon.shadow.mapSize.width,mode.shadowSize);
 assert.equal(lights.districtLights.filter(p=>p.visible).length,mode.pointBudget);
 assert.equal(lights.signLights.filter(p=>p.visible).length,mode.signBudget);
 assert.equal(lights.spotAnchors.filter(p=>p.visible).length,mode.spots);
 assert.equal(lights.pools.filter(p=>p.visible).length,mode.groundGlow);
}
lights.setQuality('ultra');
for(const light of [...lights.districtLights,...lights.signLights,...lights.spotAnchors])
 assert.equal(light.castShadow,false,'Decorative lights must not allocate shadow maps');
for(const mesh of [...lights.pools,...lights.strips.children])
 assert.equal(mesh.userData.collidable,false);
const initial=lights.districtLights.map(l=>l.intensity);
lights.animate(12.5);const first=lights.districtLights.map(l=>l.intensity);
assert.notDeepEqual(initial,first,'Slow neon fluctuation should animate');
lights.animate(12.5);
assert.deepEqual(first,lights.districtLights.map(l=>l.intensity),'Animated light timing must be deterministic');
assert.equal(map.boxes.length,startBoxes);
assert.equal(map.decor.length,startDecor);
lights.dispose();
assert.equal(root.children.length,0,'All created light objects should be removed on dispose');
console.log('Phase 4.2 lighting: 4 districts, tiered fixtures, moon shadows,');
console.log('subtle flicker, 0 shadowing accent lights, collision isolation and cleanup passed.');
