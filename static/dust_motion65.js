/* CROSSFire 6.5: 60 Hz Dust Corridor client prediction.
 *
 * Uses the exact original TriangleSoup and BVH, not collider approximations.
 * Formula-matched to dust_motion65.py; accepts authoritative player state
 * and pending input replay just like Daybreak's static/physics.js.
 * Original BVH and source map remain MIT-licensed (see THIRD_PARTY.md).
 */
import * as THREE from 'three';
import {BVH,closestPointOnTriangleSoup} from './dust_corridor/src/physics/BVH.js';

const DT=1/60,R=.34,HEIGHT=1.8,LOW=1.12,GRAVITY=22,STEP=.36,EPS=.003;
const q=new THREE.Vector3(),rayOrigin=new THREE.Vector3(),rayDirection=new THREE.Vector3();
const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
const approach=(v,target,delta)=>v<target?Math.min(target,v+delta):Math.max(target,v-delta);
const cache=new WeakMap();

export function createDustPhysics65(source){
 const existing=cache.get(source);
 if(existing)return existing;
 const bvh=new BVH(source.soup);
 const {positions}=source.soup;
 const bounds=source.playBounds;
 function inside(x,z,margin=R){
  return x>=bounds.x0+margin&&x<=bounds.x1-margin&&z>=bounds.z0+margin&&z<=bounds.z1-margin;
 }
 function raycast(start,end){
  rayOrigin.set(...start);
  rayDirection.set(end[0]-start[0],end[1]-start[1],end[2]-start[2]);
  const max=rayDirection.length();
  if(max<1e-9)return null;
  const hit=bvh.raycast(rayOrigin,rayDirection.divideScalar(max),max);
  return hit.hit?{point:hit.point.clone(),normal:hit.normal.clone(),t:hit.t,surface:hit.surface}:null;
 }
 function groundAt(x,z,y){
  const hit=raycast([x,y+.48,z],[x,y-1,z]);
  return hit&&Math.abs(hit.normal.y)>=.67?hit.point.y:null;
 }
 function capsuleClear(x,y,z,height=HEIGHT){
  if(!inside(x,z,R))return false;
  const count=Math.max(3,Math.ceil((height-2*R)/(R*.55))+1);
  const ids=[];bvh.overlapBox(x-R,y-R,z-R,x+R,y+height+R,z+R,index=>ids.push(index));
  for(const tri of ids){
   const k=tri*9;
   const lo=Math.min(positions[k+1],positions[k+4],positions[k+7]);
   const hi=Math.max(positions[k+1],positions[k+4],positions[k+7]);
   if(lo>y+height+R||hi<y-R)continue;
   for(let i=0;i<count;i++){
    const cy=y+R+(height-2*R)*i/(count-1);
    closestPointOnTriangleSoup(source.soup,tri,x,cy,z,q);
    if((x-q.x)**2+(cy-q.y)**2+(z-q.z)**2<(R-.012)**2)return false;
   }
  }
  return true;
 }
 function resolve(x,y,z,h,oldX,oldZ,vx,vz){
  for(let iter=0;iter<2;iter++){
   let moved=false;
   const ids=[];
   bvh.overlapBox(x-R-.02,y-R,z-R-.02,x+R+.02,y+h+R,z+R+.02,index=>ids.push(index));
   ids.sort((u,v)=>u-v);
   for(const tri of ids){
    const k=tri*9;
    a.set(positions[k],positions[k+1],positions[k+2]);
    b.set(positions[k+3],positions[k+4],positions[k+5]);
    c.set(positions[k+6],positions[k+7],positions[k+8]);
    const lo=Math.min(a.y,b.y,c.y),hi=Math.max(a.y,b.y,c.y);
    if(lo>y+h||hi<y)continue;
    const nxRaw=(b.y-a.y)*(c.z-a.z)-(b.z-a.z)*(c.y-a.y);
    const nyRaw=(b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z);
    const nzRaw=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    const nlen=Math.hypot(nxRaw,nyRaw,nzRaw);
    if(nlen<1e-8||Math.abs(nyRaw)/nlen>.65)continue;
    for(const sy of [y+R,y+h/2,y+h-R]){
     if(sy+R<lo||sy-R>hi)continue;
     closestPointOnTriangleSoup(source.soup,tri,x,sy,z,q);
     const dy=sy-q.y,allowedSq=R*R-dy*dy;
     if(allowedSq<=0)continue;
     const dx=x-q.x,dz=z-q.z,dsq=dx*dx+dz*dz;
     if(dsq>=allowedSq)continue;
     const d=Math.sqrt(dsq);
     let nx,nz;
     if(d>1e-8){nx=dx/d;nz=dz/d;}
     else{
      const horizontal=Math.hypot(nxRaw,nzRaw);
      if(horizontal<1e-9)continue;
      nx=nxRaw/horizontal;nz=nzRaw/horizontal;
      if((oldX-q.x)*nx+(oldZ-q.z)*nz<0){nx=-nx;nz=-nz;}
     }
     const push=Math.sqrt(allowedSq)-d+EPS;
     x+=nx*push;z+=nz*push;moved=true;
     const vn=vx*nx+vz*nz;
     if(vn<0){vx-=vn*nx;vz-=vn*nz;}
     break;
    }
   }
   if(!moved)break;
  }
  return [x,z,vx,vz];
 }
 function simulate(p,input,dt,now,weapon){
  if(Math.abs(dt-DT)>1e-8)throw Error('Dust physics requires 60Hz fixed timestep');
  const f0=Number(!!input.w)-Number(!!input.s);
  const r0=Number(!!input.d)-Number(!!input.a);
  const length=Math.max(1,Math.hypot(f0,r0));
  const f=f0/length,r=r0/length;
  const yaw=p.yaw||0,ix=r*Math.cos(yaw)-f*Math.sin(yaw),iz=-r*Math.sin(yaw)-f*Math.cos(yaw);
  const jump=!!input.jump,slide=!!input.slide;
  const jumpEdge=jump&&!p.jump_held,slideEdge=slide&&!p.slide_held;
  let grounded=!!p.grounded;
  const velocity=Math.hypot(p.vx,p.vz);
  if(slideEdge&&grounded&&velocity>=5){
   p.slide_until=now+.7;p.slide_ready=now;
   const boost=Math.min(10,velocity*1.13)/Math.max(.1,velocity);
   p.vx*=boost;p.vz*=boost;
  }
  const sliding=now<p.slide_until;
  let requestedCrouch=sliding||!!input.crouch;
  const nativeOctavus=!!source.nativeOctavus;
  if(nativeOctavus&&p.crouch&&!requestedCrouch&&!capsuleClear(p.x,p.y,p.z,HEIGHT))
   requestedCrouch=true;
  p.crouch=requestedCrouch;
  let height=p.crouch?LOW:HEIGHT;
  if(sliding){
   const drag=Math.exp(-2.7*dt);
   p.vx=p.vx*drag+ix*3.6*dt;p.vz=p.vz*drag+iz*3.6*dt;
   const mag=Math.hypot(p.vx,p.vz);if(mag>10){p.vx*=10/mag;p.vz*=10/mag;}
  }else{
   let speed=(p.crouch?3.15:input.sprint&&!input.ads?8.2:5.35)*(weapon?.speed??1);
   if(input.ads)speed*=.62;
   const tx=ix*speed,tz=iz*speed,moving=!!(f||r);
   const accel=grounded?(moving?60:42):(moving?9.5:1.7);
   const ex=tx-p.vx,ez=tz-p.vz,d=Math.hypot(ex,ez),change=accel*dt;
   if(d>change){p.vx+=ex*change/d;p.vz+=ez*change/d;}else{p.vx=tx;p.vz=tz;}
  }
  if(jumpEdge&&grounded){
   p.vy=sliding?7.95:7.5;p.grounded=false;grounded=false;
   p.slide_until=0;p.crouch=false;height=HEIGHT;
   p.jump_consumed=true;p.jump_cut=false;
  }
  if(!jump&&p.jump_held&&p.vy>0&&!p.jump_cut){p.vy*=.52;p.jump_cut=true;}
  p.jump_held=jump;p.slide_held=slide;p.interact_held=!!input.interact;
  p.mantle=null;p.lean=0;p.wall_kick_used=false;
  const oldX=p.x,oldZ=p.z,oldY=p.y;
  const total=Math.hypot(p.vx*dt,p.vz*dt);
  const parts=Math.max(1,Math.min(4,Math.ceil(total/.14)));
  let x=oldX,z=oldZ,vx=p.vx,vz=p.vz,stepFeet=oldY;
  for(let i=0;i<parts;i++){
   const proposedX=x+vx*dt/parts,proposedZ=z+vz*dt/parts;
   let xx,zz;
   [xx,zz,vx,vz]=resolve(proposedX,stepFeet,proposedZ,height,x,z,vx,vz);
   if(nativeOctavus&&grounded&&Math.hypot(proposedX-xx,proposedZ-zz)>.018){
    const runX=proposedX-x,runZ=proposedZ-z,len=Math.hypot(runX,runZ);
    if(len>1e-8){
     const probeX=proposedX+runX/len*(R+.10),probeZ=proposedZ+runZ/len*(R+.10);
     if(inside(probeX,probeZ,R)){
      const rise=groundAt(probeX,probeZ,stepFeet+STEP);
      if(rise!==null&&rise>=stepFeet+.025&&rise<=stepFeet+STEP+.012&&
         rise<=oldY+STEP+.012&&capsuleClear(probeX,rise,probeZ,height)){
       xx=probeX;zz=probeZ;stepFeet=rise;vx=p.vx;vz=p.vz;
      }
     }
    }
   }
   if(!inside(xx,zz,R)){
    xx=Math.max(bounds.x0+R,Math.min(bounds.x1-R,xx));
    zz=Math.max(bounds.z0+R,Math.min(bounds.z1-R,zz));vx=vz=0;
   }
   x=xx;z=zz;
  }
  let ground=groundAt(x,z,stepFeet);
  if(grounded&&ground!==null&&ground>oldY+STEP+.02){
   x=oldX;z=oldZ;vx=vz=0;ground=groundAt(x,z,oldY);
  }
  Object.assign(p,{x,z,vx,vz});
  p.vy=Math.max(-35,p.vy-GRAVITY*dt);
  const proposedY=oldY+p.vy*dt;
  if(ground!==null&&p.vy<=0&&(proposedY<=ground+.03||(grounded&&Math.abs(proposedY-ground)<=STEP+.04))){
   p.y=ground;p.vy=0;p.grounded=true;
  }else{p.y=proposedY;p.grounded=false;}
  if(p.vy>0){
   const hit=raycast([x,oldY+height-.04,z],[x,p.y+height+.02,z]);
   if(hit){p.y=Math.max(oldY,hit.point.y-height-.03);p.vy=0;}
  }
  if(p.grounded){p.jump_consumed=false;p.jump_cut=false;}
  return p;
 }
 const physics={bvh,source,bounds,simulate,inside,groundAt,raycast,capsuleClear};
 cache.set(source,physics);
 return physics;
}
