import assert from 'node:assert/strict';
import * as T from 'three';
import {matchPresentation,finishPresentation,matchNotice} from './static/match35.js';
import {createControlBeacon54,CONTROL54_COLORS} from './static/control54.js';
import {createMinimap} from './static/minimap.js';

const blue={id:'a',name:'Alpha',team:'azure',kills:3,deaths:2,rank:1};
const orange={id:'b',name:'Bravo',team:'ember',kills:4,deaths:2,rank:2};
const base={mode:'teamdeathmatch',phase:'playing',round:1,
 rules:{goal:30,teamBased:true,controlPoint:false},standings:[blue,orange],
 teamScores:{azure:17,ember:12},remaining:203};
let ui=matchPresentation(base,blue);
assert.equal(ui.teamMode,true);
assert.equal(ui.team,'azure');
assert.equal(ui.azure,17);assert.equal(ui.ember,12);
assert.equal(ui.objective,'TEAM DEATHMATCH · FIRST TO 30');
assert.equal(ui.leaderText,'AZURE 17  ·  EMBER 12');
assert.ok(Math.abs(ui.progress-100*17/30)<.0001);
assert.ok(ui.rankText.startsWith('AZURE TEAM'));
assert.equal(matchPresentation(base,orange).progress,40);

const objective={id:'neon-beacon',name:'NEON BEACON',
 x:2,y:0,z:16,radius:6,controller:'azure',contested:false,
 presence:{azure:1,ember:0}};
const control={...base,mode:'control',rules:{goal:60,teamBased:true,controlPoint:true},
 objective};
ui=matchPresentation(control,blue);
assert.equal(ui.objective,'CONTROL POINT · FIRST TO 60');
assert.equal(ui.pointStatus,'AZURE CONTROLS');
assert.ok(ui.leaderText.includes('AZURE CONTROLS'));
assert.ok(Math.abs(ui.progress-100*17/60)<.001);
assert.equal(matchPresentation({...control,objective:{...objective,contested:true}},blue).pointStatus,
 'BEACON CONTESTED');
assert.equal(matchPresentation({...control,objective:{...objective,controller:null}},blue).pointStatus,
 'BEACON UNCLAIMED');

const result=finishPresentation({...control,phase:'results',winner:'AZURE TEAM',
 winnerId:null,winnerTeam:'azure',winReason:'objective'});
assert.equal(result.headline,'AZURE TEAM WINS');
assert.equal(result.detail,'BEACON SECURED');
assert.equal(result.podium,'AZURE 17 · EMBER 12');
const teamWin=finishPresentation({...base,winner:'EMBER TEAM',winnerId:null,
 winnerTeam:'ember',winReason:'score'});
assert.equal(teamWin.headline,'EMBER TEAM WINS');
assert.equal(teamWin.detail,'TEAM SCORE LIMIT REACHED');
assert.equal(finishPresentation({...base,winner:'DRAW',winnerId:null,winnerTeam:null}).headline,
 'A DEAD HEAT.');
assert.equal(matchNotice({type:'control_status',team:null,contested:true},'a'),
 'BEACON CONTESTED');
assert.equal(matchNotice({type:'control_status',team:'azure',contested:false},'a'),
 'AZURE CONTROLS THE BEACON');
assert.equal(matchNotice({type:'round_end',winner:'AZURE TEAM',winnerTeam:'azure',
 winnerId:null},'a'),'AZURE TEAM TAKES THE ROUND');

const scene=new T.Scene();
const marker=createControlBeacon54(T,scene);
assert.equal(scene.children.length,1);
assert.equal(marker.root.userData.collidable,false);
assert.equal(marker.root.visible,false);
assert.equal(marker.root.children.length,3);
assert.ok(marker.root.children.every(item=>item.isMesh));
marker.update(objective,1,true);
assert.equal(marker.root.visible,true);
assert.equal(marker.root.position.z,16);
assert.equal(marker.ring.material.color.getHexString(),
 new T.Color(CONTROL54_COLORS.azure).getHexString());
marker.update({...objective,controller:'ember'},2,true);
assert.equal(marker.ring.material.color.getHexString(),
 new T.Color(CONTROL54_COLORS.ember).getHexString());
marker.update({...objective,contested:true},3,true);
assert.equal(marker.ring.material.color.getHexString(),
 new T.Color(CONTROL54_COLORS.neutral).getHexString());
marker.update(null,4,false);
assert.equal(marker.root.visible,false);
marker.dispose();
assert.equal(scene.children.length,0,'Objective marker must release map lifecycle');

// A friend may see teammate map dots but cannot see opposing positions.
const drawn=[];
const fakeContext=(isFront)=>({
 setTransform(){},fillRect(){},fillText(text){if(isFront)drawn.push({type:'text',text});},
 clearRect(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},
 arc(x,y,r){if(isFront)drawn.push({type:'arc',x,y,r});},
 fill(){},stroke(){},save(){},restore(){},translate(){},rotate(){}
});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>fakeContext(false)})};
const canvas={width:0,height:0,clientWidth:240,getContext:()=>fakeContext(true)};
const label={textContent:''};
const sampleMap={size:120,palette:{},boxes:[],zones:[
 {id:'plaza',name:'NEON PLAZA',x:0,z:20,w:25,d:30,color:'#4de9fc'}
]};
const mini=createMinimap(canvas,label,sampleMap);
mini.draw({x:0,y:0,z:22},0,1,{objective,team:'azure',meId:'a',players:[
 {id:'a',team:'azure',hp:100,x:0,z:22},
 {id:'b',team:'azure',hp:100,x:3,z:18},
 {id:'c',team:'ember',hp:100,x:5,z:15},
 {id:'d',team:'azure',hp:0,x:8,z:10}
]});
assert.equal(drawn.filter(d=>d.type==='arc').length,2,
 'Only active teammate + objective beacon render as circular map markers');
assert.ok(drawn.some(d=>d.type==='text'&&d.text==='C'),
 'Objective must have a map label');
assert.ok(label.textContent.includes('NEON PLAZA'));

console.log('05.4 team presentation, Control Point state, team victory,');
console.log('beacon lifecycle and private teammate/objective minimap passed.');
