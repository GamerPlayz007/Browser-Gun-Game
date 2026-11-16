import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {DAYBREAK_SKY66,createDaybreakSky66} from './static/daybreak66.js';
import {LIGHTING_PRESETS,createCinematicLighting} from './static/lighting42.js';
import {ATMOSPHERE_PRESETS} from './static/atmosphere44.js';
import {CINEMATIC_PRESETS} from './static/postfx.js';
const map=JSON.parse(fs.readFileSync('static/map.json','utf8'));
const registry=JSON.parse(fs.readFileSync('static/maps/index.json','utf8'));
assert.equal(map.id,'cyberpunk','Keep room protocol stable');
assert.equal(map.name,'Daybreak City');
assert.equal(map.theme,'modern-daylight');
assert.equal(map.lighting,'clear-sky-noon');
assert.equal(registry.default,'cyberpunk');
assert.equal(registry.maps[0].name,'Daybreak City');
assert.equal(registry.maps[0].theme,'modern-daylight');
assert.deepEqual(map.zones.map(z=>z.name),
 ['MARKET STREET','CENTRAL PLAZA','BUSINESS DISTRICT','CENTRAL STATION']);
assert.equal(DAYBREAK_SKY66.clear,true);
const sky=createDaybreakSky66(T);
assert.ok(sky.isMesh&&sky.material.isShaderMaterial);
assert.equal(sky.userData.collidable,false);
assert.ok(sky.material.fragmentShader.includes('zenith'));
assert.equal(sky.frustumCulled,false);
sky.geometry.dispose();sky.material.dispose();
const scene=new T.Scene();
scene.fog=new T.FogExp2('#cbdce8',.0025);
const root=new T.Group();scene.add(root);
const lighting=createCinematicLighting(T,scene,root,map);
assert.equal(lighting.moon.name,'daybreak66-directional-sun');
for(const mode of ['performance','auto','high','ultra','native']){
 lighting.setQuality(mode);
 assert.equal(lighting.districtLights.filter(l=>l.visible).length,0,
  'No synthetic district point lights in midday');
 assert.equal(lighting.signLights.filter(l=>l.visible).length,0,
  'Ordinary signage must not glow');
 assert.equal(lighting.pools.filter(m=>m.visible).length,0);
 assert.equal(lighting.strips.visible,false);
 assert.ok(lighting.hemi.intensity>=1.6);
 assert.ok(lighting.moon.intensity>=1.8);
 assert.ok(scene.fog.density<=.003);
 assert.equal(ATMOSPHERE_PRESETS[mode].rain,0);
 assert.equal(ATMOSPHERE_PRESETS[mode].wetness,0);
 assert.equal(ATMOSPHERE_PRESETS[mode].puddles,false);
 assert.ok(CINEMATIC_PRESETS[mode].bloom<=.12);
}
assert.equal(LIGHTING_PRESETS.performance.shadow,false);
assert.equal(LIGHTING_PRESETS.ultra.shadow,true);
lighting.dispose();
assert.equal(root.children.length,0);
const html=fs.readFileSync('static/index.html','utf8');
assert.ok(html.includes('Daybreak City'));
assert.ok(!html.includes('Cyberpunk City'));
assert.ok(map.palette.concrete.startsWith('#'));
assert.ok(map.routes.length>=13&&map.stairs.length>=7);
assert.ok(map.boxes.length>650);
console.log('Daybreak 6.6: stable arena identity, clear sky, sunny palettes, dry weather, modern districts and preservation of gameplay geometry passed.');
