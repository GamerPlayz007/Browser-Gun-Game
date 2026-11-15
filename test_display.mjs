import assert from 'node:assert/strict';
import {AutoQuality,displaySize,createDisplay,QUALITY_MODES} from './static/display.js';
for(const [w,h,dpr] of [[1366,768,1],[1920,1080,1],[1536,864,1.25],[1920,1080,2],[2560,1440,2]]){
 const size=displaySize(w,h,dpr);assert.equal(size.width,Math.round(w*dpr));assert.equal(size.height,Math.round(h*dpr));
}
assert.equal(displaySize(10000,8000,3,1,16384).width,16384);
assert.deepEqual(QUALITY_MODES,['auto','performance','high','ultra','native']);
const q=new AutoQuality('auto');const frames=(n,ms,dpr=2)=>{for(let i=0;i<n;i++)q.sample(ms,dpr);};
frames(180,16);frames(240,25);assert.equal(q.detail,false);frames(240,25);assert.equal(q.scale,.92);
frames(2600,25);assert.ok(q.scale>=.65&&q.scale<=.92);
frames(6000,10);assert.equal(q.scale,1);frames(600,10);assert.equal(q.detail,true);
q.setMode('high');frames(3000,40);assert.equal(q.detail,true);assert.equal(q.scale,1);
q.setMode('performance');frames(3000,40);assert.equal(q.detail,false);
q.setMode('ultra');assert.equal(q.detail,true);
q.setMode('auto');for(let i=0;i<1000;i++)q.sample(90,2,false);assert.equal(q.scale,1);
let detail=true,ratio=0,resizes=0;
globalThis.window={innerWidth:1920,innerHeight:1080,devicePixelRatio:2};globalThis.document={hidden:false};
const renderer={getContext:()=>({MAX_RENDERBUFFER_SIZE:1,getParameter:()=>16384}),setPixelRatio:r=>ratio=r,setSize:()=>resizes++};
const camera={updateProjectionMatrix(){}};const display=createDisplay(renderer,[camera],d=>detail=d,'high');
assert.equal(ratio,2);display.frame(16);assert.equal(resizes,1);
display.setMode('performance');assert.equal(ratio,1);assert.equal(detail,false);
display.setMode('ultra');assert.equal(ratio,2);assert.equal(detail,true);
window.innerWidth=1280;window.innerHeight=720;display.resize();assert.equal(display.buffer.width,2560);assert.equal(camera.aspect,1280/720);
window.devicePixelRatio=1.25;display.frame(16);assert.equal(ratio,1.25);
display.setMode('auto');assert.ok(ratio<=1.15+1e-6&&ratio>=1.0);
window.devicePixelRatio=3;display.resize();assert.ok(ratio<=1.15+1e-6,'Auto must cap HiDPI render cost');
display.setMode('native');assert.equal(ratio,3,'Native still permits full HiDPI');

console.log('02.5 display: Performance / High / Ultra / Native, resize and Auto hysteresis passed.');
