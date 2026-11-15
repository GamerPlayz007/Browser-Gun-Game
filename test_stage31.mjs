import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {buildWorld} from './static/world.js';

const canvasContext=new Proxy({}, {get:()=>()=>{}});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>canvasContext})};
const map=JSON.parse(fs.readFileSync('static/maps/cyberpunk-next.json','utf8'));
assert.equal(map.id,'cyberpunk-next');
assert.equal(map.size,120);
assert.equal(map.routes.length,13);
assert.ok(map.boxes.length>500);
assert.ok(map.decor.some(b=>b.stage5VisualOnly));
assert.ok(map.decor.some(b=>b.stage6VisualOnly));

const scene=new THREE.Scene();
const world=buildWorld(scene,map,{quality:'ultra'});
const stage5=scene.getObjectByName('stage5-noncolliding-architecture');
const stage6=scene.getObjectByName('stage6-visual-city-context');
assert.ok(stage5&&stage5.children.length>0,'Missing instanced architectural detail');
assert.ok(stage6&&stage6.children.length>0,'Missing instanced city context');
const count=(group)=>group.children.filter(x=>x.visible).length;
const ultra=count(stage5)+count(stage6);
world.setQuality('performance');
const performance=count(stage5)+count(stage6);
assert.ok(performance<ultra,'Performance preset must hide higher detail tiers');
world.setQuality('ultra');
assert.equal(count(stage5)+count(stage6),ultra);
world.setDetail(false);
assert.equal(count(stage5)+count(stage6),0);
world.setDetail(true);
assert.equal(count(stage5)+count(stage6),ultra);
scene.traverse(o=>{
  if(!o.isMesh)return;
  for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));
});
world.dispose();
console.log('Stage 3.1: experimental map, instanced details, and quality toggles passed.');
