import assert from 'node:assert/strict';
import * as T from 'three';
import {captureRenderHealth46,assessFrameBudget46} from './static/polish46.js';
const scene=new T.Scene();
const root=new T.Group();scene.add(root);
const material=new T.MeshBasicMaterial();
const box=new T.Mesh(new T.BoxGeometry(1,1,1),material);
box.castShadow=true;root.add(box);
const hidden=new T.Group();hidden.visible=false;root.add(hidden);
hidden.add(new T.Mesh(new T.BoxGeometry(1,1,1),material));
const inst=new T.InstancedMesh(new T.BoxGeometry(1,1,1),material,10);root.add(inst);
const rain=new T.Points(new T.BufferGeometry(),new T.PointsMaterial());root.add(rain);
const renderer={info:{render:{calls:114,triangles:120000},memory:{textures:22,geometries:35},
 programs:[{},{},{}]}};
const world={atmosphere44:{rain:{geometry:{drawRange:{count:850}}},
 motes:{geometry:{drawRange:{count:320}}}},living45:{ads:[{mesh:{visible:true}},{mesh:{visible:false}}],
 drones:[{group:{visible:true}}]}};
const display={label:()=> 'ULTRA 125% DPR',buffer:{width:1920,height:1080}};
const first=captureRenderHealth46(renderer,scene,world,display);
assert.equal(first.drawCalls,114);assert.equal(first.triangles,120000);
assert.equal(first.textures,22);assert.equal(first.geometries,35);
assert.equal(first.shaderPrograms,3);
assert.equal(first.meshes,3);assert.equal(first.visibleMeshes,2);
assert.equal(first.points,1);assert.equal(first.shadowCasters,1);
assert.equal(first.instancedObjects,1);assert.equal(first.visibleInstances,10);
assert.equal(first.pixelWidth,1920);assert.equal(first.pixelHeight,1080);
assert.equal(first.atmosphereRain,850);assert.equal(first.atmosphereMotes,320);
assert.equal(first.activeAds,1);assert.equal(first.activeDrones,1);
assert.deepEqual(assessFrameBudget46({...first,p95Ms:16.5}),{warnings:[],healthy:true});
const warning=assessFrameBudget46({drawCalls:730,triangles:1700000,p95Ms:35});
assert.equal(warning.warnings.length,3);
assert.equal(warning.healthy,false);
assert.equal(assessFrameBudget46({drawCalls:undefined}).healthy,true);
assert.ok(scene.children.length===1,'Telemetry must not add scene objects');
assert.equal(hidden.visible,false,'Telemetry must not unhide objects');
for(const node of [box,inst,rain,...hidden.children]){node.geometry.dispose();}
material.dispose();rain.material.dispose();
console.log('Phase 4.6 telemetry: visible scene counts, true frame draw statistics,');
console.log('GPU resource totals, atmosphere tiers, budget warnings and read-only behavior passed.');
