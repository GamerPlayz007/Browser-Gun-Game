import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {buildWorld} from './static/world.js';
import {makeWeapon,makePlayer,animateWeapon,animatePlayer} from './static/models.js';
import {simulate} from './static/physics.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const map=JSON.parse(fs.readFileSync('static/map.json'));
const scene=new THREE.Scene();const world=buildWorld(scene,map);
let meshes=0,triangles=0;
scene.traverse(o=>{if(!o.isMesh)return;meshes++;const p=o.geometry.attributes.position;assert.ok(p, 'position attribute');for(const value of p.array)assert.ok(Number.isFinite(value));triangles+=(o.geometry.index?.count||p.count)/3;});
assert.ok(meshes<90,`Static scene batching: ${meshes}`);assert.equal(world.targets.size,2);
for(let id=0;id<4;id++){const gun=makeWeapon(id);assert.equal(gun.userData.id,id);for(const reload of [0,.25,.5,.9])animateWeapon(gun,{time:1,ads:1,reload,kick:.02,moving:true,slide:0,motion:true,switched:0});}
const player=makePlayer('Test');animatePlayer(player,{vx:5,vz:0,crouch:false,pitch:0,yaw:0},1);
const p={x:-12,y:0,z:4,vx:0,vy:0,vz:0,yaw:0,grounded:true,slide_until:0,slide_ready:0,jump_held:false,slide_held:false};
for(let i=0;i<90;i++)simulate(p,{w:true},1/30,100+i/30,map.boxes,map.weapons[0]);
assert.equal(p.y,4);assert.ok(p.z<-5);console.log(`Scene checks passed: ${meshes} meshes, ${Math.round(triangles)} triangles. Client stairs, rig and four weapon animations passed.`);
