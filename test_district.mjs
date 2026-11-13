import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {simulate} from './static/physics.js';
import {createMinimap} from './static/minimap.js';
const map=JSON.parse(fs.readFileSync('static/map.json'));
const routes=[[-13,20,Math.PI],[13,20,Math.PI],[-13,-20,0],[13,-20,0]];
const py=`import server as s,json,sys
out=[]
for x,z,yaw in json.load(sys.stdin):
 r=s.Room('R');p=s.new_player(r,'p','p',100);p.update(x=x,z=z,y=0,yaw=yaw,input={'w':True});states=[]
 for i in range(70):
  p['last_input']=100+i*s.TICK;s.move(p,s.TICK,100+i*s.TICK);states.append({k:p[k] for k in ['x','y','z','vx','vy','vz']})
 out.append(states)
print(json.dumps(out))`;
const result=spawnSync('python',['-c',py],{input:JSON.stringify(routes),encoding:'utf8'});
assert.equal(result.status,0,result.stderr);const expected=JSON.parse(result.stdout);
for(const [j,[x,z,yaw]] of routes.entries()){
 const p={x,y:0,z,yaw,vx:0,vy:0,vz:0,grounded:true,slide_ready:0,slide_until:0,jump_held:false,slide_held:false};
 for(let i=0;i<70;i++){
  simulate(p,{w:true},1/30,100+i/30,map.boxes,map.weapons[0]);
  for(const k of ['x','y','z','vx','vy','vz'])assert.ok(Math.abs(p[k]-expected[j][i][k])<1e-7,`${j}/${i}/${k}`);
 }
 assert.equal(p.y,4);
}
let redraws=0;
const context={fillRect(){},fillText(){},clearRect(){},drawImage(){redraws++;},save(){},restore(){},translate(){},rotate(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){}};
globalThis.document={createElement:()=>({getContext:()=>context})};
const canvas={getContext:()=>context},label={textContent:''};
const mini=createMinimap(canvas,label,map);
mini.draw({x:0,y:0,z:-44},0,1);assert.equal(label.textContent,'OBSERVATORY');assert.equal(redraws,1);
mini.draw({x:0,y:0,z:-44},1,1.02);assert.equal(redraws,1);
mini.draw({x:13,y:4,z:34},0,2);assert.equal(label.textContent,'GARDENS / ROOFTOPS');
mini.draw({x:-39,y:0,z:0},0,3);assert.equal(label.textContent,'BAZAAR');
mini.draw({x:39,y:0,z:0},0,4);assert.equal(label.textContent,'FREIGHT YARD');
console.log('District client/server stair parity and throttled minimap navigation passed.');
