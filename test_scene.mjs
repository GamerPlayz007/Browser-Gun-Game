import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {buildWorld} from './static/world.js';
import {makeWeapon,makePlayer,animateWeapon,animatePlayer} from './static/models.js';
import {simulate} from './static/physics.js';
const ctx=new Proxy({}, {get:(_,key)=>()=>{}});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
const map=JSON.parse(fs.readFileSync('static/map.json'));
const scene=new THREE.Scene(),world=buildWorld(scene,map,{quality:'ultra'});
let meshes=0,triangles=0,standard=0,casts=0,textureSets=0;
scene.traverse(o=>{if(!o.isMesh)return;meshes++;const p=o.geometry.attributes.position;assert.ok(p,'position attribute');
 for(const value of p.array)assert.ok(Number.isFinite(value));triangles+=(o.geometry.index?.count||p.count)/3;
 if(o.material.isMeshStandardMaterial){standard++;if(o.material.map&&o.material.roughnessMap&&o.material.bumpMap&&o.material.emissiveMap)textureSets++;}
 if(o.castShadow)casts++;
});
assert.ok(meshes<280,`Scene merge budgets: ${meshes} meshes`);assert.ok(triangles<500000,`Triangles ${triangles}`);
assert.ok(world.staticBatches<240,`Static batch budget ${world.staticBatches}`);
assert.ok(map.decor.length>1500,'Dense noncolliding architectural detail from the current map');
assert.ok(standard>8&&textureSets>8,'PBR materials with four map channels');
assert.ok(casts>0&&world.sun.castShadow,'Directional light casts shadows on Ultra');
assert.ok(world.lighting&&world.lighting.districtLights.length===4,'Live world uses phase 4.2 district lighting');
assert.ok(world.environment43?.stats.parts>=700,'Live world includes phase 4.3 environmental storytelling');
assert.equal(world.environment43.stats.signs,24,'City adds 24 distinctive business signs');
assert.ok(world.atmosphere44&&world.atmosphere44.puddles.length>=25,'Phase 4.4 weather lives in the active scene');
assert.ok(world.living45&&world.living45.ads.length===12,'Phase 4.5 live adverts present');
assert.equal(world.living45.fans.length,4,'Phase 4.5 ventilation motor anchors present');
assert.equal(world.living45.drones.length,4,'Phase 4.5 rooftop service actors present');
assert.equal(world.lighting.signLights.length,map.signs.length,'All existing signs have lighting anchors');
assert.equal(world.sun.shadow.mapSize.width,2048);
assert.equal(world.targets.size,2);
assert.equal(new Set(scene.children[0].children.filter(o=>o.isMesh&&o.userData.zone).map(o=>o.userData.zone)).size,4);
assert.ok(scene.children[0].children.some(o=>o.isPointLight),'Selective neon point lights');
world.setQuality('performance');assert.equal(world.sun.castShadow,false);
assert.equal(world.living45.ads.filter(a=>a.mesh.visible).length,4,'Performance displays one sign per district');
assert.equal(world.atmosphere44.rain.visible,false,'Performance disables optional GPU rain');
world.setQuality('ultra');assert.equal(world.sun.castShadow,true);
assert.equal(world.living45.ads.filter(a=>a.mesh.visible).length,12,'Ultra displays full animated advertisements');
assert.equal(world.atmosphere44.rain.geometry.drawRange.count,850,'Ultra restores 850 precipitation sprites');
console.log(`03.2 world: ${world.staticBatches} batches, ${world.featureCount} authored features, ${meshes} meshes, ${Math.round(triangles)} triangles.`);
for(let id=0;id<4;id++){const gun=makeWeapon(id);assert.equal(gun.userData.id,id);for(const reload of [0,.25,.5,.9])animateWeapon(gun,{time:1,ads:1,reload,kick:.02,moving:true,slide:0,motion:true,switched:0});}
const player=makePlayer('Test');animatePlayer(player,{vx:5,vz:0,crouch:false,pitch:0,yaw:0},1);
const p={x:-24,y:1,z:13,vx:0,vy:0,vz:0,yaw:0,grounded:true,slide_until:0,slide_ready:0,jump_held:false,slide_held:false};
for(let i=0;i<105;i++)simulate(p,{w:true},1/60,100+i/60,map.boxes,map.weapons[0]);
assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z));assert.ok(p.z<11);
// Shared PBR materials must be disposed exactly once, even if used by
// hundreds of Stage 5/6 visual meshes and all base city batches.
const disposals=new Map();
scene.traverse(o=>{
 if(!o.isMesh||!o.material?.isMeshStandardMaterial)return;
 const mat=o.material;if(disposals.has(mat))return;
 const previous=mat.dispose.bind(mat);let count=0;
 mat.dispose=()=>{count++;previous();};
 disposals.set(mat,()=>count);
});
world.dispose();
for(const [mat,count] of disposals)
 assert.equal(count(),1,'World/shared PBR material disposed more or less than once');
console.log('04.6 world: balanced resource ownership, presets, route access, rigs and movement passed.');
