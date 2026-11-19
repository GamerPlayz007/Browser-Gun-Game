import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {octavusPropInside,octavusPropVisible} from '../static/octavus_prop_lod.js';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const manifest=JSON.parse(read('static/maps/octavus.props.json'));
const entities=JSON.parse(read('static/maps/octavus.native-entities.json'));
const map=JSON.parse(read('static/maps/octavus.json'));
const aliases=[...read('static/maps/octavus.original.cfg')
 .matchAll(/^mapmodel\s+"([^"]+)"/gm)].map(x=>x[1]);
const all=entities.visualEntities.filter(e=>e.type==='mapmodel'&&
 Array.isArray(e.attrs)&&Number.isInteger(e.attrs[0])&&aliases[e.attrs[0]]);
const inside=all.filter(e=>octavusPropInside(e.sourcePosition,map.playBounds));
const converted=inside.filter(e=>{
 const info=manifest.models[aliases[e.attrs[0]]];
 return info&&!info.missing&&info.codec==='gzip-obj'&&
        info.url.startsWith('/static/maps/octavus_props/');
});
const groups=new Map();
for(const e of converted){
 const alias=aliases[e.attrs[0]];
 if(!groups.has(alias))groups.set(alias,[]);
 groups.get(alias).push(e);
}
const RAD=Math.PI/180;
const locate=e=>new THREE.Vector3(
 (e.sourcePosition[0]-4096)*.05,
 (e.sourcePosition[2]-2816)*.05,
 (e.sourcePosition[1]-4096)*.05
);
function place(node,e,info){
 node.position.copy(locate(e));
 node.rotation.order='YXZ';
 node.rotation.set((Number(e.attrs[2])||0)*RAD,
  -(Number(e.attrs[1])||0)*RAD,(Number(e.attrs[3])||0)*RAD);
 const baseScale=(Number(info.sourceScale)||100)/100*.05;
 const attrScale=Number(e.attrs[5])>0?Number(e.attrs[5])/100:1;
 node.scale.setScalar(baseScale*attrScale);
 node.updateMatrixWorld(true);
}

test('the compact playable area keeps 147 of 149 MPZ model placements',()=>{
 assert.equal(all.length,149);
 assert.equal(inside.length,147);
 assert.equal(all.length-inside.length,2);
});

test('original model availability is explicit, not replaced with boxes',()=>{
 assert.equal(converted.length,134);
 assert.equal(inside.length-converted.length,13);
 assert.equal(groups.size,15);
});

test('quality distance logic preserves original near models and low-end weed LOD',()=>{
 assert.equal(octavusPropVisible(4,4,0,0,'performance','nobiax/tiny_weed_01'),true);
 assert.equal(octavusPropVisible(100,100,0,0,'performance','nobiax/tiny_weed_01'),false);
 assert.equal(octavusPropVisible(100,100,0,0,'high','nobiax/tiny_weed_01'),true);
 assert.equal(octavusPropVisible(1,1,0,0,'auto','dziq/glow_plate'),true);
});

test('all converted original OBJ files parse, and instanced transforms match legacy clones',()=>{
 const loader=new OBJLoader();
 let sourceMeshes=0,unbatchedDrawObjects=0,instancedBatches=0;
 let triangles=0;
 for(const [alias,placements] of groups){
  const def=manifest.models[alias],filename=def.url.replace(/^\//,'');
  const text=gunzipSync(readFileSync(new URL(filename,root))).toString('utf8');
  const prototype=loader.parse(text);
  prototype.rotation.x=-Math.PI/2;
  const parts=[];
  prototype.traverse(p=>{if(p.isMesh)parts.push(p);});
  assert.ok(parts.length>0,alias+' source OBJ must contain meshes');

  sourceMeshes+=parts.length;
  unbatchedDrawObjects+=parts.length*placements.length;
  instancedBatches+=parts.length;
  for(const part of parts){
   const pos=part.geometry.getAttribute('position');
   assert.ok(pos&&pos.count>=3,alias+' mesh must contain vertex positions');
   triangles+=Math.floor(pos.count/3);
  }
  const staging=new THREE.Group();
  staging.add(prototype);
  // Compare first + last instance of every model type, preserving nested
  // transforms as well as authored Euler order.
  for(const index of new Set([0,placements.length-1])){
   const e=placements[index];
   place(staging,e,def);
   const legacy=new THREE.Group();
   legacy.add(prototype.clone(true));
   place(legacy,e,def);
   const oldParts=[];
   legacy.traverse(p=>{if(p.isMesh)oldParts.push(p);});
   assert.equal(oldParts.length,parts.length);
   for(let k=0;k<parts.length;k++){
    const expected=oldParts[k].matrixWorld.elements;
    const actual=parts[k].matrixWorld.elements;
    for(let i=0;i<16;i++)
     assert.ok(Math.abs(expected[i]-actual[i])<1e-7,
      alias+' authored transform matrix changed at element '+i);
   }
  }
 }
 assert.ok(instancedBatches>0);
 assert.ok(unbatchedDrawObjects>instancedBatches,
  'instancing must reduce original model draw objects');
 // This is a source-object budget, not measured browser WebGL calls/FPS.
 assert.ok(unbatchedDrawObjects/instancedBatches>3);
 console.log(JSON.stringify({
  sourceMeshParts:sourceMeshes,
  unbatchedModelObjects:unbatchedDrawObjects,
  instancedModelBatches:instancedBatches,
  potentialBatchReductionPercent:Math.round(
   100*(1-instancedBatches/unbatchedDrawObjects)),
  importedOBJTriangles:triangles
 }));
});
