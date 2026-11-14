import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {simulate} from './static/physics.js';
const map=JSON.parse(fs.readFileSync('static/map.json'));
const commands=Array.from({length:150},(_,i)=>({seq:i+1,spawn:1,yaw:i<95?0:.8,pitch:0,input:{w:i<125,sprint:i<100,jump:i===10||i===50||i===115,d:i>=20&&i<70,slide:i===80||i===81,ads:i>=100&&i<120}}));
const py=`import json,sys,server as s
cmds=json.load(sys.stdin);r=s.Room('T');r.phase='playing';r.started=100
p=s.new_player(r,'a','a',100);p.update(x=-24.,y=1.,z=13.)
initial=dict(r.snapshot(100)['players'][0]);states=[]
for i,c in enumerate(cmds):
 p['commands'].append(c);r.step(s.TICK,100+(i+1)*s.TICK);states.append(r.snapshot(100+(i+1)*s.TICK)['players'][0])
print(json.dumps({'initial':initial,'states':states}))`;
const result=spawnSync('python',['-c',py],{input:JSON.stringify(commands),encoding:'utf8'});assert.equal(result.status,0,result.stderr);const {initial,states}=JSON.parse(result.stdout);
function step(p,c){p.yaw=c.yaw;p.motion_time+=1/30;simulate(p,c.input,1/30,p.motion_time,map.boxes,map.weapons[0]);}
function equal(p,q){for(const k of ['x','y','z','vx','vy','vz'])assert.ok(Math.abs(p[k]-q[k])<1e-7,`${k}: ${p[k]} vs ${q[k]}`);}
for(const fps of [10,20,30,60,144]){let p={...initial},acc=0,n=0;for(let f=0;f<fps*5+1;f++){acc+=1/fps;while(acc+1e-10>=1/30&&n<commands.length){step(p,commands[n]);equal(p,states[n]);n++;acc-=1/30;}}assert.equal(n,150);equal(p,states[149]);}
// Delayed authoritative snapshots: replay every still-unacknowledged command.
let p={...initial};for(let i=0;i<commands.length;i++){step(p,commands[i]);if(i>6&&i%7===0){p={...states[i-6]};for(let j=i-5;j<=i;j++)step(p,commands[j]);}equal(p,states[i]);}
console.log('Movement parity passed at 10, 20, 30, 60 and 144 FPS; sprint+jump, diagonal input, slide, ADS, collisions, and 200 ms acknowledgement replay passed.');
