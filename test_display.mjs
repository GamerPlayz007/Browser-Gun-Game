import assert from 'node:assert/strict';
import {AutoQuality,displaySize,createDisplay} from './static/display.js';
for(const [width,height,dpr] of [[1366,768,1],[1920,1080,1],[1536,864,1.25],[1920,1080,2],[2560,1440,2]]){
 const size=displaySize(width,height,dpr);assert.equal(size.width,Math.round(width*dpr));assert.equal(size.height,Math.round(height*dpr));
}
assert.equal(displaySize(10000,8000,3,1,16384).width,16384);
const q=new AutoQuality();
const frames=(n,ms,dpr=2)=>{for(let i=0;i<n;i++)q.sample(ms,dpr);};
frames(150,16.67);frames(240,25);assert.equal(q.detail,false);assert.equal(q.scale,1,'Detail changes before pixels');
frames(240,25);assert.equal(q.scale,.95);frames(2400,25);assert.equal(q.scale,.75);
frames(3000,16.67);assert.equal(q.scale,1);assert.equal(q.detail,false);frames(600,16.67);assert.equal(q.detail,true);
q.reset();frames(3000,25,1);assert.equal(q.scale,1,'Never downsample below one rendered pixel per CSS pixel');
q.setMode('native');frames(3000,40);assert.equal(q.scale,1);assert.equal(q.detail,true);
q.setMode('auto');for(let i=0;i<1000;i++)q.sample(90,2,false);assert.equal(q.scale,1);
frames(150,16.67);frames(120,60);frames(120,16.67);assert.equal(q.scale,1,'Transient stalls do not shrink the buffer');
let detail=true,ratio=0,resizes=0;
globalThis.window={innerWidth:1920,innerHeight:1080,devicePixelRatio:2};globalThis.document={hidden:false};
const renderer={getContext:()=>({MAX_RENDERBUFFER_SIZE:1,getParameter:()=>16384}),setPixelRatio:r=>ratio=r,setSize:()=>resizes++};
const camera={updateProjectionMatrix(){}};const display=createDisplay(renderer,[camera],d=>detail=d,'auto');
assert.equal(ratio,2);display.frame(16.67);assert.equal(resizes,1,'No repeated allocations on stable frames');
window.innerWidth=1280;window.innerHeight=720;display.resize();assert.equal(display.buffer.width,2560);assert.equal(camera.aspect,1280/720);
window.devicePixelRatio=1.25;display.frame(16.67);assert.equal(ratio,1.25);
console.log('Display sizing, DPR/resize changes, quality hysteresis, recovery and Native mode passed.');
