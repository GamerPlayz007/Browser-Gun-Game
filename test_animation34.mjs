import assert from 'node:assert/strict';
import * as T from 'three';
import {makeAvatarAnim,markAvatar,trackAvatar,avatarPose,feedbackGain} from './static/animation34.js';
import {makeWeapon,animateWeapon,makePlayer,animatePlayer,markPlayerEvent,disposePlayer} from './static/models.js';

const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const data={spawn:1,grounded:true,vx:0,vy:0,vz:0,crouch:false,
 yaw:0,pitch:0,slide:0};
const anim=makeAvatarAnim();
trackAvatar(anim,data,0);
assert.equal(avatarPose(data,0,anim).state,'idle');
assert.ok(avatarPose(data,0,anim).spawnPulse>0);
assert.equal(avatarPose({...data,vx:7.8},.2,anim).state,'run');
assert.equal(avatarPose({...data,vx:2.5},.2,anim).state,'walk');
const run=avatarPose({...data,vx:8},.2,anim);
assert.ok(Math.abs(run.legSwing)>.01&&Math.abs(run.armSwing)>.01);
assert.equal(avatarPose({...data,vx:4,crouch:true,slide:.4},.4,anim).state,'slide');
assert.ok(avatarPose({...data,vx:4,crouch:true,slide:.4},.4,anim).kneeBend<-.5);
assert.equal(avatarPose({...data,crouch:true},.4,anim).state,'crouch');
trackAvatar(anim,{...data,grounded:false,vy:6},.5);
assert.equal(avatarPose({...data,grounded:false,vy:6},.5,anim).state,'air');
trackAvatar(anim,data,.7);
assert.ok(feedbackGain(anim,.7).land>0);
near(feedbackGain(anim,1.1).land,0);
markAvatar(anim,'shot',1.2);markAvatar(anim,'hit',1.2);
assert.ok(avatarPose(data,1.2,anim).gunKick>0);
assert.ok(avatarPose(data,1.2,anim).hitGlow>0);
near(avatarPose(data,1.8,anim).gunKick,0);
near(avatarPose(data,1.8,anim).hitGlow,0);
trackAvatar(anim,{...data,spawn:2},2);
assert.ok(avatarPose(data,2,anim).spawnPulse>0);
near(avatarPose(data,2,anim).gunKick,0);

const ctx=new Proxy({}, {get:()=>()=>{}});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
const firstPerson=makeWeapon(0);
animateWeapon(firstPerson,{time:1,ads:0,reload:0,kick:.10,moving:false,slide:0,motion:false,switched:0});
assert.ok(firstPerson.userData.model.position.y>0,'Phase 5.2 receiver visual kick exists');
assert.ok(firstPerson.userData.model.rotation.x<0,'Phase 5.2 model rotates on visual recoil');
assert.ok(firstPerson.userData.left.rotation.x<0,'Support hand follows visual recoil');
animateWeapon(firstPerson,{time:2,ads:0,reload:0,kick:0,moving:false,slide:0,motion:false,switched:0});
near(firstPerson.userData.model.position.y,0);
near(firstPerson.userData.model.rotation.x,0);
const root=makePlayer('Test Pilot');
assert.equal(root.userData.legs.length,2);
assert.equal(root.userData.knees.length,2);
assert.equal(root.userData.arms.length,2);
assert.equal(root.userData.elbows.length,2);
let pose=animatePlayer(root,{...data,vx:8},1);
assert.equal(pose.state,'run');
assert.ok(root.userData.spawnRing.visible);
assert.ok(root.userData.legs.some(l=>Math.abs(l.rotation.x)>.01));
pose=animatePlayer(root,{...data,vx:4,slide:.2,crouch:true},1.1);
assert.equal(pose.state,'slide');
assert.ok(root.userData.tag.position.y<2);
pose=animatePlayer(root,data,1.2);
assert.equal(pose.state,'idle');
near(root.userData.body.rotation.x,0);
markPlayerEvent(root,'shot',1.3);
markPlayerEvent(root,'hit',1.3);
animatePlayer(root,data,1.3);
assert.ok(root.userData.gun.userData.flash.visible);
assert.ok(root.userData.impact.material.opacity>.4);
animatePlayer(root,data,1.7);
assert.equal(root.userData.gun.userData.flash.visible,false);
near(root.userData.impact.material.opacity,0);
animatePlayer(root,{...data,spawn:2},2);
assert.ok(root.userData.spawnRing.visible,'new spawn starts signal');
animatePlayer(root,{...data,spawn:2},2.7);
assert.equal(root.userData.spawnRing.visible,false);
near(root.scale.x,1);
root.traverse(o=>{
 if(!o.position||!o.rotation||!o.scale)return;
 for(const v of [...o.position.toArray(),o.rotation.x,o.rotation.y,o.rotation.z,...o.scale.toArray()])
  assert.ok(Number.isFinite(v),'model transforms must remain finite');
});
disposePlayer(root);

// Eight remote procedurally animated rigs at 60 fps for two seconds.
const players=Array.from({length:8},(_,i)=>makePlayer('Player '+(i+1)));
for(let i=0;i<120;i++){
 const time=i/60;
 players.forEach((p,j)=>{
  const character={...data,spawn:1,
    vx:j%2?8:3,vz:j%3===0?2:0,
    crouch:j===3,slide:j===3?.3:0,
    grounded:j===5?i>=60:true,
    vy:j===5&&i<60?6-i*.13:0};
  if(i===40&&j===2)markPlayerEvent(p,'shot',time);
  if(i===51&&j===4)markPlayerEvent(p,'hit',time);
  const result=animatePlayer(p,character,time);
  assert.ok(Number.isFinite(result.bodyY)&&Number.isFinite(result.torsoPitch));
 });
}
for(const p of players)disposePlayer(p);
console.log('Stage 3.4: procedural idle/run/slide/air, two-part limbs, server event feedback,');
console.log('spawn resets, 8-rig 60fps stress, and finite Three.js transforms passed.');
