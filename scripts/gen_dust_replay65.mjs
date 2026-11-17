/** Generate reproducible client source-mesh movement snapshots for Python. */
import fs from 'node:fs';
import {MapGenerator} from '../static/dust_corridor/src/world/MapGenerator.js';
import {createDustPhysics65} from '../static/dust_motion65.js';

const map=JSON.parse(fs.readFileSync('static/maps/dust_corridor.json','utf8'));
const data=new MapGenerator().generate();
const physics=createDustPhysics65(data);
const pick=map.validatedSpawns.A.safeIndices[0];
const [x,y,z]=map.spawnSets.A[pick];
let p={x,y,z,vx:0,vy:0,vz:0,yaw:Math.PI,grounded:true,crouch:false,
 slide_until:0,slide_ready:0,jump_held:false,slide_held:false,
 jump_consumed:false,jump_cut:false,mantle:null,lean:0,wall_kick_used:false,interact_held:false};
const commands=[],trace=[];
for(let i=0;i<165;i++){
 const yaw=i>=115?Math.PI/2:Math.PI;
 const input={
  w:true,s:false,a:false,d:i>=70&&i<96,
  jump:i>=75&&i<87,
  sprint:i>=35&&i<75,
  slide:i===117,
  crouch:i>=130&&i<150,
  ads:false,interact:false
 };
 p.yaw=yaw;
 const now=(i+1)/60;
 physics.simulate(p,input,1/60,now,map.weapons[0]);
 commands.push({now,yaw,input});
 trace.push({x:p.x,y:p.y,z:p.z,vx:p.vx,vy:p.vy,vz:p.vz,
  grounded:p.grounded,crouch:p.crouch});
}
fs.writeFileSync('stage65_replay_fixture.json',JSON.stringify({
 mapId:'dust_corridor',sourceTriangles:data.soup.count,
 spawn:map.spawnSets.A[pick],commands,trace
})+'\n');
console.log('Dust 6.5: '+trace.length+' source-mesh client replay ticks exported for Python parity');
