/** CROSSFIRE 05.3 flowing movement - deterministic authoritative 60 Hz controller.
 * Mirror of movement_live.py. Feet-space Y; server never accepts client positions.
 */
import {nearbyBoxes} from './spatial.js';
import {allowedLean63} from './lean63.js';
export const FIXED_DT=1/60;
export const MOVE={walk:5.35,sprint:8.2,crouch:3.15,groundAccel:60,groundBrake:42,airAccel:9.5,airBrake:1.7,
 slideMin:5,slideBoost:1.13,slideMax:10,slideTime:.70,slideCD:0,slideDrag:2.7,slideSteer:3.6,
 slideHopSpeed:7.95,slideHopCarry:1.07,slideHopCap:10,
 buffer:.18,coyote:.14,jumpSpeed:7.5,shortHop:.52,gravity:22,stepHeight:.29,stairStepHeight:.36,
 height:1.8,lowHeight:1.12,wallKickRange:.52,wallKickLift:5.3,wallKickPush:5.1,
 mantleExitSpeed:2.7};
export function topAt(b,x,z){
 if(b.kind!=='ramp')return b.y+b.h;
 const size=b.axis==='x'?b.w:b.d,v=b.axis==='x'?x:z,t=Math.max(0,Math.min(1,(v-b[b.axis])/size+.5));
 return b.low+b.rise*(b.direction>0?t:1-t);
}
export function bottomAt(b,x,z){return b.kind==='ramp'?topAt(b,x,z)-b.thickness:b.y;}
export function seedMovement(p){
 Object.assign(p,{jump_buffer_until:0,coyote_until:0,jump_consumed:false,jump_cut:false,wall_kick_used:false,interact_held:false,mantle:null,lean:0});
 return p;
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const supports=new Set(['building','atriumShell','railing','deck','stairLanding','routeFloor']);
// A low tread/landing touching the player's feet is NOT a ceiling.
function blocksHead(p,b){
 return bottomAt(b,p.x,p.z)>=p.y+MOVE.lowHeight-.03 &&
   overlaps(p.x,p.y,p.z,b,MOVE.height);
}
function overlaps(x,y,z,b,height){
 return Math.abs(x-b.x)<b.w/2+.32&&Math.abs(z-b.z)<b.d/2+.32&&y<topAt(b,x,z)-.015&&y+height>bottomAt(b,x,z)+.015;
}
function wallNormal(boxes,p,dx,dz){
 let best=null;
 for(const b of boxes){
  if(!supports.has(b.kind)||p.y>=topAt(b,p.x,p.z)-.2||p.y+1.8<=bottomAt(b,p.x,p.z))continue;
  for(const [nx,nz,gap,lateral] of [
   [1,0,Math.abs(p.x-(b.x+b.w/2)),Math.abs(p.z-b.z)<=b.d/2+.32],
   [-1,0,Math.abs(p.x-(b.x-b.w/2)),Math.abs(p.z-b.z)<=b.d/2+.32],
   [0,1,Math.abs(p.z-(b.z+b.d/2)),Math.abs(p.x-b.x)<=b.w/2+.32],
   [0,-1,Math.abs(p.z-(b.z-b.d/2)),Math.abs(p.x-b.x)<=b.w/2+.32]
  ]){
   if(!lateral||gap>.32+MOVE.wallKickRange)continue;
   if(-(nx*dx+nz*dz)<.35)continue;
   if(!best||gap<best.gap)best={nx,nz,gap};
  }
 }
 return best;
}
function tryMantle(p,boxes,now){
 if(p.mantle)return false;
 const dx=-Math.sin(p.yaw),dz=-Math.cos(p.yaw);
 let best=null;
 for(const b of boxes){
  if(!supports.has(b.kind))continue;
  const x=p.x+dx*.9,z=p.z+dz*.9,top=topAt(b,x,z),rise=top-p.y;
  if(rise<.3||rise>1.45)continue;
  if(Math.abs(x-b.x)>b.w/2-.32||Math.abs(z-b.z)>b.d/2-.32)continue;
  const invalid=boxes.some(o=>overlaps(x,top,z,o,MOVE.height))||boxes.some(o=>overlaps(p.x,top+.06,p.z,o,MOVE.height));
  if(invalid)continue;
  if(!best||rise<best.rise)best={x,z,top,rise};
 }
 if(!best)return false;
 p.mantle={sx:p.x,sy:p.y,sz:p.z,tx:best.x,ty:best.top,tz:best.z,elapsed:0,duration:best.rise<=.95?.32:.42};
 p.vx=p.vy=p.vz=0;p.grounded=false;p.slide_until=0;
 return true;
}
export function simulate(p,input,dt,now,allBoxes,weapon){
 if(Math.abs(dt-FIXED_DT)>1e-8)throw Error('CROSSFIRE movement requires 60 Hz ticks');
 const M=MOVE;const startGrounded=!!p.grounded;
 const jump=!!input.jump,slide=!!input.slide,interact=!!input.interact;
 const jumpEdge=jump&&!p.jump_held,slideEdge=slide&&!p.slide_held,interactEdge=interact&&!p.interact_held;
 p.interact_held=interact;
 p.jump_buffer_until ??=0;p.coyote_until ??=0;p.jump_consumed ??=false;
 p.jump_cut ??=false;p.wall_kick_used ??=false;p.mantle ??=null;
 if(p.mantle){
  p.lean=0;
  const m=p.mantle,t=clamp((m.elapsed+dt)/m.duration,0,1);
  // Clear the lip before approaching horizontally. The old straight-line
  // mantle could intersect the wall and abort a legitimate ledge grab.
  const lift=clamp(t*2.8,0,1),approach=clamp((t-.18)/.82,0,1);
  const advance=approach*approach*(3-2*approach);
  const x=m.sx+(m.tx-m.sx)*advance,z=m.sz+(m.tz-m.sz)*advance;
  const y=m.sy+(m.ty-m.sy)*lift+.10*Math.sin(Math.PI*t);
  const local=nearbyBoxes(allBoxes,x,z,2);
  if(local.some(b=>overlaps(x,y,z,b,M.height))){p.mantle=null;p.vy=0;p.grounded=false;}
  else{
   p.x=x;p.y=y;p.z=z;p.vx=p.vy=p.vz=0;p.mantle={...m,elapsed:m.elapsed+dt};p.crouch=false;
   if(t>=1){p.mantle=null;p.y=m.ty;p.grounded=true;p.jump_consumed=false;p.wall_kick_used=false;
    // A modest exit impulse removes the hard stop at the end of a vault.
    // It is applied only while moving forward and is subject to collision next tick.
    if(input.w){p.vx=-Math.sin(p.yaw)*M.mantleExitSpeed;p.vz=-Math.cos(p.yaw)*M.mantleExitSpeed;}}
   p.jump_held=jump;p.slide_held=slide;return;
  }
 }
 let f=Number(!!input.w)-Number(!!input.s),r=Number(!!input.d)-Number(!!input.a),length=Math.max(1,Math.hypot(f,r));
 f/=length;r/=length;const ix=r*Math.cos(p.yaw)-f*Math.sin(p.yaw),iz=-r*Math.sin(p.yaw)-f*Math.cos(p.yaw);
 const moving=(f*f+r*r)>0;
 const speedBefore=Math.hypot(p.vx,p.vz);
 if(slideEdge&&p.grounded&&now>=p.slide_until&&speedBefore>=M.slideMin){
  p.slide_until=now+M.slideTime;p.slide_ready=now;
  const boost=Math.min(M.slideMax,speedBefore*M.slideBoost)/Math.max(.1,speedBefore);p.vx*=boost;p.vz*=boost;
 }
 const sliding=now<p.slide_until;
 p.crouch=sliding||!!input.crouch;
 let height=p.crouch?M.lowHeight:M.height;
 let boxes=nearbyBoxes(allBoxes,p.x,p.z,Math.max(Math.abs(p.vx),Math.abs(p.vz))*dt+1.25);
 if(!p.crouch&&boxes.some(b=>blocksHead(p,b))){p.crouch=true;height=M.lowHeight;}
 if(sliding){
  const drag=Math.exp(-M.slideDrag*dt);p.vx=p.vx*drag+ix*M.slideSteer*dt;p.vz=p.vz*drag+iz*M.slideSteer*dt;
  const v=Math.hypot(p.vx,p.vz);if(v>M.slideMax){p.vx*=M.slideMax/v;p.vz*=M.slideMax/v;}
 }else{
  let speed=(p.crouch?M.crouch:input.sprint&&!input.ads?M.sprint:M.walk)*(weapon?.speed??1);
  if(input.ads)speed*=.62;
  const tx=ix*speed,tz=iz*speed;
  const accel=p.grounded?(moving?M.groundAccel:M.groundBrake):(moving?M.airAccel:M.airBrake);
  const ex=tx-p.vx,ez=tz-p.vz,d=Math.hypot(ex,ez),change=accel*dt;
  if(d>change){p.vx+=ex*change/d;p.vz+=ez*change/d;}else{p.vx=tx;p.vz=tz;}
 }
 boxes=nearbyBoxes(allBoxes,p.x,p.z,Math.max(Math.abs(p.vx),Math.abs(p.vz))*dt+1.25);
 // Holding E while moving forward keeps trying for a ledge as it comes into
 // reach; tapping E while stationary retains the original precise behavior.
 if((interactEdge||(interact&&f>0))&&tryMantle(p,boxes,now)){p.interact_held=interact;p.jump_held=jump;p.slide_held=slide;p.lean=0;return;}
 const overlap=(x,y,z,b)=>overlaps(x,y,z,b,height);
 for(const [axis,velocity] of [['x','vx'],['z','vz']]){
  const value=p[axis]+p[velocity]*dt,x=axis==='x'?value:p.x,z=axis==='z'?value:p.z;
  let obstacles=boxes.filter(b=>overlap(x,p.y,z,b));
  if(obstacles.length&&p.grounded){const top=Math.max(...obstacles.map(b=>topAt(b,x,z)));
   const stairSurface=obstacles.every(b=>['stairTread','stairLanding','routeFloor','deck'].includes(b.kind));
   if(top-p.y<=(stairSurface?M.stairStepHeight:M.stepHeight)&&!boxes.some(b=>overlap(x,top,z,b))){p.y=top;obstacles=[];}
  }
  if(!obstacles.length)p[axis]=value;else p[velocity]=0;
 }
 // Held Space queues a fresh takeoff only on contact with the ground.
 if(jumpEdge||(jump&&startGrounded&&!p.jump_consumed))
  p.jump_buffer_until=now+M.buffer;
 if(startGrounded)p.coyote_until=now+M.coyote;
 const canStand=!p.crouch||!boxes.some(b=>blocksHead(p,b));
 let jumped=false;
 if(now<=p.jump_buffer_until&&now<=p.coyote_until&&!p.jump_consumed&&canStand){
  const slideHop=sliding&&startGrounded;
  p.vy=slideHop?M.slideHopSpeed:M.jumpSpeed;
  if(slideHop){
   // Preserve the slide's direction without creating an unlimited speed boost.
   const speed=Math.hypot(p.vx,p.vz);
   if(speed>.01){const carried=Math.min(M.slideHopCap,speed*M.slideHopCarry)/speed;
    p.vx*=carried;p.vz*=carried;}
  }
  p.grounded=false;p.slide_until=0;p.jump_consumed=true;p.jump_cut=false;
  p.jump_buffer_until=0;p.coyote_until=0;p.crouch=false;height=M.height;jumped=true;
 }
 if(jumpEdge&&!jumped&&!startGrounded&&!p.wall_kick_used){
  const wall=wallNormal(boxes,p,-Math.sin(p.yaw),-Math.cos(p.yaw));
  if(wall){p.vx+=wall.nx*M.wallKickPush;p.vz+=wall.nz*M.wallKickPush;p.vy=M.wallKickLift;p.wall_kick_used=true;p.jump_cut=false;}
 }
 if(!jump&&p.jump_held&&p.vy>0&&!p.jump_cut){p.vy*=M.shortHop;p.jump_cut=true;}
 p.jump_held=jump;p.slide_held=slide;
 const old=p.y;p.vy-=M.gravity*dt;let ny=old+p.vy*dt,ground=0;
 for(const b of boxes){if(Math.abs(p.x-b.x)<b.w/2+.32&&Math.abs(p.z-b.z)<b.d/2+.32){
  const top=topAt(b,p.x,p.z),bottom=bottomAt(b,p.x,p.z);
  if(p.vy<=0&&old>=top-.02)ground=Math.max(ground,top);
  if(p.vy>0&&old+height<=bottom+.02&&ny+height>=bottom){ny=bottom-height;p.vy=0;}
 }}
 if(ny<=ground||(p.grounded&&p.vy<=0&&old-ground<=.29)){ny=ground;p.vy=0;p.grounded=true;}
 else p.grounded=false;
 p.y=ny;
 if(p.grounded&&!startGrounded){p.jump_consumed=false;p.jump_cut=false;p.wall_kick_used=false;}
 p.lean=allowedLean63(p,input,allBoxes);
}