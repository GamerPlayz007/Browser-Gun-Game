/**
 * CROSSFIRE 2.3 — prototype-only responsive arena movement.
 * Deterministic fixed-step kinematic controller on collision23.mjs.
 * Pure gameplay movement: no weapons or networking.
 * Feet-space Y; world X/Z horizontal; yaw=0 faces -Z.
 */
import {moveCharacter} from './collision23.mjs';

export const MOVEMENT23=Object.freeze({
  fixedDt:1/60,
  walkSpeed:5.35, sprintSpeed:8.2, crouchSpeed:3.15,
  groundAccel:34, groundBrake:42, airAccel:9.5, airBrake:1.7,
  slideMinSpeed:5.0, slideEnterBoost:1.13, slideMaxSpeed:10.0,
  slideDuration:0.70, slideCooldown:1.05, slideDrag:2.7, slideSteer:3.6,
  jumpBuffer:0.125, coyoteTime:0.10, shortHopMultiplier:0.52,
  standHeight:1.80, slideHeight:1.12, cameraStanding:1.57, cameraSliding:0.91,
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const toward=(current,target,limit)=>current<target?Math.min(current+limit,target):Math.max(current-limit,target);
const hypot=(x,z)=>Math.hypot(x,z);
function normalizeInput(input){
  let mx=clamp(Number(input.moveX)||0,-1,1),mz=clamp(Number(input.moveZ)||0,-1,1);
  const mag=hypot(mx,mz);
  if(mag>1){mx/=mag;mz/=mag;}
  const yaw=Number(input.yaw)||0;
  return {x:Math.cos(yaw)*mx-Math.sin(yaw)*mz, z:-Math.sin(yaw)*mx-Math.cos(yaw)*mz,mag:Math.min(1,mag),
   jump:!!input.jump, sprint:!!input.sprint, slide:!!input.slide, yaw};
}
export function createMovementState(p={}){
  return {
    x:Number(p.x)||0, y:Number(p.y)||0,z:Number(p.z)||0,
    vx:0,vy:0,vz:0,grounded:p.grounded!==false,bodyHeight:MOVEMENT23.standHeight,
    mode:'walk',slideRemaining:0,slideCooldown:0,coyoteRemaining:0,
    jumpBufferRemaining:0,prevJump:false,prevSlide:false,
    jumpConsumed:false,jumpCut:false,tick:0,
  };
}
/** Allows choosing a standing position only after a real clearance check. */
export function canStand(world,s){
  return world.blockers(s.x,s.y,s.z,{height:MOVEMENT23.standHeight}).length===0;
}
/**
 * Movement input is held keys at the tick boundary; edge detection happens inside.
 * Run exactly at 60 Hz for reproducibility. Caller owns accumulation, simulation
 * time, and camera presentation. Slide may become crouch when an overhead beam
 * blocks standing; crouch then releases automatically when safe.
 */
export function stepMovement(world,old,input={},dt=MOVEMENT23.fixedDt,config=MOVEMENT23){
  if(Math.abs(dt-config.fixedDt)>1e-7)throw new Error('Movement23 requires fixed 1/60 s ticks');
  const i=normalizeInput(input),s={...old};
  if(![s.x,s.y,s.z,s.vx,s.vy,s.vz].every(Number.isFinite))throw new Error('Nonfinite movement state');
  const wasGrounded=!!s.grounded;
  const jumpEdge=i.jump&&!s.prevJump, jumpReleased=!i.jump&&s.prevJump, slideEdge=i.slide&&!s.prevSlide;
  s.prevJump=i.jump; s.prevSlide=i.slide;
  s.slideCooldown=Math.max(0,s.slideCooldown-dt);
  s.slideRemaining=Math.max(0,s.slideRemaining-dt);
  s.coyoteRemaining=wasGrounded?config.coyoteTime:Math.max(0,s.coyoteRemaining-dt);
  s.jumpBufferRemaining=jumpEdge?config.jumpBuffer:Math.max(0,s.jumpBufferRemaining-dt);
  const preSpeed=hypot(s.vx,s.vz);
  let slideStarted=false;
  if(slideEdge&&wasGrounded&&s.slideCooldown<=0&&preSpeed>=config.slideMinSpeed&&s.slideRemaining<=0){
    s.slideRemaining=config.slideDuration;
    s.slideCooldown=config.slideCooldown;
    const boost=Math.min(config.slideMaxSpeed,preSpeed*config.slideEnterBoost)/Math.max(preSpeed,1e-6);
    s.vx*=boost;s.vz*=boost;
    slideStarted=true;
  }
  const wantsLow=s.slideRemaining>0||i.slide;
  if(wantsLow){s.bodyHeight=config.slideHeight;}
  else if(canStand(world,s)){s.bodyHeight=config.standHeight;}
  else s.bodyHeight=config.slideHeight;
  let low=s.bodyHeight===config.slideHeight;
  let jumpNow=s.jumpBufferRemaining>0 && s.coyoteRemaining>0 && !s.jumpConsumed;
  if(jumpNow && low){
    if(canStand(world,s)){
      s.bodyHeight=config.standHeight;
      s.slideRemaining=0;
      low=false;
    }else{jumpNow=false;}
  }
  if(jumpNow){
    s.jumpBufferRemaining=0;
    s.coyoteRemaining=0;
    s.jumpConsumed=true;
    s.jumpCut=false;
    s.grounded=true; // handles coyote jump from a just-departed ledge
  }
  // Short hop: cutting upward velocity on release (after one completed jump tick).
  if(jumpReleased&&s.vy>0&&!s.jumpCut){
    s.vy*=config.shortHopMultiplier;
    s.jumpCut=true;
  }
  const slideActive=s.slideRemaining>0&&s.grounded&&!jumpNow;
  if(slideActive){
    const damp=Math.exp(-config.slideDrag*dt);
    s.vx*=damp;s.vz*=damp;
    s.vx+=i.x*config.slideSteer*dt;
    s.vz+=i.z*config.slideSteer*dt;
    const v=hypot(s.vx,s.vz);
    if(v>config.slideMaxSpeed){s.vx*=config.slideMaxSpeed/v;s.vz*=config.slideMaxSpeed/v;}
  }else{
    const maxSpeed=low?config.crouchSpeed:(i.sprint?config.sprintSpeed:config.walkSpeed);
    const tx=i.x*maxSpeed,tz=i.z*maxSpeed;
    const accel=s.grounded?(i.mag>0?config.groundAccel:config.groundBrake):(i.mag>0?config.airAccel:config.airBrake);
    // Vector approach enforces consistent diagonal acceleration.
    const ex=tx-s.vx,ez=tz-s.vz,d=hypot(ex,ez),change=accel*dt;
    if(d>change){s.vx+=ex*change/d;s.vz+=ez*change/d;}
    else{s.vx=tx;s.vz=tz;}
  }
  const before={x:s.x,y:s.y,z:s.z};
  const out=moveCharacter(world,s,{jump:jumpNow},dt);
  const n={...s,...out.state};
  // Remove motion normal to collided axes to prevent fake acceleration into walls.
  if(out.diagnostics.axes.includes('x'))n.vx=(n.x-before.x)/dt;
  if(out.diagnostics.axes.includes('z'))n.vz=(n.z-before.z)/dt;
  if(n.grounded&&!wasGrounded){n.jumpConsumed=false;n.jumpCut=false;}
  if(n.grounded&&n.slideRemaining<=0&&n.bodyHeight===config.standHeight)n.mode=i.sprint&&i.mag>0?'sprint':i.mag>0?'walk':'idle';
  else if(n.grounded&&n.slideRemaining>0)n.mode='slide';
  else if(n.grounded&&n.bodyHeight===config.slideHeight)n.mode='crouch';
  else n.mode=n.vy>0.12?'jump':'air';
  n.tick=(s.tick||0)+1;
  return {state:n,events:{slideStarted,jumped:jumpNow,landed:!wasGrounded&&n.grounded,
     hitWall:out.diagnostics.collisions>0,stepUps:out.diagnostics.steps,
     ceiling:out.diagnostics.ceilings>0}, diagnostics:out.diagnostics};
}
export function createCameraState(){
  return {eyeHeight:MOVEMENT23.cameraStanding,eyeY:0,fov:85,roll:0,bob:0,bobPhase:0,yaw:0,pitch:0};
}
/** Presentation-only camera: never feed this back into collision or server state. */
export function stepCamera(camera,movement,input={},dt=1/60){
  const c={...camera},speed=hypot(movement.vx,movement.vz);
  const low=movement.bodyHeight<=MOVEMENT23.slideHeight+0.01;
  const targetEye=low?MOVEMENT23.cameraSliding:MOVEMENT23.cameraStanding;
  const fov=movement.mode==='slide'?95:movement.mode==='sprint'?91:85;
  const a=1-Math.exp(-dt*12),b=1-Math.exp(-dt*7);
  c.eyeHeight+=(targetEye-c.eyeHeight)*a;
  c.eyeY=movement.y+c.eyeHeight;
  c.fov+=(fov-c.fov)*b;
  c.bobPhase+=speed*dt*2.0;
  const bobTarget=movement.grounded&&!low?Math.sin(c.bobPhase*2.4)*Math.min(0.055,0.009*speed):0;
  c.bob+=(bobTarget-c.bob)*a;
  const yaw=Number(input.yaw)||0;
  const strafe=movement.vx*Math.cos(yaw)-movement.vz*Math.sin(yaw);
  const rollTarget=movement.mode==='slide'?clamp(-strafe*0.3,-2.0,2.0):clamp(-strafe*0.12,-0.9,0.9);
  c.roll+=(rollTarget-c.roll)*b;
  c.yaw=yaw;
  c.pitch=clamp(Number(input.pitch)||0,-1.45,1.45);
  return c;
}
export function stepFrame(world,movement,keys,accumulator,frameDt,config=MOVEMENT23){
  if(!(frameDt>=0&&Number.isFinite(frameDt)))throw new Error('Invalid frameDt');
  accumulator+=Math.min(frameDt,0.1);
  let state=movement,steps=0,events=[];
  while(accumulator>=config.fixedDt-1e-10 && steps<6){
    const r=stepMovement(world,state,keys,config.fixedDt,config);
    state=r.state;events.push(r.events);
    accumulator-=config.fixedDt;steps++;
  }
  // Avoid unbounded catch-up after background tab was suspended.
  return {state,accumulator:Math.max(0,accumulator),steps,events};
}