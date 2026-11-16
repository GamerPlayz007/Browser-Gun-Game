/**
 * CROSSFire 6.3: native Dust Corridor walking preview with exact source geometry.
 * Original triangle soup -> original BVH -> original swept-capsule controller.
 * No approximate buildings, fake door blockers, or second rendering engine.
 *
 * Preview is client-only until server collision parity is verified.
 * Upstream original physics Copyright (c) 2026 Leonxlnx, MIT.
 */
import * as THREE from 'three';
import {BVH} from './dust_corridor/src/physics/BVH.js';
import {CharacterController} from './dust_corridor/src/physics/CharacterController.js';

const TICK=1/60,GRAVITY=22,DISPLACEMENT=new THREE.Vector3();
const approach=(value,target,delta)=>value<target?Math.min(target,value+delta):Math.max(target,value-delta);

export function createDustWalk63(data){
  if(!data?.soup?.count||!data?.spawns?.A?.length)throw Error('Source collision or spawns missing');
  const bvh=new BVH(data.soup);
  const capsule=new CharacterController(bvh,{
    radius:.34,height:1.8,crouchHeight:1.12,stepOffset:.36,slopeLimit:48
  });
  let crouched=false,jumpQueued=false,steps=0;
  function resetSpawn(side='A'){
    const pos=data.spawns[side]?.[0];
    if(!pos)throw Error('Invalid Dust Corridor spawn side: '+side);
    capsule.position.copy(pos);
    capsule.velocity.set(0,0,0);
    capsule.setHeight(1.8);
    crouched=false;jumpQueued=false;capsule.grounded=true;
    capsule.move(TICK,DISPLACEMENT.set(0,-.02,0));
  }
  function toggleCrouch(){
    if(!crouched){crouched=true;capsule.setHeight(1.12);}
    else if(capsule.canStand()){crouched=false;capsule.setHeight(1.8);}
    return crouched;
  }
  function requestJump(){jumpQueued=true;}
  function step(dt,{forward=0,strafe=0,sprint=false,yaw=0}={}){
    if(Math.abs(dt-TICK)>1e-6)throw Error('Dust physics requires 60Hz fixed timestep');
    const v=capsule.velocity;
    const len=Math.max(1,Math.hypot(forward,strafe));
    forward/=len;strafe/=len;
    const speed=crouched?3.15:sprint?8.2:5.35;
    const desiredX=(-forward*Math.sin(yaw)+strafe*Math.cos(yaw))*speed;
    const desiredZ=(-forward*Math.cos(yaw)-strafe*Math.sin(yaw))*speed;
    const delta=(capsule.grounded?55:12)*dt;
    v.x=approach(v.x,desiredX,delta);v.z=approach(v.z,desiredZ,delta);
    if(jumpQueued&&capsule.grounded){
      if(crouched&&capsule.canStand()){crouched=false;capsule.setHeight(1.8);}
      if(!crouched){v.y=7.5;capsule.grounded=false;}
    }
    jumpQueued=false;
    if(!capsule.grounded)v.y=Math.max(-35,v.y-GRAVITY*dt);
    else v.y=Math.min(v.y,0);
    capsule.move(dt,DISPLACEMENT.copy(v).multiplyScalar(dt));
    steps++;return capsule.position;
  }
  resetSpawn('A');
  return {
    get position(){return capsule.position;},
    get grounded(){return capsule.grounded;},
    get crouched(){return crouched;},
    get triangles(){return data.soup.count;},
    get steps(){return steps;},
    get bvh(){return bvh;},
    requestJump,toggleCrouch,resetSpawn,step
  };
}
