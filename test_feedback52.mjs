import assert from 'node:assert/strict';
import {confirmedHit} from './static/combat32.js';
import {FEEDBACK52,makeCombatFeedback52,crosshairSpread52,tracerCount52,recoilFeel52} from './static/feedback52.js';
import {AudioEngine} from './static/audio.js';

const fb=makeCombatFeedback52();
assert.equal(fb.sample(0).active,false);
assert.equal(fb.confirm({type:'shot',id:'me',damage:35},'me',1),null,
 'Local shots are never allowed to show hit feedback');
assert.equal(fb.confirm({type:'hit',id:'enemy',damage:35,head:true},'me',1),null,
 'Remote player hits cannot confirm our shots');
assert.equal(fb.confirm({type:'hit',id:'me',damage:0,head:true},'me',1),null,
 'Zero damage cannot display a confirmation');
const first=fb.confirm({type:'hit',id:'me',damage:20,head:false},'me',1);
assert.equal(first.damage,20);assert.equal(first.head,false);assert.equal(first.hits,1);
let sample=fb.sample(1);
assert.equal(sample.active,true);assert.ok(sample.alpha>0);
assert.ok(sample.scale>1);
const stack=fb.confirm({type:'hit',id:'me',damage:45,head:true,killed:true},'me',1.07);
assert.equal(stack.damage,65,'Near-simultaneous server hits stack for readability');
assert.equal(stack.hits,2);
assert.equal(stack.head,true);assert.equal(stack.killed,true);
assert.ok(fb.sample(1.10).strength>.4);
assert.equal(fb.sample(1.9).active,false);
const fresh=fb.confirm({type:'hit',id:'me',damage:11},'me',2.0);
assert.equal(fresh.damage,11,'Old damage does not carry into new confirmation');
assert.equal(fresh.head,false);
fb.reset();assert.equal(fb.sample(2.01).active,false);
assert.equal(fb.confirm({type:'hit',id:'me',damage:30},'me',NaN),null);
assert.equal(confirmedHit({type:'hit',id:'enemy',damage:30},'me'),null);

const standing=crosshairSpread52({speed:0,grounded:true,weapon:0});
const running=crosshairSpread52({speed:8,grounded:true,weapon:0,sprint:true});
const airborne=crosshairSpread52({speed:8,grounded:false,weapon:0,sprint:true});
const recoil=crosshairSpread52({speed:0,grounded:true,weapon:0,recoil:.15});
const crouched=crosshairSpread52({speed:0,grounded:true,crouch:true,weapon:0});
const aiming=crosshairSpread52({speed:0,grounded:true,aim:.8,weapon:0});
assert.ok(running>standing,'Moving should visually widen the reticle');
assert.ok(airborne>running,'Airborne movement should be less steady');
assert.ok(recoil>standing,'Shooting opens the reticle');
assert.ok(crouched<standing,'Crouching tightens the reticle');
assert.ok(aiming<standing,'Aiming tightens the reticle');
for(const args of [{speed:NaN,recoil:Infinity},{speed:2500,recoil:7},{weapon:-1},{weapon:99}]){
 const size=crosshairSpread52(args);assert.ok(Number.isFinite(size)&&size>=15&&size<=58);
}
for(const quality of ['performance','auto','high','ultra','native']){
 const ids=tracerCount52(quality,20);
 const max=quality==='performance'?2:quality==='auto'?4:quality==='ultra'?10:6;
 assert.equal(ids.length,max);assert.equal(ids[0],0);assert.equal(ids.at(-1),19);
 assert.ok(ids.every((n,i)=>Number.isInteger(n)&&n>=0&&n<20&&(i===0||n>ids[i-1])));
}
assert.deepEqual(tracerCount52('ultra',3),[0,1,2]);
assert.deepEqual(tracerCount52('performance',0),[]);
assert.equal(FEEDBACK52.maxTracers,36);
assert.ok(recoilFeel52(2,0).flashScale>recoilFeel52(1,0).flashScale);
assert.ok(recoilFeel52(2,1).shakeScale<recoilFeel52(2,0).shakeScale);

const audio=new AudioEngine();
audio.ctx=null;audio.confirm52(true,true);
let tones=0;audio.ctx={};audio.tone=()=>{tones++;};
audio.confirm52(false,false);assert.equal(tones,1);
audio.confirm52(true,false);assert.equal(tones,3);
audio.confirm52(true,true);assert.equal(tones,6);
audio.volume=0;audio.confirm52(true,true);assert.equal(tones,6);
console.log('Phase 5.2: server-only hits, stacking, headshots, crosshair dynamics,');
console.log('bounded quality-tier tracers, recoil and muted audio passed.');
