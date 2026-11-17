/* Octavus Phase 3.1: matched browser-side capsule, stair and roof tests. */
import assert from 'node:assert/strict';
import {createDustPhysics65} from './static/dust_motion65.js';
const DT=1/60;
function quad(a,b,c,d){return [a,b,c,a,c,d];}
function fixture(stepHeight,ceiling=false){
 const tris=[
  ...quad([-5,0,-5],[-5,0,5],[5,0,5],[5,0,-5]),
  ...quad([0,stepHeight,-3],[5,stepHeight,-3],[5,stepHeight,3],[0,stepHeight,3]),
  ...quad([0,0,-3],[0,stepHeight,-3],[0,stepHeight,3],[0,0,3])
 ];
 if(ceiling)tris.push(...quad([-2,1.24,-2],[2,1.24,-2],[2,1.24,2],[-2,1.24,2]));
 const positions=new Float32Array(tris.flat());
 const world={soup:{positions,count:tris.length/3,surfaces:new Uint8Array(tris.length/3)},
  nativeOctavus:true,
  playBounds:{x0:-5,x1:5,z0:-5,z1:5}};
 return createDustPhysics65(world);
}
function p(x=-.6,crouch=false){return {x,y:0,z:0,vx:0,vy:0,vz:0,yaw:0,
 crouch,grounded:true,slide_until:0,slide_ready:0,jump_held:false,slide_held:false,
 jump_consumed:false,jump_cut:false};}
for(const [height,shouldClimb] of [[.24,true],[2.2,false]]){
 const physics=fixture(height),player=p();
 for(let i=0;i<55;i++)physics.simulate(player,{d:true},DT,100+i*DT,{speed:1});
 if(shouldClimb){
  assert.ok(player.x>.5,'A real 0.24-unit source riser must be climbable');
  assert.ok(Math.abs(player.y-height)<.06,'Player feet snap to stair top');
 }else{
  assert.ok(player.x<-.28,'A tall source wall remains solid');
  assert.ok(Math.abs(player.y)<.05,'Tall wall does not teleport player upward');
 }
}
{
 const physics=fixture(.24,true),player=p(-2,true);
 assert.ok(physics.capsuleClear(-2,0,0,1.12));
 assert.equal(physics.capsuleClear(-2,0,0,1.8),false);
 physics.simulate(player,{crouch:false},DT,100,{speed:1});
 assert.equal(player.crouch,true,'Player must not uncrouch into a source roof');
}
console.log('Octavus 3.1: exact client mesh stairs, tall walls and roof clearance passed.');
