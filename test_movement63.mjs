import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {simulate,FIXED_DT,MOVE,seedMovement} from './static/physics.js';
import {createMovementControls63} from './static/controls63.js';
import {allowedLean63,leanOffset63} from './static/lean63.js';

const mapper=createMovementControls63();
assert.equal(mapper.input({},true).crouch,false);
assert.equal(mapper.toggleCrouch(),true);
assert.equal(mapper.input({KeyQ:true,KeyF:true,KeyC:true},true).leanLeft,true);
assert.equal(mapper.input({KeyQ:true,KeyF:true,KeyC:true},true).interact,true);
assert.equal(mapper.input({},false).crouch,false);
assert.equal(mapper.toggleCrouch(),false);
mapper.reset();
assert.equal(mapper.crouched,false);
assert.deepEqual(leanOffset63(0,1),{x:.52,z:0});
const floor={x:0,y:-1,z:0,w:80,h:1,d:80,kind:'floor'};
const wall={x:.6,y:0,z:0,w:.35,h:3,d:20,kind:'building'};
const initial={x:0,y:0,z:4,vx:0,vy:0,vz:-8,yaw:0,
 grounded:true,crouch:false,slide_until:0,slide_ready:0,slide_held:false,
 jump_held:false,interact_held:false,weapon:0,motion_time:0,
 mantle:null,jump_buffer_until:0,coyote_until:0,jump_consumed:false,
 jump_cut:false,wall_kick_used:false,last_input:0,input:{},lean:0};
const input=Array.from({length:240},(_,i)=>({
 w:i<180,sprint:i<180,crouch:i>=36&&i<65,
 slide:i===10||i===79||i===135,
 jump:i>=110,leanRight:i<35||i>=145&&i<177,
 leanLeft:i>=70&&i<108,interact:false
}));
const scenarios=[{name:'open-space',boxes:[floor],initial,inputs:input},
 {name:'cover-peeking',boxes:[floor,wall],initial,inputs:input.slice(0,100)}];
assert.ok(allowedLean63(initial,{leanRight:true},[floor,wall])<1);
assert.equal(allowedLean63(initial,{leanLeft:true},[floor,wall]),-1);
const pyScript=`import json,sys
from map_registry import Arena
from movement_live import step_player,FIXED_DT
data=json.load(sys.stdin);out=[]
for scenario in data:
 arena=Arena({'id':'fixture','boxes':scenario['boxes'],'spawns':[[0,0,4]]})
 p=dict(scenario['initial']);series=[]
 for inp in scenario['inputs']:
  p['motion_time']+=FIXED_DT;p['last_input']=p['motion_time'];p['input']=inp
  step_player(p,FIXED_DT,p['motion_time'],arena,[{'speed':1}])
  series.append({k:p.get(k) for k in ('x','y','z','vx','vy','vz','grounded',
   'crouch','slide_until','slide_ready','lean','jump_consumed')})
 out.append(series)
print(json.dumps(out))`;
const result=spawnSync('python',['-c',pyScript],{encoding:'utf8',
 input:JSON.stringify(scenarios),maxBuffer:8*1024*1024});
assert.equal(result.status,0,result.stderr);
const states=JSON.parse(result.stdout);
for(let s=0;s<scenarios.length;s++){
 const scenario=scenarios[s],p={...scenario.initial};
 const server=states[s];let jumps=0,slides=0,wasJumping=false,lastSlide=0;
 for(let i=0;i<scenario.inputs.length;i++){
  p.motion_time+=FIXED_DT;
  const beforeVy=p.vy;
  simulate(p,scenario.inputs[i],FIXED_DT,p.motion_time,scenario.boxes,{speed:1});
  for(const k of ['x','y','z','vx','vy','vz','slide_until','slide_ready','lean']){
   assert.ok(Math.abs(p[k]-server[i][k])<1e-7,
    scenario.name+' frame '+i+' '+k+': JS='+p[k]+' PY='+server[i][k]);
  }
  for(const k of ['grounded','crouch','jump_consumed'])
   assert.equal(p[k],server[i][k],scenario.name+' frame '+i+' '+k);
  if(p.vy>6.5&&beforeVy<=6.5)jumps++;
  if(p.slide_until>lastSlide+.15){slides++;lastSlide=p.slide_until;}
 }
 if(s===0){
  assert.ok(jumps>=2,'Holding Space should jump again after landing');
  assert.ok(slides>=2,'Sliding must work repeatedly with no cooldown');
  assert.equal(MOVE.slideCD,0);
 }
}
console.log('Daybreak 6.3: ctrl toggles, F vault mapping, repeated hops, no-CD slides, Q/E safe lean and JS/Python parity passed.');
