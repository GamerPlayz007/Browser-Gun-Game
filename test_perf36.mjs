import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FrameMeter,percentile,formatDiagnostics} from './static/perf36.js';
import {createNetSync,ingestSnapshot,syncStats} from './static/netcode33.js';

const close=(a,b,tol=.5)=>assert.ok(Math.abs(a-b)<tol,`${a} vs ${b}`);
const meter=new FrameMeter(180);
assert.equal(meter.summary().samples,0);
for(let i=0;i<120;i++)assert.equal(meter.record(1000/60),true);
let frames=meter.summary();
close(frames.fps,60);
close(frames.low1Fps,60);
close(frames.p95Ms,16.667,.03);
assert.equal(frames.samples,120);
for(let i=0;i<6;i++)meter.record(33.333);
frames=meter.summary();
assert.ok(frames.low1Fps<40,'A small number of slow frames must hurt 1% low');
assert.ok(frames.p99Ms>30,'p99 tracks stutter');
assert.ok(frames.fps<60);
assert.equal(meter.record(-3),false);
assert.equal(meter.record(NaN),false);
assert.equal(meter.summary().samples,126,'Invalid frame samples are ignored');
meter.record(500);
assert.equal(meter.summary().samples,0,'Long tab sleep resets frame history');
assert.equal(meter.record(16.67,false),false);
assert.equal(meter.summary().samples,0);
for(let i=0;i<300;i++)meter.record(10);
assert.equal(meter.summary().samples,180,'The ring buffer has a fixed capacity');
close(meter.summary().fps,100);
close(percentile([11,5,9,1,3],.95),11,.01);
assert.equal(percentile([],1),0);

const sync=createNetSync();
const p={id:'p',x:0,y:1,z:0,yaw:0};
assert.equal(ingestSnapshot(sync,{snapshotSeq:21,serverTime:10,players:[p]},10000),true);
assert.equal(sync.packetsMissing,0,'Initial sequence does not count past room frames');
assert.equal(ingestSnapshot(sync,{snapshotSeq:24,serverTime:10.15,players:[p]},10150),true);
assert.equal(sync.packetsMissing,2);
assert.equal(ingestSnapshot(sync,{snapshotSeq:22,serverTime:10.1,players:[p]},10151),false);
assert.equal(sync.packetsMissing,2,'Rejected packets do not affect gap totals');
const net=syncStats(sync,10170);
assert.equal(net.missing,2);
assert.equal(net.rejected,1);
const view=formatDiagnostics(frames,{...net,rttMs:280,delayMs:135},{
 quality:'PERFORMANCE 100% DPR',drawCalls:123,triangles:180000,
 textures:45,geometries:68,shaderPrograms:14,visibleMeshes:155,
 visibleInstances:640,shadowCasters:22,pixelWidth:1280,pixelHeight:720,
 atmosphereRain:0,atmosphereMotes:0,activeAds:4,activeDrones:0
});
for(const label of ['1% LOW FPS','FRAME P95','RTT','JITTER','BUFFER','SEQ GAPS',
 'DRAW CALLS','TRIANGLES','GPU TEXTURES','GPU GEOMETRY','SHADERS','INSTANCES','RAIN / MOTES','PERFORMANCE 100% DPR'])
 assert.ok(view.includes(label),`Missing diagnostics: ${label}`);
assert.ok(!view.includes('NaN'));
const ui=fs.readFileSync('./static/index.html','utf8');
for(const id of ['perf-panel','perf-details','diagnostics-toggle','copy-diagnostics']){
 assert.ok(ui.includes(`id="${id}"`),`Missing diagnostics DOM: ${id}`);
}
assert.ok(ui.includes('<sup>V3.1 DAYBREAK</sup>'));
const game=fs.readFileSync('./static/game.js','utf8');
assert.ok(game.includes('frameMeter.record(rawMs'));
assert.ok(game.includes("e.code==='F7'"));
const keyboard=game.slice(game.indexOf("document.addEventListener('keydown'"),
 game.indexOf("document.addEventListener('keyup'"));
assert.ok(keyboard.indexOf("if(e.code==='F7'")>=0 &&
 keyboard.indexOf("if(e.code==='F7'")<keyboard.indexOf("if(['INPUT'"),
 'F7 must be handled before the focused-input guard');
assert.ok(game.includes('formatDiagnostics'));
assert.ok(game.includes("e.code==='F8'"),'F8 copies diagnostics');
assert.ok(game.includes('createDebugReport51'),'Playtest diagnostic export wired');
console.log('Stage 3.6: frame pacing, slow-frame detection, sequence gaps, bounded sampling,');
console.log('and HUD diagnostics contracts passed.');
