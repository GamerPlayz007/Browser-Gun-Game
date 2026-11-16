import assert from 'node:assert/strict';
import {createNetSync,observePong,ingestSnapshot,sampleRemote,shortAngle,
 cameraCorrection,syncStats} from './static/netcode33.js';

const near=(a,b,e=.0001)=>assert.ok(Math.abs(a-b)<=e,`expected ${a} ~= ${b}`);
const createPlayer=(x,yaw=0,spawn=1,other={})=>({
 id:'rival',name:'Rival',x,y:1,z:0,vx:4,vy:0,vz:0,
 yaw,pitch:0,grounded:true,crouch:false,hp:100,weapon:0,spawn,...other
});
const packet=(seq,sec,player)=>({type:'state',snapshotSeq:seq,serverTime:sec,
 players:[player]});
const net=createNetSync();
// Client performance clock is 40s ahead of server monotonic clock.
assert.equal(observePong(net,60000,60120,20.06),true);
near(net.clockOffsetMs,40000);
near(net.rttMs,120);
assert.equal(observePong(net,60160,60100,20.06),false);
assert.equal(observePong(net,0,10000,1),false);
assert.equal(ingestSnapshot(net,packet(1,20,createPlayer(0,3.12)),60060),true);
assert.equal(ingestSnapshot(net,packet(2,20.05,createPlayer(1,-3.12)),60110),true);
const halfway=sampleRemote(net,'rival',60120); // 20.025s virtual server time
near(halfway.x,.5);
assert.equal(halfway.lean,0,'Older snapshots without lean remain neutral');
assert.ok(Math.abs(Math.abs(halfway.yaw)-Math.PI)<.03,'yaw crosses +/-pi without a full revolution');
assert.ok(halfway.grounded);
const future=sampleRemote(net,'rival',60500);
near(future.x,1+4*.08);
assert.equal(future.y,1,'grounded player never extrapolates vertical velocity');
const before=net.lastSeq;
assert.equal(ingestSnapshot(net,packet(1,19.9,createPlayer(-100)),60500),false);
assert.equal(net.lastSeq,before);
assert.equal(net.remote.get('rival').length,2,'reject out-of-order rewind');
assert.equal(net.packetsRejected,1);

assert.equal(ingestSnapshot(net,packet(4,20.15,createPlayer(2)),60210),true);
assert.equal(net.lastSeq,4,'dropped packet does not block forward progression');
assert.ok(syncStats(net,60210).jitterMs>=0);
assert.equal(ingestSnapshot(net,packet(5,20.2,createPlayer(50)),60260),true);
assert.equal(net.remote.get('rival').length,1,'teleport resets interpolation history');
assert.equal(ingestSnapshot(net,packet(6,20.25,createPlayer(51,0,2)),60310),true);
assert.equal(net.remote.get('rival').length,1,'respawn generation resets history');
assert.equal(sampleRemote(net,'rival',60310).x,51);
assert.equal(ingestSnapshot(net,{...packet(7,20.3,createPlayer(54)),players:[]},60360),true);
assert.equal(net.remote.has('rival'),false,'player removal frees stale buffers');

const unstable=createNetSync();
observePong(unstable,1000,1050,1);
for(let i=0;i<30;i++){
 const received=1200+i*50+(i%2?24:-24);
 ingestSnapshot(unstable,packet(i+1,1.15+i*.05,createPlayer(i/2)),received);
}
assert.ok(unstable.delayMs>95,'network jitter grows interpolation buffer');
assert.ok(unstable.delayMs<=185,'interpolation stays bounded');
assert.ok(unstable.remote.get('rival').length<=32);
assert.ok(syncStats(unstable,4000).stale,'stale link is detectable');
assert.equal(syncStats(unstable,2700).stale,false,'recent snapshot is active');

const smooth=cameraCorrection({x:5.1,y:1,z:1},{x:5,y:1,z:1});
assert.equal(smooth.snapped,false);near(smooth.x,.1);
const snap=cameraCorrection({x:100,y:1,z:1},{x:1,y:1,z:1});
assert.equal(snap.snapped,true);near(snap.x,0);
assert.equal(cameraCorrection({x:NaN,y:0,z:0},{x:0,y:0,z:0}).snapped,true);
near(shortAngle(-3.13,3.13,.5),-Math.PI,.02);

// Eight remote players, 150 consecutive snapshots with bounded jitter and loss.
const crowd=createNetSync();
assert.equal(observePong(crowd,1000,1250,1.125),true);
for(let frame=0;frame<150;frame++){
 const people=Array.from({length:8},(_,i)=>({
  ...createPlayer(i*10+frame*.1),id:'p'+i,z:i*2,spawn:1
 }));
 const arrival=10000+frame*50+(frame%5===0?18:frame%3===0?-12:0);
 assert.equal(ingestSnapshot(crowd,{
  snapshotSeq:frame+1,serverTime:10+frame*.05,players:people
 },arrival),true);
}
assert.equal(crowd.remote.size,8,'maintain separate bounded history for 8 players');
for(let i=0;i<8;i++){
 const buffer=crowd.remote.get('p'+i);
 assert.ok(buffer.length>=2&&buffer.length<=32);
 const position=sampleRemote(crowd,'p'+i,17500);
 assert.ok(position&&Number.isFinite(position.x)&&Number.isFinite(position.z));
}
assert.ok(crowd.delayMs>=95&&crowd.delayMs<=185);
const lastPeople=Array.from({length:7},(_,i)=>({
 ...createPlayer(i*10+15),id:'p'+i,z:i*2,spawn:1
}));
assert.equal(ingestSnapshot(crowd,{
 snapshotSeq:151,serverTime:17.5,players:lastPeople
},17570),true);
assert.equal(crowd.remote.size,7,'departures purge stale player histories');
assert.equal(crowd.remote.has('p7'),false);

console.log('Stage 3.3: server clock, 20 Hz timeline, adaptive jitter, 80ms extrapolation,');
console.log('spawn/teleport reset, out-of-order rejection and camera correction passed.');
