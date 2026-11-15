import assert from 'node:assert/strict';
import {fireMode, makeTrigger, pressTrigger, releaseTrigger, takeTriggerPulse,
  predictedAmmo, reloadFraction, ammoState, damageBearing, confirmedHit} from './static/combat32.js';
const weapons = [{id:0,type:'ASSAULT RIFLE'},{id:1,type:'SUBMACHINE GUN'},
  {id:2,type:'PUMP SHOTGUN'},{id:3,type:'PRECISION RIFLE'}];
for (const id of [0,1]) assert.equal(fireMode(weapons[id]),'auto');
for (const id of [2,3]) assert.equal(fireMode(weapons[id]),'semi');
assert.equal(fireMode({fireMode:'semi',type:'ASSAULT RIFLE'}),'semi');
assert.equal(fireMode({fireMode:'auto',type:'PUMP SHOTGUN'}),'auto');
const auto=makeTrigger();pressTrigger(auto);
for(let i=0;i<5;i++)assert.ok(takeTriggerPulse(auto,weapons[0]));
releaseTrigger(auto);assert.equal(takeTriggerPulse(auto,weapons[0]),false);
const semi=makeTrigger();pressTrigger(semi);assert.ok(takeTriggerPulse(semi,weapons[2]));
for(let i=0;i<6;i++)assert.equal(takeTriggerPulse(semi,weapons[2]),false);
pressTrigger(semi);assert.equal(takeTriggerPulse(semi,weapons[2]),false); // auto repeat / duplicate press ignored
releaseTrigger(semi);pressTrigger(semi);assert.ok(takeTriggerPulse(semi,weapons[2]));
assert.equal(predictedAmmo(5,[{weapon:3},{weapon:3},{weapon:1}],3),3);
assert.equal(predictedAmmo(1,[{weapon:3},{weapon:3},{weapon:3}],3),0);
assert.equal(predictedAmmo(NaN,[],3),0);
assert.equal(reloadFraction(1,2),.5);
assert.equal(reloadFraction(3,2),0);
assert.equal(reloadFraction(0,2),0);
assert.equal(ammoState(0,30),'empty');
assert.equal(ammoState(3,30),'low');
assert.equal(ammoState(29,30),'ready');
assert.equal(damageBearing([0,0,-10],{x:0,z:0},0),0);
assert.equal(damageBearing([10,0,0],{x:0,z:0},0),90);
assert.equal(damageBearing([-10,0,0],{x:0,z:0},0),-90);
assert.equal(damageBearing([10,0,0],{x:0,z:0},-Math.PI/2),0);
assert.equal(damageBearing([0,0,10],{x:0,z:0},0),-180);
assert.equal(damageBearing([0,0,0],{x:0,z:0},0),null);
assert.deepEqual(confirmedHit({type:'hit',id:'me',damage:35,head:true,killed:false},'me'),{damage:35,head:true,killed:false});
assert.equal(confirmedHit({type:'shot',id:'me',damage:20},'me'),null);
assert.equal(confirmedHit({type:'hit',id:'other',damage:20},'me'),null);
assert.equal(confirmedHit({type:'hit',id:'me',damage:0},'me'),null);
console.log('Stage 3.2 combat input + server confirmation: 30+ assertions passed.');