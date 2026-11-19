import test from 'node:test';
import assert from 'node:assert/strict';
import {
 octavusRenderBounds,octavusTriangleVisible,octavusVisibleFaceOffsets
} from '../static/octavus_culling.js';
import {planOctavusTextureTasks} from '../static/octavus_texture_budget.js';

const bounds=octavusRenderBounds({x0:-102.4,x1:102.4,z0:-102.4,z1:102.4},10);
const vertices=new Float32Array([
 -130,0,0, -120,0,5, -125,0,-4, // fully off the left edge
 -3,0,-2, 3,0,-2, 0,0,3,         // central courtyard
 -150,0,20, 150,0,20, 0,0,160,   // crosses arena, keep complete triangle
]);
const faces=new Uint16Array([0,1,2,3,4,5,6,7,8]);

test('render bounds respect compact wall and a 10m visual margin',()=>{
 assert.equal(bounds.x0,-112.4);
 assert.equal(bounds.z1,112.4);
 assert.throws(()=>octavusRenderBounds({x0:10,x1:-10,z0:0,z1:10}));
});

test('outside source triangles do not consume world-render geometry',()=>{
 assert.equal(octavusTriangleVisible(vertices,0,1,2,1,bounds),false);
 assert.equal(octavusTriangleVisible(vertices,3,4,5,1,bounds),true);
});

test('border-crossing original faces remain visible without triangle clipping',()=>{
 assert.equal(octavusTriangleVisible(vertices,6,7,8,1,bounds),true);
});

test('visible offsets retain original triangle order for authored UV lookup',()=>{
 assert.deepEqual(octavusVisibleFaceOffsets(vertices,faces,1,bounds),[3,6]);
 assert.deepEqual(octavusVisibleFaceOffsets(vertices,faces,1,null),[0,3,6]);
});

const url=x=>'/static/maps/octavus_assets/'+x+'.webp';
const manifest={materials:{
 1:{channels:{
  color:{url:url('wall-color')},
  normal:{url:url('wall-normal')},
  roughness:{url:url('wall-rough')},
  glow:{url:url('wall-glow')}
 }},
 2:{channels:{color:{url:url('off-map')}}},
 3:{channels:{color:{url:url('stone')}}}
}};

test('Performance only requests diffuse/glow images from visible source slots',()=>{
 const plan=planOctavusTextureTasks(manifest,'performance',[1,3]);
 assert.deepEqual(plan.tasks.map(x=>x.role),['color','glow','color']);
 assert.equal(plan.availableImages,5);
 assert.equal(plan.skippedImages,2);
 assert.equal(plan.profile,'lean');
 assert.equal(plan.tasks.some(x=>x.url.includes('off-map')),false);
});

test('High and Ultra restore original normals and roughness maps',()=>{
 for(const quality of ['high','ultra']){
  const plan=planOctavusTextureTasks(manifest,quality,[1,3]);
  assert.equal(plan.tasks.length,5);
  assert.equal(plan.skippedImages,0);
  assert.equal(plan.profile,'detailed');
 }
});

test('Auto quality defaults to a lean texture request budget',()=>{
 const plan=planOctavusTextureTasks(manifest,'auto',[1]);
 assert.equal(plan.tasks.length,2);
 assert.equal(plan.skippedImages,2);
});

test('source texture planning never changes manifest or source indices',()=>{
 const before=JSON.stringify(manifest);
 planOctavusTextureTasks(manifest,'high',[1]);
 planOctavusTextureTasks(manifest,'performance',[3]);
 assert.equal(JSON.stringify(manifest),before);
});
