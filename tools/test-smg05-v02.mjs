import assert from 'node:assert/strict';
import * as T from 'three';
import {attachSMG05V02} from '../static/smg05_v02_model.js';

const gun=new T.Group(),magazine=new T.Group();
const flash=new T.Mesh(new T.OctahedronGeometry(.01),new T.MeshBasicMaterial());
const root={userData:{id:1,aetherArtGun71:gun,magazine,flash}};
attachSMG05V02(root);
for(let i=0;i<100&&!root.userData.smg05Ready&&!root.userData.smg05Error;i++)
 await new Promise(resolve=>setTimeout(resolve,40));
assert.ifError(root.userData.smg05Error);
assert.ok(root.userData.smg05Ready,'Approved v0.2 mesh must finish loading');
assert.ok(gun.getObjectByName('CROSSFIRE_SMG05_V02_BODY'));
assert.ok(magazine.getObjectByName('CROSSFIRE_SMG05_V02_MAGAZINE'));
let triangles=0,meshes=0;
for(const group of [gun,magazine])group.traverse(node=>{
 if(!node.isMesh||!node.userData.smg05Shared)return;
 meshes++;
 triangles+=(node.geometry.index?.count||node.geometry.attributes.position.count)/3;
 assert.ok(node.material.map,'SMG material should include original color texture');
 assert.ok(node.material.normalMap,'SMG material should include normal texture');
 assert.ok(node.material.roughnessMap,'SMG material should include roughness texture');
});
assert.equal(triangles,10542,'Must reproduce the exact approved SMG mesh triangles');
assert.ok(meshes>=10&&meshes<=30,'Must batch materials efficiently');
console.log('CROSSFire SMG-05 v0.2 pass',{triangles,materialBatches:meshes});