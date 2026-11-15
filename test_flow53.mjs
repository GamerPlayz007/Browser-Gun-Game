import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {simulate,FIXED_DT,MOVE} from './static/physics.js';
import {movementCue53,cameraFeel53} from './static/flow53.js';

// Compare new mechanics against the real Python authoritative movement.
// All cases use the SAME fixture colliders, input sequence, player state and ticks.
const floor={x:0,y:-1,z:0,w:50,h:1,d:50,kind:'floor'};
const ledge={x:0,y:0,z:-4,w:4,h:1,d:4,kind:'deck'};
const base={x:0,y:0,z:4,vx:0,vy:0,vz:0,yaw:0,
 grounded:true,slide_until:0,slide_ready:0,slide_held:false,
 jump_held:false,interact_held:false,weapon:0,motion_time:0,
 crouch:false,mantle:null,jump_buffer_until:0,coyote_until:0,
 jump_consumed:false,jump_cut:false,wall_kick_used:false,last_input:0,
 input:{}};
const slide={name:'slide-hop',boxes:[floor],initial:{...base,vz:-8,slide_until:1.3,
 slide_ready:1.6,slide_held:true,motion_time:.5,last_input:.5},
 inputs:Array.from({length:75},(_,i)=>({w:i<55,sprint:i<55,slide:i<4,
 jump:i<12}))};
const mantle={name:'held-E-mantle',boxes:[floor,ledge],initial:{...base,z:-1.6,
 interact_held:true,motion_time:.5,last_input:.5},
 inputs:Array.from({length:50},()=>({w:true,sprint:true,interact:true}))};
const blocked={name:'blocked-ledge',boxes:[floor,ledge,
 {x:0,y:1,z:-4,w:4,h:2,d:4,kind:'building'}],
 initial:{...base,z:-1.6,interact_held:true,motion_time:.5,last_input:.5},
 inputs:Array.from({length:10},()=>({w:true,interact:true}))};
const scenarios=[slide,mantle,blocked];
const script=`import json,sys
from map_registry import Arena
from movement_live import step_player,FIXED_DT
data=json.load(sys.stdin)
output=[]
for scenario in data:
    arena=Arena({'id':'fixture','boxes':scenario['boxes'],'spawns':[[0,0,4]]})
    p=dict(scenario['initial'])
    states=[]
    for inp in scenario['inputs']:
        p['motion_time']+=FIXED_DT
        p['last_input']=p['motion_time']
        p['input']=inp
        step_player(p,FIXED_DT,p['motion_time'],arena,[{'speed':1}])
        states.append({k:p.get(k) for k in ('x','y','z','vx','vy','vz',
            'grounded','crouch','slide_until','slide_ready','mantle',
            'jump_held','slide_held','jump_consumed','wall_kick_used')})
    output.append(states)
print(json.dumps(output))`;
const py=spawnSync('python',['-c',script],{input:JSON.stringify(scenarios),
 encoding:'utf8',maxBuffer:12*1024*1024});
assert.equal(py.status,0,py.stderr);
const authoritative=JSON.parse(py.stdout);
for(let index=0;index<scenarios.length;index++){
 const scenario=scenarios[index],p={...scenario.initial},states=authoritative[index];
 for(let i=0;i<scenario.inputs.length;i++){
  p.motion_time+=FIXED_DT;
  simulate(p,scenario.inputs[i],FIXED_DT,p.motion_time,scenario.boxes,{speed:1});
  const actual=states[i];
  for(const key of ['x','y','z','vx','vy','vz','slide_until','slide_ready']){
   assert.ok(Math.abs(p[key]-actual[key])<1e-7,
    scenario.name+' frame '+i+' '+key+': '+p[key]+' vs '+actual[key]);
  }
  for(const key of ['grounded','crouch','jump_held','slide_held','jump_consumed','wall_kick_used']){
   assert.equal(p[key],actual[key],scenario.name+' frame '+i+' '+key);
  }
  assert.equal(Boolean(p.mantle),Boolean(actual.mantle),scenario.name+' mantle state frame '+i);
  if(p.mantle)for(const key of ['sx','sy','sz','tx','ty','tz','elapsed','duration'])
   assert.ok(Math.abs(p.mantle[key]-actual.mantle[key])<1e-7,
    scenario.name+' mantle '+key+' frame '+i);
 }
}
assert.ok(authoritative[0][0].vy>MOVE.jumpSpeed,
 'Slide-to-jump chain grants the small capped hop lift');
assert.ok(Math.hypot(authoritative[0][0].vx,authoritative[0][0].vz)>7,
 'Slide momentum is preserved when leaving the ground');
assert.equal(Boolean(authoritative[1][0].mantle),true,
 'Holding E while advancing must grab a reachable ledge');
const afterMantle=authoritative[1].find((step,i)=>i>0&&!step.mantle&&authoritative[1][i-1].mantle);
assert.ok(afterMantle,'Mantle completes within its intended time');
assert.ok(afterMantle.grounded);
assert.ok(Math.hypot(afterMantle.vx,afterMantle.vz)>=MOVE.mantleExitSpeed-.001,
 'Mantle exits with a small bounded forward carry');
assert.ok(authoritative[2].every(step=>!step.mantle),
 'Blocked head clearance must not trigger a mantle');
assert.equal(movementCue53({mantle:{}},{},5,0),'VAULTING');
assert.equal(movementCue53({grounded:false},{},5,5.2),'SLIDE HOP');
assert.equal(movementCue53({grounded:false,wall_kick_used:true},{},5,0),'WALL KICK');
assert.equal(movementCue53({grounded:true,vx:7,vz:0},{sprint:true},5,0),'SPRINTING');
assert.equal(movementCue53({grounded:true,vx:0,vz:0},{},5,0),'READY');
assert.deepEqual(cameraFeel53({},0,{motion:false}),{roll:0,fovBoost:0,vaultDip:0});
assert.ok(cameraFeel53({vx:9,vz:0,crouch:true,mantle:{}},0,{motion:true,aim:0}).fovBoost>0);
assert.equal(cameraFeel53({vx:9,vz:0},0,{motion:true,aim:1}).fovBoost,0);
console.log('Phase 5.3: exact Python/JS parity for slide hops, held-E ledges,');
console.log('blocked vaults, mantle exit velocity, camera & UI cues passed.');
