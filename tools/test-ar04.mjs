import assert from 'node:assert/strict';
import * as T from 'three';
import {attachAR01V04} from '../static/ar01_v04_model.js';

// Node smoke test: Three.js accepts these PBR CanvasTexture sources without a GPU.
globalThis.document={createElement(name){
 assert.equal(name,'canvas');
 return {width:64,height:64,getContext:()=>({
  createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
  putImageData:()=>{}
 })};
}};
const gun=new T.Group();
const magazine=new T.Group();
const flash=new T.Mesh(new T.OctahedronGeometry(.02),new T.MeshBasicMaterial());
const rig={userData:{id:0,aetherArtGun71:gun,magazine,flash}};
attachAR01V04(rig);
for(let i=0;i<80&&!rig.userData.ar04Ready;i++){
 await new Promise(resolve=>setTimeout(resolve,50));
}
assert.ok(rig.userData.ar04Ready,'AR-01 v0.4 should finish asynchronous geometry build');
assert.ok(gun.getObjectByName('CROSSFIRE_AR01_V04_BODY'),'AR body geometry must exist');
assert.ok(magazine.getObjectByName('CROSSFIRE_AR01_V04_MAGAZINE'),'AR magazine mesh must attach to animated rig');
let meshCount=0, triangles=0;
for(const group of [gun,magazine])group.traverse(node=>{
 if(node.isMesh&&node.userData.ar04Shared){meshCount++;triangles+=(node.geometry.index?.count||node.geometry.attributes.position.count)/3;}
});
assert.ok(meshCount>=15,'Expected many distinct combined PBR art materials');
assert.ok(triangles>1000,'Expected detailed actual 3D geometry');
console.log('AR-01 V0.4 smoke: pass', {materialBatches:meshCount,triangles:Math.round(triangles)});
