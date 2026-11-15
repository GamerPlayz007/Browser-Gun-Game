/**
 * CROSSFIRE 2.4 — geometry-gated vertical traversal prototype.
 * All positions represent the player's feet. X/Z horizontal; Y vertical.
 * Traversal is explicitly triggered by input.interact, never by collision alone.
 * Paths are fully collision-sampled before activation, not teleports through geometry.
 * Does NOT implement network authority; a real Python server must validate/replay moves.
 */
import { createMovementState,stepMovement, MOVEMENT23, createCameraState, stepCamera } from './movement23.mjs';
import {boxExtents, surfaceTop, surfaceBottom, circleRectOverlap} from './collision23.mjs';

export const TRAVERSAL24=Object.freeze({
 fixedDt:1/60, radius:0.32,
 mantleMinRise:0.43,mantleMaxRise:1.45,mantleMaxForward:1.95,mantleDuration:0.42,
 vaultMinRise:0.24,vaultMaxRise:0.95,vaultMaxForward:2.20,vaultDuration:0.32,
 arcClearance:0.075, pathSample:0.07, landingInset:0.08,
 cooldown:0.34, landingGrace:0.1,
 wallKickRange:0.52,wallKickLift:5.3,wallKickPush:5.1,
});
const FOOTPRINT = [[0,0],[0.30,0],[-0.30,0],[0,0.30],[0,-0.30]];
const CLIMB_SURFACES=new Set(['floor','routeFloor','stairLanding','deck','building','atriumShell','ramp']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const len=(x,z)=>Math.hypot(x,z);
function forward(input,s){
 let x=(Number(input.moveX)||0),z=(Number(input.moveZ)||0),d=len(x,z);
 const yaw=Number(input.yaw)||0;
 if(d<0.2){return {x:Math.sin(yaw),z:-Math.cos(yaw)};}
 x/=d;z/=d;
 return {x:Math.cos(yaw)*x+Math.sin(yaw)*z,z:Math.sin(yaw)*x-Math.cos(yaw)*z};
}
function clear(world,p,height=MOVEMENT23.standHeight){return world.blockers(p.x,p.y,p.z,{height}).length===0;}
function fullSupport(b,x,z,r=TRAVERSAL24.radius){
 const e=boxExtents(b);
 return FOOTPRINT.every(([dx,dz])=>x+dx*r/.30>e.xmin+0.015 && x+dx*r/.30<e.xmax-0.015 && z+dz*r/.30>e.zmin+0.015 && z+dz*r/.30<e.zmax-0.015);
}
function lerp(a,b,t){return a+(b-a)*t;}
function interp(a,b,t){return {x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),z:lerp(a.z,b.z,t)};}
// Three phase motion: vertical lift in front of obstacle; horizontal transfer above
// its top; vertical settle on supported floor. There are no collision exceptions.
function poseOnPath(points,f){
 const phase=f<1/3?0:f<2/3?1:2;
 return interp(points[phase],points[phase+1],clamp((f-phase/3)*3,0,1));
}
function safePath(world,points,config=TRAVERSAL24){
 for(let n=0;n<points.length-1;n++){
   const a=points[n],b=points[n+1],dist=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
   const ticks=Math.max(1,Math.ceil(dist/config.pathSample));
   for(let i=0;i<=ticks;i++){
     const p=interp(a,b,i/ticks);
     if(!clear(world,p))return false;
   }
 }
 return true;
}
function endingSupport(world,p){
 const support=world.supporting(p.x,p.y,p.z,0.12,0.075);
 return !!support && Math.abs(support.y-p.y)<0.06;
}
function uniqueCandidates(world,s,reach){
 return world.near(s.x,s.z,reach).filter(b=>Number.isFinite(b.h)&&b.h>0.06);
}
/** Positive explicit-ledges only, including residential roof and transit deck where reachable. */
export function findMantle(world,s,input,conf=TRAVERSAL24){
 if(s.bodyHeight<MOVEMENT23.standHeight-0.04||s.slideRemaining>0)return null;
 const dir=forward(input,s),cands=uniqueCandidates(world,s,conf.mantleMaxForward+1.0);
 let best=null;
 for(const b of cands){
  if(!CLIMB_SURFACES.has(b.kind)||b.kind==='ramp')continue;
  const top=surfaceTop(b,s.x,s.z),rise=top-s.y;
  if(rise<conf.mantleMinRise||rise>conf.mantleMaxRise)continue;
  for(let d=0.36;d<=conf.mantleMaxForward+1e-7;d+=0.07){
    const p={x:s.x+dir.x*d,y:top,z:s.z+dir.z*d};
    if(!fullSupport(b,p.x,p.z))continue;
    // The face must actually separate starting position and landing position.
    if(circleRectOverlap(s.x,s.z,world.settings.radius,b))continue;
    if(!endingSupport(world,p)||!clear(world,p))continue;
    const hover=top+conf.arcClearance;
    const waypoints=[{x:s.x,y:s.y,z:s.z},{x:s.x,y:hover,z:s.z},{x:p.x,y:hover,z:p.z},p];
    if(!safePath(world,waypoints,conf))continue;
    const score=d+Math.abs(rise)*0.04;
    if(!best||score<best.score)best={type:'mantle',points:waypoints,score,duration:conf.mantleDuration,exitDir:dir,target:{...p},structure:b.structure||b.kind,rise};
    break;
  }
 }
 return best;
}
/** A short, grounded barrier crossing with a verified landing surface beyond the barrier. */
export function findVault(world,s,input,conf=TRAVERSAL24){
 if(!s.grounded||s.bodyHeight<MOVEMENT23.standHeight-0.04||s.slideRemaining>0)return null;
 const dir=forward(input,s),candidateBoxes=uniqueCandidates(world,s,conf.vaultMaxForward+0.3);
 let best=null;
 for(const b of candidateBoxes){
  if(['floor','routeFloor','deck','stairTread','stairLanding','ramp'].includes(b.kind))continue;
  const rise=surfaceTop(b,s.x,s.z)-s.y;
  if(rise<conf.vaultMinRise||rise>conf.vaultMaxRise)continue;
  if(circleRectOverlap(s.x,s.z,world.settings.radius,b))continue;
  // A barrier must lie directly ahead within 0.75 m and span the crossing axis.
  let nearFace=false;
  for(let d=0.3;d<=0.75;d+=.08){
   const px=s.x+dir.x*d,pz=s.z+dir.z*d;
   if(circleRectOverlap(px,pz,world.settings.radius*0.55,b)){nearFace=true;break;}
  }
  if(!nearFace)continue;
  const hover=surfaceTop(b,s.x,s.z)+conf.arcClearance;
  for(let d=0.82;d<=conf.vaultMaxForward+1e-6;d+=0.075){
   const p={x:s.x+dir.x*d,y:s.y,z:s.z+dir.z*d};
   if(circleRectOverlap(p.x,p.z,world.settings.radius+conf.landingInset,b))continue;
   if(!endingSupport(world,p)||!clear(world,p))continue;
   const waypoints=[{x:s.x,y:s.y,z:s.z},{x:s.x,y:hover,z:s.z},{x:p.x,y:hover,z:p.z},p];
   if(!safePath(world,waypoints,conf))continue;
   const score=d;
   if(!best||score<best.score)best={type:'vault',points:waypoints,score,duration:conf.vaultDuration,exitDir:dir,target:p,structure:b.structure||b.kind,rise};
   break;
  }
 }
 return best;
}
export function wallKickNormal(world,s,input,conf=TRAVERSAL24){
 if(s.grounded)return null;
 const dir=forward(input,s);
 let candidate=null;
 for(const b of uniqueCandidates(world,s,conf.wallKickRange+world.settings.radius)){
  const ext=boxExtents(b);
  if(s.y+1.25<surfaceBottom(b,s.x,s.z)||s.y+0.30>surfaceTop(b,s.x,s.z))continue;
  // Pick a genuine vertical face; a nearby floor doesn't count as a wall.
  const surfaces=[{x:-1,z:0,dist:Math.abs(s.x-ext.xmin),lateral:s.z>=ext.zmin-.1&&s.z<=ext.zmax+.1,side:s.x<=ext.xmin},
    {x:1,z:0,dist:Math.abs(s.x-ext.xmax),lateral:s.z>=ext.zmin-.1&&s.z<=ext.zmax+.1,side:s.x>=ext.xmax},
    {x:0,z:-1,dist:Math.abs(s.z-ext.zmin),lateral:s.x>=ext.xmin-.1&&s.x<=ext.xmax+.1,side:s.z<=ext.zmin},
    {x:0,z:1,dist:Math.abs(s.z-ext.zmax),lateral:s.x>=ext.xmin-.1&&s.x<=ext.xmax+.1,side:s.z>=ext.zmax}];
  for(const n of surfaces){
   if(!n.side||!n.lateral||n.dist>conf.wallKickRange+world.settings.radius)continue;
   // Player must be aiming INTO wall; normal points AWAY from it.
   const towardWall=-(dir.x*n.x+dir.z*n.z);
   if(towardWall<0.35)continue;
   if(!candidate||n.dist<candidate.dist)candidate={x:n.x,z:n.z,dist:n.dist,structure:b.structure||b.kind};
  }
 }
 return candidate;
}
export function createTraversalState(pos={}){
 return {...createMovementState(pos),traversal:null,traversalCooldown:0,prevInteract:false,wallKickUsed:false,fallApex:pos.y??0,landingDrop:0};
}
export function stepTraversal(world,old,input={},dt=TRAVERSAL24.fixedDt,conf=TRAVERSAL24){
 if(Math.abs(dt-conf.fixedDt)>1e-8)throw new Error('Traversal24 requires fixed 60 Hz');
 if(![old.x,old.y,old.z].every(Number.isFinite))throw new Error('Invalid player position');
 const state={...old};
 const interactEdge=!!input.interact&&!state.prevInteract;
 const jumpEdge=!!input.jump&&!state.prevJump;
 const events={mantleStarted:false,mantleFinished:false,vaultStarted:false,vaultFinished:false,wallKicked:false,landed:false,dropHeight:0,traversalRejected:false};
 state.traversalCooldown=Math.max(0,(state.traversalCooldown||0)-dt);
 state.prevInteract=!!input.interact;
 // Active maneuver is manually animated through an already-validated sequence.
 if(state.traversal){
   const t={...state.traversal};
   const f=clamp(t.progress+dt/t.duration,0,1),p=poseOnPath(t.points,f);
   if(!clear(world,p)){
     state.traversal=null;
     state.grounded=false;
     state.vx=state.vz=0;
     state.vy=0;
     events.traversalRejected=true;
   }else{
     state.x=p.x;state.y=p.y;state.z=p.z;
     state.vx=0;state.vy=0;state.vz=0;state.bodyHeight=MOVEMENT23.standHeight;
     state.grounded=false;state.mode=t.type;
     state.prevJump=!!input.jump;state.prevSlide=!!input.slide;
     state.jumpBufferRemaining=0;state.slideRemaining=0;state.coyoteRemaining=0;
     if(f>=1){
       state.traversal=null;state.grounded=endingSupport(world,p);
       if(!state.grounded){state.vy=0;events.traversalRejected=true;}
       state.mode=state.grounded?'walk':'air';
       if(state.grounded){state.vx=t.exitDir.x*(t.type==='vault'?4.1:2.4);state.vz=t.exitDir.z*(t.type==='vault'?4.1:2.4);state.jumpConsumed=false;state.wallKickUsed=false;}
       events[t.type==='vault'?'vaultFinished':'mantleFinished']=true;
     }else state.traversal={...t,progress:f};
     state.tick=(state.tick||0)+1;
     return {state,events};
   }
 }
 // Explicit action chooses low vault over mantle where both technically qualify.
 if(interactEdge&&state.traversalCooldown<=0&&!state.traversal){
   const action=findVault(world,state,input,conf)||findMantle(world,state,input,conf);
   if(action){
     state.traversal={...action,progress:0};
     state.traversalCooldown=conf.cooldown;
     state.prevJump=!!input.jump;state.prevSlide=!!input.slide;
     state.slideRemaining=0;state.jumpBufferRemaining=0;
     state.mode=action.type;
     state.vx=0;state.vy=0;state.vz=0;
     events[action.type==='vault'?'vaultStarted':'mantleStarted']=true;
     state.tick=(state.tick||0)+1;
     return {state,events};
   }
   events.traversalRejected=true;
 }
 const wasGrounded=!!state.grounded;
 const apex=Math.max(state.fallApex??state.y,state.y);
 // Stage 2.3 movement math used the opposite yaw sign from the 2.3 renderer.
 // Convert the camera-facing yaw here so W travels in the direction the camera sees.
 const r=stepMovement(world,state,{...input,yaw:-(Number(input.yaw)||0)},dt,MOVEMENT23);
 const n={...r.state,traversal:null,traversalCooldown:state.traversalCooldown,prevInteract:state.prevInteract,
   wallKickUsed:state.wallKickUsed,landingDrop:state.landingDrop||0,fallApex:apex};
 // A limited airborne wall kick; cannot chain indefinitely without a supported landing.
 if(jumpEdge&&!wasGrounded&&!n.grounded&&!state.wallKickUsed){
   const normal=wallKickNormal(world,state,input,conf);
   if(normal){
     n.vx=normal.x*conf.wallKickPush;
     n.vz=normal.z*conf.wallKickPush;
     n.vy=conf.wallKickLift;
     n.jumpConsumed=true;
     n.jumpBufferRemaining=0;
     n.wallKickUsed=true;
     n.mode='wall-kick';
     events.wallKicked=true;
   }
 }
 if(n.grounded&&!wasGrounded){
   events.landed=true;
   events.dropHeight=Math.max(0,apex-n.y);
   n.landingDrop=events.dropHeight;
   n.fallApex=n.y;
   n.wallKickUsed=false;
 }else if(!n.grounded){n.fallApex=Math.max(apex,n.y);}
 else {n.fallApex=n.y;n.wallKickUsed=false;}
 return {state:n,events:{...events,jumped:r.events.jumped,ceiling:r.events.ceiling,stepUps:r.events.stepUps},diagnostics:r.diagnostics};
}
export function stepTraversalFrame(world,state,input,accumulator,frameDt){
 accumulator+=Math.min(Math.max(0,frameDt),0.1);
 let n=state,steps=0;const events=[];
 while(accumulator>=TRAVERSAL24.fixedDt-1e-10&&steps<6){
   const r=stepTraversal(world,n,input);n=r.state;events.push(r.events);
   accumulator-=TRAVERSAL24.fixedDt;steps++;
 }
 return {state:n,accumulator:Math.max(0,accumulator),steps,events};
}
/** Visual-only convenience; never feed its offset back into movement collision. */
export function stepTraversalCamera(camera,state,input,dt){
 const c=stepCamera(camera,state,input,dt);
 if(state.traversal){
   const t=state.traversal,phase=Math.sin(Math.PI*t.progress);
   c.eyeY=state.y+c.eyeHeight+phase*0.035;
   c.fov=Math.max(c.fov,88);
 }
 return c;
}