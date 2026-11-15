/**
 * CROSSFIRE 03.3 — multiplayer presentation timeline.
 *
 * Pure networking/math. Authoritative movement and hits remain on Python.
 * All timestamps below are milliseconds; snapshot times are monotonic server
 * seconds until converted in ingestSnapshot(). No Date.now() clock mixing.
 */
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const finite=Number.isFinite;
const lerp=(a,b,t)=>a+(b-a)*t;
const MAX_EXTRAPOLATION_MS=80;
const MAX_REMOTE_SPEED=16;

export function createNetSync(){
 return {
  clockOffsetMs:null,hasPong:false,rttMs:NaN,jitterMs:0,delayMs:105,
  lastSeq:-1,lastArrivalMs:null,lastServerMs:null,
  packetsReceived:0,packetsRejected:0,packetsMissing:0,remote:new Map()
 };
}
export function observePong(sync,sentMs,receivedMs,serverSeconds){
 if(!finite(sentMs)||!finite(receivedMs)||!finite(serverSeconds)||
    sentMs>receivedMs||receivedMs-sentMs>6000||sentMs<0)return false;
 const sampleRtt=receivedMs-sentMs,mid=(sentMs+receivedMs)*.5;
 const estimate=mid-serverSeconds*1000;
 sync.rttMs=finite(sync.rttMs)?lerp(sync.rttMs,sampleRtt,.22):sampleRtt;
 if(!sync.hasPong){sync.clockOffsetMs=estimate;sync.hasPong=true;}
 else{
  // Very large clock changes usually indicate a tab sleep / session reset.
  // Re-anchor rather than dragging a player model for seconds.
  const difference=estimate-sync.clockOffsetMs;
  sync.clockOffsetMs+=Math.abs(difference)>1200?difference:clamp(difference,-25,25)*.12;
 }
 return true;
}
export function ingestSnapshot(sync,packet,receiveMs){
 const sequence=packet?.snapshotSeq,serverSeconds=packet?.serverTime;
 if(!Number.isSafeInteger(sequence)||sequence<0||!finite(serverSeconds)||
    !finite(receiveMs)||!Array.isArray(packet.players)){
  sync.packetsRejected++;return false;
 }
 if(sequence<=sync.lastSeq){sync.packetsRejected++;return false;}
 if(sync.lastSeq>=0&&sequence>sync.lastSeq+1)sync.packetsMissing+=sequence-sync.lastSeq-1;
 const timeMs=serverSeconds*1000;
 if(sync.lastArrivalMs!==null&&sync.lastServerMs!==null){
  const arrivalDelta=receiveMs-sync.lastArrivalMs;
  const serverDelta=timeMs-sync.lastServerMs;
  if(arrivalDelta>0&&serverDelta>0&&serverDelta<3000){
   // Inter-arrival vs server-time variation estimates jitter, not packet loss.
   const variation=Math.min(200,Math.abs(arrivalDelta-serverDelta));
   sync.jitterMs=lerp(sync.jitterMs,variation,.16);
  }
 }
 sync.lastSeq=sequence;sync.lastArrivalMs=receiveMs;
 sync.lastServerMs=timeMs;sync.packetsReceived++;
 if(sync.clockOffsetMs===null){
  sync.clockOffsetMs=receiveMs-timeMs-(finite(sync.rttMs)?sync.rttMs*.5:45);
 }
 sync.delayMs=clamp(95+sync.jitterMs*1.8,95,185);
 const present=new Set();
 for(const p of packet.players){
  if(typeof p.id!=='string'||!finite(p.x)||!finite(p.y)||!finite(p.z)||
     !finite(p.yaw))continue;
  present.add(p.id);
  const sample={
   time:timeMs,id:p.id,spawn:p.spawn,hp:p.hp,
   x:p.x,y:p.y,z:p.z,vx:finite(p.vx)?p.vx:0,
   vy:finite(p.vy)?p.vy:0,vz:finite(p.vz)?p.vz:0,
   yaw:p.yaw,pitch:finite(p.pitch)?p.pitch:0,
   crouch:!!p.crouch,grounded:!!p.grounded,slide:finite(p.slide)?p.slide:0,weapon:p.weapon
  };
  let history=sync.remote.get(p.id);
  const prev=history?.[history.length-1];
  const teleported=prev&&Math.hypot(sample.x-prev.x,sample.y-prev.y,sample.z-prev.z)>12;
  if(!history||prev?.spawn!==sample.spawn||teleported)history=[];
  if(!history.length||timeMs>history[history.length-1].time)history.push(sample);
  // Bounded by time and count; never keep stale history across reconnects.
  const cutoff=timeMs-1200;
  while(history.length>2&&history[0].time<cutoff)history.shift();
  if(history.length>32)history.splice(0,history.length-32);
  sync.remote.set(p.id,history);
 }
 for(const id of sync.remote.keys())if(!present.has(id))sync.remote.delete(id);
 return true;
}
export function shortAngle(a,b,t){
 const delta=Math.atan2(Math.sin(b-a),Math.cos(b-a));
 return a+delta*t;
}
export function sampleRemote(sync,id,nowMs){
 const buffer=sync.remote.get(id);
 if(!buffer?.length)return null;
 const newest=buffer[buffer.length-1];
 if(buffer.length===1||!finite(nowMs)||sync.clockOffsetMs===null)return {...newest};
 const renderAt=nowMs-sync.clockOffsetMs-sync.delayMs;
 if(renderAt<=buffer[0].time)return {...buffer[0]};
 for(let i=1;i<buffer.length;i++){
  const next=buffer[i],prev=buffer[i-1];
  if(renderAt>next.time)continue;
  const fraction=clamp((renderAt-prev.time)/Math.max(1,next.time-prev.time),0,1);
  return {...next,x:lerp(prev.x,next.x,fraction),y:lerp(prev.y,next.y,fraction),
   z:lerp(prev.z,next.z,fraction),yaw:shortAngle(prev.yaw,next.yaw,fraction),
   pitch:lerp(prev.pitch,next.pitch,fraction),
   // Keep animation flags consistent with the sampled interval, not the future.
   crouch:fraction>=.5?next.crouch:prev.crouch,
   grounded:fraction>=.5?next.grounded:prev.grounded,
   slide:fraction>=.5?next.slide:prev.slide};
 }
 const dt=clamp(renderAt-newest.time,0,MAX_EXTRAPOLATION_MS)/1000;
 const vx=clamp(newest.vx,-MAX_REMOTE_SPEED,MAX_REMOTE_SPEED);
 const vz=clamp(newest.vz,-MAX_REMOTE_SPEED,MAX_REMOTE_SPEED);
 const vy=clamp(newest.vy,-MAX_REMOTE_SPEED,MAX_REMOTE_SPEED);
 return {...newest,x:newest.x+vx*dt,z:newest.z+vz*dt,
  y:newest.y+(newest.grounded?0:vy*dt)};
}
export function cameraCorrection(oldVisual,newPredicted,snapDistance=2.5){
 const dx=oldVisual.x-newPredicted.x,dy=oldVisual.y-newPredicted.y,dz=oldVisual.z-newPredicted.z;
 const length=Math.hypot(dx,dy,dz);
 if(!finite(length)||length>snapDistance)return {x:0,y:0,z:0,snapped:true};
 return {x:dx,y:dy,z:dz,snapped:false};
}
export function syncStats(sync,nowMs){
 const age=sync.lastArrivalMs===null?Infinity:Math.max(0,nowMs-sync.lastArrivalMs);
 return {rttMs:sync.rttMs,jitterMs:sync.jitterMs,delayMs:sync.delayMs,
  stale:age>450,ageMs:age,received:sync.packetsReceived,rejected:sync.packetsRejected,missing:sync.packetsMissing};
}
